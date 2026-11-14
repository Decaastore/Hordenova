import type { ReactNode } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { TowerPortrait } from "./TowerPortrait";
import { ColossusShowcase } from "./ColossusPromo";

/**
 * MODOS DE JOGO — the illustrated mode picker at the top of the Season page:
 * one big card for the Season run, then Eternal, Duel and the Global Boss,
 * each with its own art, colour, a one-line pitch, two live figures and its
 * play button. Clicking the art plays too.
 */

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export interface ModeFigure {
  label: string;
  value: string;
}

export interface GameModeCard {
  id: "SEASON" | "ETERNAL" | "DUEL" | "COLOSSUS";
  kicker: string;
  title: string;
  pitch: string;
  figures: ModeFigure[];
  cta: string;
  onPlay: () => void;
  testId: string;
  /** Season: the ground and castle art of this Season's theme. */
  ground?: string;
  castle?: string;
  badge?: string;
  /** A second, quieter button under the main one (e.g. the Eternal Merchant). */
  extra?: { label: string; onClick: () => void; testId: string };
}

function Art({ card }: { card: GameModeCard }): ReactNode {
  switch (card.id) {
    case "SEASON":
      return (
        <>
          <div className="gm-ground" style={{ backgroundImage: `url(${assetBase}sprites/ground/${card.ground}.webp)` }} />
          <img className="gm-castle" src={`${assetBase}sprites/castle/${card.castle}_1.webp`} alt="" draggable={false} />
          <div className="gm-embers" />
        </>
      );
    case "ETERNAL":
      return (
        <>
          <div className="gm-ground" style={{ backgroundImage: `url(${assetBase}sprites/ground/abyss.webp)` }} />
          <div className="gm-stars" />
          <img className="gm-castle is-eternal" src={`${assetBase}sprites/castle/skin_prestige_eternal_bastion_1.webp`} alt="" draggable={false} />
          <span className="gm-infinity" aria-hidden="true">
            ∞
          </span>
        </>
      );
    case "DUEL":
      return (
        <>
          <div className="gm-ground" style={{ backgroundImage: `url(${assetBase}sprites/duel/volcanic_wastes.webp)` }} />
          <div className="gm-duel">
            <div className="gm-tower is-left">
              <TowerPortrait type="IRONWOOD" level={41} width={150} height={150} zoom={2.6} baseY={0.82} />
            </div>
            <span className="gm-vs">VS</span>
            <div className="gm-tower is-right">
              <TowerPortrait type="INFERNO" level={41} width={150} height={150} zoom={2.6} baseY={0.82} />
            </div>
          </div>
        </>
      );
    case "COLOSSUS":
      return <ColossusShowcase className="gm-serpent" />;
  }
}

export function GameModes({ cards }: { cards: GameModeCard[] }) {
  const { t } = useLanguage();
  return (
    <section className="gm" aria-labelledby="gm-title" data-testid="game-modes">
      <style>{GM_CSS}</style>
      <h2 className="pg-h2" id="gm-title">
        {t("modes.title")}
      </h2>
      <div className="gm-grid">
        {cards.map((c) => (
          <article key={c.id} className={`gm-card is-${c.id}`} data-testid={`mode-${c.id}`}>
            <div className="gm-art" onClick={c.onPlay} aria-hidden="true">
              <Art card={c} />
              {c.badge && <span className="gm-badge">{c.badge}</span>}
            </div>
            <div className="gm-body">
              <p className="gm-kicker">{c.kicker}</p>
              <h3 className="gm-title">{c.title}</h3>
              <p className="gm-pitch">{c.pitch}</p>
              <dl className="gm-figs">
                {c.figures.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="gm-actions">
                <button className="gm-play" onClick={c.onPlay} data-testid={c.testId}>
                  {c.cta}
                </button>
                {c.extra && (
                  <button className="gm-extra" onClick={c.extra.onClick} data-testid={c.extra.testId}>
                    {c.extra.label}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const GM_CSS = `
.gm { padding: 40px 0 8px; }
.gm-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 16px; }
.gm-card { --c1: #e8b04b; --c2: #6a4a14; --glow: rgba(232,176,75,0.35); position: relative; display: grid; grid-template-rows: auto 1fr; border-radius: 16px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--c1) 45%, transparent); background: linear-gradient(180deg, color-mix(in srgb, var(--c2) 40%, #120d08), #0f0b07 70%); box-shadow: 0 10px 30px rgba(0,0,0,0.45); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.gm-card:hover { transform: translateY(-3px); border-color: var(--c1); box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 0 30px var(--glow); }
.gm-card.is-SEASON { grid-column: 1 / -1; grid-template-rows: none; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
.gm-card.is-ETERNAL { --c1: #a98bff; --c2: #3a2470; --glow: rgba(169,139,255,0.35); }
.gm-card.is-DUEL { --c1: #ff5a4a; --c2: #6a1410; --glow: rgba(255,90,74,0.35); }
.gm-card.is-COLOSSUS { --c1: #ffa24a; --c2: #3a1650; --glow: rgba(255,162,74,0.35); }

.gm-art { position: relative; aspect-ratio: 16 / 9; overflow: hidden; cursor: pointer; background: #08060a; }
.gm-card.is-SEASON .gm-art { aspect-ratio: auto; min-height: 300px; }
.gm-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(10,7,4,0.85)); pointer-events: none; }
.gm-card.is-SEASON .gm-art::after { background: linear-gradient(90deg, transparent 55%, rgba(15,11,7,0.95)); }
.gm-ground { position: absolute; inset: -6%; background-size: cover; background-position: center; filter: saturate(1.1) brightness(0.8); transition: transform 0.6s ease; }
.gm-card:hover .gm-ground { transform: scale(1.06); }
.gm-castle { position: absolute; left: 50%; bottom: -4%; width: 62%; transform: translateX(-50%); filter: drop-shadow(0 12px 18px rgba(0,0,0,0.7)) drop-shadow(0 0 22px var(--glow)); transition: transform 0.4s ease; user-select: none; }
.gm-card.is-SEASON .gm-castle { width: 52%; bottom: 2%; }
.gm-card:hover .gm-castle { transform: translateX(-50%) translateY(-4px) scale(1.03); }
.gm-castle.is-eternal { width: 56%; filter: drop-shadow(0 12px 18px rgba(0,0,0,0.7)) drop-shadow(0 0 26px rgba(169,139,255,0.6)); }
.gm-embers { position: absolute; inset: 0; background-image: radial-gradient(2px 2px at 20% 70%, #ffcf7a, transparent), radial-gradient(1.5px 1.5px at 70% 40%, #ffb05a, transparent), radial-gradient(2px 2px at 45% 25%, #ffd99a, transparent), radial-gradient(1.5px 1.5px at 85% 75%, #ffcf7a, transparent), radial-gradient(1.5px 1.5px at 30% 35%, #ffb05a, transparent); animation: gmDrift 7s linear infinite; opacity: 0.8; }
.gm-stars { position: absolute; inset: 0; background-image: radial-gradient(1.5px 1.5px at 15% 20%, #e8dcff, transparent), radial-gradient(1px 1px at 60% 12%, #fff, transparent), radial-gradient(1.5px 1.5px at 80% 30%, #c9b4ff, transparent), radial-gradient(1px 1px at 35% 45%, #fff, transparent), radial-gradient(1.5px 1.5px at 90% 60%, #e8dcff, transparent), radial-gradient(1px 1px at 8% 55%, #c9b4ff, transparent); animation: gmTwinkle 3.5s ease-in-out infinite alternate; }
.gm-infinity { position: absolute; top: 8px; right: 14px; font-family: var(--display); font-size: 54px; line-height: 1; color: #d8c8ff; text-shadow: 0 0 18px rgba(169,139,255,0.9); }
.gm-duel { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 2%; padding-bottom: 4%; }
.gm-tower { width: 38%; display: grid; place-items: center; }
.gm-tower canvas { width: 100% !important; }
.gm-tower canvas { width: clamp(96px, 34%, 150px) !important; height: auto !important; aspect-ratio: 1; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.7)); }
.gm-tower.is-right { transform: scaleX(-1); }
.gm-tower.is-left { background: radial-gradient(ellipse 45% 30% at 50% 78%, rgba(90,160,255,0.55), transparent 70%); }
.gm-tower.is-right { background: radial-gradient(ellipse 45% 30% at 50% 78%, rgba(255,80,60,0.6), transparent 70%); }
.gm-vs { align-self: center; font-family: var(--display); font-weight: 800; font-size: 40px; color: #fff3e0; text-shadow: 0 0 14px #ff5a4a, 0 0 30px #ff5a4a, 0 3px 0 #6a1410; transform: rotate(-8deg); transition: transform 0.3s ease; }
.gm-card:hover .gm-vs { transform: rotate(-8deg) scale(1.15); }
.gm-serpent { position: absolute !important; inset: 0; width: 100% !important; height: 100% !important; aspect-ratio: auto !important; object-fit: cover; }
.gm-badge { position: absolute; top: 12px; left: 12px; z-index: 1; padding: 5px 10px; border-radius: 20px; background: rgba(0,0,0,0.65); border: 1px solid var(--c1); color: #fff2d8; font-size: 12px; font-weight: 700; }

.gm-body { position: relative; display: grid; align-content: start; gap: 8px; padding: 18px 20px 20px; }
.gm-card.is-SEASON .gm-body { align-content: center; padding: 28px 30px; }
.gm-kicker { margin: 0; font-size: 12.5px; font-weight: 700; color: var(--c1); }
.gm-title { margin: 0; font-family: var(--display); font-size: 28px; line-height: 1.05; color: #fbefd6; }
.gm-card.is-SEASON .gm-title { font-size: 40px; }
.gm-pitch { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ash); max-width: 46ch; }
.gm-figs { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 4px 0 6px; }
.gm-figs div { display: grid; gap: 1px; }
.gm-figs dt { font-size: 11.5px; color: var(--ash-2); }
.gm-figs dd { margin: 0; font-family: var(--display); font-size: 20px; color: #fbefd6; font-variant-numeric: tabular-nums; }
.gm-play { justify-self: start; margin-top: 4px; padding: 12px 22px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--c1) 80%, #fff); cursor: pointer; font-weight: 800; font-size: 15px; color: #1a0f04 !important; background: linear-gradient(180deg, color-mix(in srgb, var(--c1) 70%, #fff), var(--c1)); box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 6px 18px var(--glow); transition: filter 0.15s ease, transform 0.15s ease; }
.gm-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 4px; }
.gm-extra { padding: 11px 16px; border-radius: 10px; border: 1px solid var(--c1); background: rgba(0,0,0,0.35); color: #fbefd6 !important; font-weight: 700; font-size: 14px; cursor: pointer; }
.gm-extra:hover { background: color-mix(in srgb, var(--c1) 22%, rgba(0,0,0,0.35)); }
.gm-extra:focus-visible { outline: 2px solid #fff3d0; outline-offset: 3px; }
.gm-play:hover { filter: brightness(1.1); transform: translateY(-1px); }
.gm-play:focus-visible { outline: 2px solid #fff3d0; outline-offset: 3px; }
.gm-card.is-SEASON .gm-play { font-size: 17px; padding: 14px 28px; }

@keyframes gmDrift { from { background-position: 0 0, 0 0, 0 0, 0 0, 0 0; } to { background-position: 0 -60px, 0 -90px, 0 -40px, 0 -70px, 0 -50px; } }
@keyframes gmTwinkle { from { opacity: 0.45; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .gm-embers, .gm-stars { animation: none; }
  .gm-card, .gm-ground, .gm-castle, .gm-vs { transition: none; }
}
@media (max-width: 960px) {
  .gm-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .gm-card.is-COLOSSUS { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .gm-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .gm-card.is-SEASON { grid-template-columns: minmax(0, 1fr); }
  .gm-card.is-SEASON .gm-art { min-height: 200px; }
  .gm-card.is-SEASON .gm-art::after { background: linear-gradient(180deg, transparent 45%, rgba(15,11,7,0.95)); }
  .gm-card.is-SEASON .gm-body { padding: 18px 20px 20px; }
  .gm-card.is-SEASON .gm-title { font-size: 30px; }
  .gm-play, .gm-extra { flex: 1 1 100%; }
}
`;
