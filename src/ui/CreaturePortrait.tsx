import type { CSSProperties } from "react";
import type { EnemyType } from "@/config/enemyStats";
import { PHASES } from "@/config/phaseConfig";
import { BIOME_ENEMY_SHEETS } from "@/rendering/biomeEnemySheets";

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/** The biome whose creature art a type is shown with by default: the first phase it appears in. */
export function homeBiomeFor(type: EnemyType): string | null {
  for (const phase of PHASES) {
    if (phase.enemyPool.includes(type) && BIOME_ENEMY_SHEETS[phase.biomeId]?.[type]) return phase.biomeId;
  }
  for (const [biome, sheets] of Object.entries(BIOME_ENEMY_SHEETS)) if (sheets[type]) return biome;
  return null;
}

export function hasCreatureArt(type: EnemyType, biomeId: string): boolean {
  return BIOME_ENEMY_SHEETS[biomeId]?.[type] !== undefined;
}

interface CreaturePortraitProps {
  type: EnemyType;
  biomeId?: string | null;
  size: number;
  /** Plays the walk cycle while the closest `.hn-walk-trigger` ancestor is hovered/focused. */
  className?: string;
  title?: string;
}

/**
 * One creature from its real baked walk sheet (side view, frame 0). Inside a
 * `.hn-walk-trigger` element the walk cycle plays on hover — pure CSS, no
 * canvas, so a page can show dozens of these cheaply.
 */
export function CreaturePortrait({ type, biomeId, size, className, title }: CreaturePortraitProps) {
  const biome = biomeId ?? homeBiomeFor(type);
  const entry = biome ? BIOME_ENEMY_SHEETS[biome]?.[type] : undefined;
  if (!entry) return <span className={`hn-creature is-empty ${className ?? ""}`} style={{ width: size, height: size }} title={title} />;
  const style: CSSProperties & Record<"--frames" | "--strip", string | number> = {
    width: size,
    height: size,
    backgroundImage: `url(${assetBase}sprites/enemies/${entry.file})`,
    backgroundSize: `${entry.frames * size}px ${size * 3}px`,
    backgroundPosition: "0 0",
    "--frames": entry.frames,
    "--strip": `${-entry.frames * size}px`,
  };
  return <span className={`hn-creature ${className ?? ""}`} style={style} title={title} role={title ? "img" : undefined} aria-label={title} />;
}

/** Keyframes + hover rule the portraits need; include once per page. */
export const CREATURE_PORTRAIT_CSS = `
.hn-creature { display: inline-block; flex-shrink: 0; background-repeat: no-repeat; image-rendering: auto; }
.hn-creature.is-empty { background: radial-gradient(circle at 50% 70%, rgba(232,176,75,0.12), transparent 60%); }
@keyframes hn-walk { to { background-position-x: var(--strip); } }
.hn-walk-trigger:hover .hn-creature:not(.is-empty), .hn-walk-trigger:focus-visible .hn-creature:not(.is-empty), .hn-walk-trigger:focus-within .hn-creature:not(.is-empty) {
  animation: hn-walk 0.9s steps(var(--frames)) infinite;
}
@media (prefers-reduced-motion: reduce) { .hn-walk-trigger:hover .hn-creature { animation: none !important; } }
`;
