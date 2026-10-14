import { useEffect, useMemo, useState } from 'react';
import type { AppData, Energy, Task } from '../types';
import { AREA_LABELS, SCOPE_LABELS, TRACK_LABELS } from '../types';
import { actions } from '../state/store';
import { todayISO } from '../lib/date';
import { Button, Field, Input, Modal, Note, Select, Textarea, useToast } from './ui';
import { incompleteDependencies } from '../domain/taskMatch';

type Draft = Omit<Task, 'id' | 'createdAt' | 'history'>;

const blank = (today: string): Draft => ({
  title: '',
  area: 'technical',
  priority: 'P2',
  importance: 3,
  estimatedMinutes: 45,
  mvc: '',
  finishCondition: '',
  energy: 'medium',
  cognitiveLoad: 'medium',
  status: 'todo',
  dependencies: [],
  plannedDate: today,
  evidenceRequired: false,
  recurrence: null,
  deferCount: 0,
  notes: '',
  fixed: false,
  seeded: false,
});

export function TaskModal({
  open,
  onClose,
  data,
  task,
  presetArea,
  presetGoalId,
}: {
  open: boolean;
  onClose: () => void;
  data: AppData;
  task?: Task;
  presetArea?: Task['area'];
  presetGoalId?: string;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() =>
    task ? { ...task } : { ...blank(todayISO()), area: presetArea ?? 'technical', goalId: presetGoalId },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setDraft(
      task
        ? { ...task }
        : { ...blank(todayISO()), area: presetArea ?? 'technical', goalId: presetGoalId },
    );
    setErrors({});
  }, [open, task, presetArea, presetGoalId]);

  const goals = useMemo(
    () => data.goals.filter((g) => g.status !== 'archived'),
    [data.goals],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!draft.title.trim()) e.title = 'Give the task a concrete, finishable title.';
    if (!Number.isFinite(draft.estimatedMinutes) || draft.estimatedMinutes <= 0)
      e.estimatedMinutes = 'Estimate must be a positive number of minutes.';
    if (draft.estimatedMinutes > 600) e.estimatedMinutes = 'Over 10 hours — split this into smaller tasks.';
    if (draft.importance < 1 || draft.importance > 5) e.importance = 'Importance is 1–5.';
    if (draft.deadline && draft.plannedDate && draft.plannedDate > draft.deadline)
      e.plannedDate = 'Planned date is after the deadline.';
    if (task && draft.dependencies.includes(task.id)) e.dependencies = 'A task cannot depend on itself.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload: Draft = {
      ...draft,
      title: draft.title.trim(),
      mvc: draft.mvc.trim(),
      finishCondition: draft.finishCondition.trim(),
    };
    if (task) {
      actions.updateTask(task.id, payload);
      toast({ title: 'Task updated', tone: 'ok', body: payload.title });
    } else {
      actions.addTask(payload);
      toast({ title: 'Task created', tone: 'ok', body: payload.title });
    }
    onClose();
  }

  const depOptions = data.tasks.filter((t) => t.id !== task?.id && t.status !== 'done' && t.status !== 'dropped');
  const circular = task
    ? incompleteDependencies({ ...task, ...draft } as Task, data.tasks).some((d) =>
        d.dependencies.includes(task.id),
      )
    : false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Title" required error={errors.title} className="span-2">
          <Input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Arrays & hashing: 6 problems, log results"
          />
        </Field>

        <Field label="Area">
          <Select value={draft.area} onChange={(e) => set('area', e.target.value as Task['area'])}>
            {(Object.keys(SCOPE_LABELS) as Task['area'][]).map((a) => (
              <option key={a} value={a}>
                {SCOPE_LABELS[a]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Linked goal" help="Progress on this task rolls up to the goal.">
          <Select value={draft.goalId ?? ''} onChange={(e) => set('goalId', e.target.value || undefined)}>
            <option value="">— none —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                [{AREA_LABELS[g.area]}] {g.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Learning track">
          <Select value={draft.trackId ?? ''} onChange={(e) => set('trackId', (e.target.value || undefined) as Task['trackId'])}>
            <option value="">— none —</option>
            {(Object.keys(TRACK_LABELS) as (keyof typeof TRACK_LABELS)[]).map((t) => (
              <option key={t} value={t}>
                {TRACK_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority">
          <Select value={draft.priority} onChange={(e) => set('priority', e.target.value as Task['priority'])}>
            <option value="P1">P1 — must happen</option>
            <option value="P2">P2 — should happen</option>
            <option value="P3">P3 — nice to have</option>
          </Select>
        </Field>

        <Field label="Importance to current goal" error={errors.importance} help="1 = peripheral, 5 = core to the 90-day outcome.">
          <Input
            type="number"
            min={1}
            max={5}
            value={draft.importance}
            onChange={(e) => set('importance', Number(e.target.value) as Task['importance'])}
          />
        </Field>

        <Field label="Estimated minutes" required error={errors.estimatedMinutes}>
          <Input
            type="number"
            min={5}
            step={5}
            value={draft.estimatedMinutes}
            onChange={(e) => set('estimatedMinutes', Number(e.target.value))}
          />
        </Field>

        <Field label="Energy required">
          <Select value={draft.energy} onChange={(e) => set('energy', e.target.value as Energy)}>
            <option value="high">High — deep work, mock tests, hard problems</option>
            <option value="medium">Medium — normal study, scripting, debugging</option>
            <option value="low">Low — revision, one easy problem, admin</option>
            <option value="exhausted">Recovery — rest, walk, no screens</option>
          </Select>
        </Field>

        <Field label="Cognitive load">
          <Select
            value={draft.cognitiveLoad}
            onChange={(e) => set('cognitiveLoad', e.target.value as Task['cognitiveLoad'])}
          >
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </Select>
        </Field>

        <Field label="Deadline" help="Leave empty for tasks with no hard date.">
          <Input type="date" value={draft.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || undefined)} />
        </Field>

        <Field label="Planned date" error={errors.plannedDate}>
          <Input
            type="date"
            value={draft.plannedDate ?? ''}
            onChange={(e) => set('plannedDate', e.target.value || undefined)}
          />
        </Field>

        <Field
          label="Minimum viable completion"
          className="span-2"
          help="What counts if you only get half the time. Shown as a fallback when the window is short."
        >
          <Input value={draft.mvc} onChange={(e) => set('mvc', e.target.value)} placeholder="e.g. solve 2 problems and write the approach" />
        </Field>

        <Field label="Finish condition" className="span-2" help="The observable thing that makes this done — not 'work on it'.">
          <Input
            value={draft.finishCondition}
            onChange={(e) => set('finishCondition', e.target.value)}
            placeholder="e.g. 6 problems attempted with independent/hint status logged"
          />
        </Field>

        <Field label="Depends on" className="span-2" help="A task with incomplete dependencies is de-prioritised, never hidden.">
          <Select
            multiple
            size={3}
            value={draft.dependencies}
            onChange={(e) => set('dependencies', Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {depOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Recurrence">
          <Select
            value={draft.recurrence?.type ?? 'none'}
            onChange={(e) =>
              set(
                'recurrence',
                e.target.value === 'none'
                  ? null
                  : { type: e.target.value as 'daily' | 'weekly', interval: draft.recurrence?.interval ?? 1 },
              )
            }
          >
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </Select>
        </Field>

        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value as Task['status'])}>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="dropped">Dropped</option>
          </Select>
        </Field>

        <Field label="Notes" className="span-2">
          <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <div className="span-2">
          <label className="row" style={{ gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={draft.evidenceRequired}
              onChange={(e) => set('evidenceRequired', e.target.checked)}
            />
            Require evidence before this can be marked complete
          </label>
        </div>
      </div>

      {circular && (
        <div className="mt-12">
          <Note tone="warn" title="Circular dependency:">
            one of the selected dependencies already depends on this task. It will still save, but neither will
            ever become unblocked.
          </Note>
        </div>
      )}
    </Modal>
  );
}
