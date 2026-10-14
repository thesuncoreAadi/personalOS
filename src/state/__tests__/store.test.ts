import { beforeEach, describe, expect, it } from 'vitest';
import { actions, clearEverything, exportJSON, importJSON, useStore } from '../store';
import { STORAGE_KEY, readRaw } from '../storage';
import { buildSeedData } from '../../lib/seed';
import { migrate, stripSeed } from '../defaults';
import { goalProgress } from '../../domain/progress';
import { dealFunnel } from '../../domain/metrics';
import { todayISO } from '../../lib/date';
import type { Task } from '../../types';

type NewTask = Omit<Task, 'id' | 'createdAt' | 'history'>;

const data = () => useStore.getState().data;

beforeEach(() => {
  clearEverything();
});

describe('persistence', () => {
  it('survives a simulated page refresh', () => {
    actions.addTask({
      title: 'Persist me',
      area: 'technical',
      priority: 'P1',
      importance: 5,
      estimatedMinutes: 30,
      mvc: '',
      finishCondition: '',
      energy: 'medium',
      cognitiveLoad: 'medium',
      status: 'todo',
      dependencies: [],
      evidenceRequired: false,
      recurrence: null,
      deferCount: 0,
      notes: '',
      fixed: false,
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    // simulate a reload: drop in-memory state, re-read from storage
    useStore.setState({ data: { ...data(), tasks: [] } });
    useStore.getState().hydrate();
    expect(data().tasks.map((t) => t.title)).toContain('Persist me');
  });

  it('reports storage availability', () => {
    expect(readRaw()).toBeDefined();
  });
});

describe('export / import', () => {
  it('preserves goal → milestone → task relationships through a round trip', () => {
    const goal = actions.addGoal({
      area: 'technical',
      horizon: '90d',
      title: 'Round trip goal',
      outcome: 'An outcome',
      measurement: 'A count',
      startDate: todayISO(),
      targetDate: '2026-12-31',
      status: 'in_progress',
      manualProgress: 0,
      manualOverride: false,
      weeklyTarget: '',
      indicator: 'lagging',
      evidence: [],
      dependencies: [],
      notes: '',
    });
    const ms = actions.addMilestone({
      goalId: goal.id,
      title: 'First milestone',
      dueDate: '2026-11-01',
      weight: 2,
      status: 'pending',
      evidenceRequired: true,
      note: '',
    });
    actions.addTask({
      title: 'Linked task',
      area: 'technical',
      goalId: goal.id,
      priority: 'P2',
      importance: 4,
      estimatedMinutes: 45,
      mvc: '',
      finishCondition: '',
      energy: 'medium',
      cognitiveLoad: 'medium',
      status: 'todo',
      dependencies: [],
      evidenceRequired: false,
      recurrence: null,
      deferCount: 0,
      notes: '',
      fixed: false,
    });

    const payload = exportJSON();
    clearEverything();
    expect(data().goals).toHaveLength(0);

    const result = importJSON(payload);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);

    const restoredGoal = data().goals.find((g) => g.id === goal.id);
    expect(restoredGoal).toBeTruthy();
    expect(data().milestones.find((m) => m.id === ms.id)?.goalId).toBe(goal.id);
    expect(data().tasks.find((t) => t.title === 'Linked task')?.goalId).toBe(goal.id);
    expect(goalProgress(restoredGoal!, data().milestones).itemCount).toBe(1);
  });

  it('rejects malformed JSON without corrupting state', () => {
    actions.addGoal({
      area: 'marketing',
      horizon: '90d',
      title: 'Keep me',
      outcome: 'o',
      measurement: 'm',
      startDate: todayISO(),
      targetDate: '2026-12-31',
      status: 'in_progress',
      manualProgress: 0,
      manualOverride: false,
      weeklyTarget: '',
      indicator: 'leading',
      evidence: [],
      dependencies: [],
      notes: '',
    });
    const result = importJSON('{ not json');
    expect(result.ok).toBe(false);
    expect(data().goals.map((g) => g.title)).toContain('Keep me');
  });

  it('repairs a partially formed backup and reports what it ignored', () => {
    const { data: fixed, warnings } = migrate({
      goals: [{ id: 'g', title: 'Partial goal' }],
      tasks: 'not an array',
      dayPlans: 'nope',
      settings: { weights: { deadline: 2 } },
    });
    expect(fixed.goals).toHaveLength(1);
    expect(fixed.tasks).toEqual([]);
    expect(fixed.dayPlans).toEqual({});
    expect(fixed.settings.weights.deadline).toBe(2);
    expect(fixed.settings.weights.importance).toBe(1); // default filled in
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('task lifecycle', () => {
  function makeTask(over: Partial<NewTask> = {}): Task {
    return actions.addTask({
      title: 'Task',
      area: 'technical',
      priority: 'P2',
      importance: 3,
      estimatedMinutes: 30,
      mvc: '',
      finishCondition: '',
      energy: 'medium',
      cognitiveLoad: 'medium',
      status: 'todo',
      dependencies: [],
      evidenceRequired: false,
      recurrence: null,
      deferCount: 0,
      notes: '',
      fixed: false,
      ...over,
    } as NewTask);
  }

  it('records completion details, history and an event', () => {
    const task = makeTask({ title: 'Write the EDA notebook' });
    actions.completeTask(task.id, {
      actualMinutes: 55,
      outcome: 'Notebook committed',
      evidenceLink: 'https://github.com/x',
    });
    const done = data().tasks.find((t) => t.id === task.id)!;
    expect(done.status).toBe('done');
    expect(done.actualMinutes).toBe(55);
    expect(done.evidenceLink).toBe('https://github.com/x');
    expect(done.history.some((h) => h.kind === 'completed')).toBe(true);
    expect(data().events.some((e) => e.refId === task.id && e.kind === 'task')).toBe(true);
  });

  it('can be undone and keeps the history', () => {
    const task = makeTask();
    actions.completeTask(task.id, {});
    actions.undoTask(task.id);
    const t = data().tasks.find((x) => x.id === task.id)!;
    expect(t.status).toBe('todo');
    expect(t.completedAt).toBeUndefined();
    expect(t.history.map((h) => h.kind)).toEqual(['completed', 'undone']);
  });

  it('creates the next occurrence of a recurring task on completion', () => {
    const task = makeTask({
      title: 'Weekly metrics',
      plannedDate: '2026-10-14',
      recurrence: { type: 'weekly', interval: 1 },
    });
    actions.completeTask(task.id, {});
    const next = data().tasks.filter((t) => t.title === 'Weekly metrics');
    expect(next).toHaveLength(2);
    expect(next.find((t) => t.status === 'todo')?.plannedDate).toBe('2026-10-21');
  });

  it('counts deferrals and moves the planned date, never the deadline', () => {
    const task = makeTask({ plannedDate: '2026-10-14', deadline: '2026-10-20' });
    actions.deferTask(task.id, 'lab ran over');
    const t = data().tasks.find((x) => x.id === task.id)!;
    expect(t.deferCount).toBe(1);
    expect(t.plannedDate).toBe('2026-10-15');
    expect(t.deadline).toBe('2026-10-20');
  });

  it('reschedules without touching the deadline', () => {
    const task = makeTask({ plannedDate: '2026-10-14', deadline: '2026-10-20' });
    actions.rescheduleTask(task.id, '2026-10-17', 'evening block');
    const t = data().tasks.find((x) => x.id === task.id)!;
    expect(t.plannedDate).toBe('2026-10-17');
    expect(t.plannedSlot).toBe('evening block');
    expect(t.deadline).toBe('2026-10-20');
  });

  it('unblocks dependents when a prerequisite is deleted', () => {
    const pre = makeTask({ title: 'Prereq' });
    const child = makeTask({ title: 'Child', dependencies: [pre.id] });
    actions.removeTask(pre.id);
    expect(data().tasks.find((t) => t.id === child.id)?.dependencies).toEqual([]);
  });
});

describe('milestones update goal progress', () => {
  it('moves the bar only when a milestone is closed, and back when it is reopened', () => {
    const goal = actions.addGoal({
      area: 'technical',
      horizon: '90d',
      title: 'Progress goal',
      outcome: 'o',
      measurement: 'm',
      startDate: todayISO(),
      targetDate: '2026-12-31',
      status: 'in_progress',
      manualProgress: 0,
      manualOverride: false,
      weeklyTarget: '',
      indicator: 'leading',
      evidence: [],
      dependencies: [],
      notes: '',
    });
    actions.addMilestone({
      goalId: goal.id,
      title: 'A',
      dueDate: '2026-11-01',
      weight: 1,
      status: 'pending',
      evidenceRequired: false,
      note: '',
    });
    const b = actions.addMilestone({
      goalId: goal.id,
      title: 'B',
      dueDate: '2026-11-15',
      weight: 1,
      status: 'pending',
      evidenceRequired: false,
      note: '',
    });
    expect(goalProgress(goal, data().milestones).value).toBe(0);
    actions.completeMilestone(b.id);
    expect(goalProgress(data().goals.find((g) => g.id === goal.id)!, data().milestones).value).toBeCloseTo(0.5);
    actions.undoMilestone(b.id);
    expect(goalProgress(data().goals.find((g) => g.id === goal.id)!, data().milestones).value).toBe(0);
  });
});

describe('content and deal events', () => {
  it('records a publish event when content reaches the published stage', () => {
    const account = actions.addAccount({
      name: 'Page',
      platform: 'Instagram',
      handle: '@x',
      focus: 'test',
      weeklyTargetPosts: 2,
    });
    const item = actions.addContent({
      accountId: account.id,
      title: 'My reel',
      kind: 'short_form',
      pillar: 'DSA',
      stage: 'ready',
      hook: '',
      script: '',
      cta: '',
      format: '',
      campaign: '',
      assetLinks: '',
      publishedDate: undefined,
      plannedDate: undefined,
    });
    actions.updateContent(item.id, { stage: 'published', publishedDate: todayISO() });
    expect(data().events.some((e) => e.kind === 'content' && e.title.startsWith('Published'))).toBe(true);
  });

  it('updates the commercial funnel when a deal is won', () => {
    const deal = actions.addDeal({
      brand: 'Acme',
      contact: '',
      contactLink: '',
      pitchLink: '',
      stage: 'negotiating',
      deliverable: '2 reels',
      quotedFee: 8000,
      agreedFee: 8000,
      contractStatus: 'sent',
      paymentStatus: 'invoiced',
      amountReceived: 0,
      notes: '',
      nextAction: '',
      outreachDate: todayISO(),
    });
    expect(dealFunnel(data().deals, 0).won).toBe(0);
    actions.updateDeal(deal.id, { stage: 'won', amountReceived: 4000 });
    const f = dealFunnel(data().deals, 0);
    expect(f.won).toBe(1);
    expect(f.revenueAgreed).toBe(8000);
    expect(f.revenueReceived).toBe(4000);
    expect(data().events.some((e) => e.kind === 'deal')).toBe(true);
  });

  it('records metrics against the right account', () => {
    const a = actions.addAccount({ name: 'A', platform: 'p', handle: '', focus: '', weeklyTargetPosts: 1 });
    const b = actions.addAccount({ name: 'B', platform: 'p', handle: '', focus: '', weeklyTargetPosts: 1 });
    actions.addMetric(a.id, {
      date: todayISO(),
      views: 100,
      reach: 80,
      likes: 5,
      comments: 1,
      shares: 0,
      saves: 2,
      watchTimeMinutes: 40,
      followers: 200,
      profileVisits: 5,
      inquiries: 1,
      leads: 0,
    });
    expect(data().accounts.find((x) => x.id === a.id)?.metrics).toHaveLength(1);
    expect(data().accounts.find((x) => x.id === b.id)?.metrics).toHaveLength(0);
  });
});

describe('day plans and topic reordering', () => {
  it('stores per-day plans without assuming fixed hours', () => {
    actions.setDayPlan('2026-10-14', { energy: 'low', availableMinutes: 45, focusMinutes: 45 });
    actions.setDayPlan('2026-10-14', { note: 'short day' });
    const plan = data().dayPlans['2026-10-14'];
    expect(plan.energy).toBe('low');
    expect(plan.availableMinutes).toBe(45);
    expect(plan.note).toBe('short day');
    expect(data().dayPlans['2026-10-15']).toBeUndefined();
  });

  it('reorders topics within one track only', () => {
    const a = actions.addTopic({
      trackId: 'dsa',
      title: 'A',
      detail: '',
      order: 0,
      weight: 1,
      status: 'not_started',
      confidence: 0,
      estimatedHours: 1,
      prerequisites: [],
      practiceTarget: 0,
      practiceDone: 0,
      notes: '',
      blockers: '',
      nextAction: '',
      archived: false,
    });
    const b = actions.addTopic({
      trackId: 'dsa',
      title: 'B',
      detail: '',
      order: 1,
      weight: 1,
      status: 'not_started',
      confidence: 0,
      estimatedHours: 1,
      prerequisites: [],
      practiceTarget: 0,
      practiceDone: 0,
      notes: '',
      blockers: '',
      nextAction: '',
      archived: false,
    });
    const other = actions.addTopic({
      trackId: 'ml',
      title: 'ML topic',
      detail: '',
      order: 0,
      weight: 1,
      status: 'not_started',
      confidence: 0,
      estimatedHours: 1,
      prerequisites: [],
      practiceTarget: 0,
      practiceDone: 0,
      notes: '',
      blockers: '',
      nextAction: '',
      archived: false,
    });
    actions.reorderTopics('dsa', [b.id, a.id]);
    const topics = data().topics;
    expect(topics.find((t) => t.id === a.id)?.order).toBe(1);
    expect(topics.find((t) => t.id === b.id)?.order).toBe(0);
    expect(topics.find((t) => t.id === other.id)?.order).toBe(0);
  });
});

describe('demo data', () => {
  it('loads a full workspace with relative dates', () => {
    useStore.getState().loadDemoData('replace');
    const d = data();
    expect(d.goals.length).toBeGreaterThan(5);
    expect(d.topics.filter((t) => t.trackId === 'dsa').length).toBeGreaterThan(5);
    expect(d.tasks.length).toBeGreaterThan(5);
    expect(d.settings.demoDataLoaded).toBe(true);
    // seeded deadlines must be real dates, not placeholders
    expect(d.tasks.every((t) => !t.deadline || /^\d{4}-\d{2}-\d{2}$/.test(t.deadline))).toBe(true);
  });

  it('keeps user-created rows when demo data is cleared', () => {
    useStore.getState().loadDemoData('replace');
    const mine = actions.addGoal({
      area: 'technical',
      horizon: '90d',
      title: 'My own goal',
      outcome: 'o',
      measurement: 'm',
      startDate: todayISO(),
      targetDate: '2026-12-31',
      status: 'in_progress',
      manualProgress: 0,
      manualOverride: false,
      weeklyTarget: '',
      indicator: 'leading',
      evidence: [],
      dependencies: [],
      notes: '',
    });
    useStore.getState().clearDemoData();
    expect(data().goals.map((g) => g.title)).toEqual(['My own goal']);
    expect(data().goals[0].id).toBe(mine.id);
    expect(data().settings.demoDataLoaded).toBe(false);
    expect(data().topics).toHaveLength(0);
  });

  it('merges demo data without destroying an existing workspace', () => {
    const mine = actions.addTask({
      title: 'Mine',
      area: 'admin',
      priority: 'P3',
      importance: 1,
      estimatedMinutes: 10,
      mvc: '',
      finishCondition: '',
      energy: 'low',
      cognitiveLoad: 'light',
      status: 'todo',
      dependencies: [],
      evidenceRequired: false,
      recurrence: null,
      deferCount: 0,
      notes: '',
      fixed: false,
    });
    useStore.getState().loadDemoData('merge');
    expect(data().tasks.some((t) => t.id === mine.id)).toBe(true);
    expect(data().tasks.some((t) => t.seeded)).toBe(true);
  });

  it('strips only seeded rows', () => {
    const seed = buildSeedData();
    const kept = stripSeed({
      ...seed,
      goals: [...seed.goals, { ...seed.goals[0], id: 'mine', seeded: false }],
    });
    expect(kept.goals).toHaveLength(1);
    expect(kept.goals[0].id).toBe('mine');
  });
});
