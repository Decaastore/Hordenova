import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { CLOUD_ENABLED, getCloudState, signIn, signOut, signUp, subscribeCloud, syncNow, type CloudState } from "@/net/cloud";

/** CONTA ONLINE — sign in / create account and the cloud-save status, on the Account page. */
export function CloudAccountSection() {
  const { t, language } = useLanguage();
  const [cloud, setCloud] = useState<CloudState>(getCloudState());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => subscribeCloud(setCloud), []);

  const when = (ms: number) => new Date(ms).toLocaleString(language === "ptBR" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" });

  async function run(kind: "in" | "up", e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = kind === "in" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (!r.ok) setMsg(t("account.cloud.error", { error: r.error }));
    else if (r.needsConfirmation) setMsg(t("account.cloud.confirm"));
  }

  const signedIn = cloud.email !== null && cloud.status !== "SIGNED_OUT";

  return (
    <section className="ac-block" data-testid="cloud-account">
      <style>{CLOUD_CSS}</style>
      <h2 className="pg-h2">{t("account.cloud.title")}</h2>
      {!CLOUD_ENABLED ? (
        <p className="pg-sub" data-testid="cloud-off">
          {t("account.cloud.off")}
        </p>
      ) : signedIn ? (
        <div className="cl-box">
          <strong>{t("account.cloud.signedInAs", { email: cloud.email ?? "" })}</strong>
          <span className={`cl-status is-${cloud.status.toLowerCase()}`} data-testid="cloud-status">
            {cloud.status === "SYNCING"
              ? t("account.cloud.syncing")
              : cloud.status === "ERROR"
                ? t("account.cloud.error", { error: cloud.error ?? "?" })
                : cloud.lastSyncedAt
                  ? t("account.cloud.synced", { when: when(cloud.lastSyncedAt) })
                  : t("account.cloud.never")}
          </span>
          <div className="cl-row">
            <button className="pg-btn" onClick={() => void syncNow()} disabled={cloud.status === "SYNCING"}>
              {t("account.cloud.syncNow")}
            </button>
            <button className="pg-btn cl-ghost" onClick={() => void signOut()}>
              {t("account.cloud.signOut")}
            </button>
          </div>
        </div>
      ) : (
        <form className="cl-box" onSubmit={(e) => void run("in", e)}>
          <p className="pg-sub">{t("account.cloud.lead")}</p>
          <label>
            <span>{t("account.cloud.email")}</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="cloud-email" />
          </label>
          <label>
            <span>{t("account.cloud.password")}</span>
            <input type="password" autoComplete="current-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="cloud-password" />
          </label>
          <div className="cl-row">
            <button className="pg-btn" type="submit" disabled={busy}>
              {t("account.cloud.signIn")}
            </button>
            <button className="pg-btn cl-ghost" type="button" disabled={busy || !email || password.length < 6} onClick={() => void run("up")}>
              {t("account.cloud.signUp")}
            </button>
          </div>
          {msg && <p className="cl-msg" role="status">{msg}</p>}
          <p className="pg-note">{t("account.cloud.note")}</p>
        </form>
      )}
    </section>
  );
}

const CLOUD_CSS = `
.cl-box { display: flex; flex-direction: column; gap: 10px; max-width: 460px; }
.cl-box label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--ash); }
.cl-box input { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--night-2); color: var(--bone); font-size: 15px; }
.cl-box input:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.cl-row { display: flex; gap: 10px; flex-wrap: wrap; }
.cl-ghost { background: transparent !important; color: var(--bone) !important; border: 1px solid var(--line) !important; }
.cl-status { font-size: 13.5px; color: var(--ash); }
.cl-status.is-synced { color: var(--ok); }
.cl-status.is-error { color: #ff8a7a; }
.cl-msg { font-size: 13.5px; color: var(--gold-hi); }
`;
