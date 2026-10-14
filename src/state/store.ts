/**
 * Application store (zustand) + persistence.
 *
 * Every mutation goes through here so that (a) localStorage stays in sync and
 * (b) progress-affecting actions can write to the event log at the same time.
 */
import { create } from 'zustand';
import type {
  Account,
  AccountMetric,
  AppData,
  BrandDeal,
  CollegeSubject,
  ContentItem,
  DayPlan,
  FocusedSession,
  GateSubject,
  Goal,
  Milestone,
  MockTest,
  PracticeLog,
  ProgressEvent,
  RoadmapTopic,
  SleepLog,
  Task,
  TrackId,
  TrackProject,
  TrackTopic,
  WeeklyReview,
} from '../types';
import { uid } from '../lib/ids';
import { addDays, todayISO } from '../lib/date';
import { buildSeedData } from '../lib/seed';
import { clearRaw, readRaw, storageAvailable, writeRaw } from './storage';
import { emptyData, migrate, stripSeed } from './defaults';

const MAX_EVENTS = 800;

export interface StoreState {
  data: AppData;
  hydrated: boolean;
  storageOk: boolean;
  lastSavedAt?: string;
  importWarnings: string[];
  /** actions */
  hydrate: () => void;
  resetEmpty: () => void;
  loadDemoData: (mode: 'replace' | 'merge') => void;
  clearDemoData: () => void;
  replaceAll: (data: AppData, warnings?: string[]) => void;
  update: (fn: (draft: AppData) => AppData | void) => void;
  logEvent: (e: Omit<ProgressEvent, 'id'>) => void;
}

function persist(data: AppData): string | undefined {
  const payload = { ...data, exportedAt: new Date().toISOString() };
  const ok = writeRaw(JSON.stringify(payload));
  return ok ? new Date().toISOString() : undefined;
}

function logInto(data: AppData, e: Omit<ProgressEvent, 'id'>): AppData {
  const events = [{ ...e, id: uid() }, ...data.events].slice(0, MAX_EVENTS);
  return { ...data, events };
}

export const useStore = create<StoreState>((set, get) => ({
  data: emptyData(),
  hydrated: false,
  storageOk: true,
  importWarnings: [],

  hydrate: () => {
    const raw = readRaw();
    if (!raw) {
      set({ hydrated: true, storageOk: storageAvailable });
      return;
    }
    try {
      const { data, warnings } = migrate(JSON.parse(raw));
      set({ data, hydrated: true, storageOk: storageAvailable, importWarnings: warnings });
    } catch {
      set({
        hydrated: true,
        storageOk: storageAvailable,
        importWarnings: ['Saved data could not be parsed — started from an empty state.'],
      });
    }
  },

  update: (fn) => {
    const current = get().data;
    // `fn` may either mutate the shallow draft in place or return a replacement.
    const draft: AppData = { ...current };
    const returned = fn(draft);
    const next = returned ?? draft;
    const savedAt = persist(next);
    set({ data: next, lastSavedAt: savedAt });
  },

  logEvent: (e) => {
    const next = logInto(get().data, e);
    const savedAt = persist(next);
    set({ data: next, lastSavedAt: savedAt });
  },

  resetEmpty: () => {
    const fresh = emptyData();
    const savedAt = persist(fresh);
    set({ data: fresh, lastSavedAt: savedAt, importWarnings: [] });
  },

  loadDemoData: (mode) => {
    const seed = buildSeedData();
    const current = get().data;
    const next: AppData =
      mode === 'replace'
        ? { ...seed, settings: { ...seed.settings, theme: current.settings.theme, userName: current.settings.userName } }
        : {
            ...current,
            settings: { ...current.settings, demoDataLoaded: true },
            goals: [...current.goals, ...seed.goals],
            milestones: [...current.milestones, ...seed.milestones],
            topics: [...current.topics, ...seed.topics],
            trackProjects: [...current.trackProjects, ...seed.trackProjects],
            practiceLogs: [...current.practiceLogs, ...seed.practiceLogs],
            sessions: [...current.sessions, ...seed.sessions],
            collegeSubjects: [...current.collegeSubjects, ...seed.collegeSubjects],
            gateSubjects: [...current.gateSubjects, ...seed.gateSubjects],
            mockTests: [...current.mockTests, ...seed.mockTests],
            roadmap: [...current.roadmap, ...seed.roadmap],
            accounts: [...current.accounts, ...seed.accounts],
            content: [...current.content, ...seed.content],
            deals: [...current.deals, ...seed.deals],
            tasks: [...current.tasks, ...seed.tasks],
            dayPlans: { ...seed.dayPlans, ...current.dayPlans },
            sleepLogs: [...current.sleepLogs, ...seed.sleepLogs],
            reviews: [...current.reviews, ...seed.reviews],
          };
    const savedAt = persist(next);
    set({ data: next, lastSavedAt: savedAt });
  },

  clearDemoData: () => {
    const next = stripSeed(get().data);
    const savedAt = persist(next);
    set({ data: next, lastSavedAt: savedAt });
  },

  replaceAll: (incoming, warnings = []) => {
    const { data, warnings: w } = migrate(incoming);
    const savedAt = persist(data);
    set({ data, lastSavedAt: savedAt, importWarnings: [...warnings, ...w] });
  },
}));

/* ------------------------------------------------------------------ */
/* Typed helpers                                                       */
/* ------------------------------------------------------------------ */

function patch<T extends { id: string }>(rows: T[], id: string, changes: Partial<T>): T[] {
  return rows.map((r) => (r.id === id ? { ...r, ...changes } : r));
}

export const actions = {
  /* ---- goals ---- */
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'history'> & Partial<Pick<Goal, 'history'>>) => {
    const full: Goal = { ...goal, id: uid('goal'), createdAt: todayISO(), history: [] };
    useStore.getState().update((d) => {
      d.goals = [...d.goals, full];
    });
    return full;
  },
  updateGoal: (id: string, changes: Partial<Goal>) => {
    useStore.getState().update((d) => {
      d.goals = patch(d.goals, id, changes);
    });
  },
  removeGoal: (id: string) => {
    useStore.getState().update((d) => {
      d.goals = d.goals.filter((g) => g.id !== id);
      d.milestones = d.milestones.filter((m) => m.goalId !== id);
      d.tasks = d.tasks.map((t) => (t.goalId === id ? { ...t, goalId: undefined } : t));
    });
  },
  recordGoalProgress: (id: string, value: number, note = '') => {
    const today = todayISO();
    useStore.getState().update((d) => {
      d.goals = patch(d.goals, id, {
        manualOverride: true,
        manualProgress: Math.max(0, Math.min(1, value)),
        history: [
          ...(d.goals.find((g) => g.id === id)?.history ?? []),
          { id: uid(), date: today, value, source: 'manual', note },
        ],
      });
    });
  },

  /* ---- milestones ---- */
  addMilestone: (m: Omit<Milestone, 'id' | 'createdAt' | 'evidence'>) => {
    const full: Milestone = { ...m, id: uid('ms'), createdAt: todayISO(), evidence: [] };
    useStore.getState().update((d) => {
      d.milestones = [...d.milestones, full];
    });
    return full;
  },
  updateMilestone: (id: string, changes: Partial<Milestone>) => {
    useStore.getState().update((d) => {
      d.milestones = patch(d.milestones, id, changes);
    });
  },
  removeMilestone: (id: string) => {
    useStore.getState().update((d) => {
      d.milestones = d.milestones.filter((m) => m.id !== id);
    });
  },
  addMilestoneEvidence: (id: string, evidence: { label: string; url: string; note: string }) => {
    useStore.getState().update((d) => {
      d.milestones = d.milestones.map((m) =>
        m.id === id
          ? {
              ...m,
              evidence: [...m.evidence, { ...evidence, id: uid(), createdAt: todayISO() }],
            }
          : m,
      );
    });
  },
  completeMilestone: (id: string, evidence?: { label: string; url: string; note: string }) => {
    const st = useStore.getState();
    st.update((d) => {
      d.milestones = d.milestones.map((m) =>
        m.id === id
          ? {
              ...m,
              status: 'done',
              completedAt: todayISO(),
              evidence: evidence
                ? [...m.evidence, { ...evidence, id: uid(), createdAt: todayISO() }]
                : m.evidence,
            }
          : m,
      );
    });
    const ms = st.data.milestones.find((m) => m.id === id);
    st.logEvent({
      date: todayISO(),
      kind: 'milestone',
      refId: id,
      title: ms?.title ?? 'Milestone',
      area: 'technical',
      note: evidence?.url || evidence?.note || 'milestone closed',
      evidence: evidence?.url,
    });
  },
  undoMilestone: (id: string) => {
    useStore.getState().update((d) => {
      d.milestones = d.milestones.map((m) =>
        m.id === id ? { ...m, status: 'pending', completedAt: undefined } : m,
      );
    });
  },

  /* ---- technical ---- */
  addTopic: (t: Omit<TrackTopic, 'id' | 'createdAt' | 'evidence'>) => {
    const full: TrackTopic = { ...t, id: uid('tp'), createdAt: todayISO(), evidence: [] };
    useStore.getState().update((d) => {
      d.topics = [...d.topics, full];
    });
    return full;
  },
  updateTopic: (id: string, changes: Partial<TrackTopic>) => {
    useStore.getState().update((d) => {
      d.topics = patch(d.topics, id, changes);
    });
  },
  removeTopic: (id: string) => {
    useStore.getState().update((d) => {
      d.topics = d.topics.filter((t) => t.id !== id);
      d.topics = d.topics.map((t) => ({
        ...t,
        prerequisites: t.prerequisites.filter((p) => p !== id),
      }));
    });
  },
  reorderTopics: (trackId: TrackId, orderedIds: string[]) => {
    useStore.getState().update((d) => {
      const ranks = new Map(orderedIds.map((id, i) => [id, i]));
      d.topics = d.topics.map((t) =>
        t.trackId === trackId && ranks.has(t.id) ? { ...t, order: ranks.get(t.id)! } : t,
      );
    });
  },
  addTopicEvidence: (id: string, evidence: { label: string; url: string; note: string }) => {
    useStore.getState().update((d) => {
      d.topics = d.topics.map((t) =>
        t.id === id
          ? { ...t, evidence: [...t.evidence, { ...evidence, id: uid(), createdAt: todayISO() }] }
          : t,
      );
    });
  },
  addProject: (p: Omit<TrackProject, 'id' | 'createdAt' | 'evidence'>) => {
    const full: TrackProject = { ...p, id: uid('prj'), createdAt: todayISO(), evidence: [] };
    useStore.getState().update((d) => {
      d.trackProjects = [...d.trackProjects, full];
    });
    return full;
  },
  updateProject: (id: string, changes: Partial<TrackProject>) => {
    useStore.getState().update((d) => {
      d.trackProjects = patch(d.trackProjects, id, changes);
    });
  },
  removeProject: (id: string) => {
    useStore.getState().update((d) => {
      d.trackProjects = d.trackProjects.filter((p) => p.id !== id);
    });
  },
  addPractice: (p: Omit<PracticeLog, 'id' | 'createdAt'>) => {
    const full: PracticeLog = { ...p, id: uid('pr'), createdAt: todayISO() };
    const st = useStore.getState();
    st.update((d) => {
      d.practiceLogs = [...d.practiceLogs, full];
      // keep topic practice counters in sync for DSA-scoped logs
      d.topics = d.topics.map((t) =>
        t.trackId === p.scope && p.subject && t.title.toLowerCase().includes(p.subject.toLowerCase().slice(0, 8))
          ? { ...t, practiceDone: t.practiceDone + p.solvedIndependently + p.solvedWithHints }
          : t,
      );
    });
    st.logEvent({
      date: p.date,
      kind: 'practice',
      refId: full.id,
      title: `${p.subject}: ${p.attempted} attempted`,
      area: p.scope === 'college' ? 'academics' : p.scope === 'gate' ? 'gate' : 'technical',
      note: `${p.solvedIndependently} independent, ${p.solvedWithHints} with hints`,
    });
    return full;
  },
  removePractice: (id: string) => {
    useStore.getState().update((d) => {
      d.practiceLogs = d.practiceLogs.filter((p) => p.id !== id);
    });
  },
  addSession: (s: Omit<FocusedSession, 'id' | 'createdAt'>) => {
    const full: FocusedSession = { ...s, id: uid('ss'), createdAt: todayISO() };
    const st = useStore.getState();
    st.update((d) => {
      d.sessions = [...d.sessions, full];
    });
    st.logEvent({
      date: s.date,
      kind: 'session',
      refId: full.id,
      title: s.taskTitle,
      area: s.area,
      note: `${s.minutes} min`,
    });
    return full;
  },

  /* ---- academics ---- */
  addSubject: (s: Omit<CollegeSubject, 'id' | 'createdAt'>) => {
    const full: CollegeSubject = { ...s, id: uid('sub'), createdAt: todayISO() };
    useStore.getState().update((d) => {
      d.collegeSubjects = [...d.collegeSubjects, full];
    });
    return full;
  },
  updateSubject: (id: string, changes: Partial<CollegeSubject>) => {
    useStore.getState().update((d) => {
      d.collegeSubjects = patch(d.collegeSubjects, id, changes);
    });
  },
  removeSubject: (id: string) => {
    useStore.getState().update((d) => {
      d.collegeSubjects = d.collegeSubjects.filter((s) => s.id !== id);
    });
  },
  addGateSubject: (s: Omit<GateSubject, 'id' | 'createdAt'>) => {
    const full: GateSubject = { ...s, id: uid('gs'), createdAt: todayISO() };
    useStore.getState().update((d) => {
      d.gateSubjects = [...d.gateSubjects, full];
    });
    return full;
  },
  updateGateSubject: (id: string, changes: Partial<GateSubject>) => {
    useStore.getState().update((d) => {
      d.gateSubjects = patch(d.gateSubjects, id, changes);
    });
  },
  removeGateSubject: (id: string) => {
    useStore.getState().update((d) => {
      d.gateSubjects = d.gateSubjects.filter((s) => s.id !== id);
    });
  },
  addMock: (m: Omit<MockTest, 'id' | 'createdAt'>) => {
    const full: MockTest = { ...m, id: uid('mk'), createdAt: todayISO() };
    const st = useStore.getState();
    st.update((d) => {
      d.mockTests = [...d.mockTests, full];
    });
    st.logEvent({
      date: m.date,
      kind: 'assessment',
      refId: full.id,
      title: m.title,
      area: 'gate',
      note: `${m.score}/${m.max}`,
    });
    return full;
  },
  updateMock: (id: string, changes: Partial<MockTest>) => {
    useStore.getState().update((d) => {
      d.mockTests = patch(d.mockTests, id, changes);
    });
  },
  removeMock: (id: string) => {
    useStore.getState().update((d) => {
      d.mockTests = d.mockTests.filter((m) => m.id !== id);
    });
  },
  addRoadmapTopic: (t: Omit<RoadmapTopic, 'id' | 'createdAt' | 'evidence'>) => {
    const full: RoadmapTopic = { ...t, id: uid('rm'), createdAt: todayISO(), evidence: [] };
    useStore.getState().update((d) => {
      d.roadmap = [...d.roadmap, full];
    });
    return full;
  },
  updateRoadmapTopic: (id: string, changes: Partial<RoadmapTopic>) => {
    useStore.getState().update((d) => {
      d.roadmap = patch(d.roadmap, id, changes);
    });
  },
  removeRoadmapTopic: (id: string) => {
    useStore.getState().update((d) => {
      d.roadmap = d.roadmap.filter((t) => t.id !== id);
    });
  },

  /* ---- marketing ---- */
  addAccount: (a: Omit<Account, 'id' | 'createdAt' | 'metrics'>) => {
    const full: Account = { ...a, id: uid('acc'), createdAt: todayISO(), metrics: [] };
    useStore.getState().update((d) => {
      d.accounts = [...d.accounts, full];
    });
    return full;
  },
  updateAccount: (id: string, changes: Partial<Account>) => {
    useStore.getState().update((d) => {
      d.accounts = patch(d.accounts, id, changes);
    });
  },
  removeAccount: (id: string) => {
    useStore.getState().update((d) => {
      d.accounts = d.accounts.filter((a) => a.id !== id);
      d.content = d.content.map((c) => (c.accountId === id ? { ...c, accountId: '' } : c));
    });
  },
  addMetric: (accountId: string, m: Omit<AccountMetric, 'id' | 'createdAt'>) => {
    const full: AccountMetric = { ...m, id: uid('met'), createdAt: todayISO() };
    const st = useStore.getState();
    st.update((d) => {
      d.accounts = d.accounts.map((a) =>
        a.id === accountId ? { ...a, metrics: [...a.metrics, full] } : a,
      );
    });
    st.logEvent({
      date: m.date,
      kind: 'content',
      refId: full.id,
      title: 'Account metrics recorded',
      area: 'marketing',
      note: `${m.views} views · ${m.followers} followers`,
    });
    return full;
  },
  removeMetric: (accountId: string, metricId: string) => {
    useStore.getState().update((d) => {
      d.accounts = d.accounts.map((a) =>
        a.id === accountId ? { ...a, metrics: a.metrics.filter((m) => m.id !== metricId) } : a,
      );
    });
  },
  addContent: (c: Omit<ContentItem, 'id' | 'createdAt'>) => {
    const full: ContentItem = { ...c, id: uid('ct'), createdAt: todayISO() };
    useStore.getState().update((d) => {
      d.content = [...d.content, full];
    });
    return full;
  },
  updateContent: (id: string, changes: Partial<ContentItem>) => {
    const st = useStore.getState();
    const before = st.data.content.find((c) => c.id === id);
    st.update((d) => {
      d.content = patch(d.content, id, changes);
    });
    if (changes.stage === 'published' && before?.stage !== 'published') {
      st.logEvent({
        date: changes.publishedDate ?? todayISO(),
        kind: 'content',
        refId: id,
        title: `Published: ${changes.title ?? before?.title ?? 'content'}`,
        area: 'marketing',
        note: changes.kind === 'portfolio_ad' ? 'portfolio advertisement' : 'short-form',
      });
    }
  },
  removeContent: (id: string) => {
    useStore.getState().update((d) => {
      d.content = d.content.filter((c) => c.id !== id);
    });
  },
  addDeal: (deal: Omit<BrandDeal, 'id' | 'createdAt'>) => {
    const full: BrandDeal = { ...deal, id: uid('dl'), createdAt: todayISO() };
    useStore.getState().update((d) => {
      d.deals = [...d.deals, full];
    });
    return full;
  },
  updateDeal: (id: string, changes: Partial<BrandDeal>) => {
    const st = useStore.getState();
    const before = st.data.deals.find((d) => d.id === id);
    st.update((d) => {
      d.deals = patch(d.deals, id, changes);
    });
    if (changes.stage && changes.stage !== before?.stage) {
      st.logEvent({
        date: todayISO(),
        kind: 'deal',
        refId: id,
        title: `${before?.brand ?? 'Deal'} → ${changes.stage}`,
        area: 'marketing',
        note: changes.agreedFee ? `agreed ₹${changes.agreedFee}` : 'stage changed',
      });
    }
  },
  removeDeal: (id: string) => {
    useStore.getState().update((d) => {
      d.deals = d.deals.filter((x) => x.id !== id);
    });
  },

  /* ---- tasks ---- */
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'history'>) => {
    const full: Task = { ...t, id: uid('task'), createdAt: todayISO(), history: [] };
    useStore.getState().update((d) => {
      d.tasks = [...d.tasks, full];
    });
    return full;
  },
  updateTask: (id: string, changes: Partial<Task>) => {
    useStore.getState().update((d) => {
      d.tasks = patch(d.tasks, id, changes);
    });
  },
  removeTask: (id: string) => {
    useStore.getState().update((d) => {
      d.tasks = d.tasks.filter((t) => t.id !== id);
      d.tasks = d.tasks.map((t) => ({ ...t, dependencies: t.dependencies.filter((x) => x !== id) }));
    });
  },
  completeTask: (
    id: string,
    info: { actualMinutes?: number; outcome?: string; evidenceLink?: string; reflection?: string },
  ) => {
    const st = useStore.getState();
    const task = st.data.tasks.find((t) => t.id === id);
    if (!task) return;
    const now = new Date().toISOString();
    st.update((d) => {
      const completed = patch(d.tasks, id, {
        status: 'done',
        completedAt: todayISO(),
        ...info,
        history: [
          ...task.history,
          { id: uid(), at: now, kind: 'completed', detail: info.outcome ?? 'marked complete' },
        ],
      });
      let tasks = completed;
      if (task.recurrence && task.recurrence.type !== 'none') {
        const base = task.plannedDate ?? todayISO();
        const nextDate =
          task.recurrence.type === 'daily'
            ? addDays(base, task.recurrence.interval)
            : addDays(base, 7 * task.recurrence.interval);
        tasks = [
          ...tasks,
          {
            ...task,
            id: uid('task'),
            status: 'todo',
            completedAt: undefined,
            plannedDate: nextDate,
            deadline: task.deadline ? addDays(task.deadline, task.recurrence.type === 'daily' ? 1 : 7) : undefined,
            history: [],
            createdAt: todayISO(),
            seeded: false,
          },
        ];
      }
      d.tasks = tasks;
    });
    st.logEvent({
      date: todayISO(),
      kind: 'task',
      refId: id,
      title: task.title,
      area: task.area,
      note: info.outcome ?? 'completed',
      evidence: info.evidenceLink,
    });
  },
  undoTask: (id: string) => {
    const st = useStore.getState();
    const task = st.data.tasks.find((t) => t.id === id);
    if (!task) return;
    st.update((d) => {
      d.tasks = patch(d.tasks, id, {
        status: 'todo',
        completedAt: undefined,
        history: [
          ...task.history,
          { id: uid(), at: new Date().toISOString(), kind: 'undone', detail: 'completion reversed' },
        ],
      });
    });
  },
  /** Explicit, user-confirmed slot change. Never touches the deadline. */
  rescheduleTask: (id: string, date: string, slot?: string) => {
    const st = useStore.getState();
    const task = st.data.tasks.find((t) => t.id === id);
    if (!task) return;
    st.update((d) => {
      d.tasks = patch(d.tasks, id, {
        plannedDate: date,
        plannedSlot: slot,
        history: [
          ...task.history,
          {
            id: uid(),
            at: new Date().toISOString(),
            kind: 'rescheduled',
            detail: `moved from ${task.plannedDate ?? 'unscheduled'} to ${date}${slot ? ` (${slot})` : ''}`,
          },
        ],
      });
    });
  },
  /** Deferring is visible and counted — it feeds the deferral term of the ranking. */
  deferTask: (id: string, reason = '') => {
    const st = useStore.getState();
    const task = st.data.tasks.find((t) => t.id === id);
    if (!task) return;
    st.update((d) => {
      d.tasks = patch(d.tasks, id, {
        deferCount: task.deferCount + 1,
        lastDeferredAt: todayISO(),
        plannedDate: task.plannedDate ? addDays(task.plannedDate, 1) : undefined,
        history: [
          ...task.history,
          {
            id: uid(),
            at: new Date().toISOString(),
            kind: 'deferred',
            detail: reason || `postponed (now ${task.deferCount + 1}×)`,
          },
        ],
      });
    });
  },
  noteShuffle: (ids: string[]) => {
    useStore.getState().update((d) => {
      d.settings = { ...d.settings, shuffleExclusions: ids.slice(-25) };
    });
  },

  /* ---- day plans, sleep, reviews ---- */
  setDayPlan: (date: string, changes: Partial<DayPlan>) => {
    useStore.getState().update((d) => {
      const existing: DayPlan = d.dayPlans[date] ?? {
        date,
        energy: 'medium',
        availableMinutes: 0,
        focusMinutes: 0,
        windows: [],
        fixed: [],
        unavailable: [],
        note: '',
      };
      d.dayPlans = { ...d.dayPlans, [date]: { ...existing, ...changes } };
    });
  },
  addSleepLog: (s: Omit<SleepLog, 'id' | 'createdAt'>) => {
    const full: SleepLog = { ...s, id: uid('slp'), createdAt: todayISO() };
    useStore.getState().update((d) => {
      d.sleepLogs = [...d.sleepLogs.filter((x) => x.date !== s.date), full];
    });
    return full;
  },
  removeSleepLog: (id: string) => {
    useStore.getState().update((d) => {
      d.sleepLogs = d.sleepLogs.filter((s) => s.id !== id);
    });
  },
  saveReview: (r: Omit<WeeklyReview, 'id' | 'createdAt'> & { id?: string }) => {
    useStore.getState().update((d) => {
      if (r.id && d.reviews.some((x) => x.id === r.id)) {
        d.reviews = patch(d.reviews, r.id, { ...r, id: r.id } as Partial<WeeklyReview>);
      } else {
        d.reviews = [...d.reviews, { ...r, id: r.id ?? uid('rev'), createdAt: todayISO() }];
      }
    });
  },
  removeReview: (id: string) => {
    useStore.getState().update((d) => {
      d.reviews = d.reviews.filter((r) => r.id !== id);
    });
  },
  updateSettings: (changes: Partial<AppData['settings']>) => {
    useStore.getState().update((d) => {
      d.settings = { ...d.settings, ...changes };
    });
  },
};

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

export function exportJSON(): string {
  const data = useStore.getState().data;
  return JSON.stringify({ ...data, version: 1, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text: string): { ok: boolean; warnings: string[]; error?: string } {
  try {
    const parsed = JSON.parse(text);
    const { data, warnings } = migrate(parsed);
    useStore.getState().replaceAll(data, warnings);
    return { ok: true, warnings };
  } catch (e) {
    return { ok: false, warnings: [], error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

export function clearEverything(): void {
  clearRaw();
  useStore.getState().resetEmpty();
}
