/** Task row, task list, completion dialog (with evidence gating) and the today's-execution panel. */
import { useState } from 'react';
import type { AppData, Evidence, Task } from '../types';
import { SCOPE_LABELS } from '../types';
import { actions } from '../state/store';
import { deadlineLabel, deadlineTone, fmtDuration, todayISO } from '../lib/date';
import { incompleteDependencies, type TaskMatch } from '../domain/taskMatch';
import { Badge, Button, DeadlineChip, Field, IconButton, Input, Modal, Note, Select, Textarea, useToast } from './ui';
import { IconCheck, IconClock, IconEdit, IconLink, IconPlay, IconShuffle, IconTrash } from './icons';

/* ------------------------------ evidence ------------------------------ */

export function EvidenceList({
  items,
  onAdd,
  emptyLabel = 'No evidence recorded yet',
}: {
  items: Evidence[];
  onAdd?: (e: { label: string; url: string; note: string }) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="stack" style={{ gap: 6 }}>
      {items.length === 0 ? (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{emptyLabel}</span>
      ) : (
        items.map((e) => (
          <div key={e.id} className="row" style={{ gap: 6, fontSize: 12.5 }}>
            <IconLink size={13} />
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer noopener">
                {e.label || e.url}
              </a>
            ) : (
              <span>{e.label}</span>
            )}
            {e.note && <span style={{ color: 'var(--text-3)' }}>— {e.note}</span>}
          </div>
        ))
      )}
      {onAdd && (
        <>
          <Button size="xs" onClick={() => setOpen(true)}>
            <IconLink size={12} /> Add evidence
          </Button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Record evidence"
            size="sm"
            footer={
              <>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  disabled={!label.trim()}
                  onClick={() => {
                    onAdd({ label: label.trim(), url: url.trim(), note: note.trim() });
                    setLabel('');
                    setUrl('');
                    setNote('');
                    setOpen(false);
                  }}
                >
                  Save evidence
                </Button>
              </>
            }
          >
            <div className="stack">
              <Field label="Label" required>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Repo: sliding-window solutions" />
              </Field>
              <Field label="Link" help="GitHub, notebook, deployed app, document, video — anything verifiable.">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Note">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What does this prove?" />
              </Field>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

/* ------------------------------ completion ------------------------------ */

export function CompleteTaskDialog({
  task,
  evidenceRequired,
  onClose,
}: {
  task: Task | null;
  evidenceRequired: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [actualMinutes, setActualMinutes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [reflection, setReflection] = useState('');
  const [error, setError] = useState('');

  if (!task) return null;

  function submit() {
    if (!task) return;
    if (evidenceRequired && !evidenceLink.trim() && !outcome.trim()) {
      setError('This task is evidence-based: describe the outcome or paste a link before closing it.');
      return;
    }
    actions.completeTask(task.id, {
      actualMinutes: actualMinutes ? Number(actualMinutes) : undefined,
      outcome: outcome.trim() || undefined,
      evidenceLink: evidenceLink.trim() || undefined,
      reflection: reflection.trim() || undefined,
    });
    toast({
      title: 'Task completed',
      tone: 'ok',
      body: `${task.title}${actualMinutes ? ` · ${fmtDuration(Number(actualMinutes))}` : ''}`,
      action: {
        label: 'Undo',
        run: () => {
          actions.undoTask(task.id);
          toast({ title: 'Completion undone', body: task.title, tone: 'info' });
        },
      },
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Complete task"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            <IconCheck size={14} /> Mark complete
          </Button>
        </>
      }
    >
      <div className="stack">
        <Note tone={evidenceRequired ? 'warn' : 'info'}>
          <strong>{task.title}</strong>
          <br />
          Finish condition: {task.finishCondition || 'not specified'}
          {task.mvc && (
            <>
              <br />
              Minimum viable: {task.mvc}
            </>
          )}
        </Note>
        {evidenceRequired && (
          <Note tone="warn">
            This task is marked evidence-based. Recording what you actually produced keeps progress honest —
            completing it without evidence would inflate the metric it feeds.
          </Note>
        )}
        <div className="form-grid">
          <Field label="Actual minutes" help="Optional — used for planning accuracy only.">
            <Input type="number" min={0} value={actualMinutes} onChange={(e) => setActualMinutes(e.target.value)} />
          </Field>
          <Field label="Evidence link" error={error} help="Repo, notebook, published post, screenshot, doc.">
            <Input value={evidenceLink} onChange={(e) => setEvidenceLink(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Outcome" className="span-2" help="What exists now that did not exist before?">
            <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </Field>
          <Field label="Reflection" className="span-2" help="Optional: what would you do differently?">
            <Textarea value={reflection} onChange={(e) => setReflection(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ task row ------------------------------ */

export function TaskRow({
  task,
  data,
  onEdit,
  onComplete,
  showArea = true,
  match,
  compact = false,
}: {
  task: Task;
  data: AppData;
  onEdit?: () => void;
  onComplete?: () => void;
  showArea?: boolean;
  match?: TaskMatch;
  compact?: boolean;
}) {
  const toast = useToast();
  const done = task.status === 'done';
  const blockedBy = incompleteDependencies(task, data.tasks);
  const goal = data.goals.find((g) => g.id === task.goalId);
  const tone = deadlineTone(task.deadline);

  return (
    <div className={`list-item ${done ? 'done' : ''}`}>
      <input
        type="checkbox"
        className="checkbox"
        checked={done}
        aria-label={done ? `Undo completion of ${task.title}` : `Complete ${task.title}`}
        onChange={() => {
          if (done) {
            actions.undoTask(task.id);
            toast({ title: 'Completion undone', body: task.title, tone: 'info' });
          } else if (onComplete) {
            onComplete();
          } else {
            actions.completeTask(task.id, {});
            toast({
              title: 'Task completed',
              tone: 'ok',
              body: task.title,
              action: { label: 'Undo', run: () => actions.undoTask(task.id) },
            });
          }
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title" style={{ textDecoration: done ? 'line-through' : undefined }}>
          {task.title}
        </div>
        <div className="meta">
          {showArea && <span>{SCOPE_LABELS[task.area]}</span>}
          <span>{fmtDuration(task.estimatedMinutes)}</span>
          <span>{task.energy} energy</span>
          <span>{task.priority}</span>
          {task.deadline && (
            <DeadlineChip label={deadlineLabel(task.deadline)} tone={tone} />
          )}
          {task.status === 'blocked' && <Badge tone="danger">Blocked</Badge>}
          {blockedBy.length > 0 && !done && (
            <Badge tone="warn" title={blockedBy.map((b) => b.title).join(', ')}>
              Waiting on {blockedBy.length}
            </Badge>
          )}
          {task.deferCount > 0 && <Badge tone="warn">Postponed {task.deferCount}×</Badge>}
          {task.evidenceRequired && <Badge tone="info">Evidence required</Badge>}
          {task.fixed && <Badge>Fixed</Badge>}
          {goal && !compact && <span>→ {goal.title.slice(0, 44)}</span>}
        </div>
        {match && match.parts.length > 0 && (
          <div className="meta" style={{ marginTop: 4 }}>
            <Badge tone="accent">Score {Math.round(match.score)}</Badge>
            {match.usesMvc && <Badge tone="warn">Minimum viable version fits</Badge>}
          </div>
        )}
      </div>
      <div className="row" style={{ flex: 'none' }}>
        {onComplete && !done && (
          <IconButton label="Start or complete" onClick={onComplete}>
            <IconPlay size={14} />
          </IconButton>
        )}
        {onEdit && (
          <IconButton label="Edit task" onClick={onEdit}>
            <IconEdit size={14} />
          </IconButton>
        )}
        <IconButton
          label="Delete task"
          onClick={() => {
            actions.removeTask(task.id);
            toast({
              title: 'Task deleted',
              body: task.title,
              tone: 'warn',
              action: { label: 'Restore', run: () => actions.addTask({ ...task, status: 'todo' }) },
            });
          }}
        >
          <IconTrash size={14} />
        </IconButton>
      </div>
    </div>
  );
}

export function TaskList({
  tasks,
  data,
  onEdit,
  onComplete,
  emptyTitle = 'No tasks here',
  emptyBody,
}: {
  tasks: Task[];
  data: AppData;
  onEdit?: (t: Task) => void;
  onComplete?: (t: Task) => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="empty">
        <h3>{emptyTitle}</h3>
        {emptyBody && <p>{emptyBody}</p>}
      </div>
    );
  }
  return (
    <div className="list">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          data={data}
          onEdit={onEdit ? () => onEdit(t) : undefined}
          onComplete={onComplete ? () => onComplete(t) : undefined}
        />
      ))}
    </div>
  );
}

/* ------------------------------ reschedule ------------------------------ */

export function RescheduleDialog({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState('');
  if (!task) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule task"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.rescheduleTask(task.id, date, slot.trim() || undefined);
              toast({
                title: 'Task rescheduled',
                tone: 'ok',
                body: `${task.title} → ${date}${slot ? ` (${slot})` : ''}. Deadline unchanged.`,
              });
              onClose();
            }}
          >
            Move task
          </Button>
        </>
      }
    >
      <div className="stack">
        <Note>
          This changes the <strong>planned slot only</strong>. The deadline
          {task.deadline ? ` (${task.deadline})` : ''} is not modified, and fixed commitments are untouched.
        </Note>
        <Field label="New planned date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Slot label" help="Optional: 'morning gap', 'evening block', 'after lab'.">
          <Input value={slot} onChange={(e) => setSlot(e.target.value)} />
        </Field>
        <div className="row-wrap">
          {[1, 2, 3, 7].map((d) => (
            <Button
              key={d}
              size="xs"
              onClick={() => {
                const base = new Date();
                base.setDate(base.getDate() + d);
                setDate(base.toISOString().slice(0, 10));
              }}
            >
              +{d}d
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ shuffle ------------------------------ */

export function ShufflePanel({
  explanation,
  reasons,
  onShuffle,
  onAnother,
  disabled,
}: {
  explanation: string;
  reasons: string[];
  onShuffle: () => void;
  onAnother: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row-wrap">
        <Button onClick={onShuffle} disabled={disabled}>
          <IconShuffle size={14} /> Shuffle tasks
        </Button>
        <Button onClick={onAnother} disabled={disabled}>
          Find another suitable task
        </Button>
      </div>
      <div className="note">{explanation}</div>
      {reasons.length > 0 && (
        <details style={{ fontSize: 12, color: 'var(--text-2)' }}>
          <summary style={{ cursor: 'pointer' }}>Why these ranked first</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function TimeChip({ minutes }: { minutes: number }) {
  return (
    <Badge tone="plain">
      <IconClock size={11} /> {fmtDuration(minutes)}
    </Badge>
  );
}

export function EnergySelect({
  value,
  onChange,
}: {
  value: AppData['settings'] extends never ? never : import('../types').Energy;
  onChange: (e: import('../types').Energy) => void;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as import('../types').Energy)}>
      <option value="high">High — deep work</option>
      <option value="medium">Medium — normal study</option>
      <option value="low">Low — light revision</option>
      <option value="exhausted">Exhausted / unwell</option>
    </Select>
  );
}
