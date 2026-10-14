import { useRef, useState } from 'react';
import { actions, clearEverything, exportJSON, importJSON, useStore } from '../state/store';
import { addMonths, fmtDate, todayISO } from '../lib/date';
import { DEFAULT_WEIGHTS } from '../domain/taskMatch';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Formula,
  Input,
  Metric,
  Note,
  Segmented,
  useToast,
} from '../components/ui';
import { IconDownload, IconTrash, IconUpload } from '../components/icons';
import { supabaseConfigured } from '../state/supabase';

export function Settings() {
  const data = useStore((s) => s.data);
  const storageOk = useStore((s) => s.storageOk);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const syncStatus = useStore((s) => s.syncStatus);
  const syncEmail = useStore((s) => s.syncEmail);
  const pendingCloud = useStore((s) => s.pendingCloud);
  const resolveSync = useStore((s) => s.resolveSync);
  const syncNow = useStore((s) => s.syncNow);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [localBackupFor, setLocalBackupFor] = useState<typeof data>();
  const [cloudBackupFor, setCloudBackupFor] = useState<typeof pendingCloud>();

  const s = data.settings;

  function download() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup downloaded', tone: 'ok', body: 'Keep it somewhere safe — it restores everything, relationships included.' });
  }

  function downloadDataBackup(value: unknown, label: string) {
    const blob = new Blob([JSON.stringify({ ...(value as object), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-${label}-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restore(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importJSON(String(reader.result ?? ''));
      if (result.ok) {
        toast({
          title: 'Backup restored',
          tone: 'ok',
          body: result.warnings.length ? `With notes: ${result.warnings.join(' ')}` : 'All entities and relationships loaded.',
        });
      } else {
        toast({ title: 'Import failed', tone: 'danger', body: result.error ?? 'The file is not valid POS backup JSON.' });
      }
    };
    reader.readAsText(file);
  }

  const counts = [
    ['Goals', data.goals.length],
    ['Milestones', data.milestones.length],
    ['Topics', data.topics.length],
    ['Tasks', data.tasks.length],
    ['Subjects', data.collegeSubjects.length],
    ['GATE subjects', data.gateSubjects.length],
    ['Roadmap topics', data.roadmap.length],
    ['Content items', data.content.length],
    ['Accounts', data.accounts.length],
    ['Deals', data.deals.length],
    ['Practice logs', data.practiceLogs.length],
    ['Sessions', data.sessions.length],
    ['Sleep logs', data.sleepLogs.length],
    ['Reviews', data.reviews.length],
    ['Events', data.events.length],
  ] as const;

  const seededCount =
    data.goals.filter((g) => g.seeded).length +
    data.topics.filter((t) => t.seeded).length +
    data.tasks.filter((t) => t.seeded).length +
    data.content.filter((c) => c.seeded).length +
    data.deals.filter((d) => d.seeded).length;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Your workspace is saved on this device and can sync securely across devices after email sign-in. Backups and
            restore remain available below.
          </p>
        </div>
        <div className="page-actions">
          <Badge tone={storageOk ? 'ok' : 'danger'}>{storageOk ? 'Local storage active' : 'Storage unavailable'}</Badge>
          {lastSavedAt && <Badge>saved {new Date(lastSavedAt).toLocaleTimeString()}</Badge>}
        </div>
      </div>

      <Card title="Cross-device sync" subtitle="Private workspace sync using your Supabase account.">
        <div className="stack">
          {!supabaseConfigured ? (
            <Note>Cloud sync is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.</Note>
          ) : (
            <>
              <div className="row-wrap">
                <Badge tone={syncStatus === 'synced' ? 'ok' : syncStatus === 'error' || syncStatus === 'conflict' ? 'danger' : syncStatus === 'offline' ? 'warn' : 'plain'}>
                  {syncStatus === 'loading' ? 'Loading' : syncStatus === 'signed-out' ? 'Signed out' : syncStatus === 'offline' ? 'Offline · saved on this device' : syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'needs-choice' ? 'Action needed' : syncStatus === 'conflict' ? 'Conflict needs a choice' : 'Sync error'}
                </Badge>
                {syncEmail && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{syncEmail}</span>}
                {syncEmail && <Button onClick={() => void syncNow()}>Sync now</Button>}
                {syncEmail && <Button onClick={() => void signOut()}>Sign out</Button>}
              </div>
              {!syncEmail && (
                <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); void signIn(email).then(() => setAuthMessage('Check your email for a sign-in link.')).catch((error: unknown) => setAuthMessage(error instanceof Error ? error.message : 'Could not send the sign-in link.')); }}>
                  <Field label="Email address"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Button variant="primary" type="submit">Email me a sign-in link</Button>
                </form>
              )}
              {authMessage && <Note>{authMessage}</Note>}
              {syncStatus === 'needs-choice' && (
                <div className="note warn">
                  <strong>Upload this device’s workspace?</strong> Your cloud account has no workspace yet. Local data will stay on this device and be copied to your account only if you choose upload.
                  <div className="row-wrap" style={{ marginTop: 10 }}>
                    <Button variant="primary" onClick={() => void resolveSync('upload-local')}>Upload local workspace</Button>
                    <Button onClick={() => void signOut()}>Keep using this device only</Button>
                  </div>
                </div>
              )}
              {syncStatus === 'conflict' && pendingCloud && (
                <div className="note warn">
                  <strong>Two workspace copies need a decision.</strong> Download a backup of the copy that will be replaced before choosing either option.
                  <div className="row-wrap" style={{ marginTop: 10 }}>
                    <Button onClick={() => { download(); setLocalBackupFor(data); }}>Download local backup</Button>
                    <Button disabled={localBackupFor !== data} onClick={() => void resolveSync('use-cloud')}>Use cloud copy on this device</Button>
                    <Button onClick={() => { downloadDataBackup(pendingCloud, 'cloud'); setCloudBackupFor(pendingCloud); }}>Download cloud backup</Button>
                    <Button variant="primary" disabled={cloudBackupFor !== pendingCloud} onClick={() => void resolveSync('upload-local')}>Replace cloud with this device</Button>
                  </div>
                </div>
              )}
              {syncStatus === 'error' && <Note>Sync could not complete. Your local workspace remains available. Check the connection and Supabase setup, then choose Sync now.</Note>}
              {syncStatus === 'offline' && <Note>Cloud sync is unavailable right now. Changes continue saving locally and will sync after reconnecting.</Note>}
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="Profile">
          <div className="form-grid">
            <Field label="Name" className="span-2">
              <Input value={s.userName} onChange={(e) => actions.updateSettings({ userName: e.target.value })} />
            </Field>
            <Field label="Theme">
              <Segmented
                ariaLabel="Theme"
                value={s.theme}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={(v) => actions.updateSettings({ theme: v })}
              />
            </Field>
            <Field label="Semester exam date">
              <Input
                type="date"
                value={s.examDate ?? ''}
                onChange={(e) => actions.updateSettings({ examDate: e.target.value || undefined })}
              />
            </Field>
            <Field label="GATE exam date">
              <Input
                type="date"
                value={s.gateDate ?? ''}
                onChange={(e) => actions.updateSettings({ gateDate: e.target.value || undefined })}
              />
            </Field>
            <div className="field">
              <span className="field-label">Quick set</span>
              <div className="row-wrap">
                <Button size="xs" onClick={() => actions.updateSettings({ examDate: addMonths(todayISO(), 1) })}>
                  exam +1 month
                </Button>
                <Button size="xs" onClick={() => actions.updateSettings({ gateDate: addMonths(todayISO(), 5) })}>
                  GATE +5 months
                </Button>
              </div>
            </div>
          </div>
          <label className="row mt-12" style={{ gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={s.evidencePrompt}
              onChange={(e) => actions.updateSettings({ evidencePrompt: e.target.checked })}
            />
            Ask for evidence when completing evidence-based tasks
          </label>
        </Card>

        <Card
          title="Task matching weights"
          subtitle="The ranking is a weighted sum. Change these to change what the engine prioritises — the score breakdown always shows the result."
        >
          <div className="stack">
            {(
              [
                ['deadline', 'Deadline urgency', 'How much a near or overdue deadline should dominate.'],
                ['importance', 'Goal importance', 'Weight of the importance rating and P1/P2/P3 priority.'],
                ['energyFit', 'Energy fit', 'How strongly recommendations must match your current energy.'],
                ['durationFit', 'Duration fit', 'How much the estimate must fit your free block.'],
                ['defer', 'Deferral', 'How much a postponed task gets pulled forward.'],
              ] as const
            ).map(([key, label, help]) => (
              <div key={key}>
                <div className="row">
                  <span style={{ fontSize: 12.5, flex: 1 }}>{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.25}
                    value={s.weights[key]}
                    onChange={(e) => actions.updateSettings({ weights: { ...s.weights, [key]: Number(e.target.value) } })}
                    style={{ width: 160 }}
                    aria-label={label}
                  />
                  <span className="progress-num">{s.weights[key].toFixed(2)}×</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{help}</p>
              </div>
            ))}
            <Button size="sm" onClick={() => actions.updateSettings({ weights: { ...DEFAULT_WEIGHTS } })}>
              Reset to defaults
            </Button>
          </div>
        </Card>
      </div>

      <Card title="How progress is calculated" subtitle="Nothing here is inferred from elapsed time or from activity alone.">
        <div className="stack">
          <Formula>goal progress = Σ(weight of done milestones) ÷ Σ(weight of all milestones)</Formula>
          <Formula>
            milestone credited at 60% if it is evidence-required but has no evidence attached — the goal card names the
            milestone
          </Formula>
          <Formula>
            topic credit: done + (evidence attached OR practice target set and met OR confidence ≥ 3) = 1.0 · done
            without any of those = 0.6 · learning = 0.45 · not started or skipped = 0
          </Formula>
          <Formula>track progress = Σ(topic weight × topic credit) ÷ Σ(topic weight)</Formula>
          <Formula>
            portfolio evidence = 1.0 only when a project is marked done AND has at least one link attached
          </Formula>
          <Formula>
            area progress (technical) = 0.50 × goal average + 0.35 × topic mastery + 0.15 × portfolio evidence
          </Formula>
          <Formula>
            area progress (academics) = 0.50 × goal average + 0.50 × semiconductor roadmap
          </Formula>
          <Formula>
            area progress (marketing) = goal average (content and deal milestones carry the weight)
          </Formula>
          <Formula>
            exam readiness = 0.25·confidence + 0.20·revision + 0.20·practice volume + 0.10·practice recency +
            0.25·timed assessment average − 0.20·weak-topic share
          </Formula>
          <Formula>engagement rate = (likes + comments + shares + saves) ÷ reach × 100 — n/a when reach is 0</Formula>
          <Formula>
            task score = deadline(0–30)·w₁ + importance(0–20)·w₂ + energyFit(0–15)·w₃ + durationFit(0–15)·w₄ +
            deferral(0–8)·w₅ − prerequisite(25) − recovery(50) − already suggested(6)
          </Formula>
          <Formula>
            energy demand: light cognitive load → tier 1 · medium → its own tier · heavy → tier + 1. Exhausted energy
            only admits tier-1 work.
          </Formula>
          <Note>
            Elapsed time is displayed next to progress as a separate marker. The gap between the two is schedule risk —
            it is never added to progress.
          </Note>
        </div>
      </Card>

      <Card title="Data" subtitle="Export, restore, and manage the demo workspace.">
        <div className="stack">
          <div className="metric-grid">
            {counts.map(([label, value]) => (
              <Metric key={label} label={label} value={value} />
            ))}
          </div>

          <div className="row-wrap">
            <Button variant="primary" onClick={download}>
              <IconDownload size={13} /> Export full backup (JSON)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) restore(f);
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <IconUpload size={13} /> Restore from backup
            </Button>
          </div>

          <Note>
            Restoring replaces the current workspace with the backup. Ids and relationships (goal → milestone → task,
            track → topic → prerequisite, account → metrics) are preserved because they are stored by id.
          </Note>

          <div className="divider" />

          <div className="row-wrap">
            {s.demoDataLoaded ? (
              <>
                <Badge tone="warn">{seededCount} demo rows present</Badge>
                <Button onClick={() => setConfirmClearDemo(true)}>
                  <IconTrash size={13} /> Clear demo data
                </Button>
              </>
            ) : (
              <Button onClick={() => setConfirmDemo(true)}>Load demo workspace</Button>
            )}
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <IconTrash size={13} /> Erase everything
            </Button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            "Clear demo data" removes only rows labelled as demo proposals and keeps anything you created yourself.
            "Erase everything" wipes the workspace — export a backup first.
          </p>
        </div>
      </Card>

      <Card title="About this build" subtitle="What is implemented, and what is deliberately not.">
        <div className="stack">
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            React + TypeScript, Vite, Zustand with localStorage persistence and optional Supabase account sync. The app
            remains usable offline; cloud updates resume when connected.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'grid', gap: 5, color: 'var(--text-2)' }}>
            <li>Task ranking is a deterministic weighted sum with a visible breakdown — no hidden model.</li>
            <li>Shuffle re-ranks only. Reschedule is a separate, confirmed action. Deadlines and fixed commitments are never mutated by either.</li>
            <li>Content metrics are manual or CSV. Nothing is scraped, and no rate is computed without a real denominator.</li>
            <li>Sleep data is never inferred from app usage; it exists only if you type it in.</li>
            <li>Evidence-gated milestones credit 60% until proof is attached, so closing them cannot inflate progress.</li>
          </ul>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Workspace created {fmtDate(data.exportedAt?.slice(0, 10) ?? todayISO())} · data version {data.version}
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDemo}
        title="Load the demo workspace?"
        confirmLabel="Load demo data"
        message={
          <>
            This adds labelled sample goals, curricula, tasks, content and metrics so you can see how everything
            connects. You can edit or clear all of it later.
          </>
        }
        onCancel={() => setConfirmDemo(false)}
        onConfirm={() => {
          useStore.getState().loadDemoData(data.goals.length === 0 ? 'replace' : 'merge');
          setConfirmDemo(false);
          toast({ title: 'Demo workspace loaded', tone: 'ok', body: 'Every seeded row is marked as a proposal.' });
        }}
      />
      <ConfirmDialog
        open={confirmClearDemo}
        title="Clear demo data?"
        confirmLabel="Clear demo rows"
        message="Removes every row labelled as demo. Anything you created yourself stays."
        onCancel={() => setConfirmClearDemo(false)}
        onConfirm={() => {
          actions.updateSettings({});
          useStore.getState().clearDemoData();
          setConfirmClearDemo(false);
          toast({ title: 'Demo data cleared', tone: 'ok' });
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Erase everything?"
        danger
        confirmLabel="Erase all data"
        message={
          <>
            This deletes every goal, task, topic, metric and review from this browser. Export a backup first if there is
            anything you want to keep.
          </>
        }
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          clearEverything();
          setConfirmReset(false);
          toast({ title: 'Workspace erased', tone: 'warn' });
        }}
      />
    </div>
  );
}
