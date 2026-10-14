import { useMemo } from 'react';
import type { AppData } from '../types';
import { AREA_LABELS } from '../types';
import { useStore } from '../state/store';
import { addDays, daysUntil, fmtDate, fmtDuration, pct, todayISO } from '../lib/date';
import { areaCards, northStars, upcoming, weeklyTrends } from '../domain/overview';

import { dealFunnel, engagementRate, metricTotals } from '../domain/metrics';
import { BarChart, FunnelBar, LineChart } from '../components/charts';
import { Badge, Button, Card, Empty, Metric, Progress, StatusBadge } from '../components/ui';
import { IconCalendar, IconCheck, IconClock, IconTarget } from '../components/icons';
import { QuickSessionLog, SleepPanel, TodayPanel } from '../components/TodayPanel';
import type { RouteId } from '../lib/router';

const HEALTH_TONE = {
  on_track: 'ok',
  at_risk: 'warn',
  overdue: 'danger',
  completed: 'accent',
  not_started: 'plain',
} as const;

export function Overview({ navigate }: { navigate: (r: RouteId) => void }) {
  const data = useStore((s) => s.data);
  const today = todayISO();

  const stars = useMemo(() => northStars(data, today), [data, today]);
  const cards = useMemo(() => areaCards(data, today), [data, today]);
  const next = useMemo(() => upcoming(data, today, 21), [data, today]);
  const trends = useMemo(() => weeklyTrends(data, 8, today), [data, today]);

  const firstLoad = data.goals.length === 0 && data.tasks.length === 0;

  if (firstLoad) {
    return (
      <div className="stack">
        <PageHead />
        <Empty
          title="Your command centre is empty"
          action={
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => useStore.getState().loadDemoData('replace')}>
                Load demo workspace
              </Button>
              <Button onClick={() => navigate('goals')}>Start with a 90-day goal</Button>
            </div>
          }
        >
          Everything here is derived from real records — goals with milestones, tasks, practice logs and evidence.
          Load the labelled demo workspace to see how it works, or create your first goal.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead />
      <NorthStar stars={stars} navigate={navigate} />

      <div className="grid grid-3">
        {cards.map((c) => (
          <Card key={c.area} className="area-card">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row">
                <h2>{AREA_LABELS[c.area]}</h2>
                <div className="spacer" />
                <Badge tone={HEALTH_TONE[c.health]} dot>
                  {c.health === 'on_track'
                    ? 'On track'
                    : c.health === 'at_risk'
                      ? 'At risk'
                      : c.health === 'overdue'
                        ? 'Overdue'
                        : c.health === 'completed'
                          ? 'Completed'
                          : 'Not started'}
                </Badge>
              </div>

              <Progress value={c.progress} label={`${AREA_LABELS[c.area]} outcome progress`} tone={HEALTH_TONE[c.health] === 'danger' ? 'danger' : HEALTH_TONE[c.health] === 'warn' ? 'warn' : 'accent'} />
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {c.components.map((x) => `${x.label} ${Math.round(x.value * 100)}% (w${x.weight})`).join(' · ') ||
                  'No weighted components yet'}
              </div>

              <div className="kv-list">
                <div className="kv">
                  <dt>Current milestone</dt>
                  <dd>{c.currentMilestone ? c.currentMilestone.title : '—'}</dd>
                </div>
                <div className="kv">
                  <dt>Next task</dt>
                  <dd>{c.nextTask ? c.nextTask.title : '—'}</dd>
                </div>
                <div className="kv">
                  <dt>Next deadline</dt>
                  <dd>
                    {c.nextDeadline ? (
                      <>
                        {c.nextDeadline.label} · {fmtDate(c.nextDeadline.date)}
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.headline}</p>
              <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Status reason: {c.healthReason}</p>

              <Button
                size="sm"
                onClick={() =>
                  navigate(c.area === 'technical' ? 'technical' : c.area === 'academics' ? 'academics' : 'marketing')
                }
              >
                Open {AREA_LABELS[c.area]}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-main">
        <TodayPanel data={data} />
        <div className="stack">
          <QuickSessionLog data={data} />
          <UpcomingCard items={next} navigate={navigate} />
          <SleepPanel data={data} />
        </div>
      </div>

      <TrendsCard data={data} trends={trends} />
      <EvidenceStrip data={data} />
    </div>
  );
}

function PageHead() {
  const data = useStore((s) => s.data);
  const today = todayISO();
  const openTasks = data.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length;
  const overdue = data.tasks.filter((t) => t.deadline && t.deadline < today && t.status !== 'done').length;
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Overview</h1>
        <p className="page-sub">
          What outcome am I working toward · what is the best task for my time and energy right now · what evidence
          proves progress.
        </p>
      </div>
      <div className="page-actions">
        <Badge>
          <IconCalendar size={12} /> {fmtDate(today)}
        </Badge>
        <Badge tone={overdue > 0 ? 'danger' : 'plain'}>
          {overdue > 0 ? `${overdue} overdue` : 'nothing overdue'}
        </Badge>
        <Badge>
          <IconCheck size={12} /> {openTasks} open tasks
        </Badge>
      </div>
    </div>
  );
}

function NorthStar({
  stars,
  navigate,
}: {
  stars: ReturnType<typeof northStars>;
  navigate: (r: RouteId) => void;
}) {
  const today = todayISO();
  const blocks = [
    { label: '90-day objective', detail: stars.d90 },
    { label: '6-month objective', detail: stars.d6m },
  ];
  return (
    <Card
      title="North Star"
      subtitle="Progress here comes from verified milestones only — elapsed time is shown separately and never counted as progress."
      actions={
        <Button size="sm" onClick={() => navigate('goals')}>
          Manage goals
        </Button>
      }
    >
      <div className="grid grid-2" style={{ gap: 16 }}>
        {blocks.map((b) => (
          <div key={b.label} className="stack" style={{ gap: 8 }}>
            <div className="row">
              <span className="section-title" style={{ margin: 0 }}>
                {b.label}
              </span>
              {b.detail?.goal.northStar && <Badge tone="accent">Pinned</Badge>}
              <div className="spacer" />
              {b.detail && <StatusBadge status={b.detail.health.health} />}
            </div>
            {b.detail ? (
              <>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>{b.detail.goal.title}</div>
                <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{b.detail.goal.outcome}</p>
                <Progress
                  value={b.detail.progress.value}
                  tone={b.detail.health.health === 'overdue' ? 'danger' : b.detail.health.health === 'at_risk' ? 'warn' : 'accent'}
                  label={`${b.label} progress`}
                />
                <div className="row-wrap" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  <span>
                    {b.detail.progress.doneCount}/{b.detail.progress.itemCount} milestones done
                  </span>
                  <span>·</span>
                  <span>
                    timeline used{' '}
                    {pct(
                      Math.max(
                        0,
                        Math.min(
                          1,
                          (Date.parse(today) - Date.parse(b.detail.goal.startDate)) /
                            Math.max(1, Date.parse(b.detail.goal.targetDate) - Date.parse(b.detail.goal.startDate)),
                        ),
                      ),
                    )}
                  </span>
                  <span>·</span>
                  <span>target {fmtDate(b.detail.goal.targetDate)}</span>
                </div>
                <div className="kv-list">
                  <div className="kv">
                    <dt>Measured by</dt>
                    <dd>{b.detail.goal.measurement || 'not specified yet'}</dd>
                  </div>
                  <div className="kv">
                    <dt>Next milestone</dt>
                    <dd>
                      {b.detail.nextMilestone
                        ? `${b.detail.nextMilestone.title} · ${fmtDate(b.detail.nextMilestone.dueDate)} (${daysUntil(b.detail.nextMilestone.dueDate)}d)`
                        : 'all milestones closed'}
                    </dd>
                  </div>
                  <div className="kv">
                    <dt>Weekly target</dt>
                    <dd>{b.detail.goal.weeklyTarget || '—'}</dd>
                  </div>
                  <div className="kv">
                    <dt>Indicator type</dt>
                    <dd>{b.detail.goal.indicator === 'leading' ? 'Leading (input)' : 'Lagging (outcome)'}</dd>
                  </div>
                </div>
                {b.detail.progress.unverified.length > 0 && (
                  <div className="note warn">
                    <strong>Credited partially:</strong> {b.detail.progress.unverified.join(', ')} — marked complete
                    without evidence, so only 60% of their weight counts.
                  </div>
                )}
              </>
            ) : (
              <Empty title={`No ${b.label} yet`}>
                Create one in Goals. It needs an outcome, a measurement method, a target date and weighted milestones.
              </Empty>
            )}
          </div>
        ))}
      </div>

      <div className="card-foot">
        <div className="row-wrap">
          <Badge tone="accent">
            <IconTarget size={12} /> Overall {pct(stars.overall)}
          </Badge>
          <span>
            Overall = average of the two north-star goals, each computed as Σ(done milestone weight) ÷ Σ(all milestone
            weight). Weights are editable per milestone.
          </span>
        </div>
      </div>
    </Card>
  );
}

function UpcomingCard({
  items,
  navigate,
}: {
  items: ReturnType<typeof upcoming>;
  navigate: (r: RouteId) => void;
}) {
  const kindLabel: Record<string, string> = {
    deadline: 'Deadline',
    milestone: 'Milestone',
    exam: 'Exam',
    publish: 'Publish',
    review: 'Review',
    followup: 'Follow-up',
  };
  const toneFor: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'plain'> = {
    deadline: 'warn',
    milestone: 'accent',
    exam: 'danger',
    publish: 'info',
    review: 'plain',
    followup: 'info',
  };
  return (
    <Card
      title="Upcoming 21 days"
      subtitle="Deadlines, milestones, exams, publishing and reviews"
      actions={
        <Button size="sm" variant="ghost" onClick={() => navigate('tasks')}>
          Calendar
        </Button>
      }
      bodyClass="tight"
    >
      {items.length === 0 ? (
        <Empty title="Nothing scheduled">Add deadlines to tasks and milestones to populate this list.</Empty>
      ) : (
        <div className="list">
          {items.slice(0, 12).map((i) => {
            const d = daysUntil(i.date);
            return (
              <div className="list-item" key={i.id}>
                <div style={{ width: 46, flex: 'none', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {i.date.slice(8, 10)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                    {fmtDate(i.date).slice(0, 3)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{i.label}</div>
                  <div className="meta">
                    <Badge tone={toneFor[i.kind]}>{kindLabel[i.kind]}</Badge>
                    <span>{AREA_LABELS[i.area as keyof typeof AREA_LABELS] ?? i.area}</span>
                    {i.detail && <span>{i.detail.slice(0, 40)}</span>}
                  </div>
                </div>
                <Badge tone={d <= 2 ? 'danger' : d <= 7 ? 'warn' : 'plain'}>
                  {d === 0 ? 'today' : `${d}d`}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TrendsCard({ data, trends }: { data: AppData; trends: ReturnType<typeof weeklyTrends> }) {
  const labels = trends.map((t) => t.label);
  const thisWeek = trends[trends.length - 1];
  const lastWeek = trends[trends.length - 2];
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? '↑ new' : '—') : `${a >= b ? '+' : ''}${a - b}`);

  const allMetrics = data.accounts.flatMap((a) => a.metrics);
  const totals = metricTotals(allMetrics.slice(-8));
  const er = engagementRate(totals);

  return (
    <Card
      title="Progress trends"
      subtitle="Inputs, outputs and outcomes kept separate — activity alone is not progress."
      actions={
        <div className="row" style={{ gap: 6 }}>
          <Badge tone="info">Inputs</Badge>
          <Badge tone="accent">Outputs</Badge>
          <Badge tone="ok">Outcomes</Badge>
        </div>
      }
    >
      <div className="metric-grid mb-12">
        <Metric
          label="Focused sessions (7d)"
          value={thisWeek?.sessions ?? 0}
          sub={`${fmtDuration(thisWeek?.minutes ?? 0)} · ${delta(thisWeek?.sessions ?? 0, lastWeek?.sessions ?? 0)} vs last week`}
        />
        <Metric
          label="Deliverables done (7d)"
          value={(thisWeek?.tasksDone ?? 0) + (thisWeek?.milestones ?? 0)}
          sub={`${thisWeek?.tasksDone ?? 0} tasks · ${thisWeek?.milestones ?? 0} milestones`}
        />
        <Metric
          label="Practice attempts (7d)"
          value={thisWeek?.practiceAttempts ?? 0}
          sub={`${delta(thisWeek?.practiceAttempts ?? 0, lastWeek?.practiceAttempts ?? 0)} vs last week`}
        />
        <Metric
          label="Content published (7d)"
          value={thisWeek?.contentPublished ?? 0}
          sub={`${data.content.filter((c) => c.stage === 'published').length} lifetime`}
        />
        <Metric
          label="Outreach sent (7d)"
          value={thisWeek?.outreach ?? 0}
          sub={`${data.deals.filter((d) => d.outreachDate).length} lifetime`}
        />
        <Metric
          label="Engagement rate (recent)"
          value={er === null ? 'n/a' : `${er.toFixed(1)}%`}
          sub={er === null ? 'no reach recorded' : '(likes+comments+shares+saves) ÷ reach'}
        />
      </div>

      <div className="grid grid-2" style={{ gap: 16 }}>
        <div>
          <div className="section-title">Inputs — focused sessions & practice attempts</div>
          <BarChart
            labels={labels}
            series={[
              { label: 'Sessions', values: trends.map((t) => t.sessions) },
              { label: 'Practice attempts', values: trends.map((t) => t.practiceAttempts) },
            ]}
          />
        </div>
        <div>
          <div className="section-title">Outputs — deliverables & content published</div>
          <BarChart
            labels={labels}
            series={[
              { label: 'Tasks done', values: trends.map((t) => t.tasksDone), color: 'var(--accent)' },
              { label: 'Milestones', values: trends.map((t) => t.milestones), color: 'var(--info)' },
              { label: 'Content', values: trends.map((t) => t.contentPublished), color: 'var(--warn)' },
            ]}
          />
        </div>
      </div>

      <div className="mt-16">
        <div className="section-title">Outcomes — outcome progress over the last 8 weeks (from milestone history)</div>
        <OutcomeTrend data={data} weeks={labels.length} />
      </div>
    </Card>
  );
}

function OutcomeTrend({ data, weeks }: { data: AppData; weeks: number }) {
  const today = todayISO();
  const labels: string[] = [];
  const series: number[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = addDays(today, -i * 7);
    labels.push(`${d.slice(8, 10)}/${d.slice(5, 7)}`);
    const active = data.goals.filter((g) => g.status !== 'archived' && g.startDate <= d);
    if (active.length === 0) {
      series.push(0);
      continue;
    }
    // reconstruct progress as of that date from milestone completion dates
    const avg =
      active.reduce((sum, g) => {
        const ms = data.milestones.filter((m) => m.goalId === g.id);
        const total = ms.reduce((s, m) => s + m.weight, 0);
        const earned = ms
          .filter((m) => m.status === 'done' && m.completedAt && m.completedAt <= d)
          .reduce((s, m) => s + m.weight * (m.evidenceRequired && m.evidence.length === 0 ? 0.6 : 1), 0);
        return sum + (total > 0 ? earned / total : 0);
      }, 0) / active.length;
    series.push(avg);
  }
  return (
    <LineChart
      labels={labels}
      series={[{ label: 'Outcome progress', values: series }]}
      yFormat={(v) => `${Math.round(v * 100)}%`}
    />
  );
}

function EvidenceStrip({ data }: { data: AppData }) {
  const recent = data.events.slice(0, 8);
  const funnel = dealFunnel(
    data.deals,
    data.content.filter((c) => c.kind === 'portfolio_ad' && c.stage === 'published').length,
  );
  return (
    <div className="grid grid-2">
      <Card title="Recent evidence of progress" subtitle="Everything that changed a meaningful number">
        {recent.length === 0 ? (
          <Empty title="No recorded evidence yet">
            Completing evidence-based milestones, publishing content, logging practice and closing deals all appear
            here.
          </Empty>
        ) : (
          <div className="list">
            {recent.map((e) => (
              <div className="list-item" key={e.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{e.title}</div>
                  <div className="meta">
                    <Badge tone={e.kind === 'milestone' ? 'accent' : e.kind === 'deal' ? 'ok' : 'info'}>{e.kind}</Badge>
                    <span>{e.date}</span>
                    {e.note && <span>{e.note}</span>}
                  </div>
                </div>
                {e.evidence && (
                  <a href={e.evidence} target="_blank" rel="noreferrer noopener">
                    <Badge tone="accent">
                      <IconClock size={11} /> proof
                    </Badge>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Commercial funnel" subtitle="Published content → engagement → interest → outreach → paid">
        <FunnelBar
          steps={[
            { label: 'Published pieces', value: data.content.filter((c) => c.stage === 'published').length },
            { label: 'Inbound inquiries', value: metricTotals(data.accounts.flatMap((a) => a.metrics)).inquiries },
            { label: 'Outreach sent', value: funnel.outreach },
            { label: 'Replies', value: funnel.replied },
            { label: 'Negotiating', value: funnel.negotiating },
            { label: 'Paid deals', value: funnel.won },
          ]}
        />
        <div className="metric-grid mt-12">
          <Metric label="Revenue agreed" value={`₹${funnel.revenueAgreed.toLocaleString('en-IN')}`} />
          <Metric label="Revenue received" value={`₹${funnel.revenueReceived.toLocaleString('en-IN')}`} sub={`₹${funnel.outstanding.toLocaleString('en-IN')} outstanding`} />
          <Metric label="Portfolio ads" value={funnel.portfolioAdsDone} />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10 }}>
          Posting frequency does not guarantee brand deals. What this funnel measures is whether creative work is
          producing qualified interest.
        </p>
      </Card>
    </div>
  );
}
