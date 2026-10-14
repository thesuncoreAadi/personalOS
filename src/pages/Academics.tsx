import { useMemo, useState } from 'react';
import type {
  AppData,
  CollegeSubject,
  GateSubject,
  MockTest,
  RoadmapTopic,
  SyllabusTopic,
} from '../types';
import { actions, useStore } from '../state/store';
import { addDays, deadlineLabel, deadlineTone, fmtDate, pct, todayISO } from '../lib/date';
import {
  examReadiness,
  gateProgress,
  gateStats,
  gateTopicProgress,
  roadmapProgress,
  revisionCoverage,
  syllabusCoverage,
} from '../domain/progress';
import { LineChart } from '../components/charts';
import {
  Badge,
  Button,
  Card,
  DeadlineChip,
  Empty,
  Field,
  Formula,
  IconButton,
  Input,
  Metric,
  Modal,
  Note,
  Progress,
  Select,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui';
import { IconEdit, IconPlus, IconTrash } from '../components/icons';
import { EvidenceList } from '../components/tasks';

type TabId = 'college' | 'gate' | 'semiconductor';

export function Academics() {
  const [tab, setTab] = useState<TabId>('college');
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Academics & Career</h1>
          <p className="page-sub">
            Three independent tracks with separate targets: college semester work, GATE preparation and the
            semiconductor roadmap. The same topic can support more than one, but the progress of each is tracked
            separately. Nothing here assumes your marks or CGPA — enter them yourself.
          </p>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'college', label: 'A · College academics' },
          { value: 'gate', label: 'B · GATE preparation' },
          { value: 'semiconductor', label: 'C · Semiconductor skills' },
        ]}
      />
      {tab === 'college' && <CollegeSection />}
      {tab === 'gate' && <GateSection />}
      {tab === 'semiconductor' && <SemiconductorSection />}
    </div>
  );
}

/* ================================ COLLEGE ================================ */

function CollegeSection() {
  const data = useStore((s) => s.data);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollegeSubject | null>(null);
  const today = todayISO();

  if (data.collegeSubjects.length === 0) {
    return (
      <Card>
        <Empty
          title="No subjects yet"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> Add a subject
            </Button>
          }
        >
          Add each semester subject with its syllabus topics, then coverage, revision depth and exam readiness are
          computed from what you actually record.
        </Empty>
        <SubjectModal open={creating} onClose={() => setCreating(false)} />
      </Card>
    );
  }

  const atRisk = data.collegeSubjects.filter((s) => {
    if (!s.examDate) return false;
    const r = examReadiness(s, data.practiceLogs, today).value;
    const c = syllabusCoverage(s).value;
    return r < 0.45 || c < 0.5;
  });

  return (
    <div className="stack">
      {atRisk.length > 0 && (
        <Note tone="warn" title="Academic risk:">
          {atRisk.map((s) => s.name).join(', ')} — low coverage or low exam readiness relative to the exam date.
        </Note>
      )}

      <div className="grid grid-2">
        {data.collegeSubjects.map((s) => (
          <SubjectCard
            key={s.id}
            subject={s}
            data={data}
            onEdit={() => setEditing(s)}
          />
        ))}
      </div>

      <Button onClick={() => setCreating(true)} style={{ alignSelf: 'flex-start' }}>
        <IconPlus size={13} /> Add subject
      </Button>

      <SubjectModal open={creating} onClose={() => setCreating(false)} />
      {editing && <SubjectModal open subject={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SubjectCard({
  subject,
  data,
  onEdit,
}: {
  subject: CollegeSubject;
  data: AppData;
  onEdit: () => void;
}) {
  const toast = useToast();
  const today = todayISO();
  const coverage = syllabusCoverage(subject);
  const revision = revisionCoverage(subject);
  const readiness = examReadiness(subject, data.practiceLogs, today);
  const [showTopics, setShowTopics] = useState(true);

  const tone = readiness.value >= 0.65 ? 'ok' : readiness.value >= 0.4 ? 'warn' : 'danger';

  return (
    <Card
      title={`${subject.name}`}
      subtitle={`${subject.code} · ${subject.semester} · ${subject.credits} credits`}
      actions={
        <>
          <Button size="sm" onClick={onEdit}>
            <IconEdit size={13} /> Edit
          </Button>
          <IconButton
            label="Delete subject"
            onClick={() => {
              actions.removeSubject(subject.id);
              toast({ title: 'Subject removed', body: subject.name, tone: 'warn' });
            }}
          >
            <IconTrash size={13} />
          </IconButton>
        </>
      }
    >
      <div className="stack">
        <div className="row-wrap">
          {subject.examDate && <DeadlineChip label={`Exam ${deadlineLabel(subject.examDate)}`} tone={deadlineTone(subject.examDate)} />}
          {subject.assignmentDue && (
            <DeadlineChip label={`Assignment ${deadlineLabel(subject.assignmentDue)}`} tone={deadlineTone(subject.assignmentDue)} />
          )}
          {subject.internalMarks !== undefined && (
            <Badge tone="info">
              Internal {subject.internalMarks}/{subject.internalMax ?? 30}
            </Badge>
          )}
          {subject.examMarks !== undefined && (
            <Badge tone="ok">
              Exam {subject.examMarks}/{subject.examMax ?? 70}
            </Badge>
          )}
          {subject.grade && <Badge tone="accent">Grade {subject.grade}</Badge>}
        </div>

        <div className="metric-grid">
          <Metric label="Syllabus coverage" value={pct(coverage.value)} sub={`${coverage.doneCount}/${coverage.itemCount} topics done`} />
          <Metric label="Revision depth" value={pct(revision)} sub="none → mastered per topic" />
          <Metric label="Exam readiness" value={pct(readiness.value)} sub="separate from coverage" />
        </div>

        <div>
          <div className="row">
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Syllabus coverage</span>
            <div className="spacer" />
            <span className="progress-num">{pct(coverage.value)}</span>
          </div>
          <Progress value={coverage.value} label={`${subject.name} syllabus coverage`} showValue={false} />
        </div>
        <div>
          <div className="row">
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Exam readiness</span>
            <div className="spacer" />
            <span className="progress-num">{pct(readiness.value)}</span>
          </div>
          <Progress value={readiness.value} tone={tone} label={`${subject.name} exam readiness`} showValue={false} />
        </div>

        <Note tone={tone === 'ok' ? 'info' : tone === 'warn' ? 'warn' : 'danger'}>
          Coverage {pct(coverage.value)} but readiness {pct(readiness.value)}.
          {coverage.value - readiness.value > 0.2
            ? ' You have seen the material but have not proved it under exam conditions — add timed practice.'
            : ' Coverage and readiness are close.'}
        </Note>

        <details open={showTopics} onToggle={(e) => setShowTopics((e.target as HTMLDetailsElement).open)}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
            Syllabus topics ({subject.topics.length})
          </summary>
          <TopicEditor
            topics={subject.topics}
            onChange={(topics) => actions.updateSubject(subject.id, { topics })}
          />
        </details>

        <div>
          <div className="section-title">Exam readiness components</div>
          <div className="table-wrap">
            <table>
              <tbody>
                {readiness.components.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td className="num">{Math.round(c.value * 100)}%</td>
                    <td className="num" style={{ color: 'var(--text-3)' }}>
                      {c.weight > 0 ? `weight ${c.weight}` : 'penalty term'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Formula>
            readiness = 0.25·confidence + 0.20·revision + 0.20·practice volume + 0.10·practice recency +
            0.25·timed assessment average − 0.20·weak-topic share
          </Formula>
        </div>

        {readiness.weakTopics.length > 0 && (
          <Note tone="warn" title="Weak topics:">
            {readiness.weakTopics.join(', ')}
          </Note>
        )}

        <TimedAssessments subject={subject} />

        <RecurringMistakes subject={subject} />
      </div>
    </Card>
  );
}

function TopicEditor({
  topics,
  onChange,
}: {
  topics: SyllabusTopic[];
  onChange: (t: SyllabusTopic[]) => void;
}) {
  const [title, setTitle] = useState('');

  const update = (id: string, changes: Partial<SyllabusTopic>) =>
    onChange(topics.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  return (
    <div className="stack mt-8">
      {topics.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No topics yet — add the syllabus units below.</p>}
      {topics.map((t) => (
        <div className="list-item" key={t.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="title" style={{ flex: 1 }}>
                {t.title}
              </span>
              <Select
                value={t.status}
                onChange={(e) => update(t.id, { status: e.target.value as SyllabusTopic['status'] })}
                style={{ width: 118 }}
                aria-label={`Status for ${t.title}`}
              >
                <option value="not_started">Not started</option>
                <option value="learning">Learning</option>
                <option value="done">Done</option>
              </Select>
              <Select
                value={t.revision}
                onChange={(e) => update(t.id, { revision: e.target.value as SyllabusTopic['revision'] })}
                style={{ width: 108 }}
                aria-label={`Revision for ${t.title}`}
              >
                <option value="none">No revision</option>
                <option value="once">Revised once</option>
                <option value="twice">Revised twice</option>
                <option value="mastered">Mastered</option>
              </Select>
              <Select
                value={t.confidence}
                onChange={(e) => update(t.id, { confidence: Number(e.target.value) as SyllabusTopic['confidence'] })}
                style={{ width: 74 }}
                aria-label={`Confidence for ${t.title}`}
              >
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <option key={c} value={c}>
                    {c}/5
                  </option>
                ))}
              </Select>
              <label className="row" style={{ gap: 5, fontSize: 11.5 }}>
                <input type="checkbox" className="checkbox" checked={t.weak} onChange={(e) => update(t.id, { weak: e.target.checked })} />
                weak
              </label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={t.weight}
                onChange={(e) => update(t.id, { weight: Number(e.target.value) })}
                style={{ width: 56 }}
                aria-label={`Weight for ${t.title}`}
              />
              <IconButton label={`Delete ${t.title}`} onClick={() => onChange(topics.filter((x) => x.id !== t.id))}>
                <IconTrash size={13} />
              </IconButton>
            </div>
          </div>
        </div>
      ))}
      <div className="row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add syllabus topic / unit" />
        <Button
          disabled={!title.trim()}
          onClick={() => {
            onChange([
              ...topics,
              {
                id: `st_${Date.now()}`,
                title: title.trim(),
                weight: 1,
                status: 'not_started',
                revision: 'none',
                confidence: 0,
                weak: false,
                notes: '',
              },
            ]);
            setTitle('');
          }}
        >
          <IconPlus size={13} /> Add
        </Button>
      </div>
    </div>
  );
}

function TimedAssessments({ subject }: { subject: CollegeSubject }) {
  const toast = useToast();
  const [draft, setDraft] = useState({ date: todayISO(), title: '', score: 0, max: 25 });
  const avg =
    subject.timedAssessments.length > 0
      ? subject.timedAssessments.reduce((s, a) => s + (a.max > 0 ? a.score / a.max : 0), 0) /
        subject.timedAssessments.length
      : 0;

  return (
    <div>
      <div className="section-title">Timed assessments</div>
      {subject.timedAssessments.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          No timed papers recorded. Exam readiness cannot be verified without them.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Paper</th>
                <th className="num">Score</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {subject.timedAssessments.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.title}</td>
                  <td className="num">
                    {a.score}/{a.max}
                  </td>
                  <td className="num">{a.max ? Math.round((a.score / a.max) * 100) : 0}%</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ fontWeight: 600 }}>
                  Average
                </td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {Math.round(avg * 100)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="form-grid mt-8">
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Paper title">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Score">
          <Input type="number" min={0} value={draft.score} onChange={(e) => setDraft({ ...draft, score: Number(e.target.value) })} />
        </Field>
        <Field label="Max">
          <Input type="number" min={1} value={draft.max} onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })} />
        </Field>
      </div>
      <Button
        size="sm"
        className="mt-8"
        disabled={!draft.title.trim() || draft.max <= 0 || draft.score > draft.max}
        onClick={() => {
          actions.updateSubject(subject.id, {
            timedAssessments: [
              ...subject.timedAssessments,
              { id: `ta_${Date.now()}`, ...draft, title: draft.title.trim() },
            ],
          });
          setDraft({ ...draft, title: '', score: 0 });
          toast({ title: 'Assessment recorded', tone: 'ok' });
        }}
      >
        <IconPlus size={13} /> Record assessment
      </Button>
    </div>
  );
}

function RecurringMistakes({ subject }: { subject: CollegeSubject }) {
  const [text, setText] = useState('');
  return (
    <div>
      <div className="section-title">Recurring mistakes</div>
      {subject.recurringMistakes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Write down the mistakes you keep making — they are the cheapest marks to recover.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'grid', gap: 4 }}>
          {subject.recurringMistakes.map((m, i) => (
            <li key={i}>
              {m}{' '}
              <button
                type="button"
                className="btn btn-xs"
                onClick={() =>
                  actions.updateSubject(subject.id, {
                    recurringMistakes: subject.recurringMistakes.filter((_, j) => j !== i),
                  })
                }
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row mt-8">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. forgetting the visited set in DFS" />
        <Button
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            actions.updateSubject(subject.id, { recurringMistakes: [...subject.recurringMistakes, text.trim()] });
            setText('');
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function SubjectModal({
  open,
  subject,
  onClose,
}: {
  open: boolean;
  subject?: CollegeSubject;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => ({
    code: subject?.code ?? '',
    name: subject?.name ?? '',
    semester: subject?.semester ?? '',
    credits: subject?.credits ?? 4,
    internalMarks: subject?.internalMarks?.toString() ?? '',
    internalMax: subject?.internalMax?.toString() ?? '30',
    examMarks: subject?.examMarks?.toString() ?? '',
    examMax: subject?.examMax?.toString() ?? '70',
    grade: subject?.grade ?? '',
    examDate: subject?.examDate ?? '',
    assignmentDue: subject?.assignmentDue ?? '',
    notes: subject?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  function submit() {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Subject name is required.';
    if (draft.internalMarks && Number(draft.internalMarks) > Number(draft.internalMax || 30))
      e.internalMarks = 'Internal marks cannot exceed the maximum.';
    if (draft.examMarks && Number(draft.examMarks) > Number(draft.examMax || 70))
      e.examMarks = 'Exam marks cannot exceed the maximum.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      semester: draft.semester.trim(),
      credits: Number(draft.credits) || 0,
      internalMarks: draft.internalMarks === '' ? undefined : Number(draft.internalMarks),
      internalMax: draft.internalMax === '' ? undefined : Number(draft.internalMax),
      examMarks: draft.examMarks === '' ? undefined : Number(draft.examMarks),
      examMax: draft.examMax === '' ? undefined : Number(draft.examMax),
      grade: draft.grade.trim() || undefined,
      examDate: draft.examDate || undefined,
      assignmentDue: draft.assignmentDue || undefined,
      notes: draft.notes,
    };
    if (subject) {
      actions.updateSubject(subject.id, payload);
      toast({ title: 'Subject updated', tone: 'ok' });
    } else {
      actions.addSubject({ ...payload, topics: [], timedAssessments: [], recurringMistakes: [] });
      toast({ title: 'Subject added', body: 'Add its syllabus topics to start tracking coverage.', tone: 'ok' });
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subject ? 'Edit subject' : 'Add subject'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {subject ? 'Save' : 'Add subject'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Subject name" required error={errors.name}>
          <Input value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Code">
          <Input value={draft.code} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <Field label="Semester">
          <Input value={draft.semester} onChange={(e) => set('semester', e.target.value)} />
        </Field>
        <Field label="Credits">
          <Input type="number" min={0} value={draft.credits} onChange={(e) => set('credits', e.target.value)} />
        </Field>
        <Field label="Internal marks">
          <Input type="number" min={0} value={draft.internalMarks} onChange={(e) => set('internalMarks', e.target.value)} />
        </Field>
        <Field label="Internal max">
          <Input type="number" min={1} value={draft.internalMax} onChange={(e) => set('internalMax', e.target.value)} />
        </Field>
        <Field label="Exam marks" error={errors.examMarks}>
          <Input type="number" min={0} value={draft.examMarks} onChange={(e) => set('examMarks', e.target.value)} />
        </Field>
        <Field label="Exam max">
          <Input type="number" min={1} value={draft.examMax} onChange={(e) => set('examMax', e.target.value)} />
        </Field>
        <Field label="Grade">
          <Input value={draft.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. A" />
        </Field>
        <Field label="Exam date">
          <Input type="date" value={draft.examDate} onChange={(e) => set('examDate', e.target.value)} />
        </Field>
        <Field label="Assignment due">
          <Input type="date" value={draft.assignmentDue} onChange={(e) => set('assignmentDue', e.target.value)} />
        </Field>
        <Field label="Notes" className="span-2">
          <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10 }}>
        Marks and grades are manual entry only. Nothing is assumed or estimated.
      </p>
    </Modal>
  );
}

/* ================================ GATE ================================ */

function GateSection() {
  const data = useStore((s) => s.data);
  const [creating, setCreating] = useState(false);
  const stats = useMemo(
    () => gateStats(data.practiceLogs, data.mockTests, data.gateSubjects),
    [data.practiceLogs, data.mockTests, data.gateSubjects],
  );
  const overall = gateProgress(data.gateSubjects);
  const mocks = [...data.mockTests].sort((a, b) => a.date.localeCompare(b.date));
  const [weeklyTarget, setWeeklyTarget] = useState('80');

  const weekStart = addDays(todayISO(), -6);
  const thisWeek = data.practiceLogs.filter((l) => l.scope === 'gate' && l.date >= weekStart);
  const weekAttempts = thisWeek.reduce((s, l) => s + l.attempted, 0);

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Card bodyClass="tight">
          <Metric label="Syllabus progress" value={pct(overall)} sub="weighted topic completion" />
        </Card>
        <Card bodyClass="tight">
          <Metric label="PYQs attempted" value={stats.pyqsAttempted} sub={`${stats.solvedIndependently} independent`} />
        </Card>
        <Card bodyClass="tight">
          <Metric
            label="Accuracy"
            value={stats.pyqsAttempted ? `${Math.round(stats.accuracy * 100)}%` : 'n/a'}
            sub="independently solved ÷ attempted"
          />
        </Card>
        <Card bodyClass="tight">
          <Metric
            label="Mock average"
            value={mocks.length ? `${Math.round(stats.averageMock * 100)}%` : 'n/a'}
            sub={mocks.length ? `best ${Math.round(stats.bestMock * 100)}%` : 'no mocks yet'}
          />
        </Card>
      </div>

      <Card
        title="Weekly question target"
        subtitle="Kept separate from college syllabus progress even when the same topic serves both."
      >
        <div className="row-wrap">
          <Field label="Questions per week">
            <Input type="number" min={0} value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} style={{ width: 110 }} />
          </Field>
          <div className="metric">
            <span className="metric-label">This week</span>
            <span className="metric-value">{weekAttempts}</span>
            <span className="metric-sub">
              {Number(weeklyTarget) > 0 ? `${Math.round((weekAttempts / Number(weeklyTarget)) * 100)}% of target` : '—'}
            </span>
          </div>
        </div>
        <div className="mt-8">
          <Progress
            value={Number(weeklyTarget) > 0 ? weekAttempts / Number(weeklyTarget) : 0}
            label="Weekly question target"
          />
        </div>
      </Card>

      {mocks.length > 0 && (
        <Card title="Mock test trend" subtitle="Score percentage over time — the outcome metric for GATE prep.">
          <LineChart
            labels={mocks.map((m) => m.date.slice(5))}
            series={[{ label: 'Mock score %', values: mocks.map((m) => (m.max ? m.score / m.max : 0)) }]}
            yFormat={(v) => `${Math.round(v * 100)}%`}
          />
        </Card>
      )}

      <Card
        title="Subjects & topics"
        subtitle="Concepts learned, in progress and upcoming, with topic-level deadlines and revision cycles."
        actions={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <IconPlus size={13} /> Add subject
          </Button>
        }
      >
        {data.gateSubjects.length === 0 ? (
          <Empty title="No GATE subjects">Add the subjects in your syllabus with their topic hierarchy.</Empty>
        ) : (
          <div className="stack">
            {data.gateSubjects.map((s) => (
              <GateSubjectCard key={s.id} subject={s} />
            ))}
          </div>
        )}
      </Card>

      <MockTestsCard />
      <PyqLogCard />

      {stats.weakTopics.length > 0 && (
        <Card title="Weak-topic list" subtitle="Derived from topics you flagged weak across subjects.">
          <div className="row-wrap">
            {stats.weakTopics.map((t) => (
              <Badge key={t} tone="danger">
                {t}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {creating && <GateSubjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function GateSubjectCard({ subject }: { subject: GateSubject }) {
  const toast = useToast();
  const p = gateTopicProgress(subject);
  const [title, setTitle] = useState('');
  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="card-head">
        <div>
          <h3>{subject.name}</h3>
          <span className="hint">weight {subject.weight} · {subject.topics.length} topics</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <input
            type="number"
            min={1}
            value={subject.weight}
            onChange={(e) => actions.updateGateSubject(subject.id, { weight: Number(e.target.value) })}
            style={{ width: 60 }}
            aria-label={`Weight for ${subject.name}`}
          />
          <IconButton
            label={`Delete ${subject.name}`}
            onClick={() => {
              actions.removeGateSubject(subject.id);
              toast({ title: 'Subject removed', body: subject.name, tone: 'warn' });
            }}
          >
            <IconTrash size={13} />
          </IconButton>
        </div>
      </div>
      <div className="card-body">
        <Progress value={p} label={`${subject.name} progress`} />
        <div className="list mt-12">
          {subject.topics.map((t) => (
            <div className="list-item" key={t.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="title" style={{ flex: 1, minWidth: 140 }}>
                    {t.title}
                  </span>
                  <Select
                    value={t.status}
                    onChange={(e) =>
                      actions.updateGateSubject(subject.id, {
                        topics: subject.topics.map((x) =>
                          x.id === t.id ? { ...x, status: e.target.value as typeof x.status } : x,
                        ),
                      })
                    }
                    style={{ width: 118 }}
                    aria-label={`Status for ${t.title}`}
                  >
                    <option value="not_started">Upcoming</option>
                    <option value="learning">In progress</option>
                    <option value="done">Learned</option>
                  </Select>
                  <Select
                    value={t.confidence}
                    onChange={(e) =>
                      actions.updateGateSubject(subject.id, {
                        topics: subject.topics.map((x) =>
                          x.id === t.id ? { ...x, confidence: Number(e.target.value) as typeof x.confidence } : x,
                        ),
                      })
                    }
                    style={{ width: 74 }}
                    aria-label={`Confidence for ${t.title}`}
                  >
                    {[0, 1, 2, 3, 4, 5].map((c) => (
                      <option key={c} value={c}>
                        {c}/5
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={t.revisionCycle}
                    onChange={(e) =>
                      actions.updateGateSubject(subject.id, {
                        topics: subject.topics.map((x) =>
                          x.id === t.id ? { ...x, revisionCycle: Number(e.target.value) as typeof x.revisionCycle } : x,
                        ),
                      })
                    }
                    style={{ width: 108 }}
                    aria-label={`Revision cycle for ${t.title}`}
                  >
                    <option value={0}>No revision</option>
                    <option value={1}>Cycle 1</option>
                    <option value={2}>Cycle 2</option>
                    <option value={3}>Cycle 3</option>
                  </Select>
                  <label className="row" style={{ gap: 5, fontSize: 11.5 }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={t.weak}
                      onChange={(e) =>
                        actions.updateGateSubject(subject.id, {
                          topics: subject.topics.map((x) => (x.id === t.id ? { ...x, weak: e.target.checked } : x)),
                        })
                      }
                    />
                    weak
                  </label>
                  <input
                    type="date"
                    value={t.dueDate ?? ''}
                    onChange={(e) =>
                      actions.updateGateSubject(subject.id, {
                        topics: subject.topics.map((x) => (x.id === t.id ? { ...x, dueDate: e.target.value || undefined } : x)),
                      })
                    }
                    style={{ width: 140 }}
                    aria-label={`Deadline for ${t.title}`}
                  />
                  {t.dueDate && <DeadlineChip label={deadlineLabel(t.dueDate)} tone={deadlineTone(t.dueDate)} />}
                  <IconButton
                    label={`Delete ${t.title}`}
                    onClick={() =>
                      actions.updateGateSubject(subject.id, { topics: subject.topics.filter((x) => x.id !== t.id) })
                    }
                  >
                    <IconTrash size={13} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="row mt-8">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add topic" />
          <Button
            size="sm"
            disabled={!title.trim()}
            onClick={() => {
              actions.updateGateSubject(subject.id, {
                topics: [
                  ...subject.topics,
                  {
                    id: `gt_${Date.now()}`,
                    title: title.trim(),
                    weight: 1,
                    status: 'not_started',
                    confidence: 0,
                    weak: false,
                    revisionCycle: 0,
                    notes: '',
                  },
                ],
              });
              setTitle('');
            }}
          >
            <IconPlus size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function GateSubjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('8');
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title="Add GATE subject"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              actions.addGateSubject({ name: name.trim(), weight: Number(weight) || 1, topics: [] });
              toast({ title: 'Subject added', tone: 'ok' });
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Subject name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Weight in the syllabus" help="Roughly the mark share.">
          <Input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function MockTestsCard() {
  const data = useStore((s) => s.data);
  const toast = useToast();
  const [draft, setDraft] = useState({
    date: todayISO(),
    title: '',
    score: 0,
    max: 100,
    attempted: 0,
    correct: 0,
    timeLimitMinutes: 180,
    finishedInMinutes: 180,
    weakTopics: '',
    note: '',
  });
  const mocks = [...data.mockTests].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card title="Mock tests" subtitle="Timed practice performance — the only honest signal of exam readiness.">
      {mocks.length > 0 && (
        <div className="table-wrap mb-12">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Test</th>
                <th className="num">Score</th>
                <th className="num">%</th>
                <th className="num">Attempted</th>
                <th className="num">Correct</th>
                <th className="num">Time</th>
                <th>Weak topics</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mocks.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>{m.title}</td>
                  <td className="num">
                    {m.score}/{m.max}
                  </td>
                  <td className="num">{m.max ? Math.round((m.score / m.max) * 100) : 0}%</td>
                  <td className="num">{m.attempted}</td>
                  <td className="num">{m.correct}</td>
                  <td className="num">
                    {m.finishedInMinutes}/{m.timeLimitMinutes}m
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{m.weakTopics || '—'}</td>
                  <td>
                    <IconButton label="Delete mock test" onClick={() => actions.removeMock(m.id)}>
                      <IconTrash size={13} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-grid">
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Test title">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Full length 3" />
        </Field>
        <Field label="Score">
          <Input type="number" min={0} value={draft.score} onChange={(e) => setDraft({ ...draft, score: Number(e.target.value) })} />
        </Field>
        <Field label="Max marks">
          <Input type="number" min={1} value={draft.max} onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })} />
        </Field>
        <Field label="Attempted">
          <Input type="number" min={0} value={draft.attempted} onChange={(e) => setDraft({ ...draft, attempted: Number(e.target.value) })} />
        </Field>
        <Field label="Correct">
          <Input type="number" min={0} value={draft.correct} onChange={(e) => setDraft({ ...draft, correct: Number(e.target.value) })} />
        </Field>
        <Field label="Time limit (min)">
          <Input
            type="number"
            min={1}
            value={draft.timeLimitMinutes}
            onChange={(e) => setDraft({ ...draft, timeLimitMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Finished in (min)">
          <Input
            type="number"
            min={0}
            value={draft.finishedInMinutes}
            onChange={(e) => setDraft({ ...draft, finishedInMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Weak topics" className="span-2">
          <Input value={draft.weakTopics} onChange={(e) => setDraft({ ...draft, weakTopics: e.target.value })} />
        </Field>
      </div>
      <Button
        size="sm"
        className="mt-8"
        variant="primary"
        disabled={!draft.title.trim() || draft.max <= 0 || draft.score > draft.max}
        onClick={() => {
          actions.addMock({ ...draft, title: draft.title.trim() } as Omit<MockTest, 'id' | 'createdAt'>);
          setDraft({ ...draft, title: '', score: 0, attempted: 0, correct: 0, weakTopics: '' });
          toast({ title: 'Mock test recorded', tone: 'ok' });
        }}
      >
        <IconPlus size={13} /> Record mock test
      </Button>
    </Card>
  );
}

function PyqLogCard() {
  const data = useStore((s) => s.data);
  const toast = useToast();
  const logs = data.practiceLogs.filter((l) => l.scope === 'gate').sort((a, b) => b.date.localeCompare(a.date));
  const [draft, setDraft] = useState({
    date: todayISO(),
    subject: data.gateSubjects[0]?.name ?? '',
    attempted: 10,
    solvedIndependently: 0,
    solvedWithHints: 0,
    revisionNeeded: 0,
    minutes: 45,
  });

  return (
    <Card title="PYQ practice log" subtitle="Attempted, independently solved, solved with hints, flagged for revision.">
      <div className="form-grid">
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Subject">
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="Attempted">
          <Input type="number" min={0} value={draft.attempted} onChange={(e) => setDraft({ ...draft, attempted: Number(e.target.value) })} />
        </Field>
        <Field label="Independent">
          <Input
            type="number"
            min={0}
            value={draft.solvedIndependently}
            onChange={(e) => setDraft({ ...draft, solvedIndependently: Number(e.target.value) })}
          />
        </Field>
        <Field label="With hints">
          <Input
            type="number"
            min={0}
            value={draft.solvedWithHints}
            onChange={(e) => setDraft({ ...draft, solvedWithHints: Number(e.target.value) })}
          />
        </Field>
        <Field label="Revision needed">
          <Input
            type="number"
            min={0}
            value={draft.revisionNeeded}
            onChange={(e) => setDraft({ ...draft, revisionNeeded: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Button
        size="sm"
        className="mt-8"
        variant="primary"
        disabled={draft.attempted <= 0 || !draft.subject.trim()}
        onClick={() => {
          if (draft.solvedIndependently + draft.solvedWithHints > draft.attempted) {
            toast({ title: 'Counts exceed attempted', tone: 'danger' });
            return;
          }
          actions.addPractice({ ...draft, scope: 'gate', subject: draft.subject.trim(), note: '' });
          setDraft({ ...draft, solvedIndependently: 0, solvedWithHints: 0, revisionNeeded: 0 });
          toast({ title: 'PYQ practice logged', tone: 'ok' });
        }}
      >
        <IconPlus size={13} /> Log PYQ practice
      </Button>

      {logs.length > 0 && (
        <div className="table-wrap mt-12">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th className="num">Attempted</th>
                <th className="num">Independent</th>
                <th className="num">Hints</th>
                <th className="num">Accuracy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 10).map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{l.subject}</td>
                  <td className="num">{l.attempted}</td>
                  <td className="num">{l.solvedIndependently}</td>
                  <td className="num">{l.solvedWithHints}</td>
                  <td className="num">{l.attempted ? Math.round((l.solvedIndependently / l.attempted) * 100) : 0}%</td>
                  <td>
                    <IconButton label="Delete log" onClick={() => actions.removePractice(l.id)}>
                      <IconTrash size={13} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ============================ SEMICONDUCTOR ============================ */

const PHASES: { id: RoadmapTopic['phase']; label: string; blurb: string }[] = [
  { id: 'foundations', label: 'Foundations', blurb: 'Physics, materials, band theory, doping, carrier transport.' },
  { id: 'process', label: 'Fabrication processes', blurb: 'Oxidation, deposition, lithography, etching, implantation, integration, cleanroom.' },
  { id: 'devices', label: 'Device engineering', blurb: 'PN junctions, MOS structures, CMOS and device fundamentals.' },
  { id: 'practical', label: 'Practical projects', blurb: 'TCAD, process data analysis, characterization — the artefacts you can show.' },
];

function SemiconductorSection() {
  const data = useStore((s) => s.data);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoadmapTopic | null>(null);
  const p = roadmapProgress(data.roadmap);
  const learning = data.roadmap.filter((t) => t.status === 'learning');
  const next = data.roadmap.filter((t) => t.status === 'not_started').sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'))[0];

  return (
    <div className="stack">
      <Card
        title="Semiconductor roadmap"
        subtitle="An exploratory career roadmap, not a claim that every topic is required for every role. Foundational knowledge is kept separate from processes, devices and practical projects."
        actions={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <IconPlus size={13} /> Add topic
          </Button>
        }
      >
        <div className="stack">
          <div className="metric-grid">
            <Metric label="Roadmap progress" value={pct(p.value)} sub={`${p.doneCount}/${p.itemCount} topics done (weighted)`} />
            <Metric label="Learning now" value={learning.length} sub={learning.map((t) => t.title).join(', ') || '—'} />
            <Metric label="Next up" value={next ? next.title.slice(0, 26) : '—'} sub={next?.targetDate ? fmtDate(next.targetDate) : 'no target date'} />
            <Metric label="Unverified" value={p.unverified.length} sub="done without notes, assignment or link" />
          </div>
          <Progress value={p.value} label="Semiconductor roadmap progress" />
          <Note>
            This roadmap is a suggestion. Edit, delete or reorder topics to match the roles you are actually aiming at.
          </Note>
        </div>
      </Card>

      {PHASES.map((phase) => {
        const topics = data.roadmap.filter((t) => t.phase === phase.id);
        const phaseProgress = roadmapProgress(topics);
        return (
          <Card
            key={phase.id}
            title={phase.label}
            subtitle={phase.blurb}
            actions={<Badge tone="accent">{Math.round(phaseProgress.value * 100)}%</Badge>}
            bodyClass="tight"
          >
            {topics.length === 0 ? (
              <Empty title="No topics in this phase">Add one to start building this part of the roadmap.</Empty>
            ) : (
              <div className="list">
                {topics.map((t) => (
                  <div className="list-item" key={t.id}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={t.status === 'done'}
                      aria-label={`Mark ${t.title} done`}
                      onChange={() =>
                        actions.updateRoadmapTopic(t.id, {
                          status: t.status === 'done' ? 'learning' : 'done',
                        })
                      }
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title" style={{ textDecoration: t.status === 'done' ? 'line-through' : undefined }}>
                        {t.title}
                      </div>
                      <div className="meta">
                        <Badge>{t.phase}</Badge>
                        <Badge tone="info">weight {t.weight}</Badge>
                        {t.tools && <span>{t.tools}</span>}
                        {t.targetDate && <DeadlineChip label={deadlineLabel(t.targetDate)} tone={deadlineTone(t.targetDate)} />}
                        {t.seeded && <Badge>suggested</Badge>}
                        {t.status === 'done' && t.evidence.length === 0 && !t.assignment && (
                          <Badge tone="warn">no artefact</Badge>
                        )}
                      </div>
                      {t.assignment && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>Assignment: {t.assignment}</p>}
                      {t.notes && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{t.notes}</p>}
                      <div className="mt-8">
                        <EvidenceList
                          items={t.evidence}
                          emptyLabel="No notes, simulation or write-up linked yet."
                          onAdd={(e) =>
                            actions.updateRoadmapTopic(t.id, {
                              evidence: [...t.evidence, { ...e, id: `ev_${Date.now()}`, createdAt: todayISO() }],
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="row" style={{ flex: 'none' }}>
                      <IconButton label="Edit topic" onClick={() => setEditing(t)}>
                        <IconEdit size={13} />
                      </IconButton>
                      <IconButton label="Delete topic" onClick={() => actions.removeRoadmapTopic(t.id)}>
                        <IconTrash size={13} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {(creating || editing) && (
        <RoadmapModal topic={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </div>
  );
}

function RoadmapModal({ topic, onClose }: { topic?: RoadmapTopic; onClose: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    phase: topic?.phase ?? ('foundations' as RoadmapTopic['phase']),
    title: topic?.title ?? '',
    weight: topic?.weight ?? 1,
    status: topic?.status ?? ('not_started' as RoadmapTopic['status']),
    targetDate: topic?.targetDate ?? '',
    tools: topic?.tools ?? '',
    assignment: topic?.assignment ?? '',
    notes: topic?.notes ?? '',
  });
  const set = (k: keyof typeof draft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={topic ? 'Edit roadmap topic' : 'Add roadmap topic'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!draft.title.trim()}
            onClick={() => {
              const payload = {
                ...draft,
                title: draft.title.trim(),
                targetDate: draft.targetDate || undefined,
              };
              if (topic) {
                actions.updateRoadmapTopic(topic.id, payload);
                toast({ title: 'Topic updated', tone: 'ok' });
              } else {
                actions.addRoadmapTopic(payload);
                toast({ title: 'Topic added', tone: 'ok' });
              }
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Topic" required className="span-2">
          <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Phase">
          <Select value={draft.phase} onChange={(e) => set('phase', e.target.value)}>
            {PHASES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value)}>
            <option value="not_started">Not started</option>
            <option value="learning">Learning</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <Field label="Weight">
          <Input type="number" min={0.5} step={0.5} value={draft.weight} onChange={(e) => set('weight', Number(e.target.value))} />
        </Field>
        <Field label="Target date">
          <Input type="date" value={draft.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </Field>
        <Field label="Tools" className="span-2" help="Software or equipment: Sentaurus TCAD, Python, cleanroom access…">
          <Input value={draft.tools} onChange={(e) => set('tools', e.target.value)} />
        </Field>
        <Field label="Practical assignment" className="span-2">
          <Input value={draft.assignment} onChange={(e) => set('assignment', e.target.value)} />
        </Field>
        <Field label="Notes" className="span-2">
          <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
