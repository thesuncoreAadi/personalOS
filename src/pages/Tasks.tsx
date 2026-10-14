import { useMemo, useState } from 'react';
import type { AppData, Task } from '../types';
import { SCOPE_LABELS } from '../types';
import { actions, useStore } from '../state/store';
import { addDays, deadlineLabel, deadlineTone, fmtDate, fmtDuration, startOfWeek, todayISO } from '../lib/date';
import { rankTasks } from '../domain/taskMatch';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DeadlineChip,
  Empty,
  IconButton,
  Input,
  Progress,
  Segmented,
  Select,
  Tabs,
  useToast,
} from '../components/ui';
import { IconEdit, IconPlus } from '../components/icons';
import { CompleteTaskDialog, RescheduleDialog, TaskList, TaskRow } from '../components/tasks';
import { TaskModal } from '../components/TaskModal';
import { TodayPanel } from '../components/TodayPanel';

type TabId = 'today' | 'all' | 'calendar' | 'deferred';

export function Tasks() {
  const data = useStore((s) => s.data);
  const [tab, setTab] = useState<TabId>('today');
  const today = todayISO();

  const open = data.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const overdue = open.filter((t) => t.deadline && t.deadline < today);
  const blocked = open.filter((t) => t.status === 'blocked');
  const deferred = open.filter((t) => t.deferCount > 0);
  const doneToday = data.tasks.filter((t) => t.status === 'done' && t.completedAt === today);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Tasks & Calendar</h1>
          <p className="page-sub">
            Recommendations adapt to your energy and your longest free block. Shuffle re-ranks; reschedule is a separate,
            confirmed action. Fixed commitments are never moved automatically.
          </p>
        </div>
        <div className="page-actions">
          <Badge tone={overdue.length ? 'danger' : 'ok'}>{overdue.length} overdue</Badge>
          <Badge tone={blocked.length ? 'warn' : 'plain'}>{blocked.length} blocked</Badge>
          <Badge tone={deferred.length ? 'warn' : 'plain'}>{deferred.length} postponed</Badge>
          <Badge>{doneToday.length} done today</Badge>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'all', label: 'All tasks' },
          { value: 'calendar', label: 'Week view' },
          { value: 'deferred', label: 'Postponed & blocked' },
        ]}
      />

      {tab === 'today' && <TodayPanel data={data} />}
      {tab === 'all' && <AllTasks data={data} />}
      {tab === 'calendar' && <WeekView data={data} />}
      {tab === 'deferred' && <DeferredTasks data={data} />}
    </div>
  );
}

/* ------------------------------- all tasks ------------------------------- */

type SortKey = 'deadline' | 'priority' | 'estimate' | 'created';

function AllTasks({ data }: { data: AppData }) {
  const toast = useToast();
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open');
  const [area, setArea] = useState<'all' | Task['area']>('all');
  const [energy, setEnergy] = useState<'all' | Task['energy']>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('deadline');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);

  const tasks = useMemo(() => {
    let list = data.tasks.filter((t) => {
      if (status === 'open') return t.status === 'todo' || t.status === 'in_progress' || t.status === 'blocked';
      if (status === 'done') return t.status === 'done' || t.status === 'dropped';
      return true;
    });
    if (area !== 'all') list = list.filter((t) => t.area === area);
    if (energy !== 'all') list = list.filter((t) => t.energy === energy);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => `${t.title} ${t.notes} ${t.finishCondition}`.toLowerCase().includes(q));
    }
    const pri = { P1: 0, P2: 1, P3: 2 } as const;
    return list.sort((a, b) => {
      if (sort === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
      if (sort === 'priority') return pri[a.priority] - pri[b.priority] || b.importance - a.importance;
      if (sort === 'estimate') return a.estimatedMinutes - b.estimatedMinutes;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [data.tasks, status, area, energy, query, sort]);

  const totalMinutes = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);

  return (
    <div className="stack">
      <Card
        title="Task list"
        subtitle={`${tasks.length} shown · ${fmtDuration(totalMinutes)} of estimated work`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <IconPlus size={13} /> New task
          </Button>
        }
      >
        <div className="row-wrap mb-12">
          <Segmented
            ariaLabel="Status filter"
            value={status}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'done', label: 'Completed' },
              { value: 'all', label: 'All' },
            ]}
            onChange={setStatus}
          />
          <Select value={area} onChange={(e) => setArea(e.target.value as typeof area)} style={{ width: 165 }} aria-label="Filter by area">
            <option value="all">All areas</option>
            {(Object.keys(SCOPE_LABELS) as Task['area'][]).map((a) => (
              <option key={a} value={a}>
                {SCOPE_LABELS[a]}
              </option>
            ))}
          </Select>
          <Select value={energy} onChange={(e) => setEnergy(e.target.value as typeof energy)} style={{ width: 140 }} aria-label="Filter by energy">
            <option value="all">Any energy</option>
            <option value="high">High energy</option>
            <option value="medium">Medium energy</option>
            <option value="low">Low energy</option>
            <option value="exhausted">Recovery</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ width: 155 }} aria-label="Sort tasks">
            <option value="deadline">Sort: deadline</option>
            <option value="priority">Sort: priority</option>
            <option value="estimate">Sort: shortest first</option>
            <option value="created">Sort: newest</option>
          </Select>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            style={{ minWidth: 180, flex: 1 }}
            aria-label="Search tasks"
          />
        </div>

        <TaskList
          tasks={tasks}
          data={data}
          onEdit={setEditing}
          onComplete={setCompleting}
          emptyTitle="No tasks match these filters"
          emptyBody="Change a filter, or create a task with a finish condition you can actually verify."
        />
      </Card>

      <TaskModal open={creating} data={data} onClose={() => setCreating(false)} />
      {editing && <TaskModal open data={data} task={editing} onClose={() => setEditing(null)} />}
      <CompleteTaskDialog
        task={completing}
        evidenceRequired={Boolean(completing?.evidenceRequired) && data.settings.evidencePrompt}
        onClose={() => setCompleting(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete task?"
        danger
        confirmLabel="Delete"
        message={<>Remove <strong>{confirmDelete?.title}</strong>? Tasks depending on it will be unblocked.</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            actions.removeTask(confirmDelete.id);
            toast({ title: 'Task deleted', tone: 'warn' });
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

/* ------------------------------- week view ------------------------------- */

function WeekView({ data }: { data: AppData }) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(startOfWeek(todayISO()));
  const [editing, setEditing] = useState<Task | null>(null);
  const [rescheduling, setRescheduling] = useState<Task | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayISO();

  const milestonesByDay = (day: string) =>
    data.milestones.filter((m) => m.dueDate === day && m.status === 'pending');

  return (
    <div className="stack">
      <Card
        title="Week view"
        subtitle="Planned tasks, fixed commitments and milestone deadlines. Drag nothing — reschedule is explicit."
        actions={
          <>
            <Button size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ‹ Prev
            </Button>
            <Button size="sm" onClick={() => setWeekStart(startOfWeek(todayISO()))}>
              This week
            </Button>
            <Button size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next ›
            </Button>
          </>
        }
        bodyClass="tight"
      >
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {days.map((day) => {
            const plan = data.dayPlans[day];
            const tasks = data.tasks
              .filter((t) => t.plannedDate === day && t.status !== 'dropped')
              .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
            const dueTasks = data.tasks.filter((t) => t.deadline === day && t.status !== 'done');
            const ms = milestonesByDay(day);
            const isToday = day === today;
            const load = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
            return (
              <div
                key={day}
                className="card"
                style={{
                  boxShadow: 'none',
                  border: isToday ? '1px solid var(--accent)' : undefined,
                  minHeight: 150,
                }}
              >
                <div className="card-head" style={{ padding: '8px 10px' }}>
                  <div>
                    <h3 style={{ fontSize: 12.5 }}>{fmtDate(day)}</h3>
                    <span className="hint">
                      {plan ? `${fmtDuration(plan.availableMinutes)} available · ${plan.energy}` : 'no plan'}
                    </span>
                  </div>
                  {isToday && <Badge tone="accent">today</Badge>}
                </div>
                <div className="card-body tight">
                  {plan?.fixed.map((f) => (
                    <div key={f.id} className="tl-bar fixed" style={{ marginBottom: 5, fontSize: 11.5 }}>
                      {f.start}–{f.end} · {f.label}
                    </div>
                  ))}
                  {plan?.unavailable.map((u) => (
                    <div key={u.id} className="tl-bar unavailable" style={{ marginBottom: 5, fontSize: 11.5 }}>
                      {u.start}–{u.end} · {u.label}
                    </div>
                  ))}
                  {tasks.map((t) => (
                    <div className="list-item" key={t.id} style={{ padding: 7 }}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={t.status === 'done'}
                        aria-label={`Complete ${t.title}`}
                        onChange={() => (t.status === 'done' ? actions.undoTask(t.id) : setCompleting(t))}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{t.title}</div>
                        <div className="meta" style={{ fontSize: 10.5 }}>
                          <span>{fmtDuration(t.estimatedMinutes)}</span>
                          <span>{t.energy}</span>
                          {t.fixed && <Badge>fixed</Badge>}
                        </div>
                      </div>
                      <IconButton label={`Reschedule ${t.title}`} onClick={() => setRescheduling(t)}>
                        <IconEdit size={12} />
                      </IconButton>
                    </div>
                  ))}
                  {dueTasks.length > 0 && (
                    <div className="mt-8">
                      <div className="section-title" style={{ fontSize: 10 }}>Due</div>
                      {dueTasks.map((t) => (
                        <div key={t.id} style={{ fontSize: 11.5, color: 'var(--danger)' }}>
                          ⚑ {t.title}
                        </div>
                      ))}
                    </div>
                  )}
                  {ms.map((m) => (
                    <div key={m.id} className="mt-8" style={{ fontSize: 11.5, color: 'var(--accent)' }}>
                      ◆ {m.title}
                    </div>
                  ))}
                  {tasks.length === 0 && !plan && dueTasks.length === 0 && ms.length === 0 && (
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Nothing planned</p>
                  )}
                  {plan && load > 0 && (
                    <div className="mt-8">
                      <Progress
                        value={plan.availableMinutes > 0 ? load / plan.availableMinutes : 0}
                        tone={load > plan.availableMinutes ? 'danger' : 'accent'}
                        label={`Planned load for ${day}`}
                      />
                      <span style={{ fontSize: 10.5, color: load > plan.availableMinutes ? 'var(--danger)' : 'var(--text-3)' }}>
                        {fmtDuration(load)} planned vs {fmtDuration(plan.availableMinutes)} available
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {editing && <TaskModal open data={data} task={editing} onClose={() => setEditing(null)} />}
      <RescheduleDialog task={rescheduling} onClose={() => setRescheduling(null)} />
      <CompleteTaskDialog
        task={completing}
        evidenceRequired={Boolean(completing?.evidenceRequired) && data.settings.evidencePrompt}
        onClose={() => {
          setCompleting(null);
          toast({ title: 'Task updated', tone: 'ok' });
        }}
      />
    </div>
  );
}

/* ----------------------------- deferred/blocked ----------------------------- */

function DeferredTasks({ data }: { data: AppData }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Task | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const open = data.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress' || t.status === 'blocked');
  const deferred = open.filter((t) => t.deferCount > 0).sort((a, b) => b.deferCount - a.deferCount);
  const blocked = open.filter((t) => t.status === 'blocked');
  const stale = open.filter((t) => !t.deadline && t.deferCount === 0 && t.status !== 'blocked');

  const rec = rankTasks(data.tasks, {
    nowISO: todayISO(),
    availableMinutes: 45,
    energy: 'low',
    weights: data.settings.weights,
  });

  return (
    <div className="stack">
      <Card title="Postponed tasks" subtitle="Deferring is counted, visible, and feeds the recommendation score — it is not silently hidden.">
        {deferred.length === 0 ? (
          <Empty title="Nothing postponed">Tasks you defer land here with a count and the date they were moved.</Empty>
        ) : (
          <div className="stack">
            {deferred.map((t) => (
              <div className="list-item" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    <Badge tone="warn">postponed {t.deferCount}×</Badge>
                    {t.lastDeferredAt && <span>last moved {fmtDate(t.lastDeferredAt)}</span>}
                    {t.deadline && <DeadlineChip label={deadlineLabel(t.deadline)} tone={deadlineTone(t.deadline)} />}
                    <span>{fmtDuration(t.estimatedMinutes)}</span>
                  </div>
                  {t.deferCount >= 3 && (
                    <div className="note warn mt-8">
                      Postponed {t.deferCount} times. Either the estimate is wrong, the task is too big, or it is not
                      actually important. Split it, shrink it, or drop it on purpose.
                    </div>
                  )}
                </div>
                <div className="row">
                  <Button size="xs" onClick={() => setCompleting(t)}>
                    Do it now
                  </Button>
                  <Button size="xs" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      actions.updateTask(t.id, { status: 'dropped' });
                      toast({ title: 'Task dropped', body: 'Deliberate decisions count as progress.', tone: 'info' });
                    }}
                  >
                    Drop
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Blocked tasks" subtitle="Waiting on a prerequisite. Unblocking them is usually the highest-leverage task.">
        {blocked.length === 0 ? (
          <Empty title="Nothing blocked" />
        ) : (
          <TaskList tasks={blocked} data={data} onEdit={setEditing} onComplete={setCompleting} />
        )}
      </Card>

      <Card
        title="Low-energy candidates"
        subtitle="Ranked for a 45-minute low-energy block — useful when a postponed task feels too heavy to start."
      >
        {rec.ranked.length === 0 ? (
          <Empty title="Nothing eligible" />
        ) : (
          <div className="list">
            {rec.ranked
              .filter((m) => !m.excluded && m.fitsEnergy)
              .slice(0, 6)
              .map((m) => (
                <TaskRow
                  key={m.task.id}
                  task={m.task}
                  data={data}
                  match={m}
                  onEdit={() => setEditing(m.task)}
                  onComplete={() => setCompleting(m.task)}
                />
              ))}
          </div>
        )}
      </Card>

      <Card title="Unscheduled backlog" subtitle="Open tasks with no deadline and no deferrals. Worth a look once a week.">
        {stale.length === 0 ? (
          <Empty title="Backlog is clear" />
        ) : (
          <TaskList tasks={stale} data={data} onEdit={setEditing} onComplete={setCompleting} />
        )}
      </Card>

      {editing && <TaskModal open data={data} task={editing} onClose={() => setEditing(null)} />}
      <CompleteTaskDialog
        task={completing}
        evidenceRequired={Boolean(completing?.evidenceRequired) && data.settings.evidencePrompt}
        onClose={() => setCompleting(null)}
      />
    </div>
  );
}
