import { useCallback, useEffect, useState } from 'react';

export type RouteId =
  | 'overview'
  | 'goals'
  | 'technical'
  | 'academics'
  | 'marketing'
  | 'tasks'
  | 'reviews'
  | 'settings';

export const ROUTES: { id: RouteId; label: string; hash: string }[] = [
  { id: 'overview', label: 'Overview', hash: '#/overview' },
  { id: 'goals', label: 'Goals', hash: '#/goals' },
  { id: 'technical', label: 'Technical', hash: '#/technical' },
  { id: 'academics', label: 'Academics & Career', hash: '#/academics' },
  { id: 'marketing', label: 'Marketing & Content', hash: '#/marketing' },
  { id: 'tasks', label: 'Tasks & Calendar', hash: '#/tasks' },
  { id: 'reviews', label: 'Reviews', hash: '#/reviews' },
  { id: 'settings', label: 'Settings', hash: '#/settings' },
];

const VALID = new Set(ROUTES.map((r) => r.id));

function parseHash(): RouteId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return (VALID.has(raw as RouteId) ? raw : 'overview') as RouteId;
}

export function useRoute(): [RouteId, (r: RouteId) => void] {
  const [route, setRoute] = useState<RouteId>(() =>
    typeof window === 'undefined' ? 'overview' : parseHash(),
  );

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((r: RouteId) => {
    window.location.hash = `#/${r}`;
    setRoute(r);
  }, []);

  return [route, navigate];
}
