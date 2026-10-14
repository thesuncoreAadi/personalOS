/**
 * Demo seed data.
 *
 * EVERYTHING here is a labelled proposal, not a commitment:
 *  - goals and milestones carry `seeded: true` and render with a "demo proposal" tag
 *  - topics are curriculum *suggestions*; nothing is assumed mastered
 *  - metrics are plausible placeholders the user is expected to replace
 *  - Settings → Data has a one-click "clear demo data" action
 *
 * Dates are generated relative to today so deadlines are always meaningful.
 */
import { uid } from './ids';
import { addDays, addMonths, startOfWeek, todayISO } from './date';
import type {
  Account,
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
  RoadmapTopic,
  SleepLog,
  Task,
  TrackProject,
  TrackTopic,
  WeeklyReview,
} from '../types';

const T = todayISO();
const W = startOfWeek(T);

let n = 0;
const seedId = (p: string) => `${p}_seed${(n += 1).toString().padStart(3, '0')}`;

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */

function goal(g: Partial<Goal> & Pick<Goal, 'title' | 'area' | 'horizon' | 'outcome'>): Goal {
  return {
    id: seedId('goal'),
    measurement: '',
    startDate: T,
    targetDate: addMonths(T, g.horizon === '90d' ? 3 : 6),
    status: 'in_progress',
    manualProgress: 0,
    manualOverride: false,
    weeklyTarget: '',
    indicator: 'lagging',
    evidence: [],
    dependencies: [],
    notes: '',
    history: [],
    createdAt: T,
    seeded: true,
    ...g,
  } as Goal;
}

function milestone(goalRef: Goal, title: string, daysFromNow: number, weight: number, evidenceRequired = true): Milestone {
  return {
    id: seedId('ms'),
    goalId: goalRef.id,
    title,
    dueDate: addDays(T, daysFromNow),
    weight,
    status: 'pending',
    evidenceRequired,
    evidence: [],
    note: '',
    createdAt: T,
    seeded: true,
  };
}

const gDsa = goal({
  title: 'Solve 150 DSA problems independently and publish a problem-solving portfolio',
  area: 'technical',
  horizon: '90d',
  outcome: '150 problems solved independently across arrays→DP, with a public GitHub repo of 12 annotated write-ups.',
  measurement: 'Count of problems logged as "solved independently" in Practice log + public repo with 12 write-ups.',
  weeklyTarget: '12 problems attempted, 8 solved independently',
  indicator: 'leading',
});

const gMl = goal({
  title: 'Ship one applied ML project end-to-end with a deployed demo',
  area: 'technical',
  horizon: '90d',
  outcome: 'A regression/classification project with clean EDA, validated model, evaluation report and a deployed inference endpoint.',
  measurement: 'Project milestones complete + live URL + notebook in repo.',
  weeklyTarget: '3 focused sessions on the ML project',
  indicator: 'lagging',
});

const gGenai = goal({
  title: 'Build and publish a working GenAI application (RAG + tool calling)',
  area: 'technical',
  horizon: '6m',
  outcome: 'A RAG app over your own notes with structured outputs, tool calling, and an eval set of 20 questions.',
  measurement: 'App runs end-to-end, eval pass rate ≥ 70%, README + demo video.',
  weeklyTarget: '2 sessions on GenAI',
  indicator: 'lagging',
});

const gAcademics = goal({
  title: 'Finish the semester with no backlog and ≥ 7.5 SGPA',
  area: 'academics',
  horizon: '90d',
  outcome: 'All subjects cleared on first attempt; internal + end-sem aggregate ≥ 7.5 SGPA.',
  measurement: 'Marks entered per subject in Academics → College. SGPA computed from entered grades.',
  weeklyTarget: 'Syllabus coverage +6% per week, one timed assessment per subject per fortnight',
  indicator: 'lagging',
});

const gGate = goal({
  title: 'Complete 70% of the GATE syllabus with ≥ 60% average in mocks',
  area: 'academics',
  horizon: '6m',
  outcome: 'Core subjects covered to revision-1, PYQ accuracy ≥ 60%, mock average ≥ 60%.',
  measurement: 'GATE topic status + practice log accuracy + mock test scores.',
  weeklyTarget: '80 PYQs attempted, 2 weak topics revised',
  indicator: 'leading',
});

const gSemi = goal({
  title: 'Validate the semiconductor career direction with one hands-on artefact',
  area: 'academics',
  horizon: '6m',
  outcome: 'Foundations + one device/process artefact (TCAD sim or process-flow report) you can show in an interview.',
  measurement: 'Roadmap topics done with evidence + one artefact link.',
  weeklyTarget: '1 roadmap topic per week',
  indicator: 'leading',
});

const gContent = goal({
  title: 'Publish 24 short-form videos and grow the page to 5,000 followers',
  area: 'marketing',
  horizon: '90d',
  outcome: '24 published shorts across one consistent pillar, 5,000 followers, 3 pieces with >10k views.',
  measurement: 'Content board "Published" count + account metrics rows (manual or CSV).',
  weeklyTarget: '2 published videos, 1 batch-shoot session',
  indicator: 'leading',
});

const gAds = goal({
  title: 'Build an AI-ad portfolio of 6 pieces and land 2 paid collaborations',
  area: 'marketing',
  horizon: '6m',
  outcome: '6 portfolio advertisements published, 20 qualified brand prospects contacted, 2 paid deals signed and delivered.',
  measurement: 'Portfolio ads marked published + sponsorship CRM stages + agreed/received revenue.',
  weeklyTarget: '1 portfolio ad piece, 10 outreach messages',
  indicator: 'lagging',
});

const GOALS: Goal[] = [gDsa, gMl, gGenai, gAcademics, gGate, gSemi, gContent, gAds];

const MILESTONES: Milestone[] = [
  milestone(gDsa, 'Python + complexity fundamentals: 20 problems logged independently', 10, 2),
  milestone(gDsa, 'Arrays, strings, hashing: 30 problems + write-up', 25, 2),
  milestone(gDsa, 'Linked list / stack / queue / recursion: 30 problems', 45, 2),
  milestone(gDsa, 'Searching + sorting: 20 problems under timed conditions', 60, 1.5),
  milestone(gDsa, 'Trees, heaps, graphs: 30 problems + traversal cheatsheet', 75, 2),
  milestone(gDsa, 'Greedy + DP: 20 problems, 6 annotated write-ups published', 85, 2),
  milestone(gMl, 'EDA notebook on a real dataset committed to GitHub', 14, 2),
  milestone(gMl, 'Baseline regression + classification model with validation split', 35, 2),
  milestone(gMl, 'Feature engineering + evaluation report (metrics justified)', 55, 2),
  milestone(gMl, 'Tree-based model comparison + error analysis', 70, 1.5),
  milestone(gMl, 'Deployed inference endpoint + portfolio write-up', 88, 2.5),
  milestone(gGenai, 'Tokenization + inference notes: explain cost/latency trade-offs in writing', 20, 1.5),
  milestone(gGenai, 'Structured-output prototype (JSON schema enforced)', 40, 2),
  milestone(gGenai, 'Embedding index over personal notes + retrieval quality check', 70, 2),
  milestone(gGenai, 'RAG app with citations over 100 documents', 110, 2.5),
  milestone(gGenai, 'Tool-calling workflow + 20-question eval set passing ≥ 70%', 140, 2.5),
  milestone(gAcademics, 'All internal assessments submitted on time', 12, 1.5),
  milestone(gAcademics, 'Two weakest subjects at 80% syllabus coverage', 40, 2),
  milestone(gAcademics, 'One full-length timed paper per core subject', 65, 2),
  milestone(gAcademics, 'Final revision cycle complete for all subjects', 84, 2),
  milestone(gGate, 'Engineering Maths + one core subject to revision-1', 30, 2),
  milestone(gGate, '300 PYQs logged with accuracy tracked', 75, 2),
  milestone(gGate, '4 full mocks taken under time limit', 120, 2),
  milestone(gGate, 'Weak-topic list down to 5 items', 150, 1.5),
  milestone(gSemi, 'Semiconductor physics + band theory notes complete', 35, 2),
  milestone(gSemi, 'PN junction & MOS device summary with diagrams', 75, 2),
  milestone(gSemi, 'Process-flow report: oxidation → lithography → etch → implant', 120, 2),
  milestone(gSemi, 'One TCAD or data-analysis artefact published', 160, 2.5),
  milestone(gContent, 'Content pillar + 10-video series plan locked', 7, 1.5),
  milestone(gContent, 'First 8 videos published, analytics recorded weekly', 30, 2),
  milestone(gContent, '16 videos published, best hook documented', 60, 2),
  milestone(gContent, '24 published + 5k followers (or documented learning if not)', 88, 2.5),
  milestone(gAds, 'Portfolio page live with 2 advertisement pieces', 21, 2),
  milestone(gAds, '20 brand prospects researched and qualified', 45, 1.5),
  milestone(gAds, 'First paid collaboration delivered', 90, 2.5),
  milestone(gAds, 'Second paid collaboration + repeat client conversation', 150, 2),
];

/* ------------------------------------------------------------------ */
/* Technical tracks                                                    */
/* ------------------------------------------------------------------ */

interface TopicSeed {
  t: string;
  d?: string;
  h?: number;
  practice?: number;
  done?: number;
  conf?: 0 | 1 | 2 | 3 | 4 | 5;
  status?: TrackTopic['status'];
  days?: number;
}

function topics(trackId: TrackTopic['trackId'], seeds: TopicSeed[]): TrackTopic[] {
  return seeds.map((s, i) => ({
    id: seedId(`topic_${trackId}`),
    trackId,
    title: s.t,
    detail: s.d ?? '',
    order: i,
    weight: 1,
    status: s.status ?? 'not_started',
    confidence: s.conf ?? 0,
    estimatedHours: s.h ?? 8,
    startDate: undefined,
    targetDate: s.days ? addDays(T, s.days) : undefined,
    prerequisites: [],
    practiceTarget: s.practice ?? 0,
    practiceDone: s.done ?? 0,
    evidence: [],
    notes: '',
    blockers: '',
    nextAction: '',
    archived: false,
    createdAt: T,
    seeded: true,
  }));
}

const DSA_SEEDS: TopicSeed[] = [
  { t: 'Python revision & programming fundamentals', d: 'Data types, comprehensions, functions, standard library idioms.', h: 10, practice: 15, done: 15, status: 'done', conf: 4, days: -6 },
  { t: 'Time & space complexity', d: 'Big-O, recurrence intuition, amortised analysis, memory trade-offs.', h: 6, practice: 10, done: 6, status: 'learning', conf: 2, days: 4 },
  { t: 'Arrays, strings & hashing', d: 'Two pointers, sliding window, prefix sums, frequency maps.', h: 14, practice: 30, days: 14 },
  { t: 'Linked lists, stacks, queues & recursion', d: 'Pointer manipulation, monotonic stacks, recursion trees, backtracking basics.', h: 12, practice: 25, days: 28 },
  { t: 'Searching & sorting', d: 'Binary search variants, merge/quick/heap sort, custom comparators.', h: 8, practice: 18, days: 38 },
  { t: 'Trees, heaps & graphs', d: 'Traversals, BST properties, heap ops, BFS/DFS, shortest paths, topological sort.', h: 18, practice: 35, days: 55 },
  { t: 'Greedy algorithms & dynamic programming', d: 'Exchange arguments, memoisation vs tabulation, classic DP patterns.', h: 20, practice: 30, days: 72 },
  { t: 'Interview-style problem solving', d: 'Timed sets, clarification habits, complexity justification, dry runs.', h: 12, practice: 20, days: 82 },
  { t: 'Problem-solving portfolio', d: '12 annotated write-ups with diagrams, published to GitHub Pages.', h: 10, practice: 0, days: 88 },
];

const ML_SEEDS: TopicSeed[] = [
  { t: 'Python for data analysis', d: 'Jupyter workflow, file I/O, functions for analysis pipelines.', h: 8, practice: 6, done: 6, status: 'done', conf: 4, days: -10 },
  { t: 'NumPy, pandas, visualisation & SQL', d: 'Vectorisation, groupby/join, matplotlib & seaborn, SQL joins and window functions.', h: 16, practice: 12, done: 4, status: 'learning', conf: 3, days: 8 },
  { t: 'Probability, statistics & linear algebra', d: 'Distributions, expectation, hypothesis tests, vectors, matrices, eigenvectors.', h: 18, practice: 10, days: 26 },
  { t: 'Data preprocessing & EDA', d: 'Missing values, encoding, scaling, leakage, visual EDA narrative.', h: 12, practice: 6, days: 40 },
  { t: 'Regression & classification', d: 'Linear/logistic regression, regularisation, loss functions, decision boundaries.', h: 14, practice: 8, days: 56 },
  { t: 'Model evaluation, validation & feature engineering', d: 'Cross-validation, leakage-safe splits, ROC/PR, calibration, feature construction.', h: 14, practice: 8, days: 70 },
  { t: 'Tree-based models, clustering & dimensionality reduction', d: 'Random forests, gradient boosting, k-means, PCA, interpretation.', h: 14, practice: 8, days: 84 },
  { t: 'Scikit-learn projects', d: 'End-to-end pipelines with ColumnTransformer, persistence, reproducible experiments.', h: 16, practice: 4, days: 96 },
  { t: 'Deployment & portfolio-ready applied ML project', d: 'FastAPI inference service, Dockerfile, model card, public repo.', h: 20, practice: 0, days: 110 },
];

const GENAI_SEEDS: TopicSeed[] = [
  { t: 'LLM fundamentals & tokenization', d: 'Transformers at a working level, token budgets, context windows, cost/latency.', h: 10, practice: 4, days: 18 },
  { t: 'Model APIs & inference behaviour', d: 'Sampling parameters, streaming, retries, structured logging, rate limits.', h: 8, practice: 4, days: 32 },
  { t: 'Prompt engineering & structured outputs', d: 'System prompts, few-shot, JSON schema enforcement, refusal handling.', h: 10, practice: 6, days: 46 },
  { t: 'Embeddings & vector search', d: 'Chunking strategy, similarity search, hybrid retrieval, evaluation of retrieval.', h: 12, practice: 5, days: 64 },
  { t: 'Retrieval-augmented generation (RAG)', d: 'Citations, grounding, context assembly, reranking, failure modes.', h: 14, practice: 4, days: 84 },
  { t: 'Tool calling & workflow orchestration', d: 'Function schemas, validation, retries, multi-step planners, cost control.', h: 12, practice: 4, days: 100 },
  { t: 'Evaluations, hallucination handling & safety', d: 'Golden sets, judge models, regression evals, PII and prompt-injection defence.', h: 12, practice: 4, days: 118 },
  { t: 'Agentic workflows (where appropriate)', d: 'When agents beat pipelines; loops, budgets, guardrails, observability.', h: 10, practice: 3, days: 134 },
  { t: 'End-to-end GenAI application', d: 'Shipped app with auth-free demo, eval dashboard and honest limitations section.', h: 24, practice: 0, days: 150 },
];

const TOPICS: TrackTopic[] = [
  ...topics('dsa', DSA_SEEDS),
  ...topics('ml', ML_SEEDS),
  ...topics('genai', GENAI_SEEDS),
];

// Link a couple of prerequisites so dependency logic is visible in the UI.
(function linkPrereqs() {
  const byTrack: Record<string, TrackTopic[]> = {};
  for (const t of TOPICS) (byTrack[t.trackId] ??= []).push(t);
  for (const list of Object.values(byTrack)) {
    for (let i = 1; i < list.length; i += 1) list[i].prerequisites = [list[i - 1].id];
  }
})();

const PROJECTS: TrackProject[] = [
  {
    id: seedId('proj'),
    trackId: 'dsa',
    title: 'Problem-solving portfolio: 12 annotated write-ups',
    brief: 'GitHub repo + GitHub Pages site. Each write-up: problem, approach, complexity, edge cases, test run.',
    status: 'idea',
    targetDate: addDays(T, 88),
    milestones: [
      { id: uid(), title: 'Repo + site skeleton live', done: false },
      { id: uid(), title: '6 write-ups published', done: false },
      { id: uid(), title: '12 write-ups published', done: false },
    ],
    evidence: [],
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('proj'),
    trackId: 'ml',
    title: 'Applied ML: prediction service with evaluation report',
    brief: 'Pick one dataset you care about. EDA → baseline → tuned model → deployed endpoint → model card.',
    status: 'in_progress',
    targetDate: addDays(T, 110),
    milestones: [
      { id: uid(), title: 'Dataset chosen and EDA notebook committed', done: true },
      { id: uid(), title: 'Baseline model with honest validation', done: false },
      { id: uid(), title: 'Feature engineering + error analysis', done: false },
      { id: uid(), title: 'Deployed endpoint + model card', done: false },
    ],
    evidence: [],
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('proj'),
    trackId: 'genai',
    title: 'RAG assistant over your own notes',
    brief: 'Ingest notes → chunk → embed → retrieve → answer with citations. Include a 20-question eval set.',
    status: 'idea',
    targetDate: addDays(T, 150),
    milestones: [
      { id: uid(), title: 'Ingestion + embedding index working locally', done: false },
      { id: uid(), title: 'Answers cite source chunks', done: false },
      { id: uid(), title: 'Eval set of 20 questions ≥ 70% pass', done: false },
    ],
    evidence: [],
    createdAt: T,
    seeded: true,
  },
];

/* ------------------------------------------------------------------ */
/* Practice, sessions, sleep                                           */
/* ------------------------------------------------------------------ */

const PRACTICE: PracticeLog[] = [];
for (let i = 20; i >= 0; i -= 1) {
  const date = addDays(T, -i);
  if (i % 2 === 0) {
    PRACTICE.push({
      id: seedId('prac'),
      date,
      scope: 'dsa',
      subject: 'Arrays & hashing',
      attempted: 4,
      solvedIndependently: i < 8 ? 3 : 2,
      solvedWithHints: 1,
      revisionNeeded: i < 5 ? 0 : 1,
      minutes: 75,
      note: '',
      createdAt: date,
    });
  }
  if (i % 3 === 0) {
    PRACTICE.push({
      id: seedId('prac'),
      date,
      scope: 'gate',
      subject: 'Engineering Mathematics',
      attempted: 10,
      solvedIndependently: 6,
      solvedWithHints: 3,
      revisionNeeded: 2,
      minutes: 60,
      note: '',
      createdAt: date,
    });
  }
  if (i % 5 === 0) {
    PRACTICE.push({
      id: seedId('prac'),
      date,
      scope: 'college',
      subject: 'Digital Electronics',
      attempted: 8,
      solvedIndependently: 5,
      solvedWithHints: 2,
      revisionNeeded: 1,
      minutes: 50,
      note: '',
      createdAt: date,
    });
  }
}

const SESSIONS: FocusedSession[] = [];
for (let i = 27; i >= 0; i -= 1) {
  const date = addDays(T, -i);
  if (i % 2 === 1) continue;
  SESSIONS.push({
    id: seedId('ses'),
    date,
    minutes: [50, 75, 90, 45][i % 4],
    area: (['technical', 'academics', 'marketing'] as const)[i % 3],
    taskTitle: ['DSA practice block', 'Syllabus revision', 'Script + shoot'][i % 3],
    note: '',
    createdAt: date,
  });
}

const SLEEP: SleepLog[] = Array.from({ length: 7 }, (_, k) => {
  const i = 6 - k;
  const date = addDays(T, -i);
  const hours = [6.5, 7.2, 5.8, 8.1, 6.9, 7.5, 6.2][i];
  return {
    id: seedId('slp'),
    date,
    bedTime: ['01:10', '00:30', '02:05', '23:40', '00:50', '00:05', '01:25'][i],
    wakeTime: ['07:40', '07:45', '07:55', '07:50', '07:45', '07:35', '07:35'][i],
    hours,
    quality: ([3, 4, 2, 5, 3, 4, 3] as const)[i] as 1 | 2 | 3 | 4 | 5,
    energy: (hours < 6 ? 'low' : hours < 7 ? 'medium' : 'high') as SleepLog['energy'],
    note: '',
    createdAt: date,
  };
});

/* ------------------------------------------------------------------ */
/* Academics & career                                                  */
/* ------------------------------------------------------------------ */

function syllabus(list: [string, number, CollegeSubject['topics'][number]['status'], number, boolean][]): CollegeSubject['topics'] {
  return list.map(([title, weight, status, confidence, weak]) => ({
    id: uid(),
    title,
    weight,
    status,
    revision: status === 'done' ? (confidence >= 4 ? 'twice' : 'once') : status === 'learning' ? 'none' : 'none',
    confidence: confidence as 0 | 1 | 2 | 3 | 4 | 5,
    weak,
    notes: '',
  }));
}

const COLLEGE: CollegeSubject[] = [
  {
    id: seedId('sub'),
    code: 'EC-301',
    name: 'Digital Electronics',
    semester: 'Semester 5',
    credits: 4,
    topics: syllabus([
      ['Number systems & Boolean algebra', 1, 'done', 5, false],
      ['Combinational circuits', 1, 'done', 4, false],
      ['Sequential circuits & flip-flops', 1, 'done', 3, true],
      ['Finite state machines', 1, 'learning', 2, true],
      ['Memory & programmable logic', 1, 'not_started', 0, false],
      ['ADC / DAC', 1, 'not_started', 0, false],
    ]),
    internalMarks: 21,
    internalMax: 30,
    examMarks: undefined,
    examMax: 70,
    examDate: addDays(T, 34),
    assignmentDue: addDays(T, 9),
    timedAssessments: [
      { id: uid(), date: addDays(T, -18), score: 14, max: 25, title: 'Unit test 1 (combinational)' },
    ],
    recurringMistakes: ['Mixing up Mealy vs Moore output timing', 'Forgetting to minimise before drawing FSM'],
    notes: '',
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('sub'),
    code: 'CS-305',
    name: 'Data Structures & Algorithms',
    semester: 'Semester 5',
    credits: 4,
    topics: syllabus([
      ['Complexity analysis', 1, 'done', 4, false],
      ['Linear structures', 1, 'done', 4, false],
      ['Trees & BST', 1, 'learning', 3, false],
      ['Graphs & traversal', 1, 'not_started', 0, true],
      ['Sorting & searching', 1, 'learning', 3, false],
      ['Greedy & DP', 1, 'not_started', 0, true],
    ]),
    internalMarks: 24,
    internalMax: 30,
    examMax: 70,
    examDate: addDays(T, 40),
    timedAssessments: [{ id: uid(), date: addDays(T, -11), score: 18, max: 25, title: 'Unit test 1' }],
    recurringMistakes: ['Writing DFS iteratively without a visited set'],
    notes: 'Overlaps with Track A — keep the practice log in DSA, keep exam prep here.',
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('sub'),
    code: 'MA-303',
    name: 'Probability & Statistics',
    semester: 'Semester 5',
    credits: 3,
    topics: syllabus([
      ['Random variables & distributions', 1, 'done', 3, false],
      ['Expectation & variance', 1, 'learning', 2, false],
      ['Joint distributions', 1, 'not_started', 0, true],
      ['Estimation & hypothesis testing', 1, 'not_started', 0, true],
      ['Regression & correlation', 1, 'not_started', 0, false],
    ]),
    internalMarks: 17,
    internalMax: 30,
    examMax: 70,
    examDate: addDays(T, 44),
    timedAssessments: [],
    recurringMistakes: [],
    notes: 'Weakest subject — feeds both the semester goal and the ML track.',
    createdAt: T,
    seeded: true,
  },
];

function gateTopics(list: [string, number, GateSubject['topics'][number]['status'], number, boolean][]): GateSubject['topics'] {
  return list.map(([title, weight, status, confidence, weak]) => ({
    id: uid(),
    title,
    weight,
    status,
    confidence: confidence as 0 | 1 | 2 | 3 | 4 | 5,
    weak,
    dueDate: undefined,
    revisionCycle: status === 'done' ? 1 : 0,
    notes: '',
  }));
}

const GATE: GateSubject[] = [
  {
    id: seedId('gate'),
    name: 'Engineering Mathematics',
    weight: 13,
    topics: gateTopics([
      ['Linear algebra', 2, 'done', 4, false],
      ['Calculus', 2, 'done', 3, false],
      ['Probability & statistics', 2, 'learning', 2, true],
      ['Differential equations', 2, 'not_started', 0, false],
      ['Numerical methods', 1, 'not_started', 0, true],
    ]),
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('gate'),
    name: 'Digital Logic',
    weight: 8,
    topics: gateTopics([
      ['Boolean algebra & minimisation', 2, 'done', 4, false],
      ['Combinational circuits', 2, 'done', 4, false],
      ['Sequential circuits', 2, 'learning', 3, false],
      ['Computer organisation basics', 2, 'not_started', 0, true],
    ]),
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('gate'),
    name: 'Algorithms',
    weight: 8,
    topics: gateTopics([
      ['Asymptotic analysis', 2, 'done', 4, false],
      ['Divide & conquer', 2, 'learning', 3, false],
      ['Greedy & DP', 2, 'not_started', 0, true],
      ['Graph algorithms', 2, 'not_started', 0, true],
    ]),
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('gate'),
    name: 'Electronic Devices & Circuits',
    weight: 9,
    topics: gateTopics([
      ['Semiconductor physics', 2, 'learning', 2, false],
      ['PN junction & diodes', 2, 'not_started', 0, false],
      ['BJT & MOSFET', 2, 'not_started', 0, true],
      ['Amplifiers & op-amps', 2, 'not_started', 0, true],
    ]),
    createdAt: T,
    seeded: true,
  },
];

const MOCKS: MockTest[] = [
  {
    id: seedId('mock'),
    date: addDays(T, -42),
    title: 'Sectional: Maths + Digital Logic',
    score: 27,
    max: 50,
    attempted: 41,
    correct: 27,
    timeLimitMinutes: 90,
    finishedInMinutes: 88,
    weakTopics: 'Numerical methods, FSM design',
    note: 'Ran out of time on the last 6 questions.',
    createdAt: addDays(T, -42),
    seeded: true,
  },
  {
    id: seedId('mock'),
    date: addDays(T, -21),
    title: 'Full length 1',
    score: 38,
    max: 100,
    attempted: 44,
    correct: 38,
    timeLimitMinutes: 180,
    finishedInMinutes: 176,
    weakTopics: 'Probability, graph algorithms, MOSFET',
    note: 'Accuracy fine, coverage is the problem.',
    createdAt: addDays(T, -21),
    seeded: true,
  },
  {
    id: seedId('mock'),
    date: addDays(T, -5),
    title: 'Full length 2',
    score: 46,
    max: 100,
    attempted: 51,
    correct: 46,
    timeLimitMinutes: 180,
    finishedInMinutes: 168,
    weakTopics: 'Probability, DP',
    note: 'Attempted 7 more questions, accuracy held.',
    createdAt: addDays(T, -5),
    seeded: true,
  },
];

const ROADMAP: RoadmapTopic[] = [
  ['foundations', 'Semiconductor physics & electronic materials', 1.5],
  ['foundations', 'Crystal structure, defects & diffusion', 1.5],
  ['foundations', 'Band theory & semiconductor fundamentals', 2],
  ['foundations', 'Doping & carrier transport', 1.5],
  ['devices', 'PN junctions & MOS structures', 2],
  ['devices', 'CMOS & device fundamentals', 2],
  ['process', 'Oxidation, deposition, lithography, etching, implantation', 2.5],
  ['process', 'Process integration & cleanroom concepts', 1.5],
  ['process', 'Characterization & reliability', 1.5],
  ['practical', 'TCAD / process data analysis project', 2.5],
].map(([phase, title, weight], i) => ({
  id: seedId('rm'),
  phase: phase as RoadmapTopic['phase'],
  title: title as string,
  weight: weight as number,
  status: i < 2 ? 'done' : i === 2 ? 'learning' : 'not_started',
  targetDate: addDays(T, 30 + i * 16),
  tools: i >= 6 ? 'Sentaurus TCAD / Python' : 'Textbook + notes',
  assignment: i < 2 ? 'One-page summary of carrier concentration derivation' : '',
  evidence: [],
  notes: '',
  createdAt: T,
  seeded: true,
}));

/* ------------------------------------------------------------------ */
/* Marketing & content                                                 */
/* ------------------------------------------------------------------ */

const ACCOUNTS: Account[] = [
  {
    id: seedId('acc'),
    name: 'Short-video page',
    platform: 'Instagram Reels / YouTube Shorts',
    handle: '@yourhandle',
    focus: 'Learn-in-public: DSA + ML explainers for students',
    weeklyTargetPosts: 2,
    metrics: Array.from({ length: 6 }, (_, k) => {
      const i = 5 - k;
      const date = addDays(W, -i * 7);
      const views = [2400, 3100, 5200, 4300, 8800, 11400][i];
      return {
        id: seedId('met'),
        date,
        views,
        reach: Math.round(views * 0.82),
        likes: Math.round(views * 0.062),
        comments: Math.round(views * 0.008),
        shares: Math.round(views * 0.011),
        saves: Math.round(views * 0.014),
        watchTimeMinutes: Math.round(views * 0.42),
        followers: [820, 910, 1180, 1320, 1760, 2140][i],
        profileVisits: Math.round(views * 0.03),
        inquiries: [0, 1, 1, 2, 3, 4][i],
        leads: [0, 0, 1, 1, 2, 2][i],
        createdAt: date,
        seeded: true,
      };
    }),
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('acc'),
    name: 'AI-ad portfolio page',
    platform: 'Instagram + personal site',
    handle: '@yourads',
    focus: 'AI-assisted advertisement work for small brands',
    weeklyTargetPosts: 1,
    metrics: Array.from({ length: 6 }, (_, k) => {
      const i = 5 - k;
      const date = addDays(W, -i * 7);
      const views = [300, 520, 410, 900, 1250, 1600][i];
      return {
        id: seedId('met'),
        date,
        views,
        reach: Math.round(views * 0.78),
        likes: Math.round(views * 0.07),
        comments: Math.round(views * 0.01),
        shares: Math.round(views * 0.006),
        saves: Math.round(views * 0.02),
        watchTimeMinutes: Math.round(views * 0.5),
        followers: [120, 150, 190, 240, 310, 390][i],
        profileVisits: Math.round(views * 0.05),
        inquiries: [0, 0, 1, 1, 2, 3][i],
        leads: [0, 0, 0, 1, 1, 2][i],
        createdAt: date,
        seeded: true,
      };
    }),
    createdAt: T,
    seeded: true,
  },
];

const CONTENT: ContentItem[] = [
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[0].id,
    title: 'Why your O(n²) solution is actually fine (sometimes)',
    kind: 'short_form',
    pillar: 'DSA myths',
    stage: 'published',
    hook: 'You were lied to about Big-O.',
    script: 'Hook → show the constraint table → 3 real examples → CTA to save the sheet.',
    cta: 'Save this for your next interview prep session',
    format: 'Reel 45s, talking head + screen recording',
    campaign: '',
    assetLinks: '',
    plannedDate: addDays(T, -9),
    publishedDate: addDays(T, -8),
    createdAt: addDays(T, -12),
    seeded: true,
  },
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[0].id,
    title: 'Sliding window in 60 seconds',
    kind: 'short_form',
    pillar: 'DSA patterns',
    stage: 'ready',
    hook: 'One loop instead of two — here is the trick.',
    script: 'Problem → naive → pattern → code → complexity.',
    cta: 'Follow for one pattern a day',
    format: 'Reel 60s, whiteboard',
    campaign: '',
    assetLinks: '',
    plannedDate: addDays(T, 2),
    createdAt: addDays(T, -3),
    seeded: true,
  },
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[0].id,
    title: 'I built a model that predicts my exam score',
    kind: 'short_form',
    pillar: 'ML in public',
    stage: 'editing',
    hook: 'I fed my own marks into a model. It was rude.',
    script: 'Setup → features → result → honest limitation.',
    cta: 'Comment your worst subject',
    format: 'Reel 75s, screen recording + VO',
    campaign: '',
    assetLinks: '',
    plannedDate: addDays(T, 5),
    createdAt: addDays(T, -2),
    seeded: true,
  },
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[1].id,
    title: '30s product ad for a campus café (spec)',
    kind: 'portfolio_ad',
    pillar: 'Portfolio',
    stage: 'production',
    hook: 'Nobody reads the menu. They read the mood.',
    script: 'Concept brief → AI storyboard → shot list → edit.',
    cta: 'DM "AD" for a free concept for your brand',
    format: 'Video 30s + 3 statics',
    campaign: 'Spec work — campus café',
    assetLinks: '',
    plannedDate: addDays(T, 6),
    createdAt: addDays(T, -4),
    seeded: true,
  },
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[1].id,
    title: 'Skincare brand launch ad (spec)',
    kind: 'portfolio_ad',
    pillar: 'Portfolio',
    stage: 'script',
    hook: 'Your product is fine. Your first frame is not.',
    script: 'Before/after concept, AI-generated b-roll, typography pass.',
    cta: 'Book a concept call',
    format: 'Video 20s + carousel',
    campaign: 'Spec work — skincare',
    assetLinks: '',
    plannedDate: addDays(T, 14),
    createdAt: addDays(T, -1),
    seeded: true,
  },
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[0].id,
    title: 'How I plan a week around a college timetable',
    kind: 'short_form',
    pillar: 'Systems',
    stage: 'idea',
    hook: 'Fixed timetable, flexible plan.',
    script: '',
    cta: '',
    format: '',
    campaign: '',
    assetLinks: '',
    createdAt: T,
    seeded: true,
  },
  {
    id: seedId('ct'),
    accountId: ACCOUNTS[0].id,
    title: 'RAG explained with a library analogy',
    kind: 'short_form',
    pillar: 'GenAI',
    stage: 'research',
    hook: 'Your LLM does not know your notes. Fix that.',
    script: '',
    cta: '',
    format: 'Reel 60s',
    campaign: '',
    assetLinks: '',
    createdAt: T,
    seeded: true,
  },
];

const DEALS: BrandDeal[] = [
  {
    id: seedId('deal'),
    brand: 'EdTech startup (D2C)',
    contact: 'Marketing lead',
    contactLink: 'https://linkedin.com/in/example',
    outreachDate: addDays(T, -16),
    pitchLink: '',
    stage: 'replied',
    followUpDate: addDays(T, 2),
    deliverable: '2 reels + 1 story set',
    quotedFee: 8000,
    agreedFee: 0,
    contractStatus: 'none',
    deliverableDue: undefined,
    paymentStatus: 'none',
    amountReceived: 0,
    notes: 'Asked for audience demographics and past performance.',
    nextAction: 'Send one-page media kit with real metrics',
    createdAt: addDays(T, -20),
    seeded: true,
  },
  {
    id: seedId('deal'),
    brand: 'Local café chain',
    contact: 'Owner',
    contactLink: '',
    outreachDate: addDays(T, -6),
    pitchLink: '',
    stage: 'contacted',
    followUpDate: addDays(T, 1),
    deliverable: '1 AI-produced 30s ad',
    quotedFee: 4500,
    agreedFee: 0,
    contractStatus: 'none',
    paymentStatus: 'none',
    amountReceived: 0,
    notes: 'Warm intro from a classmate.',
    nextAction: 'Follow up with the spec ad as proof of work',
    createdAt: addDays(T, -8),
    seeded: true,
  },
  {
    id: seedId('deal'),
    brand: 'Notebook / stationery brand',
    contact: 'Founder',
    contactLink: '',
    pitchLink: '',
    stage: 'researched',
    deliverable: '1 reel + UGC rights',
    quotedFee: 3500,
    agreedFee: 0,
    contractStatus: 'none',
    paymentStatus: 'none',
    amountReceived: 0,
    notes: 'Good fit with the study-systems pillar.',
    nextAction: 'Draft outreach message',
    createdAt: addDays(T, -3),
    seeded: true,
  },
  {
    id: seedId('deal'),
    brand: 'Course platform',
    contact: 'Affiliate manager',
    contactLink: '',
    pitchLink: '',
    outreachDate: addDays(T, -30),
    stage: 'lost',
    deliverable: '—',
    quotedFee: 0,
    agreedFee: 0,
    contractStatus: 'none',
    paymentStatus: 'none',
    amountReceived: 0,
    notes: 'Only offered commission-only. Declined, kept in nurture list.',
    nextAction: 'Revisit after 5k followers',
    createdAt: addDays(T, -34),
    seeded: true,
  },
];

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

function task(t: Partial<Task> & Pick<Task, 'title'>): Task {
  return {
    id: seedId('task'),
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
    createdAt: T,
    seeded: true,
    ...t,
  } as Task;
}

const TASKS: Task[] = [
  task({
    title: 'Arrays & hashing: 6 problems, log results',
    area: 'technical',
    goalId: gDsa.id,
    priority: 'P1',
    importance: 5,
    estimatedMinutes: 90,
    mvc: 'Solve 2 problems and write the approach for each',
    finishCondition: '6 problems attempted with independent/hint status logged in Practice',
    energy: 'high',
    cognitiveLoad: 'heavy',
    deadline: addDays(T, 2),
    plannedDate: T,
  }),
  task({
    title: 'Write complexity notes: amortised analysis',
    area: 'technical',
    goalId: gDsa.id,
    importance: 4,
    estimatedMinutes: 45,
    mvc: 'Write 3 paragraphs + 1 worked example',
    finishCondition: 'Notes committed, can explain amortised O(1) append out loud',
    energy: 'medium',
    cognitiveLoad: 'medium',
    deadline: addDays(T, 5),
  }),
  task({
    title: 'Pandas: groupby + join exercises (10 questions)',
    area: 'technical',
    goalId: gMl.id,
    importance: 4,
    estimatedMinutes: 60,
    mvc: 'Complete 4 exercises',
    finishCondition: '10 exercises done in a notebook, pushed to repo',
    energy: 'medium',
    cognitiveLoad: 'medium',
    deadline: addDays(T, 6),
  }),
  task({
    title: 'Read: tokenization & context window cost',
    area: 'technical',
    goalId: gGenai.id,
    importance: 3,
    estimatedMinutes: 40,
    mvc: 'Read the tokenizer section and write 5 bullet takeaways',
    finishCondition: 'One-page note explaining token budget vs cost',
    energy: 'low',
    cognitiveLoad: 'light',
    deadline: addDays(T, 9),
  }),
  task({
    title: 'FSM practice: 5 past-paper questions',
    area: 'academics',
    goalId: gAcademics.id,
    importance: 5,
    estimatedMinutes: 75,
    mvc: 'Do 2 questions fully, including state diagrams',
    finishCondition: '5 questions attempted, mistakes written down',
    energy: 'medium',
    cognitiveLoad: 'heavy',
    deadline: addDays(T, 3),
  }),
  task({
    title: 'Probability: joint distributions — first pass',
    area: 'academics',
    goalId: gAcademics.id,
    importance: 4,
    estimatedMinutes: 60,
    mvc: 'Work through 3 solved examples',
    finishCondition: 'Chapter summary + 3 examples reproduced without notes',
    energy: 'medium',
    cognitiveLoad: 'heavy',
    deadline: addDays(T, 8),
  }),
  task({
    title: 'GATE PYQ set: Engineering Mathematics (20 Qs, timed)',
    area: 'gate',
    goalId: gGate.id,
    priority: 'P1',
    importance: 5,
    estimatedMinutes: 120,
    mvc: '10 questions timed, log accuracy',
    finishCondition: '20 questions attempted under 45 minutes, accuracy logged',
    energy: 'high',
    cognitiveLoad: 'heavy',
    deadline: addDays(T, 4),
    deferCount: 2,
    lastDeferredAt: addDays(T, -3),
  }),
  task({
    title: 'Revise weak topics: numerical methods',
    area: 'gate',
    goalId: gGate.id,
    importance: 3,
    estimatedMinutes: 45,
    mvc: 'Redo 3 previously wrong questions',
    finishCondition: '3 questions re-solved correctly without hints',
    energy: 'low',
    cognitiveLoad: 'medium',
    deadline: addDays(T, 7),
  }),
  task({
    title: 'Semiconductor: band theory notes + diagram',
    area: 'semiconductor',
    goalId: gSemi.id,
    importance: 3,
    estimatedMinutes: 60,
    mvc: 'Summarise intrinsic vs extrinsic in half a page',
    finishCondition: 'Notes + one labelled band diagram in the notes repo',
    energy: 'medium',
    cognitiveLoad: 'medium',
    deadline: addDays(T, 12),
  }),
  task({
    title: 'Shoot batch: 3 reels from the DSA patterns series',
    area: 'marketing',
    goalId: gContent.id,
    importance: 4,
    estimatedMinutes: 90,
    mvc: 'Shoot 1 reel end to end',
    finishCondition: '3 raw clips captured with usable audio',
    energy: 'high',
    cognitiveLoad: 'medium',
    deadline: addDays(T, 3),
  }),
  task({
    title: 'Record this week\'s account metrics (both pages)',
    area: 'marketing',
    goalId: gContent.id,
    importance: 3,
    estimatedMinutes: 20,
    mvc: 'Enter views, reach, interactions, followers',
    finishCondition: 'One metrics row per account for the current week',
    energy: 'low',
    cognitiveLoad: 'light',
    deadline: addDays(T, 1),
    recurrence: { type: 'weekly', interval: 1 },
  }),
  task({
    title: 'Send 10 brand outreach messages',
    area: 'marketing',
    goalId: gAds.id,
    importance: 4,
    estimatedMinutes: 60,
    mvc: 'Send 3 personalised messages',
    finishCondition: '10 rows in the sponsorship CRM with outreach date',
    energy: 'medium',
    cognitiveLoad: 'light',
    deadline: addDays(T, 5),
  }),
  task({
    title: 'Follow up: EdTech startup media kit',
    area: 'marketing',
    goalId: gAds.id,
    priority: 'P1',
    importance: 4,
    estimatedMinutes: 30,
    mvc: 'Send the media kit PDF with real numbers',
    finishCondition: 'Email sent, CRM stage updated',
    energy: 'low',
    cognitiveLoad: 'light',
    deadline: addDays(T, 2),
  }),
  task({
    title: 'Edit captions + thumbnails backlog',
    area: 'marketing',
    goalId: gContent.id,
    importance: 2,
    estimatedMinutes: 30,
    mvc: 'Do 2 captions',
    finishCondition: 'All ready-stage items have captions',
    energy: 'low',
    cognitiveLoad: 'light',
  }),
  task({
    title: 'Recovery block: walk + no screens',
    area: 'admin',
    importance: 3,
    estimatedMinutes: 40,
    mvc: '10 minutes outside',
    finishCondition: 'Done. This is a legitimate output on an exhausted day.',
    energy: 'exhausted',
    cognitiveLoad: 'light',
    fallbackFor: 'gateset',
    notes: 'Fallback task for low-energy days. Using it is not a failure.',
  }),
  task({
    title: 'Organise notes folder + rename files',
    area: 'admin',
    importance: 1,
    estimatedMinutes: 25,
    mvc: 'Sort one subject folder',
    finishCondition: 'Notes folder navigable in under 10 seconds',
    energy: 'low',
    cognitiveLoad: 'light',
  }),
  task({
    title: 'Timed assessment: Digital Electronics unit 2',
    area: 'academics',
    goalId: gAcademics.id,
    importance: 5,
    estimatedMinutes: 60,
    mvc: 'Do half the paper under time',
    finishCondition: 'Paper done under time limit, score entered in Academics',
    energy: 'high',
    cognitiveLoad: 'heavy',
    deadline: addDays(T, 10),
    evidenceRequired: true,
  }),
];

// Demonstrate a real dependency: the shoot depends on the script task.
const scriptTask = task({
  title: 'Finalise scripts for the 3-video batch',
  area: 'marketing',
  goalId: gContent.id,
  importance: 4,
  estimatedMinutes: 45,
  mvc: 'Write the hook + first 15 seconds for each',
  finishCondition: '3 scripts saved in the content board',
  energy: 'medium',
  cognitiveLoad: 'medium',
  deadline: addDays(T, 2),
});
const shootTask = TASKS.find((t) => t.title.startsWith('Shoot batch'))!;
shootTask.dependencies = [scriptTask.id];
TASKS.push(scriptTask);

/* ------------------------------------------------------------------ */
/* Day plan + review                                                   */
/* ------------------------------------------------------------------ */

const DAY_PLANS: Record<string, DayPlan> = {
  [T]: {
    date: T,
    energy: 'medium',
    availableMinutes: 180,
    focusMinutes: 90,
    windows: [
      { id: uid(), label: 'Morning gap', start: '09:30', end: '11:00', minutes: 90 },
      { id: uid(), label: 'Evening block', start: '19:00', end: '20:30', minutes: 90 },
    ],
    fixed: [
      { id: uid(), label: 'Digital Electronics lab', start: '13:00', end: '16:00' },
      { id: uid(), label: 'DSA lecture', start: '11:15', end: '12:15' },
    ],
    unavailable: [{ id: uid(), label: 'Commute', start: '18:00', end: '18:45' }],
    note: '',
  },
};

const REVIEWS: WeeklyReview[] = [
  {
    id: seedId('rev'),
    weekStart: addDays(W, -7),
    plannedSessions: 10,
    completedSessions: 7,
    deliverables: 'Published 1 reel; committed the EDA notebook.',
    milestones: 'None closed — 2 slipped by 3 days.',
    assessments: 'GATE full length 2: 46/100, up from 38.',
    academicNotes: 'FSM and joint distributions still weak.',
    contentNotes: 'Best-performing hook was the contrarian Big-O opener.',
    commercialNotes: '1 reply from the EdTech lead. No paid deals yet.',
    postponedTasks: 'GATE timed set moved 3 times — it needs a protected 2-hour window.',
    energyNotes: 'Two short-sleep nights landed on heavy-cognition days.',
    adjustments: 'Put the timed GATE set on the first high-energy block; batch shooting on Saturday.',
    createdAt: addDays(W, -1),
  },
];

/* ------------------------------------------------------------------ */

export function buildSeedData(): AppData {
  return {
    version: 1,
    settings: {
      userName: 'Student',
      theme: 'system',
      examDate: addDays(T, 40),
      gateDate: addMonths(T, 5),
      weights: { deadline: 1, importance: 1, energyFit: 1, durationFit: 1, defer: 1 },
      evidencePrompt: true,
      demoDataLoaded: true,
      shuffleExclusions: [],
    },
    goals: GOALS,
    milestones: MILESTONES,
    topics: TOPICS,
    trackProjects: PROJECTS,
    practiceLogs: PRACTICE,
    sessions: SESSIONS,
    collegeSubjects: COLLEGE,
    gateSubjects: GATE,
    mockTests: MOCKS,
    roadmap: ROADMAP,
    accounts: ACCOUNTS,
    content: CONTENT,
    deals: DEALS,
    tasks: TASKS,
    dayPlans: DAY_PLANS,
    sleepLogs: SLEEP,
    reviews: REVIEWS,
    events: [],
  };
}
