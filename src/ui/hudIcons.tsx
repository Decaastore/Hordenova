import type { CSSProperties } from "react";
import { Medallion, type GameIconName } from "./gameIcons";

/**
 * TOP BAR EMBLEMS — every button in the in-game top bar carries a small
 * round emblem: a coloured enamel disc (each function has its own colour:
 * ember Forge, violet Rift, forest Expeditions…) set in a bronze rim, with
 * an icon from the shared set in ./gameIcons.tsx on it. A waiting button
 * also gets a turning ring of light around its emblem (HUD.tsx).
 */

export type EmblemTone = "missions" | "expeditions" | "forge" | "talents" | "rift" | "eternal" | "city" | "bestiary" | "inventory";

export const EMBLEM_COLOR: Record<EmblemTone, string> = {
  missions: "#e89a2a",
  expeditions: "#2f8a4a",
  forge: "#ff6a22",
  talents: "#f0b020",
  rift: "#8a4ae0",
  eternal: "#2ab0a8",
  city: "#3a7ae0",
  bestiary: "#d0242a",
  inventory: "#a8683a",
};

const EMBLEM_ICON: Record<EmblemTone, GameIconName> = {
  missions: "scroll",
  expeditions: "compass",
  forge: "anvil",
  talents: "sparkle",
  rift: "vortex",
  eternal: "hourglass",
  city: "castle",
  bestiary: "skull",
  inventory: "pouch",
};

export function HudEmblem({ tone }: { tone: EmblemTone }) {
  return (
    <span className={`hh-emb hh-emb-${tone}`} style={{ ["--emb" as string]: EMBLEM_COLOR[tone] } as CSSProperties} aria-hidden="true">
      <Medallion name={EMBLEM_ICON[tone]} color={EMBLEM_COLOR[tone]} size={30} />
    </span>
  );
}
