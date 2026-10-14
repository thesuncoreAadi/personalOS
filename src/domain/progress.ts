/**
 * Progress engine.
 *
 * Principles:
 *  1. Progress is always derived from explicit weighted children — never from elapsed time.
 *  2. A child that is "done" without the evidence its own rules demand is only partly
 *     credited (0.6). The UI surfaces that gap instead of silently inflating the bar.
 *  3. Learning progress and portfolio/deliverable evidence are separate numbers.
 */
import { addDays } from '../lib/date';
import type {
  AreaId,
  CollegeSubject,
  Goal,
  Milestone,
  MockTest,
  PracticeLog,
  RoadmapTopic,
  SyllabusTopic,
  TrackProject,
  TrackTopic,
} from '../types';

/** How much of the claimed credit we grant when a "done" item still lacks its evidence. */
export const UNVERIFIED_CREDIT = 0.6;

export interface WeightedRollup {
  value: number; // 0..1
  earned: number;
  total: number;
  doneCount: number;
  itemCount: number;
  unverified: string[]; // titles credited partially
}

function empty(): WeightedRollup {
  return { value: 0, earned: 0, total: 0, doneCount: 0, itemCount: 0, unverified: [] };
}

/* ------------------------------------------------------------------ */
/* Technical topics                                                    */
/* ------------------------------------------------------------------ */

export function topicCredit(t: TrackTopic): { credit: number; verified: boolean; reason: string } {
  if (t.status === 'skipped') return { credit: 0, verified: true, reason: 'skipped' };
  if (t.status === 'not_started') return { credit: 0, verified: true, reason: 'not started' };
  if (t.status === 'learning') return { credit: 0.45, verified: true, reason: 'in progress' };

  const hasEvidence = t.evidence.length > 0;
  const practiceMet = t.practiceTarget > 0 && t.practiceDone >= t.practiceTarget;
  const explained = t.confidence >= 3;
  if (hasEvidence || practiceMet || explained) {
    return { credit: 1, verified: true, reason: 'evidence recorded' };
  }
  return {
    credit: UNVERIFIED_CREDIT,
    verified: false,
    reason: 'marked done but no problems, assessment or link recorded',
  };
}

export function trackProgress(topics: TrackTopic[]): WeightedRollup {
  const active = topics.filter((t) => !t.archived);
  if (active.length === 0) return empty();
  const rollup = empty();
  for (const t of active) {
    rollup.total += t.weight;
    rollup.itemCount += 1;
    const { credit, verified } = topicCredit(t);
    rollup.earned += t.weight * credit;
    if (t.status === 'done') {
      rollup.doneCount += 1;
      if (!verified) rollup.unverified.push(t.title);
    }
  }
  rollup.value = rollup.total > 0 ? rollup.earned / rollup.total : 0;
  return rollup;
}

export function portfolioProgress(projects: TrackProject[]): WeightedRollup {
  if (projects.length === 0) return empty();
  const rollup = empty();
  for (const p of projects) {
    const weight = 1;
    rollup.total += weight;
    rollup.itemCount += 1;
    const parts = p.milestones.length;
    if (p.status === 'done' && p.evidence.length > 0) {
      rollup.earned += weight;
      rollup.doneCount += 1;
    } else if (p.status === 'done') {
      rollup.earned += weight * UNVERIFIED_CREDIT;
      rollup.doneCount += 1;
      rollup.unverified.push(p.title);
    } else if (parts > 0) {
      const done = p.milestones.filter((m) => m.done).length;
      rollup.earned += weight * (p.status === 'in_progress' ? 0.15 + 0.85 * (done / parts) : done / parts);
    }
  }
  rollup.value = rollup.total > 0 ? rollup.earned / rollup.total : 0;
  return rollup;
}

export function nextTopics(topics: TrackTopic[], limit = 3): TrackTopic[] {
  const active = topics.filter((t) => !t.archived);
  const doneIds = new Set(active.filter((t) => t.status === 'done' || t.status === 'skipped').map((t) => t.id));
  return active
    .filter((t) => t.status === 'not_started' || t.status === 'learning')
    .map((t) => ({ t, blocked: t.prerequisites.filter((p) => !doneIds.has(p)).length }))
    .sort((a, b) => {
      if ((a.t.status === 'learning') !== (b.t.status === 'learning')) {
        return a.t.status === 'learning' ? -1 : 1;
      }
      if (a.blocked !== b.blocked) return a.blocked - b.blocked;
      return a.t.order - b.t.order;
    })
    .slice(0, limit)
    .map((x) => x.t);
}

export function currentlyLearning(topics: TrackTopic[]): TrackTopic[] {
  return topics.filter((t) => !t.archived && t.status === 'learning');
}

/* ------------------------------------------------------------------ */
/* Goals & milestones                                                  */
/* ------------------------------------------------------------------ */

export function goalProgress(goal: Goal, milestones: Milestone[]): WeightedRollup {
  if (goal.manualOverride) {
    const r = empty();
    r.value = Math.max(0, Math.min(1, goal.manualProgress));
    r.earned = r.value;
    r.total = 1;
    r.itemCount = milestones.filter((m) => m.goalId === goal.id).length;
    r.doneCount = milestones.filter((m) => m.goalId === goal.id && m.status === 'done').length;
    return r;
  }
  const ms = milestones.filter((m) => m.goalId === goal.id);
  if (ms.length === 0) return empty();
  const rollup = empty();
  for (const m of ms) {
    rollup.total += m.weight;
    rollup.itemCount += 1;
    if (m.status === 'done') {
      rollup.doneCount += 1;
      if (m.evidenceRequired && m.evidence.length === 0) {
        rollup.earned += m.weight * UNVERIFIED_CREDIT;
        rollup.unverified.push(m.title);
      } else {
        rollup.earned += m.weight;
      }
    }
  }
  rollup.value = rollup.total > 0 ? rollup.earned / rollup.total : 0;
  return rollup;
}

/** Fraction of the goal's calendar window that has elapsed — shown separately, never as progress. */
export function timeElapsed(startDate: string, targetDate: string, nowISO: string): number {
  const start = Date.parse(startDate);
  const end = Date.parse(targetDate);
  const now = Date.parse(nowISO);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.min(1, (now - start) / (end - start)));
}

export function nextMilestone(goalId: string, milestones: Milestone[]): Milestone | undefined {
  return milestones
    .filter((m) => m.goalId === goalId && m.status === 'pending')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

/* ------------------------------------------------------------------ */
/* Academics                                                           */
/* ------------------------------------------------------------------ */

export function syllabusCoverage(subject: CollegeSubject): WeightedRollup {
  if (subject.topics.length === 0) return empty();
  const rollup = empty();
  for (const t of subject.topics) {
    rollup.total += t.weight;
    rollup.itemCount += 1;
    if (t.status === 'done') {
      rollup.earned += t.weight;
      rollup.doneCount += 1;
    } else if (t.status === 'learning') {
      rollup.earned += t.weight * 0.5;
    }
  }
  rollup.value = rollup.total > 0 ? rollup.earned / rollup.total : 0;
  return rollup;
}

export function revisionCoverage(subject: CollegeSubject): number {
  if (subject.topics.length === 0) return 0;
  const scores: Record<SyllabusTopic['revision'], number> = { none: 0, once: 0.5, twice: 0.8, mastered: 1 };
  let total = 0;
  let earned = 0;
  for (const t of subject.topics) {
    total += t.weight;
    earned += t.weight * scores[t.revision];
  }
  return total > 0 ? earned / total : 0;
}

export interface ExamReadiness {
  value: number; // 0..1
  components: { label: string; value: number; weight: number }[];
  weakTopics: string[];
}

/**
 * Exam readiness is deliberately NOT syllabus coverage.
 * It blends self-reported confidence, revision depth, recent practice volume and
 * timed-assessment performance, minus a penalty for the share of the syllabus that
 * is still flagged weak.
 */
export function examReadiness(
  subject: CollegeSubject,
  practice: PracticeLog[],
  nowISO: string,
): ExamReadiness {
  const topics = subject.topics;
  if (topics.length === 0) {
    return { value: 0, components: [], weakTopics: [] };
  }
  let conf = 0;
  let total = 0;
  const weak: string[] = [];
  let weakWeight = 0;
  for (const t of topics) {
    total += t.weight;
    conf += t.weight * (t.confidence / 5);
    if (t.weak) {
      weak.push(t.title);
      weakWeight += t.weight;
    }
  }
  const confidence = total > 0 ? conf / total : 0;
  const revision = revisionCoverage(subject);

  const logs = practice.filter((p) => p.scope === 'college' && p.subject === subject.name);
  const windowStart = addDays(nowISO, -14);
  const last14 = logs.filter((p) => p.date >= windowStart && p.date <= nowISO);
  const volume = Math.min(1, logs.reduce((s, l) => s + l.attempted, 0) / 120);
  const recency = last14.length > 0 ? 1 : logs.length > 0 ? 0.5 : 0;

  const assessments = subject.timedAssessments;
  const avgAssessment =
    assessments.length > 0
      ? assessments.reduce((s, a) => s + (a.max > 0 ? a.score / a.max : 0), 0) / assessments.length
      : 0;

  const weakShare = total > 0 ? weakWeight / total : 0;

  const components = [
    { label: 'Confidence', value: confidence, weight: 0.25 },
    { label: 'Revision depth', value: revision, weight: 0.2 },
    { label: 'Practice volume', value: volume, weight: 0.2 },
    { label: 'Practice recency', value: recency, weight: 0.1 },
    { label: 'Timed assessments', value: avgAssessment, weight: 0.25 },
    { label: 'Weak-topic penalty', value: 1 - weakShare, weight: 0 },
  ];

  const base =
    confidence * 0.25 + revision * 0.2 + volume * 0.2 + recency * 0.1 + avgAssessment * 0.25;
  const penalty = weakShare * 0.2;
  return {
    value: Math.max(0, Math.min(1, base - penalty)),
    components,
    weakTopics: weak,
  };
}

/* ------------------------------------------------------------------ */
/* GATE                                                                */
/* ------------------------------------------------------------------ */

export function gateTopicProgress(subject: { topics: { weight: number; status: string }[] }): number {
  const topics = subject.topics;
  if (topics.length === 0) return 0;
  let total = 0;
  let earned = 0;
  for (const t of topics) {
    total += t.weight;
    if (t.status === 'done') earned += t.weight;
    else if (t.status === 'learning') earned += t.weight * 0.5;
  }
  return total > 0 ? earned / total : 0;
}

export function gateProgress(
  subjects: { weight: number; topics: { weight: number; status: string }[] }[],
): number {
  if (subjects.length === 0) return 0;
  let total = 0;
  let earned = 0;
  for (const s of subjects) {
    total += s.weight;
    earned += s.weight * gateTopicProgress(s);
  }
  return total > 0 ? earned / total : 0;
}

export interface GateStats {
  pyqsAttempted: number;
  solvedIndependently: number;
  solvedWithHints: number;
  accuracy: number; // solved independently / attempted
  mockTrend: { date: string; pct: number }[];
  averageMock: number;
  bestMock: number;
  weakTopics: string[];
  revisionCycles: number;
  minutes: number;
}

export function gateStats(
  logs: PracticeLog[],
  mocks: MockTest[],
  subjects: { topics: { title: string; weak: boolean }[] }[],
): GateStats {
  const gateLogs = logs.filter((l) => l.scope === 'gate');
  const attempted = gateLogs.reduce((s, l) => s + l.attempted, 0);
  const independent = gateLogs.reduce((s, l) => s + l.solvedIndependently, 0);
  const hints = gateLogs.reduce((s, l) => s + l.solvedWithHints, 0);
  const trend = mocks
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, pct: m.max > 0 ? m.score / m.max : 0 }));
  const weak = new Set<string>();
  for (const s of subjects) for (const t of s.topics) if (t.weak) weak.add(t.title);
  return {
    pyqsAttempted: attempted,
    solvedIndependently: independent,
    solvedWithHints: hints,
    accuracy: attempted > 0 ? independent / attempted : 0,
    mockTrend: trend,
    averageMock: trend.length ? trend.reduce((s, t) => s + t.pct, 0) / trend.length : 0,
    bestMock: trend.length ? Math.max(...trend.map((t) => t.pct)) : 0,
    weakTopics: [...weak],
    revisionCycles: 0,
    minutes: gateLogs.reduce((s, l) => s + l.minutes, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Semiconductor roadmap                                               */
/* ------------------------------------------------------------------ */

export function roadmapProgress(topics: RoadmapTopic[]): WeightedRollup {
  if (topics.length === 0) return empty();
  const rollup = empty();
  for (const t of topics) {
    rollup.total += t.weight;
    rollup.itemCount += 1;
    if (t.status === 'done') {
      rollup.doneCount += 1;
      if (t.evidence.length === 0 && !t.assignment.trim()) {
        rollup.earned += t.weight * UNVERIFIED_CREDIT;
        rollup.unverified.push(t.title);
      } else {
        rollup.earned += t.weight;
      }
    } else if (t.status === 'learning') {
      rollup.earned += t.weight * 0.5;
    }
  }
  rollup.value = rollup.total > 0 ? rollup.earned / rollup.total : 0;
  return rollup;
}

/* ------------------------------------------------------------------ */
/* Area rollup (weighted across goals + learning/portfolio evidence)    */
/* ------------------------------------------------------------------ */

export interface AreaProgress {
  area: AreaId;
  value: number;
  components: { label: string; value: number; weight: number }[];
}

/**
 * Area progress = weighted blend of its goals (milestone-backed) and, for the
 * technical area, the three learning tracks plus portfolio evidence.
 * Weights are user-editable in Settings.
 */
export function areaProgress(
  area: AreaId,
  goals: Goal[],
  milestones: Milestone[],
  topics: TrackTopic[],
  projects: TrackProject[],
  roadmap: RoadmapTopic[],
): AreaProgress {
  const areaGoals = goals.filter((g) => g.area === area && g.status !== 'archived');
  const goalScores = areaGoals.map((g) => goalProgress(g, milestones).value);
  const goalAvg = goalScores.length ? goalScores.reduce((a, b) => a + b, 0) / goalScores.length : 0;

  const components: { label: string; value: number; weight: number }[] = [
    { label: 'Goals (milestones)', value: goalAvg, weight: areaGoals.length ? 0.5 : 0 },
  ];

  let extra = 0;
  let extraWeight = 0;

  if (area === 'technical') {
    const learning = topics.filter((t) => !t.archived);
    const learningScore = learning.length ? trackProgress(learning).value : 0;
    const portfolio = projects.length ? portfolioProgress(projects).value : 0;
    components.push({ label: 'Topic mastery (3 tracks)', value: learningScore, weight: 0.35 });
    components.push({ label: 'Portfolio evidence', value: portfolio, weight: 0.15 });
    extra = learningScore * 0.35 + portfolio * 0.15;
    extraWeight = 0.5;
  }

  if (area === 'academics') {
    const semi = roadmap.length ? roadmapProgress(roadmap).value : 0;
    components.push({ label: 'Semiconductor roadmap', value: semi, weight: 0.5 });
    extra = semi * 0.5;
    extraWeight = 0.5;
  }

  const goalWeight = components[0].weight;
  const denom = goalWeight + extraWeight;
  const value = denom > 0 ? (goalAvg * goalWeight + extra) / denom : 0;
  return { area, value, components };
}

/* ------------------------------------------------------------------ */
/* Health / status                                                     */
/* ------------------------------------------------------------------ */

export type Health = 'on_track' | 'at_risk' | 'overdue' | 'completed' | 'not_started';

export function goalHealth(
  goal: Goal,
  milestones: Milestone[],
  nowISO: string,
): { health: Health; reason: string } {
  if (goal.status === 'completed') return { health: 'completed', reason: 'marked complete' };
  const prog = goalProgress(goal, milestones).value;
  const elapsed = timeElapsed(goal.startDate, goal.targetDate, nowISO);
  const next = nextMilestone(goal.id, milestones);
  if (next && next.dueDate < nowISO) {
    return { health: 'overdue', reason: `milestone "${next.title}" overdue` };
  }
  if (goal.targetDate < nowISO) {
    return { health: prog >= 1 ? 'completed' : 'overdue', reason: 'target date passed' };
  }
  if (elapsed - prog > 0.15) {
    return {
      health: 'at_risk',
      reason: `progress ${Math.round(prog * 100)}% vs ${Math.round(elapsed * 100)}% of timeline used`,
    };
  }
  if (prog === 0 && elapsed === 0) return { health: 'not_started', reason: 'not started yet' };
  return { health: 'on_track', reason: 'progress keeping pace with the timeline' };
}
