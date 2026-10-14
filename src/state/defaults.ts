/** Empty state + version migration. Imported files must stay free of store imports so tests stay pure. */
import type { AppData, AppSettings } from '../types';
import { todayISO } from '../lib/date';

export const DEFAULT_SETTINGS: AppSettings = {
  userName: 'You',
  theme: 'system',
  weights: { deadline: 1, importance: 1, energyFit: 1, durationFit: 1, defer: 1 },
  evidencePrompt: true,
  demoDataLoaded: false,
  shuffleExclusions: [],
};

export function emptyData(): AppData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights } },
    goals: [],
    milestones: [],
    topics: [],
    trackProjects: [],
    practiceLogs: [],
    sessions: [],
    collegeSubjects: [],
    gateSubjects: [],
    mockTests: [],
    roadmap: [],
    accounts: [],
    content: [],
    deals: [],
    tasks: [],
    dayPlans: {},
    sleepLogs: [],
    reviews: [],
    events: [],
  };
}

const LIST_KEYS = [
  'goals',
  'milestones',
  'topics',
  'trackProjects',
  'practiceLogs',
  'sessions',
  'collegeSubjects',
  'gateSubjects',
  'mockTests',
  'roadmap',
  'accounts',
  'content',
  'deals',
  'tasks',
  'sleepLogs',
  'reviews',
  'events',
] as const;

/**
 * Defensive merge: guarantees every expected key exists with the right shape even if
 * the payload came from an older backup or a hand-edited file. Never throws on junk.
 */
export function migrate(input: unknown): { data: AppData; warnings: string[] } {
  const warnings: string[] = [];
  const base = emptyData();
  if (!input || typeof input !== 'object') {
    return { data: base, warnings: ['Payload was not an object — started from empty state.'] };
  }
  const raw = input as Record<string, unknown>;
  const out: AppData = { ...base, settings: { ...base.settings } };

  for (const key of LIST_KEYS) {
    const value = raw[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      (out[key] as unknown[]) = value.filter((row) => row && typeof row === 'object');
    } else {
      warnings.push(`Ignored "${key}" — expected an array.`);
    }
  }

  if (raw.dayPlans && typeof raw.dayPlans === 'object' && !Array.isArray(raw.dayPlans)) {
    out.dayPlans = raw.dayPlans as AppData['dayPlans'];
  } else if (raw.dayPlans !== undefined) {
    warnings.push('Ignored "dayPlans" — expected an object keyed by date.');
  }

  if (raw.settings && typeof raw.settings === 'object') {
    const s = raw.settings as Partial<AppSettings>;
    out.settings = {
      ...base.settings,
      ...s,
      weights: { ...base.settings.weights, ...(s.weights ?? {}) },
    };
  }

  // Per-row defaults so partially-formed rows cannot crash the UI.
  out.tasks = out.tasks.map((t) => ({
    ...t,
    dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
    history: Array.isArray(t.history) ? t.history : [],
    deferCount: Number.isFinite(t.deferCount) ? t.deferCount : 0,
    status: t.status ?? 'todo',
    area: t.area ?? 'admin',
    energy: t.energy ?? 'medium',
    cognitiveLoad: t.cognitiveLoad ?? 'medium',
    priority: t.priority ?? 'P2',
    importance: (t.importance ?? 3) as 1 | 2 | 3 | 4 | 5,
    estimatedMinutes: Number.isFinite(t.estimatedMinutes) ? t.estimatedMinutes : 30,
    mvc: t.mvc ?? '',
    finishCondition: t.finishCondition ?? '',
    notes: t.notes ?? '',
    evidenceRequired: Boolean(t.evidenceRequired),
    fixed: Boolean(t.fixed),
    id: t.id || `task_${Math.random().toString(36).slice(2)}`,
    createdAt: t.createdAt || todayISO(),
  }));

  out.goals = out.goals.map((g) => ({
    ...g,
    evidence: Array.isArray(g.evidence) ? g.evidence : [],
    dependencies: Array.isArray(g.dependencies) ? g.dependencies : [],
    history: Array.isArray(g.history) ? g.history : [],
    manualOverride: Boolean(g.manualOverride),
    manualProgress: Number.isFinite(g.manualProgress) ? g.manualProgress : 0,
    northStar: Boolean(g.northStar),
  }));

  out.milestones = out.milestones.map((m) => ({
    ...m,
    evidence: Array.isArray(m.evidence) ? m.evidence : [],
    weight: Number.isFinite(m.weight) ? m.weight : 1,
    status: m.status ?? 'pending',
  }));

  out.topics = out.topics.map((t) => ({
    ...t,
    evidence: Array.isArray(t.evidence) ? t.evidence : [],
    prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites : [],
    weight: Number.isFinite(t.weight) ? t.weight : 1,
    confidence: (t.confidence ?? 0) as 0 | 1 | 2 | 3 | 4 | 5,
    archived: Boolean(t.archived),
    order: Number.isFinite(t.order) ? t.order : 0,
  }));

  out.accounts = out.accounts.map((a) => ({
    ...a,
    metrics: Array.isArray(a.metrics) ? a.metrics : [],
  }));

  return { data: out, warnings };
}

/** Drops every seeded row and resets the demo flag — the "start clean" path. */
export function stripSeed(data: AppData): AppData {
  const notSeeded = <T extends { seeded?: boolean }>(rows: T[]) => rows.filter((r) => !r.seeded);
  return {
    ...data,
    settings: { ...data.settings, demoDataLoaded: false },
    goals: notSeeded(data.goals),
    milestones: notSeeded(data.milestones),
    topics: notSeeded(data.topics),
    trackProjects: notSeeded(data.trackProjects),
    practiceLogs: data.practiceLogs,
    sessions: data.sessions,
    collegeSubjects: notSeeded(data.collegeSubjects),
    gateSubjects: notSeeded(data.gateSubjects),
    mockTests: notSeeded(data.mockTests),
    roadmap: notSeeded(data.roadmap),
    accounts: notSeeded(data.accounts),
    content: notSeeded(data.content),
    deals: notSeeded(data.deals),
    tasks: notSeeded(data.tasks),
    reviews: notSeeded(data.reviews),
  };
}
