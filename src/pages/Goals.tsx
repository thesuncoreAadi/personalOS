import { useMemo, useState } from 'react';
import type { AppData, AreaId, Goal, Horizon, Milestone } from '../types';
import { AREA_LABELS } from '../types';
import { actions, useStore } from '../state/store';
import { addMonths, deadlineLabel, deadlineTone, fmtDate, pct, todayISO } from '../lib/date';
import { goalHealth, goalProgress, nextMilestone, timeElapsed } from '../domain/progress';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DeadlineChip,
  Empty,
  Field,
  IconButton,
  Input,
  Metric,
  Modal,
  Note,
  Progress,
  Segmented,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from '../components/ui';
import { IconEdit, IconPlus, IconTrash } from '../components/icons';
import { EvidenceList } from '../components/tasks';

type Draft = Omit<Goal, 'id' | 'createdAt' | 'history'>;

function blankDraft(): Draft {
  const today = todayISO();
  return {
    area: 'technical',
    horizon: '90d',
    title: '',
    outcome: '',
    measurement: '',
    startDate: today,
    targetDate: addMonths(today, 3),
    status: 'in_progress',
    manualProgress: 0,
    manualOverride: false,
    weeklyTarget: '',
    indicator: 'lagging',
    evidence: [],
    dependencies: [],
    notes: '',
    seeded: false,
  };
}

export function Goals() {
  const data = useStore((s) => s.data);
  const toast = useToast();
  const [horizon, setHorizon] = useState<'all' | Horizon>('all');
  const [area, setArea] = useState<'all' | AreaId>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);

  const goals = useMemo(
    () =>
      data.goals
        .filter((g) => g.status !== 'archived')
        .filter((g) => (horizon === 'all' ? true : g.horizon === horizon))
        .filter((g) => (area === 'all' ? true : g.area === area))
        .sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
    [data.goals, horizon, area],
  );

  const selected = data.goals.find((g) => g.id === selectedId) ?? goals[0] ?? null;
  const today = todayISO();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-sub">
            90-day and 6-month outcomes. Every goal needs a specific outcome, a measurement method, a target date,
            weighted milestones and evidence. Progress is never inferred from elapsed time.
          </p>
        </div>
        <div className="page-actions">
          <Segmented
            ariaLabel="Horizon filter"
            value={horizon}
            options={[
              { value: 'all', label: 'All' },
              { value: '90d', label: '90-day' },
              { value: '6m', label: '6-month' },
            ]}
            onChange={setHorizon}
          />
          <Select value={area} onChange={(e) => setArea(e.target.value as typeof area)} style={{ width: 170 }}>
            <option value="all">All areas</option>
            <option value="technical">Technical</option>
            <option value="academics">Academics & Career</option>
            <option value="marketing">Marketing & Content</option>
          </Select>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <IconPlus size={13} /> New goal
          </Button>
        </div>
      </div>

      {goals.length === 0 ? (
        <Empty
          title="No goals in this view"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> Create a goal
            </Button>
          }
        >
          A goal without a measurement method is a wish. Start with the outcome you can observe in 90 days.
        </Empty>
      ) : (
        <div className="grid grid-main">
          <div className="stack">
            {goals.map((g) => {
              const p = goalProgress(g, data.milestones);
              const h = goalHealth(g, data.milestones, today);
              const active = selected?.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className="card"
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: 'inherit',
                    padding: 12,
                    border: active ? '1px solid var(--accent)' : undefined,
                    background: active ? 'var(--accent-soft)' : undefined,
                  }}
                  aria-current={active ? 'true' : undefined}
                >
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    <Badge tone={g.horizon === '90d' ? 'accent' : 'info'}>{g.horizon === '90d' ? '90-day' : '6-month'}</Badge>
                    <Badge>{AREA_LABELS[g.area]}</Badge>
                    {g.northStar && <Badge tone="accent">North Star</Badge>}
                    {g.seeded && <Badge tone="plain">demo proposal</Badge>}
                    <div className="spacer" />
                    <StatusBadge status={h.health} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{g.title}</div>
                  <div className="mt-8">
                    <Progress
                      value={p.value}
                      marker={timeElapsed(g.startDate, g.targetDate, today)}
                      tone={h.health === 'overdue' ? 'danger' : h.health === 'at_risk' ? 'warn' : 'accent'}
                      label={`${g.title} progress`}
                    />
                  </div>
                  <div className="row-wrap" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
                    <span>
                      {p.doneCount}/{p.itemCount} milestones
                    </span>
                    <span>·</span>
                    <span>target {fmtDate(g.targetDate)}</span>
                    <span>·</span>
                    <span>{g.indicator === 'leading' ? 'leading indicator' : 'lagging outcome'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <GoalDetail
              goal={selected}
              data={data}
              onEdit={() => setEditing(selected)}
              onDelete={() => setConfirmDelete(selected)}
              onPin={() => {
                useStore.getState().update((d) => {
                  d.goals = d.goals.map((g) =>
                    g.horizon === selected.horizon ? { ...g, northStar: g.id === selected.id } : g,
                  );
                });
                toast({ title: 'Set as North Star', body: selected.title, tone: 'ok' });
              }}
            />
          )}
        </div>
      )}

      {(creating || editing) && (
        <GoalModal
          open
          data={data}
          goal={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete goal?"
        danger
        confirmLabel="Delete goal and its milestones"
        message={
          <>
            <strong>{confirmDelete?.title}</strong> and all of its milestones will be removed. Tasks linked to it stay
            but become unlinked. This cannot be undone.
          </>
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            actions.removeGoal(confirmDelete.id);
            setSelectedId(null);
            toast({ title: 'Goal deleted', body: confirmDelete.title, tone: 'warn' });
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GoalDetail({
  goal,
  data,
  onEdit,
  onDelete,
  onPin,
}: {
  goal: Goal;
  data: AppData;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const toast = useToast();
  const today = todayISO();
  const milestones = data.milestones
    .filter((m) => m.goalId === goal.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const p = goalProgress(goal, milestones);
  const health = goalHealth(goal, milestones, today);
  const next = nextMilestone(goal.id, data.milestones);
  const linkedTasks = data.tasks.filter((t) => t.goalId === goal.id);
  const [msDraft, setMsDraft] = useState({ title: '', dueDate: today, weight: 1, evidenceRequired: true });
  const [evidenceFor, setEvidenceFor] = useState<Milestone | null>(null);
  const [editingMs, setEditingMs] = useState<Milestone | null>(null);

  return (
    <div className="stack">
      <Card
        title={goal.title}
        subtitle={`${AREA_LABELS[goal.area]} · ${goal.horizon === '90d' ? '90-day' : '6-month'} · ${fmtDate(goal.startDate)} → ${fmtDate(goal.targetDate)}`}
        actions={
          <>
            {!goal.northStar && (
              <Button size="sm" onClick={onPin}>
                Set as North Star
              </Button>
            )}
            <Button size="sm" onClick={onEdit}>
              <IconEdit size={13} /> Edit
            </Button>
            <Button size="sm" variant="danger" onClick={onDelete}>
              <IconTrash size={13} />
            </Button>
          </>
        }
      >
        <div className="stack">
          {goal.seeded && (
            <Note>
              <strong>Demo proposal.</strong> This goal was seeded as a suggestion, not a commitment. Edit the outcome,
              targets and milestones to make it yours — or delete it.
            </Note>
          )}

          <div className="grid grid-3" style={{ gap: 12 }}>
            <Metric label="Progress" value={pct(p.value)} sub={`${p.doneCount}/${p.itemCount} milestones done`} />
            <Metric
              label="Timeline used"
              value={pct(timeElapsed(goal.startDate, goal.targetDate, today))}
              sub="shown separately, never counted as progress"
            />
            <Metric
              label="Next milestone"
              value={next ? deadlineLabel(next.dueDate) : '—'}
              sub={next ? next.title : 'all milestones closed'}
            />
          </div>

          <Progress
            value={p.value}
            marker={timeElapsed(goal.startDate, goal.targetDate, today)}
            tone={health.health === 'overdue' ? 'danger' : health.health === 'at_risk' ? 'warn' : 'accent'}
            label="Goal progress"
          />
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Progress = Σ(done milestone weight) ÷ Σ(all milestone weight). The vertical marker is how much of the
            calendar window has elapsed — the gap between the two is your real schedule risk. Status:{' '}
            <strong>{health.reason}</strong>.
          </p>

          <div className="kv-list">
            <div className="kv">
              <dt>Outcome</dt>
              <dd>{goal.outcome || '—'}</dd>
            </div>
            <div className="kv">
              <dt>Measured by</dt>
              <dd>{goal.measurement || '—'}</dd>
            </div>
            <div className="kv">
              <dt>Weekly target</dt>
              <dd>{goal.weeklyTarget || '—'}</dd>
            </div>
            <div className="kv">
              <dt>Indicator</dt>
              <dd>
                {goal.indicator === 'leading'
                  ? 'Leading — an input you control (sessions, publishes)'
                  : 'Lagging — an outcome that follows the inputs'}
              </dd>
            </div>
            <div className="kv">
              <dt>Depends on</dt>
              <dd>
                {goal.dependencies.length
                  ? goal.dependencies
                      .map((id) => data.goals.find((g) => g.id === id)?.title ?? 'unknown')
                      .join('; ')
                  : '—'}
              </dd>
            </div>
          </div>

          {goal.notes && <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{goal.notes}</p>}

          <div>
            <div className="section-title">Goal-level evidence</div>
            <EvidenceList
              items={goal.evidence}
              emptyLabel="No links yet — add the artefact that proves this outcome."
              onAdd={(e) => {
                actions.updateGoal(goal.id, {
                  evidence: [...goal.evidence, { ...e, id: `ev_${Date.now()}`, createdAt: today }],
                });
                toast({ title: 'Evidence added', tone: 'ok' });
              }}
            />
          </div>

          <div className="divider" />

          <label className="row" style={{ gap: 8, fontSize: 12.5 }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={goal.manualOverride}
              onChange={(e) => actions.updateGoal(goal.id, { manualOverride: e.target.checked })}
            />
            Override progress manually (use when milestones cannot express the outcome)
          </label>
          {goal.manualOverride && (
            <div className="row" style={{ gap: 10 }}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(goal.manualProgress * 100)}
                onChange={(e) => actions.updateGoal(goal.id, { manualProgress: Number(e.target.value) / 100 })}
                style={{ flex: 1 }}
                aria-label="Manual progress percentage"
              />
              <Button
                size="xs"
                onClick={() =>
                  actions.recordGoalProgress(goal.id, goal.manualProgress, 'recorded from the goal page')
                }
              >
                Save to history
              </Button>
              <span className="progress-num">{Math.round(goal.manualProgress * 100)}%</span>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Milestones"
        subtitle="Weighted, evidence-gated intermediate deadlines. Weights decide how much each one moves the bar."
        actions={<Badge tone="accent">Total weight {milestones.reduce((s, m) => s + m.weight, 0)}</Badge>}
      >
        {milestones.length === 0 ? (
          <Empty title="No milestones yet">
            Break the outcome into 4–7 checkable steps with dates. Without them this goal has no measurable progress.
          </Empty>
        ) : (
          <div className="list">
            {milestones.map((m) => (
              <div className={`list-item ${m.status === 'done' ? 'done' : ''}`} key={m.id}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={m.status === 'done'}
                  aria-label={m.status === 'done' ? `Reopen ${m.title}` : `Complete ${m.title}`}
                  onChange={() => {
                    if (m.status === 'done') {
                      actions.undoMilestone(m.id);
                      toast({ title: 'Milestone reopened', body: m.title, tone: 'info' });
                    } else if (m.evidenceRequired && m.evidence.length === 0) {
                      setEvidenceFor(m);
                      toast({
                        title: 'Evidence required',
                        tone: 'warn',
                        body: 'This milestone is evidence-gated — record a link or a description first.',
                      });
                    } else {
                      actions.completeMilestone(m.id);
                      toast({
                        title: 'Milestone complete',
                        tone: 'ok',
                        body: m.title,
                        action: { label: 'Undo', run: () => actions.undoMilestone(m.id) },
                      });
                    }
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title" style={{ textDecoration: m.status === 'done' ? 'line-through' : undefined }}>
                    {m.title}
                  </div>
                  <div className="meta">
                    <DeadlineChip label={deadlineLabel(m.dueDate)} tone={deadlineTone(m.dueDate)} />
                    <Badge tone="info">weight {m.weight}</Badge>
                    {m.evidenceRequired && <Badge tone={m.evidence.length ? 'ok' : 'warn'}>evidence {m.evidence.length}</Badge>}
                    {m.seeded && <Badge>demo</Badge>}
                  </div>
                  {m.evidence.length > 0 && (
                    <div className="mt-8">
                      <EvidenceList items={m.evidence} />
                    </div>
                  )}
                </div>
                <div className="row" style={{ flex: 'none' }}>
                  <IconButton label="Add evidence" onClick={() => setEvidenceFor(m)}>
                    <IconPlus size={14} />
                  </IconButton>
                  <IconButton label="Edit milestone" onClick={() => setEditingMs(m)}>
                    <IconEdit size={14} />
                  </IconButton>
                  <IconButton
                    label="Delete milestone"
                    onClick={() => {
                      actions.removeMilestone(m.id);
                      toast({ title: 'Milestone deleted', body: m.title, tone: 'warn' });
                    }}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="divider" />
        <div className="section-title">Add milestone</div>
        <div className="form-grid">
          <Field label="Title" className="span-2">
            <Input
              value={msDraft.title}
              onChange={(e) => setMsDraft({ ...msDraft, title: e.target.value })}
              placeholder="e.g. Arrays, strings, hashing: 30 problems + write-up"
            />
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={msDraft.dueDate}
              onChange={(e) => setMsDraft({ ...msDraft, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Weight" help="Relative importance inside this goal.">
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={msDraft.weight}
              onChange={(e) => setMsDraft({ ...msDraft, weight: Number(e.target.value) })}
            />
          </Field>
        </div>
        <label className="row mt-8" style={{ gap: 8, fontSize: 12.5 }}>
          <input
            type="checkbox"
            className="checkbox"
            checked={msDraft.evidenceRequired}
            onChange={(e) => setMsDraft({ ...msDraft, evidenceRequired: e.target.checked })}
          />
          Require evidence before this milestone can be closed
        </label>
        <div className="mt-12">
          <Button
            variant="primary"
            disabled={!msDraft.title.trim() || msDraft.weight <= 0}
            onClick={() => {
              actions.addMilestone({
                goalId: goal.id,
                title: msDraft.title.trim(),
                dueDate: msDraft.dueDate,
                weight: msDraft.weight,
                status: 'pending',
                evidenceRequired: msDraft.evidenceRequired,
                note: '',
                seeded: false,
              });
              setMsDraft({ ...msDraft, title: '' });
              toast({ title: 'Milestone added', tone: 'ok' });
            }}
          >
            <IconPlus size={13} /> Add milestone
          </Button>
        </div>
      </Card>

      <Card title="Tasks linked to this goal" subtitle="Concrete actions that move the milestones">
        {linkedTasks.length === 0 ? (
          <Empty title="No tasks linked">Create tasks from Tasks & Calendar and link them to this goal.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th className="num">Est.</th>
                </tr>
              </thead>
              <tbody>
                {linkedTasks.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>{t.deadline ? <DeadlineChip label={deadlineLabel(t.deadline)} tone={deadlineTone(t.deadline)} /> : '—'}</td>
                    <td className="num">{t.estimatedMinutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {goal.history.length > 0 && (
        <Card title="Progress history">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Value</th>
                  <th>Source</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...goal.history].reverse().map((h) => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td className="num">{Math.round(h.value * 100)}%</td>
                    <td>{h.source}</td>
                    <td>{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {evidenceFor && (
        <Modal
          open
          onClose={() => setEvidenceFor(null)}
          title="Record evidence"
          size="sm"
          footer={
            <Button onClick={() => setEvidenceFor(null)}>Close</Button>
          }
        >
          <div className="stack">
            <p style={{ fontSize: 13 }}>{evidenceFor.title}</p>
            <EvidenceList
              items={evidenceFor.evidence}
              onAdd={(e) => {
                actions.addMilestoneEvidence(evidenceFor.id, e);
                toast({ title: 'Evidence saved', tone: 'ok' });
                setEvidenceFor(null);
              }}
            />
            <Note>
              Once evidence exists, closing this milestone credits its full weight. Without evidence it credits only
              60% and the goal card flags it.
            </Note>
          </div>
        </Modal>
      )}

      {editingMs && <MilestoneModal milestone={editingMs} onClose={() => setEditingMs(null)} />}
    </div>
  );
}

function MilestoneModal({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const [draft, setDraft] = useState(milestone);
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit milestone"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.updateMilestone(milestone.id, {
                title: draft.title,
                dueDate: draft.dueDate,
                weight: draft.weight,
                evidenceRequired: draft.evidenceRequired,
                note: draft.note,
              });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Title">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <div className="form-grid">
          <Field label="Due date">
            <Input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
          </Field>
          <Field label="Weight">
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={draft.weight}
              onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Note">
          <Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </Field>
        <label className="row" style={{ gap: 8, fontSize: 12.5 }}>
          <input
            type="checkbox"
            className="checkbox"
            checked={draft.evidenceRequired}
            onChange={(e) => setDraft({ ...draft, evidenceRequired: e.target.checked })}
          />
          Require evidence
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function GoalModal({
  open,
  data,
  goal,
  onClose,
}: {
  open: boolean;
  data: AppData;
  goal?: Goal;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => (goal ? { ...goal } : blankDraft()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msTitles, setMsTitles] = useState('');

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function validate() {
    const e: Record<string, string> = {};
    if (!draft.title.trim()) e.title = 'Give the goal a short, specific name.';
    if (!draft.outcome.trim()) e.outcome = 'Describe the observable outcome — what will exist that does not today?';
    if (!draft.measurement.trim()) e.measurement = 'How will you measure it? Without this the goal is a wish.';
    if (!draft.startDate) e.startDate = 'Start date is required.';
    if (!draft.targetDate) e.targetDate = 'Target date is required.';
    if (draft.startDate && draft.targetDate && draft.targetDate <= draft.startDate)
      e.targetDate = 'Target date must be after the start date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = { ...draft, title: draft.title.trim(), outcome: draft.outcome.trim(), measurement: draft.measurement.trim() };
    if (goal) {
      actions.updateGoal(goal.id, payload);
      toast({ title: 'Goal updated', tone: 'ok', body: payload.title });
    } else {
      const created = actions.addGoal(payload);
      const titles = msTitles
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
      titles.forEach((title, i) => {
        actions.addMilestone({
          goalId: created.id,
          title,
          dueDate: addMonths(created.startDate, Math.min(6, i + 1)),
          weight: 1,
          status: 'pending',
          evidenceRequired: true,
          note: '',
          seeded: false,
        });
      });
      toast({
        title: 'Goal created',
        tone: 'ok',
        body: titles.length
          ? `${titles.length} milestone(s) added — edit their dates and weights.`
          : 'Add milestones next: without them this goal has no measurable progress.',
      });
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {goal ? 'Save goal' : 'Create goal'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Goal name" required error={errors.title} className="span-2">
          <Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Ship one applied ML project end-to-end" />
        </Field>

        <Field label="Horizon">
          <Select
            value={draft.horizon}
            onChange={(e) => {
              const h = e.target.value as Horizon;
              set('horizon', h);
              set('targetDate', addMonths(draft.startDate, h === '90d' ? 3 : 6));
            }}
          >
            <option value="90d">90-day</option>
            <option value="6m">6-month</option>
          </Select>
        </Field>

        <Field label="Area">
          <Select value={draft.area} onChange={(e) => set('area', e.target.value as AreaId)}>
            <option value="technical">Technical</option>
            <option value="academics">Academics & Career</option>
            <option value="marketing">Marketing & Content</option>
          </Select>
        </Field>

        <Field label="Specific outcome" required error={errors.outcome} className="span-2" help="What will be true that is not true today?">
          <Textarea value={draft.outcome} onChange={(e) => set('outcome', e.target.value)} />
        </Field>

        <Field label="Measurement method" required error={errors.measurement} className="span-2" help="Where the number comes from: practice log, published count, exam marks, CRM.">
          <Input value={draft.measurement} onChange={(e) => set('measurement', e.target.value)} />
        </Field>

        <Field label="Start date" required error={errors.startDate}>
          <Input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>

        <Field label="Target date" required error={errors.targetDate}>
          <Input type="date" value={draft.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </Field>

        <Field label="Weekly target" className="span-2" help="The repeatable input that drives this goal.">
          <Input value={draft.weeklyTarget} onChange={(e) => set('weeklyTarget', e.target.value)} placeholder="e.g. 12 problems attempted, 8 solved independently" />
        </Field>

        <Field label="Indicator type" help="Leading = input you control. Lagging = outcome that follows.">
          <Select value={draft.indicator} onChange={(e) => set('indicator', e.target.value as 'leading' | 'lagging')}>
            <option value="leading">Leading indicator</option>
            <option value="lagging">Lagging outcome</option>
          </Select>
        </Field>

        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value as Goal['status'])}>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="at_risk">At risk</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>

        <Field label="Depends on" className="span-2">
          <Select
            multiple
            size={3}
            value={draft.dependencies}
            onChange={(e) => set('dependencies', Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {data.goals
              .filter((g) => g.id !== goal?.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </Select>
        </Field>

        {!goal && (
          <Field
            label="Milestones (one per line)"
            className="span-2"
            help="Optional. Each becomes an evidence-gated milestone with weight 1 — edit dates afterwards."
          >
            <Textarea
              value={msTitles}
              onChange={(e) => setMsTitles(e.target.value)}
              placeholder={'Fundamentals: 20 problems logged\nArrays & hashing: 30 problems\n…'}
            />
          </Field>
        )}

        <Field label="Notes" className="span-2">
          <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
