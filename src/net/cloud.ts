/**
 * CONTA ONLINE — the account + cloud save (Supabase).
 *
 * Off unless the build has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY;
 * while off the game is exactly the local-only game it always was. The
 * Supabase library is only downloaded once the player opens the online
 * account (dynamic import), so it costs nothing to players who never do.
 *
 * Table and security rules: supabase/migrations/0001_init.sql (each player
 * can only read and write their own row).
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ETERNAL_STORAGE_KEY, onSaveWritten } from "@/engine/SaveSystem";
import { SAVE_STORAGE_KEY } from "@/config/gameBalance";
import { CLOUD_UPLOAD_DEBOUNCE_MS, decideSync, parseSyncRecord, type CloudRow, type CloudSnapshot, type SyncDecision, type SyncRecord } from "./cloudSync";

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export const CLOUD_ENABLED = URL_.length > 0 && KEY_.length > 0;

const SYNC_KEY = "hordenova.cloud.sync.v1";
const BACKUP_KEY = "hordenova.cloud.backup.v1";

export type CloudStatus = "OFF" | "SIGNED_OUT" | "SYNCING" | "SYNCED" | "ERROR";

export interface CloudState {
  status: CloudStatus;
  email: string | null;
  lastSyncedAt: number;
  error: string | null;
}

let state: CloudState = { status: CLOUD_ENABLED ? "SIGNED_OUT" : "OFF", email: null, lastSyncedAt: 0, error: null };
const listeners = new Set<(s: CloudState) => void>();

export function getCloudState(): CloudState {
  return state;
}

export function subscribeCloud(fn: (s: CloudState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(patch: Partial<CloudState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

let clientPromise: Promise<SupabaseClient> | null = null;
function client(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true } }));
  }
  return clientPromise;
}

function readLocal(): CloudSnapshot {
  try {
    return { save: window.localStorage.getItem(SAVE_STORAGE_KEY), eternal: window.localStorage.getItem(ETERNAL_STORAGE_KEY) };
  } catch {
    return { save: null, eternal: null };
  }
}

function readRecord(): SyncRecord | null {
  try {
    return parseSyncRecord(window.localStorage.getItem(SYNC_KEY));
  } catch {
    return null;
  }
}

function writeRecord(r: SyncRecord): void {
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify(r));
  } catch {
    // best effort
  }
}

let currentUser: User | null = null;
let uploadTimer: ReturnType<typeof setTimeout> | null = null;
let applyingDownload = false;

async function upload(): Promise<void> {
  if (!currentUser) return;
  const local = readLocal();
  if (!local.save) return;
  const at = Date.now();
  setState({ status: "SYNCING", error: null });
  const sb = await client();
  const { error } = await sb.from("saves").upsert({ user_id: currentUser.id, save: JSON.parse(local.save), eternal: local.eternal ? JSON.parse(local.eternal) : null, client_updated_at: at });
  if (error) {
    setState({ status: "ERROR", error: error.message });
    return;
  }
  writeRecord({ userId: currentUser.id, lastSyncedAt: at, dirtyAt: at });
  setState({ status: "SYNCED", lastSyncedAt: at });
}

function scheduleUpload(): void {
  if (!currentUser || applyingDownload) return;
  const r = readRecord();
  if (r && r.userId === currentUser.id) writeRecord({ ...r, dirtyAt: Date.now() });
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    uploadTimer = null;
    void upload();
  }, CLOUD_UPLOAD_DEBOUNCE_MS);
}

async function fetchRow(userId: string): Promise<CloudRow | null> {
  const sb = await client();
  const { data, error } = await sb.from("saves").select("save, eternal, client_updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    save: data.save ? JSON.stringify(data.save) : null,
    eternal: data.eternal ? JSON.stringify(data.eternal) : null,
    clientUpdatedAt: Number(data.client_updated_at) || 0,
  };
}

/** Runs the login decision; a download replaces this device's save and reloads the page so the game starts from it. */
async function reconcile(user: User): Promise<SyncDecision> {
  setState({ status: "SYNCING", email: user.email ?? null, error: null });
  const local = readLocal();
  const cloud = await fetchRow(user.id);
  const decision = decideSync(user.id, local, cloud, readRecord());
  if (decision === "UPLOAD") await upload();
  else if (decision === "DOWNLOAD" && cloud) {
    applyingDownload = true;
    try {
      if (local.save) window.localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), ...local }));
      if (cloud.save) window.localStorage.setItem(SAVE_STORAGE_KEY, cloud.save);
      if (cloud.eternal) window.localStorage.setItem(ETERNAL_STORAGE_KEY, cloud.eternal);
      else window.localStorage.removeItem(ETERNAL_STORAGE_KEY);
    } finally {
      writeRecord({ userId: user.id, lastSyncedAt: cloud.clientUpdatedAt, dirtyAt: cloud.clientUpdatedAt });
    }
    window.location.reload();
  } else {
    const r = readRecord();
    setState({ status: "SYNCED", lastSyncedAt: r?.lastSyncedAt ?? 0 });
  }
  return decision;
}

let started = false;

/** Call once at app start: restores a remembered session and keeps the cloud copy up to date. */
export function startCloud(): void {
  if (!CLOUD_ENABLED || started || typeof window === "undefined") return;
  started = true;
  onSaveWritten(() => scheduleUpload());
  window.addEventListener("pagehide", () => {
    if (uploadTimer) {
      clearTimeout(uploadTimer);
      uploadTimer = null;
      void upload();
    }
  });
  // only touch the network when a session was remembered on this device
  let remembered = false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) if (window.localStorage.key(i)?.startsWith("sb-")) remembered = true;
  } catch {
    // ignore
  }
  if (remembered) void restoreSession();
}

async function restoreSession(): Promise<void> {
  try {
    const sb = await client();
    const { data } = await sb.auth.getSession();
    if (data.session?.user) {
      currentUser = data.session.user;
      await reconcile(currentUser);
    }
  } catch (e) {
    setState({ status: "ERROR", error: (e as Error).message });
  }
}

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!CLOUD_ENABLED) return { ok: false, error: "OFF" };
  try {
    const sb = await client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, error: error?.message ?? "?" };
    currentUser = data.user;
    await reconcile(data.user);
    return { ok: true };
  } catch (e) {
    setState({ status: "ERROR", error: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!CLOUD_ENABLED) return { ok: false, error: "OFF" };
  try {
    const sb = await client();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    if (!data.session || !data.user) return { ok: true, needsConfirmation: true };
    currentUser = data.user;
    await reconcile(data.user);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function syncNow(): Promise<void> {
  if (currentUser) await upload();
}

export async function signOut(): Promise<void> {
  if (!CLOUD_ENABLED) return;
  if (uploadTimer) {
    clearTimeout(uploadTimer);
    uploadTimer = null;
    await upload();
  }
  const sb = await client();
  await sb.auth.signOut();
  currentUser = null;
  setState({ status: "SIGNED_OUT", email: null, error: null });
}
