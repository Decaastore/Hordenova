import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import { loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus } from "@/engine/AscensionManager";
import { phaseNumberFromWave, waveInPhase } from "@/config/wavePhase";
import { formatDurationShort } from "@/utils/formatDuration";
import { PATCH_NOTES } from "@/config/patchNotes";
import { PHASES } from "@/config/phaseConfig";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { TowerPortrait } from "@/ui/TowerPortrait";
import { SCENE_DURATION_MS, SHOWCASE_PHASE_IDS, showcasePhase } from "@/rendering/homeDiorama";
import { buildProfileFromSave, countOwnedSkins, TOTAL_TOWER_SKINS } from "@/profile/playerProfile";
import { HomeDiorama } from "./HomeDiorama";
import { audioManager } from "@/audio/AudioManager";

/** How long the Play transition (camera push into the castle + fade) runs before `onStart` fires. */
export const TRANSITION_DURATION_MS = 1500;

interface MainMenuProps {
  onStart: () => void;
  onNavigate: (view: NavView) => void;
}

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/**
 * HOME — the game's front page. The hero IS the game: a live battle on the
 * real battlefield (rendering/homeDiorama.ts) rotating through the phases,
 * with the pitch and the Play button laid over its darker left side. Below
 * the fold: the four towers (drawn by the real tower renderer), the sixteen
 * phases, the latest Novidades entries (straight from PATCH_NOTES, so a new
 * patch note shows up here with no extra work), the Season/Ranking/Wiki
 * entry points and a footer. Clicking Play pushes the camera into the
 * castle gate before `onStart` fires.
 */
export function MainMenu({ onStart, onNavigate }: MainMenuProps) {
  const save = useMemo(() => loadSave(), []);
  const { t, language } = useLanguage();
  const status = useMemo(() => getAscensionStatus(), []);
  const skinsOwned = useMemo(() => countOwnedSkins(buildProfileFromSave(save, "")), [save]);
  const [entering, setEntering] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const towersRef = useRef<HTMLElement>(null);

  // Scene rotation; picking a scene by hand restarts the timer.
  useEffect(() => {
    if (entering) return;
    const id = window.setTimeout(() => setSceneIndex((i) => (i + 1) % SHOWCASE_PHASE_IDS.length), SCENE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [sceneIndex, entering]);

  const handlePlay = () => {
    if (entering) return;
    // Unlock audio synchronously inside the real click (browsers require a
    // user gesture) — clicking Play alone must be enough to start the music.
    audioManager.unlock();
    audioManager.playAmbientMusic();
    setEntering(true);
    window.setTimeout(onStart, TRANSITION_DURATION_MS);
  };

  const phase = showcasePhase(sceneIndex);
  const phaseNumber = PHASES.indexOf(phase) + 1;
  const themeName = t(`ascension.seasonThemes.${status.themeNameKey}` as TranslationKey);
  const seasonScore = t("hud.phaseWaveValue", {
    phase: phaseNumberFromWave(Math.max(1, status.seasonBestWave)),
    onda: waveInPhase(Math.max(1, status.seasonBestWave)),
  });
  const news = PATCH_NOTES.slice(0, 3);

  return (
    <div className="hn-home">
      <style>{HOME_CSS}</style>

      <section className={`hn-hero${entering ? " is-entering" : ""}`}>
        <HomeDiorama sceneIndex={sceneIndex} entering={entering} />
        <div className="hn-hero-shade" aria-hidden="true" />
        <div className="hn-hero-flash" aria-hidden="true" />

        <div className="hn-hero-nav">
          <TopNav active="HOME" onNavigate={onNavigate} onPlay={handlePlay} />
        </div>

        <div className="hn-hero-copy">
          <button className="hn-season-pill" onClick={() => onNavigate("SEASON")}>
            <span className="hn-season-dot" aria-hidden="true" />
            <span className="hn-season-live">{t("menu.seasonLive", { number: status.seasonNumber })}</span>
            <span className="hn-season-meta">{t("menu.seasonEnds", { theme: themeName, time: formatDurationShort(status.timeRemainingMs) })}</span>
          </button>

          <h1 className="hn-wordmark">HORDENOVA</h1>
          <p className="hn-tagline">{t("menu.subtitle")}</p>
          <p className="hn-pitch">{t("menu.description")}</p>

          <div className="hn-cta-row">
            <button className="hn-play" onClick={handlePlay} disabled={entering}>
              {t("menu.play")}
            </button>
            <button className="hn-ghost" onClick={() => towersRef.current?.scrollIntoView({ behavior: "smooth" })}>
              {t("menu.seeTowers")}
            </button>
          </div>

          <dl className="hn-stats">
            <div>
              <dt>{t("menu.bestWave")}</dt>
              <dd>{String(save.bestWave).padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>{t("menu.statSeasonBest")}</dt>
              <dd>{String(status.seasonBestWave).padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>{t("menu.statPrestige")}</dt>
              <dd>{save.prestigeLevel}</dd>
            </div>
            <div>
              <dt>{t("menu.statSkins")}</dt>
              <dd>
                {skinsOwned}
                <small>/{TOTAL_TOWER_SKINS}</small>
              </dd>
            </div>
          </dl>
        </div>

        <div className="hn-scene">
          <div className="hn-scene-phase">{t("menu.scenePhase", { number: phaseNumber })}</div>
          <div className="hn-scene-name">{t(`phases.${phase.i18nKey}.name` as TranslationKey)}</div>
          <div className="hn-scene-tag">{t(`phases.${phase.i18nKey}.tagline` as TranslationKey)}</div>
          <div className="hn-scene-dots">
            {SHOWCASE_PHASE_IDS.map((id, i) => {
              const p = showcasePhase(i);
              const active = i === sceneIndex;
              return (
                <button
                  key={id}
                  className={`hn-scene-dot${active ? " is-active" : ""}`}
                  onClick={() => setSceneIndex(i)}
                  aria-label={t("menu.sceneShow", { name: t(`phases.${p.i18nKey}.name` as TranslationKey) })}
                  aria-current={active}
                >
                  <span key={active ? `on-${sceneIndex}` : "off"} style={active ? { animationDuration: `${SCENE_DURATION_MS}ms` } : undefined} />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <main className="hn-body">
        <section className="hn-section" ref={towersRef}>
          <header className="hn-section-head">
            <h2>{t("menu.towersTitle")}</h2>
            <p>{t("menu.towersBody")}</p>
          </header>
          <div className="hn-towers">
            {TOWER_TYPES.map((type) => (
              <TowerShowcase key={type} type={type} />
            ))}
          </div>
        </section>

        <section className="hn-section">
          <header className="hn-section-head">
            <h2>{t("menu.worldsTitle")}</h2>
            <p>{t("menu.worldsBody")}</p>
          </header>
          <ol className="hn-worlds">
            {PHASES.map((p, i) => (
              <li key={p.id} className="hn-world">
                <div className="hn-world-img" style={{ backgroundImage: `url(${assetBase}sprites/ground/thumbs/${p.biomeId.toLowerCase()}.webp)` }} />
                <div className="hn-world-text">
                  <span className="hn-world-num">{i + 1}</span>
                  <span className="hn-world-name">{t(`phases.${p.i18nKey}.name` as TranslationKey)}</span>
                  <span className="hn-world-waves">{t("menu.worldWaves", { from: p.startWave, to: p.endWave })}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="hn-section hn-split">
          <div className="hn-news">
            <header className="hn-section-head is-compact">
              <h2>{t("menu.newsTitle")}</h2>
            </header>
            <ul>
              {news.map((entry) => (
                <li key={entry.id}>
                  <button className="hn-news-item" onClick={() => onNavigate("NOVIDADES")}>
                    {entry.dateIso && <time dateTime={entry.dateIso}>{formatDate(entry.dateIso, language)}</time>}
                    <span className="hn-news-title">{entry.title[language]}</span>
                    <span className="hn-news-desc">{entry.description[language]}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="hn-link" onClick={() => onNavigate("NOVIDADES")}>
              {t("menu.newsAll")}
            </button>
          </div>

          <div className="hn-gates">
            <div className="hn-gate is-season">
              <h3>{t("menu.seasonLive", { number: status.seasonNumber })}</h3>
              <p>{t("menu.seasonCardBody", { theme: themeName })}</p>
              {status.seasonBestWave > 0 && <p>{t("menu.seasonCardBest", { score: seasonScore })}</p>}
              <p className="hn-gate-time">{t("season.endsIn", { time: formatDurationShort(status.timeRemainingMs) })}</p>
              <button className="hn-ghost" onClick={() => onNavigate("SEASON")}>
                {t("menu.seasonCardCta")}
              </button>
            </div>
            <div className="hn-gate">
              <h3>{t("nav.ranking")}</h3>
              <p>{t("menu.rankingCardBody")}</p>
              <button className="hn-link" onClick={() => onNavigate("RANKING")}>
                {t("menu.rankingCardCta")}
              </button>
            </div>
            <div className="hn-gate">
              <h3>{t("nav.wiki")}</h3>
              <p>{t("wiki.subtitle")}</p>
              <button className="hn-link" onClick={() => onNavigate("WIKI")}>
                {t("menu.wikiCardCta")}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="hn-footer">
        <div>
          <div className="hn-footer-mark">HORDENOVA</div>
          <p>{t("menu.footerTagline")}</p>
        </div>
        <nav aria-label="HORDENOVA">
          {(["SEASON", "RANKING", "MARKETPLACE", "WIKI", "NOVIDADES"] as const).map((view) => (
            <button key={view} onClick={() => onNavigate(view)}>
              {t(`nav.${view === "NOVIDADES" ? "novidades" : view.toLowerCase()}` as TranslationKey)}
            </button>
          ))}
        </nav>
        <p className="hn-footer-rights">{t("menu.footerRights", { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}

function formatDate(iso: string, language: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === "ptBR" ? "pt-BR" : "en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Visual-stage levels (one per 10 levels) the preview climbs through on hover. */
const STAGE_LEVELS = [1, 11, 21, 31, 41, 51, 60];
const PREVIEW_W = 260;
const PREVIEW_H = 290;
const PREVIEW_ZOOM = 2.5;

/** One tower column: the real tower art (climbing through its upgrade stages on hover), name, role, description. */
function TowerShowcase({ type }: { type: TowerType }) {
  const { t } = useLanguage();
  const [stage, setStage] = useState(STAGE_LEVELS.length - 1);
  const [playing, setPlaying] = useState(false);
  const level = STAGE_LEVELS[stage]!;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setStage((s) => (s + 1) % STAGE_LEVELS.length), 520);
    return () => window.clearInterval(id);
  }, [playing]);


  return (
    <article
      className="hn-tower"
      tabIndex={0}
      onPointerEnter={() => setPlaying(true)}
      onPointerLeave={() => {
        setPlaying(false);
        setStage(STAGE_LEVELS.length - 1);
      }}
      onFocus={() => setPlaying(true)}
      onBlur={() => {
        setPlaying(false);
        setStage(STAGE_LEVELS.length - 1);
      }}
    >
      <div className="hn-tower-stage">
        <TowerPortrait type={type} level={level} width={PREVIEW_W} height={PREVIEW_H} zoom={PREVIEW_ZOOM} baseY={0.64} />
        <span className="hn-tower-level">{t("menu.towerLevel", { level })}</span>
      </div>
      <h3>{t(`towers.${type}.name` as TranslationKey)}</h3>
      <p className="hn-tower-role">{t(`towers.${type}.role` as TranslationKey)}</p>
      <p className="hn-tower-desc">{t(`towers.${type}.description` as TranslationKey)}</p>
    </article>
  );
}

const HOME_CSS = `
.hn-home {
  --night: #110d09;
  --night-2: #18120c;
  --panel: #1f1810;
  --line: rgba(232, 176, 75, 0.16);
  --gold: #e8b04b;
  --gold-hi: #f7dc9c;
  --bone: #efe5d2;
  --ash: #a8987f;
  --display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  position: relative;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--night);
  color: var(--bone);
  scroll-behavior: smooth;
}
.hn-home button { font: inherit; color: inherit; }
.hn-home :focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 3px; }

/* ---------- hero ---------- */
.hn-hero { position: relative; height: 100vh; min-height: 560px; overflow: hidden; }
.hn-hero-shade {
  position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(90deg, rgba(17,13,9,0.92) 0%, rgba(17,13,9,0.72) 28%, rgba(17,13,9,0.18) 55%, rgba(17,13,9,0) 70%),
    linear-gradient(180deg, rgba(17,13,9,0.55) 0%, rgba(17,13,9,0) 16%, rgba(17,13,9,0) 70%, var(--night) 100%);
}
.hn-hero-flash {
  position: absolute; inset: 0; pointer-events: none; opacity: 0; z-index: 4;
  background: radial-gradient(circle at 70% 70%, rgba(255,240,205,0.95), rgba(40,26,12,1) 75%);
  transition: opacity ${TRANSITION_DURATION_MS}ms cubic-bezier(0.6, 0, 0.9, 0.5);
}
.hn-hero.is-entering .hn-hero-flash { opacity: 1; }
.hn-hero-nav { position: absolute; top: 0; left: 0; right: 0; z-index: 6; }
.hn-hero-copy, .hn-scene { transition: opacity 300ms ease-out; }
.hn-hero.is-entering .hn-hero-copy, .hn-hero.is-entering .hn-scene, .hn-hero.is-entering .hn-hero-nav { opacity: 0; pointer-events: none; }

.hn-hero-copy {
  position: absolute; z-index: 2;
  left: clamp(20px, 6vw, 96px); bottom: clamp(48px, 11vh, 120px);
  width: min(720px, calc(100% - 40px));
}
.hn-season-pill {
  display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px 10px;
  padding: 7px 14px 7px 12px; margin-bottom: 22px;
  background: rgba(24,18,12,0.7); border: 1px solid var(--line); border-radius: 999px;
  font-size: 13px; cursor: pointer; text-align: left;
  backdrop-filter: blur(6px);
}
.hn-season-pill:hover { border-color: rgba(232,176,75,0.5); }
.hn-season-dot { width: 7px; height: 7px; border-radius: 50%; background: #7fd18b; box-shadow: 0 0 0 3px rgba(127,209,139,0.18); }
.hn-season-live { font-weight: 600; color: var(--bone); }
.hn-season-meta { color: var(--ash); }

.hn-wordmark {
  margin: 0; font-family: var(--display); font-weight: 700;
  font-size: clamp(50px, 7.2vw, 112px); line-height: 0.9; letter-spacing: 0.035em;
  background: linear-gradient(180deg, #fff4d6 0%, var(--gold-hi) 38%, var(--gold) 70%, #a8711f 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 rgba(60,34,8,0.9)) drop-shadow(0 12px 28px rgba(0,0,0,0.55));
}
.hn-tagline {
  margin: 14px 0 0; font-family: var(--display); font-weight: 600; font-style: italic;
  font-size: clamp(20px, 2.2vw, 28px); color: var(--gold-hi); letter-spacing: 0.01em;
}
.hn-pitch { margin: 10px 0 0; max-width: 46ch; font-size: clamp(14px, 1.2vw, 16px); line-height: 1.6; color: #d9cdb6; }

.hn-cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.hn-play {
  position: relative; padding: 16px 34px; border-radius: 10px; cursor: pointer;
  border: 1px solid #f2c873;
  background: linear-gradient(180deg, #f6cf7a 0%, var(--gold) 55%, #c58a2c 100%);
  color: #2b1906 !important; font-size: 16px !important; font-weight: 800; letter-spacing: 0.02em;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 30px rgba(232,176,75,0.28), 0 2px 0 #7a4f14;
  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
}
.hn-play:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 14px 36px rgba(232,176,75,0.4), 0 2px 0 #7a4f14; }
.hn-play:active { transform: translateY(1px); }
.hn-ghost {
  padding: 15px 24px; border-radius: 10px; cursor: pointer;
  background: rgba(24,18,12,0.55); border: 1px solid rgba(239,229,210,0.28);
  font-size: 15px; font-weight: 600; backdrop-filter: blur(6px);
  transition: border-color 140ms ease, background 140ms ease;
}
.hn-ghost:hover { border-color: rgba(239,229,210,0.6); background: rgba(40,30,18,0.7); }

.hn-stats { display: flex; flex-wrap: wrap; gap: 0; margin: 34px 0 0; padding: 0; }
.hn-stats > div { padding: 0 22px; border-left: 1px solid var(--line); }
.hn-stats > div:first-child { padding-left: 0; border-left: none; }
.hn-stats dt { font-size: 12px; color: var(--ash); }
.hn-stats dd { margin: 2px 0 0; font-family: var(--display); font-weight: 700; font-size: 30px; line-height: 1; color: var(--bone); font-variant-numeric: lining-nums tabular-nums; }
.hn-stats dd small { font-size: 16px; color: var(--ash); font-weight: 600; }

.hn-scene {
  position: absolute; z-index: 2; right: clamp(20px, 4vw, 56px); bottom: clamp(36px, 7vh, 72px);
  text-align: right; max-width: 320px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6);
}
.hn-scene-phase { font-size: 12px; color: var(--gold-hi); }
.hn-scene-name { font-family: var(--display); font-weight: 700; font-size: 26px; line-height: 1.1; }
.hn-scene-tag { font-size: 13px; color: #d9cdb6; margin-top: 2px; }
.hn-scene-dots { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
.hn-scene-dot { width: 28px; height: 14px; padding: 5px 0; background: none; border: none; cursor: pointer; }
.hn-scene-dot span { display: block; height: 3px; border-radius: 2px; background: rgba(239,229,210,0.3); position: relative; overflow: hidden; }
.hn-scene-dot:hover span { background: rgba(239,229,210,0.55); }
.hn-scene-dot.is-active span::after {
  content: ""; position: absolute; inset: 0; background: var(--gold-hi);
  transform-origin: left; animation: hn-progress linear forwards; animation-duration: inherit;
}
@keyframes hn-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* ---------- body ---------- */
.hn-body { position: relative; padding: 0 clamp(20px, 6vw, 96px); }
.hn-section { max-width: 1200px; margin: 0 auto; padding: clamp(56px, 10vh, 112px) 0 0; }
.hn-section-head { max-width: 640px; margin-bottom: 36px; }
.hn-section-head.is-compact { margin-bottom: 18px; }
.hn-section-head h2 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(32px, 3.6vw, 48px); line-height: 1.05; color: var(--bone); }
.hn-section-head p { margin: 12px 0 0; font-size: 16px; line-height: 1.65; color: var(--ash); max-width: 60ch; }

.hn-towers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px; }
.hn-tower { outline: none; }
.hn-tower-stage {
  position: relative; display: flex; justify-content: center; align-items: flex-end;
  height: 290px; margin-bottom: 18px; border-bottom: 1px solid var(--line);
  background: radial-gradient(ellipse 60% 36% at 50% 68%, rgba(232,176,75,0.16), rgba(232,176,75,0) 70%);
}
.hn-tower-level { position: absolute; top: 4px; right: 0; font-size: 12px; color: var(--ash); font-variant-numeric: tabular-nums; }
.hn-tower:hover .hn-tower-level, .hn-tower:focus-visible .hn-tower-level { color: var(--gold-hi); }
.hn-tower h3 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 26px; }
.hn-tower-role { margin: 4px 0 0; font-size: 13px; color: var(--gold); }
.hn-tower-desc { margin: 10px 0 0; font-size: 14px; line-height: 1.6; color: var(--ash); }

.hn-worlds { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.hn-world { position: relative; aspect-ratio: 5 / 3; border-radius: 6px; overflow: hidden; background: var(--panel); }
.hn-world-img { position: absolute; inset: 0; background-size: cover; background-position: center; transition: transform 600ms ease; }
.hn-world:hover .hn-world-img { transform: scale(1.04); }
.hn-world::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(17,13,9,0) 40%, rgba(17,13,9,0.92) 100%); }
.hn-world-text { position: absolute; z-index: 1; left: 12px; right: 12px; bottom: 10px; display: grid; grid-template-columns: auto 1fr; column-gap: 10px; align-items: baseline; }
.hn-world-num { grid-row: span 2; font-family: var(--display); font-weight: 700; font-size: 30px; line-height: 1; color: var(--gold-hi); font-variant-numeric: lining-nums; }
.hn-world-name { font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.1; }
.hn-world-waves { font-size: 12px; color: var(--ash); }

.hn-split { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: clamp(32px, 5vw, 72px); }
.hn-news ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.hn-news li { border-bottom: 1px solid var(--line); }
.hn-news-item { display: grid; gap: 4px; width: 100%; padding: 18px 0; text-align: left; background: none; border: none; cursor: pointer; }
.hn-news-item time { font-size: 12px; color: var(--ash); }
.hn-news-title { font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.15; color: var(--bone); }
.hn-news-item:hover .hn-news-title { color: var(--gold-hi); }
.hn-news-desc { font-size: 14px; line-height: 1.6; color: var(--ash); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hn-link { margin-top: 16px; padding: 0; background: none; border: none; cursor: pointer; color: var(--gold) !important; font-weight: 700; font-size: 14px; text-decoration: underline; text-decoration-color: rgba(232,176,75,0.4); text-underline-offset: 4px; }
.hn-link:hover { color: var(--gold-hi) !important; text-decoration-color: var(--gold-hi); }

.hn-gates { display: grid; gap: 0; align-content: start; }
.hn-gate { padding: 22px 0; border-top: 1px solid var(--line); }
.hn-gate:last-child { border-bottom: 1px solid var(--line); }
.hn-gate h3 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 24px; }
.hn-gate p { margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: var(--ash); }
.hn-gate .hn-link { margin-top: 12px; }
.hn-gate.is-season {
  padding: 24px; border: 1px solid rgba(232,176,75,0.35); border-radius: 10px; margin-bottom: 8px;
  background: linear-gradient(160deg, rgba(232,176,75,0.12), rgba(232,176,75,0.02) 60%), var(--night-2);
}
.hn-gate.is-season + .hn-gate { border-top: none; }
.hn-gate-time { color: var(--gold-hi) !important; }
.hn-gate.is-season .hn-ghost { margin-top: 16px; padding: 11px 18px; font-size: 14px; }

.hn-footer {
  width: min(1200px, calc(100% - 2 * clamp(20px, 6vw, 96px))); margin: clamp(72px, 12vh, 128px) auto 0; padding: 32px 0 40px;
  border-top: 1px solid var(--line);
  display: grid; grid-template-columns: 1fr auto; gap: 18px 32px; align-items: start;
}
.hn-footer-mark { font-family: var(--display); font-weight: 700; font-size: 22px; letter-spacing: 0.06em; color: var(--gold-hi); }
.hn-footer p { margin: 6px 0 0; font-size: 13px; color: var(--ash); }
.hn-footer nav { display: flex; flex-wrap: wrap; gap: 6px 22px; }
.hn-footer nav button { padding: 4px 0; background: none; border: none; cursor: pointer; font-size: 14px; color: #d9cdb6; }
.hn-footer nav button:hover { color: var(--gold-hi); }
.hn-footer-rights { grid-column: 1 / -1; font-size: 12px !important; }

@media (max-width: 1000px) {
  .hn-towers { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 44px; }
  .hn-worlds { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .hn-split { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .hn-hero-shade {
    background: linear-gradient(180deg, rgba(17,13,9,0.6) 0%, rgba(17,13,9,0.05) 22%, rgba(17,13,9,0.35) 45%, rgba(17,13,9,0.9) 70%, var(--night) 100%);
  }
  .hn-hero-copy { bottom: 40px; }
  .hn-scene { top: 108px; bottom: auto; right: 16px; max-width: 60%; }
  .hn-scene-tag { display: none; }
  .hn-scene-name { font-size: 20px; }
  .hn-stats > div { padding: 0 14px; }
  .hn-stats dd { font-size: 24px; }
  .hn-worlds { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .hn-world-num { font-size: 24px; }
  .hn-world-name { font-size: 16px; }
  .hn-footer { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .hn-towers { grid-template-columns: 1fr; }
  .hn-cta-row > button { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) {
  .hn-home { scroll-behavior: auto; }
  .hn-world-img, .hn-play, .hn-hero-flash { transition: none; }
  .hn-scene-dot.is-active span::after { animation: none; transform: none; }
}
`;
