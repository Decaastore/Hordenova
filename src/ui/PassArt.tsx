import { getRarityDefinition } from "@/config/rarity";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { MAX_TOWER_LEVEL } from "@/config/towerStats";
import type { PassReward, RewardPart } from "@/config/seasonPass";
import { StoreGem } from "./StoreArt";
import { Tower3DPortrait } from "./Tower3DPortrait";

/**
 * PASS ART — a picture for every kind of Season Pass reward, so the track
 * reads at a glance: a gem-shard cluster, the Free Gem, a stack of gold
 * coins, an item rune in its rarity colour, inventory slots, and the tower
 * itself for a skin. Plus the level medallion shown on the hero.
 */

function Shards({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="pa-sh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9f7ff" />
          <stop offset="0.5" stopColor="#7cc8ff" />
          <stop offset="1" stopColor="#2a5a9a" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="35" rx="13" ry="2.6" fill="rgba(0,0,0,0.45)" />
      <path d="M12 34 9 20l5-8 4 9-2 13Z" fill="url(#pa-sh)" stroke="#123a6a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M20 35 17 14l5-10 5 11-3 20Z" fill="url(#pa-sh)" stroke="#123a6a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M28 34 26 22l4-6 4 8-3 10Z" fill="url(#pa-sh)" stroke="#123a6a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M21 8 19.5 16M13.6 14 12.4 19" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function Gold({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="pa-au" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b8" />
          <stop offset="0.5" stopColor="#f0b840" />
          <stop offset="1" stopColor="#9a5e10" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="35" rx="14" ry="2.6" fill="rgba(0,0,0,0.45)" />
      {[30, 25, 20].map((y, i) => (
        <g key={i}>
          <ellipse cx={i === 2 ? 22 : 18 + i} cy={y + 2} rx="11" ry="4" fill="#7a4a0c" />
          <ellipse cx={i === 2 ? 22 : 18 + i} cy={y} rx="11" ry="4" fill="url(#pa-au)" stroke="#6a3e08" strokeWidth="0.8" />
        </g>
      ))}
      <ellipse cx="12" cy="14" rx="8" ry="8" fill="url(#pa-au)" stroke="#6a3e08" strokeWidth="1" />
      <ellipse cx="12" cy="14" rx="5" ry="5" fill="none" stroke="#9a5e10" strokeWidth="1.2" />
      <path d="M9 11.5 11 10" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ItemRune({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="36" rx="11" ry="2.4" fill="rgba(0,0,0,0.45)" />
      <path d="M20 3 33 10.5v15L20 33 7 25.5v-15Z" fill="#1c140c" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 7 29.5 12.5v11L20 29l-9.5-5.5v-11Z" fill={color} fillOpacity="0.16" />
      <path d="M20 11 25 18 20 25 15 18Z" fill={color} />
      <path d="M20 11 25 18H15Z" fill="#fff" opacity="0.35" />
    </svg>
  );
}

function Slots({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="36" rx="13" ry="2.4" fill="rgba(0,0,0,0.45)" />
      {[
        [7, 7],
        [21, 7],
        [7, 21],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="12" height="12" rx="2.5" fill="#2a1e12" stroke="#c9a46a" strokeWidth="1.5" />
      ))}
      <rect x="21" y="21" width="12" height="12" rx="2.5" fill="#3a5a2a" stroke="#9be37a" strokeWidth="1.5" />
      <path d="M27 24v6M24 27h6" stroke="#e8ffd8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The picture for one reward part. */
export function RewardIcon({ part, size = 40 }: { part: RewardPart; size?: number }) {
  switch (part.kind) {
    case "SHARDS":
      return <Shards size={size} />;
    case "GEMS":
      return <StoreGem tone="FREE" size={size * 0.85} />;
    case "PURCHASED_GEMS":
      return <StoreGem tone="PURCHASED" size={size * 0.85} />;
    case "GOLD":
      return <Gold size={size} />;
    case "ITEM":
      return <ItemRune size={size} color={getRarityDefinition(part.rarity).color} />;
    case "INVENTORY_SLOTS":
      return <Slots size={size} />;
    case "SKIN": {
      const skin = getTowerSkinDefinition(part.skinId);
      return skin ? (
        <Tower3DPortrait type={skin.towerType} level={MAX_TOWER_LEVEL} skinId={skin.id} width={size * 1.5} height={size * 1.5} />
      ) : null;
    }
  }
}

/** All parts of a level's reward, the first one big and the rest as small badges. */
export function RewardArt({ reward, size = 40 }: { reward: PassReward; size?: number }) {
  const [main, ...rest] = reward;
  if (!main) return null;
  return (
    <span className="pa-art">
      <span className="pa-main">
        <RewardIcon part={main} size={size} />
      </span>
      {rest.map((p, i) => (
        <span key={i} className="pa-extra">
          <RewardIcon part={p} size={size * 0.5} />
        </span>
      ))}
    </span>
  );
}

/** Rarity glow for the tile around a reward (strongest part wins). */
export function rewardGlow(reward: PassReward): string | null {
  const order = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"];
  let best: string | null = null;
  for (const p of reward) {
    if (p.kind === "ITEM" && (best === null || order.indexOf(p.rarity) > order.indexOf(best))) best = p.rarity;
    if (p.kind === "SKIN") best = best && order.indexOf(best) > 3 ? best : "EPIC";
  }
  return best && best !== "COMMON" ? getRarityDefinition(best as never).color : null;
}

/** The big level medallion on the pass hero. */
export function LevelMedallion({ level, max }: { level: number; max: number }) {
  const pct = Math.max(0, Math.min(1, level / max));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg className="pa-medal" viewBox="0 0 140 140" aria-hidden="true">
      <defs>
        <linearGradient id="pa-md-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.45" stopColor="#d8a040" />
          <stop offset="1" stopColor="#6a400c" />
        </linearGradient>
        <radialGradient id="pa-md-face" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4a3218" />
          <stop offset="1" stopColor="#140c06" />
        </radialGradient>
      </defs>
      {/* star points behind */}
      <path d="M70 2 80 22 102 12 98 36 122 38 106 56 126 70 106 84 122 102 98 104 102 128 80 118 70 138 60 118 38 128 42 104 18 102 34 84 14 70 34 56 18 38 42 36 38 12 60 22Z" fill="url(#pa-md-rim)" opacity="0.9" />
      <circle cx="70" cy="70" r="60" fill="url(#pa-md-face)" stroke="url(#pa-md-rim)" strokeWidth="4" />
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <circle
        className="pa-medal-ring"
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="#ffd06a"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 70 70)"
        style={{ filter: "drop-shadow(0 0 4px rgba(255,208,106,0.8))" }}
      />
    </svg>
  );
}
