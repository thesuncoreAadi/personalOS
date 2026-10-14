/** Selectors shared across pages. Pure functions over AppData so they are trivially testable. */
import type { AppData, AreaId, ContentItem, Goal, Task } from '../types';
import { addDays, lastNWeeks, startOfWeek, todayISO, weekKey } from '../lib/date';
import {
  areaProgress,
  currentlyLearning,
  goalHealth,
  goalProgress,
  nextMilestone,
  nextTopics,
  roadmapProgress,
  syllabusCoverage,
  trackProgress,
} from './progress';
import { dealFunnel } from './metrics';

export interface AreaCard {
  area: AreaId;
  progress: number;
  components: { label: string; value: number; weight: number }[];
  currentMilestone?: { title: string; dueDate: string };
  nextTask?: Task;
  nextDeadline?: { label: string; date: string };
  health: 'on_track' | 'at_risk' | 'overdue' | 'completed' | 'not_started';
  healthReason: string;
  headline: string;
}

export function northStars(data: AppData, nowISO = todayISO()) {
  const pick = (horizon: '90d' | '6m'): Goal | undefined => {
    const candidates = data.goals.filter(
      (g) => g.horizon === horizon && g.status !== 'archived' && g.status !== 'completed',
    );
    const withStar = candidates.find((g) => g.northStar);
    if (withStar) return withStar;
    return candidates.sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  };
  const goal90 = pick('90d');
  const goal6m = pick('6m');
  const detail = (g?: Goal) => {
    if (!g) return undefined;
    const ms = nextMilestone(g.id, data.milestones);
    return {
      goal: g,
      progress: goalProgress(g, data.milestones),
      nextMilestone: ms,
      health: goalHealth(g, data.milestones, nowISO),
    };
  };
  const d90 = detail(goal90);
  const d6m = detail(goal6m);
  return {
    goal90,
    goal6m,
    d90,
    d6m,
    overall:
      d90 && d6m ? (d90.progress.value + d6m.progress.value) / 2 : (d90?.progress.value ?? d6m?.progress.value ?? 0),
  };
}

export function areaCards(data: AppData, nowISO = todayISO()): AreaCard[] {
  const areas: AreaId[] = ['technical', 'academics', 'marketing'];
  return areas.map((area) => {
    const progress = areaProgress(
      area,
      data.goals,
      data.milestones,
      data.topics,
      data.trackProjects,
      data.roadmap,
    );
    const areaGoals = data.goals.filter((g) => g.area === area && g.status !== 'archived');
    const milestones = data.milestones
      .filter((m) => areaGoals.some((g) => g.id === m.goalId) && m.status === 'pending')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const currentMilestone = milestones[0];

    const goalIds = areaGoals.map((g) => g.id);
    const nextTask = data.tasks
      .filter((t) => (t.status === 'todo' || t.status === 'in_progress') && t.goalId && goalIds.includes(t.goalId))
      .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))[0];

    const extraDeadlines: { label: string; date: string }[] = [];
    if (area === 'academics') {
      for (const s of data.collegeSubjects) {
        if (s.examDate) extraDeadlines.push({ label: `${s.name} exam`, date: s.examDate });
        if (s.assignmentDue) extraDeadlines.push({ label: `${s.name} assignment`, date: s.assignmentDue });
      }
      extraDeadlines.push({ label: 'GATE exam', date: data.settings.gateDate ?? '' });
    }
    if (area === 'marketing') {
      for (const d of data.deals) {
        if (d.followUpDate && d.stage !== 'won' && d.stage !== 'lost')
          extraDeadlines.push({ label: `Follow up: ${d.brand}`, date: d.followUpDate });
        if (d.deliverableDue)
          extraDeadlines.push({ label: `Deliverable: ${d.brand}`, date: d.deliverableDue });
      }
      for (const c of data.content) {
        if (c.stage === 'ready' && c.plannedDate)
          extraDeadlines.push({ label: `Publish: ${c.title}`, date: c.plannedDate });
      }
    }

    const allDeadlines = [
      ...milestones.map((m) => ({ label: m.title, date: m.dueDate })),
      ...extraDeadlines.filter((e) => e.date),
    ]
      .filter((d) => d.date >= nowISO)
      .sort((a, b) => a.date.localeCompare(b.date));

    const healths = areaGoals.map((g) => goalHealth(g, data.milestones, nowISO).health);
    let health: AreaCard['health'] = 'on_track';
    if (healths.includes('overdue')) health = 'overdue';
    else if (healths.includes('at_risk')) health = 'at_risk';
    else if (healths.length > 0 && healths.every((h) => h === 'completed')) health = 'completed';
    else if (healths.length === 0) health = 'not_started';

    const worst = areaGoals
      .map((g) => ({ g, h: goalHealth(g, data.milestones, nowISO) }))
      .filter((x) => x.h.health === health)[0];

    let headline = 'No goals yet';
    if (area === 'technical') {
      const learning = currentlyLearning(data.topics);
      const next = nextTopics(data.topics, 1)[0];
      headline = learning.length
        ? `Learning: ${learning.map((t) => t.title).join(', ')}`
        : next
          ? `Next up: ${next.title}`
          : 'No active topics';
    }
    if (area === 'academics') {
      const weakest = [...data.collegeSubjects]
        .map((s) => ({ s, c: syllabusCoverage(s).value }))
        .sort((a, b) => a.c - b.c)[0];
      const semi = roadmapProgress(data.roadmap).value;
      headline = weakest
        ? `Lowest coverage: ${weakest.s.name} (${Math.round(weakest.c * 100)}%) · semiconductor roadmap ${Math.round(semi * 100)}%`
        : 'Add subjects to track coverage';
    }
    if (area === 'marketing') {
      const published = data.content.filter((c) => c.stage === 'published').length;
      const funnel = dealFunnel(data.deals, data.content.filter((c) => c.kind === 'portfolio_ad' && c.stage === 'published').length);
      headline = `${published} published · ${funnel.qualified} qualified prospects · ₹${funnel.revenueAgreed} agreed`;
    }

    return {
      area,
      progress: progress.value,
      components: progress.components.filter((c) => c.weight > 0),
      currentMilestone,
      nextTask,
      nextDeadline: allDeadlines[0],
      health,
      healthReason: worst?.h.reason ?? 'no goals in this area yet',
      headline,
    };
  });
}

export interface UpcomingItem {
  id: string;
  date: string;
  label: string;
  kind: 'deadline' | 'milestone' | 'exam' | 'publish' | 'review' | 'followup';
  area: AreaId | 'gate' | 'semiconductor' | 'admin';
  detail?: string;
}

export function upcoming(data: AppData, nowISO = todayISO(), days = 21): UpcomingItem[] {
  const limit = addDays(nowISO, days);
  const items: UpcomingItem[] = [];

  for (const m of data.milestones) {
    if (m.status !== 'pending') continue;
    const goal = data.goals.find((g) => g.id === m.goalId);
    if (!goal) continue;
    items.push({
      id: `ms_${m.id}`,
      date: m.dueDate,
      label: m.title,
      kind: 'milestone',
      area: goal.area,
      detail: goal.title,
    });
  }
  for (const t of data.tasks) {
    if (t.status === 'done' || t.status === 'dropped' || !t.deadline) continue;
    items.push({ id: `task_${t.id}`, date: t.deadline, label: t.title, kind: 'deadline', area: t.area });
  }
  for (const s of data.collegeSubjects) {
    if (s.examDate) items.push({ id: `exam_${s.id}`, date: s.examDate, label: `${s.name} exam`, kind: 'exam', area: 'academics' });
    if (s.assignmentDue)
      items.push({ id: `asg_${s.id}`, date: s.assignmentDue, label: `${s.name} assignment due`, kind: 'deadline', area: 'academics' });
  }
  if (data.settings.gateDate)
    items.push({ id: 'gate_exam', date: data.settings.gateDate, label: 'GATE exam', kind: 'exam', area: 'gate' });
  for (const c of data.content) {
    if (c.stage !== 'published' && c.plannedDate)
      items.push({ id: `pub_${c.id}`, date: c.plannedDate, label: `Publish: ${c.title}`, kind: 'publish', area: 'marketing' });
  }
  for (const d of data.deals) {
    if (d.stage === 'won' || d.stage === 'lost') continue;
    if (d.followUpDate)
      items.push({ id: `fu_${d.id}`, date: d.followUpDate, label: `Follow up: ${d.brand}`, kind: 'followup', area: 'marketing' });
    if (d.deliverableDue)
      items.push({ id: `del_${d.id}`, date: d.deliverableDue, label: `Deliverable: ${d.brand}`, kind: 'deadline', area: 'marketing' });
  }
  const nextReview = addDays(startOfWeek(nowISO), 7);
  items.push({ id: 'weekly_review', date: nextReview, label: 'Weekly review', kind: 'review', area: 'admin' });

  return items
    .filter((i) => i.date >= nowISO && i.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------ trends ------------------------------ */

export interface TrendWeek {
  week: string;
  label: string;
  sessions: number;
  minutes: number;
  tasksDone: number;
  practiceAttempts: number;
  contentPublished: number;
  milestones: number;
  outreach: number;
}

export function weeklyTrends(data: AppData, weeks = 8, nowISO = todayISO()): TrendWeek[] {
  const keys = lastNWeeks(weeks, new Date(nowISO));
  return keys.map((week) => {
    const start = week;
    const end = addDays(week, 6);
    const inRange = (d?: string) => Boolean(d) && d! >= start && d! <= end;
    const sessions = data.sessions.filter((s) => inRange(s.date));
    const content = data.content.filter((c) => c.stage === 'published' && inRange(c.publishedDate));
    return {
      week,
      label: `${week.slice(8, 10)}/${week.slice(5, 7)}`,
      sessions: sessions.length,
      minutes: sessions.reduce((s, x) => s + x.minutes, 0),
      tasksDone: data.tasks.filter((t) => t.status === 'done' && inRange(t.completedAt)).length,
      practiceAttempts: data.practiceLogs.filter((p) => inRange(p.date)).reduce((s, p) => s + p.attempted, 0),
      contentPublished: content.length,
      milestones: data.milestones.filter((m) => m.status === 'done' && inRange(m.completedAt)).length,
      outreach: data.deals.filter((d) => inRange(d.outreachDate)).length,
    };
  });
}

export function trackSummaries(data: AppData) {
  return (['dsa', 'ml', 'genai'] as const).map((id) => {
    const topics = data.topics.filter((t) => t.trackId === id);
    return {
      id,
      progress: trackProgress(topics),
      learning: currentlyLearning(topics),
      next: nextTopics(topics, 2),
      done: topics.filter((t) => !t.archived && t.status === 'done'),
    };
  });
}

export function thisWeekKey(nowISO = todayISO()) {
  return weekKey(nowISO);
}

export function publishedContent(data: AppData): ContentItem[] {
  return data.content.filter((c) => c.stage === 'published');
}
