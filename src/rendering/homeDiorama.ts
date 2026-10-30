import type { EnemyInstance } from "@/entities/Enemy";
import { advanceEnemy, applyBurn, applySlow, createEnemyInstance } from "@/entities/Enemy";
import { createTowerInstance, getTowerMuzzleOffset, getTowerStats, type TowerInstance } from "@/entities/Tower";
import { createProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { findPrimaryTarget } from "@/engine/CombatSystem";
import { PHASES, type PhaseDefinition } from "@/config/phaseConfig";
import { PRESTIGE_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";
import type { TowerType } from "@/config/towerStats";
import { getCreatureVfxProfile } from "@/config/creatureVfxProfile";
import { getMapLayout, setActiveMapLayout, type MapLayout } from "@/data/mapLayouts";
import { roadCoverage } from "@/engine/MapDeployment";
import { distance, type Vector2 } from "@/utils/geometry";
import { getBiome } from "./biomes";
import { drawBakedGround, getGroundBake } from "./groundBakes";
import { drawRealisticAtmosphere } from "./atmosphere";
import { emergenceProgress, PORTAL_PATH_DISTANCE } from "./riftPortal";
import { pruneTowerAims, steerTowerAim } from "./towerSprites";
import { preloadSpriteBiome, setSpriteBiome } from "./enemySprites";
import { drawBackground, drawDecorations, drawPath, drawPathEndpoints, drawSlot, getPortalAnchor, type VisibleBounds } from "./MapRenderer";
import { drawEnemy, drawProjectile, drawTower } from "./EntityRenderer";
import { ARCHETYPE_VISUAL_SCALE, ENEMY_DISPLAY_SCALE } from "./theme";
import { VfxManager } from "./vfx";

/**
 * HOME SCREEN LIVE SCENE — the title screen's backdrop is the real game:
 * a biome's baked battlefield, the castle and the rift, a line of towers
 * (high levels, rotating through the real skins) and that biome's own
 * creatures climbing out of the rift and being shot down. Everything is
 * drawn with the exact renderers the battle uses; only the "simulation" is
 * a tiny scripted stand-in (fixed hits-to-kill, no gold, no save, no
 * GameEngine), so the Home screen can never touch the player's progress.
 */

/** Phases the scene rotates through — one per scene, in this order. */
export const SHOWCASE_PHASE_IDS = [
  "ANCIENT_FOREST",
  "VOLCANIC_WASTES",
  "FROZEN_TUNDRA",
  "LOST_SUN_TEMPLE",
  "CRYSTAL_SEA",
  "MOON_GARDENS",
  "DEFILED_CATHEDRAL",
  "LEVIATHAN_COAST",
] as const;

export const SCENE_DURATION_MS = 14000;
const FADE_MS = 650;
const MAX_ALIVE = 14;
const SHOWCASE_RANGE = 150;

/** Tower type + level for the showcase line-up (placed on each map's best visible sites; skins rotate). */
const LINEUP: readonly { type: TowerType; level: number }[] = [
  { type: "IRONWOOD", level: 60 },
  { type: "FROSTBORN", level: 60 },
  { type: "INFERNO", level: 52 },
  { type: "STORMCALLER", level: 57 },
  { type: "IRONWOOD", level: 44 },
  { type: "STORMCALLER", level: 36 },
  { type: "INFERNO", level: 41 },
  { type: "FROSTBORN", level: 31 },
];

/** The sites the showcase towers use on a map: the ones covering the most road, preferring the right side (the left is under the title). */
function showcaseSites(layout: MapLayout) {
  return [...layout.sites]
    .map((site) => ({ site, score: roadCoverage(layout, site.position, 190).fraction * (site.position.x > 330 ? 1.6 : 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LINEUP.length)
    .map((s) => s.site);
}

/** Readable firing rhythm for the showcase (ms between shots), independent of real attack speed. */
const FIRE_INTERVAL_MS: Record<TowerType, number> = { IRONWOOD: 820, INFERNO: 1350, FROSTBORN: 1500, STORMCALLER: 1750 };

const SKINS_BY_TYPE: Record<TowerType, readonly (string | null)[]> = (() => {
  const all = [...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS];
  const by = (type: TowerType) => [null, ...all.filter((s) => s.towerType === type).map((s) => s.id)];
  return { IRONWOOD: by("IRONWOOD"), INFERNO: by("INFERNO"), FROSTBORN: by("FROSTBORN"), STORMCALLER: by("STORMCALLER") };
})();

export function showcasePhase(sceneIndex: number): PhaseDefinition {
  const id = SHOWCASE_PHASE_IDS[((sceneIndex % SHOWCASE_PHASE_IDS.length) + SHOWCASE_PHASE_IDS.length) % SHOWCASE_PHASE_IDS.length]!;
  return PHASES.find((p) => p.id === id) ?? PHASES[0]!;
}

interface Death {
  enemy: EnemyInstance;
  start: number;
  scale: number;
  tip: 1 | -1;
}

interface Shot {
  projectile: ProjectileInstance;
  targetId: string;
  towerType: TowerType;
  from: Vector2;
}

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function enemyScale(enemy: EnemyInstance): number {
  return ENEMY_DISPLAY_SCALE * (ARCHETYPE_VISUAL_SCALE[enemy.type] ?? 1);
}

export class HomeDiorama {
  private sceneIndex = 0;
  private phase: PhaseDefinition = showcasePhase(0);
  private towers: TowerInstance[] = [];
  private enemies: EnemyInstance[] = [];
  private hitsLeft = new Map<string, number>();
  private hitsTotal = new Map<string, number>();
  private shots: Shot[] = [];
  private deaths: Death[] = [];
  private lastFire = new Map<string, number>();
  private lastAttack = new Map<string, number>();
  private lastHit = new Map<string, number>();
  private heading = new Map<string, number>();
  private vfx = new VfxManager();
  private nextSpawnAt = 0;
  private spawnCount = 0;
  private sceneStart = 0;
  /** Scene waiting to be shown once the current one has faded out. */
  private pendingScene: number | null = null;
  private fadeOutStart: number | null = null;
  private layout: MapLayout = getMapLayout("ANCIENT_FOREST");
  private portalAnchor = getPortalAnchor(this.layout.path);

  constructor(now: number, sceneIndex = 0) {
    this.loadScene(sceneIndex, now);
  }

  /** Cross to another scene (fades out, swaps, fades back in). */
  goTo(sceneIndex: number, now: number): void {
    if (sceneIndex === this.sceneIndex && this.pendingScene === null) return;
    this.pendingScene = sceneIndex;
    if (this.fadeOutStart === null) this.fadeOutStart = now;
    this.preload(sceneIndex);
  }

  private preload(sceneIndex: number): void {
    const biomeId = showcasePhase(sceneIndex).biomeId;
    getGroundBake(biomeId);
    preloadSpriteBiome(biomeId);
  }

  private loadScene(sceneIndex: number, now: number): void {
    this.sceneIndex = sceneIndex;
    this.phase = showcasePhase(sceneIndex);
    this.layout = getMapLayout(this.phase.biomeId);
    setActiveMapLayout(this.layout);
    this.portalAnchor = getPortalAnchor(this.layout.path);
    const sites = showcaseSites(this.layout);
    this.towers = LINEUP.map((entry, i) => {
      const skins = SKINS_BY_TYPE[entry.type];
      const skin = skins[(sceneIndex * 3 + i * 2) % skins.length] ?? null;
      const slot = sites[i % sites.length]!;
      return createTowerInstance(slot.id, entry.type, slot.position, entry.level, null, 0, skin, 0, false);
    });
    pruneTowerAims(new Set(this.towers.map((t) => t.id)));
    this.enemies = [];
    this.hitsLeft.clear();
    this.hitsTotal.clear();
    this.shots = [];
    this.deaths = [];
    this.lastFire.clear();
    this.heading.clear();
    this.vfx = new VfxManager();
    this.sceneStart = now;
    this.nextSpawnAt = now + 250;
    getGroundBake(this.phase.biomeId);
    setSpriteBiome(this.phase.biomeId);
    // Warm up the scene after this one so the cut never shows a placeholder.
    this.preload(sceneIndex + 1);
  }

  private spawn(now: number): void {
    const pool = this.phase.enemyPool;
    const seed = this.spawnCount++ + this.sceneIndex * 101;
    const type = pool[Math.floor(rand(seed) * pool.length)]!;
    const enemy = createEnemyInstance(type, this.phase.startWave + 4);
    this.enemies.push(enemy);
    const weight = getCreatureVfxProfile(type).weight;
    const hits = weight === "HEAVY" ? 10 : 5 + Math.floor(rand(seed + 7) * 4);
    this.hitsLeft.set(enemy.id, hits);
    this.hitsTotal.set(enemy.id, hits);
    this.nextSpawnAt = now + 850 + rand(seed + 3) * 750;
  }

  private kill(enemy: EnemyInstance, now: number): void {
    const profile = getCreatureVfxProfile(enemy.type);
    this.vfx.spawnCreatureDeath(enemy.position, profile.family, profile.weight, enemy.direction);
    this.deaths.push({ enemy: { ...enemy }, start: now, scale: enemyScale(enemy), tip: rand(now) > 0.5 ? 1 : -1 });
    this.enemies = this.enemies.filter((e) => e !== enemy);
    this.hitsLeft.delete(enemy.id);
    this.hitsTotal.delete(enemy.id);
  }

  /** Castle gate position of the map on screen (for camera framing). */
  castlePosition() {
    return this.layout.path[this.layout.path.length - 1]!;
  }

  update(now: number, dt: number): void {
    setActiveMapLayout(this.layout);
    if (this.fadeOutStart !== null && now - this.fadeOutStart >= FADE_MS && this.pendingScene !== null) {
      const next = this.pendingScene;
      this.pendingScene = null;
      this.fadeOutStart = null;
      this.loadScene(next, now);
    }

    if (now >= this.nextSpawnAt && this.enemies.length < MAX_ALIVE) this.spawn(now);

    for (const enemy of [...this.enemies]) {
      const { reachedEnd } = advanceEnemy(enemy, dt);
      if (enemy.hp <= 0) this.kill(enemy, now);
      else if (reachedEnd) {
        this.enemies = this.enemies.filter((e) => e !== enemy);
        this.hitsLeft.delete(enemy.id);
      }
    }

    // Heading smoothing, same feel as the battle renderer.
    for (const enemy of this.enemies) {
      const raw = Math.atan2(enemy.direction.y, enemy.direction.x);
      const prev = this.heading.get(enemy.id);
      if (prev === undefined) {
        this.heading.set(enemy.id, raw);
        continue;
      }
      const diff = Math.atan2(Math.sin(raw - prev), Math.cos(raw - prev));
      const step = 0.009 * dt;
      this.heading.set(enemy.id, prev + Math.max(-step, Math.min(step, diff)));
    }

    const targetable = this.enemies.filter((e) => e.distanceTraveled >= PORTAL_PATH_DISTANCE);
    for (const tower of this.towers) {
      // Capped so each tower guards its own stretch of road and creatures stay
      // alive long enough to be seen crossing the battlefield.
      const range = Math.min(getTowerStats(tower).range, SHOWCASE_RANGE);
      const target = findPrimaryTarget(tower.position, range, targetable);
      if (tower.type === "IRONWOOD") steerTowerAim(tower.id, tower.position, target?.position ?? null, now, dt);
      if (!target) continue;
      const last = this.lastFire.get(tower.id) ?? -Infinity;
      if (now - last < FIRE_INTERVAL_MS[tower.type] * (0.9 + rand(tower.position.x) * 0.2)) continue;
      this.lastFire.set(tower.id, now);
      this.lastAttack.set(tower.id, now);
      const muzzle = getTowerMuzzleOffset(tower);
      const from = { x: tower.position.x + muzzle.x, y: tower.position.y + muzzle.y };
      const chain =
        tower.type === "STORMCALLER"
          ? targetable
              .filter((e) => e !== target && distance(e.position, target.position) < 90)
              .slice(0, 2)
              .map((e) => e.position)
          : [];
      const projectile = createProjectile(tower.type, from, target.position, chain, false, undefined, tower.equippedSkinId);
      this.shots.push({ projectile, targetId: target.id, towerType: tower.type, from });
    }

    for (const shot of this.shots) shot.projectile.remainingMs -= dt;
    const landed = this.shots.filter((s) => s.projectile.remainingMs <= 0);
    this.shots = this.shots.filter((s) => s.projectile.remainingMs > 0);
    for (const shot of landed) {
      const enemy = this.enemies.find((e) => e.id === shot.targetId);
      if (!enemy) continue;
      const left = (this.hitsLeft.get(enemy.id) ?? 1) - 1;
      this.hitsLeft.set(enemy.id, left);
      enemy.hp = Math.max(0, enemy.maxHp * (left / (this.hitsTotal.get(enemy.id) ?? 1)));
      this.lastHit.set(enemy.id, now);
      const dir = { x: enemy.position.x - shot.from.x, y: enemy.position.y - shot.from.y };
      this.vfx.spawnCreatureHit(enemy.position, getCreatureVfxProfile(enemy.type).family, shot.towerType === "IRONWOOD" && left % 2 === 0, dir);
      if (shot.towerType === "FROSTBORN") applySlow(enemy, 0.4, 1400);
      if (shot.towerType === "INFERNO") applyBurn(enemy, 0.0001, 1600);
      if (left <= 0) this.kill(enemy, now);
    }

    this.deaths = this.deaths.filter((d) => now - d.start < 700);
    this.vfx.update(dt);
  }

  /** 0..1 darkness of the scene-change dip. */
  private fadeAmount(now: number): number {
    if (this.fadeOutStart !== null) return Math.min(1, (now - this.fadeOutStart) / FADE_MS);
    return Math.max(0, 1 - (now - this.sceneStart) / FADE_MS);
  }

  /**
   * Draws the scene with the world already transformed by the caller.
   * `bounds` is the visible world rectangle (used by ground/atmosphere).
   */
  draw(ctx: CanvasRenderingContext2D, now: number, bounds: VisibleBounds): void {
    const biome = getBiome(this.phase.biomeId);
    setSpriteBiome(biome.id);
    const bake = getGroundBake(biome.id);
    if (bake) {
      drawBakedGround(ctx, bake, biome, bounds, now);
      drawDecorations(ctx, biome, now, bake.skipKinds);
    } else {
      drawBackground(ctx, biome, bounds);
      drawDecorations(ctx, biome, now);
      drawPath(ctx, this.layout.path, biome, false);
    }
    const emergingIds = this.enemies.filter((e) => emergenceProgress(e.distanceTraveled) < 1).map((e) => e.id);
    drawPathEndpoints(ctx, this.layout.path, biome, now, 1, false, { emergingIds, rimBaked: bake !== null });

    const occupied = new Set(this.towers.map((t) => t.slotId));
    this.layout.sites.forEach((slot, i) => drawSlot(ctx, slot, i, occupied.has(slot.id), false, biome, now, bake !== null));

    // Back-to-front so lower towers overlap the ones behind them.
    for (const tower of [...this.towers].sort((a, b) => a.position.y - b.position.y)) {
      drawTower(ctx, tower, false, now, now - (this.lastAttack.get(tower.id) ?? -Infinity));
    }

    for (const enemy of this.enemies) {
      const scale = enemyScale(enemy);
      const hitMs = now - (this.lastHit.get(enemy.id) ?? -Infinity);
      const angle = this.heading.get(enemy.id);
      const rise = emergenceProgress(enemy.distanceTraveled);
      if (rise < 1) {
        const k = rise * rise * (3 - 2 * rise);
        const a = this.portalAnchor;
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.75 * k;
        ctx.translate(a.x, a.y + (1 - k) * 8);
        ctx.scale(0.55 + 0.45 * k, 0.4 + 0.6 * k);
        ctx.translate(-a.x, -a.y);
        drawEnemy(ctx, { ...enemy, position: a }, now, hitMs, scale, undefined, angle);
        ctx.restore();
      } else {
        drawEnemy(ctx, enemy, now, hitMs, scale, undefined, angle);
      }
    }

    for (const shot of this.shots) drawProjectile(ctx, shot.projectile);

    for (const d of this.deaths) {
      const p = Math.min(1, (now - d.start) / 700);
      const eased = 1 - (1 - p) * (1 - p);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(d.enemy.position.x, d.enemy.position.y);
      ctx.rotate(eased * (Math.PI / 2.1) * d.tip);
      ctx.scale(1, 1 - eased * 0.35);
      ctx.translate(-d.enemy.position.x, -d.enemy.position.y);
      drawEnemy(ctx, d.enemy, d.start, Infinity, d.scale);
      ctx.restore();
    }

    this.vfx.draw(ctx);

    drawRealisticAtmosphere(ctx, biome, now, bounds);

    const fade = this.fadeAmount(now);
    if (fade > 0) {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = "#0d0a07";
      ctx.fillRect(bounds.x0 - 10, bounds.y0 - 10, bounds.x1 - bounds.x0 + 20, bounds.y1 - bounds.y0 + 20);
      ctx.restore();
    }
  }
}
