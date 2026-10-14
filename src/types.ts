/**
 * Core data model for the Personal Operating System.
 *
 * Design rules encoded in these types:
 *  - Every entity has a stable string id (`nanoid`-style) and a createdAt timestamp.
 *  - Progress is NEVER stored as a raw number that can drift: it is always derived
 *    from weighted children (milestones / topics) plus an explicit manual override
 *    that the user has to opt into.
 *  - Evidence is a first-class concept. A milestone or "evidence" task cannot be
 *    closed without it.
 *  - Demo-seeded rows carry `seeded: true` so the UI can label proposals vs commitments.
 */

export type AreaId = 'technical' | 'academics' | 'marketing';

export type Horizon = '90d' | '6m';

export type Status = 'not_started' | 'in_progress' | 'at_risk' | 'blocked' | 'completed' | 'archived';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'dropped';

export type Energy = 'exhausted' | 'low' | 'medium' | 'high';

export type CognitiveLoad = 'light' | 'medium' | 'heavy';

export interface Evidence {
  id: string;
  label: string;
  url: string;
  note: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Goals & milestones                                                  */
/* ------------------------------------------------------------------ */

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  weight: number; // relative weight inside the goal
  status: 'pending' | 'done';
  evidenceRequired: boolean;
  evidence: Evidence[];
  completedAt?: string;
  note: string;
  createdAt: string;
  seeded?: boolean;
}

export interface Goal {
  id: string;
  area: AreaId;
  horizon: Horizon;
  title: string;
  outcome: string; // specific, observable outcome
  measurement: string; // how it will be measured
  startDate: string;
  targetDate: string;
  status: Status;
  /** 0..1 — only used when manualOverride is true. */
  manualProgress: number;
  manualOverride: boolean;
  weeklyTarget: string;
  indicator: 'leading' | 'lagging';
  /** Marks the goal shown as the North Star for its horizon on the Overview. */
  northStar?: boolean;
  evidence: Evidence[];
  dependencies: string[]; // ids of other goals
  notes: string;
  history: ProgressPoint[];
  createdAt: string;
  seeded?: boolean;
}

export interface ProgressPoint {
  id: string;
  date: string;
  value: number; // 0..1
  source: 'milestone' | 'manual' | 'recompute';
  note: string;
}

/* ------------------------------------------------------------------ */
/* Technical learning                                                  */
/* ------------------------------------------------------------------ */

export type TrackId = 'dsa' | 'ml' | 'genai';

export interface TrackTopic {
  id: string;
  trackId: TrackId;
  title: string;
  detail: string;
  order: number;
  weight: number;
  status: 'not_started' | 'learning' | 'done' | 'skipped';
  confidence: 0 | 1 | 2 | 3 | 4 | 5;
  estimatedHours: number;
  startDate?: string;
  targetDate?: string;
  prerequisites: string[]; // ids of other topics in the same track
  practiceTarget: number; // problems / exercises expected
  practiceDone: number;
  evidence: Evidence[];
  notes: string;
  blockers: string;
  nextAction: string;
  archived: boolean;
  createdAt: string;
  seeded?: boolean;
}

export interface TrackProject {
  id: string;
  trackId: TrackId;
  title: string;
  brief: string;
  status: 'idea' | 'in_progress' | 'done';
  targetDate?: string;
  milestones: { id: string; title: string; done: boolean }[];
  evidence: Evidence[];
  createdAt: string;
  seeded?: boolean;
}

export interface PracticeLog {
  id: string;
  date: string;
  scope: 'dsa' | 'ml' | 'genai' | 'gate' | 'college';
  subject: string;
  attempted: number;
  solvedIndependently: number;
  solvedWithHints: number;
  revisionNeeded: number;
  minutes: number;
  note: string;
  createdAt: string;
}

export interface FocusedSession {
  id: string;
  date: string;
  minutes: number;
  area: AreaId | 'gate' | 'semiconductor';
  taskTitle: string;
  note: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Academics & career                                                  */
/* ------------------------------------------------------------------ */

export interface SyllabusTopic {
  id: string;
  title: string;
  weight: number;
  status: 'not_started' | 'learning' | 'done';
  revision: 'none' | 'once' | 'twice' | 'mastered';
  confidence: 0 | 1 | 2 | 3 | 4 | 5;
  weak: boolean;
  notes: string;
}

export interface CollegeSubject {
  id: string;
  code: string;
  name: string;
  semester: string;
  credits: number;
  topics: SyllabusTopic[];
  internalMarks?: number;
  internalMax?: number;
  examMarks?: number;
  examMax?: number;
  grade?: string;
  examDate?: string;
  assignmentDue?: string;
  timedAssessments: { id: string; date: string; score: number; max: number; title: string }[];
  recurringMistakes: string[];
  notes: string;
  createdAt: string;
  seeded?: boolean;
}

export interface GateTopic {
  id: string;
  title: string;
  weight: number;
  status: 'not_started' | 'learning' | 'done';
  confidence: 0 | 1 | 2 | 3 | 4 | 5;
  weak: boolean;
  dueDate?: string;
  revisionCycle: 0 | 1 | 2 | 3;
  notes: string;
}

export interface GateSubject {
  id: string;
  name: string;
  weight: number;
  topics: GateTopic[];
  createdAt: string;
  seeded?: boolean;
}

export interface MockTest {
  id: string;
  date: string;
  title: string;
  score: number;
  max: number;
  attempted: number;
  correct: number;
  timeLimitMinutes: number;
  finishedInMinutes: number;
  weakTopics: string;
  note: string;
  createdAt: string;
  seeded?: boolean;
}

export interface RoadmapTopic {
  id: string;
  phase: 'foundations' | 'process' | 'devices' | 'practical';
  title: string;
  weight: number;
  status: 'not_started' | 'learning' | 'done';
  targetDate?: string;
  tools: string;
  assignment: string;
  evidence: Evidence[];
  notes: string;
  createdAt: string;
  seeded?: boolean;
}

/* ------------------------------------------------------------------ */
/* Marketing & content                                                 */
/* ------------------------------------------------------------------ */

export type ContentStage =
  | 'idea'
  | 'research'
  | 'script'
  | 'production'
  | 'editing'
  | 'ready'
  | 'published';

export interface ContentItem {
  id: string;
  accountId: string;
  title: string;
  kind: 'short_form' | 'portfolio_ad';
  pillar: string;
  stage: ContentStage;
  hook: string;
  script: string;
  cta: string;
  format: string;
  campaign: string;
  assetLinks: string;
  plannedDate?: string;
  publishedDate?: string;
  createdAt: string;
  seeded?: boolean;
}

export interface AccountMetric {
  id: string;
  date: string; // week ending / measurement date
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTimeMinutes: number;
  followers: number;
  profileVisits: number;
  inquiries: number;
  leads: number;
  createdAt: string;
  seeded?: boolean;
}

export interface Account {
  id: string;
  name: string;
  platform: string;
  handle: string;
  focus: string;
  weeklyTargetPosts: number;
  metrics: AccountMetric[];
  createdAt: string;
  seeded?: boolean;
}

export type DealStage =
  | 'prospect'
  | 'researched'
  | 'contacted'
  | 'replied'
  | 'negotiating'
  | 'won'
  | 'lost';

export interface BrandDeal {
  id: string;
  brand: string;
  contact: string;
  contactLink: string;
  outreachDate?: string;
  pitchLink: string;
  stage: DealStage;
  followUpDate?: string;
  deliverable: string;
  quotedFee: number;
  agreedFee: number;
  contractStatus: 'none' | 'draft' | 'sent' | 'signed';
  deliverableDue?: string;
  paymentStatus: 'none' | 'invoiced' | 'partial' | 'paid';
  amountReceived: number;
  notes: string;
  nextAction: string;
  createdAt: string;
  seeded?: boolean;
}

/* ------------------------------------------------------------------ */
/* Tasks & adaptive scheduling                                         */
/* ------------------------------------------------------------------ */

export interface Task {
  id: string;
  title: string;
  area: AreaId | 'gate' | 'semiconductor' | 'admin';
  goalId?: string;
  trackId?: TrackId;
  subjectId?: string;
  priority: 'P1' | 'P2' | 'P3';
  importance: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  mvc: string; // minimum viable completion
  finishCondition: string;
  energy: Energy;
  cognitiveLoad: CognitiveLoad;
  deadline?: string;
  status: TaskStatus;
  dependencies: string[]; // other task ids
  plannedDate?: string;
  plannedSlot?: string; // free-text slot label, e.g. "afternoon window"
  completedAt?: string;
  actualMinutes?: number;
  outcome?: string;
  evidenceLink?: string;
  reflection?: string;
  evidenceRequired: boolean;
  recurrence?: { type: 'none' | 'daily' | 'weekly'; interval: number } | null;
  deferCount: number;
  lastDeferredAt?: string;
  fallbackFor?: string; // id of the task this is a lighter fallback of
  notes: string;
  fixed: boolean; // fixed commitments are never moved by shuffle
  history: { id: string; at: string; kind: string; detail: string }[];
  createdAt: string;
  seeded?: boolean;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  energy: Energy;
  availableMinutes: number;
  focusMinutes: number; // longest uninterrupted block
  windows: { id: string; label: string; start: string; end: string; minutes: number }[];
  fixed: { id: string; label: string; start: string; end: string }[];
  unavailable: { id: string; label: string; start: string; end: string }[];
  note: string;
}

export interface SleepLog {
  id: string;
  date: string; // the day the log describes (wake day)
  bedTime: string; // HH:MM
  wakeTime: string; // HH:MM
  hours: number;
  quality: 1 | 2 | 3 | 4 | 5;
  energy: Energy;
  note: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Reviews, settings, events                                           */
/* ------------------------------------------------------------------ */

export interface WeeklyReview {
  id: string;
  seeded?: boolean;
  weekStart: string;
  plannedSessions: number;
  completedSessions: number;
  deliverables: string;
  milestones: string;
  assessments: string;
  academicNotes: string;
  contentNotes: string;
  commercialNotes: string;
  postponedTasks: string;
  energyNotes: string;
  adjustments: string;
  createdAt: string;
}

export interface AppSettings {
  userName: string;
  theme: 'light' | 'dark' | 'system';
  examDate?: string;
  gateDate?: string;
  weights: {
    deadline: number;
    importance: number;
    energyFit: number;
    durationFit: number;
    defer: number;
  };
  evidencePrompt: boolean;
  demoDataLoaded: boolean;
  /** task ids already surfaced by shuffle, so we avoid repeating the same pick */
  shuffleExclusions: string[];
}

export interface ProgressEvent {
  id: string;
  date: string;
  kind:
    | 'milestone'
    | 'task'
    | 'topic'
    | 'content'
    | 'practice'
    | 'session'
    | 'deal'
    | 'assessment';
  refId: string;
  title: string;
  area: AreaId | 'gate' | 'semiconductor' | 'admin';
  note: string;
  evidence?: string;
}

export interface AppData {
  version: number;
  exportedAt?: string;
  settings: AppSettings;
  goals: Goal[];
  milestones: Milestone[];
  topics: TrackTopic[];
  trackProjects: TrackProject[];
  practiceLogs: PracticeLog[];
  sessions: FocusedSession[];
  collegeSubjects: CollegeSubject[];
  gateSubjects: GateSubject[];
  mockTests: MockTest[];
  roadmap: RoadmapTopic[];
  accounts: Account[];
  content: ContentItem[];
  deals: BrandDeal[];
  tasks: Task[];
  dayPlans: Record<string, DayPlan>;
  sleepLogs: SleepLog[];
  reviews: WeeklyReview[];
  events: ProgressEvent[];
}

export const TRACK_LABELS: Record<TrackId, string> = {
  dsa: 'Track A · DSA & Fundamentals',
  ml: 'Track B · Machine Learning',
  genai: 'Track C · Generative AI',
};

export const AREA_LABELS: Record<AreaId, string> = {
  technical: 'Technical',
  academics: 'Academics & Career',
  marketing: 'Marketing & Content',
};

export const SCOPE_LABELS: Record<Task['area'], string> = {
  technical: 'Technical',
  academics: 'Academics',
  marketing: 'Marketing & Content',
  gate: 'GATE',
  semiconductor: 'Semiconductor',
  admin: 'Admin / Recovery',
};
