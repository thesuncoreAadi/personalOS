import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloud = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  listener: undefined as ((session: { user: { id: string; email: string } } | null) => void) | undefined,
  loadWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabaseConfigured: true,
  currentUser: () => cloud.user,
  initializeAuth: vi.fn(async () => undefined),
  sendSignInLink: vi.fn(async () => undefined),
  signOut: vi.fn(async () => { cloud.user = null; cloud.listener?.(null); }),
  loadWorkspace: cloud.loadWorkspace,
  saveWorkspace: cloud.saveWorkspace,
  onAuthChange: (callback: typeof cloud.listener) => { cloud.listener = callback; return () => { cloud.listener = undefined; }; },
}));

async function freshStore() {
  vi.resetModules();
  return import('../store');
}

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  cloud.user = null;
  cloud.listener = undefined;
  cloud.loadWorkspace.mockReset();
  cloud.saveWorkspace.mockReset();
  vi.useRealTimers();
});

describe('cloud workspace sync', () => {
  it('asks before first upload, writes only after the choice, and responds to sign-out', async () => {
    const store = await freshStore();
    const { emptyData } = await import('../defaults');
    const local = { ...emptyData(), tasks: [{ id: 'local-task', title: 'Keep me' }] } as ReturnType<typeof emptyData>;
    store.useStore.getState().replaceAll(local);
    cloud.loadWorkspace.mockResolvedValueOnce(null).mockResolvedValueOnce({ data: local, updated_at: '2026-10-14T00:00:00Z', revision: 1 });
    await store.useStore.getState().initializeSync();
    cloud.user = { id: 'user-1', email: 'owner@example.com' };
    cloud.listener?.({ user: cloud.user });
    await vi.waitFor(() => expect(store.useStore.getState().syncStatus).toBe('needs-choice'));
    expect(cloud.saveWorkspace).not.toHaveBeenCalled();

    cloud.saveWorkspace.mockResolvedValueOnce(true);
    await store.useStore.getState().resolveSync('upload-local');
    expect(cloud.saveWorkspace.mock.calls[0]?.[0].tasks[0]?.id).toBe('local-task');
    expect(cloud.saveWorkspace.mock.calls[0]?.[1]).toBeNull();
    expect(store.useStore.getState().syncStatus).toBe('synced');

    cloud.listener?.(null);
    expect(store.useStore.getState().syncStatus).toBe('signed-out');
    cloud.loadWorkspace.mockResolvedValueOnce({ data: local, updated_at: '2026-10-14T00:00:00Z', revision: 1 });
    cloud.user = { id: 'user-1', email: 'owner@example.com' };
    cloud.listener?.({ user: cloud.user });
    await vi.waitFor(() => expect(store.useStore.getState().syncStatus).toBe('synced'));
    expect(store.useStore.getState().pendingCloud).toBeUndefined();
  });

  it('loads an existing cloud workspace and refuses a stale device write', async () => {
    const store = await freshStore();
    const { emptyData } = await import('../defaults');
    const remote = { ...emptyData(), tasks: [{ id: 'remote-task', title: 'Cloud task' }] };
    window.localStorage.removeItem('pos.state.v1');
    cloud.loadWorkspace.mockResolvedValueOnce({ data: remote, updated_at: '2026-10-14T00:00:00Z', revision: 1 });
    await store.useStore.getState().initializeSync();
    cloud.user = { id: 'user-1', email: 'owner@example.com' };
    cloud.listener?.({ user: cloud.user });
    await vi.waitFor(() => expect(store.useStore.getState().syncStatus).toBe('synced'));
    expect(store.useStore.getState().data.tasks[0]?.id).toBe('remote-task');

    vi.useFakeTimers();
    store.actions.updateSettings({ userName: 'First edit' });
    cloud.saveWorkspace.mockResolvedValueOnce(true);
    cloud.loadWorkspace.mockResolvedValueOnce({ data: { ...remote, settings: { ...remote.settings, userName: 'First edit' } }, updated_at: '2026-10-14T00:00:30Z', revision: 2 });
    await vi.advanceTimersByTimeAsync(750);
    expect(cloud.saveWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ settings: expect.objectContaining({ userName: 'First edit' }) }), 1);
    expect(store.useStore.getState().syncStatus).toBe('synced');

    store.actions.updateSettings({ userName: 'Changed here' });
    cloud.saveWorkspace.mockResolvedValueOnce(false);
    cloud.loadWorkspace.mockResolvedValueOnce({ data: { ...remote, tasks: [{ id: 'other-device', title: 'Other edit' }] }, updated_at: '2026-10-14T00:01:00Z', revision: 3 });
    await vi.advanceTimersByTimeAsync(750);
    await vi.waitFor(() => expect(store.useStore.getState().syncStatus).toBe('conflict'));
    expect(store.useStore.getState().pendingCloud?.tasks[0]?.id).toBe('other-device');
    expect(store.useStore.getState().data.settings.userName).toBe('Changed here');
  });
});
