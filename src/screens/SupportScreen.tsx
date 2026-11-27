import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { getCloudState, subscribeCloud, type CloudState } from "@/net/cloud";
import { isSupportAdmin, listAllTickets, listMyTickets, submitTicket, SUPPORT_ENABLED, updateTicket, type Ticket } from "@/net/support";
import { TICKET_AREAS, TICKET_LIMITS, TICKET_STATUSES, TICKET_TOPICS, validateTicketDraft, type TicketDraft, type TicketStatus, type TicketTopic } from "@/config/support";

interface SupportScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const EMPTY: TicketDraft = { topic: null, area: null, subject: "", body: "", contactEmail: "" };
/** sessionStorage key a page sets before opening Support with a draft ready (see openSupportWithDraft). */
export const SUPPORT_DRAFT_KEY = "hn-support-draft";

/** Stores a draft for the Support form to open with. */
export function prefillSupportDraft(d: Partial<TicketDraft>): void {
  try {
    window.sessionStorage.setItem(SUPPORT_DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* the form opens empty */
  }
}
const topicColor = (id: TicketTopic) => TICKET_TOPICS.find((x) => x.id === id)?.color ?? "#b8a888";

/**
 * SUPORTE — players open a ticket (picking a topic so every ticket arrives
 * sorted: suggestion, bug, balance, payment, account, report, other) and
 * follow their own tickets and the answers. Accounts listed in
 * support_admins also get the Ticket Center on this same page: every ticket,
 * filtered by topic and status, with a reply box.
 */
export function SupportScreen({ onNavigate, onPlay }: SupportScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [cloud, setCloud] = useState<CloudState>(getCloudState());
  useEffect(() => subscribeCloud(setCloud), []);
  const signedIn = cloud.email !== null && cloud.status !== "SIGNED_OUT";

  // another page can open this form already filled in (e.g. the Creators page's application)
  const [draft, setDraft] = useState<TicketDraft>(() => {
    try {
      const raw = window.sessionStorage.getItem(SUPPORT_DRAFT_KEY);
      if (!raw) return EMPTY;
      window.sessionStorage.removeItem(SUPPORT_DRAFT_KEY);
      const d = JSON.parse(raw) as Partial<TicketDraft>;
      return { ...EMPTY, ...d };
    } catch {
      return EMPTY;
    }
  });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [mine, setMine] = useState<Ticket[] | null>(null);
  const [admin, setAdmin] = useState(false);

  const errors = validateTicketDraft(draft, signedIn);
  const topicDef = TICKET_TOPICS.find((x) => x.id === draft.topic);
  const set = (patch: Partial<TicketDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

  const refreshMine = useCallback(async () => setMine(await listMyTickets()), []);
  useEffect(() => {
    if (!SUPPORT_ENABLED) return;
    void refreshMine();
    void isSupportAdmin().then(setAdmin);
  }, [refreshMine, cloud.email]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (errors.length || busy) return;
    setBusy(true);
    setNotice(null);
    const r = await submitTicket(draft, language);
    setBusy(false);
    if (r.ok) {
      setDraft(EMPTY);
      setTried(false);
      setNotice({ kind: "ok", text: t("support.sent") });
      void refreshMine();
    } else {
      setNotice({ kind: "err", text: t(r.error === "RATE_LIMIT" ? "support.errRate" : r.error === "OFF" ? "support.off" : "support.errNetwork", { hour: TICKET_LIMITS.perHour, day: TICKET_LIMITS.perDay }) });
    }
  }

  const show = (k: string) => tried && errors.includes(k as never);

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + SUPPORT_CSS}</style>
      <TopNav active="SUPPORT" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("support.title")}</h1>
              <p className="pg-lead">{t("support.lead")}</p>
            </div>
          </div>
        </header>

        <div className="pg-wrap sp-wrap">
          {!SUPPORT_ENABLED && (
            <p className="sp-off" data-testid="support-off">
              {t("support.off")}
            </p>
          )}

          <div className="sp-cols">
            <form className="sp-form" onSubmit={send} noValidate data-testid="support-form">
              <fieldset className="sp-field" disabled={!SUPPORT_ENABLED}>
                <legend>{t("support.topicLabel")}</legend>
                <div className="sp-topics" role="radiogroup" aria-label={t("support.topicLabel")}>
                  {TICKET_TOPICS.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      role="radio"
                      aria-checked={draft.topic === tp.id}
                      className={`sp-topic${draft.topic === tp.id ? " is-on" : ""}`}
                      style={{ ["--tc" as string]: tp.color }}
                      onClick={() => set({ topic: tp.id, area: tp.asksArea ? draft.area : null })}
                      data-testid={`topic-${tp.id}`}
                    >
                      <strong>{t(`support.topics.${tp.id}.name` as TranslationKey)}</strong>
                      <small>{t(`support.topics.${tp.id}.hint` as TranslationKey)}</small>
                    </button>
                  ))}
                </div>
                {show("TOPIC") && <p className="sp-err">{t("support.errTopic")}</p>}
              </fieldset>

              {topicDef?.asksArea && (
                <fieldset className="sp-field" disabled={!SUPPORT_ENABLED}>
                  <legend>{t("support.areaLabel")}</legend>
                  <div className="pg-chips sp-areas">
                    {TICKET_AREAS.map((a) => (
                      <button key={a} type="button" className={draft.area === a ? "is-on" : ""} aria-pressed={draft.area === a} onClick={() => set({ area: a })}>
                        {t(`support.areas.${a}` as TranslationKey)}
                      </button>
                    ))}
                  </div>
                  {show("AREA") && <p className="sp-err">{t("support.errArea")}</p>}
                </fieldset>
              )}

              <label className="sp-label">
                <span>{t("support.subjectLabel")}</span>
                <input value={draft.subject} maxLength={TICKET_LIMITS.subjectMax} onChange={(e) => set({ subject: e.target.value })} placeholder={t("support.subjectPh")} disabled={!SUPPORT_ENABLED} data-testid="support-subject" />
                {(show("SUBJECT_SHORT") || show("SUBJECT_LONG")) && <em className="sp-err">{t("support.errSubject", { min: TICKET_LIMITS.subjectMin })}</em>}
              </label>

              <label className="sp-label">
                <span>
                  {t("support.bodyLabel")}
                  <small className="sp-count">
                    {draft.body.trim().length}/{TICKET_LIMITS.bodyMax}
                  </small>
                </span>
                <textarea rows={7} value={draft.body} maxLength={TICKET_LIMITS.bodyMax} onChange={(e) => set({ body: e.target.value })} placeholder={t(draft.topic === "BUG" ? "support.bodyPhBug" : "support.bodyPh")} disabled={!SUPPORT_ENABLED} data-testid="support-body" />
                {(show("BODY_SHORT") || show("BODY_LONG")) && <em className="sp-err">{t("support.errBody", { min: TICKET_LIMITS.bodyMin })}</em>}
              </label>

              <label className="sp-label">
                <span>{signedIn ? t("support.emailLabelOptional") : t("support.emailLabel")}</span>
                <input type="email" value={draft.contactEmail} maxLength={TICKET_LIMITS.emailMax} onChange={(e) => set({ contactEmail: e.target.value })} placeholder={signedIn ? (cloud.email ?? "") : "voce@email.com"} disabled={!SUPPORT_ENABLED} data-testid="support-email" />
                {show("EMAIL") && <em className="sp-err">{t("support.errEmail")}</em>}
              </label>

              <p className="sp-fine">{t("support.privacy")}</p>
              <div className="sp-send">
                <button className="pg-btn" type="submit" disabled={!SUPPORT_ENABLED || busy} data-testid="support-send">
                  {busy ? t("support.sending") : t("support.send")}
                </button>
                {notice && (
                  <p className={`sp-notice is-${notice.kind}`} role="status">
                    {notice.text}
                  </p>
                )}
              </div>
            </form>

            <aside className="sp-mine" data-testid="support-mine">
              <h2 className="pg-h2">{t("support.mineTitle")}</h2>
              {!SUPPORT_ENABLED ? (
                <p className="pg-sub">{t("support.mineOff")}</p>
              ) : mine === null ? (
                <p className="pg-sub">{t("support.loading")}</p>
              ) : mine.length === 0 ? (
                <p className="pg-sub">{t("support.mineEmpty")}</p>
              ) : (
                <ul className="sp-list">
                  {mine.map((tk) => (
                    <TicketRow key={tk.id} tk={tk} when={when} />
                  ))}
                </ul>
              )}
              <p className="sp-fine">{t("support.mineNote")}</p>
            </aside>
          </div>

          {admin && <TicketCenter when={when} />}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: TicketStatus }) {
  const { t } = useLanguage();
  return <span className={`sp-status is-${status.toLowerCase()}`}>{t(`support.status.${status}` as TranslationKey)}</span>;
}

function TopicTag({ topic }: { topic: TicketTopic }) {
  const { t } = useLanguage();
  return (
    <span className="sp-tag" style={{ ["--tc" as string]: topicColor(topic) }}>
      {t(`support.topics.${topic}.name` as TranslationKey)}
    </span>
  );
}

function TicketRow({ tk, when }: { tk: Ticket; when: (iso: string) => string }) {
  const { t } = useLanguage();
  return (
    <li className="sp-item">
      <details>
        <summary>
          <span className="sp-item-top">
            <TopicTag topic={tk.topic} />
            <StatusPill status={tk.status} />
            <time dateTime={tk.created_at}>{when(tk.created_at)}</time>
          </span>
          <strong>{tk.subject}</strong>
        </summary>
        <p className="sp-body">{tk.body}</p>
        {tk.reply ? (
          <div className="sp-reply">
            <small>{t("support.replyFrom", { when: tk.replied_at ? when(tk.replied_at) : "" })}</small>
            <p>{tk.reply}</p>
          </div>
        ) : (
          <p className="sp-fine">{t("support.noReplyYet")}</p>
        )}
      </details>
    </li>
  );
}

/** CENTRAL DE TICKETS — only reachable by accounts in support_admins (the database refuses everyone else). */
function TicketCenter({ when }: { when: (iso: string) => string }) {
  const { t } = useLanguage();
  const [all, setAll] = useState<Ticket[] | null>(null);
  const [topic, setTopic] = useState<TicketTopic | null>(null);
  const [status, setStatus] = useState<TicketStatus | null>("OPEN");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => setAll(await listAllTickets({})), []);
  useEffect(() => void load(), [load]);

  const byStatus = useMemo(() => (all ?? []).filter((x) => !status || x.status === status), [all, status]);
  const list = useMemo(() => byStatus.filter((x) => !topic || x.topic === topic), [byStatus, topic]);
  const countTopic = (id: TicketTopic) => byStatus.filter((x) => x.topic === id).length;
  const countStatus = (s: TicketStatus) => (all ?? []).filter((x) => x.status === s).length;

  return (
    <section className="sp-center" data-testid="ticket-center">
      <div className="sp-center-head">
        <h2 className="pg-h2">{t("support.centerTitle")}</h2>
        <button className="pg-link" onClick={() => void load()}>
          {t("support.refresh")}
        </button>
      </div>
      <p className="pg-sub">{t("support.centerLead")}</p>
      <div className="pg-chips" role="toolbar" aria-label={t("support.statusLabel")}>
        <button className={status === null ? "is-on" : ""} onClick={() => setStatus(null)}>
          {t("support.all")}
          <small>{all?.length ?? 0}</small>
        </button>
        {TICKET_STATUSES.map((s) => (
          <button key={s} className={status === s ? "is-on" : ""} onClick={() => setStatus(s)}>
            {t(`support.status.${s}` as TranslationKey)}
            <small>{countStatus(s)}</small>
          </button>
        ))}
      </div>
      <div className="pg-chips sp-topic-chips" role="toolbar" aria-label={t("support.topicLabel")}>
        <button className={topic === null ? "is-on" : ""} onClick={() => setTopic(null)}>
          {t("support.allTopics")}
          <small>{byStatus.length}</small>
        </button>
        {TICKET_TOPICS.map((tp) => (
          <button key={tp.id} className={topic === tp.id ? "is-on" : ""} style={{ ["--tc" as string]: tp.color }} onClick={() => setTopic(tp.id)}>
            <i className="sp-dot" aria-hidden="true" />
            {t(`support.topics.${tp.id}.name` as TranslationKey)}
            <small>{countTopic(tp.id)}</small>
          </button>
        ))}
      </div>
      {all === null ? (
        <p className="pg-sub">{t("support.loading")}</p>
      ) : list.length === 0 ? (
        <p className="pg-sub">{t("support.centerEmpty")}</p>
      ) : (
        <ul className="sp-list sp-admin-list">
          {list.map((tk) => (
            <AdminTicket key={tk.id} tk={tk} when={when} open={openId === tk.id} onToggle={() => setOpenId(openId === tk.id ? null : tk.id)} onSaved={load} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminTicket({ tk, when, open, onToggle, onSaved }: { tk: Ticket; when: (iso: string) => string; open: boolean; onToggle: () => void; onSaved: () => Promise<void> }) {
  const { t } = useLanguage();
  const [reply, setReply] = useState(tk.reply ?? "");
  const [st, setSt] = useState<TicketStatus>(tk.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function save(nextStatus: TicketStatus) {
    setBusy(true);
    setErr(false);
    const text = reply.trim().slice(0, TICKET_LIMITS.replyMax);
    const ok = await updateTicket(tk.id, { status: nextStatus, ...(text && text !== (tk.reply ?? "") ? { reply: text } : {}) });
    setBusy(false);
    if (!ok) setErr(true);
    else await onSaved();
  }

  const dev = tk.device ?? {};
  return (
    <li className={`sp-item sp-admin${open ? " is-open" : ""}`}>
      <button className="sp-admin-sum" onClick={onToggle} aria-expanded={open}>
        <span className="sp-item-top">
          <TopicTag topic={tk.topic} />
          {tk.area && <span className="sp-area">{t(`support.areas.${tk.area}` as TranslationKey)}</span>}
          <StatusPill status={tk.status} />
          <time dateTime={tk.created_at}>{when(tk.created_at)}</time>
        </span>
        <strong>{tk.subject}</strong>
      </button>
      {open && (
        <div className="sp-admin-body">
          <p className="sp-body">{tk.body}</p>
          <dl className="sp-meta">
            <div>
              <dt>{t("support.metaContact")}</dt>
              <dd>{tk.contact_email ? <a href={`mailto:${tk.contact_email}?subject=${encodeURIComponent(`HORDE NOVA — ${tk.subject}`)}`}>{tk.contact_email}</a> : "—"}</dd>
            </div>
            <div>
              <dt>{t("support.metaAccount")}</dt>
              <dd>{tk.user_id ? t("support.yes") : t("support.no")}</dd>
            </div>
            <div>
              <dt>{t("support.metaVersion")}</dt>
              <dd>
                {tk.game_version ?? "—"} · {tk.language ?? "—"}
              </dd>
            </div>
            <div>
              <dt>{t("support.metaDevice")}</dt>
              <dd>
                {String(dev.viewport ?? "—")} · {dev.touch ? t("support.touch") : t("support.mouse")}
              </dd>
            </div>
          </dl>
          {typeof dev.ua === "string" && <p className="sp-ua">{dev.ua}</p>}
          <label className="sp-label">
            <span>{t("support.replyLabel")}</span>
            <textarea rows={5} value={reply} maxLength={TICKET_LIMITS.replyMax} onChange={(e) => setReply(e.target.value)} placeholder={t("support.replyPh")} />
          </label>
          <div className="sp-admin-actions">
            <select value={st} onChange={(e) => setSt(e.target.value as TicketStatus)} aria-label={t("support.statusLabel")}>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`support.status.${s}` as TranslationKey)}
                </option>
              ))}
            </select>
            <button className="pg-btn-ghost" disabled={busy} onClick={() => void save(st)}>
              {t("support.saveStatus")}
            </button>
            <button className="pg-btn" disabled={busy || !reply.trim()} onClick={() => void save("ANSWERED")}>
              {t("support.sendReply")}
            </button>
            {err && <em className="sp-err">{t("support.errNetworkShort")}</em>}
          </div>
        </div>
      )}
    </li>
  );
}


const SUPPORT_CSS = `
.sp-wrap { padding-top: 28px; padding-bottom: 64px; }
.sp-off { margin: 0 0 22px; padding: 14px 16px; border-radius: 10px; border: 1px solid rgba(226,104,90,0.45); background: rgba(226,104,90,0.08); color: #f2c7bf; line-height: 1.55; font-size: 14px; }
.sp-cols { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 40px; align-items: start; }
.sp-form { display: grid; gap: 20px; }
.sp-field { margin: 0; padding: 0; border: 0; min-width: 0; }
.sp-field legend, .sp-label > span { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; font-family: var(--display); font-size: 21px; font-weight: 700; color: var(--bone); }
.sp-topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.sp-topic { --tc: var(--gold); display: grid; gap: 3px; text-align: left; padding: 11px 13px 12px; border-radius: 10px; cursor: pointer; background: var(--night-2); border: 1px solid var(--line-soft); border-left: 3px solid color-mix(in srgb, var(--tc) 60%, transparent); transition: border-color 120ms, background 120ms; }
.sp-topic strong { font-size: 14.5px; color: var(--bone); }
.sp-topic small { font-size: 12px; line-height: 1.35; color: var(--ash); }
.sp-topic:hover { border-color: color-mix(in srgb, var(--tc) 50%, transparent); }
.sp-topic.is-on { background: color-mix(in srgb, var(--tc) 14%, var(--night-2)); border-color: var(--tc); box-shadow: inset 0 0 0 1px var(--tc); }
.sp-topic.is-on strong { color: color-mix(in srgb, var(--tc) 45%, #fff); }
.sp-areas { padding-top: 0; flex-wrap: wrap; }
.sp-label { display: grid; min-width: 0; }
.sp-label input, .sp-label textarea, .sp-admin-actions select { width: 100%; box-sizing: border-box; padding: 11px 13px; border-radius: 9px; font: inherit; font-size: 15px; color: var(--bone); background: #0c0906; border: 1px solid rgba(239,229,210,0.18); }
.sp-label textarea { resize: vertical; line-height: 1.55; min-height: 120px; }
.sp-label input:focus, .sp-label textarea:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(232,176,75,0.18); }
.sp-count { font-family: inherit; font-size: 12px; font-weight: 400; color: var(--ash-2); font-variant-numeric: tabular-nums; }
.sp-err { display: block; margin: 6px 0 0; font-size: 13px; font-style: normal; color: #f0927f; }
.sp-fine { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--ash); }
.sp-send { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.sp-send .pg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sp-notice { margin: 0; font-size: 14px; line-height: 1.5; }
.sp-notice.is-ok { color: var(--ok); }
.sp-notice.is-err { color: #f0927f; }
.sp-mine { position: sticky; top: 18px; display: grid; gap: 12px; padding: 20px; border-radius: 14px; background: var(--night-2); border: 1px solid var(--line); }
.sp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.sp-item { border-radius: 10px; background: rgba(0,0,0,0.28); border: 1px solid var(--line-soft); }
.sp-item summary, .sp-admin-sum { display: grid; gap: 6px; padding: 11px 13px; cursor: pointer; list-style: none; text-align: left; width: 100%; background: none; border: 0; }
.sp-item summary::-webkit-details-marker { display: none; }
.sp-item summary strong, .sp-admin-sum strong { font-size: 14.5px; color: var(--bone); overflow-wrap: anywhere; }
.sp-item-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.sp-item-top time { margin-left: auto; font-size: 12px; color: var(--ash-2); font-variant-numeric: tabular-nums; }
.sp-tag { --tc: var(--gold); font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; color: color-mix(in srgb, var(--tc) 55%, #fff); background: color-mix(in srgb, var(--tc) 18%, transparent); border: 1px solid color-mix(in srgb, var(--tc) 45%, transparent); }
.sp-area { font-size: 12px; color: var(--ash); }
.sp-status { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(239,229,210,0.2); color: var(--ash); }
.sp-status.is-open { color: #f7dc9c; border-color: rgba(232,176,75,0.5); }
.sp-status.is-in_review { color: #b9d6ff; border-color: rgba(143,198,255,0.5); }
.sp-status.is-answered { color: #b5ecc0; border-color: rgba(142,211,155,0.55); }
.sp-body { margin: 0; padding: 0 13px 10px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.6; color: #d9cdb6; }
.sp-item .sp-fine { padding: 0 13px 12px; }
.sp-reply { margin: 0 10px 12px; padding: 10px 12px; border-radius: 8px; background: rgba(142,211,155,0.08); border-left: 3px solid var(--ok); }
.sp-reply small { font-size: 12px; color: var(--ok); }
.sp-reply p { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.6; }
.sp-center { margin-top: 56px; padding-top: 28px; border-top: 1px solid var(--line); }
.sp-center-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
.sp-topic-chips { padding-top: 8px; }
.sp-topic-chips .sp-dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--tc); }
.sp-admin-list { margin-top: 14px; }
.sp-admin.is-open { border-color: var(--line); }
.sp-admin-body { display: grid; gap: 12px; padding-bottom: 14px; }
.sp-admin-body > .sp-label, .sp-admin-actions { padding: 0 13px; }
.sp-meta { margin: 0; padding: 0 13px; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px 16px; }
.sp-meta dt { font-size: 12px; color: var(--ash-2); }
.sp-meta dd { margin: 2px 0 0; font-size: 13.5px; overflow-wrap: anywhere; }
.sp-meta a { color: var(--gold); }
.sp-ua { margin: 0; padding: 0 13px; font-size: 11.5px; color: var(--ash-2); overflow-wrap: anywhere; }
.sp-admin-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.sp-admin-actions select { width: auto; }
.sp-admin-actions .pg-btn { padding: 11px 20px; }
.sp-admin-actions .pg-btn-ghost { padding: 10px 16px; }
@media (max-width: 860px) {
  .sp-cols { grid-template-columns: 1fr; gap: 28px; }
  .sp-mine { position: static; }
}
@media (max-width: 520px) {
  .sp-topics { grid-template-columns: 1fr 1fr; }
  .sp-topic { padding: 10px; }
  .sp-topic small { font-size: 11.5px; }
  .sp-send .pg-btn { width: 100%; }
  .sp-item-top time { margin-left: 0; width: 100%; }
}
`;
