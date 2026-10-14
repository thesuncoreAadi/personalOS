/**
 * Adaptive task engine.
 *
 * The ranking is a transparent weighted sum — every component is returned alongside
 * the score so the UI can explain *why* a task was recommended. There is no hidden
 * model, no randomness in scoring, and no mutation of deadlines.
 *
 * score = deadline(0-30) + importance(0-20) + energyFit(0-15) + durationFit(0-15)
 *       + defer(0-8) − prerequisite(25) − recovery(50) − alreadySuggested(6)
 *
 * Shuffling only re-ranks. Deadlines, fixed commitments and task records are never
 * modified by `rankTasks`; slot changes go through a separate, explicit action.
 */
import { diffDays, isValidISO } from '../lib/date';
import type { AppSettings, Energy, Task } from '../types';

export const ENERGY_RANK: Record<Energy, number> = { exhausted: 0, low: 1, medium: 2, high: 3 };
const PRIORITY_BASE: Record<Task['priority'], number> = { P1: 4, P2: 2, P3: 0 };

export const DEFAULT_WEIGHTS: AppSettings['weights'] = {
  deadline: 1,
  importance: 1,
  energyFit: 1,
  durationFit: 1,
  defer: 1,
};

export interface RankContext {
  nowISO: string;
  /** Longest uninterrupted block available, in minutes. */
  availableMinutes: number;
  energy: Energy;
  weights?: AppSettings['weights'];
  /**
   * Hard exclusion: these ids are removed from the pool entirely. Used by
   * "find another suitable task" so the user genuinely sees a different option.
   */
  excludeIds?: string[];
  /**
   * Soft de-prioritisation: these ids stay in the pool but score lower, so a
   * re-shuffle surfaces something new without ever hiding a task.
   */
  deprioritizeIds?: string[];
  /** Hard-filter to a scope, used by the area pages. */
  area?: Task['area'];
  goalIds?: string[];
  /** When set, only these task ids are considered. */
  onlyIds?: string[];
}

export interface ScorePart {
  key: string;
  label: string;
  value: number;
  detail: string;
}

export interface TaskMatch {
  task: Task;
  score: number;
  parts: ScorePart[];
  fitsWindow: boolean;
  fitsEnergy: boolean;
  blockedBy: string[];
  deferred: boolean;
  excluded: boolean;
  excludeReason?: string;
  usesMvc: boolean;
}

export interface Recommendation {
  primary?: TaskMatch;
  alternates: TaskMatch[];
  recovery: TaskMatch[];
  ranked: TaskMatch[];
  mode: 'deep' | 'normal' | 'light' | 'recovery';
  explanation: string;
  considered: number;
  excluded: number;
}

const MAX_DEPTH = 3;

/** Fixed penalties. Deliberately larger than any positive factor so they dominate. */
const PREREQUISITE_PENALTY = 25;
const RECOVERY_PENALTY = 50;
const SUGGESTED_PENALTY = 6;

export function energyMode(energy: Energy): Recommendation['mode'] {
  if (energy === 'exhausted') return 'recovery';
  if (energy === 'low') return 'light';
  if (energy === 'high') return 'deep';
  return 'normal';
}

function deadlinePart(task: Task, nowISO: string): ScorePart {
  const base: ScorePart = {
    key: 'deadline',
    label: 'Deadline urgency',
    value: 0,
    detail: 'no deadline — ranked on importance only',
  };
  if (!task.deadline || !isValidISO(task.deadline)) return base;
  const days = diffDays(nowISO, task.deadline);
  if (days < 0) {
    return {
      ...base,
      value: 30,
      detail: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue — highest urgency`,
    };
  }
  if (days === 0) return { ...base, value: 28, detail: 'due today' };
  if (days <= 2) return { ...base, value: 25, detail: `due in ${days} day${days === 1 ? '' : 's'}` };
  if (days <= 7) return { ...base, value: 18, detail: `due in ${days} days` };
  if (days <= 14) return { ...base, value: 11, detail: `due in ${days} days` };
  if (days <= 30) return { ...base, value: 6, detail: `due in ${days} days` };
  return { ...base, value: 2, detail: `due in ${days} days — not urgent yet` };
}

function importancePart(task: Task): ScorePart {
  const fromImportance = (task.importance - 1) * 3.2; // 1..5 -> 0..12.8
  const value = fromImportance + PRIORITY_BASE[task.priority]; // + 0..4 => max ~16.8
  return {
    key: 'importance',
    label: 'Goal importance',
    value,
    detail: `importance ${task.importance}/5, priority ${task.priority}`,
  };
}

function energyPart(task: Task, energy: Energy): { part: ScorePart; fits: boolean } {
  // Recovery mode still permits genuinely light work; everything else stays out.
  const cap = Math.max(ENERGY_RANK[energy], energy === 'exhausted' ? 1 : 0);
  const need = ENERGY_RANK[task.energy];
  // Demand tiers: light work needs at most a low-energy day, medium work needs a
  // medium day, heavy thinking needs one tier above its nominal energy level.
  const demand =
    task.cognitiveLoad === 'light'
      ? Math.min(1, need)
      : task.cognitiveLoad === 'heavy'
        ? Math.min(3, need + 1)
        : need;
  const fits = demand <= cap;
  if (!fits) {
    return {
      part: {
        key: 'energy',
        label: 'Energy fit',
        value: 0,
        detail: `needs ${task.energy} energy (${task.cognitiveLoad} load) — you are at ${energy}`,
      },
      fits: false,
    };
  }
  // Slightly prefer work that actually uses the available capacity.
  const utilisation = cap === 0 ? 1 : demand / cap;
  const value = 8 + 7 * utilisation;
  return {
    part: {
      key: 'energy',
      label: 'Energy fit',
      value,
      detail: `${task.energy} energy, ${task.cognitiveLoad} load — matches ${energy}`,
    },
    fits: true,
  };
}

function durationPart(
  task: Task,
  availableMinutes: number,
): { part: ScorePart; fitsWindow: boolean; usesMvc: boolean } {
  const est = Math.max(5, task.estimatedMinutes);
  if (availableMinutes <= 0) {
    return {
      part: { key: 'duration', label: 'Time fit', value: 0, detail: 'no time window recorded' },
      fitsWindow: false,
      usesMvc: false,
    };
  }
  if (est <= availableMinutes) {
    // Best when the task uses 40–90% of the window: too short wastes the block.
    const ratio = est / availableMinutes;
    const value = ratio < 0.15 ? 4 : ratio < 0.4 ? 10 : ratio <= 0.9 ? 15 : 12;
    return {
      part: {
        key: 'duration',
        label: 'Time fit',
        value,
        detail: `~${est}m fits in your ${availableMinutes}m block`,
      },
      fitsWindow: true,
      usesMvc: false,
    };
  }
  const hasMvc = task.mvc.trim().length > 0;
  if (hasMvc && availableMinutes >= 20) {
    return {
      part: {
        key: 'duration',
        label: 'Time fit',
        value: 7,
        detail: `full task is ~${est}m — a minimum viable version fits your ${availableMinutes}m block`,
      },
      fitsWindow: false,
      usesMvc: true,
    };
  }
  return {
    part: {
      key: 'duration',
      label: 'Time fit',
      value: 1,
      detail: `needs ~${est}m, you have ${availableMinutes}m`,
    },
    fitsWindow: false,
    usesMvc: false,
  };
}

function deferPart(task: Task): ScorePart {
  if (task.deferCount <= 0) {
    return { key: 'defer', label: 'Deferral', value: 0, detail: 'never postponed' };
  }
  const value = Math.min(8, task.deferCount * 3);
  const last = task.lastDeferredAt ? ` (last postponed ${task.lastDeferredAt})` : '';
  return {
    key: 'defer',
    label: 'Deferral',
    value,
    detail: `postponed ${task.deferCount}×${last}`,
  };
}

export function incompleteDependencies(task: Task, tasks: Task[]): Task[] {
  if (!task.dependencies?.length) return [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: Task[] = [];
  for (const depId of task.dependencies) {
    const dep = byId.get(depId);
    if (!dep) continue;
    if (dep.status !== 'done' && dep.status !== 'dropped') out.push(dep);
  }
  return out;
}

function hasCycle(task: Task, tasks: Task[], seen = new Set<string>(), depth = 0): boolean {
  if (depth > MAX_DEPTH) return false;
  if (seen.has(task.id)) return true;
  seen.add(task.id);
  const deps = incompleteDependencies(task, tasks);
  return deps.some((d) => hasCycle(d, tasks, new Set(seen), depth + 1));
}

export function rankTasks(tasks: Task[], ctx: RankContext): Recommendation {
  const weights = { ...DEFAULT_WEIGHTS, ...(ctx.weights ?? {}) };
  const mode = energyMode(ctx.energy);
  const doneIds = new Set(tasks.filter((t) => t.status === 'done' || t.status === 'dropped').map((t) => t.id));

  let pool = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  if (ctx.excludeIds?.length) {
    const excluded = new Set(ctx.excludeIds);
    pool = pool.filter((t) => !excluded.has(t.id));
  }
  if (ctx.onlyIds) pool = pool.filter((t) => ctx.onlyIds!.includes(t.id));
  if (ctx.area) pool = pool.filter((t) => t.area === ctx.area);
  if (ctx.goalIds?.length) pool = pool.filter((t) => t.goalId && ctx.goalIds!.includes(t.goalId));

  const considered = pool.length;
  const matches: TaskMatch[] = [];
  let excluded = 0;

  for (const task of pool) {
    const parts: ScorePart[] = [];
    const blockedBy = incompleteDependencies(task, tasks).filter((d) => !doneIds.has(d.id));
    if (blockedBy.length) excluded += 1;

    const dPart = deadlinePart(task, ctx.nowISO);
    const iPart = importancePart(task);
    const e = energyPart(task, ctx.energy);
    const du = durationPart(task, ctx.availableMinutes);
    const fPart = deferPart(task);

    parts.push(dPart, iPart, e.part, du.part, fPart);

    let score =
      dPart.value * weights.deadline +
      iPart.value * weights.importance +
      e.part.value * weights.energyFit +
      du.part.value * weights.durationFit +
      fPart.value * weights.defer;

    if (blockedBy.length) {
      score -= PREREQUISITE_PENALTY;
      parts.push({
        key: 'blocked',
        label: 'Prerequisite',
        value: -PREREQUISITE_PENALTY,
        detail: `waiting on: ${blockedBy.map((b) => b.title).join(', ')}`,
      });
    }

    if (ctx.deprioritizeIds?.includes(task.id)) {
      score -= SUGGESTED_PENALTY;
      parts.push({
        key: 'shuffle',
        label: 'Already suggested',
        value: -SUGGESTED_PENALTY,
        detail: 'surfaced earlier in this window — still available, ranked lower',
      });
    }

    if (mode === 'recovery' && task.area !== 'admin' && ENERGY_RANK[task.energy] > 1) {
      score -= RECOVERY_PENALTY;
      parts.push({
        key: 'recovery',
        label: 'Recovery mode',
        value: -RECOVERY_PENALTY,
        detail: 'energy is exhausted — heavier work de-prioritised',
      });
    }

    matches.push({
      task,
      score,
      parts,
      fitsWindow: du.fitsWindow,
      fitsEnergy: e.fits,
      blockedBy: blockedBy.map((b) => b.title),
      deferred: task.deferCount > 0,
      excluded: blockedBy.length > 0 || hasCycle(task, tasks),
      excludeReason: blockedBy.length
        ? `blocked by ${blockedBy.map((b) => b.title).join(', ')}`
        : undefined,
      usesMvc: du.usesMvc,
    });
  }

  const ranked = matches.sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title));

  const workable = ranked.filter((m) => !m.excluded && m.fitsEnergy);
  const primary = workable.find((m) => m.fitsWindow || m.usesMvc) ?? workable[0];
  const alternates = workable.filter((m) => m !== primary).slice(0, 4);

  const recovery = ranked.filter(
    (m) => !m.excluded && (m.task.area === 'admin' || ENERGY_RANK[m.task.energy] <= 1),
  );

  return {
    primary,
    alternates,
    recovery: mode === 'recovery' ? recovery : recovery.filter((m) => m !== primary).slice(0, 3),
    ranked,
    mode,
    explanation: buildExplanation(primary, ctx, mode),
    considered,
    excluded,
  };
}

export function buildExplanation(
  primary: TaskMatch | undefined,
  ctx: RankContext,
  mode: Recommendation['mode'],
): string {
  const window = ctx.availableMinutes > 0 ? `${ctx.availableMinutes}m` : 'no recorded';
  if (mode === 'recovery') {
    if (!primary) {
      return `You logged exhausted energy with a ${window} window. No task is worth forcing — a recovery block is the recommendation.`;
    }
    return `Exhausted energy, ${window} window: recommending only low-demand work (${primary.task.title}). Anything heavier can wait.`;
  }
  if (!primary) {
    return `Nothing eligible in a ${window} window at ${ctx.energy} energy. Add a task, widen the window, or take the recovery option.`;
  }
  const top = primary.parts
    .filter((p) => p.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3);
  const why = top.map((p) => `${p.label.toLowerCase()} — ${p.detail}`).join('; ');
  return `${primary.task.title}: ${why}. Window ${window}, energy ${ctx.energy}.`;
}

/** "Find another suitable task": same rules, different pick, explained. */
export function findAnother(
  tasks: Task[],
  ctx: RankContext,
  alreadySuggested: string[],
): Recommendation {
  // Hard exclusion: everything already suggested is removed from the pool.
  const rec = rankTasks(tasks, { ...ctx, excludeIds: alreadySuggested, deprioritizeIds: [] });
  const workable = rec.ranked.filter((m) => !m.excluded && m.fitsEnergy);
  const fresh = workable.find((m) => m.fitsWindow || m.usesMvc) ?? workable[0];
  if (fresh) {
    return {
      ...rec,
      primary: fresh,
      alternates: workable.filter((m) => m !== fresh).slice(0, 4),
      explanation: `Switched recommendation — ${buildExplanation(fresh, ctx, rec.mode)}`,
    };
  }
  return {
    ...rec,
    explanation: `No other eligible task for a ${ctx.availableMinutes}m window at ${ctx.energy} energy. Every remaining task is blocked, completed, or needs more energy/time than you have.`,
  };
}

/**
 * Shuffle = re-rank for the current window. Returns a NEW ordering plus the reason.
 * It never touches deadlines, never deletes tasks, and never moves fixed commitments
 * (fixed commitments are not tasks in the first place — they live on the day plan).
 */
export function shuffleTasks(
  tasks: Task[],
  ctx: RankContext,
  alreadySuggested: string[],
): { order: string[]; suggestion?: string; reasons: string[]; movedFixed: string[] } {
  // Already-suggested tasks are set aside while any other eligible task exists, so
  // shuffle genuinely surfaces something new. They come back if nothing else fits —
  // shuffle never deletes a task or changes its deadline.
  const full = rankTasks(tasks, { ...ctx, deprioritizeIds: alreadySuggested, excludeIds: [] });
  const rec =
    alreadySuggested.length > 0
      ? rankTasks(tasks, { ...ctx, deprioritizeIds: [], excludeIds: alreadySuggested })
      : full;
  const usable = (rec.ranked.filter((m) => !m.excluded).length > 0
    ? rec.ranked
    : full.ranked
  ).filter((m) => !m.excluded);
  const reasons = usable.slice(0, 5).map(
    (m) => `${m.task.title} — ${m.parts.filter((p) => p.value > 0).sort((a, b) => b.value - a.value)[0]?.detail ?? 'eligible'}`,
  );
  const suggestion = rec.primary
    ? `${rec.primary.task.title}: ${rec.explanation}`
    : rec.explanation;
  return {
    order: usable.map((m) => m.task.id),
    suggestion,
    reasons,
    movedFixed: [], // shuffle is read-only with respect to the schedule
  };
}
