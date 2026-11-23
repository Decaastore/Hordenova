/**
 * SUPORTE — the topics a player picks when opening a ticket, and the rules a
 * ticket must pass before it is sent. The same limits are enforced again by
 * the database (supabase/migrations/0002_support_tickets.sql), so these only
 * exist to tell the player what's wrong before they press Send.
 */
export type TicketTopic = "SUGGESTION" | "BUG" | "BALANCE" | "PAYMENT" | "ACCOUNT" | "REPORT" | "OTHER";
export type TicketArea = "GAME" | "DUEL" | "COLOSSUS" | "ETERNAL" | "STORE" | "SITE" | "OTHER";
export type TicketStatus = "OPEN" | "IN_REVIEW" | "ANSWERED" | "CLOSED";

export interface TicketTopicDef {
  id: TicketTopic;
  /** Accent colour of the topic chip (on both the player's and the admin's side). */
  color: string;
  /** Whether the form asks where in the game it happened. */
  asksArea: boolean;
}

export const TICKET_TOPICS: readonly TicketTopicDef[] = [
  { id: "SUGGESTION", color: "#e8b04b", asksArea: false },
  { id: "BUG", color: "#e0644b", asksArea: true },
  { id: "BALANCE", color: "#9d7bff", asksArea: true },
  { id: "PAYMENT", color: "#4fc38a", asksArea: false },
  { id: "ACCOUNT", color: "#5aa8ff", asksArea: false },
  { id: "REPORT", color: "#ff7a9a", asksArea: false },
  { id: "OTHER", color: "#b8a888", asksArea: false },
];
export const TICKET_AREAS: readonly TicketArea[] = ["GAME", "DUEL", "COLOSSUS", "ETERNAL", "STORE", "SITE", "OTHER"];
export const TICKET_STATUSES: readonly TicketStatus[] = ["OPEN", "IN_REVIEW", "ANSWERED", "CLOSED"];

export const TICKET_LIMITS = {
  subjectMin: 4,
  subjectMax: 120,
  bodyMin: 10,
  bodyMax: 4000,
  emailMax: 160,
  replyMax: 4000,
  /** Same as the database guard: per device. */
  perHour: 5,
  perDay: 15,
} as const;

export interface TicketDraft {
  topic: TicketTopic | null;
  area: TicketArea | null;
  subject: string;
  body: string;
  /** Only asked when the player has no online account (so we can answer). */
  contactEmail: string;
}

export type TicketDraftError = "TOPIC" | "AREA" | "SUBJECT_SHORT" | "SUBJECT_LONG" | "BODY_SHORT" | "BODY_LONG" | "EMAIL";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What's still wrong with a draft (empty = ready to send). `hasAccount`: the e-mail is optional with an account. */
export function validateTicketDraft(d: TicketDraft, hasAccount: boolean): TicketDraftError[] {
  const errs: TicketDraftError[] = [];
  const topic = TICKET_TOPICS.find((x) => x.id === d.topic);
  if (!topic) errs.push("TOPIC");
  if (topic?.asksArea && !d.area) errs.push("AREA");
  const subject = d.subject.trim();
  if (subject.length < TICKET_LIMITS.subjectMin) errs.push("SUBJECT_SHORT");
  if (subject.length > TICKET_LIMITS.subjectMax) errs.push("SUBJECT_LONG");
  const body = d.body.trim();
  if (body.length < TICKET_LIMITS.bodyMin) errs.push("BODY_SHORT");
  if (body.length > TICKET_LIMITS.bodyMax) errs.push("BODY_LONG");
  const email = d.contactEmail.trim();
  if (email ? email.length > TICKET_LIMITS.emailMax || !EMAIL_RE.test(email) : !hasAccount) errs.push("EMAIL");
  return errs;
}
