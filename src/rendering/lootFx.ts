import type { LootDrop } from "@/config/loot";
import { getItemDefinition } from "@/config/itemDefinitions";
import { RARITY_DEFINITIONS, type Rarity } from "@/config/rarity";
import { LOOT_LABELS } from "./lootLabels";

/**
 * LOOT NO CHÃO — draws what fell on the map: a beam of light in the
 * rarity's colour (taller and brighter the rarer it is), a glowing token on
 * the ground, the item's name floating above it like in Diablo, and after a
 * few seconds the token lifts off and flies to the top of the screen (to
 * your bag). Purely visual — the reward was already granted when it dropped.
 */
const SHOW_MS = 3600;
const FLY_MS = 650;

interface Live {
  drop: LootDrop;
  startMs: number;
}

const RANK: Record<Rarity, number> = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5 };

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class LootFx {
  private live: Live[] = [];
  private lastSeq = 0;

  /** Picks up drops the renderer hasn't shown yet. */
  sync(drops: readonly LootDrop[], nowMs: number): void {
    for (const drop of drops) {
      if (drop.seq <= this.lastSeq) continue;
      this.lastSeq = drop.seq;
      this.live.push({ drop, startMs: nowMs });
    }
    this.live = this.live.filter((l) => nowMs - l.startMs < SHOW_MS + FLY_MS);
  }

  /** Light sources for the night lighting pass. */
  lights(nowMs: number): { x: number; y: number; r: number; rgb: [number, number, number]; intensity: number }[] {
    return this.live.map((l) => {
      const hex = RARITY_DEFINITIONS[l.drop.rarity].color;
      const n = parseInt(hex.slice(1), 16);
      const age = nowMs - l.startMs;
      const fade = age > SHOW_MS ? Math.max(0, 1 - (age - SHOW_MS) / FLY_MS) : 1;
      return { x: l.drop.x, y: l.drop.y, r: 50 + RANK[l.drop.rarity] * 14, rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], intensity: 0.6 * fade };
    });
  }

  draw(ctx: CanvasRenderingContext2D, nowMs: number, topY: number): void {
    if (this.live.length === 0) return;
    for (const l of this.live) this.drawOne(ctx, l, nowMs, topY);
  }

  private drawOne(ctx: CanvasRenderingContext2D, l: Live, nowMs: number, topY: number): void {
    const { drop } = l;
    const def = RARITY_DEFINITIONS[drop.rarity];
    const rank = RANK[drop.rarity];
    const age = nowMs - l.startMs;
    // pop in: the token falls a short way and bounces once
    const fall = Math.min(1, age / 380);
    const bounce = fall < 1 ? -(1 - fall) * 26 : -Math.abs(Math.sin(Math.min(1, (age - 380) / 260) * Math.PI)) * 5;
    let x = drop.x;
    let y = drop.y + bounce;
    let alpha = Math.min(1, age / 120);
    let flying = 0;
    if (age > SHOW_MS) {
      flying = Math.min(1, (age - SHOW_MS) / FLY_MS);
      const e = flying * flying;
      x = drop.x + (500 - drop.x) * e * 0.15;
      y = drop.y + (topY - drop.y) * e;
      alpha = 1 - flying * 0.6;
    }
    const pulse = 0.85 + 0.15 * Math.sin(nowMs / 180 + drop.seq);

    ctx.save();
    // the beam (rarer = taller and brighter), only while it rests on the ground
    if (flying === 0) {
      const h = 70 + rank * 32;
      const w = 7 + rank * 2.5;
      const beamA = Math.min(1, age / 250) * (0.35 + rank * 0.1) * pulse;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(0, drop.y - h, 0, drop.y);
      g.addColorStop(0, rgba(def.color, 0));
      g.addColorStop(0.7, rgba(def.color, beamA * 0.6));
      g.addColorStop(1, rgba(def.color, beamA));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(drop.x - w * 0.25, drop.y - h);
      ctx.lineTo(drop.x + w * 0.25, drop.y - h);
      ctx.lineTo(drop.x + w / 2, drop.y);
      ctx.lineTo(drop.x - w / 2, drop.y);
      ctx.closePath();
      ctx.fill();
      // glow pool on the ground
      const pool = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, 22 + rank * 5);
      pool.addColorStop(0, rgba(def.color, 0.45 * pulse));
      pool.addColorStop(1, rgba(def.color, 0));
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, 22 + rank * 5, (22 + rank * 5) * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // the token: a faceted gem for items, a small cluster for shards
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(x, y);
    const s = (drop.kind === "item" ? 7 : 5) * (1 - flying * 0.4);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 10 + rank * 2;
    const drawGem = (ox: number, oy: number, k: number) => {
      ctx.beginPath();
      ctx.moveTo(ox, oy - s * 1.3 * k);
      ctx.lineTo(ox + s * k, oy);
      ctx.lineTo(ox, oy + s * 0.9 * k);
      ctx.lineTo(ox - s * k, oy);
      ctx.closePath();
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(ox, oy - s * 1.3 * k);
      ctx.lineTo(ox + s * 0.45 * k, oy - s * 0.15 * k);
      ctx.lineTo(ox - s * 0.2 * k, oy - s * 0.1 * k);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 10 + rank * 2;
    };
    if (drop.kind === "item") drawGem(0, 0, 1);
    else {
      drawGem(-4, 1, 0.7);
      drawGem(4, 2, 0.6);
      drawGem(0, -2, 0.8);
    }
    ctx.restore();

    // the name over it, Diablo style: rarity-coloured text on a dark plate
    if (flying < 0.2) {
      const label = lootLabel(drop);
      ctx.globalAlpha = Math.min(1, age / 200) * (1 - flying * 5);
      ctx.font = `700 ${11 + Math.min(rank, 3)}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(label).width;
      const ly = drop.y - 24 - (rank >= 3 ? 6 : 0);
      ctx.fillStyle = "rgba(8,6,4,0.78)";
      ctx.fillRect(drop.x - tw / 2 - 6, ly - 9, tw + 12, 18);
      ctx.strokeStyle = rgba(def.color, 0.55);
      ctx.lineWidth = 1;
      ctx.strokeRect(drop.x - tw / 2 - 6 + 0.5, ly - 9 + 0.5, tw + 11, 17);
      ctx.fillStyle = def.color;
      ctx.fillText(label, drop.x, ly + 0.5);
    }
    ctx.restore();
  }
}

function lootLabel(drop: LootDrop): string {
  const L = LOOT_LABELS();
  if (drop.kind === "shards") return L.shards(drop.amount);
  const def = drop.itemDefinitionId ? getItemDefinition(drop.itemDefinitionId) : null;
  return def ? L.item(def.i18nKey) : L.unknown;
}
