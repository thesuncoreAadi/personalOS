/**
 * Safe storage wrapper.
 *
 * localStorage throws in some sandboxed iframes and private modes, so every access is
 * guarded. When storage is unavailable the app still works for the session and the UI
 * shows a banner telling the user that data will not survive a refresh.
 */

export const STORAGE_KEY = 'pos.state.v1';

let warned = false;
export let storageAvailable = true;

function probe(): boolean {
  try {
    const k = '__pos_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function readRaw(): string | null {
  if (typeof window === 'undefined') return null;
  if (!warned) {
    storageAvailable = probe();
    warned = true;
  }
  if (!storageAvailable) return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    return null;
  }
}

export function writeRaw(value: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!warned) {
    storageAvailable = probe();
    warned = true;
  }
  if (!storageAvailable) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}

export function clearRaw(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
