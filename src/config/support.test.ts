import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TICKET_AREAS, TICKET_LIMITS, TICKET_STATUSES, TICKET_TOPICS, validateTicketDraft, type TicketDraft } from "./support";
import { en } from "@/i18n/locales/en";
import { ptBR } from "@/i18n/locales/ptBR";

const ok: TicketDraft = { topic: "SUGGESTION", area: null, subject: "More maps", body: "A snow map would be great.", contactEmail: "a@b.co" };
const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0002_support_tickets.sql"), "utf8");

describe("support tickets — the form's rules", () => {
  it("a complete draft passes", () => expect(validateTicketDraft(ok, false)).toEqual([]));

  it("asks for a topic, and for the area only on topics that need it", () => {
    expect(validateTicketDraft({ ...ok, topic: null }, false)).toContain("TOPIC");
    expect(validateTicketDraft({ ...ok, topic: "BUG" }, false)).toEqual(["AREA"]);
    expect(validateTicketDraft({ ...ok, topic: "BUG", area: "DUEL" }, false)).toEqual([]);
  });

  it("subject and details have a minimum and a maximum, counted without surrounding spaces", () => {
    expect(validateTicketDraft({ ...ok, subject: "  ab  " }, false)).toEqual(["SUBJECT_SHORT"]);
    expect(validateTicketDraft({ ...ok, subject: "x".repeat(TICKET_LIMITS.subjectMax + 1) }, false)).toEqual(["SUBJECT_LONG"]);
    expect(validateTicketDraft({ ...ok, body: "short" }, false)).toEqual(["BODY_SHORT"]);
    expect(validateTicketDraft({ ...ok, body: "x".repeat(TICKET_LIMITS.bodyMax + 1) }, false)).toEqual(["BODY_LONG"]);
  });

  it("an e-mail is required without an online account (so the answer can reach the player), optional with one, and always checked when typed", () => {
    expect(validateTicketDraft({ ...ok, contactEmail: "" }, false)).toEqual(["EMAIL"]);
    expect(validateTicketDraft({ ...ok, contactEmail: "" }, true)).toEqual([]);
    expect(validateTicketDraft({ ...ok, contactEmail: "not-an-email" }, true)).toEqual(["EMAIL"]);
  });

  it("the database accepts exactly the same topics, areas, statuses and limits", () => {
    const list = (col: string) => [...(sql.match(new RegExp(`${col} in \\(([^)]*)\\)`))?.[1] ?? "").matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(list("topic")).toEqual(TICKET_TOPICS.map((x) => x.id));
    expect(list("area")).toEqual([...TICKET_AREAS]);
    expect(list("status")).toEqual([...TICKET_STATUSES]);
    expect(sql).toContain(`length(subject) between ${TICKET_LIMITS.subjectMin} and ${TICKET_LIMITS.subjectMax}`);
    expect(sql).toContain(`length(body) between ${TICKET_LIMITS.bodyMin} and ${TICKET_LIMITS.bodyMax}`);
    expect(sql).toContain(`>= ${TICKET_LIMITS.perHour}`);
    expect(sql).toContain(`>= ${TICKET_LIMITS.perDay}`);
  });

  it("the database never lets a player answer or change a ticket, nor read someone else's", () => {
    expect(sql).toMatch(/for insert with check \(\s*status = 'OPEN' and reply is null/);
    expect(sql).toMatch(/for update using \(public\.is_support_admin\(\)\)/);
    expect(sql).toMatch(/for select using \(\(user_id is not null and user_id = auth\.uid\(\)\) or public\.is_support_admin\(\)\)/);
    expect(sql).toMatch(/support_admins enable row level security/);
  });

  it("every topic, area and status has a name in both languages", () => {
    for (const loc of [en, ptBR]) {
      for (const tp of TICKET_TOPICS) expect(loc.support.topics[tp.id].name.length).toBeGreaterThan(0);
      for (const a of TICKET_AREAS) expect(loc.support.areas[a].length).toBeGreaterThan(0);
      for (const s of TICKET_STATUSES) expect(loc.support.status[s].length).toBeGreaterThan(0);
    }
  });
});
