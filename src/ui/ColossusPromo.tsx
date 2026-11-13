import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import {
  attemptsLeft,
  claimWorldPrize,
  colossusWeek,
  COLOSSUS_ATTEMPTS_PER_DAY,
  COLOSSUS_WORLD_GEMS,
  weekEndsAt,
  worldState,
} from "@/config/colossus";
import { COLOSSUS_VIEW_H, COLOSSUS_VIEW_W, drawColossusShowcase } from "@/rendering/colossusRenderer";
import { formatDurationShort } from "@/utils/formatDuration";

/**
 * CHEFE GLOBAL — how the game shouts about the Serpent outside its own page:
 *   ColossusShowcase — the live Serpent circling its island (a canvas)
 *   ColossusHeroCard — the glowing "Global Boss is live" card on Home
 *   ColossusAlert    — a one-time pop-up per moment of the week: a new
 *                      Serpent arrived, its last 24 hours, the community won
 *                      (with Gems to claim). Each shows once per week.
 */

export function ColossusShowcase({ className, testId }: { className?: string; testId?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx && cv.clientWidth > 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = cv.clientWidth;
        if (cv.width !== Math.round(w * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(((w * COLOSSUS_VIEW_H) / COLOSSUS_VIEW_W) * dpr);
        }
        ctx.setTransform(cv.width / COLOSSUS_VIEW_W, 0, 0, cv.height / COLOSSUS_VIEW_H, 0, 0);
        drawColossusShowcase(ctx, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className={className} data-testid={testId} style={{ display: "block", width: "100%", aspectRatio: `${COLOSSUS_VIEW_W} / ${COLOSSUS_VIEW_H}` }} />;
}

function useColossusStatus() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const save = loadSave();
  const world = worldState(save.colossus, now);
  return {
    now,
    world,
    attempts: attemptsLeft(save.colossus, now),
    timeLeft: Math.max(0, weekEndsAt(now) - now),
    prize: claimWorldPrize(save.colossus, now),
    week: colossusWeek(now),
  };
}

/** Home: the "Global Boss is live" card over the hero battle. */
export function ColossusHeroCard({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const { t } = useLanguage();
  const st = useColossusStatus();
  const pct = (st.world.fraction * 100).toFixed(1);
  return (
    <div className={`cp-card${compact ? " is-compact" : ""}`} data-testid={compact ? "colossus-home-card-mobile" : "colossus-home-card"}>
      <style>{PROMO_CSS}</style>
      <div className="cp-live">
        <span className="cp-dot" aria-hidden="true" />
        {st.world.defeated ? t("colossus.homeDefeated") : t("colossus.homeLive")}
      </div>
      <button className="cp-art" onClick={onOpen} aria-label={t("colossus.open")}>
        <ColossusShowcase />
      </button>
      <div className="cp-body">
        <strong>{t("colossus.title")}</strong>
        <div className="cp-hp" aria-label={`${pct}%`}>
          <div style={{ width: `${pct}%` }} />
          <span>{st.world.defeated ? t("colossus.homeFallen") : t("colossus.homeLife", { pct })}</span>
        </div>
        <p className="cp-meta">
          {t("colossus.homeLeaves", { time: formatDurationShort(st.timeLeft) })} · {t("colossus.homeAttempts", { n: st.attempts, max: COLOSSUS_ATTEMPTS_PER_DAY })}
        </p>
        <button className="cp-btn" onClick={onOpen} data-testid="colossus-home-open">
          {st.prize ? t("colossus.homeClaim", { n: st.prize.gems }) : t("colossus.open")}
        </button>
      </div>
    </div>
  );
}

const SEEN_KEY = "hordenova.colossusAlerts.v1";

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function markSeen(key: string): void {
  try {
    const list = readSeen().filter((k) => k !== key).slice(-20);
    list.push(key);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked — the alert simply may show again */
  }
}

type AlertKind = "arrive" | "last" | "won";

/** Which alert (if any) is due right now and not seen yet this week. */
export function dueColossusAlert(state: { week: number; timeLeft: number; defeated: boolean; prize: boolean; attempts: number }, seen: readonly string[]): AlertKind | null {
  const k = (kind: AlertKind) => `w${state.week}:${kind}`;
  if (state.prize && !seen.includes(k("won"))) return "won";
  if (state.defeated) return null;
  if (state.timeLeft < 24 * 3_600_000 && state.attempts > 0 && !seen.includes(k("last"))) return "last";
  if (!seen.includes(k("arrive")) && !seen.includes(k("last"))) return "arrive";
  return null;
}

/** The pop-up announcing the Serpent (once per moment per week). */
export function ColossusAlert({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  const st = useColossusStatus();
  const [kind, setKind] = useState<AlertKind | null>(null);
  useEffect(() => {
    const due = dueColossusAlert({ week: st.week, timeLeft: st.timeLeft, defeated: st.world.defeated, prize: !!st.prize, attempts: st.attempts }, readSeen());
    // a short beat after the page opens, so it lands as an event
    if (!due) return;
    const id = window.setTimeout(() => setKind(due), 900);
    return () => window.clearTimeout(id);
  }, [st.week]);
  // Escape closes it, like "later"
  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      markSeen(`w${st.week}:${kind}`);
      setKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, st.week]);
  if (!kind) return null;
  const close = () => {
    markSeen(`w${st.week}:${kind}`);
    setKind(null);
  };
  const go = () => {
    close();
    onOpen();
  };
  const pct = (st.world.fraction * 100).toFixed(1);
  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="colossus-alert">
      <style>{PROMO_CSS}</style>
      <div className={`cp-modal is-${kind}`}>
        <div className="cp-modal-art">
          <ColossusShowcase />
          <span className="cp-banner">{t(`colossus.alert.${kind}.tag` as TranslationKey)}</span>
        </div>
        <div className="cp-modal-body">
          <h2>{t(`colossus.alert.${kind}.title` as TranslationKey)}</h2>
          <p>{t(`colossus.alert.${kind}.lead` as TranslationKey, { time: formatDurationShort(st.timeLeft), n: COLOSSUS_WORLD_GEMS, attempts: st.attempts })}</p>
          {kind !== "won" && (
            <div className="cp-hp">
              <div style={{ width: `${pct}%` }} />
              <span>{t("colossus.homeLife", { pct })}</span>
            </div>
          )}
          <div className="cp-actions">
            <button className="cp-btn" onClick={go} data-testid="colossus-alert-go">
              {kind === "won" ? t("colossus.homeClaim", { n: COLOSSUS_WORLD_GEMS }) : t("colossus.open")}
            </button>
            <button className="cp-later" onClick={close} data-testid="colossus-alert-later">
              {t("colossus.alertLater")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PROMO_CSS = `
.cp-card { width: 300px; border-radius: 16px; overflow: hidden; background: rgba(14,8,26,0.82); border: 1px solid rgba(199,155,255,0.55); box-shadow: 0 0 0 1px rgba(255,211,107,0.12), 0 18px 50px rgba(80,30,160,0.55), 0 0 40px rgba(176,106,255,0.35); backdrop-filter: blur(8px); animation: cp-glow 2.6s ease-in-out infinite alternate; color: #efe4cf; }
@keyframes cp-glow { to { box-shadow: 0 0 0 1px rgba(255,211,107,0.3), 0 18px 50px rgba(80,30,160,0.65), 0 0 64px rgba(176,106,255,0.6); } }
.cp-live { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 12.5px; font-weight: 800; color: #ffd36b; background: linear-gradient(90deg, rgba(120,40,200,0.65), rgba(14,8,26,0.2)); }
.cp-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff5a6a; box-shadow: 0 0 0 0 rgba(255,90,106,0.7); animation: cp-pulse 1.4s infinite; }
@keyframes cp-pulse { 70% { box-shadow: 0 0 0 9px rgba(255,90,106,0); } 100% { box-shadow: 0 0 0 0 rgba(255,90,106,0); } }
.cp-art { display: block; width: 100%; padding: 0; border: 0; background: #05030a; cursor: pointer; }
.cp-body { display: grid; gap: 8px; padding: 12px 14px 14px; }
.cp-body strong { font-family: var(--display, Georgia, serif); font-size: 20px; color: #f3e1b5; line-height: 1.1; }
.cp-hp { position: relative; height: 18px; border-radius: 6px; background: rgba(255,255,255,0.08); overflow: hidden; border: 1px solid rgba(199,155,255,0.35); }
.cp-hp > div { height: 100%; background: linear-gradient(90deg, #5b1f8f, #b06aff 60%, #ffd36b); box-shadow: 0 0 14px rgba(176,106,255,0.6); }
.cp-hp > span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px #000; }
.cp-meta { margin: 0; font-size: 12.5px; color: #c9bcdc; }
.cp-btn { padding: 11px 16px; border-radius: 10px; border: 1px solid rgba(255,211,107,0.8); background: linear-gradient(180deg, #ffd36b, #c98b2a); color: #2a1606 !important; font-weight: 800; font-size: 14.5px; cursor: pointer; }
.cp-btn:hover { filter: brightness(1.1); }
.cp-btn:focus-visible, .cp-later:focus-visible, .cp-art:focus-visible { outline: 2px solid #ffd36b; outline-offset: 2px; }
.cp-card.is-compact { width: auto; }
.cp-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(4,2,8,0.72); backdrop-filter: blur(3px); animation: cp-fade 0.3s ease-out; }
@keyframes cp-fade { from { opacity: 0; } }
.cp-modal { width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 18px; background: #0e0818; border: 1px solid rgba(199,155,255,0.6); box-shadow: 0 0 80px rgba(150,80,255,0.45); color: #efe4cf; animation: cp-rise 0.45s cubic-bezier(.2,.9,.3,1.2); }
@keyframes cp-rise { from { transform: translateY(24px) scale(0.96); opacity: 0; } }
.cp-modal.is-last { border-color: rgba(255,110,80,0.7); box-shadow: 0 0 80px rgba(255,80,60,0.4); }
.cp-modal.is-won { border-color: rgba(255,211,107,0.8); box-shadow: 0 0 80px rgba(255,200,90,0.45); }
.cp-modal-art { position: relative; }
.cp-banner { position: absolute; left: 14px; top: 14px; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 800; color: #2a1606; background: #ffd36b; box-shadow: 0 4px 14px rgba(0,0,0,0.5); }
.cp-modal.is-last .cp-banner { background: #ff7a5a; color: #fff; }
.cp-modal-body { display: grid; gap: 12px; padding: 18px 22px 22px; }
.cp-modal-body h2 { margin: 0; font-family: var(--display, Georgia, serif); font-size: clamp(24px, 4vw, 32px); color: #ffd36b; line-height: 1.1; }
.cp-modal-body p { margin: 0; color: #d9cdea; line-height: 1.5; }
.cp-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.cp-later { padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(199,155,255,0.4); background: transparent; color: #d9cdea; font-weight: 600; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .cp-card, .cp-dot, .cp-overlay, .cp-modal { animation: none; } }
`;
