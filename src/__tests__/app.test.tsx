import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { actions, clearEverything, useStore } from '../state/store';
import { STORAGE_KEY } from '../state/storage';
import { buildSeedData } from '../lib/seed';

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.localStorage.clear();
  clearEverything();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const text = () => container.textContent ?? '';

describe('application shell', () => {
  it('mounts and offers a first-run path', async () => {
    await act(async () => root.render(<App />));
    await flush();
    expect(text()).toContain('Personal OS');
    expect(text()).toContain('Overview');
    expect(text()).toContain('Your command centre is empty');
    expect(text()).toContain('Load demo workspace');
  });

  it('renders the full dashboard from a seeded workspace', async () => {
    useStore.getState().replaceAll(buildSeedData());
    window.location.hash = '#/overview';
    await act(async () => root.render(<App />));
    await flush();
    expect(text()).toContain('North Star');
    expect(text()).toContain("Today's execution");
    expect(text()).toContain('Demo data is loaded');
    expect(text()).toContain('Upcoming 21 days');
  });

  it('navigates to every route without throwing', async () => {
    useStore.getState().replaceAll(buildSeedData());
    await act(async () => root.render(<App />));
    await flush();
    for (const route of ['goals', 'technical', 'academics', 'marketing', 'tasks', 'reviews', 'settings']) {
      await act(async () => {
        window.location.hash = `#/${route}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      await flush();
    }
    expect(text()).toContain('Settings');
    expect(text()).toContain('How progress is calculated');
  });

  it('loads the demo workspace when the empty-state action is used', async () => {
    window.location.hash = '#/overview';
    await act(async () => root.render(<App />));
    await flush();
    const button = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Load demo workspace'),
    );
    expect(button).toBeTruthy();
    await act(async () => button!.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    await flush();
    expect(useStore.getState().data.goals.length).toBeGreaterThan(5);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('renders the technical tracks independently', async () => {
    useStore.getState().replaceAll(buildSeedData());
    await act(async () => root.render(<App />));
    await act(async () => {
      window.location.hash = '#/technical';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await flush();
    expect(text()).toContain('Track A · DSA & Fundamentals');
    expect(text()).toContain('Track B · Machine Learning');
    expect(text()).toContain('Track C · Generative AI');
    expect(text()).toContain('Topic mastery');
    expect(text()).toContain('Portfolio evidence');
  });

  it('renders the content kanban with all seven stages', async () => {
    useStore.getState().replaceAll(buildSeedData());
    await act(async () => root.render(<App />));
    await act(async () => {
      window.location.hash = '#/marketing';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await flush();
    for (const stage of ['Ideas', 'Research', 'Script', 'Production', 'Editing', 'Ready to publish', 'Published']) {
      expect(text()).toContain(stage);
    }
  });

  it('keeps a user mutation after a simulated refresh', async () => {
    useStore.getState().replaceAll(buildSeedData());
    await act(async () => root.render(<App />));
    await flush();
    actions.updateSettings({ userName: 'Aisha' });
    useStore.setState({ data: { ...useStore.getState().data, settings: { ...useStore.getState().data.settings, userName: 'Nobody' } } });
    await act(async () => useStore.getState().hydrate());
    await flush();
    expect(useStore.getState().data.settings.userName).toBe('Aisha');
  });
});
