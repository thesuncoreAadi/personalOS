import { useCallback, useEffect, useMemo, useState } from 'react';
import { actions, useStore } from './state/store';
import { ROUTES, useRoute, type RouteId } from './lib/router';
import { todayISO } from './lib/date';
import { goalHealth } from './domain/progress';
import { ToastProvider, Button, IconButton } from './components/ui';
import {
  IconBook,
  IconCheckSquare,
  IconChip,
  IconClose,
  IconGauge,
  IconMegaphone,
  IconMenu,
  IconMoon,
  IconReview,
  IconSettings,
  IconSun,
  IconTarget,
} from './components/icons';
import { Overview } from './pages/Overview';
import { Goals } from './pages/Goals';
import { Technical } from './pages/Technical';
import { Academics } from './pages/Academics';
import { Marketing } from './pages/Marketing';
import { Tasks } from './pages/Tasks';
import { Reviews } from './pages/Reviews';
import { Settings } from './pages/Settings';

const ICONS: Record<RouteId, (p: { size?: number }) => React.ReactElement> = {
  overview: IconGauge,
  goals: IconTarget,
  technical: IconChip,
  academics: IconBook,
  marketing: IconMegaphone,
  tasks: IconCheckSquare,
  reviews: IconReview,
  settings: IconSettings,
};

export function App() {
  const hydrate = useStore((s) => s.hydrate);
  const data = useStore((s) => s.data);
  const hydrated = useStore((s) => s.hydrated);
  const storageOk = useStore((s) => s.storageOk);
  const importWarnings = useStore((s) => s.importWarnings);
  const [route, navigate] = useRoute();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  /* theme */
  useEffect(() => {
    const theme = data.settings.theme;
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [data.settings.theme]);

  /* keyboard: g then <letter> to jump between pages */
  useEffect(() => {
    let armed = false;
    let timer = 0;
    const map: Record<string, RouteId> = {
      o: 'overview',
      g: 'goals',
      t: 'technical',
      a: 'academics',
      m: 'marketing',
      k: 'tasks',
      r: 'reviews',
      s: 'settings',
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (armed) {
        const target = map[e.key.toLowerCase()];
        if (target) {
          navigate(target);
          setNavOpen(false);
        }
        armed = false;
        window.clearTimeout(timer);
        return;
      }
      if (e.key === 'g') {
        armed = true;
        timer = window.setTimeout(() => {
          armed = false;
        }, 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [navigate]);

  useEffect(() => {
    setNavOpen(false);
  }, [route]);

  const counts = useMemo(() => {
    const today = todayISO();
    const overdueTasks = data.tasks.filter(
      (t) => (t.status === 'todo' || t.status === 'in_progress') && t.deadline && t.deadline < today,
    ).length;
    const atRiskGoals = data.goals.filter(
      (g) => g.status !== 'archived' && goalHealth(g, data.milestones, today).health === 'at_risk',
    ).length;
    const followUps = data.deals.filter(
      (d) => d.followUpDate && d.followUpDate <= today && d.stage !== 'won' && d.stage !== 'lost',
    ).length;
    return { tasks: overdueTasks, goals: atRiskGoals, marketing: followUps };
  }, [data]);

  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <ToastProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app">
        {navOpen && <button type="button" className="drawer-mobile" aria-label="Close navigation" onClick={closeNav} />}
        <Sidebar
          route={route}
          navigate={navigate}
          counts={counts}
          open={navOpen}
          userName={data.settings.userName}
          theme={data.settings.theme}
          storageOk={storageOk}
          hydrated={hydrated}
        />
        <div className="main">
          <header className="topbar">
            <IconButton label="Open navigation" onClick={() => setNavOpen(true)}>
              <IconMenu />
            </IconButton>
            <div className="brand">
              <div className="brand-mark">POS</div>
              <div>
                <div className="brand-name">Personal OS</div>
              </div>
            </div>
            <div className="spacer" />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{todayISO()}</span>
          </header>

          <main className="content" id="main" tabIndex={-1}>
            {!hydrated ? (
              <div className="empty">
                <h3>Loading your workspace…</h3>
                <p>Reading locally stored data.</p>
              </div>
            ) : (
              <>
                {importWarnings.length > 0 && (
                  <div className="note warn mb-12">
                    <strong>Import notes:</strong> {importWarnings.join(' ')}
                  </div>
                )}
                {!storageOk && (
                  <div className="note danger mb-12">
                    <strong>Storage unavailable in this browser context.</strong> The app is fully usable now, but
                    changes will not survive a refresh. Use Settings → Export backup to keep your data.
                  </div>
                )}
                {data.settings.demoDataLoaded && (
                  <div className="note mb-12">
                    <strong>Demo data is loaded.</strong> Goals, curricula and metrics below are labelled proposals,
                    not commitments. Edit anything, or clear it in Settings → Data.
                  </div>
                )}
                {route === 'overview' && <Overview navigate={navigate} />}
                {route === 'goals' && <Goals />}
                {route === 'technical' && <Technical />}
                {route === 'academics' && <Academics />}
                {route === 'marketing' && <Marketing />}
                {route === 'tasks' && <Tasks />}
                {route === 'reviews' && <Reviews />}
                {route === 'settings' && <Settings />}
              </>
            )}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function Sidebar({
  route,
  navigate,
  counts,
  open,
  userName,
  theme,
  storageOk,
  hydrated,
}: {
  route: RouteId;
  navigate: (r: RouteId) => void;
  counts: { tasks: number; goals: number; marketing: number };
  open: boolean;
  userName: string;
  theme: 'light' | 'dark' | 'system';
  storageOk: boolean;
  hydrated: boolean;
}) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const badgeFor = (id: RouteId) => {
    if (id === 'tasks') return counts.tasks;
    if (id === 'goals') return counts.goals;
    if (id === 'marketing') return counts.marketing;
    return 0;
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary">
      <div className="brand">
        <div className="brand-mark">POS</div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-name">Personal OS</div>
          <div className="brand-sub">{userName} · command centre</div>
        </div>
        <div className="spacer" />
        <IconButton label="Close navigation" onClick={() => navigate(route)} className="drawer-mobile">
          <IconClose />
        </IconButton>
      </div>

      <nav className="nav">
        <div className="nav-section">Command</div>
        {ROUTES.slice(0, 2).map((r) => (
          <NavItem key={r.id} r={r} active={route === r.id} navigate={navigate} count={badgeFor(r.id)} />
        ))}
        <div className="nav-section">Priority areas</div>
        {ROUTES.slice(2, 5).map((r) => (
          <NavItem key={r.id} r={r} active={route === r.id} navigate={navigate} count={badgeFor(r.id)} />
        ))}
        <div className="nav-section">Execution</div>
        {ROUTES.slice(5).map((r) => (
          <NavItem key={r.id} r={r} active={route === r.id} navigate={navigate} count={badgeFor(r.id)} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="row" style={{ gap: 6 }}>
          <Button size="sm" onClick={() => actions.updateSettings({ theme: dark ? 'light' : 'dark' })}>
            {dark ? <IconSun size={13} /> : <IconMoon size={13} />} {dark ? 'Light' : 'Dark'}
          </Button>
          <span className="nav-count" title={storageOk ? 'Saved locally' : 'Storage unavailable'}>
            {hydrated ? (storageOk ? 'Saved' : 'Not saved') : ''}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Tip: press <code>g</code> then <code>o</code>, <code>t</code>, <code>m</code>… to jump between pages.
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  r,
  active,
  navigate,
  count,
}: {
  r: { id: RouteId; label: string; hash: string };
  active: boolean;
  navigate: (r: RouteId) => void;
  count: number;
}) {
  const Icon = ICONS[r.id];
  return (
    <a
      href={r.hash}
      className="nav-item"
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        navigate(r.id);
      }}
    >
      <Icon size={15} />
      {r.label}
      {count > 0 && <span className="nav-count">{count}</span>}
    </a>
  );
}
