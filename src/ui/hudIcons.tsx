import type { CSSProperties, ReactNode } from "react";

/**
 * TOP BAR EMBLEMS — every button in the in-game top bar carries a small
 * round emblem: a coloured enamel disc (each function has its own colour:
 * ember Forge, violet Rift, forest Expeditions…) set in a bronze rim, with
 * an icon from the shared set in ./gameIcons.tsx on it. A waiting button
 * also gets a turning ring of light around its emblem (HUD.tsx).
 */

export type EmblemTone = "missions" | "expeditions" | "forge" | "talents" | "rift" | "eternal" | "city" | "bestiary" | "inventory";

export const EMBLEM_COLOR: Record<EmblemTone, string> = {
  missions: "#e8b45a",
  expeditions: "#62b85a",
  forge: "#ff6a22",
  talents: "#ffc93a",
  rift: "#a96bff",
  eternal: "#58d2c8",
  city: "#6aa6ff",
  bestiary: "#ff3f35",
  inventory: "#c98a4e",
};

export function HudEmblem({ tone, children }: { tone: EmblemTone; children: ReactNode }) {
  return (
    <span className={`hh-emb hh-emb-${tone}`} style={{ ["--emb" as string]: EMBLEM_COLOR[tone] } as CSSProperties} aria-hidden="true">
      <span className="hh-emb-disc">{children}</span>
    </span>
  );
}
