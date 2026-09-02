import type { TowerInstance } from "@/entities/Tower";
import type { EnemyInstance } from "@/entities/Enemy";
import type { ProjectileInstance } from "@/entities/Projectile";
import { getTowerStats } from "@/entities/Tower";
import { ENEMY_THEME, STATUS_COLORS, TOWER_THEME } from "./theme";
import { drawContactShadow, drawMagicCore, rimHighlight } from "./lighting";

/**
 * Each tower/enemy is drawn as several layered shapes with a thematic
 * identity (Phase 2 spec section 6/8) instead of one colored circle.
 * Level growth (towers) reads through scale + glow intensity + particle
 * density rather than a redesign per level, per the Phase 1 agreement
 * that assets can be swapped for real art later without touching engine
 * code — everything here only reads TowerInstance/EnemyInstance data.
 */

// ---------------------------------------------------------------------------
// Towers.
// ---------------------------------------------------------------------------

export function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: TowerInstance,
  selected: boolean,
  timeMs: number,
  attackFlashMs = Infinity,
): void {
  const stats = getTowerStats(tower);
  const theme = TOWER_THEME[tower.type];
  const growth = 1 + (stats.level - 1) * 0.09; // subtle scale growth per level
  const cooldownTotalMs = 1000 / stats.attackSpeed;
  const readiness = 1 - Math.max(0, Math.min(1, tower.cooldownRemainingMs / cooldownTotalMs));

  ctx.save();
  ctx.translate(tower.position.x, tower.position.y);
  ctx.scale(growth, growth);

  if (tower.type !== "IRONWOOD") drawPlinth(ctx);

  switch (tower.type) {
    case "IRONWOOD":
      drawIronwood(ctx, theme, stats.level, timeMs, attackFlashMs, readiness);
      break;
    case "INFERNO":
      drawInferno(ctx, theme, stats.level, timeMs);
      break;
    case "FROSTBORN":
      drawFrostborn(ctx, theme, stats.level, timeMs);
      break;
    case "STORMCALLER":
      drawStormcaller(ctx, theme, stats.level, timeMs);
      break;
  }

  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.translate(tower.position.x, tower.position.y);
    ctx.strokeStyle = "#ffe9a8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27 * growth, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Small, unobtrusive level badge — the main "it got stronger" signal is
  // the scale/glow growth above; this just gives an exact number on demand.
  ctx.save();
  ctx.translate(tower.position.x + 17 * growth, tower.position.y + 18 * growth);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(43,29,18,0.88)";
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#fdf6e8";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(stats.level), 0, 0.5);
  ctx.restore();
}

function drawPlinth(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 15, 19, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function glowBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * PREMIUM TIER — Visual Design System proof piece. Rebuilt again per the
 * "world needs personality" direction: the old round timber deck + gazebo
 * canopy + chibi archer read as a toy watchtower. This is a heavy siege
 * structure instead — a gnarled, iron-banded trunk mounting a ballista,
 * with a small hooded operator crouched behind it (part of the machine,
 * not the focal point). Silhouette is deliberately horizontal (the swept
 * ballista arms) so it reads distinctly from the other three towers'
 * vertical silhouettes even before it fires.
 *
 * `readiness` (0 = just fired, 1 = fully charged) comes straight from the
 * tower's real cooldown state, so the bow visibly draws tighter as the
 * next shot approaches — no guessing, no separate animation clock.
 * `attackFlashMs` is milliseconds since the last actual shot (detected by
 * the renderer from a cooldown reset) and drives the short release flash
 * + recoil kick, independent of the slower charging tell.
 */
export function drawIronwood(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["IRONWOOD"],
  level: number,
  timeMs: number,
  attackFlashMs: number,
  readiness: number,
): void {
  drawContactShadow(ctx, 20, 9, 0.42);

  // --- Gnarled root base — an irregular mound, not a clean ellipse. ---
  const baseGradient = ctx.createLinearGradient(-16, -8, 15, 10);
  baseGradient.addColorStop(0, "#6b5636");
  baseGradient.addColorStop(1, "#221a10");
  ctx.fillStyle = baseGradient;
  ctx.beginPath();
  ctx.moveTo(-18, 6);
  ctx.lineTo(-15, -3);
  ctx.lineTo(-6, -8);
  ctx.lineTo(4, -7);
  ctx.lineTo(15, -3);
  ctx.lineTo(18, 6);
  ctx.lineTo(9, 10);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#150e07";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-15, -3);
      ctx.lineTo(-6, -8);
      ctx.lineTo(4, -7);
    },
    "#c9a878",
    1,
    0.4,
  );
  // Moss patches — this structure grew out of the ground, it wasn't built on top of it.
  ctx.fillStyle = "rgba(110,140,60,0.4)";
  ctx.beginPath();
  ctx.ellipse(-8, 4, 4, 2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, 5, 3, 1.7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Root tendrils reaching into the terrain around it.
  ctx.strokeStyle = "#221a10";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-17, 4);
  ctx.quadraticCurveTo(-23, 8, -27, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.quadraticCurveTo(22, 9, 26, 7);
  ctx.stroke();

  // --- Trunk: thick, twisted, wrapped in iron bands. ---
  const sway = Math.sin(timeMs / 2200) * 0.022;
  ctx.save();
  ctx.rotate(sway);

  const trunkGradient = ctx.createLinearGradient(-8, -32, 7, 0);
  trunkGradient.addColorStop(0, "#8a6f47");
  trunkGradient.addColorStop(0.5, "#4a3a24");
  trunkGradient.addColorStop(1, "#1e160c");
  ctx.fillStyle = trunkGradient;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.quadraticCurveTo(-10, -15, -5, -32 - level * 0.6);
  ctx.lineTo(5, -32 - level * 0.6);
  ctx.quadraticCurveTo(10, -15, 6, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#150e07";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(20,14,7,0.45)";
  ctx.lineWidth = 0.8;
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    ctx.beginPath();
    ctx.moveTo(x * 0.85, -1);
    ctx.lineTo(x, -30 - level * 0.6);
    ctx.stroke();
  }

  // Iron reinforcement bands — a visibly different material from the bark.
  for (const bandY of [-9, -20 - level * 0.4]) {
    ctx.fillStyle = "#33363a";
    ctx.fillRect(-8.5, bandY, 17, 3);
    ctx.fillStyle = "rgba(215,220,225,0.35)";
    ctx.fillRect(-8.5, bandY, 17, 1);
    ctx.fillStyle = "#161719";
    ctx.fillRect(-8.5, bandY + 2, 17, 1);
  }

  // Carved rune — the only strong saturated color on the whole structure,
  // brighter with level (spec: cada tipo identificável, poder visível).
  const runeGlow = 0.3 + Math.min(level, 5) * 0.11 + 0.15 * Math.sin(timeMs / 500);
  glowBlob(ctx, 0, -15, 9 + level * 0.6, theme.glow);
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = runeGlow;
  ctx.beginPath();
  ctx.moveTo(0, -18.5);
  ctx.lineTo(2.2, -14.5);
  ctx.lineTo(-2.2, -14.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- Ballista mount: heavy, horizontal silhouette — the tower's identity. ---
  const mountY = -34 - level * 0.6;
  const firing = attackFlashMs < 160;
  const recoil = firing ? 1 - attackFlashMs / 160 : 0;
  const releaseFlash = attackFlashMs < 90 ? 1 - attackFlashMs / 90 : 0;
  const drawTension = 0.3 + Math.max(0, Math.min(1, readiness)) * 0.8;

  ctx.save();
  ctx.translate(0, mountY);

  ctx.fillStyle = "#241a10";
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-recoil * 2.2, recoil * 0.4);

  const armSpread = 18 + level * 0.8;
  const armCurve = 6 + drawTension * 3;
  ctx.strokeStyle = "#4a3a24";
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-armSpread * 0.65, -armCurve, -armSpread + drawTension * 4, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(armSpread * 0.65, -armCurve, armSpread - drawTension * 4, 2);
  ctx.stroke();
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-armSpread * 0.65, -armCurve, -armSpread + drawTension * 4, 2);
    },
    "#c9a878",
    1,
    0.4,
  );

  // Taut string, pulled back toward the operator as tension builds.
  const stringPullback = 9 * drawTension;
  ctx.strokeStyle = "rgba(225,215,195,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-armSpread + drawTension * 4, 2);
  ctx.lineTo(0, 3 + stringPullback);
  ctx.lineTo(armSpread - drawTension * 4, 2);
  ctx.stroke();

  if (releaseFlash > 0) {
    ctx.save();
    ctx.globalAlpha = releaseFlash;
    drawMagicCore(ctx, 0, 3 + stringPullback, 8 * releaseFlash, theme.accent);
    ctx.restore();
  } else if (readiness > 0.92) {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 220);
    ctx.fillStyle = STATUS_COLORS.readyPulse;
    ctx.globalAlpha = 0.35 + 0.5 * pulse;
    ctx.beginPath();
    ctx.arc(0, 3 + stringPullback, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Loading mechanism — a solid block, gives the mount weight/mass.
  const mechGradient = ctx.createLinearGradient(-3, -3, 3, 6);
  mechGradient.addColorStop(0, "#5a4a34");
  mechGradient.addColorStop(1, "#241a10");
  ctx.fillStyle = mechGradient;
  ctx.fillRect(-3.2, -2, 6.4, 7);
  ctx.strokeStyle = "#150e07";
  ctx.lineWidth = 1;
  ctx.strokeRect(-3.2, -2, 6.4, 7);

  ctx.restore();

  // --- Hooded operator, crouched behind the mechanism — small, part of
  // the structure rather than the tower's focal point. No visible face:
  // just a dark hood with two glowing points, more ominous than a face. ---
  ctx.save();
  ctx.translate(0, 7);
  ctx.scale(0.68, 0.68);
  const breath = 1 + Math.sin(timeMs / 900) * 0.025;
  ctx.scale(1, breath);

  const cloakGradient = ctx.createLinearGradient(-5, -7, 5, 6);
  cloakGradient.addColorStop(0, "#4a3a24");
  cloakGradient.addColorStop(1, "#1a1309");
  ctx.fillStyle = cloakGradient;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-1.6, -3);
  ctx.lineTo(-2.6, 5);
  ctx.moveTo(1.7, -2);
  ctx.lineTo(2.7, 5);
  ctx.stroke();

  ctx.fillStyle = "#100b05";
  ctx.beginPath();
  ctx.arc(0, -9, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(timeMs / 260);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(-1.1, -9, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1.1, -9, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.restore();
}

function drawInferno(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["INFERNO"],
  level: number,
  timeMs: number,
): void {
  // Round stone furnace ring.
  const stoneGradient = ctx.createRadialGradient(-3, -4, 2, 0, 0, 18);
  stoneGradient.addColorStop(0, "#8a7a62");
  stoneGradient.addColorStop(1, theme.secondary);
  ctx.fillStyle = stoneGradient;
  ctx.beginPath();
  ctx.ellipse(0, 4, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a2410";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glowing cracks across the stone.
  ctx.strokeStyle = `rgba(255,140,50,${0.5 + 0.3 * Math.sin(timeMs / 260)})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-11, 3);
  ctx.lineTo(-4, 6);
  ctx.moveTo(9, 1);
  ctx.lineTo(13, 6);
  ctx.stroke();

  // Furnace opening.
  const openingGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
  openingGlow.addColorStop(0, "#fff0c0");
  openingGlow.addColorStop(0.5, theme.primary);
  openingGlow.addColorStop(1, theme.secondary);
  ctx.fillStyle = openingGlow;
  ctx.beginPath();
  ctx.ellipse(0, 1, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  glowBlob(ctx, 0, -14, 17 + level * 1.4, theme.glow);

  // Flickering flame plume.
  const flicker = Math.sin(timeMs / 140) * 2.4;
  ctx.fillStyle = theme.primary;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.quadraticCurveTo(-7 + flicker, -18, 0, -30 - level * 1.2);
  ctx.quadraticCurveTo(7 - flicker, -18, 6, -2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(-3, -4);
  ctx.quadraticCurveTo(-3.5 + flicker * 0.6, -16, 0, -24 - level * 0.8);
  ctx.quadraticCurveTo(3.5 - flicker * 0.6, -16, 3, -4);
  ctx.closePath();
  ctx.fill();

  // Smoke wisps drifting up and away.
  ctx.fillStyle = "rgba(140,130,120,0.28)";
  for (let i = 0; i < 2; i++) {
    const cycle = (timeMs / 2200 + i * 0.5) % 1;
    ctx.beginPath();
    ctx.arc(4 + i * 3 + cycle * 6, -26 - cycle * 16, 3 + cycle * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rising embers.
  ctx.fillStyle = "rgba(255,180,90,0.85)";
  for (let i = 0; i < 3 + Math.min(level, 3); i++) {
    const cycle = (timeMs / 900 + i * 0.33) % 1;
    const y = -8 - cycle * 26;
    const x = Math.sin(timeMs / 500 + i * 2) * (4 + cycle * 5);
    ctx.globalAlpha = 1 - cycle;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFrostborn(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["FROSTBORN"],
  level: number,
  timeMs: number,
): void {
  ctx.fillStyle = "rgba(180,225,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hexagonal ice pedestal.
  const pedestalGradient = ctx.createLinearGradient(0, 6, 0, -6);
  pedestalGradient.addColorStop(0, "#5a92b8");
  pedestalGradient.addColorStop(1, "#a8dcf5");
  ctx.fillStyle = pedestalGradient;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(angle) * 15;
    const py = Math.sin(angle) * 9 + 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  glowBlob(ctx, 0, -16, 17 + level * 1.3, theme.glow);

  // Central spire + two smaller flanking crystals, taller with level.
  const crystalHeight = 22 + level * 2;
  drawCrystalShard(ctx, 0, -crystalHeight, 8, theme);
  drawCrystalShard(ctx, -9, -8 - level * 1.2, 5, theme);
  drawCrystalShard(ctx, 9, -8 - level * 1.2, 5, theme);

  // A small shard orbiting the cluster.
  const orbitAngle = timeMs / 1400;
  const ox = Math.cos(orbitAngle) * 13;
  ctx.save();
  ctx.translate(ox, -12 + Math.sin(orbitAngle) * 4);
  ctx.rotate(orbitAngle * 2);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(1.6, 0);
  ctx.lineTo(0, 3);
  ctx.lineTo(-1.6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Sparkle twinkles.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 2 + Math.min(level, 3); i++) {
    const twinkle = (Math.sin(timeMs / 300 + i * 5) + 1) / 2;
    if (twinkle < 0.7) continue;
    const angle = i * 2.1;
    ctx.globalAlpha = (twinkle - 0.7) / 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 11, -12 + Math.sin(angle) * 9, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCrystalShard(
  ctx: CanvasRenderingContext2D,
  x: number,
  tipY: number,
  width: number,
  theme: (typeof TOWER_THEME)["FROSTBORN"],
): void {
  const baseY = 4;
  const gradient = ctx.createLinearGradient(0, tipY, 0, baseY);
  gradient.addColorStop(0, theme.accent);
  gradient.addColorStop(1, theme.primary);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  ctx.lineTo(x + width, (tipY + baseY) / 2);
  ctx.lineTo(x + width * 0.6, baseY);
  ctx.lineTo(x - width * 0.6, baseY);
  ctx.lineTo(x - width, (tipY + baseY) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawStormcaller(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["STORMCALLER"],
  level: number,
  timeMs: number,
): void {
  // Two-tier stone plinth.
  ctx.fillStyle = "#4a3f30";
  ctx.beginPath();
  ctx.ellipse(0, 7, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a4a38";
  ctx.beginPath();
  ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rune pillar.
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(-6, -26, 12, 30);
  ctx.fillStyle = theme.primary;
  for (let i = 0; i < 3; i++) {
    const bandPulse = 0.4 + 0.4 * Math.sin(timeMs / 500 + i * 1.4);
    ctx.globalAlpha = bandPulse;
    ctx.fillRect(-6, -22 + i * 8, 12, 2.4);
  }
  ctx.globalAlpha = 1;

  const orbY = -32 - level * 1.4;
  glowBlob(ctx, 0, orbY, 16 + level * 1.3, theme.glow);

  // A rotating arcane ring around the orb (drawn as a squashed ellipse for
  // a top-down "ring" read).
  ctx.save();
  ctx.translate(0, orbY);
  ctx.rotate(timeMs / 2000);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, orbY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Crackling arcs jumping between the orb and the pillar top.
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 1.3;
  const arcCount = 2 + Math.min(level, 3);
  for (let i = 0; i < arcCount; i++) {
    const seed = Math.floor(timeMs / 110) + i * 17;
    const jitter = (n: number) => (((n * 9301 + 49297) % 233280) / 233280 - 0.5) * 12;
    ctx.beginPath();
    ctx.moveTo(0, orbY + 5);
    const midX = jitter(seed);
    const midY = orbY + (-24 - orbY) / 2 + jitter(seed + 1) * 0.4;
    ctx.lineTo(midX, midY);
    ctx.lineTo(jitter(seed + 2) * 0.6, -24);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Enemies.
// ---------------------------------------------------------------------------

/**
 * `scale` lets boss/mini-boss enemies (see entities/Enemy.ts `boss` field)
 * reuse the same silhouettes at a larger, more imposing size instead of
 * needing dedicated art for this phase's one boss — CanvasRenderer passes
 * a boss-specific scale + draws an aura ring behind it; every regular
 * enemy call site keeps the default (1) and is visually unchanged.
 */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyInstance,
  timeMs: number,
  hitFlashMs = Infinity,
  scale = 1,
): void {
  const theme = ENEMY_THEME[enemy.type];
  const angle = Math.atan2(enemy.direction.y, enemy.direction.x);

  ctx.save();
  ctx.translate(enemy.position.x, enemy.position.y);
  if (scale !== 1) ctx.scale(scale, scale);

  // Contact shadow is cast in world space, drawn BEFORE the body rotates to
  // face its travel direction — otherwise the shadow would swing around
  // with the enemy at every turn instead of staying anchored to the fixed
  // top-left light source.
  if (enemy.type === "CRAWLER") drawContactShadow(ctx, 10, 4.5, 0.32);

  ctx.save();
  ctx.rotate(angle);
  switch (enemy.type) {
    case "CRAWLER":
      drawCrawler(ctx, theme, timeMs, hitFlashMs);
      break;
    case "RUNNER":
      drawRunner(ctx, theme, timeMs);
      break;
    case "BRUTE":
      drawBrute(ctx, theme);
      break;
    case "SHIELDBEARER":
      drawShieldbearer(ctx, theme);
      break;
    // Four Content Progression archetypes reuse the closest existing
    // silhouette — their own theme color (see theme.ts) plus the
    // type-based scale CanvasRenderer applies is what differentiates them
    // for now, ahead of any bespoke art.
    case "SWARMLING":
      drawCrawler(ctx, theme, timeMs, hitFlashMs);
      break;
    case "REGENERATOR":
      drawBrute(ctx, theme);
      break;
    case "IRONCLAD":
      drawShieldbearer(ctx, theme);
      break;
    case "DISABLER":
      drawRunner(ctx, theme, timeMs);
      break;
  }
  ctx.restore();

  if (enemy.slow) {
    ctx.strokeStyle = "rgba(150,220,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.burn) {
    ctx.strokeStyle = "rgba(255,150,60,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  if (enemy.boss) return; // boss HP is shown in a dedicated top-of-screen banner, not a floating bar.
  if (enemy.type === "CRAWLER") drawHpBarPremium(ctx, enemy);
  else drawHpBar(ctx, enemy);
}

/** Pulsing aura ring behind a boss/mini-boss, drawn before the enemy body so it reads as a glow, not an outline. */
export function drawBossAura(ctx: CanvasRenderingContext2D, enemy: EnemyInstance, timeMs: number): void {
  if (!enemy.boss) return;
  // Enraged (below 30% HP, main boss only — see BossManager) reads through
  // the aura itself: faster pulse, hotter color — no extra state needed,
  // this is derived straight from hp/maxHp the renderer already has.
  const isEnraged = enemy.boss.isMainBoss && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= 0.3;
  const pulseSpeed = isEnraged ? 160 : 400;
  const pulse = 0.55 + 0.25 * Math.sin(timeMs / pulseSpeed);
  const radius = (enemy.boss.isMainBoss ? 30 : 20) * pulse * (isEnraged ? 1.15 : 1);
  const color = isEnraged
    ? "rgba(255,60,20,0.6)"
    : enemy.boss.isMainBoss
      ? "rgba(226,87,74,0.45)"
      : "rgba(255,180,80,0.4)";
  const gradient = ctx.createRadialGradient(
    enemy.position.x,
    enemy.position.y,
    0,
    enemy.position.x,
    enemy.position.y,
    radius,
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(enemy.position.x, enemy.position.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Pulsing golden aura marking an Elite spawn (spec section 5) — a consistent "this one's different" cue independent of its base archetype's own theme color. */
export function drawEliteAura(ctx: CanvasRenderingContext2D, enemy: EnemyInstance, timeMs: number): void {
  if (!enemy.elite) return;
  const pulse = 0.5 + 0.3 * Math.sin(timeMs / 260);
  const radius = 22 * pulse;
  const gradient = ctx.createRadialGradient(
    enemy.position.x,
    enemy.position.y,
    0,
    enemy.position.x,
    enemy.position.y,
    radius,
  );
  gradient.addColorStop(0, "rgba(255,214,90,0.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(enemy.position.x, enemy.position.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHpBar(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
  const radius = enemy.type === "BRUTE" || enemy.type === "REGENERATOR" ? 13 : enemy.type === "SHIELDBEARER" || enemy.type === "IRONCLAD" ? 11 : 9;
  const hpRatio = Math.max(enemy.hp / enemy.maxHp, 0);
  const barWidth = radius * 2.2;
  const barX = enemy.position.x - barWidth / 2;
  const barY = enemy.position.y - radius - 8;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(barX, barY, barWidth, 4);
  ctx.fillStyle = hpRatio > 0.4 ? "#7be07b" : "#e05a5a";
  ctx.fillRect(barX, barY, barWidth * hpRatio, 4);
}

/**
 * PREMIUM TIER (Etapa 4 proof) — rounded, gradient-filled bar using the
 * Design System's exclusive status colors (never reused as a body/material
 * color elsewhere), so HP reads as a distinct state signal at a glance,
 * including while the enemy is moving (drawn unrotated, always upright).
 */
function drawHpBarPremium(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
  const radius = 9;
  const hpRatio = Math.max(enemy.hp / enemy.maxHp, 0);
  const barWidth = radius * 2.4;
  const barHeight = 4.2;
  const barX = enemy.position.x - barWidth / 2;
  const barY = enemy.position.y - radius - 9;
  const fillColor =
    hpRatio > 0.6 ? STATUS_COLORS.hpHealthy : hpRatio > 0.3 ? STATUS_COLORS.hpWounded : STATUS_COLORS.hpCritical;

  const r = barHeight / 2;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundedRect(ctx, barX + 0.6, barY + 1, barWidth, barHeight, r);
  ctx.fill();

  ctx.fillStyle = STATUS_COLORS.hpTrack;
  roundedRect(ctx, barX, barY, barWidth, barHeight, r);
  ctx.fill();

  if (hpRatio > 0) {
    const fillGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    fillGradient.addColorStop(0, fillColor);
    fillGradient.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.save();
    roundedRect(ctx, barX, barY, barWidth, barHeight, r);
    ctx.clip();
    ctx.fillStyle = fillGradient;
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(20,14,8,0.6)";
  ctx.lineWidth = 0.8;
  roundedRect(ctx, barX, barY, barWidth, barHeight, r);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * PREMIUM TIER — Visual Design System proof piece. Rebuilt again per the
 * "eliminate the mascote/toy feeling" direction: the old smooth ellipse
 * body + one big cute eye read as a friendly bug. This is an angular,
 * jagged carapace instead — dorsal spikes, forward mandibles, a cluster
 * of small glowing eyes (alien, not cute), and sharp-jointed legs. Dark
 * oily chitin carries almost no color; the only saturated color is the
 * toxic-green glow at the eyes/mandible tips/joints, so the danger reads
 * through light, not through a friendly palette.
 */
export function drawCrawler(
  ctx: CanvasRenderingContext2D,
  theme: (typeof ENEMY_THEME)["CRAWLER"],
  timeMs: number,
  hitFlashMs: number,
  /**
   * Scales mandible/eye motion beyond the normal gameplay idle — gameplay
   * callers never pass this (default 1 = unchanged), so combat feel is
   * untouched. Decorative contexts (the main menu hero scene) can push
   * this above 1 for a more aggressive, restless idle without a second
   * copy of the draw code.
   */
  intensity = 1,
): void {
  const legPhase = Math.sin(timeMs / 110);
  const bob = Math.sin(timeMs / 220) * 0.4;
  const mandibleTwitch = Math.sin(timeMs / (260 / intensity)) * 0.15 * intensity;
  const hitFlash = hitFlashMs < 120 ? 1 - hitFlashMs / 120 : 0;

  ctx.save();
  ctx.translate(0, bob);

  // Legs — sharp-jointed (elbowed), not smooth curves: reads as scuttling, not walking.
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const kneeX = i * 3 + legPhase * side * 0.6;
      const kneeY = side * 6.5;
      const footX = i * 3 + legPhase * side;
      const footY = side * (9 + Math.abs(legPhase) * 2.2);
      ctx.beginPath();
      ctx.moveTo(i * 2.6, side * 4.5);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
    }
  }

  // Body — an elongated, angular carapace (not an ellipse): jagged silhouette front-to-back.
  const bodyGradient = ctx.createLinearGradient(-4, -3, 6, 4);
  bodyGradient.addColorStop(0, theme.accent);
  bodyGradient.addColorStop(0.35, theme.body);
  bodyGradient.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(6, -5.5);
  ctx.lineTo(-2, -6.5);
  ctx.lineTo(-9, -3.5);
  ctx.lineTo(-10.5, 0);
  ctx.lineTo(-9, 3.5);
  ctx.lineTo(-2, 6.5);
  ctx.lineTo(6, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(6, -5.5);
      ctx.lineTo(-2, -6.5);
      ctx.lineTo(-9, -3.5);
    },
    theme.accent,
    0.8,
    0.3,
  );

  // Dorsal spikes along the back ridge — the silhouette cue that reads
  // "dangerous" even in a small on-screen size.
  ctx.fillStyle = theme.dark;
  for (const [bx, by, h] of [
    [-6, -5.2, 4.5],
    [-1, -6.4, 5.5],
    [4, -5.5, 4.5],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(bx - 1.6, by);
    ctx.lineTo(bx, by - h);
    ctx.lineTo(bx + 1.6, by);
    ctx.closePath();
    ctx.fill();
  }

  // Mandibles — reaching forward, twitching, an explicit threat cue absent before.
  ctx.save();
  ctx.translate(9, 0);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -1.5);
  ctx.quadraticCurveTo(4, -3.5 - mandibleTwitch, 5.5, -1 - mandibleTwitch);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 1.5);
  ctx.quadraticCurveTo(4, 3.5 + mandibleTwitch, 5.5, 1 + mandibleTwitch);
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(5.5, -1 - mandibleTwitch, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(5.5, 1 + mandibleTwitch, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Eye cluster — several small glowing points instead of one cute round
  // eye: reads as alien/insectile rather than a mascot's face.
  const eyeFlicker = 0.65 + 0.35 * Math.sin(timeMs / (300 / intensity));
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = Math.min(1, eyeFlicker * (0.85 + 0.15 * intensity));
  for (const [ex, ey, er] of [
    [4.5, -2, 1.1],
    [5.5, 0, 1.3],
    [4.5, 2, 1.1],
    [2, -3.2, 0.7],
    [2, 3.2, 0.7],
  ] as const) {
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  if (hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = hitFlash * 0.85;
    ctx.fillStyle = STATUS_COLORS.hitFlash;
    ctx.beginPath();
    ctx.ellipse(0, bob, 10.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRunner(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["RUNNER"], timeMs: number): void {
  ctx.strokeStyle = `rgba(217,194,70,${0.35 + 0.15 * Math.sin(timeMs / 80)})`;
  ctx.lineWidth = 1.4;
  for (const offset of [-3, 0, 3]) {
    ctx.beginPath();
    ctx.moveTo(-6, offset);
    ctx.lineTo(-13, offset * 1.4);
    ctx.stroke();
  }

  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(6, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrute(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["BRUTE"]): void {
  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.ellipse(-2, -7, 6, 3.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2, 7, 6, 3.5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Riveted chest plate — armored bulk, not just a bigger blob.
  ctx.fillStyle = "#8a8272";
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, -5);
  ctx.lineTo(4, 6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.dark;
  for (const [px, py] of [
    [-4, -3],
    [3, -2],
    [-2, 3],
    [2, 4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px, py, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(13, -3);
  ctx.lineTo(19, 0);
  ctx.lineTo(13, 3);
  ctx.closePath();
  ctx.fill();
}

function drawShieldbearer(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["SHIELDBEARER"]): void {
  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 8, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Large shield facing the direction of travel.
  const shieldGradient = ctx.createLinearGradient(6, -9, 6, 9);
  shieldGradient.addColorStop(0, theme.accent);
  shieldGradient.addColorStop(1, theme.dark);
  ctx.fillStyle = shieldGradient;
  ctx.beginPath();
  ctx.moveTo(4, -9);
  ctx.lineTo(11, -5);
  ctx.lineTo(11, 5);
  ctx.lineTo(4, 9);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(-4, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(-4, -1.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Projectiles / attack effects.
// ---------------------------------------------------------------------------

export function drawProjectile(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance): void {
  const progress = 1 - projectile.remainingMs / projectile.totalMs;
  const theme = TOWER_THEME[projectile.towerType];

  if (projectile.towerType === "IRONWOOD") {
    drawIronwoodArrow(ctx, projectile, progress);
  } else {
    ctx.save();
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 1 - progress * 0.35;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 6;

    drawImpactLine(ctx, projectile.from, projectile.to);

    let originForChain = projectile.to;
    for (const target of projectile.chainTargets) {
      drawImpactLine(ctx, originForChain, target);
      originForChain = target;
    }

    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = Math.max(1 - progress * 1.4, 0);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(projectile.to.x, projectile.to.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawImpactLine(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function quadPoint(p0: number, p1: number, p2: number, t: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

/**
 * PREMIUM TIER — a lofted, curved arrow arc for the Ironwood proof piece
 * (spec: "trails curvos"), replacing the shared straight impact-line used
 * by the other three towers. Fading trail behind a rotated arrow head that
 * tracks the curve's tangent, so it visibly flies rather than teleports.
 */
function drawIronwoodArrow(
  ctx: CanvasRenderingContext2D,
  projectile: ProjectileInstance,
  progress: number,
): void {
  const { from, to } = projectile;
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const arcHeight = Math.min(16, dist * 0.2);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - arcHeight;

  const currentX = quadPoint(from.x, midX, to.x, progress);
  const currentY = quadPoint(from.y, midY, to.y, progress);
  const tangentX = 2 * (1 - progress) * (midX - from.x) + 2 * progress * (to.x - midX);
  const tangentY = 2 * (1 - progress) * (midY - from.y) + 2 * progress * (to.y - midY);
  const angle = Math.atan2(tangentY, tangentX);

  ctx.save();
  const trailGradient = ctx.createLinearGradient(from.x, from.y, currentX, currentY);
  trailGradient.addColorStop(0, "rgba(212,247,154,0)");
  trailGradient.addColorStop(1, "rgba(212,247,154,0.6)");
  ctx.strokeStyle = trailGradient;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, currentX, currentY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.rotate(angle);
  ctx.strokeStyle = "#5a3f22";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(3, 0);
  ctx.stroke();
  ctx.fillStyle = "#e8e0c8";
  ctx.beginPath();
  ctx.moveTo(4.5, 0);
  ctx.lineTo(1, -1.7);
  ctx.lineTo(1, 1.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#c9b790";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-8.5, -2.2);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-8.5, 2.2);
  ctx.stroke();
  ctx.restore();
}
