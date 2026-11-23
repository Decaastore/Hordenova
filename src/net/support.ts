import { CLOUD_ENABLED, getCloudClient, getCloudUser } from "./cloud";
import { PATCH_NOTES } from "@/config/patchNotes";
import { TICKET_LIMITS, type TicketArea, type TicketDraft, type TicketStatus, type TicketTopic } from "@/config/support";

/**
 * SUPORTE — sending tickets and reading them back (supabase/migrations/
 * 0002_support_tickets.sql). Works with or without an online account: every
 * ticket carries a secret key that this browser keeps, so a player without an
 * account can still follow their tickets and read the answers. Only the
 * e-mails in support_admins can read every ticket (the Ticket Center).
 *
 * While the online account is off (no Supabase in the build) nothing can be
 * sent, and the screen says so — tickets are never silently lost.
 */
export const SUPPORT_ENABLED = CLOUD_ENABLED;

const KEYS_KEY = "hordenova.support.keys.v1";
const CLIENT_KEY = "hordenova.support.client.v1";

export interface Ticket {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  topic: TicketTopic;
  area: TicketArea | null;
  subject: string;
  body: string;
  contact_email: string | null;
  language: string | null;
  game_version: string | null;
  device: Record<string, unknown> | null;
  status: TicketStatus;
  reply: string | null;
  replied_at: string | null;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** The secret keys of the tickets sent from this browser (newest first, at most 50). */
export function readTicketKeys(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEYS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

function rememberTicketKey(key: string): void {
  try {
    window.localStorage.setItem(KEYS_KEY, JSON.stringify([key, ...readTicketKeys().filter((k) => k !== key)].slice(0, 50)));
  } catch {
    // best effort: without storage the player can still read answers by e-mail or account
  }
}

function clientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = uuid();
      window.localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

/** A short, non-identifying description of the device — helps reproduce a bug. */
export function deviceInfo(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return {
    ua: navigator.userAgent.slice(0, 220),
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio ?? 1,
    touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  };
}

export type SendResult = { ok: true } | { ok: false; error: "OFF" | "RATE_LIMIT" | "NETWORK" };

export async function submitTicket(d: TicketDraft, language: string): Promise<SendResult> {
  const sb = await getCloudClient();
  if (!sb) return { ok: false, error: "OFF" };
  const user = getCloudUser();
  const accessKey = uuid();
  const email = d.contactEmail.trim() || user?.email || null;
  const { error } = await sb.from("support_tickets").insert({
    user_id: user?.id ?? null,
    access_key: accessKey,
    client_id: clientId(),
    topic: d.topic,
    area: d.area,
    subject: d.subject.trim().slice(0, TICKET_LIMITS.subjectMax),
    body: d.body.trim().slice(0, TICKET_LIMITS.bodyMax),
    contact_email: email,
    language,
    game_version: PATCH_NOTES[0]?.id ?? null,
    device: deviceInfo(),
  });
  if (error) return { ok: false, error: /TICKET_RATE_LIMIT/.test(error.message) ? "RATE_LIMIT" : "NETWORK" };
  rememberTicketKey(accessKey);
  return { ok: true };
}

/** The player's own tickets: by account (RLS) plus every ticket this browser sent. */
export async function listMyTickets(): Promise<Ticket[] | null> {
  const sb = await getCloudClient();
  if (!sb) return null;
  const out = new Map<string, Ticket>();
  const keys = readTicketKeys();
  if (keys.length) {
    const { data } = await sb.rpc("get_tickets_by_keys", { keys });
    for (const t of (data as Ticket[] | null) ?? []) out.set(t.id, t);
  }
  const user = getCloudUser();
  if (user) {
    const { data } = await sb.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    for (const t of (data as Ticket[] | null) ?? []) out.set(t.id, t);
  }
  return [...out.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------------------------------------------------------------- Ticket Center (admins only)

/** True when the signed-in account is in support_admins. */
export async function isSupportAdmin(): Promise<boolean> {
  const sb = await getCloudClient();
  if (!sb || !getCloudUser()) return false;
  const { data, error } = await sb.rpc("is_support_admin");
  return !error && data === true;
}

export async function listAllTickets(filter: { topic?: TicketTopic | null; status?: TicketStatus | null }): Promise<Ticket[]> {
  const sb = await getCloudClient();
  if (!sb) return [];
  let q = sb.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(300);
  if (filter.topic) q = q.eq("topic", filter.topic);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return (data as Ticket[] | null) ?? [];
}

export async function updateTicket(id: string, patch: { status?: TicketStatus; reply?: string }): Promise<boolean> {
  const sb = await getCloudClient();
  if (!sb) return false;
  const { error } = await sb.from("support_tickets").update(patch).eq("id", id);
  return !error;
}
