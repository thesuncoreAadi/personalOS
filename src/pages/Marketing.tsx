import { useMemo, useRef, useState } from 'react';
import type { AccountMetric, AppData, BrandDeal, ContentItem, ContentStage, DealStage } from '../types';
import { actions, useStore } from '../state/store';
import { addDays, fmtDate, lastNWeeks, startOfWeek, todayISO } from '../lib/date';
import { headerIndex, numAt, parseCSV, strAt, toCSV } from '../lib/csv';
import {
  CONVERSION_FORMULA,
  ENGAGEMENT_FORMULA,
  commercialFunnel,
  dealFunnel,
  engagementRate,
  followerGrowth,
  inquiryRate,
  interactions,
  leadRate,
  metricTotals,
  metricsByWeek,
} from '../domain/metrics';
import { BarChart, FunnelBar, LineChart, Sparkline } from '../components/charts';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
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
import { IconDownload, IconEdit, IconPlus, IconTrash, IconUpload } from '../components/icons';

const STAGES: { id: ContentStage; label: string }[] = [
  { id: 'idea', label: 'Ideas' },
  { id: 'research', label: 'Research' },
  { id: 'script', label: 'Script' },
  { id: 'production', label: 'Production' },
  { id: 'editing', label: 'Editing' },
  { id: 'ready', label: 'Ready to publish' },
  { id: 'published', label: 'Published' },
];

const DEAL_STAGES: { id: DealStage; label: string }[] = [
  { id: 'prospect', label: 'Prospect' },
  { id: 'researched', label: 'Researched' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

type TabId = 'pipeline' | 'growth' | 'deals';

export function Marketing() {
  const data = useStore((s) => s.data);
  const [tab, setTab] = useState<TabId>('pipeline');
  const funnel = commercialFunnel(
    data.content,
    data.accounts.flatMap((a) => a.metrics),
    data.deals,
  );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Marketing & Content</h1>
          <p className="page-sub">
            Two properties, one commercial goal: demonstrate creative capability, build audience, attract clients and
            land paid work. Metrics are manual entry or CSV import only — nothing is fetched, estimated or invented.
          </p>
        </div>
      </div>

      <Card title="Commercial funnel" subtitle="Each step is a real count from your own records." bodyClass="tight">
        <div className="grid grid-2" style={{ gap: 16, alignItems: 'center' }}>
          <FunnelBar steps={funnel} />
          <div className="stack" style={{ gap: 6 }}>
            <Note>
              The outcome that matters is not follower count. It is evidence of creative quality, audience traction,
              qualified inquiries and paid collaborations — in that order.
            </Note>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              No posting frequency guarantees a brand deal. What this funnel shows is whether the work you publish is
              converting into interest you can act on.
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pipeline', label: 'A · Content pipeline' },
          { value: 'growth', label: 'B · Growth & performance' },
          { value: 'deals', label: 'C · Brand deals & monetization' },
        ]}
      />

      {tab === 'pipeline' && <PipelineSection data={data} />}
      {tab === 'growth' && <GrowthSection data={data} />}
      {tab === 'deals' && <DealsSection data={data} />}
    </div>
  );
}

/* ============================== PIPELINE ============================== */

function PipelineSection({ data }: { data: AppData }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<ContentStage | null>(null);
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterKind, setFilterKind] = useState<'all' | 'short_form' | 'portfolio_ad'>('all');

  const items = data.content
    .filter((c) => (filterAccount === 'all' ? true : c.accountId === filterAccount))
    .filter((c) => (filterKind === 'all' ? true : c.kind === filterKind));

  function moveTo(id: string, stage: ContentStage) {
    const item = data.content.find((c) => c.id === id);
    if (!item || item.stage === stage) return;
    actions.updateContent(id, {
      stage,
      publishedDate: stage === 'published' ? (item.publishedDate ?? todayISO()) : item.publishedDate,
    });
    if (stage === 'published') {
      toast({
        title: 'Marked published',
        tone: 'ok',
        body: `${item.title} — content output metrics updated.`,
      });
    }
  }

  const published = data.content.filter((c) => c.stage === 'published');
  const portfolioDone = data.content.filter((c) => c.kind === 'portfolio_ad' && c.stage === 'published').length;

  return (
    <div className="stack">
      <Card
        title="Content pipeline"
        subtitle="Drag cards between stages, or use the stage menu on each card. Both organic short-form and portfolio advertisements live here."
        actions={
          <>
            <Select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} style={{ width: 170 }} aria-label="Filter by account">
              <option value="all">All accounts</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as typeof filterKind)}
              style={{ width: 150 }}
              aria-label="Filter by kind"
            >
              <option value="all">All kinds</option>
              <option value="short_form">Short-form</option>
              <option value="portfolio_ad">Portfolio ad</option>
            </Select>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> New content
            </Button>
          </>
        }
        bodyClass="tight"
      >
        <div className="metric-grid mb-12">
          <Metric label="In pipeline" value={items.filter((c) => c.stage !== 'published').length} />
          <Metric label="Ready to publish" value={items.filter((c) => c.stage === 'ready').length} />
          <Metric label="Published" value={published.length} sub={`${portfolioDone} portfolio ads`} />
        </div>

        {items.length === 0 ? (
          <Empty
            title="No content items"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <IconPlus size={13} /> Add the first idea
              </Button>
            }
          >
            Capture ideas as they come. A pipeline with nothing in it is why posting stalls.
          </Empty>
        ) : (
          <div className="kanban">
            {STAGES.map((stage) => {
              const cards = items.filter((c) => c.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  className={`kanban-col ${overStage === stage.id ? 'drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(stage.id);
                  }}
                  onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStage(null);
                    if (dragId) moveTo(dragId, stage.id);
                    setDragId(null);
                  }}
                >
                  <div className="kanban-head">
                    {stage.label}
                    <span className="count">{cards.length}</span>
                  </div>
                  <div className="kanban-body">
                    {cards.map((c) => {
                      const account = data.accounts.find((a) => a.id === c.accountId);
                      return (
                        <div
                          key={c.id}
                          className="kanban-card"
                          draggable
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverStage(null);
                          }}
                        >
                          <div className="k-title">{c.title}</div>
                          <div className="k-meta">
                            <Badge tone={c.kind === 'portfolio_ad' ? 'accent' : 'info'}>
                              {c.kind === 'portfolio_ad' ? 'Portfolio ad' : 'Short-form'}
                            </Badge>
                            {account && <span>{account.name}</span>}
                            {c.pillar && <span>{c.pillar}</span>}
                            {c.plannedDate && <span>plan {fmtDate(c.plannedDate)}</span>}
                            {c.publishedDate && <span>live {fmtDate(c.publishedDate)}</span>}
                            {c.seeded && <Badge>demo</Badge>}
                          </div>
                          <div className="row mt-8" style={{ gap: 4 }}>
                            <Select
                              value={c.stage}
                              onChange={(e) => moveTo(c.id, e.target.value as ContentStage)}
                              style={{ flex: 1, fontSize: 11.5, padding: '3px 5px' }}
                              aria-label={`Stage for ${c.title}`}
                            >
                              {STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </Select>
                            <IconButton label={`Edit ${c.title}`} onClick={() => setEditing(c)}>
                              <IconEdit size={13} />
                            </IconButton>
                            <IconButton
                              label={`Delete ${c.title}`}
                              onClick={() => {
                                actions.removeContent(c.id);
                                toast({ title: 'Content deleted', body: c.title, tone: 'warn' });
                              }}
                            >
                              <IconTrash size={13} />
                            </IconButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <ContentModal
          data={data}
          item={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ContentModal({
  data,
  item,
  onClose,
}: {
  data: AppData;
  item?: ContentItem;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    accountId: item?.accountId ?? data.accounts[0]?.id ?? '',
    title: item?.title ?? '',
    kind: item?.kind ?? ('short_form' as ContentItem['kind']),
    pillar: item?.pillar ?? '',
    stage: item?.stage ?? ('idea' as ContentStage),
    hook: item?.hook ?? '',
    script: item?.script ?? '',
    cta: item?.cta ?? '',
    format: item?.format ?? '',
    campaign: item?.campaign ?? '',
    assetLinks: item?.assetLinks ?? '',
    plannedDate: item?.plannedDate ?? '',
    publishedDate: item?.publishedDate ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  function submit() {
    const e: Record<string, string> = {};
    if (!draft.title.trim()) e.title = 'Give the piece a working title.';
    if (!draft.accountId) e.accountId = 'Create an account first (Growth & performance → Accounts).';
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      ...draft,
      title: draft.title.trim(),
      plannedDate: draft.plannedDate || undefined,
      publishedDate: draft.publishedDate || undefined,
    };
    if (item) {
      actions.updateContent(item.id, payload);
      toast({ title: 'Content updated', tone: 'ok' });
    } else {
      actions.addContent(payload);
      toast({ title: 'Content added to pipeline', tone: 'ok' });
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Edit content item' : 'New content item'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {item ? 'Save' : 'Add to pipeline'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Title" required error={errors.title} className="span-2">
          <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Account / page" error={errors.accountId}>
          <Select value={draft.accountId} onChange={(e) => set('accountId', e.target.value)}>
            <option value="">— select —</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.platform})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kind">
          <Select value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="short_form">Organic short-form</option>
            <option value="portfolio_ad">Portfolio advertisement</option>
          </Select>
        </Field>
        <Field label="Content pillar">
          <Input value={draft.pillar} onChange={(e) => set('pillar', e.target.value)} placeholder="e.g. DSA patterns" />
        </Field>
        <Field label="Format">
          <Input value={draft.format} onChange={(e) => set('format', e.target.value)} placeholder="Reel 45s, talking head" />
        </Field>
        <Field label="Hook" className="span-2" help="The first 3 seconds. If this is weak, nothing else matters.">
          <Input value={draft.hook} onChange={(e) => set('hook', e.target.value)} />
        </Field>
        <Field label="Script / creative brief" className="span-2">
          <Textarea value={draft.script} onChange={(e) => set('script', e.target.value)} />
        </Field>
        <Field label="CTA">
          <Input value={draft.cta} onChange={(e) => set('cta', e.target.value)} />
        </Field>
        <Field label="Campaign / brand">
          <Input value={draft.campaign} onChange={(e) => set('campaign', e.target.value)} />
        </Field>
        <Field label="Planned publish date">
          <Input type="date" value={draft.plannedDate} onChange={(e) => set('plannedDate', e.target.value)} />
        </Field>
        <Field label="Actual publish date">
          <Input type="date" value={draft.publishedDate} onChange={(e) => set('publishedDate', e.target.value)} />
        </Field>
        <Field label="Asset links" className="span-2" help="One per line: drive folder, project file, published URL.">
          <Textarea value={draft.assetLinks} onChange={(e) => set('assetLinks', e.target.value)} />
        </Field>
        <Field label="Stage">
          <Select value={draft.stage} onChange={(e) => set('stage', e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

/* =============================== GROWTH =============================== */

function GrowthSection({ data }: { data: AppData }) {
  const toast = useToast();
  const [activeId, setActiveId] = useState(data.accounts[0]?.id ?? '');
  const account = data.accounts.find((a) => a.id === activeId) ?? data.accounts[0];
  const [addingAccount, setAddingAccount] = useState(false);
  const [addingMetric, setAddingMetric] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const weeks = useMemo(() => lastNWeeks(8), []);
  const weekly = useMemo(() => (account ? metricsByWeek(account.metrics, weeks) : []), [account, weeks]);

  if (data.accounts.length === 0) {
    return (
      <Card>
        <Empty
          title="No accounts yet"
          action={
            <Button variant="primary" onClick={() => setAddingAccount(true)}>
              <IconPlus size={13} /> Add an account
            </Button>
          }
        >
          Each content property is tracked separately — a short-video page and an AI-ad portfolio page have different
          audiences and different commercial meaning.
        </Empty>
        {addingAccount && <AccountModal onClose={() => setAddingAccount(false)} />}
      </Card>
    );
  }

  const totals = account ? metricTotals(account.metrics) : metricTotals([]);
  const growth = account ? followerGrowth(account.metrics) : { delta: 0, latest: 0, pct: null };
  const er = engagementRate(totals);
  const lr = leadRate(totals);
  const ir = inquiryRate(totals);
  const recent = account ? [...account.metrics].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12) : [];

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = parseCSV(text);
      if (rows.length < 2 || !account) {
        toast({ title: 'Nothing to import', tone: 'warn', body: 'The file needs a header row plus at least one data row.' });
        return;
      }
      const map = headerIndex(rows[0]);
      let added = 0;
      let skipped = 0;
      for (const row of rows.slice(1)) {
        const date = strAt(row, map, 'date');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          skipped += 1;
          continue;
        }
        actions.addMetric(account.id, {
          date,
          views: numAt(row, map, 'views'),
          reach: numAt(row, map, 'reach'),
          likes: numAt(row, map, 'likes'),
          comments: numAt(row, map, 'comments'),
          shares: numAt(row, map, 'shares'),
          saves: numAt(row, map, 'saves'),
          watchTimeMinutes: numAt(row, map, 'watch_time_minutes'),
          followers: numAt(row, map, 'followers'),
          profileVisits: numAt(row, map, 'profile_visits'),
          inquiries: numAt(row, map, 'inquiries'),
          leads: numAt(row, map, 'leads'),
          seeded: false,
        });
        added += 1;
      }
      toast({
        title: added > 0 ? `Imported ${added} metric row(s)` : 'No rows imported',
        tone: added > 0 ? 'ok' : 'warn',
        body: skipped ? `${skipped} row(s) skipped — date must be YYYY-MM-DD.` : undefined,
      });
    };
    reader.readAsText(file);
  }

  function exportCSV() {
    if (!account) return;
    const rows: (string | number)[][] = [
      [
        'date',
        'views',
        'reach',
        'likes',
        'comments',
        'shares',
        'saves',
        'watch_time_minutes',
        'followers',
        'profile_visits',
        'inquiries',
        'leads',
      ],
      ...[...account.metrics]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => [
          m.date,
          m.views,
          m.reach,
          m.likes,
          m.comments,
          m.shares,
          m.saves,
          m.watchTimeMinutes,
          m.followers,
          m.profileVisits,
          m.inquiries,
          m.leads,
        ]),
    ];
    const blob = new Blob([toCSV(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${account.name.replace(/\s+/g, '-').toLowerCase()}-metrics.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      <Card
        title="Accounts"
        subtitle="Tracked independently. Metrics from different platforms are never combined into one number."
        actions={
          <Button size="sm" variant="primary" onClick={() => setAddingAccount(true)}>
            <IconPlus size={13} /> Add account
          </Button>
        }
        bodyClass="tight"
      >
        <div className="list">
          {data.accounts.map((a) => {
            const g = followerGrowth(a.metrics);
            const last = [...a.metrics].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 8).map((m) => m.followers);
            return (
              <div className="list-item" key={a.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row">
                    <span className="title">{a.name}</span>
                    <Badge>{a.platform}</Badge>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.handle}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{a.focus}</p>
                  <div className="row-wrap mt-8">
                    <Metric label="Followers" value={g.latest.toLocaleString('en-IN')} sub={g.delta >= 0 ? `+${g.delta}` : `${g.delta}`} />
                    <Sparkline values={last.reverse()} />
                    <Metric label="Posts target" value={`${a.weeklyTargetPosts}/wk`} />
                  </div>
                </div>
                <div className="row">
                  <Button size="sm" onClick={() => setActiveId(a.id)}>
                    View
                  </Button>
                  <IconButton
                    label={`Delete ${a.name}`}
                    onClick={() => {
                      actions.removeAccount(a.id);
                      toast({ title: 'Account removed', body: a.name, tone: 'warn' });
                    }}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {account && (
        <>
          <Card
            title={`${account.name} · performance`}
            subtitle="Manual entry or CSV import. Rates are computed only when a valid denominator exists."
            actions={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCSV(f);
                    e.target.value = '';
                  }}
                />
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  <IconUpload size={13} /> Import CSV
                </Button>
                <Button size="sm" onClick={exportCSV} disabled={account.metrics.length === 0}>
                  <IconDownload size={13} /> Export CSV
                </Button>
                <Button size="sm" variant="primary" onClick={() => setAddingMetric(true)}>
                  <IconPlus size={13} /> Record metrics
                </Button>
              </>
            }
          >
            <div className="stack">
              <div className="metric-grid">
                <Metric label="Views" value={totals.views.toLocaleString('en-IN')} />
                <Metric label="Reach" value={totals.reach.toLocaleString('en-IN')} />
                <Metric label="Interactions" value={interactions(totals).toLocaleString('en-IN')} sub="likes+comments+shares+saves" />
                <Metric
                  label="Engagement rate"
                  value={er === null ? 'n/a' : `${er.toFixed(2)}%`}
                  sub={er === null ? 'reach not recorded' : 'per recorded period'}
                />
                <Metric label="Watch time" value={`${Math.round(totals.watchTimeMinutes / 60)}h`} />
                <Metric
                  label="Follower growth"
                  value={growth.pct === null ? `${growth.delta >= 0 ? '+' : ''}${growth.delta}` : `${growth.pct >= 0 ? '+' : ''}${growth.pct.toFixed(1)}%`}
                  sub={`now ${growth.latest.toLocaleString('en-IN')}`}
                />
                <Metric label="Profile visits" value={totals.profileVisits.toLocaleString('en-IN')} />
                <Metric label="Inquiries" value={totals.inquiries} sub={ir === null ? 'no denominator' : `${ir.toFixed(1)}% of visits`} />
                <Metric label="Leads" value={totals.leads} sub={lr === null ? 'no views recorded' : `${lr.toFixed(2)}% of views`} />
              </div>

              <Formula>{ENGAGEMENT_FORMULA}</Formula>
              <Formula>{CONVERSION_FORMULA}</Formula>

              <div className="mt-12">
                <div className="section-title">Weekly views & interactions</div>
                <BarChart
                  labels={weekly.map((w) => w.week.slice(5))}
                  series={[
                    { label: 'Views', values: weekly.map((w) => w.totals.views) },
                    { label: 'Interactions', values: weekly.map((w) => interactions(w.totals)) },
                  ]}
                />
              </div>

              <div className="mt-12">
                <div className="section-title">Follower trend</div>
                <LineChart
                  labels={weekly.map((w) => w.week.slice(5))}
                  series={[
                    {
                      label: 'Followers (period end)',
                      values: weekly.map((w) => {
                        const rows = [...w.rows].sort((a, b) => a.date.localeCompare(b.date));
                        return rows.length ? rows[rows.length - 1].followers : 0;
                      }),
                    },
                  ]}
                  yFormat={(v) => `${Math.round(v)}`}
                />
              </div>

              {recent.length === 0 ? (
                <Empty title="No metrics recorded">
                  Record one row per week per account. Export templates as CSV, or paste from your platform's own
                  export.
                </Empty>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="num">Views</th>
                        <th className="num">Reach</th>
                        <th className="num">Likes</th>
                        <th className="num">Comments</th>
                        <th className="num">Shares</th>
                        <th className="num">Saves</th>
                        <th className="num">Followers</th>
                        <th className="num">Visits</th>
                        <th className="num">Inq.</th>
                        <th className="num">Leads</th>
                        <th className="num">ER</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((m) => {
                        const e = engagementRate(m);
                        return (
                          <tr key={m.id}>
                            <td>{m.date}</td>
                            <td className="num">{m.views.toLocaleString('en-IN')}</td>
                            <td className="num">{m.reach.toLocaleString('en-IN')}</td>
                            <td className="num">{m.likes}</td>
                            <td className="num">{m.comments}</td>
                            <td className="num">{m.shares}</td>
                            <td className="num">{m.saves}</td>
                            <td className="num">{m.followers.toLocaleString('en-IN')}</td>
                            <td className="num">{m.profileVisits}</td>
                            <td className="num">{m.inquiries}</td>
                            <td className="num">{m.leads}</td>
                            <td className="num">{e === null ? 'n/a' : `${e.toFixed(1)}%`}</td>
                            <td>
                              <IconButton
                                label="Delete metric row"
                                onClick={() => actions.removeMetric(account.id, m.id)}
                              >
                                <IconTrash size={13} />
                              </IconButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {addingMetric && <MetricModal accountId={account.id} onClose={() => setAddingMetric(false)} />}
        </>
      )}

      {addingAccount && <AccountModal onClose={() => setAddingAccount(false)} />}
    </div>
  );
}

function AccountModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({ name: '', platform: '', handle: '', focus: '', weeklyTargetPosts: 2 });
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title="Add account"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!draft.name.trim()) {
                setError('Name is required.');
                return;
              }
              actions.addAccount({ ...draft, name: draft.name.trim() });
              toast({ title: 'Account added', tone: 'ok' });
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" required error={error}>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Short-video page" />
        </Field>
        <Field label="Platform">
          <Input value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} placeholder="Instagram Reels" />
        </Field>
        <Field label="Handle">
          <Input value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} />
        </Field>
        <Field label="Focus">
          <Textarea value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })} />
        </Field>
        <Field label="Weekly post target">
          <Input
            type="number"
            min={0}
            value={draft.weeklyTargetPosts}
            onChange={(e) => setDraft({ ...draft, weeklyTargetPosts: Number(e.target.value) })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function MetricModal({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    date: startOfWeek(todayISO()),
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    watchTimeMinutes: 0,
    followers: 0,
    profileVisits: 0,
    inquiries: 0,
    leads: 0,
  });
  const set = (k: keyof typeof draft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));
  const er = engagementRate(draft);

  return (
    <Modal
      open
      onClose={onClose}
      title="Record account metrics"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.addMetric(accountId, { ...draft, seeded: false } as Omit<AccountMetric, 'id' | 'createdAt'>);
              toast({ title: 'Metrics recorded', tone: 'ok', body: draft.date });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Period (week ending or date)" className="span-2" help="One row per account per period.">
          <Input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Views">
          <Input type="number" min={0} value={draft.views} onChange={(e) => set('views', Number(e.target.value))} />
        </Field>
        <Field label="Reach" help="Needed for engagement rate.">
          <Input type="number" min={0} value={draft.reach} onChange={(e) => set('reach', Number(e.target.value))} />
        </Field>
        <Field label="Likes">
          <Input type="number" min={0} value={draft.likes} onChange={(e) => set('likes', Number(e.target.value))} />
        </Field>
        <Field label="Comments">
          <Input type="number" min={0} value={draft.comments} onChange={(e) => set('comments', Number(e.target.value))} />
        </Field>
        <Field label="Shares">
          <Input type="number" min={0} value={draft.shares} onChange={(e) => set('shares', Number(e.target.value))} />
        </Field>
        <Field label="Saves">
          <Input type="number" min={0} value={draft.saves} onChange={(e) => set('saves', Number(e.target.value))} />
        </Field>
        <Field label="Watch time (minutes)">
          <Input
            type="number"
            min={0}
            value={draft.watchTimeMinutes}
            onChange={(e) => set('watchTimeMinutes', Number(e.target.value))}
          />
        </Field>
        <Field label="Followers (at period end)">
          <Input type="number" min={0} value={draft.followers} onChange={(e) => set('followers', Number(e.target.value))} />
        </Field>
        <Field label="Profile visits">
          <Input type="number" min={0} value={draft.profileVisits} onChange={(e) => set('profileVisits', Number(e.target.value))} />
        </Field>
        <Field label="Inbound inquiries">
          <Input type="number" min={0} value={draft.inquiries} onChange={(e) => set('inquiries', Number(e.target.value))} />
        </Field>
        <Field label="Leads attributable to content">
          <Input type="number" min={0} value={draft.leads} onChange={(e) => set('leads', Number(e.target.value))} />
        </Field>
      </div>
      <div className="mt-12">
        <Note>
          Computed from this row: engagement rate{' '}
          <strong>{er === null ? 'n/a (reach = 0)' : `${er.toFixed(2)}%`}</strong>. Zero is recorded as zero — nothing
          is estimated.
        </Note>
      </div>
    </Modal>
  );
}

/* ================================ DEALS ================================ */

function DealsSection({ data }: { data: AppData }) {
  const toast = useToast();
  const [editing, setEditing] = useState<BrandDeal | null>(null);
  const [creating, setCreating] = useState(false);
  const [stageFilter, setStageFilter] = useState<'all' | DealStage>('all');
  const [confirmDelete, setConfirmDelete] = useState<BrandDeal | null>(null);

  const portfolioDone = data.content.filter((c) => c.kind === 'portfolio_ad' && c.stage === 'published').length;
  const funnel = dealFunnel(data.deals, portfolioDone);
  const deals = data.deals
    .filter((d) => (stageFilter === 'all' ? true : d.stage === stageFilter))
    .sort((a, b) => (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999'));
  const today = todayISO();

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Card bodyClass="tight">
          <Metric label="Qualified prospects" value={funnel.qualified} sub="contacted or further" />
        </Card>
        <Card bodyClass="tight">
          <Metric label="Outreach sent" value={funnel.outreach} sub={`${funnel.replied} replies`} />
        </Card>
        <Card bodyClass="tight">
          <Metric label="Deals won" value={funnel.won} sub={funnel.winRate === null ? 'no qualified yet' : `${Math.round(funnel.winRate)}% win rate`} />
        </Card>
        <Card bodyClass="tight">
          <Metric
            label="Revenue agreed"
            value={`₹${funnel.revenueAgreed.toLocaleString('en-IN')}`}
            sub={`₹${funnel.revenueReceived.toLocaleString('en-IN')} received · ₹${funnel.outstanding.toLocaleString('en-IN')} outstanding`}
          />
        </Card>
      </div>

      <Card title="Pipeline by stage" bodyClass="tight">
        <FunnelBar
          steps={DEAL_STAGES.map((s) => ({ label: s.label, value: data.deals.filter((d) => d.stage === s.id).length }))}
        />
      </Card>

      <Card
        title="Sponsorship CRM"
        subtitle="Lightweight, manual. Stage changes are logged to the evidence feed."
        actions={
          <>
            <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)} style={{ width: 150 }} aria-label="Filter by stage">
              <option value="all">All stages</option>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> Add deal
            </Button>
          </>
        }
        bodyClass="tight"
      >
        {deals.length === 0 ? (
          <Empty
            title="No deals tracked"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <IconPlus size={13} /> Add a prospect
              </Button>
            }
          >
            Start with brands whose product you would genuinely use. A researched prospect list beats a cold blast.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Stage</th>
                  <th>Deliverable</th>
                  <th className="num">Quoted</th>
                  <th className="num">Agreed</th>
                  <th className="num">Received</th>
                  <th>Contract</th>
                  <th>Follow-up</th>
                  <th>Next action</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const dueSoon = d.followUpDate && d.followUpDate <= addDays(today, 3) && d.stage !== 'won' && d.stage !== 'lost';
                  return (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 550 }}>{d.brand}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                          {d.contact}
                          {d.contactLink && (
                            <>
                              {' · '}
                              <a href={d.contactLink} target="_blank" rel="noreferrer noopener">
                                profile
                              </a>
                            </>
                          )}
                          {d.seeded && ' · demo'}
                        </div>
                      </td>
                      <td>
                        <Select
                          value={d.stage}
                          onChange={(e) => actions.updateDeal(d.id, { stage: e.target.value as DealStage })}
                          style={{ width: 128 }}
                          aria-label={`Stage for ${d.brand}`}
                        >
                          {DEAL_STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td style={{ maxWidth: 200 }}>{d.deliverable || '—'}</td>
                      <td className="num">{d.quotedFee ? `₹${d.quotedFee.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="num">{d.agreedFee ? `₹${d.agreedFee.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="num">{d.amountReceived ? `₹${d.amountReceived.toLocaleString('en-IN')}` : '—'}</td>
                      <td>
                        <Badge
                          tone={d.contractStatus === 'signed' ? 'ok' : d.contractStatus === 'none' ? 'plain' : 'warn'}
                        >
                          {d.contractStatus}
                        </Badge>
                        <Badge tone={d.paymentStatus === 'paid' ? 'ok' : d.paymentStatus === 'none' ? 'plain' : 'warn'}>
                          {d.paymentStatus}
                        </Badge>
                      </td>
                      <td>
                        {d.followUpDate ? (
                          <Badge tone={dueSoon ? 'danger' : 'plain'}>{fmtDate(d.followUpDate)}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ maxWidth: 220, color: 'var(--text-2)', fontSize: 12.5 }}>{d.nextAction || '—'}</td>
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          <IconButton label={`Edit ${d.brand}`} onClick={() => setEditing(d)}>
                            <IconEdit size={13} />
                          </IconButton>
                          <IconButton label={`Delete ${d.brand}`} onClick={() => setConfirmDelete(d)}>
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

      <Card title="Portfolio advertisements" subtitle="Spec work and delivered campaigns — the proof that earns the deal.">
        <div className="metric-grid mb-12">
          <Metric label="Published portfolio ads" value={portfolioDone} />
          <Metric label="In production" value={data.content.filter((c) => c.kind === 'portfolio_ad' && c.stage !== 'published').length} />
        </div>
        <Progress
          value={data.content.filter((c) => c.kind === 'portfolio_ad').length
            ? portfolioDone / data.content.filter((c) => c.kind === 'portfolio_ad').length
            : 0}
          label="Portfolio ads published"
        />
        {data.content.filter((c) => c.kind === 'portfolio_ad').length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            Add content items with kind "Portfolio advertisement" in the pipeline to build this.
          </p>
        )}
      </Card>

      {(creating || editing) && (
        <DealModal deal={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete deal?"
        danger
        confirmLabel="Delete"
        message={<>Remove <strong>{confirmDelete?.brand}</strong> from the CRM? Its history in the evidence feed stays.</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            actions.removeDeal(confirmDelete.id);
            toast({ title: 'Deal removed', body: confirmDelete.brand, tone: 'warn' });
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function DealModal({ deal, onClose }: { deal?: BrandDeal; onClose: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    brand: deal?.brand ?? '',
    contact: deal?.contact ?? '',
    contactLink: deal?.contactLink ?? '',
    outreachDate: deal?.outreachDate ?? '',
    pitchLink: deal?.pitchLink ?? '',
    stage: deal?.stage ?? ('prospect' as DealStage),
    followUpDate: deal?.followUpDate ?? '',
    deliverable: deal?.deliverable ?? '',
    quotedFee: deal?.quotedFee ?? 0,
    agreedFee: deal?.agreedFee ?? 0,
    contractStatus: deal?.contractStatus ?? ('none' as BrandDeal['contractStatus']),
    deliverableDue: deal?.deliverableDue ?? '',
    paymentStatus: deal?.paymentStatus ?? ('none' as BrandDeal['paymentStatus']),
    amountReceived: deal?.amountReceived ?? 0,
    notes: deal?.notes ?? '',
    nextAction: deal?.nextAction ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof draft, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={deal ? 'Edit deal' : 'Add brand / agency'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!draft.brand.trim()) {
                setError('Brand name is required.');
                return;
              }
              const payload = {
                ...draft,
                brand: draft.brand.trim(),
                outreachDate: draft.outreachDate || undefined,
                followUpDate: draft.followUpDate || undefined,
                deliverableDue: draft.deliverableDue || undefined,
              };
              if (deal) {
                actions.updateDeal(deal.id, payload);
                toast({ title: 'Deal updated', tone: 'ok' });
              } else {
                actions.addDeal(payload);
                toast({ title: 'Deal added', tone: 'ok' });
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
        <Field label="Brand / agency" required error={error} className="span-2">
          <Input value={draft.brand} onChange={(e) => set('brand', e.target.value)} />
        </Field>
        <Field label="Contact">
          <Input value={draft.contact} onChange={(e) => set('contact', e.target.value)} />
        </Field>
        <Field label="Contact link">
          <Input value={draft.contactLink} onChange={(e) => set('contactLink', e.target.value)} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label="Stage">
          <Select value={draft.stage} onChange={(e) => set('stage', e.target.value)}>
            {DEAL_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Outreach date">
          <Input type="date" value={draft.outreachDate} onChange={(e) => set('outreachDate', e.target.value)} />
        </Field>
        <Field label="Follow-up date">
          <Input type="date" value={draft.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
        </Field>
        <Field label="Pitch / portfolio link">
          <Input value={draft.pitchLink} onChange={(e) => set('pitchLink', e.target.value)} />
        </Field>
        <Field label="Proposed deliverable" className="span-2">
          <Input value={draft.deliverable} onChange={(e) => set('deliverable', e.target.value)} />
        </Field>
        <Field label="Quoted fee (₹)">
          <Input type="number" min={0} value={draft.quotedFee} onChange={(e) => set('quotedFee', Number(e.target.value))} />
        </Field>
        <Field label="Agreed fee (₹)">
          <Input type="number" min={0} value={draft.agreedFee} onChange={(e) => set('agreedFee', Number(e.target.value))} />
        </Field>
        <Field label="Contract status">
          <Select value={draft.contractStatus} onChange={(e) => set('contractStatus', e.target.value)}>
            <option value="none">None</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
          </Select>
        </Field>
        <Field label="Payment status">
          <Select value={draft.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
            <option value="none">None</option>
            <option value="invoiced">Invoiced</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </Select>
        </Field>
        <Field label="Amount received (₹)">
          <Input type="number" min={0} value={draft.amountReceived} onChange={(e) => set('amountReceived', Number(e.target.value))} />
        </Field>
        <Field label="Deliverable deadline">
          <Input type="date" value={draft.deliverableDue} onChange={(e) => set('deliverableDue', e.target.value)} />
        </Field>
        <Field label="Next action" className="span-2">
          <Input value={draft.nextAction} onChange={(e) => set('nextAction', e.target.value)} />
        </Field>
        <Field label="Notes" className="span-2">
          <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
