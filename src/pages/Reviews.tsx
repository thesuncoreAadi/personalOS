import { useMemo, useState } from 'react';
import type { AppData, WeeklyReview } from '../types';
import { actions, useStore } from '../state/store';
import { addDays, endOfWeek, fmtDate, fmtDuration, pct, startOfWeek, todayISO } from '../lib/date';
import { examReadiness, gateStats, syllabusCoverage } from '../domain/progress';
import { dealFunnel, metricTotals } from '../domain/metrics';
import { upcoming } from '../domain/overview';
import { BarChart } from '../components/charts';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  IconButton,
  Input,
  Metric,
  Modal,
  Note,
  Progress,
  Select,
  Textarea,
  useToast,
} from '../components/ui';
import { IconEdit, IconPlus, IconTrash } from '../components/icons';

export function Reviews() {
  const data = useStore((s) => s.data);
  const today = todayISO();
  const thisWeek = startOfWeek(today);
  const [selectedWeek, setSelectedWeek] = useState(thisWeek);
  const [editing, setEditing] = useState<ReviewDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WeeklyReview | null>(null);

  const review = data.reviews.find((r) => r.weekStart === selectedWeek);
  const stats = useMemo(() => computeWeek(data, selectedWeek), [data, selectedWeek]);
  const weeks = useMemo(() => {
    const set = new Set<string>([thisWeek]);
    data.reviews.forEach((r) => set.add(r.weekStart));
    data.sessions.forEach((s) => set.add(startOfWeek(s.date)));
    return [...set].sort().reverse().slice(0, 12);
  }, [data, thisWeek]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Weekly review</h1>
          <p className="page-sub">
            Inputs, outputs and outcomes are kept separate — there is no single productivity score. Overall progress
            comes from weighted milestones and verifiable deliverables only.
          </p>
        </div>
        <div className="page-actions">
          <Select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            style={{ width: 200 }}
            aria-label="Select week"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week of {fmtDate(w)}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={() => setEditing(review ?? draftReview(selectedWeek))}>
            {review ? <><IconEdit size={13} /> Edit review</> : <><IconPlus size={13} /> Write review</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-3">
        <Card title="Inputs" subtitle="What you put in — sessions, attempts, outreach." bodyClass="tight">
          <div className="stack" style={{ gap: 10 }}>
            <Metric
              label="Focused sessions"
              value={`${stats.completedSessions}/${stats.plannedSessions}`}
              sub={`${fmtDuration(stats.minutes)} total`}
            />
            <Progress
              value={stats.plannedSessions > 0 ? stats.completedSessions / stats.plannedSessions : 0}
              label="Sessions vs plan"
            />
            <Metric label="Practice attempts" value={stats.practiceAttempts} sub={`${stats.independent} solved independently`} />
            <Metric label="Outreach messages" value={stats.outreach} />
          </div>
        </Card>

        <Card title="Outputs" subtitle="What was actually produced." bodyClass="tight">
          <div className="stack" style={{ gap: 10 }}>
            <Metric label="Deliverables completed" value={stats.tasksDone} sub="tasks closed this week" />
            <Metric label="Milestones closed" value={stats.milestonesDone} sub={`${stats.milestonesVerified} with evidence`} />
            <Metric label="Content published" value={stats.published} sub={`${stats.portfolioAds} portfolio ads`} />
            <Metric label="Assessments" value={stats.assessments} sub="timed papers / mocks recorded" />
          </div>
        </Card>

        <Card title="Outcomes" subtitle="Did it move anything that matters?" bodyClass="tight">
          <div className="stack" style={{ gap: 10 }}>
            <Metric
              label="Best mock / assessment"
              value={stats.bestAssessment === null ? 'n/a' : pct(stats.bestAssessment)}
              sub={stats.bestAssessment === null ? 'nothing recorded' : 'this week'}
            />
            <Metric
              label="Follower change"
              value={stats.followerDelta === null ? 'n/a' : `${stats.followerDelta >= 0 ? '+' : ''}${stats.followerDelta}`}
              sub="sum across accounts"
            />
            <Metric label="Qualified leads" value={stats.leads} sub="attributed to content" />
            <Metric
              label="Revenue agreed"
              value={`₹${stats.revenueAgreed.toLocaleString('en-IN')}`}
              sub={`₹${stats.revenueReceived.toLocaleString('en-IN')} received`}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Sessions per day this week" subtitle="Actual focused minutes recorded." bodyClass="tight">
          <BarChart
            labels={stats.days.map((d) => d.date.slice(8, 10))}
            series={[{ label: 'Minutes', values: stats.days.map((d) => d.minutes) }]}
            unit="m"
          />
        </Card>

        <Card title="Repeatedly postponed" subtitle="Tasks deferred more than once — these need a decision, not another nudge.">
          {stats.repeatedlyPostponed.length === 0 ? (
            <Empty title="Nothing stuck" />
          ) : (
            <div className="list">
              {stats.repeatedlyPostponed.map((t) => (
                <div className="list-item" key={t.id}>
                  <div style={{ flex: 1 }}>
                    <div className="title">{t.title}</div>
                    <div className="meta">
                      <Badge tone="warn">postponed {t.deferCount}×</Badge>
                      <span>{fmtDuration(t.estimatedMinutes)}</span>
                      <span>{t.energy} energy</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Academic status" subtitle="Deadlines ahead and the topics that are still weak.">
          {data.collegeSubjects.length === 0 ? (
            <Empty title="No subjects tracked" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="num">Coverage</th>
                    <th className="num">Readiness</th>
                    <th>Exam</th>
                    <th>Weak</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collegeSubjects.map((s) => {
                    const r = examReadiness(s, data.practiceLogs, today);
                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td className="num">{pct(syllabusCoverage(s).value)}</td>
                        <td className="num">{pct(r.value)}</td>
                        <td>{s.examDate ? fmtDate(s.examDate) : '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.weakTopics.slice(0, 3).join(', ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.mockTests.length > 0 && (
            <div className="mt-12">
              <Note>
                GATE: {gateStats(data.practiceLogs, data.mockTests, data.gateSubjects).pyqsAttempted} PYQs attempted
                overall, accuracy {pct(gateStats(data.practiceLogs, data.mockTests, data.gateSubjects).accuracy)},{' '}
                {data.mockTests.length} mocks recorded.
              </Note>
            </div>
          )}
        </Card>

        <Card title="Content & commercial" subtitle="What went out and what it produced.">
          <div className="metric-grid mb-12">
            <Metric label="Published this week" value={stats.published} />
            <Metric label="Interactions" value={stats.interactions.toLocaleString('en-IN')} />
            <Metric label="Inbound inquiries" value={stats.inquiries} />
            <Metric label="Deals in play" value={stats.activeDeals} />
          </div>
          {stats.publishedItems.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Nothing published in this window.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'grid', gap: 4 }}>
              {stats.publishedItems.map((c) => (
                <li key={c.id}>
                  {c.title} <span style={{ color: 'var(--text-3)' }}>· {c.kind === 'portfolio_ad' ? 'portfolio ad' : 'short-form'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Energy & sleep pattern" subtitle="Only if you logged it. Used to explain the week, never to grade it.">
        {stats.sleep.length === 0 ? (
          <Empty title="No sleep logs for this week">Optional — log it on the Overview page if you want the pattern.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Hours</th>
                  <th className="num">Quality</th>
                  <th>Energy</th>
                  <th className="num">Focused minutes</th>
                </tr>
              </thead>
              <tbody>
                {stats.sleep.map((s) => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td className="num">{s.hours}</td>
                    <td className="num">{s.quality}/5</td>
                    <td>{s.energy}</td>
                    <td className="num">{stats.minutesByDate[s.date] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Adjustments for next week"
        subtitle="Written down, not vibes. This is the only part of the review that changes behaviour."
        actions={
          review && (
            <IconButton label="Delete review" onClick={() => setConfirmDelete(review)}>
              <IconTrash size={13} />
            </IconButton>
          )
        }
      >
        {review ? (
          <div className="stack">
            <ReviewBlock label="Deliverables completed" text={review.deliverables} />
            <ReviewBlock label="Milestones achieved" text={review.milestones} />
            <ReviewBlock label="Learning assessments" text={review.assessments} />
            <ReviewBlock label="Academic notes" text={review.academicNotes} />
            <ReviewBlock label="Content & performance" text={review.contentNotes} />
            <ReviewBlock label="Commercial outcomes" text={review.commercialNotes} />
            <ReviewBlock label="Energy & sleep" text={review.energyNotes} />
            <ReviewBlock label="Repeatedly postponed" text={review.postponedTasks} />
            <div className="note">
              <strong>Next week's adjustments:</strong> {review.adjustments || 'not written yet'}
            </div>
          </div>
        ) : (
          <Empty
            title="No review written for this week"
            action={
              <Button variant="primary" onClick={() => setEditing(draftReview(selectedWeek))}>
                <IconPlus size={13} /> Write the review
              </Button>
            }
          >
            The numbers above are computed from your records. The written part is where you decide what changes.
          </Empty>
        )}
      </Card>

      <Card title="Coming up next week" subtitle="So the plan starts from reality, not from optimism.">
        {upcoming(data, addDays(selectedWeek, 7), 7).length === 0 ? (
          <Empty title="Nothing scheduled" />
        ) : (
          <div className="list">
            {upcoming(data, addDays(selectedWeek, 7), 7).map((i) => (
              <div className="list-item" key={i.id}>
                <div style={{ flex: 1 }}>
                  <div className="title">{i.label}</div>
                  <div className="meta">
                    <Badge>{i.kind}</Badge>
                    <span>{fmtDate(i.date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && <ReviewModal review={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete review?"
        danger
        confirmLabel="Delete"
        message="The computed numbers stay; only the written review is removed."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) actions.removeReview(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function ReviewBlock({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <div className="section-title">{label}</div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ReviewDraft = Omit<WeeklyReview, 'id' | 'createdAt'> & { id?: string };

function draftReview(weekStart: string): ReviewDraft {
  return {
    weekStart,
    plannedSessions: 0,
    completedSessions: 0,
    deliverables: '',
    milestones: '',
    assessments: '',
    academicNotes: '',
    contentNotes: '',
    commercialNotes: '',
    postponedTasks: '',
    energyNotes: '',
    adjustments: '',
  };
}

function computeWeek(data: AppData, weekStart: string) {
  const start = weekStart;
  const end = endOfWeek(weekStart);
  const inWeek = (d?: string) => Boolean(d) && d! >= start && d! <= end;

  const sessions = data.sessions.filter((s) => inWeek(s.date));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, minutes: sessions.filter((s) => s.date === date).reduce((m, s) => m + s.minutes, 0) };
  });

  const practice = data.practiceLogs.filter((p) => inWeek(p.date));
  const publishedItems = data.content.filter((c) => c.stage === 'published' && inWeek(c.publishedDate));
  const milestonesDone = data.milestones.filter((m) => m.status === 'done' && inWeek(m.completedAt));
  const metrics = data.accounts.flatMap((a) => a.metrics.filter((m) => inWeek(m.date)));
  const totals = metricTotals(metrics);
  const deals = data.deals;
  const funnel = dealFunnel(deals, 0);

  const sleep = data.sleepLogs.filter((s) => inWeek(s.date)).sort((a, b) => a.date.localeCompare(b.date));
  const assessments = [
    ...data.mockTests.filter((m) => inWeek(m.date)).map((m) => ({ max: m.max, score: m.score })),
    ...data.collegeSubjects.flatMap((s) => s.timedAssessments.filter((a) => inWeek(a.date))),
  ];
  const bestAssessment =
    assessments.length > 0
      ? Math.max(...assessments.map((a) => (a.max > 0 ? a.score / a.max : 0)))
      : null;

  const followersByAccount = data.accounts.map((a) => {
    const rows = a.metrics.filter((m) => m.date <= end).sort((x, y) => x.date.localeCompare(y.date));
    const before = rows.filter((m) => m.date < start);
    const during = rows.filter((m) => inWeek(m.date));
    if (during.length === 0) return 0;
    const baseline = before.length ? before[before.length - 1].followers : during[0].followers;
    return during[during.length - 1].followers - baseline;
  });

  return {
    plannedSessions: 10,
    completedSessions: sessions.length,
    minutes: sessions.reduce((s, x) => s + x.minutes, 0),
    minutesByDate: Object.fromEntries(days.map((d) => [d.date, d.minutes])) as Record<string, number>,
    days,
    practiceAttempts: practice.reduce((s, p) => s + p.attempted, 0),
    independent: practice.reduce((s, p) => s + p.solvedIndependently, 0),
    outreach: deals.filter((d) => inWeek(d.outreachDate)).length,
    tasksDone: data.tasks.filter((t) => t.status === 'done' && inWeek(t.completedAt)).length,
    milestonesDone: milestonesDone.length,
    milestonesVerified: milestonesDone.filter((m) => !m.evidenceRequired || m.evidence.length > 0).length,
    published: publishedItems.length,
    publishedItems,
    portfolioAds: publishedItems.filter((c) => c.kind === 'portfolio_ad').length,
    assessments: assessments.length,
    bestAssessment,
    followerDelta: followersByAccount.length ? followersByAccount.reduce((a, b) => a + b, 0) : null,
    interactions: totals.likes + totals.comments + totals.shares + totals.saves,
    inquiries: totals.inquiries,
    leads: totals.leads,
    activeDeals: deals.filter((d) => ['contacted', 'replied', 'negotiating'].includes(d.stage)).length,
    revenueAgreed: funnel.revenueAgreed,
    revenueReceived: funnel.revenueReceived,
    repeatedlyPostponed: data.tasks.filter((t) => t.deferCount >= 2 && t.status !== 'done'),
    sleep,
  };
}

/* ------------------------------------------------------------------ */

function ReviewModal({
  review,
  onClose,
}: {
  review: ReviewDraft;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(review);
  const set = (k: keyof typeof draft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Weekly review · ${fmtDate(draft.weekStart)}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.saveReview(draft);
              toast({ title: 'Review saved', tone: 'ok' });
              onClose();
            }}
          >
            Save review
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Planned focused sessions">
          <Input
            type="number"
            min={0}
            value={draft.plannedSessions}
            onChange={(e) => set('plannedSessions', Number(e.target.value))}
          />
        </Field>
        <Field label="Completed focused sessions">
          <Input
            type="number"
            min={0}
            value={draft.completedSessions}
            onChange={(e) => set('completedSessions', Number(e.target.value))}
          />
        </Field>
        <Field label="Deliverables completed" className="span-2">
          <Textarea value={draft.deliverables} onChange={(e) => set('deliverables', e.target.value)} />
        </Field>
        <Field label="Milestones achieved" className="span-2">
          <Textarea value={draft.milestones} onChange={(e) => set('milestones', e.target.value)} />
        </Field>
        <Field label="Learning assessment results" className="span-2">
          <Textarea value={draft.assessments} onChange={(e) => set('assessments', e.target.value)} />
        </Field>
        <Field label="Academic deadlines & weak topics" className="span-2">
          <Textarea value={draft.academicNotes} onChange={(e) => set('academicNotes', e.target.value)} />
        </Field>
        <Field label="Content published & performance" className="span-2">
          <Textarea value={draft.contentNotes} onChange={(e) => set('contentNotes', e.target.value)} />
        </Field>
        <Field label="Brand outreach & commercial outcomes" className="span-2">
          <Textarea value={draft.commercialNotes} onChange={(e) => set('commercialNotes', e.target.value)} />
        </Field>
        <Field label="Energy & sleep patterns" className="span-2">
          <Textarea value={draft.energyNotes} onChange={(e) => set('energyNotes', e.target.value)} />
        </Field>
        <Field label="Tasks repeatedly postponed" className="span-2">
          <Textarea value={draft.postponedTasks} onChange={(e) => set('postponedTasks', e.target.value)} />
        </Field>
        <Field label="Adjustments for next week" className="span-2" help="Be specific: which task moves where, what gets dropped.">
          <Textarea value={draft.adjustments} onChange={(e) => set('adjustments', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
