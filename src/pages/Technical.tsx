import { useMemo, useState } from 'react';
import type { AppData, PracticeLog, TrackId, TrackProject, TrackTopic } from '../types';
import { TRACK_LABELS } from '../types';
import { actions, useStore } from '../state/store';
import { deadlineLabel, deadlineTone, fmtDate, todayISO } from '../lib/date';
import {
  currentlyLearning,
  nextTopics,
  portfolioProgress,
  topicCredit,
  trackProgress,
} from '../domain/progress';
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
  Select,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui';
import { IconArrowDown, IconArrowUp, IconCheck, IconEdit, IconPlus, IconTrash } from '../components/icons';
import { EvidenceList } from '../components/tasks';

const TRACK_IDS: TrackId[] = ['dsa', 'ml', 'genai'];

const TRACK_BLURB: Record<TrackId, string> = {
  dsa: 'Programming fundamentals and interview-style problem solving. Progress counts problems solved independently, not videos watched.',
  ml: 'Applied machine learning from data handling to a deployed project. Concept mastery and project evidence are tracked separately.',
  genai: 'LLM systems: inference, structured outputs, retrieval, tool calling, evaluation. Ends in a working end-to-end application.',
};

export function Technical() {
  const data = useStore((s) => s.data);
  const [tab, setTab] = useState<TrackId | 'portfolio'>('dsa');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Technical</h1>
          <p className="page-sub">
            Three independent tracks running concurrently. A topic is only credited when you record evidence — problems
            solved independently, an assessment passed, a correct explanation or a committed implementation. Learning
            progress and portfolio evidence are separate numbers.
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'dsa', label: 'Track A · DSA' },
          { value: 'ml', label: 'Track B · Machine Learning' },
          { value: 'genai', label: 'Track C · GenAI' },
          { value: 'portfolio', label: 'Portfolio evidence' },
        ]}
      />

      <div className="grid grid-3">
        {TRACK_IDS.map((id) => (
          <TrackSummaryCard key={id} id={id} data={data} active={tab === id} onOpen={() => setTab(id)} />
        ))}
      </div>

      {tab === 'portfolio' ? (
        <PortfolioSection data={data} />
      ) : (
        <TrackSection id={tab} data={data} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TrackSummaryCard({
  id,
  data,
  active,
  onOpen,
}: {
  id: TrackId;
  data: AppData;
  active: boolean;
  onOpen: () => void;
}) {
  const topics = data.topics.filter((t) => t.trackId === id);
  const p = trackProgress(topics);
  const projects = data.trackProjects.filter((x) => x.trackId === id);
  const portfolio = portfolioProgress(projects);
  const learning = currentlyLearning(topics);
  const next = nextTopics(topics, 1)[0];
  const practice = data.practiceLogs.filter((l) => l.scope === id);

  return (
    <Card
      title={TRACK_LABELS[id]}
      subtitle={`${topics.filter((t) => !t.archived).length} topics · ${projects.length} project(s)`}
      actions={
        <Button size="sm" variant={active ? 'primary' : 'default'} onClick={onOpen}>
          Open
        </Button>
      }
      bodyClass="tight"
    >
      <div className="stack" style={{ gap: 8 }}>
        <div>
          <div className="row">
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Topic mastery</span>
            <div className="spacer" />
            <span className="progress-num">{Math.round(p.value * 100)}%</span>
          </div>
          <Progress value={p.value} label={`${TRACK_LABELS[id]} topic mastery`} showValue={false} />
        </div>
        <div>
          <div className="row">
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Portfolio evidence</span>
            <div className="spacer" />
            <span className="progress-num">{Math.round(portfolio.value * 100)}%</span>
          </div>
          <Progress value={portfolio.value} tone="ok" label="Portfolio evidence" showValue={false} />
        </div>
        <div className="kv-list">
          <div className="kv">
            <dt>Learning now</dt>
            <dd>{learning.length ? learning.map((t) => t.title).join(', ') : '—'}</dd>
          </div>
          <div className="kv">
            <dt>Next</dt>
            <dd>{next ? next.title : '—'}</dd>
          </div>
          {id === 'dsa' && (
            <div className="kv">
              <dt>Problems</dt>
              <dd>
                {practice.reduce((s, l) => s + l.solvedIndependently, 0)} independent ·{' '}
                {practice.reduce((s, l) => s + l.solvedWithHints, 0)} with hints
              </dd>
            </div>
          )}
        </div>
        {p.unverified.length > 0 && (
          <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>
            {p.unverified.length} topic(s) marked done without evidence — credited at 60%.
          </span>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TrackSection({ id, data }: { id: TrackId; data: AppData }) {
  const [editing, setEditing] = useState<TrackTopic | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TrackTopic | null>(null);

  const all = useMemo(
    () => data.topics.filter((t) => t.trackId === id).sort((a, b) => a.order - b.order),
    [data.topics, id],
  );
  const topics = showArchived ? all : all.filter((t) => !t.archived);
  const p = trackProgress(all.filter((t) => !t.archived));
  const learning = currentlyLearning(topics);
  const done = topics.filter((t) => t.status === 'done');
  const next = nextTopics(topics, 4);
  const projects = data.trackProjects.filter((x) => x.trackId === id);
  const practice = data.practiceLogs.filter((l) => l.scope === id);
  const totalHours = topics.reduce((s, t) => s + t.estimatedHours, 0);

  function move(topic: TrackTopic, dir: -1 | 1) {
    const list = all.map((t) => t.id);
    const idx = list.indexOf(topic.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    actions.reorderTopics(id, list);
  }

  return (
    <div className="stack">
      <Card
        title={TRACK_LABELS[id]}
        subtitle={TRACK_BLURB[id]}
        actions={
          <>
            <Button size="sm" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide archived' : `Archived (${all.filter((t) => t.archived).length})`}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> Add topic
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="metric-grid">
            <Metric label="Topic mastery" value={`${Math.round(p.value * 100)}%`} sub={`${p.doneCount}/${p.itemCount} topics done (weighted)`} />
            <Metric label="Estimated effort" value={`${totalHours}h`} sub="sum of remaining + completed topic estimates" />
            <Metric label="Learning now" value={learning.length} sub={learning.map((t) => t.title).join(', ') || 'nothing active'} />
            <Metric
              label="Unverified"
              value={p.unverified.length}
              sub={p.unverified.length ? 'marked done, evidence missing' : 'all completions evidenced'}
            />
          </div>

          <Progress value={p.value} label={`${TRACK_LABELS[id]} weighted progress`} />

          {p.unverified.length > 0 && (
            <Note tone="warn" title="Credited partially:">
              {p.unverified.join(', ')}. Add a link, a problem count or a confidence rating of 3+ to get full credit.
            </Note>
          )}

          <div className="grid grid-3" style={{ gap: 12 }}>
            <Column
              title="Currently learning"
              items={learning}
              onOpen={setEditing}
              emptyText="Nothing in progress. Pick the next topic below to start."
            />
            <Column
              title="Already learned"
              items={done}
              onOpen={setEditing}
              emptyText="No completed topics yet."
              showCredit
            />
            <Column
              title="Next to learn"
              items={next}
              onOpen={setEditing}
              emptyText="Everything is complete or archived."
            />
          </div>
        </div>
      </Card>

      <Card
        title="Curriculum"
        subtitle="Editable suggestions. Reorder, archive or delete freely — nothing here assumes prior mastery."
        actions={<Badge tone="plain">{topics.length} topics</Badge>}
        bodyClass="tight"
      >
        {topics.length === 0 ? (
          <Empty
            title="No topics on this track"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <IconPlus size={13} /> Add the first topic
              </Button>
            }
          >
            Add the topics you actually plan to cover, in the order you want to take them.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Order</th>
                  <th>Topic</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 110 }} className="num">Est. hours</th>
                  <th style={{ width: 130 }}>Practice</th>
                  <th style={{ width: 130 }}>Confidence</th>
                  <th style={{ width: 130 }}>Target</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => {
                  const credit = topicCredit(t);
                  const blockedBy = t.prerequisites.filter((pid) => {
                    const pre = all.find((x) => x.id === pid);
                    return pre && pre.status !== 'done' && pre.status !== 'skipped';
                  });
                  return (
                    <tr key={t.id} style={{ opacity: t.archived ? 0.55 : 1 }}>
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          <IconButton label="Move up" onClick={() => move(t, -1)}>
                            <IconArrowUp size={13} />
                          </IconButton>
                          <IconButton label="Move down" onClick={() => move(t, 1)}>
                            <IconArrowDown size={13} />
                          </IconButton>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 550 }}>{t.title}</div>
                        {t.detail && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t.detail}</div>}
                        {blockedBy.length > 0 && (
                          <Badge tone="warn">
                            needs {blockedBy.map((b) => all.find((x) => x.id === b)?.title).join(', ')}
                          </Badge>
                        )}
                        {t.archived && <Badge>archived</Badge>}
                        {t.seeded && <Badge>suggested</Badge>}
                        {t.status === 'done' && !credit.verified && (
                          <Badge tone="warn" title={credit.reason}>
                            unverified
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Select
                          value={t.status}
                          onChange={(e) => actions.updateTopic(t.id, { status: e.target.value as TrackTopic['status'] })}
                          aria-label={`Status for ${t.title}`}
                        >
                          <option value="not_started">Not started</option>
                          <option value="learning">Learning</option>
                          <option value="done">Done</option>
                          <option value="skipped">Skipped</option>
                        </Select>
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          value={t.estimatedHours}
                          onChange={(e) => actions.updateTopic(t.id, { estimatedHours: Number(e.target.value) })}
                          style={{ width: 64, textAlign: 'right' }}
                          aria-label={`Estimated hours for ${t.title}`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={t.practiceDone}
                          onChange={(e) => actions.updateTopic(t.id, { practiceDone: Number(e.target.value) })}
                          style={{ width: 46, textAlign: 'right' }}
                          aria-label={`Practice done for ${t.title}`}
                        />
                        <span style={{ color: 'var(--text-3)' }}> / {t.practiceTarget}</span>
                      </td>
                      <td>
                        <Select
                          value={t.confidence}
                          onChange={(e) =>
                            actions.updateTopic(t.id, { confidence: Number(e.target.value) as TrackTopic['confidence'] })
                          }
                          aria-label={`Confidence for ${t.title}`}
                        >
                          {[0, 1, 2, 3, 4, 5].map((c) => (
                            <option key={c} value={c}>
                              {c}/5
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        {t.targetDate ? (
                          <DeadlineChip label={deadlineLabel(t.targetDate)} tone={deadlineTone(t.targetDate)} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          <IconButton
                            label={t.archived ? 'Restore topic' : 'Archive topic'}
                            onClick={() => actions.updateTopic(t.id, { archived: !t.archived })}
                          >
                            <IconCheck size={13} />
                          </IconButton>
                          <IconButton label="Edit topic" onClick={() => setEditing(t)}>
                            <IconEdit size={13} />
                          </IconButton>
                          <IconButton label="Delete topic" onClick={() => setConfirmDelete(t)}>
                            <IconTrash size={13} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PracticeSection id={id} logs={practice} />
      <ProjectSection id={id} projects={projects} />

      {(creating || editing) && (
        <TopicModal
          open
          trackId={id}
          data={data}
          topic={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete topic?"
        danger
        confirmLabel="Delete topic"
        message={
          <>
            <strong>{confirmDelete?.title}</strong> will be removed and dropped from other topics' prerequisites.
          </>
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) actions.removeTopic(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function Column({
  title,
  items,
  onOpen,
  emptyText,
  showCredit,
}: {
  title: string;
  items: TrackTopic[];
  onOpen: (t: TrackTopic) => void;
  emptyText: string;
  showCredit?: boolean;
}) {
  return (
    <div>
      <div className="section-title">{title}</div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{emptyText}</p>
      ) : (
        <div className="list">
          {items.map((t) => {
            const credit = topicCredit(t);
            return (
              <button
                key={t.id}
                type="button"
                className="list-item"
                onClick={() => onOpen(t)}
                style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    <span>{t.estimatedHours}h</span>
                    {t.practiceTarget > 0 && (
                      <span>
                        {t.practiceDone}/{t.practiceTarget} practice
                      </span>
                    )}
                    <span>confidence {t.confidence}/5</span>
                    {showCredit && !credit.verified && <Badge tone="warn">unverified</Badge>}
                  </div>
                  {t.nextAction && <div style={{ fontSize: 11.5, color: 'var(--accent)', marginTop: 3 }}>→ {t.nextAction}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PracticeSection({ id, logs }: { id: TrackId; logs: PracticeLog[] }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    date: todayISO(),
    subject: '',
    attempted: 0,
    solvedIndependently: 0,
    solvedWithHints: 0,
    revisionNeeded: 0,
    minutes: 45,
    note: '',
  });
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const totals = logs.reduce(
    (acc, l) => ({
      attempted: acc.attempted + l.attempted,
      independent: acc.independent + l.solvedIndependently,
      hints: acc.hints + l.solvedWithHints,
      revision: acc.revision + l.revisionNeeded,
      minutes: acc.minutes + l.minutes,
    }),
    { attempted: 0, independent: 0, hints: 0, revision: 0, minutes: 0 },
  );

  return (
    <Card
      title={id === 'dsa' ? 'Problem practice log' : 'Practice & exercises log'}
      subtitle={
        id === 'dsa'
          ? 'Attempted, solved independently, solved with hints, revision needed. This is the only place "problems solved" comes from.'
          : 'Concepts applied in exercises. Separate from lesson completion and from project milestones.'
      }
    >
      <div className="stack">
        <div className="metric-grid">
          <Metric label="Attempted" value={totals.attempted} />
          <Metric
            label="Independent"
            value={totals.independent}
            sub={totals.attempted ? `${Math.round((totals.independent / totals.attempted) * 100)}% of attempts` : '—'}
          />
          <Metric label="With hints" value={totals.hints} />
          <Metric label="Revision needed" value={totals.revision} sub="flagged for a later pass" />
        </div>

        <div className="form-grid">
          <Field label="Date">
            <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Topic / subject">
            <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="e.g. Arrays & hashing" />
          </Field>
          <Field label="Attempted">
            <Input type="number" min={0} value={draft.attempted} onChange={(e) => setDraft({ ...draft, attempted: Number(e.target.value) })} />
          </Field>
          <Field label="Solved independently">
            <Input
              type="number"
              min={0}
              value={draft.solvedIndependently}
              onChange={(e) => setDraft({ ...draft, solvedIndependently: Number(e.target.value) })}
            />
          </Field>
          <Field label="Solved with hints">
            <Input
              type="number"
              min={0}
              value={draft.solvedWithHints}
              onChange={(e) => setDraft({ ...draft, solvedWithHints: Number(e.target.value) })}
            />
          </Field>
          <Field label="Needs revision">
            <Input
              type="number"
              min={0}
              value={draft.revisionNeeded}
              onChange={(e) => setDraft({ ...draft, revisionNeeded: Number(e.target.value) })}
            />
          </Field>
          <Field label="Minutes">
            <Input type="number" min={0} step={5} value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })} />
          </Field>
          <Field label="Note">
            <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
        </div>
        <div>
          <Button
            variant="primary"
            disabled={draft.attempted <= 0 || !draft.subject.trim()}
            onClick={() => {
              if (draft.solvedIndependently + draft.solvedWithHints > draft.attempted) {
                toast({
                  title: 'Numbers do not add up',
                  tone: 'danger',
                  body: 'Independent + with hints cannot exceed attempted. Fix the counts before logging.',
                });
                return;
              }
              actions.addPractice({ ...draft, scope: id, subject: draft.subject.trim() });
              setDraft({ ...draft, attempted: 0, solvedIndependently: 0, solvedWithHints: 0, revisionNeeded: 0, note: '' });
              toast({ title: 'Practice logged', tone: 'ok' });
            }}
          >
            <IconPlus size={13} /> Log practice
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th className="num">Attempted</th>
                  <th className="num">Independent</th>
                  <th className="num">Hints</th>
                  <th className="num">Revision</th>
                  <th className="num">Min</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td>{l.date}</td>
                    <td>{l.subject}</td>
                    <td className="num">{l.attempted}</td>
                    <td className="num">{l.solvedIndependently}</td>
                    <td className="num">{l.solvedWithHints}</td>
                    <td className="num">{l.revisionNeeded}</td>
                    <td className="num">{l.minutes}</td>
                    <td>
                      <IconButton label="Delete practice log" onClick={() => actions.removePractice(l.id)}>
                        <IconTrash size={13} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          Logging practice never marks a topic complete by itself — set the topic status when you can actually apply it.
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ProjectSection({ id, projects }: { id: TrackId; projects: TrackProject[] }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [targetDate, setTargetDate] = useState(todayISO());
  const p = portfolioProgress(projects);

  return (
    <Card
      title="Project & assignment evidence"
      subtitle="Completing a lesson does not complete a project. This section only moves when project milestones are ticked and a link is attached."
      actions={
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          <IconPlus size={13} /> Add project
        </Button>
      }
    >
      <div className="stack">
        <div className="row">
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Portfolio evidence for this track</span>
          <div className="spacer" />
          <span className="progress-num">{Math.round(p.value * 100)}%</span>
        </div>
        <Progress value={p.value} tone="ok" label="Portfolio evidence" />

        {projects.length === 0 ? (
          <Empty title="No project defined">One end-to-end artefact per track is usually enough. Add it here.</Empty>
        ) : (
          <div className="list">
            {projects.map((pr) => (
              <div className="list-item" key={pr.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{pr.title}</div>
                  {pr.brief && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{pr.brief}</p>}
                  <div className="meta">
                    <Select
                      value={pr.status}
                      onChange={(e) => actions.updateProject(pr.id, { status: e.target.value as TrackProject['status'] })}
                      style={{ width: 130 }}
                      aria-label={`Status for ${pr.title}`}
                    >
                      <option value="idea">Idea</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </Select>
                    {pr.targetDate && <DeadlineChip label={deadlineLabel(pr.targetDate)} tone={deadlineTone(pr.targetDate)} />}
                    {pr.seeded && <Badge>suggested</Badge>}
                  </div>
                  <div className="stack mt-8" style={{ gap: 5 }}>
                    {pr.milestones.map((m) => (
                      <label key={m.id} className="row" style={{ gap: 8, fontSize: 12.5 }}>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={m.done}
                          onChange={() =>
                            actions.updateProject(pr.id, {
                              milestones: pr.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)),
                            })
                          }
                        />
                        {m.title}
                      </label>
                    ))}
                  </div>
                  <div className="mt-8">
                    <EvidenceList
                      items={pr.evidence}
                      emptyLabel="No repo, notebook or deployment link yet."
                      onAdd={(e) =>
                        actions.updateProject(pr.id, {
                          evidence: [...pr.evidence, { ...e, id: `ev_${Date.now()}`, createdAt: todayISO() }],
                        })
                      }
                    />
                  </div>
                </div>
                <IconButton label="Delete project" onClick={() => actions.removeProject(pr.id)}>
                  <IconTrash size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add project"
        size="sm"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!title.trim()}
              onClick={() => {
                actions.addProject({
                  trackId: id,
                  title: title.trim(),
                  brief: brief.trim(),
                  status: 'idea',
                  targetDate,
                  milestones: [],
                  seeded: false,
                });
                setTitle('');
                setBrief('');
                setCreating(false);
                toast({ title: 'Project added', tone: 'ok' });
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Project title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Brief">
            <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} />
          </Field>
          <Field label="Target date">
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

function PortfolioSection({ data }: { data: AppData }) {
  const rows = (['dsa', 'ml', 'genai'] as TrackId[]).map((id) => {
    const topics = data.topics.filter((t) => t.trackId === id && !t.archived);
    const projects = data.trackProjects.filter((p) => p.trackId === id);
    return { id, learning: trackProgress(topics), portfolio: portfolioProgress(projects), projects };
  });

  return (
    <Card
      title="Portfolio evidence across tracks"
      subtitle="Learning progress and portfolio evidence are deliberately separate. A finished lesson is not a finished project."
    >
      {rows.every((r) => r.projects.length === 0) ? (
        <Empty title="No projects yet">Add a project inside any track to start building a portfolio you can show.</Empty>
      ) : (
        <div className="stack">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Track</th>
                  <th className="num">Topic mastery</th>
                  <th className="num">Portfolio evidence</th>
                  <th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{TRACK_LABELS[r.id]}</td>
                    <td className="num">{Math.round(r.learning.value * 100)}%</td>
                    <td className="num">{Math.round(r.portfolio.value * 100)}%</td>
                    <td>{r.projects.map((p) => p.title).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            A project counts as evidence only when its status is <code>done</code> <em>and</em> at least one link is
            attached. That is why the two columns can legitimately disagree.
          </Note>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TopicModal({
  open,
  trackId,
  data,
  topic,
  onClose,
}: {
  open: boolean;
  trackId: TrackId;
  data: AppData;
  topic?: TrackTopic;
  onClose: () => void;
}) {
  const toast = useToast();
  const siblings = data.topics.filter((t) => t.trackId === trackId && t.id !== topic?.id);
  const [draft, setDraft] = useState(() => ({
    title: topic?.title ?? '',
    detail: topic?.detail ?? '',
    weight: topic?.weight ?? 1,
    status: topic?.status ?? ('not_started' as TrackTopic['status']),
    confidence: topic?.confidence ?? (0 as TrackTopic['confidence']),
    estimatedHours: topic?.estimatedHours ?? 8,
    startDate: topic?.startDate ?? '',
    targetDate: topic?.targetDate ?? '',
    prerequisites: topic?.prerequisites ?? [],
    practiceTarget: topic?.practiceTarget ?? 0,
    practiceDone: topic?.practiceDone ?? 0,
    notes: topic?.notes ?? '',
    blockers: topic?.blockers ?? '',
    nextAction: topic?.nextAction ?? '',
  }));
  const [error, setError] = useState('');
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function submit() {
    if (!draft.title.trim()) {
      setError('A topic needs a title.');
      return;
    }
    if (topic) {
      actions.updateTopic(topic.id, {
        ...draft,
        title: draft.title.trim(),
        startDate: draft.startDate || undefined,
        targetDate: draft.targetDate || undefined,
      });
      toast({ title: 'Topic updated', tone: 'ok', body: draft.title });
    } else {
      const maxOrder = data.topics.filter((t) => t.trackId === trackId).reduce((m, t) => Math.max(m, t.order), -1);
      actions.addTopic({
        trackId,
        ...draft,
        title: draft.title.trim(),
        order: maxOrder + 1,
        startDate: draft.startDate || undefined,
        targetDate: draft.targetDate || undefined,
        archived: false,
        seeded: false,
      });
      toast({ title: 'Topic added', tone: 'ok', body: draft.title });
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={topic ? 'Edit topic' : 'Add topic'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {topic ? 'Save topic' : 'Add topic'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Topic title" required error={error} className="span-2">
          <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Detail" className="span-2" help={'What "done" looks like for this topic.'}>
          <Textarea value={draft.detail} onChange={(e) => set('detail', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value as TrackTopic['status'])}>
            <option value="not_started">Not started</option>
            <option value="learning">Learning</option>
            <option value="done">Done</option>
            <option value="skipped">Skipped</option>
          </Select>
        </Field>
        <Field label="Confidence" help={'3+ counts as "can explain it correctly".'}>
          <Select value={draft.confidence} onChange={(e) => set('confidence', Number(e.target.value) as TrackTopic['confidence'])}>
            {[0, 1, 2, 3, 4, 5].map((c) => (
              <option key={c} value={c}>
                {c}/5
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Weight" help="Higher weight moves the track bar more.">
          <Input type="number" min={0.5} step={0.5} value={draft.weight} onChange={(e) => set('weight', Number(e.target.value))} />
        </Field>
        <Field label="Estimated hours">
          <Input type="number" min={0} value={draft.estimatedHours} onChange={(e) => set('estimatedHours', Number(e.target.value))} />
        </Field>
        <Field label="Start date">
          <Input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Target date">
          <Input type="date" value={draft.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </Field>
        <Field label="Practice target" help="Problems or exercises expected before this counts as learned.">
          <Input type="number" min={0} value={draft.practiceTarget} onChange={(e) => set('practiceTarget', Number(e.target.value))} />
        </Field>
        <Field label="Practice done">
          <Input type="number" min={0} value={draft.practiceDone} onChange={(e) => set('practiceDone', Number(e.target.value))} />
        </Field>
        <Field label="Prerequisites" className="span-2">
          <Select
            multiple
            size={3}
            value={draft.prerequisites}
            onChange={(e) => set('prerequisites', Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {siblings.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next action" className="span-2">
          <Input value={draft.nextAction} onChange={(e) => set('nextAction', e.target.value)} />
        </Field>
        <Field label="Blockers" className="span-2">
          <Input value={draft.blockers} onChange={(e) => set('blockers', e.target.value)} />
        </Field>
        <Field label="Notes" className="span-2">
          <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      {topic && (
        <div className="mt-12">
          <div className="section-title">Evidence for this topic</div>
          <EvidenceList
            items={topic.evidence}
            onAdd={(e) => {
              actions.addTopicEvidence(topic.id, e);
              toast({ title: 'Evidence saved', tone: 'ok' });
            }}
          />
        </div>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10 }}>
        A topic marked <code>done</code> without evidence, practice or confidence ≥ 3 is credited at 60% and flagged.
      </p>
      {topic?.targetDate && (
        <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Target: {fmtDate(topic.targetDate)}</p>
      )}
    </Modal>
  );
}
