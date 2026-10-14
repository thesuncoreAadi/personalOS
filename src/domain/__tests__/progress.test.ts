import { describe, expect, it } from 'vitest';
import {
  UNVERIFIED_CREDIT,
  areaProgress,
  examReadiness,
  goalHealth,
  goalProgress,
  nextMilestone,
  nextTopics,
  portfolioProgress,
  roadmapProgress,
  syllabusCoverage,
  timeElapsed,
  topicCredit,
  trackProgress,
} from '../progress';
import type { CollegeSubject, Goal, Milestone, RoadmapTopic, TrackProject, TrackTopic } from '../../types';

const mkGoal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  area: 'technical',
  horizon: '90d',
  title: 'Ship it',
  outcome: 'A shipped thing',
  measurement: 'Count of shipped things',
  startDate: '2026-10-01',
  targetDate: '2026-12-30',
  status: 'in_progress',
  manualProgress: 0,
  manualOverride: false,
  weeklyTarget: '',
  indicator: 'lagging',
  evidence: [],
  dependencies: [],
  notes: '',
  history: [],
  createdAt: '2026-10-01',
  ...over,
});

const mkMilestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: `m${Math.random().toString(36).slice(2, 7)}`,
  goalId: 'g1',
  title: 'Milestone',
  dueDate: '2026-11-01',
  weight: 1,
  status: 'pending',
  evidenceRequired: true,
  evidence: [],
  note: '',
  createdAt: '2026-10-01',
  ...over,
});

const mkTopic = (over: Partial<TrackTopic> = {}): TrackTopic => ({
  id: `t${Math.random().toString(36).slice(2, 7)}`,
  trackId: 'dsa',
  title: 'Topic',
  detail: '',
  order: 0,
  weight: 1,
  status: 'not_started',
  confidence: 0,
  estimatedHours: 8,
  prerequisites: [],
  practiceTarget: 0,
  practiceDone: 0,
  evidence: [],
  notes: '',
  blockers: '',
  nextAction: '',
  archived: false,
  createdAt: '2026-10-01',
  ...over,
});

describe('goal progress', () => {
  it('is the weighted share of completed milestones', () => {
    const goal = mkGoal();
    const ms = [
      mkMilestone({ weight: 3, status: 'done', evidenceRequired: false }),
      mkMilestone({ weight: 1, status: 'pending' }),
    ];
    const p = goalProgress(goal, ms);
    expect(p.value).toBeCloseTo(0.75);
    expect(p.doneCount).toBe(1);
    expect(p.itemCount).toBe(2);
  });

  it('credits only 60% for an evidence-gated milestone closed without evidence', () => {
    const goal = mkGoal();
    const ms = [mkMilestone({ weight: 1, status: 'done', evidenceRequired: true, evidence: [] })];
    const p = goalProgress(goal, ms);
    expect(p.value).toBeCloseTo(UNVERIFIED_CREDIT);
    expect(p.unverified).toHaveLength(1);
  });

  it('credits fully once evidence is attached', () => {
    const goal = mkGoal();
    const ms = [
      mkMilestone({
        weight: 1,
        status: 'done',
        evidenceRequired: true,
        evidence: [{ id: 'e', label: 'repo', url: 'https://x', note: '', createdAt: '2026-10-02' }],
      }),
    ];
    const p = goalProgress(goal, ms);
    expect(p.value).toBe(1);
    expect(p.unverified).toHaveLength(0);
  });

  it('is zero with no milestones — never inferred from elapsed time', () => {
    const goal = mkGoal({ startDate: '2026-01-01', targetDate: '2026-12-01' });
    expect(goalProgress(goal, []).value).toBe(0);
    // 181 of 334 calendar days elapsed — shown as a separate marker, never as progress
    expect(timeElapsed('2026-01-01', '2026-12-01', '2026-07-01')).toBeCloseTo(181 / 334, 5);
    expect(timeElapsed('2026-01-01', '2026-12-01', '2025-06-01')).toBe(0);
    expect(timeElapsed('2026-01-01', '2026-12-01', '2027-06-01')).toBe(1);
  });

  it('respects a manual override and clamps it', () => {
    const goal = mkGoal({ manualOverride: true, manualProgress: 1.7 });
    expect(goalProgress(goal, [mkMilestone()]).value).toBe(1);
  });

  it('picks the earliest pending milestone as next', () => {
    const ms = [
      mkMilestone({ id: 'a', dueDate: '2026-12-01' }),
      mkMilestone({ id: 'b', dueDate: '2026-11-01' }),
      mkMilestone({ id: 'c', dueDate: '2026-10-20', status: 'done' }),
    ];
    expect(nextMilestone('g1', ms)?.id).toBe('b');
  });
});

describe('goal health', () => {
  it('flags overdue when a milestone date has passed', () => {
    const goal = mkGoal();
    const h = goalHealth(goal, [mkMilestone({ dueDate: '2026-10-01' })], '2026-10-14');
    expect(h.health).toBe('overdue');
  });

  it('flags at-risk when progress lags the timeline', () => {
    const goal = mkGoal({ startDate: '2026-09-14', targetDate: '2026-12-14' });
    const ms = [mkMilestone({ weight: 1, status: 'pending', dueDate: '2026-12-01' })];
    // half the timeline used, zero progress
    const h = goalHealth(goal, ms, '2026-10-29');
    expect(h.health).toBe('at_risk');
  });

  it('is on track when progress keeps pace', () => {
    const goal = mkGoal({ startDate: '2026-09-14', targetDate: '2026-12-14' });
    const ms = [
      mkMilestone({ weight: 1, status: 'done', dueDate: '2026-10-01', evidenceRequired: false }),
      mkMilestone({ weight: 1, status: 'pending', dueDate: '2026-12-01' }),
    ];
    const h = goalHealth(goal, ms, '2026-10-29');
    expect(h.health).toBe('on_track');
  });

  it('reports completed for a completed goal', () => {
    expect(goalHealth(mkGoal({ status: 'completed' }), [], '2026-10-14').health).toBe('completed');
  });
});

describe('technical topic credit', () => {
  it('requires evidence, practice or confidence ≥ 3 for full credit', () => {
    expect(topicCredit(mkTopic({ status: 'done' })).credit).toBeCloseTo(UNVERIFIED_CREDIT);
    expect(topicCredit(mkTopic({ status: 'done', confidence: 3 })).credit).toBe(1);
    expect(topicCredit(mkTopic({ status: 'done', practiceTarget: 5, practiceDone: 5 })).credit).toBe(1);
    expect(
      topicCredit(
        mkTopic({
          status: 'done',
          evidence: [{ id: 'e', label: 'repo', url: 'https://x', note: '', createdAt: '2026-10-02' }],
        }),
      ).credit,
    ).toBe(1);
  });

  it('credits partial progress for in-progress topics and zero for untouched ones', () => {
    expect(topicCredit(mkTopic({ status: 'learning' })).credit).toBe(0.45);
    expect(topicCredit(mkTopic({ status: 'not_started' })).credit).toBe(0);
    expect(topicCredit(mkTopic({ status: 'skipped' })).credit).toBe(0);
  });

  it('computes weighted track progress and ignores archived topics', () => {
    const topics = [
      mkTopic({ weight: 2, status: 'done', confidence: 4 }),
      mkTopic({ weight: 1, status: 'learning' }),
      mkTopic({ weight: 5, status: 'done', archived: true }),
    ];
    const p = trackProgress(topics);
    expect(p.value).toBeCloseTo((2 * 1 + 1 * 0.45) / 3);
    expect(p.unverified).toHaveLength(0);
  });
});

describe('portfolio evidence is separate from learning', () => {
  const project = (over: Partial<TrackProject> = {}): TrackProject => ({
    id: 'p1',
    trackId: 'ml',
    title: 'Project',
    brief: '',
    status: 'idea',
    milestones: [
      { id: 'a', title: 'EDA', done: false },
      { id: 'b', title: 'Deploy', done: false },
    ],
    evidence: [],
    createdAt: '2026-10-01',
    ...over,
  });

  it('does not count a finished lesson as a finished project', () => {
    expect(portfolioProgress([project()]).value).toBe(0);
  });

  it('requires a link as well as done status for full credit', () => {
    const doneNoLink = portfolioProgress([project({ status: 'done' })]).value;
    expect(doneNoLink).toBeCloseTo(UNVERIFIED_CREDIT);
    const doneWithLink = portfolioProgress([
      project({
        status: 'done',
        evidence: [{ id: 'e', label: 'app', url: 'https://x', note: '', createdAt: '2026-10-02' }],
      }),
    ]).value;
    expect(doneWithLink).toBe(1);
  });

  it('credits partial milestone completion while in progress', () => {
    const p = portfolioProgress([
      project({ status: 'in_progress', milestones: [{ id: 'a', title: 'EDA', done: true }, { id: 'b', title: 'Deploy', done: false }] }),
    ]);
    expect(p.value).toBeCloseTo(0.15 + 0.85 * 0.5);
  });
});

describe('track independence', () => {
  it('keeps three tracks computed separately', () => {
    const all = [
      mkTopic({ id: 'd1', trackId: 'dsa', status: 'done', confidence: 5 }),
      mkTopic({ id: 'm1', trackId: 'ml', status: 'learning' }),
      mkTopic({ id: 'g1', trackId: 'genai', status: 'not_started' }),
    ];
    expect(trackProgress(all.filter((t) => t.trackId === 'dsa')).value).toBe(1);
    expect(trackProgress(all.filter((t) => t.trackId === 'ml')).value).toBeCloseTo(0.45);
    expect(trackProgress(all.filter((t) => t.trackId === 'genai')).value).toBe(0);
  });

  it('orders next topics by in-progress first, then unblocked prerequisites, then order', () => {
    const a = mkTopic({ id: 'a', order: 0 });
    const b = mkTopic({ id: 'b', order: 1, prerequisites: ['a'] });
    const c = mkTopic({ id: 'c', order: 2, status: 'learning' });
    const next = nextTopics([a, b, c], 3);
    expect(next[0].id).toBe('c');
    expect(next[1].id).toBe('a');
    expect(next[2].id).toBe('b');
  });
});

describe('academics', () => {
  const subject = (over: Partial<CollegeSubject> = {}): CollegeSubject => ({
    id: 's1',
    code: 'X',
    name: 'Digital Electronics',
    semester: 'Sem 5',
    credits: 4,
    topics: [
      { id: 't1', title: 'A', weight: 1, status: 'done', revision: 'twice', confidence: 4, weak: false, notes: '' },
      { id: 't2', title: 'B', weight: 1, status: 'learning', revision: 'none', confidence: 2, weak: false, notes: '' },
      { id: 't3', title: 'C', weight: 1, status: 'not_started', revision: 'none', confidence: 0, weak: true, notes: '' },
    ],
    timedAssessments: [],
    recurringMistakes: [],
    notes: '',
    createdAt: '2026-10-01',
    ...over,
  });

  it('separates syllabus coverage from exam readiness', () => {
    const s = subject();
    const coverage = syllabusCoverage(s).value;
    const readiness = examReadiness(s, [], '2026-10-14').value;
    expect(coverage).toBeCloseTo((1 + 0.5 + 0) / 3);
    expect(readiness).toBeLessThan(coverage);
  });

  it('raises readiness with recent practice and timed assessments', () => {
    const s = subject();
    const base = examReadiness(s, [], '2026-10-14').value;
    const withPractice = examReadiness(
      s,
      [
        {
          id: 'p1',
          date: '2026-10-12',
          scope: 'college',
          subject: 'Digital Electronics',
          attempted: 20,
          solvedIndependently: 15,
          solvedWithHints: 3,
          revisionNeeded: 2,
          minutes: 60,
          note: '',
          createdAt: '2026-10-12',
        },
      ],
      '2026-10-14',
    ).value;
    const withAssessment = examReadiness(
      s,
      [],
      '2026-10-14',
    ).value;
    const withBoth = examReadiness(
      { ...s, timedAssessments: [{ id: 'a', date: '2026-10-10', score: 20, max: 25, title: 'Unit 1' }] },
      [],
      '2026-10-14',
    ).value;
    expect(withPractice).toBeGreaterThan(base);
    expect(withBoth).toBeGreaterThan(withAssessment);
  });

  it('lists weak topics', () => {
    expect(examReadiness(subject(), [], '2026-10-14').weakTopics).toEqual(['C']);
  });
});

describe('semiconductor roadmap', () => {
  it('credits partial weight for done-without-artefact topics', () => {
    const topics: RoadmapTopic[] = [
      {
        id: 'r1',
        phase: 'foundations',
        title: 'Band theory',
        weight: 1,
        status: 'done',
        tools: '',
        assignment: '',
        evidence: [],
        notes: '',
        createdAt: '2026-10-01',
      },
    ];
    expect(roadmapProgress(topics).value).toBeCloseTo(UNVERIFIED_CREDIT);
    expect(roadmapProgress([{ ...topics[0], assignment: 'Derivation summary' }]).value).toBe(1);
  });
});

describe('area rollup', () => {
  it('blends goals, learning and portfolio for the technical area with the documented weights', () => {
    const goals = [mkGoal({ area: 'technical' })];
    const milestones = [mkMilestone({ weight: 1, status: 'done', evidenceRequired: false })];
    const topics = [mkTopic({ status: 'done', confidence: 5 })];
    const projects: TrackProject[] = [
      {
        id: 'p',
        trackId: 'dsa',
        title: 'Portfolio',
        brief: '',
        status: 'done',
        milestones: [],
        evidence: [{ id: 'e', label: 'x', url: 'https://x', note: '', createdAt: '2026-10-02' }],
        createdAt: '2026-10-01',
      },
    ];
    const a = areaProgress('technical', goals, milestones, topics, projects, []);
    // 0.5*1 + 0.35*1 + 0.15*1 all divided by 1.0
    expect(a.value).toBeCloseTo(1);
    expect(a.components.map((c) => c.label)).toContain('Portfolio evidence');
  });

  it('returns zero for an area with no data instead of guessing', () => {
    const a = areaProgress('marketing', [], [], [], [], []);
    expect(a.value).toBe(0);
  });
});
