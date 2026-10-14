import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  energyMode,
  findAnother,
  incompleteDependencies,
  rankTasks,
  shuffleTasks,
} from '../taskMatch';
import type { Task } from '../../types';

const mkTask = (over: Partial<Task> = {}): Task => ({
  id: `t${Math.random().toString(36).slice(2, 7)}`,
  title: 'Task',
  area: 'technical',
  priority: 'P2',
  importance: 3,
  estimatedMinutes: 60,
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
  history: [],
  createdAt: '2026-10-01',
  ...over,
});

const NOW = '2026-10-14';

describe('task matching — recommendations respond to context', () => {
  const deep = mkTask({
    id: 'deep',
    title: 'Timed GATE set',
    estimatedMinutes: 120,
    energy: 'high',
    cognitiveLoad: 'heavy',
    importance: 5,
    priority: 'P1',
  });
  const light = mkTask({
    id: 'light',
    title: 'Organise notes',
    estimatedMinutes: 25,
    energy: 'low',
    cognitiveLoad: 'light',
    importance: 2,
  });
  const mid = mkTask({ id: 'mid', title: 'Pandas exercises', estimatedMinutes: 60 });

  it('recommends the deep task in a long high-energy block', () => {
    const rec = rankTasks([deep, light, mid], { nowISO: NOW, availableMinutes: 120, energy: 'high' });
    expect(rec.mode).toBe('deep');
    expect(rec.primary?.task.id).toBe('deep');
    expect(rec.primary?.fitsWindow).toBe(true);
  });

  it('recommends a different task when available time shrinks', () => {
    const rec = rankTasks([deep, light, mid], { nowISO: NOW, availableMinutes: 30, energy: 'high' });
    expect(rec.primary?.task.id).not.toBe('deep');
    expect(rec.primary?.task.id).toBe('light');
  });

  it('recommends a different task when energy drops', () => {
    const rec = rankTasks([deep, light, mid], { nowISO: NOW, availableMinutes: 120, energy: 'low' });
    expect(rec.primary?.task.id).toBe('light');
    const deepMatch = rec.ranked.find((m) => m.task.id === 'deep');
    expect(deepMatch?.fitsEnergy).toBe(false);
  });

  it('switches to recovery mode and de-prioritises heavy work when exhausted', () => {
    const rec = rankTasks([deep, light, mid], { nowISO: NOW, availableMinutes: 120, energy: 'exhausted' });
    expect(rec.mode).toBe('recovery');
    expect(energyMode('exhausted')).toBe('recovery');
    expect(rec.primary?.task.id).toBe('light');
  });

  it('prefers a task with an urgent deadline over a merely important one', () => {
    const urgent = mkTask({ id: 'u', title: 'Due tomorrow', deadline: '2026-10-15', importance: 2 });
    const important = mkTask({ id: 'i', title: 'Important, no date', importance: 5, priority: 'P1' });
    const rec = rankTasks([urgent, important], { nowISO: NOW, availableMinutes: 60, energy: 'medium' });
    expect(rec.primary?.task.id).toBe('u');
  });

  it('pulls a repeatedly deferred task forward', () => {
    const deferred = mkTask({ id: 'd', title: 'Kept postponing', deferCount: 3, lastDeferredAt: '2026-10-11' });
    const fresh = mkTask({ id: 'f', title: 'Fresh task' });
    const rec = rankTasks([deferred, fresh], { nowISO: NOW, availableMinutes: 60, energy: 'medium' });
    const dScore = rec.ranked.find((m) => m.task.id === 'd')!;
    expect(dScore.parts.find((p) => p.key === 'defer')?.value).toBe(8);
    expect(rec.primary?.task.id).toBe('d');
  });

  it('explains the recommendation in plain language', () => {
    const rec = rankTasks([deep], { nowISO: NOW, availableMinutes: 120, energy: 'high' });
    expect(rec.explanation).toContain('Timed GATE set');
    expect(rec.primary?.parts.length).toBeGreaterThan(3);
  });

  it('applies user weights from settings', () => {
    const urgent = mkTask({ id: 'u', deadline: '2026-10-16', importance: 1 });
    const important = mkTask({ id: 'i', importance: 5, priority: 'P1' });
    const noDeadline = rankTasks([urgent, important], {
      nowISO: NOW,
      availableMinutes: 60,
      energy: 'medium',
      weights: { ...DEFAULT_WEIGHTS, deadline: 0, importance: 2 },
    });
    expect(noDeadline.primary?.task.id).toBe('i');
  });
});

describe('task matching — eligibility rules', () => {
  it('excludes completed and dropped tasks', () => {
    const done = mkTask({ id: 'done', status: 'done', importance: 5, priority: 'P1' });
    const dropped = mkTask({ id: 'dropped', status: 'dropped', importance: 5 });
    const open = mkTask({ id: 'open', importance: 1 });
    const rec = rankTasks([done, dropped, open], { nowISO: NOW, availableMinutes: 60, energy: 'medium' });
    expect(rec.considered).toBe(1);
    expect(rec.primary?.task.id).toBe('open');
    expect(rec.ranked.map((m) => m.task.id)).toEqual(['open']);
  });

  it('marks tasks with incomplete prerequisites as blocked and de-prioritises them', () => {
    const prereq = mkTask({ id: 'pre', title: 'Write scripts' });
    const dependent = mkTask({
      id: 'dep',
      title: 'Shoot batch',
      dependencies: ['pre'],
      importance: 5,
      priority: 'P1',
    });
    const rec = rankTasks([prereq, dependent], { nowISO: NOW, availableMinutes: 60, energy: 'medium' });
    const dep = rec.ranked.find((m) => m.task.id === 'dep')!;
    expect(dep.excluded).toBe(true);
    expect(dep.blockedBy).toEqual(['Write scripts']);
    expect(rec.excluded).toBe(1);
    expect(rec.primary?.task.id).toBe('pre');
  });

  it('unblocks a dependent task once its prerequisite is done', () => {
    const prereq = mkTask({ id: 'pre', status: 'done' });
    const dependent = mkTask({ id: 'dep', dependencies: ['pre'] });
    const rec = rankTasks([prereq, dependent], { nowISO: NOW, availableMinutes: 60, energy: 'medium' });
    expect(rec.ranked.find((m) => m.task.id === 'dep')?.excluded).toBe(false);
    expect(rec.primary?.task.id).toBe('dep');
  });

  it('detects a dependency cycle instead of looping forever', () => {
    const a = mkTask({ id: 'a', dependencies: ['b'] });
    const b = mkTask({ id: 'b', dependencies: ['a'] });
    const rec = rankTasks([a, b], { nowISO: NOW, availableMinutes: 60, energy: 'medium' });
    expect(rec.ranked.every((m) => m.excluded)).toBe(true);
    expect(rec.primary).toBeUndefined();
  });

  it('offers the minimum viable version when the block is too short but usable', () => {
    const long = mkTask({ id: 'l', estimatedMinutes: 120, mvc: 'Do 2 of the 6 problems' });
    const rec = rankTasks([long], { nowISO: NOW, availableMinutes: 45, energy: 'high' });
    expect(rec.primary?.usesMvc).toBe(true);
    expect(rec.primary?.fitsWindow).toBe(false);
    expect(rec.explanation).toContain('minimum viable');
  });

  it('reports no eligible task rather than inventing one', () => {
    const heavy = mkTask({ estimatedMinutes: 180, energy: 'high', mvc: '' });
    const rec = rankTasks([heavy], { nowISO: NOW, availableMinutes: 20, energy: 'low' });
    expect(rec.primary).toBeUndefined();
    expect(rec.explanation).toMatch(/nothing eligible/i);
  });

  it('respects area and goal scoping', () => {
    const tech = mkTask({ id: 'tech', area: 'technical' });
    const mkt = mkTask({ id: 'mkt', area: 'marketing', importance: 5 });
    expect(rankTasks([tech, mkt], { nowISO: NOW, availableMinutes: 60, energy: 'medium', area: 'marketing' }).primary?.task.id).toBe('mkt');
    const g1 = mkTask({ id: 'g1', goalId: 'goal-a' });
    const g2 = mkTask({ id: 'g2', goalId: 'goal-b', importance: 5 });
    expect(
      rankTasks([g1, g2], { nowISO: NOW, availableMinutes: 60, energy: 'medium', goalIds: ['goal-a'] }).primary?.task
        .id,
    ).toBe('g1');
  });
});

describe('shuffle', () => {
  const tasks = [
    mkTask({ id: 'a', title: 'A', estimatedMinutes: 60 }),
    mkTask({ id: 'b', title: 'B', estimatedMinutes: 45, energy: 'low', cognitiveLoad: 'light' }),
    mkTask({ id: 'c', title: 'C', estimatedMinutes: 90, importance: 5, priority: 'P1', deadline: '2026-10-16' }),
    mkTask({ id: 'done', title: 'Done', status: 'done' }),
    mkTask({ id: 'blocked', title: 'Blocked', dependencies: ['a'] }),
  ];

  it('never mutates deadlines, status or the task records themselves', () => {
    const before = JSON.stringify(tasks);
    const ctx = { nowISO: NOW, availableMinutes: 60, energy: 'medium' as const };
    shuffleTasks(tasks, ctx, []);
    shuffleTasks(tasks, { ...ctx, energy: 'low', availableMinutes: 30 }, ['a', 'b']);
    expect(JSON.stringify(tasks)).toBe(before);
  });

  it('never reports a moved fixed commitment', () => {
    const result = shuffleTasks(tasks, { nowISO: NOW, availableMinutes: 60, energy: 'medium' }, []);
    expect(result.movedFixed).toEqual([]);
  });

  it('excludes completed tasks from the shuffled order', () => {
    const result = shuffleTasks(tasks, { nowISO: NOW, availableMinutes: 60, energy: 'medium' }, []);
    expect(result.order).not.toContain('done');
  });

  it('excludes blocked tasks from the shuffled order', () => {
    const result = shuffleTasks(tasks, { nowISO: NOW, availableMinutes: 60, energy: 'medium' }, []);
    expect(result.order).not.toContain('blocked');
  });

  it('returns an explanation and per-task reasons', () => {
    const result = shuffleTasks(tasks, { nowISO: NOW, availableMinutes: 60, energy: 'medium' }, []);
    expect(result.suggestion).toBeTruthy();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same context', () => {
    const ctx = { nowISO: NOW, availableMinutes: 60, energy: 'medium' as const };
    expect(shuffleTasks(tasks, ctx, []).order).toEqual(shuffleTasks(tasks, ctx, []).order);
  });

  it('changes its suggestion when already-suggested tasks are excluded', () => {
    const ctx = { nowISO: NOW, availableMinutes: 60, energy: 'medium' as const };
    const first = shuffleTasks(tasks, ctx, []);
    const second = shuffleTasks(tasks, ctx, first.order.slice(0, 1));
    expect(second.order[0]).not.toBe(first.order[0]);
  });

  it('handles an empty pool without throwing', () => {
    const result = shuffleTasks([], { nowISO: NOW, availableMinutes: 60, energy: 'medium' }, []);
    expect(result.order).toEqual([]);
    expect(result.suggestion).toMatch(/nothing eligible/i);
  });
});

describe('find another suitable task', () => {
  const tasks = [
    mkTask({ id: 'a', title: 'A', importance: 5, priority: 'P1' }),
    mkTask({ id: 'b', title: 'B', importance: 4 }),
    mkTask({ id: 'c', title: 'C', importance: 3 }),
  ];

  it('returns a different task on each call', () => {
    const ctx = { nowISO: NOW, availableMinutes: 60, energy: 'medium' as const };
    const first = findAnother(tasks, ctx, []);
    expect(first.primary?.task.id).toBe('a');
    const second = findAnother(tasks, ctx, ['a']);
    expect(second.primary?.task.id).toBe('b');
    const third = findAnother(tasks, ctx, ['a', 'b']);
    expect(third.primary?.task.id).toBe('c');
  });

  it('says so plainly when nothing else fits', () => {
    const only = [mkTask({ id: 'only' })];
    const rec = findAnother(only, { nowISO: NOW, availableMinutes: 60, energy: 'medium' }, ['only']);
    expect(rec.primary).toBeUndefined();
    expect(rec.explanation).toMatch(/no other eligible task/i);
  });
});

describe('dependency helper', () => {
  it('lists only unfinished prerequisites', () => {
    const done = mkTask({ id: 'd', status: 'done' });
    const open = mkTask({ id: 'o' });
    const child = mkTask({ id: 'c', dependencies: ['d', 'o', 'missing'] });
    expect(incompleteDependencies(child, [done, open, child]).map((t) => t.id)).toEqual(['o']);
  });
});
