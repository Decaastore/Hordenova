import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave, updateSave, type SaveData } from "@/engine/SaveSystem";
import { grantBundle } from "@/engine/RewardBundleGrant";
import type { RewardBundle } from "@/config/rewardBundle";
import { canClaimLogin, claimLogin, LOGIN_REWARDS } from "@/config/dailyLogin";
import { BEGINNER_FINAL_REWARD, BEGINNER_MISSIONS, beginnerVisible, claimBeginner, claimBeginnerFinal } from "@/config/beginnerMissions";
import { claimMilestone, COLLECTIONS, milestoneKey, type CollectionId } from "@/config/collections";
import { getCastleSkinDefinition } from "@/config/castleSkins";
import { MaterialIcon, type MaterialKind } from "./MaterialIcon";
import { CastleSkinPreview } from "./CastleSkinPreview";

/**
 * RECOMPENSAS — the 7-day login (section + Home pop-up), First Steps (the
 * beginner checklist) and Collections (albums with milestone prizes). They
 * edit the save directly, like the Store and the Duel pages do.
 */

export function BundleLabel({ b }: { b: RewardBundle }) {
  const { t } = useLanguage();
  const items: [MaterialKind, number, string][] = [];
  if (b.freeGems) items.push(["GEMS_FREE", b.freeGems, t("rewards.bundle.freeGems", { n: b.freeGems })]);
  if (b.gold) items.push(["GOLD", b.gold, t("rewards.bundle.gold", { n: b.gold })]);
  if (b.shards) items.push(["SHARDS", b.shards, t("rewards.bundle.shards", { n: b.shards })]);
  if (b.splinters) items.push(["SPLINTERS", b.splinters, t("rewards.bundle.splinters", { n: b.splinters })]);
  if (b.rare) items.push(["RARE", b.rare, t("rewards.bundle.rare", { n: b.rare })]);
  if (b.epic) items.push(["EPIC", b.epic, t("rewards.bundle.epic", { n: b.epic })]);
  const castle = b.castleSkinId ? getCastleSkinDefinition(b.castleSkinId) : null;
  return (
    <span className="rw-bundle">
      {items.map(([k, n, label]) => (
        <span key={k} className="rw-chip" title={label}>
          <MaterialIcon kind={k} size={15} title={label} /> {n}
        </span>
      ))}
      {castle && <span className="rw-chip is-castle">🏰 {t("rewards.bundle.castle", { name: t(`castleSkins.${castle.i18nKey}.name` as TranslationKey) })}</span>}
    </span>
  );
}

function useSave(): [SaveData, (patch: Partial<SaveData>) => void] {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  return [save, (patch) => setSave(updateSave(patch))];
}

// ── 7-day login ─────────────────────────────────────────────────────────
function LoginStrip({ save, onClaim }: { save: SaveData; onClaim?: () => void }) {
  const { t } = useLanguage();
  const can = canClaimLogin(save.dailyLogin, Date.now());
  return (
    <div className="rw-login" data-testid="login-strip">
      {LOGIN_REWARDS.map((b, i) => {
        const today = i === save.dailyLogin.step && can;
        const done = can ? i < save.dailyLogin.step : i < save.dailyLogin.step || (save.dailyLogin.step === 0 && save.dailyLogin.lastDay >= 0);
        return (
          <div key={i} className={`rw-day${today ? " is-today" : ""}${done ? " is-done" : ""}${i === 6 ? " is-big" : ""}`}>
            <strong>{t("rewards.loginDay", { n: i + 1 })}</strong>
            <BundleLabel b={b} />
            {done && <span className="rw-check">✓</span>}
          </div>
        );
      })}
      {onClaim && (
        <div className="rw-login-action">
          {can ? (
            <button className="rw-btn" onClick={onClaim} data-testid="login-claim">
              {t("rewards.loginClaim")}
            </button>
          ) : (
            <span className="rw-muted">{t("rewards.loginClaimed", { n: save.dailyLogin.step + 1 })}</span>
          )}
        </div>
      )}
    </div>
  );
}

function doClaimLogin(): SaveData | null {
  const cur = loadSave();
  const r = claimLogin(cur.dailyLogin, Date.now());
  if (!r) return null;
  return updateSave({ ...grantBundle(cur, r.reward, `daily_login_day_${r.day}`), dailyLogin: r.state });
}

export function DailyLoginSection() {
  const { t } = useLanguage();
  const [save, setSave] = useState<SaveData>(() => loadSave());
  return (
    <section className="rw-block" data-testid="login-section">
      <style>{REWARDS_CSS}</style>
      <h2 className="pg-h2">{t("rewards.loginTitle")}</h2>
      <p className="pg-sub">{t("rewards.loginLead")}</p>
      <LoginStrip
        save={save}
        onClaim={() => {
          const next = doClaimLogin();
          if (next) setSave(next);
        }}
      />
    </section>
  );
}

/** Home: pops up once a day while today's login reward is waiting. `onClosed` lets other pop-ups wait their turn. */
export function DailyLoginModal({ onClosed }: { onClosed?: () => void }) {
  const { t } = useLanguage();
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [open, setOpen] = useState(() => canClaimLogin(loadSave().dailyLogin, Date.now()));
  const [got, setGot] = useState(false);
  const close = () => {
    setOpen(false);
    onClosed?.();
  };
  // Escape closes it (the reward stays waiting on the Account page)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!open) return null;
  const day = got ? (save.dailyLogin.step === 0 ? 7 : save.dailyLogin.step) : save.dailyLogin.step + 1;
  return (
    <div className="rw-overlay" role="dialog" aria-modal="true" data-testid="login-modal">
      <style>{REWARDS_CSS}</style>
      <div className="rw-modal">
        <h2>{t("rewards.loginModalTitle", { n: day })}</h2>
        <p>{t(save.dailyLogin.lastDay < 0 && !got ? "rewards.loginModalLeadFirst" : "rewards.loginModalLead")}</p>
        <LoginStrip save={save} />
        <div className="rw-modal-actions">
          {!got ? (
            <button
              className="rw-btn"
              data-testid="login-modal-claim"
              onClick={() => {
                const next = doClaimLogin();
                if (next) setSave(next);
                setGot(true);
              }}
            >
              {t("rewards.loginClaim")}
            </button>
          ) : (
            <span className="rw-got">{t("rewards.loginGot")}</span>
          )}
          <button className="rw-ghost" onClick={close} data-testid="login-modal-close">
            {t("rewards.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── First steps ─────────────────────────────────────────────────────────
export function BeginnerSection() {
  const { t } = useLanguage();
  const [save, patch] = useSave();
  if (!beginnerVisible(save)) return null;
  const done = BEGINNER_MISSIONS.filter((m) => save.beginner.claimed.includes(m.id)).length;
  const claim = (id: (typeof BEGINNER_MISSIONS)[number]["id"]) => {
    const cur = loadSave();
    const r = claimBeginner(cur, id);
    if (r) patch({ ...grantBundle(cur, r.reward, `beginner_${id}`), beginner: r.state });
  };
  const claimFinal = () => {
    const cur = loadSave();
    const r = claimBeginnerFinal(cur);
    if (r) patch({ ...grantBundle(cur, r.reward, "beginner_final"), beginner: r.state, equippedCastleSkinId: "RECRUIT_KEEP" });
  };
  return (
    <section className="rw-block" data-testid="beginner-section">
      <style>{REWARDS_CSS}</style>
      <div className="rw-head">
        <h2 className="pg-h2">{t("rewards.beginnerTitle")}</h2>
        <span className="rw-muted">{t("rewards.beginnerDone", { n: done, max: BEGINNER_MISSIONS.length })}</span>
      </div>
      <p className="pg-sub">{t("rewards.beginnerLead")}</p>
      <div className="rw-bar">
        <div style={{ width: `${(done / BEGINNER_MISSIONS.length) * 100}%` }} />
      </div>
      <ol className="rw-missions">
        {BEGINNER_MISSIONS.map((m) => {
          const claimed = save.beginner.claimed.includes(m.id);
          const ready = !claimed && m.done(save);
          return (
            <li key={m.id} className={claimed ? "is-claimed" : ready ? "is-ready" : ""}>
              <span className="rw-mark">{claimed ? "✓" : ready ? "!" : ""}</span>
              <span className="rw-mtext">{t(`rewards.mission.${m.id}` as TranslationKey)}</span>
              <BundleLabel b={m.reward} />
              {ready && (
                <button className="rw-btn is-small" onClick={() => claim(m.id)} data-testid={`beginner-claim-${m.id}`}>
                  {t("rewards.beginnerClaim")}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="rw-final">
        <CastleSkinPreview skinId="RECRUIT_KEEP" size={120} />
        <div>
          <BundleLabel b={BEGINNER_FINAL_REWARD} />
          <button className="rw-btn" disabled={done < BEGINNER_MISSIONS.length} onClick={claimFinal} data-testid="beginner-final">
            {t("rewards.beginnerFinal")}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Collections ─────────────────────────────────────────────────────────
export function CollectionsSection() {
  const { t } = useLanguage();
  const [save, patch] = useSave();
  const claim = (id: CollectionId, count: number) => {
    const cur = loadSave();
    const r = claimMilestone(cur, id, count);
    if (r) patch({ ...grantBundle(cur, r.reward, `collection_${id}_${count}`), collections: r.state });
  };
  return (
    <section className="rw-block" data-testid="collections-section">
      <style>{REWARDS_CSS}</style>
      <h2 className="pg-h2">{t("rewards.collectionsTitle")}</h2>
      <p className="pg-sub">{t("rewards.collectionsLead")}</p>
      <div className="rw-albums">
        {COLLECTIONS.map((c) => {
          const entries = c.entries(save);
          const owned = entries.filter((e) => e.owned).length;
          return (
            <article key={c.id} className="rw-album" data-testid={`album-${c.id}`}>
              <div className="rw-head">
                <h3>{t(`rewards.collection.${c.id}` as TranslationKey)}</h3>
                <span className="rw-muted">{t("rewards.collectionAt", { n: owned, max: entries.length })}</span>
              </div>
              <div className="rw-bar">
                <div style={{ width: `${(owned / entries.length) * 100}%` }} />
              </div>
              <div className="rw-entries">
                {entries.map((e) => (
                  <span key={e.id} className={`rw-entry${e.owned ? " is-owned" : ""}`} title={e.owned ? t(e.labelKey as TranslationKey) : t("rewards.unknown")}>
                    {e.owned ? t(e.labelKey as TranslationKey) : t("rewards.unknown")}
                  </span>
                ))}
              </div>
              <ul className="rw-miles">
                {c.milestones.map((m) => {
                  const paid = save.collections.claimed.includes(milestoneKey(c.id, m.count));
                  const ready = !paid && owned >= m.count;
                  return (
                    <li key={m.count} className={paid ? "is-claimed" : ready ? "is-ready" : ""}>
                      <strong>{m.count}</strong>
                      <BundleLabel b={m.reward} />
                      {paid ? (
                        <span className="rw-check">✓</span>
                      ) : ready ? (
                        <button className="rw-btn is-small" onClick={() => claim(c.id, m.count)} data-testid={`album-claim-${c.id}-${m.count}`}>
                          {t("rewards.collectionClaim")}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const REWARDS_CSS = `
.rw-block { padding: 30px 0 8px; border-bottom: 1px solid var(--line, rgba(255,255,255,0.1)); }
.rw-block .pg-sub { margin: 6px 0 0; max-width: 78ch; }
.rw-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; }
.rw-head h3 { margin: 0; font-family: var(--display, Georgia, serif); font-size: 17px; color: var(--bone, #efe4cf); }
.rw-muted { color: var(--ash, #a99d88); font-size: 13px; }
.rw-bundle { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.rw-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px 2px 4px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 12.5px; font-weight: 700; color: var(--bone, #efe4cf); white-space: nowrap; }
.rw-chip.is-castle { color: #ffcf8a; padding-left: 8px; }
.rw-login { display: grid; grid-template-columns: repeat(7, minmax(92px, 1fr)); gap: 8px; margin-top: 14px; overflow-x: auto; padding-bottom: 4px; }
.rw-day { position: relative; display: grid; gap: 6px; align-content: start; justify-items: center; text-align: center; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--line, rgba(255,255,255,0.1)); background: rgba(24,18,12,0.55); min-height: 86px; }
.rw-day strong { color: var(--bone, #efe4cf); font-size: 13px; }
.rw-day.is-today { border-color: #ffd36b; box-shadow: 0 0 18px rgba(255,211,107,0.35); }
.rw-day.is-done { opacity: 0.55; }
.rw-day.is-big { background: linear-gradient(180deg, rgba(255,211,107,0.14), rgba(24,18,12,0.55)); }
.rw-check { position: absolute; right: 6px; top: 4px; color: #9be37a; font-weight: 900; }
.rw-login-action { grid-column: 1 / -1; display: flex; justify-content: flex-start; padding-top: 4px; }
.rw-btn { padding: 10px 18px; border-radius: 10px; border: 1px solid rgba(255,211,107,0.8); background: linear-gradient(180deg, #ffd36b, #c98b2a); color: #2a1606 !important; font-weight: 800; cursor: pointer; }
.rw-btn.is-small { padding: 5px 12px; font-size: 13px; }
.rw-btn:disabled { opacity: 0.45; cursor: default; }
.rw-btn:focus-visible, .rw-ghost:focus-visible { outline: 2px solid #ffd36b; outline-offset: 2px; }
.rw-ghost { padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--bone, #efe4cf); cursor: pointer; }
.rw-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); margin: 12px 0; overflow: hidden; }
.rw-bar > div { height: 100%; background: linear-gradient(90deg, #c98b2a, #ffd36b); }
.rw-missions { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.rw-missions li { display: grid; grid-template-columns: 26px 1fr auto auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(24,18,12,0.5); border: 1px solid var(--line, rgba(255,255,255,0.08)); }
.rw-missions li.is-ready { border-color: rgba(255,211,107,0.7); }
.rw-missions li.is-claimed { opacity: 0.55; }
.rw-mark { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; background: rgba(255,255,255,0.08); color: #ffd36b; }
.rw-missions li.is-claimed .rw-mark { color: #9be37a; }
.rw-mtext { color: var(--bone, #efe4cf); font-size: 14px; }
.rw-final { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 14px; }
.rw-final > div { display: grid; gap: 8px; justify-items: start; }
.rw-albums { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 14px; }
.rw-album { padding: 14px; border-radius: 14px; border: 1px solid var(--line, rgba(255,255,255,0.1)); background: rgba(24,18,12,0.55); }
.rw-entries { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
.rw-entry { font-size: 11.5px; padding: 2px 7px; border-radius: 6px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.3); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rw-entry.is-owned { color: var(--bone, #efe4cf); background: rgba(255,211,107,0.12); }
.rw-miles { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.rw-miles li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rw-miles strong { min-width: 28px; color: #ffd36b; }
.rw-miles li.is-claimed { opacity: 0.55; }
.rw-overlay { position: fixed; inset: 0; z-index: 1001; display: grid; place-items: center; padding: 16px; background: rgba(4,2,8,0.72); backdrop-filter: blur(3px); }
.rw-modal { width: min(760px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border-radius: 18px; background: #140e08; border: 1px solid rgba(255,211,107,0.6); box-shadow: 0 0 70px rgba(255,190,90,0.3); color: var(--bone, #efe4cf); }
.rw-modal h2 { margin: 0; font-family: var(--display, Georgia, serif); color: #ffd36b; font-size: clamp(24px, 4vw, 32px); }
.rw-modal p { margin: 6px 0 0; color: #d8ccb8; }
.rw-modal-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 16px; }
.rw-got { color: #9be37a; font-weight: 800; }
@media (max-width: 640px) { .rw-missions li { grid-template-columns: 26px 1fr; } .rw-missions li .rw-bundle, .rw-missions li .rw-btn { grid-column: 2; justify-self: start; } }
`;
