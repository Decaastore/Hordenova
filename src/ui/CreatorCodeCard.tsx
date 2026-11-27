import { useState, type FormEvent } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { applyCreatorCode, clearCreatorCode, currentCreator } from "@/engine/CreatorService";
import { CREATOR_PURCHASE_BONUS_PCT } from "@/config/creators";

/**
 * APOIE UM CRIADOR — the Store's creator-code box (config/creators.ts). The
 * code is checked against the approved creators; once set it shows who the
 * player supports, with a way to change or remove it.
 */
export function CreatorCodeCard({ onOpenCreators }: { onOpenCreators: () => void }) {
  const { t } = useLanguage();
  const [creator, setCreator] = useState(() => currentCreator());
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = applyCreatorCode(code);
    if (r.ok) {
      setCreator(r.creator);
      setCode("");
      setEditing(false);
      setMsg({ kind: "ok", text: t("store.creatorDone", { name: r.creator.name }) });
    } else {
      setMsg({ kind: "err", text: t(r.reason === "SAME" ? "store.creatorSame" : r.reason === "INVALID" ? "store.creatorInvalid" : "store.creatorUnknown") });
    }
  };

  return (
    <section className="st-creator" aria-labelledby="st-creator-h" data-testid="creator-code">
      <div>
        <h2 id="st-creator-h" className="st-creator-h">{t("store.creatorTitle")}</h2>
        <p className="st-creator-p">{t("store.creatorBody", { pct: CREATOR_PURCHASE_BONUS_PCT })}</p>
        <button className="pg-link" onClick={onOpenCreators}>
          {t("store.creatorProgram")}
        </button>
      </div>
      <div className="st-creator-side">
        {creator && !editing ? (
          <>
            <p className="st-creator-now">{t("store.creatorSupporting", { name: creator.name })}</p>
            <div className="st-creator-actions">
              <button className="pg-btn-ghost" onClick={() => setEditing(true)}>
                {t("store.creatorChange")}
              </button>
              <button
                className="pg-btn-ghost"
                onClick={() => {
                  clearCreatorCode();
                  setCreator(null);
                  setMsg(null);
                }}
              >
                {t("store.creatorRemove")}
              </button>
            </div>
          </>
        ) : (
          <form className="st-creator-form" onSubmit={submit}>
            <label htmlFor="st-creator-code">{t("store.creatorLabel")}</label>
            <div>
              <input id="st-creator-code" value={code} maxLength={20} autoComplete="off" spellCheck={false} onChange={(e) => setCode(e.target.value)} placeholder={t("store.creatorPlaceholder")} />
              <button className="pg-btn" type="submit" disabled={code.trim().length < 3}>
                {t("store.creatorApply")}
              </button>
            </div>
          </form>
        )}
        {msg && (
          <p className={`st-creator-msg is-${msg.kind}`} role="status">
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}

export const CREATOR_CODE_CSS = `
.st-creator { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 24px; align-items: center; margin: 28px 0 0; padding: 20px 22px; border-radius: 14px; background: var(--night-2); border: 1px solid var(--line-soft); }
.st-creator-h { margin: 0; font-family: var(--display); font-weight: 700; font-size: 24px; color: var(--bone); }
.st-creator-p { margin: 6px 0 8px; font-size: 14px; line-height: 1.55; color: #d9cdb6; max-width: 60ch; }
.st-creator-form label { display: block; font-size: 12.5px; color: var(--ash-2); margin-bottom: 6px; }
.st-creator-form div { display: flex; gap: 8px; }
.st-creator-form input { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: rgba(0,0,0,0.35); color: var(--bone); font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em; }
.st-creator-form input:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.st-creator-now { margin: 0 0 8px; font-size: 16px; font-weight: 700; color: var(--gold-hi); }
.st-creator-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.st-creator-msg { margin: 8px 0 0; font-size: 13.5px; }
.st-creator-msg.is-ok { color: #8fe0a8; }
.st-creator-msg.is-err { color: #ffb38a; }
@media (max-width: 760px) { .st-creator { grid-template-columns: 1fr; } }
`;
