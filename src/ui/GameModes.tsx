import type { ReactNode } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Castle3DPortrait, Tower3DPortrait } from "./Tower3DPortrait";
import { ColossusShowcase } from "./ColossusPromo";

/**
 * MODOS DE JOGO — the mode picker on the Season page: one wide card for the
 * Season run, then four equal cards (Eternal, Duel, Global Boss, Hunts).
 * Every card has the same anatomy — art, a small coloured kicker, title, a
 * one-line pitch, two or three live figures and one button pinned to the
 * bottom — so the row lines up. Each mode keeps its own colour only as an
 * accent (the top rule, the kicker and the art's glow); the buttons are the
 * same for all of them. Clicking the art plays too.
 */

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export interface ModeFigure {
  label: string;
  value: string;
}

export interface ModePicker {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  testId: string;
}

export interface GameModeCard {
  id: "SEASON" | "ETERNAL" | "DUEL" | "COLOSSUS" | "HUNT";
  kicker: string;
  title: string;
  pitch: string;
  figures: ModeFigure[];
  cta: string;
  onPlay: () => void;
  testId: string;
  /** The ground art behind the picture (a file in sprites/ground). */
  ground?: string;
  /** Season / Eternal: the 3D castle's biome dressing and skin. */
  castle?: { dressing: string; skin?: string };
  /** Hunt: the boss sprite sheet shown on the art. */
  boss?: string;
  badge?: string;
  /** Shown instead of the button when the mode can't be played yet. */
  locked?: string;
  /** A choice made before playing (the Hunt's phase). */
  picker?: ModePicker;
  /** A second, quieter link under the button (e.g. the Eternal Merchant). */
  extra?: { label: string; onClick: () => void; testId: string };
}

function Art({ card }: { card: GameModeCard }): ReactNode {
  const ground = card.ground ? <div className="gm-ground" style={{ backgroundImage: `url(${assetBase}sprites/ground/${card.ground}.webp)` }} /> : null;
  switch (card.id) {
    case "SEASON":
    case "ETERNAL":
      return (
        <>
          {ground}
          {card.id === "ETERNAL" && <div className="gm-stars" />}
          <div className="gm-castle">{card.castle && <Castle3DPortrait dressing={card.castle.dressing} skin={card.castle.skin} width={card.id === "SEASON" ? 420 : 240} height={card.id === "SEASON" ? 330 : 150} />}</div>
        </>
      );
    case "DUEL":
      return (
        <>
          {ground}
          <div className="gm-duel">
            <div className="gm-tower is-left">
              <Tower3DPortrait type="IRONWOOD" level={41} width={130} height={150} spin={false} />
            </div>
            <span className="gm-vs">VS</span>
            <div className="gm-tower is-right">
              <Tower3DPortrait type="INFERNO" level={41} width={130} height={150} spin={false} />
            </div>
          </div>
        </>
      );
    case "COLOSSUS":
      return <ColossusShowcase className="gm-serpent" />;
    case "HUNT":
      return (
        <>
          {ground}
          {card.boss && <div className="gm-boss" style={{ backgroundImage: `url(${assetBase}sprites/enemies/bosses/${card.boss}.webp)` }} />}
          <svg className="gm-reticle" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" />
            <circle cx="50" cy="50" r="26" />
            <path d="M50 2v18M50 80v18M2 50h18M80 50h18" />
          </svg>
        </>
      );
  }
}

export function GameModes({ cards, sub }: { cards: GameModeCard[]; sub?: string }) {
  const { t } = useLanguage();
  return (
    <section className="gm" aria-labelledby="gm-title" data-testid="game-modes">
      <style>{GM_CSS}</style>
      <div className="gm-head">
        <h2 className="pg-h2" id="gm-title">
          {t("modes.title")}
        </h2>
        {sub && <p className="gm-sub">{sub}</p>}
      </div>
      <div className="gm-grid">
        {cards.map((c) => (
          <article key={c.id} className={`gm-card is-${c.id}${c.locked ? " is-locked" : ""}`} data-testid={`mode-${c.id}`}>
            <div className="gm-art" onClick={c.locked ? undefined : c.onPlay} aria-hidden="true">
              <Art card={c} />
              {c.badge && <span className="gm-badge">{c.badge}</span>}
            </div>
            <div className="gm-body">
              <p className="gm-kicker">{c.kicker}</p>
              <h3 className="gm-title">{c.title}</h3>
              <p className="gm-pitch">{c.pitch}</p>
              <dl className="gm-figs" style={{ gridTemplateColumns: `repeat(${c.figures.length}, minmax(0, max-content))` }}>
                {c.figures.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="gm-actions">
                {c.picker && (
                  <label className="gm-pick">
                    <span>{c.picker.label}</span>
                    <select value={c.picker.value} onChange={(e) => c.picker!.onChange(e.target.value)} data-testid={c.picker.testId}>
                      {c.picker.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {c.extra && (
                  <button className="gm-extra" onClick={c.extra.onClick} data-testid={c.extra.testId}>
                    {c.extra.label}
                  </button>
                )}
                {c.locked ? (
                  <p className="gm-locked">{c.locked}</p>
                ) : (
                  <button className="gm-play" onClick={c.onPlay} data-testid={c.testId}>
                    {c.cta}
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
.gm { padding: 44px 0 8px; }
.gm-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 24px; }
.gm-sub { margin: 0; max-width: 52ch; font-size: 14px; line-height: 1.5; color: var(--ash); }
.gm-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }

.gm-card { --c1: #e8b04b; --glow: rgba(232,176,75,0.28); position: relative; display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,236,200,0.10); background: #15100b; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.gm-card::before { content: ""; position: absolute; z-index: 2; left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--c1) 20%, var(--c1) 80%, transparent); opacity: 0.85; }
.gm-card:hover { border-color: color-mix(in srgb, var(--c1) 55%, transparent); box-shadow: 0 18px 40px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, var(--c1) 20%, transparent); }
.gm-card.is-SEASON { grid-column: 1 / -1; flex-direction: row; min-height: 340px; }
.gm-card.is-ETERNAL { --c1: #a98bff; --glow: rgba(169,139,255,0.30); }
.gm-card.is-DUEL { --c1: #ff6a5a; --glow: rgba(255,106,90,0.28); }
.gm-card.is-COLOSSUS { --c1: #ffa24a; --glow: rgba(255,162,74,0.28); }
.gm-card.is-HUNT { --c1: #d8564a; --glow: rgba(216,86,74,0.30); }

.gm-art { position: relative; aspect-ratio: 16 / 10; overflow: hidden; cursor: pointer; background: #08060a; flex: none; }
.gm-card.is-locked .gm-art { cursor: default; }
.gm-card.is-SEASON .gm-art { aspect-ratio: auto; flex: 1.3 1 0; }
.gm-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,7,4,0.05) 40%, rgba(21,16,11,0.92)); pointer-events: none; }
.gm-card.is-SEASON .gm-art::after { background: linear-gradient(90deg, rgba(10,7,4,0) 55%, #15100b); }
.gm-ground { position: absolute; inset: -6%; background-size: cover; background-position: center; filter: saturate(0.9) brightness(0.62); transition: transform 0.8s ease; }
.gm-card:hover .gm-ground { transform: scale(1.04); }
.gm-castle { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; padding-bottom: 4%; filter: drop-shadow(0 14px 18px rgba(0,0,0,0.65)) drop-shadow(0 0 26px var(--glow)); }
.gm-castle canvas { max-width: 100%; height: auto !important; aspect-ratio: auto; }
.gm-stars { position: absolute; inset: 0; background-image: radial-gradient(1.5px 1.5px at 15% 20%, #e8dcff, transparent), radial-gradient(1px 1px at 60% 12%, #fff, transparent), radial-gradient(1.5px 1.5px at 80% 30%, #c9b4ff, transparent), radial-gradient(1px 1px at 35% 45%, #fff, transparent), radial-gradient(1.5px 1.5px at 90% 60%, #e8dcff, transparent); opacity: 0.7; }
.gm-duel { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding-bottom: 6%; }
.gm-tower { display: grid; place-items: center; filter: drop-shadow(0 10px 12px rgba(0,0,0,0.7)); }
.gm-tower.is-right { transform: scaleX(-1); }
.gm-vs { font-family: var(--display); font-weight: 600; font-size: 30px; letter-spacing: 0.02em; color: #fff3e0; text-shadow: 0 0 18px rgba(255,106,90,0.8), 0 2px 0 rgba(0,0,0,0.6); }
.gm-serpent { position: absolute !important; inset: 0; width: 100% !important; height: 100% !important; aspect-ratio: auto !important; object-fit: cover; }
.gm-boss { position: absolute; z-index: 1; left: 50%; bottom: 4%; width: 62%; aspect-ratio: 1; transform: translateX(-50%); background-size: 1200% 400%; background-position: 0 0; background-repeat: no-repeat; filter: drop-shadow(0 10px 14px rgba(0,0,0,0.7)) drop-shadow(0 0 18px var(--glow)); }
.gm-reticle { position: absolute; z-index: 1; right: 12px; top: 12px; width: 44px; height: 44px; fill: none; stroke: color-mix(in srgb, var(--c1) 80%, #fff); stroke-width: 3; opacity: 0.75; }
.gm-badge { position: absolute; top: 12px; left: 12px; z-index: 2; padding: 4px 10px; border-radius: 20px; background: rgba(0,0,0,0.6); border: 1px solid color-mix(in srgb, var(--c1) 70%, transparent); color: #fff2d8; font-size: 12px; font-weight: 600; }

.gm-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 6px; flex: 1; padding: 4px 18px 18px; }
.gm-card.is-SEASON .gm-body { flex: 1 1 0; justify-content: center; gap: 10px; padding: 32px 36px 32px 8px; }
.gm-kicker { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--c1); }
.gm-title { margin: 0; font-family: var(--display); font-weight: 600; font-size: 24px; line-height: 1.1; color: #fbefd6; }
.gm-card.is-SEASON .gm-title { font-size: 40px; }
.gm-pitch { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ash); }
.gm-card.is-SEASON .gm-pitch { font-size: 15px; max-width: 44ch; }
.gm-figs { display: grid; gap: 6px 26px; margin: 6px 0 0; padding-top: 10px; border-top: 1px solid rgba(255,236,200,0.08); }
.gm-figs div { display: grid; gap: 2px; }
.gm-figs dt { font-size: 11.5px; color: var(--ash-2); }
.gm-figs dd { margin: 0; white-space: nowrap; font-family: var(--display); font-size: 19px; color: #fbefd6; font-variant-numeric: tabular-nums; }
.gm-card.is-SEASON .gm-figs dd { font-size: 24px; }

.gm-actions { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 14px; }
.gm-card.is-SEASON .gm-actions { margin-top: 6px; flex-direction: row; align-items: center; }
.gm-play { width: 100%; padding: 11px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14.5px; color: #fbefd6 !important; background: rgba(255,255,255,0.03); border: 1px solid color-mix(in srgb, var(--c1) 55%, transparent); transition: background 0.15s ease, border-color 0.15s ease; }
.gm-play:hover { background: color-mix(in srgb, var(--c1) 16%, transparent); border-color: var(--c1); }
.gm-card.is-SEASON .gm-play { width: auto; padding: 14px 34px; font-size: 16px; color: #1a0f04 !important; border-color: #f4cf7a; background: linear-gradient(180deg, #f4cf7a, #d9a441); box-shadow: 0 8px 22px rgba(217,164,65,0.25); }
.gm-card.is-SEASON .gm-play:hover { background: linear-gradient(180deg, #f8da94, #e2ae4c); }
.gm-play:focus-visible, .gm-extra:focus-visible, .gm-pick select:focus-visible { outline: 2px solid #fff3d0; outline-offset: 3px; }
.gm-extra { align-self: flex-start; padding: 2px 4px; border: 0; background: none; color: var(--ash) !important; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(255,236,200,0.25); cursor: pointer; }
.gm-extra:hover { color: #fbefd6 !important; text-decoration-color: currentColor; }
.gm-pick { display: grid; gap: 4px; }
.gm-pick span { font-size: 11.5px; color: var(--ash-2); }
.gm-pick select { width: 100%; padding: 9px 10px; border-radius: 8px; background: #0f0b07; color: #fbefd6; border: 1px solid rgba(255,236,200,0.14); font: inherit; font-size: 14px; }
.gm-locked { margin: 0; padding: 10px 12px; border-radius: 8px; border: 1px dashed rgba(255,236,200,0.16); color: var(--ash); font-size: 13px; line-height: 1.4; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .gm-card, .gm-ground { transition: none; }
}
@media (max-width: 1100px) {
  .gm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .gm-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .gm-card.is-SEASON { flex-direction: column; min-height: 0; }
  .gm-card.is-SEASON .gm-art { aspect-ratio: 16 / 11; flex: none; }
  .gm-card.is-SEASON .gm-art::after { background: linear-gradient(180deg, rgba(10,7,4,0.05) 45%, #15100b); }
  .gm-card.is-SEASON .gm-body { padding: 4px 18px 20px; }
  .gm-card.is-SEASON .gm-title { font-size: 30px; }
  .gm-figs { display: flex; flex-wrap: wrap; gap: 8px 28px; }
  .gm-card.is-SEASON .gm-actions { flex-direction: column; align-items: stretch; }
  .gm-card.is-SEASON .gm-play { width: 100%; }
}
`;
