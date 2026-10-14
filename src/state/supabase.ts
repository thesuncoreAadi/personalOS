import { createClient, type Session } from '@supabase/supabase-js';
import type { AppData } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(url && anonKey);

const client = supabaseConfigured ? createClient(url!, anonKey!, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;

export interface CloudUser { id: string; email: string }
export interface CloudWorkspace { data: unknown; updated_at: string; revision: number }

let activeSession: Session | null = null;

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Wait for Supabase to consume a magic-link callback and restore any saved session. */
export async function initializeAuth(): Promise<void> {
  if (!client) return;
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  activeSession = data.session;
}

export function currentUser(): CloudUser | null {
  const user = activeSession?.user;
  return user ? { id: user.id, email: user.email ?? '' } : null;
}

export function onAuthChange(callback: (session: { user: CloudUser } | null) => void): () => void {
  if (!client) return () => undefined;
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    activeSession = session;
    callback(session?.user ? { user: { id: session.user.id, email: session.user.email ?? '' } } : null);
  });
  return () => subscription.unsubscribe();
}

export async function sendSignInLink(email: string): Promise<void> {
  if (!client) throw new Error('Supabase is not configured.');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  throwIfError(error);
}

export async function signOut(): Promise<void> {
  if (!client) return;
  const { error } = await client.auth.signOut();
  throwIfError(error);
}

export async function loadWorkspace(): Promise<CloudWorkspace | null> {
  if (!client) throw new Error('Supabase is not configured.');
  const { data, error } = await client.from('personal_os_workspaces').select('data,updated_at,revision').maybeSingle();
  throwIfError(error);
  return data as CloudWorkspace | null;
}

export async function saveWorkspace(data: AppData, expectedRevision: number | null): Promise<boolean> {
  if (!client) throw new Error('Supabase is not configured.');
  const { data: saved, error } = await client.rpc('save_my_workspace', {
    workspace_data: data,
    expected_revision: expectedRevision,
  });
  throwIfError(error);
  return saved === true;
}
