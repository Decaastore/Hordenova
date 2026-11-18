import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { PHASES } from "@/config/phaseConfig";
import { MAIN_BOSSES } from "@/config/bossConfig";
import { BossPortrait } from "./CreaturePortrait";

interface HuntBannerProps {
  hunt: { phaseIndex: number; startWave: number; endWave: number; powerWave: number; won: boolean };
  wave: number;
  onLeave: () => void;
}

/**
 * CAÇADA — the strip shown while a hunt is being played (which phase, how
 * far, how strong the creatures are, and a way out), and the victory card
 * once the phase's boss falls.
 */
export function HuntBanner({ hunt, wave, onLeave }: HuntBannerProps) {
  const { t } = useLanguage();
  const [confirm, setConfirm] = useState(false);
  const phase = PHASES[hunt.phaseIndex];
  const boss = phase ? MAIN_BOSSES[phase.mainBossId] : undefined;
  const phaseName = phase ? t(`phases.${phase.i18nKey}.name` as TranslationKey) : "";
  const total = hunt.endWave - hunt.startWave + 1;
  const done = Math.min(total, Math.max(0, wave - hunt.startWave));
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="hunt-strip" role="status" data-testid="hunt-banner">
        <span className="hunt-tag">{t("hunt.tag")}</span>
        <span className="hunt-name">{phaseName}</span>
        <span className="hunt-meta">{t("hunt.progress", { wave, from: hunt.startWave, to: hunt.endWave })}</span>
        <span className="hunt-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="hunt-meta is-power">{t("hunt.power", { wave: hunt.powerWave })}</span>
        {confirm ? (
          <span className="hunt-confirm">
            {t("hunt.leaveAsk")}
            <button className="hunt-btn is-danger" onClick={onLeave} data-testid="hunt-leave-confirm">
              {t("hunt.leaveYes")}
            </button>
            <button className="hunt-btn" onClick={() => setConfirm(false)}>
              {t("hunt.leaveNo")}
            </button>
          </span>
        ) : (
          <button className="hunt-btn" onClick={() => setConfirm(true)} data-testid="hunt-leave">
            {t("hunt.leave")}
          </button>
        )}
      </div>

      {hunt.won && (
        <div className="hunt-win-overlay hn-page" data-testid="hunt-won">
          <div className="hunt-win hn-pop" role="dialog" aria-label={t("hunt.wonTitle")}>
            {boss && <BossPortrait bossId={boss.id} size={96} />}
            <div className="hunt-win-title">{t("hunt.wonTitle")}</div>
            <div className="hunt-win-txt">{t("hunt.wonBody", { phase: phaseName })}</div>
            <button className="hunt-btn is-big" onClick={onLeave} data-testid="hunt-back">
              {t("hunt.back")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
.hunt-strip{flex:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:5px 14px;background:linear-gradient(90deg,#3a0c08,#5a1a0c 40%,#2a0a06);border-bottom:1px solid #a0381c;color:#ffe2d0;font-size:12px;z-index:5}
.hunt-tag{padding:2px 8px;border-radius:5px;background:#c8401e;color:#fff;font-weight:800;font-size:10.5px;letter-spacing:.06em}
.hunt-name{font-weight:800;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#ffd0a0}
.hunt-meta{color:#e8b8a0}
.hunt-meta.is-power{color:#ff9a6a;font-weight:700}
.hunt-bar{position:relative;width:120px;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.hunt-bar>span{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#ff7a3a,#ffd27a);border-radius:3px;transition:width 400ms ease}
.hunt-btn{margin-left:auto;padding:4px 10px;border-radius:6px;border:1px solid #c86a4a;background:rgba(0,0,0,.3);color:#ffe2d0;font-weight:700;font-size:11px;cursor:pointer}
.hunt-btn:hover{background:rgba(255,120,60,.18)}
.hunt-btn.is-danger{margin-left:0;border-color:#ff5a3a;background:#a02a14;color:#fff}
.hunt-btn.is-big{margin:6px 0 0;padding:9px 20px;font-size:13px;background:linear-gradient(180deg,#c8401e,#7a1e0c);border-color:#ff7a4a;color:#fff}
.hunt-confirm{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-weight:700}
.hunt-confirm .hunt-btn{margin-left:0}
.hunt-win-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(10,4,2,.72)}
.hunt-win{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:360px;padding:22px 26px;border-radius:14px;border:1px solid #c86a4a;background:linear-gradient(160deg,#4a1a0e,#1e0a06);box-shadow:0 20px 50px rgba(0,0,0,.6),0 0 40px rgba(255,90,40,.25);text-align:center;color:#ffe2d0}
.hunt-win-title{font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffd27a}
.hunt-win-txt{font-size:12.5px;line-height:1.5;color:#f0c8b0}
`;
