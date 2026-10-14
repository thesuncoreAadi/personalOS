/**
 * Today's execution panel — the adaptive task engine's UI.
 *
 * Every recommendation is explained. Shuffle re-ranks only; reschedule is a separate,
 * confirmed action; nothing here mutates a deadline or a fixed commitment.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AppData, DayPlan, Energy, Task } from '../types';
import { actions } from '../state/store';
import { addDays, fmtDate, fmtDuration, todayISO } from '../lib/date';
import { energyMode, findAnother, rankTasks, shuffleTasks } from '../domain/taskMatch';
import { Badge, Button, Card, Field, IconButton, Input, Metric, Note, Segmented, Select, useToast } from './ui';
import { IconBolt, IconCheck, IconClock, IconEdit, IconPlus, IconUndo } from './icons';
import { CompleteTaskDialog, RescheduleDialog, ShufflePanel, TaskRow } from './tasks';
import { TaskModal } from './TaskModal';

const ENERGIES: { value: Energy; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'exhausted', label: 'Exhausted' },
];

function emptyPlan(date: string): DayPlan {
  return {
    date,
    energy: 'medium',
    availableMinutes: 0,
    focusMinutes: 0,
    windows: [],
    fixed: [],
    unavailable: [],
    note: '',
  };
}

export function TodayPanel({ data }: { data: AppData }) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const plan = data.dayPlans[date] ?? emptyPlan(date);
  const sleep = data.sleepLogs.find((s) => s.date === date);

  const [completing, setCompleting] = useState<Task | null>(null);
  const [rescheduling, setRescheduling] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [suggestionIds, setSuggestionIds] = useState<string[]>([]);
  const [shuffleNote, setShuffleNote] = useState<{ text: string; reasons: string[] } | null>(null);

  // keep the "already suggested" memory scoped to the day + window
  useEffect(() => {
    setSuggestionIds([]);
    setShuffleNote(null);
  }, [date, plan.availableMinutes, plan.energy]);

  const ctx = useMemo(
    () => ({
      nowISO: todayISO(),
      availableMinutes: plan.focusMinutes || plan.availableMinutes,
      energy: plan.energy,
      weights: data.settings.weights,
      deprioritizeIds: suggestionIds,
    }),
    [plan.focusMinutes, plan.availableMinutes, plan.energy, data.settings.weights, suggestionIds],
  );

  const rec = useMemo(() => rankTasks(data.tasks, ctx), [data.tasks, ctx]);
  const mode = energyMode(plan.energy);

  const plannedToday = useMemo(
    () =>
      data.tasks
        .filter((t) => t.plannedDate === date && t.status !== 'done' && t.status !== 'dropped')
        .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes),
    [data.tasks, date],
  );

  function doShuffle() {
    const result = shuffleTasks(data.tasks, ctx, suggestionIds);
    if (result.order.length === 0) {
      setShuffleNote({
        text: 'Nothing eligible to shuffle: every open task is blocked, completed, or needs more time/energy than this window has. Add a fallback task or take the recovery block.',
        reasons: [],
      });
      return;
    }
    const top = result.order.slice(0, 3);
    setSuggestionIds([...suggestionIds, ...top]);
    setShuffleNote({ text: result.suggestion ?? '', reasons: result.reasons });
    toast({
      title: 'Re-ranked for this window',
      tone: 'ok',
      body: `${ctx.availableMinutes}m window, ${plan.energy} energy. Deadlines and fixed commitments untouched.`,
    });
  }

  function doFindAnother() {
    const candidate = rec.primary ? [...suggestionIds, rec.primary.task.id] : suggestionIds;
    const next = findAnother(data.tasks, ctx, candidate);
    if (next.primary) {
      setSuggestionIds(candidate);
      setShuffleNote({ text: next.explanation, reasons: [] });
    } else {
      setShuffleNote({ text: next.explanation, reasons: [] });
    }
  }

  const sleepHint = (() => {
    if (!sleep) return null;
    if (sleep.hours < 6)
      return `You logged ${sleep.hours.toFixed(1)}h of sleep. Consider the minimum viable version of today's work, or move heavy items to a better day.`;
    if (sleep.hours < 7)
      return `${sleep.hours.toFixed(1)}h of sleep — medium-load work is a reasonable ceiling today.`;
    return null;
  })();

  return (
    <>
      <Card
        title="Today's execution"
        subtitle={`${fmtDate(date)} · recommendations are explained, never guessed`}
        actions={
          <>
            <Button size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              ‹
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: 140 }}
              aria-label="Choose day"
            />
            <Button size="sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              ›
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> Task
            </Button>
          </>
        }
      >
        <div className="stack">
          {/* ---- capacity ---- */}
          <div className="grid grid-4" style={{ gap: 10 }}>
            <Field label="Energy right now">
              <Segmented
                ariaLabel="Current energy"
                value={plan.energy}
                options={ENERGIES}
                onChange={(v) => actions.setDayPlan(date, { energy: v })}
              />
            </Field>
            <Field label="Total available (min)">
              <Input
                type="number"
                min={0}
                step={15}
                value={plan.availableMinutes}
                onChange={(e) => actions.setDayPlan(date, { availableMinutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Longest uninterrupted block (min)">
              <Input
                type="number"
                min={0}
                step={15}
                value={plan.focusMinutes}
                onChange={(e) => actions.setDayPlan(date, { focusMinutes: Number(e.target.value) })}
              />
            </Field>
            <div className="field">
              <span className="field-label">Mode</span>
              <div className="row" style={{ height: 33 }}>
                <Badge tone={mode === 'recovery' ? 'danger' : mode === 'light' ? 'warn' : mode === 'deep' ? 'ok' : 'info'} dot>
                  {mode === 'recovery'
                    ? 'Recovery'
                    : mode === 'light'
                      ? 'Light work'
                      : mode === 'deep'
                        ? 'Deep work'
                        : 'Normal'}
                </Badge>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {rec.considered} eligible · {rec.excluded} blocked
                </span>
              </div>
            </div>
          </div>

          {sleepHint && <Note tone="warn">{sleepHint}</Note>}

          {/* ---- primary recommendation ---- */}
          {mode === 'recovery' ? (
            <Note tone="warn" title="Recovery recommended.">
              You logged exhausted energy. Pushing heavy work now usually costs more than it produces. If you want to
              do something, pick a low-demand item below — otherwise a rest block is a legitimate output today.
            </Note>
          ) : null}

          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-head">
              <div>
                <h3>Best task for this window</h3>
                <span className="hint">
                  {ctx.availableMinutes > 0 ? `${fmtDuration(ctx.availableMinutes)} uninterrupted` : 'no window recorded'}{' '}
                  · {plan.energy} energy
                </span>
              </div>
            </div>
            <div className="card-body">
              {rec.primary ? (
                <div className="stack">
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{rec.primary.task.title}</div>
                      <div className="row-wrap" style={{ marginTop: 6 }}>
                        <Badge tone="accent">Score {Math.round(rec.primary.score)}</Badge>
                        <Badge>
                          <IconClock size={11} /> ~{fmtDuration(rec.primary.task.estimatedMinutes)}
                        </Badge>
                        <Badge>
                          <IconBolt size={11} /> {rec.primary.task.energy} energy
                        </Badge>
                        {rec.primary.usesMvc && <Badge tone="warn">Use the minimum viable version</Badge>}
                        {rec.primary.blockedBy.length > 0 && <Badge tone="danger">Blocked</Badge>}
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8 }}>{rec.explanation}</p>
                      {rec.primary.task.finishCondition && (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                          Done when: {rec.primary.task.finishCondition}
                        </p>
                      )}
                      {rec.primary.usesMvc && rec.primary.task.mvc && (
                        <p style={{ fontSize: 12, color: 'var(--warn)', marginTop: 4 }}>
                          Minimum viable: {rec.primary.task.mvc}
                        </p>
                      )}
                    </div>
                  </div>

                  <details style={{ fontSize: 12 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-2)' }}>Score breakdown</summary>
                    <div className="table-wrap mt-8">
                      <table>
                        <thead>
                          <tr>
                            <th>Factor</th>
                            <th className="num">Points</th>
                            <th>Why</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rec.primary.parts.map((p) => (
                            <tr key={p.key}>
                              <td>{p.label}</td>
                              <td className="num">{p.value > 0 ? `+${p.value.toFixed(0)}` : p.value.toFixed(0)}</td>
                              <td style={{ color: 'var(--text-3)' }}>{p.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  <div className="row-wrap">
                    <Button variant="primary" onClick={() => setCompleting(rec.primary!.task)}>
                      <IconCheck size={14} /> Start / complete
                    </Button>
                    <Button onClick={() => setRescheduling(rec.primary!.task)}>Reschedule…</Button>
                    <Button
                      onClick={() => {
                        actions.deferTask(rec.primary!.task.id);
                        toast({
                          title: 'Postponed',
                          tone: 'info',
                          body: `${rec.primary!.task.title} moved to tomorrow and counted as deferred (${rec.primary!.task.deferCount + 1}×).`,
                        });
                      }}
                    >
                      Defer to tomorrow
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(rec.primary!.task)}>
                      <IconEdit size={13} /> Edit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  <h3>No eligible task for this window</h3>
                  <p>
                    {ctx.availableMinutes === 0
                      ? 'Record how much uninterrupted time you have — recommendations need a window size.'
                      : `At ${plan.energy} energy with ${fmtDuration(ctx.availableMinutes)}, nothing open fits. Add a low-energy fallback task, widen the window, or take the recovery block.`}
                  </p>
                  <div className="row-wrap" style={{ justifyContent: 'center' }}>
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <IconPlus size={13} /> Add a fallback task
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDate(addDays(date, 1))}>
                      Try tomorrow
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ShufflePanel
            explanation={
              shuffleNote?.text ??
              (rec.primary
                ? 'Shuffle re-ranks open tasks for this exact window. It never changes a deadline, deletes a task, or moves a fixed commitment.'
                : 'Nothing to shuffle in this window.')
            }
            reasons={shuffleNote?.reasons ?? []}
            onShuffle={doShuffle}
            onAnother={doFindAnother}
          />

          {/* ---- alternates / recovery ---- */}
          {rec.alternates.length > 0 && (
            <div>
              <div className="section-title">Also suitable right now</div>
              <div className="list">
                {rec.alternates.slice(0, 3).map((m) => (
                  <TaskRow
                    key={m.task.id}
                    task={m.task}
                    data={data}
                    match={m}
                    compact
                    onEdit={() => setEditing(m.task)}
                    onComplete={() => setCompleting(m.task)}
                  />
                ))}
              </div>
            </div>
          )}

          {(mode === 'recovery' || mode === 'light') && rec.recovery.length > 0 && (
            <div>
              <div className="section-title">Low-demand fallbacks</div>
              <div className="list">
                {rec.recovery.slice(0, 3).map((m) => (
                  <TaskRow
                    key={m.task.id}
                    task={m.task}
                    data={data}
                    match={m}
                    compact
                    onEdit={() => setEditing(m.task)}
                    onComplete={() => setCompleting(m.task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ---- planned for the day ---- */}
          <div>
            <div className="section-title">Planned for {fmtDate(date)}</div>
            {plannedToday.length === 0 ? (
              <div className="empty">
                <h3>Nothing planned yet</h3>
                <p>Pick a recommendation above and reschedule it here, or add a task directly.</p>
              </div>
            ) : (
              <div className="list">
                {plannedToday.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    data={data}
                    onEdit={() => setEditing(t)}
                    onComplete={() => setCompleting(t)}
                  />
                ))}
              </div>
            )}
          </div>

          <ScheduleEditor date={date} plan={plan} />
        </div>
      </Card>

      <CompleteTaskDialog
        task={completing}
        evidenceRequired={Boolean(completing?.evidenceRequired) && data.settings.evidencePrompt}
        onClose={() => setCompleting(null)}
      />
      <RescheduleDialog task={rescheduling} onClose={() => setRescheduling(null)} />
      {editing && (
        <TaskModal open data={data} task={editing} onClose={() => setEditing(null)} />
      )}
      <TaskModal open={creating} data={data} onClose={() => setCreating(false)} presetArea="technical" />
    </>
  );
}

/* ------------------------------ schedule ------------------------------ */

function ScheduleEditor({ date, plan }: { date: string; plan: DayPlan }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'windows' | 'fixed' | 'unavailable'>('fixed');
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const toast = useToast();

  const rows = plan[kind];

  function minutesBetween(a: string, b: string) {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    return Math.max(0, bh * 60 + bm - (ah * 60 + am));
  }

  function add() {
    if (!label.trim()) return;
    const entry = { id: `${kind[0]}_${Date.now()}`, label: label.trim(), start, end };
    const next =
      kind === 'windows'
        ? [...plan.windows, { ...entry, minutes: minutesBetween(start, end) }]
        : [...plan[kind === 'fixed' ? 'fixed' : 'unavailable'], entry];
    actions.setDayPlan(date, { [kind]: next } as Partial<DayPlan>);
    setLabel('');
    toast({ title: 'Commitment added', body: `${label.trim()} ${start}–${end}`, tone: 'ok' });
  }

  function remove(kindKey: 'windows' | 'fixed' | 'unavailable', id: string) {
    const next = plan[kindKey].filter((r) => r.id !== id);
    actions.setDayPlan(date, { [kindKey]: next } as Partial<DayPlan>);
  }

  const sorted = [...rows].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="section-title" style={{ margin: 0 }}>
          Day shape
        </span>
        <div className="spacer" />
        <Button size="xs" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Edit'} windows & commitments
        </Button>
      </div>

      {plan.fixed.length + plan.windows.length + plan.unavailable.length === 0 && !open ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          No fixed commitments or windows recorded for this day. Adding them makes the recommendations fit your real
          timetable — nothing here assumes a fixed wake-up time.
        </p>
      ) : (
        <div className="timeline">
          {sorted.map((r) => (
            <div className="tl-row" key={r.id}>
              <span className="tl-time">
                {r.start}–{r.end}
              </span>
              <div
                className={`tl-bar ${
                  plan.fixed.some((f) => f.id === r.id)
                    ? 'fixed'
                    : plan.unavailable.some((u) => u.id === r.id)
                      ? 'unavailable'
                      : 'window'
                }`}
              >
                <div className="row">
                  <span>{r.label}</span>
                  <div className="spacer" />
                  {plan.fixed.some((f) => f.id === r.id) && <Badge tone="info">Fixed</Badge>}
                  {plan.unavailable.some((u) => u.id === r.id) && <Badge>Unavailable</Badge>}
                  {plan.windows.some((w) => w.id === r.id) && (
                    <Badge tone="accent">
                      {'minutes' in r ? fmtDuration(r.minutes) : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="card mt-12" style={{ boxShadow: 'none' }}>
          <div className="card-body">
            <div className="form-grid">
              <Field label="Type">
                <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  <option value="fixed">Fixed commitment (lecture, lab, class)</option>
                  <option value="unavailable">Unavailable (commute, errand)</option>
                  <option value="windows">Available work window</option>
                </Select>
              </Field>
              <Field label="Label">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Digital Electronics lab" />
              </Field>
              <Field label="Start">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="End">
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <div className="row mt-12">
              <Button size="sm" variant="primary" onClick={add} disabled={!label.trim()}>
                <IconPlus size={13} /> Add to {fmtDate(date)}
              </Button>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                Fixed commitments are never moved or deleted by shuffle.
              </span>
            </div>

            {(['fixed', 'unavailable', 'windows'] as const).map((k) =>
              plan[k].length > 0 ? (
                <div key={k} className="mt-12">
                  <div className="section-title">{k === 'fixed' ? 'Fixed' : k === 'unavailable' ? 'Unavailable' : 'Windows'}</div>
                  <div className="list">
                    {plan[k].map((r) => (
                      <div className="list-item" key={r.id}>
                        <div style={{ flex: 1 }}>
                          <div className="title">{r.label}</div>
                          <div className="meta">
                            <span>
                              {r.start}–{r.end}
                            </span>
                            {'minutes' in r && <span>{fmtDuration(r.minutes)}</span>}
                          </div>
                        </div>
                        <IconButton label={`Remove ${r.label}`} onClick={() => remove(k, r.id)}>
                          <IconUndo size={14} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ sleep log ------------------------------ */

export function SleepPanel({ data }: { data: AppData }) {
  const today = todayISO();
  const existing = data.sleepLogs.find((s) => s.date === today);
  const [bed, setBed] = useState(existing?.bedTime ?? '00:30');
  const [wake, setWake] = useState(existing?.wakeTime ?? '07:30');
  const [quality, setQuality] = useState(existing?.quality ?? 3);
  const [energy, setEnergy] = useState<Energy>(existing?.energy ?? 'medium');
  const [note, setNote] = useState(existing?.note ?? '');
  const toast = useToast();

  function hoursBetween(a: string, b: string) {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    let mins = bh * 60 + bm - (ah * 60 + am);
    if (mins <= 0) mins += 24 * 60;
    return Math.round((mins / 60) * 10) / 10;
  }

  const hours = hoursBetween(bed, wake);
  const recent = [...data.sleepLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const avg = recent.length ? recent.reduce((s, r) => s + r.hours, 0) / recent.length : 0;

  return (
    <Card
      title="Sleep & wake log"
      subtitle="Optional. Used only for gentle suggestions — never to judge you."
      actions={
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            actions.addSleepLog({ date: today, bedTime: bed, wakeTime: wake, hours, quality: quality as 1|2|3|4|5, energy, note });
            actions.setDayPlan(today, { energy });
            toast({
              title: 'Sleep logged',
              tone: 'ok',
              body: `${hours}h · today's energy set to ${energy}.`,
            });
          }}
        >
          Save today
        </Button>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <Field label="Went to bed">
            <Input type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
          </Field>
          <Field label="Woke up">
            <Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
          </Field>
          <Field label="Sleep quality" help="1 = rough, 5 = rested">
            <Input type="number" min={1} max={5} value={quality} onChange={(e) => setQuality(Math.min(5, Math.max(1, Number(e.target.value))) as 1 | 2 | 3 | 4 | 5)} />
          </Field>
          <Field label="Energy now">
            <Select value={energy} onChange={(e) => setEnergy(e.target.value as Energy)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="exhausted">Exhausted / unwell</option>
            </Select>
          </Field>
          <Field label="Note" className="span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <div className="metric-grid">
          <Metric label="Last night" value={`${hours}h`} sub={`bed ${bed} · wake ${wake}`} />
          <Metric label="7-day average" value={recent.length ? `${avg.toFixed(1)}h` : '—'} sub={`${recent.length} nights logged`} />
        </div>

        {hours < 6 ? (
          <Note tone="warn">
            Short night. Nothing here says you must push through — the task engine will already be steering you to
            lighter work, and a recovery block is a valid plan.
          </Note>
        ) : hours > 9 ? (
          <Note>Long sleep logged. If that was recovery, good — plan the heavy item for your best window today.</Note>
        ) : null}

        {recent.length > 0 && (
          <div>
            <div className="section-title">Recent nights</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bed</th>
                    <th>Wake</th>
                    <th className="num">Hours</th>
                    <th className="num">Quality</th>
                    <th>Energy</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>{r.bedTime}</td>
                      <td>{r.wakeTime}</td>
                      <td className="num">{r.hours}</td>
                      <td className="num">{r.quality}/5</td>
                      <td>{r.energy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ session log ------------------------------ */

export function QuickSessionLog({ data }: { data: AppData }) {
  const [minutes, setMinutes] = useState('50');
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<'technical' | 'academics' | 'marketing'>('technical');
  const toast = useToast();
  const weekStart = todayISO();

  const doneThisWeek = data.sessions.filter((s) => s.date >= addDays(weekStart, -6)).length;

  return (
    <Card
      title="Log a focused session"
      subtitle="Inputs only — this never marks a milestone complete."
      actions={
        <Button
          size="sm"
          variant="primary"
          disabled={!title.trim() || Number(minutes) <= 0}
          onClick={() => {
            actions.addSession({
              date: todayISO(),
              minutes: Number(minutes),
              area,
              taskTitle: title.trim(),
              note: '',
            });
            setTitle('');
            toast({ title: 'Session logged', tone: 'ok', body: `${minutes} min · ${area}` });
          }}
        >
          Log
        </Button>
      }
    >
      <div className="form-grid">
        <Field label="What did you work on?" className="span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DSA practice — sliding window" />
        </Field>
        <Field label="Minutes">
          <Input type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label="Area">
          <Select value={area} onChange={(e) => setArea(e.target.value as typeof area)}>
            <option value="technical">Technical</option>
            <option value="academics">Academics</option>
            <option value="marketing">Marketing & Content</option>
          </Select>
        </Field>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
        {doneThisWeek} session{doneThisWeek === 1 ? '' : 's'} logged in the last 7 days.
      </p>
    </Card>
  );
}
