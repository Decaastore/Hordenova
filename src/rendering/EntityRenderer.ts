import type { TowerInstance } from "@/entities/Tower";
import type { EnemyInstance } from "@/entities/Enemy";
import type { ProjectileInstance } from "@/entities/Projectile";
import { getTowerStats } from "@/entities/Tower";
import { getTowerVisualStage, MAX_TOWER_LEVEL } from "@/config/towerStats";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { ENEMY_THEME, STATUS_COLORS, TOWER_THEME } from "./theme";
import { drawContactShadow, drawMagicCore, rimHighlight } from "./lighting";

/** Total scale gained from Level 1 to MAX_TOWER_LEVEL — kept modest so a maxed tower still reads bigger without dwarfing the map or the base. */
const TOWER_MAX_GROWTH = 0.35;

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
  // Tower Skin architecture (Progression 2.0 spec section 10/11): a skin
  // only ever overrides these 4 palette fields, merged over the base
  // theme right here — nothing downstream (combat, stats, save) ever sees
  // or reads a skin, so equipping one is structurally incapable of
  // touching gameplay. See config/towerSkins.ts.
  const baseTheme = TOWER_THEME[tower.type];
  const skin = tower.equippedSkinId ? getTowerSkinDefinition(tower.equippedSkinId) : null;
  const theme = skin ? { ...baseTheme, ...skin.paletteOverride } : baseTheme;
  const visualStage = getTowerVisualStage(stats.level);
  const growth = 1 + ((stats.level - 1) / (MAX_TOWER_LEVEL - 1)) * TOWER_MAX_GROWTH;
  const cooldownTotalMs = 1000 / stats.attackSpeed;
  const readiness = 1 - Math.max(0, Math.min(1, tower.cooldownRemainingMs / cooldownTotalMs));

  ctx.save();
  ctx.translate(tower.position.x, tower.position.y);
  ctx.scale(growth, growth);

  if (tower.type !== "IRONWOOD") drawPlinth(ctx);

  switch (tower.type) {
    case "IRONWOOD":
      drawIronwood(ctx, theme, stats.level, timeMs, attackFlashMs, readiness, visualStage);
      break;
    case "INFERNO":
      drawInferno(ctx, theme, stats.level, timeMs, visualStage, attackFlashMs);
      break;
    case "FROSTBORN":
      drawFrostborn(ctx, theme, stats.level, timeMs, visualStage, attackFlashMs);
      break;
    case "STORMCALLER":
      drawStormcaller(ctx, theme, stats.level, timeMs, visualStage, readiness, attackFlashMs);
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
  /** Tower Visual Evolution (spec section 9) — 1..TOWER_VISUAL_STAGE_COUNT, see config/towerStats.getTowerVisualStage. Gates real structural additions below, not just scale. */
  visualStage = 1,
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

  // Visual Evolution stage 2+: jagged iron spikes driven into the mound —
  // a real added part, not a scale bump.
  if (visualStage >= 2) {
    ctx.fillStyle = "#33363a";
    for (const [sx, sy, rot] of [
      [-12, 2, -0.3],
      [11, 3, 0.3],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-1.5, 3);
      ctx.lineTo(0, -6);
      ctx.lineTo(1.5, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

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

  // Visual Evolution stage 3+: a heavy chain wraps the trunk, hanging
  // slightly loose — reinforcement befitting a veteran structure.
  if (visualStage >= 3) {
    ctx.strokeStyle = "rgba(60,64,70,0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.quadraticCurveTo(0, 2, 8, -4);
    ctx.quadraticCurveTo(0, -1, -8, -4);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const cx = -8 + t * 16;
      const cy = -4 + Math.sin(t * Math.PI) * 4.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 1, 0, Math.PI * 2);
      ctx.stroke();
    }
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

  // --- Support platform: a crossed-beam wooden deck lashed to the trunk
  // just below the mount — reads as "built structure carrying a weapon,"
  // not "weapon balanced on top of a tree" (spec section 10: platform +
  // support structure as identifiable parts in their own right). ---
  const platformY = -30 - level * 0.6;
  ctx.save();
  ctx.translate(0, platformY);
  ctx.strokeStyle = "#241a10";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-9, 4);
  ctx.lineTo(9, -3);
  ctx.moveTo(-9, -3);
  ctx.lineTo(9, 4);
  ctx.stroke();
  ctx.fillStyle = "#3a2c1a";
  ctx.fillRect(-10, -1.5, 20, 3);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-10, -1.5, 20, 3);
  // Rope lashing at each end, binding the platform to the trunk.
  ctx.strokeStyle = "rgba(200,180,140,0.7)";
  ctx.lineWidth = 1;
  for (const rx of [-8.5, 8.5]) {
    ctx.beginPath();
    ctx.arc(rx, 0, 2, 0, Math.PI * 2);
    ctx.stroke();
  }
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

  // Visual Evolution stage 4+: a secondary curved blade mounted on the
  // mechanism's flank — a real added weapon part, escalating the
  // structure's silhouette beyond the base ballista.
  if (visualStage >= 4) {
    ctx.save();
    ctx.translate(0, mountY);
    ctx.fillStyle = "#4a4d52";
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.quadraticCurveTo(15, -4, 13, -10);
    ctx.quadraticCurveTo(10, -3, 6, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

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

  // Visual Evolution stage 5+: a faint carved rune circle glows on the
  // ground around the base — the structure has grown its own ambient
  // power field, not just a bigger silhouette.
  if (visualStage >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(timeMs / 700);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 7, 20, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Visual Evolution stage 6 (final form): a trophy skull hangs from the
  // mount — the veteran-structure payoff at max level.
  if (visualStage >= 6) {
    ctx.save();
    ctx.translate(-11, mountY + 10);
    ctx.fillStyle = "#e8e2d0";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1309";
    ctx.beginPath();
    ctx.arc(-1, -0.5, 0.6, 0, Math.PI * 2);
    ctx.arc(1, -0.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * INFERNO — REBUILT (Visual Overhaul spec section 7): an infernal
 * forge/war-machine, not a campfire in a stone bowl. Angular basalt
 * platform, a riveted iron furnace BODY with a forward-facing furnace
 * mouth as its "weapon", a rear chimney (the silhouette element that
 * reads "forge" at a glance, distinct from every other tower's shape),
 * and — from stage 3 on — a working bellows arm. Contrast is the
 * governing rule: dark metal/basalt/carbon dominate the mass, saturated
 * fire color is reserved for the furnace mouth, cracks, embers and smoke
 * tint, never the whole structure.
 */
function drawInferno(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["INFERNO"],
  level: number,
  timeMs: number,
  visualStage = 1,
  /** ms since this tower's last attack — drives a brief launch flare at the furnace mouth (spec section 11's CHARGE/LAUNCH beat). */
  attackFlashMs = Infinity,
): void {
  const pulse = 0.55 + 0.45 * Math.sin(timeMs / 260);
  const launchFlare = attackFlashMs < 220 ? 1 - attackFlashMs / 220 : 0;
  const bodyScale = 1 + Math.min(visualStage - 1, 5) * 0.045; // structural growth on top of the tower's own scale — the forge itself gets more massive, not just brighter

  drawContactShadow(ctx, 20, 9, 0.42);

  // --- Angular basalt platform (replaces the old round stone ring). ---
  ctx.fillStyle = "#1a1512";
  ctx.beginPath();
  ctx.moveTo(-19, 9);
  ctx.lineTo(-14, 3);
  ctx.lineTo(14, 3);
  ctx.lineTo(19, 9);
  ctx.lineTo(13, 13);
  ctx.lineTo(-13, 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0a0806";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Molten seams between the basalt slabs.
  ctx.strokeStyle = `rgba(255,120,40,${0.35 + 0.25 * pulse})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, 8);
  ctx.lineTo(-4, 10);
  ctx.moveTo(6, 10);
  ctx.lineTo(14, 7);
  ctx.stroke();

  ctx.save();
  ctx.scale(bodyScale, bodyScale);

  // --- Rear chimney: the one silhouette element that reads "forge" even
  // in shadow. Grows taller/thicker with visual stage. ---
  const chimneyH = 14 + Math.min(visualStage, 6) * 2.4;
  ctx.fillStyle = "#26201c";
  ctx.beginPath();
  ctx.moveTo(9, 2);
  ctx.lineTo(8, 2 - chimneyH);
  ctx.lineTo(13, 2 - chimneyH);
  ctx.lineTo(13.5, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#100c0a";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.fillStyle = "#3a322b";
  ctx.fillRect(7.3, 1.5 - chimneyH, 6.2, 2.2); // chimney cap rim
  // Smoke rising from the chimney — thin at low stages, a real dark plume by the final form.
  const smokeCount = 2 + Math.floor(visualStage / 2);
  ctx.fillStyle = "rgba(70,64,58,0.32)";
  for (let i = 0; i < smokeCount; i++) {
    const cycle = (timeMs / 2600 + i * (1 / smokeCount)) % 1;
    const sx = 10.5 + Math.sin(timeMs / 900 + i * 2) * (3 + cycle * 4);
    const sy = 2 - chimneyH - cycle * 22;
    ctx.globalAlpha = (1 - cycle) * 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5 + cycle * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- Furnace body: a squat trapezoidal iron-plated block. ---
  const bodyGrad = ctx.createLinearGradient(-13, -14, 13, 6);
  bodyGrad.addColorStop(0, "#4a423a");
  bodyGrad.addColorStop(0.55, "#241d18");
  bodyGrad.addColorStop(1, "#120e0b");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-10, -13);
  ctx.lineTo(10, -13);
  ctx.lineTo(12, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0a0806";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Riveted iron plating seams.
  ctx.strokeStyle = "rgba(10,8,6,0.55)";
  ctx.lineWidth = 0.8;
  for (const px of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(px * 0.95, -12.5);
    ctx.lineTo(px, 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = "#5a5148";
  for (const [rx, ry] of [
    [-9, -10],
    [9, -10],
    [-9, -1],
    [9, -1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(rx, ry, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Visual Evolution stage 2+: reinforcement plates bolted over the base
  // shell — a real added part, not just a bigger furnace.
  if (visualStage >= 2) {
    ctx.fillStyle = "#332a22";
    ctx.fillRect(-11.5, -8, 5.5, 7);
    ctx.fillRect(6, -8, 5.5, 7);
    ctx.strokeStyle = "#0a0806";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-11.5, -8, 5.5, 7);
    ctx.strokeRect(6, -8, 5.5, 7);
  }

  // --- Furnace mouth: the "weapon" — an arched, metal-framed opening
  // with the incandescent core inside it. A LAUNCH beat (spec section 11)
  // briefly flares the mouth brighter/wider the instant the tower fires,
  // so the fireball reads as something that left the furnace, not just
  // appeared at the target.
  glowBlob(ctx, 0, -6, (15 + level * 1.1) * (1 + launchFlare * 0.4), theme.glow);
  ctx.fillStyle = "#1a1310";
  ctx.beginPath();
  ctx.moveTo(-7.5, 1);
  ctx.quadraticCurveTo(-8, -11, 0, -12);
  ctx.quadraticCurveTo(8, -11, 7.5, 1);
  ctx.closePath();
  ctx.fill();
  const mouthGrad = ctx.createRadialGradient(0, -4, 0, 0, -4, 8);
  mouthGrad.addColorStop(0, `rgba(255,240,190,${0.85 + 0.15 * pulse + launchFlare * 0.15})`);
  mouthGrad.addColorStop(0.55, theme.primary);
  mouthGrad.addColorStop(1, theme.secondary);
  ctx.fillStyle = mouthGrad;
  ctx.beginPath();
  ctx.ellipse(0, -4, 5.6 + launchFlare * 1.8, 7.2 + launchFlare * 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Muzzle ring — a distinct metal collar around the opening (stage 3+, "arma mais sofisticada").
  if (visualStage >= 3) {
    ctx.strokeStyle = "#6a5f52";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -4, 6.6, 8.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Visual Evolution stage 3+: a working bellows arm on the flank — the
  // war-machine mechanism, animated via a slow pump cycle.
  if (visualStage >= 3) {
    const pump = 0.5 + 0.5 * Math.sin(timeMs / 700);
    ctx.save();
    ctx.translate(-12.5, -6);
    ctx.strokeStyle = "#3a322b";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 6 - pump * 2.5);
    ctx.lineTo(-6, 2 - pump * 1.5);
    ctx.stroke();
    ctx.fillStyle = "#241d18";
    ctx.beginPath();
    ctx.ellipse(-6, 2 - pump * 1.5, 3.2, 2.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Visual Evolution stage 4+: a suspended crucible/cauldron of molten
  // metal hanging off the opposite flank — heavy, "loaded" war-machine mass.
  if (visualStage >= 4) {
    ctx.save();
    ctx.translate(12, -2);
    ctx.strokeStyle = "#2a231d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-1, -8);
    ctx.lineTo(0, -2);
    ctx.moveTo(1.5, -8);
    ctx.lineTo(1.2, -2);
    ctx.stroke();
    ctx.fillStyle = "#241d18";
    ctx.beginPath();
    ctx.ellipse(0.3, 0, 3.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const crucibleGlow = ctx.createRadialGradient(0.3, -0.5, 0, 0.3, -0.5, 3);
    crucibleGlow.addColorStop(0, `rgba(255,180,90,${0.6 + 0.3 * pulse})`);
    crucibleGlow.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = crucibleGlow;
    ctx.beginPath();
    ctx.ellipse(0.3, -0.5, 3, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Visual Evolution stage 5+: runic engravings glowing across the plating.
  if (visualStage >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.35 * pulse;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    for (const [rx, ry, r] of [
      [-9, -3, 1.6],
      [9, -3, 1.6],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(rx - r, ry);
      ctx.lineTo(rx, ry - r);
      ctx.lineTo(rx + r, ry);
      ctx.lineTo(rx, ry + r);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore(); // end bodyScale

  // Rising embers — density scales with level, independent of visual stage
  // structural additions (a continuous "power" read, same as before).
  ctx.fillStyle = "rgba(255,180,90,0.85)";
  for (let i = 0; i < 3 + Math.min(level, 4); i++) {
    const cycle = (timeMs / 900 + i * 0.33) % 1;
    const y = -12 - cycle * 24;
    const x = Math.sin(timeMs / 500 + i * 2) * (4 + cycle * 5);
    ctx.globalAlpha = 1 - cycle;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Visual Evolution stage 6 (final form): twin dual chimneys (the second
  // one added on the opposite flank) + a full molten-crack aura — the
  // "true fire fortress" payoff.
  if (visualStage >= 6) {
    ctx.save();
    ctx.translate(-11, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = "#26201c";
    const h2 = 14 + 6 * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-1, 2 - h2 * 0.7);
    ctx.lineTo(4, 2 - h2 * 0.7);
    ctx.lineTo(4.5, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * pulse;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 6, 22, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/**
 * FROSTBORN — REBUILT (Visual Overhaul spec section 8): an ancient arcane
 * ice tower, not an ice cube/crystal cluster. Ice is now PART of the
 * architecture (a frozen core, a crystalline crown), never the whole
 * structure — the body is dark, weathered, rune-carved stone, the same
 * "built from the local ground, ancient" language the fortress and
 * Stormcaller's pillar already use, so Frostborn reads as belonging to
 * the same world instead of a foreign ice-block prop.
 */
function drawFrostborn(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["FROSTBORN"],
  level: number,
  timeMs: number,
  visualStage = 1,
  /** ms since this tower's last attack — drives a brief brighter core pulse at launch (spec section 11's CHARGE/LAUNCH beat). */
  attackFlashMs = Infinity,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 500);
  const launchFlare = attackFlashMs < 200 ? 1 - attackFlashMs / 200 : 0;

  // Frost creeping across the ground, always present but faint — the
  // ground-hugging mist (stage 4+) is a stronger, wider version of this.
  ctx.fillStyle = "rgba(180,225,255,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Hexagonal STONE plinth (dark, weathered — not ice-colored). ---
  const stoneGrad = ctx.createLinearGradient(0, 6, 0, -6);
  stoneGrad.addColorStop(0, "#242e36");
  stoneGrad.addColorStop(1, "#3a4a56");
  ctx.fillStyle = stoneGrad;
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
  ctx.strokeStyle = "rgba(200,235,255,0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Frost rime along the plinth's seams.
  ctx.strokeStyle = "rgba(210,240,255,0.4)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-10, 3);
  ctx.lineTo(-4, 5);
  ctx.moveTo(5, 5);
  ctx.lineTo(11, 2);
  ctx.stroke();

  // --- The tower proper: a tapering stone obelisk (the real architecture).
  // Widened from the original thin needle profile, and warmed off pure
  // blue-grey toward a slate/purple stone tone — at this render scale a
  // blue-grey obelisk blended into the cyan ice accents and read as solid
  // ice despite being geometrically "stone"; a hue that visibly contrasts
  // against the crystal accents is what actually makes the architecture
  // read as stone with ice growing on it, not the other way around. ---
  const spireH = 20 + Math.min(visualStage, 6) * 2.6 + level * 0.4;
  ctx.save();
  const sway = Math.sin(timeMs / 3000) * 0.012;
  ctx.rotate(sway);

  const obeliskGrad = ctx.createLinearGradient(-9, -spireH, 9, 2);
  obeliskGrad.addColorStop(0, "#4f4a5c");
  obeliskGrad.addColorStop(0.6, "#2c2836");
  obeliskGrad.addColorStop(1, "#15131c");
  ctx.fillStyle = obeliskGrad;
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.lineTo(-5.5, -spireH * 0.55);
  ctx.lineTo(-3.2, -spireH);
  ctx.lineTo(3.2, -spireH);
  ctx.lineTo(5.5, -spireH * 0.55);
  ctx.lineTo(9, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0e1418";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Carved rune band, low on the spire — always present, brighter with level.
  const runeGlow = 0.35 + Math.min(level, 10) * 0.045 + 0.2 * pulse;
  ctx.globalAlpha = runeGlow;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(-5.5, -6, 11, 2.2);
  ctx.globalAlpha = 1;

  // Visual Evolution stage 3+: a second, higher rune band — the spire has
  // grown a real second architectural tier. Dimmed alongside the icicles
  // and core glow it sits next to (see notes above) — this band alone was
  // fine, but the cluster of accents all sharing this stretch of the
  // spire is what buried the stone in cyan.
  if (visualStage >= 3) {
    ctx.globalAlpha = 0.18 + 0.15 * Math.sin(timeMs / 500 + 1.4);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(-4.2, -spireH * 0.55 - 2, 8.4, 1.8);
    ctx.globalAlpha = 1;
  }

  // --- Frozen core: a crystal orb bound in a stone collar, roughly
  // 2/3 up the spire — the tower's focal "weapon". ---
  const coreY = -spireH * 0.62;
  ctx.fillStyle = "#1a2126";
  ctx.beginPath();
  ctx.ellipse(0, coreY, 6.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Same runaway-per-level bug documented on Stormcaller's orb: an
  // unbounded `13 + level * 1.1` reaches a 46px-radius halo at level 30 —
  // nearly the full height of the spire — which washes the dark stone
  // architecture out in cyan and defeats the "ice is PART of the
  // structure, not the whole structure" direction. Even the first fix
  // (capping the radius) still measured as a broad wash once stacked with
  // the icicles/second rune band/sparkles that also cluster around the
  // core — this is now a small, tight accent sized to the orb itself, not
  // something that reaches the spire's shoulders.
  // launchFlare: the instant this tower fires, the core briefly tightens
  // and flares brighter — the "arcane energy" beat before a bolt leaves
  // the crystal (spec section 11's CHARGE/LAUNCH for Frostborn).
  glowBlob(ctx, 0, coreY, (8 + Math.min(level, 10) * 0.25) * (1 + launchFlare * 0.35), theme.glow);
  const coreGrad = ctx.createRadialGradient(-1, coreY - 1.5, 0, 0, coreY, 5.5);
  coreGrad.addColorStop(0, "#eafcff");
  coreGrad.addColorStop(0.55, theme.accent);
  coreGrad.addColorStop(1, theme.primary);
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, coreY, 4.4 + launchFlare * 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Visual Evolution stage 2+: crystal outcrops breaking through the
  // spire's own stone near the base — ice growing FROM the architecture.
  if (visualStage >= 2) {
    drawCrystalShard(ctx, -6, -3, 2.4, theme);
    drawCrystalShard(ctx, 6, -3, 2.4, theme);
  }

  // Visual Evolution stage 4+: icicles hanging off the spire's shoulder
  // ledges — a real architectural detail, not a bigger core. Dimmed from
  // the original 0.75 alpha: at full brightness these stacked with the
  // core glow and second rune band (both nearby) into a single wash that
  // buried the stone shoulders they're supposed to be hanging off of.
  if (visualStage >= 4) {
    for (const ix of [-3.5, 3.5]) {
      ctx.fillStyle = "rgba(200,230,245,0.4)";
      ctx.beginPath();
      ctx.moveTo(ix - 0.7, -spireH * 0.55);
      ctx.lineTo(ix + 0.7, -spireH * 0.55);
      ctx.lineTo(ix, -spireH * 0.55 + 5);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore(); // end sway

  // A small shard orbiting the core.
  const orbitAngle = timeMs / 1400;
  const ox = Math.cos(orbitAngle) * 11;
  ctx.save();
  ctx.translate(ox, coreY + Math.sin(orbitAngle) * 4);
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

  // Visual Evolution stage 4+: a low ground-hugging frost mist ring —
  // the structure now radiates cold beyond its own footprint.
  if (visualStage >= 4) {
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(timeMs / 900);
    ctx.fillStyle = "#cdf3ff";
    ctx.beginPath();
    ctx.ellipse(0, 9, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Visual Evolution stage 5+: faint aurora arcs above the tower — arcane
  // energy the ancient structure now visibly commands.
  if (visualStage >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.18 * Math.sin(timeMs / 700);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 2; i++) {
      const yOff = -spireH - 6 - i * 5;
      ctx.beginPath();
      ctx.moveTo(-14 + i * 3, yOff + 6);
      ctx.quadraticCurveTo(0, yOff - 4, 14 - i * 3, yOff + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Sparkle twinkles around the core.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 2 + Math.min(level, 3); i++) {
    const twinkle = (Math.sin(timeMs / 300 + i * 5) + 1) / 2;
    if (twinkle < 0.7) continue;
    const angle = i * 2.1;
    ctx.globalAlpha = (twinkle - 0.7) / 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 11, coreY + Math.sin(angle) * 9, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Visual Evolution stage 6 (final form): a crystalline crown atop the
  // spire's tip — the ancient-monument payoff at max level.
  if (visualStage >= 6) {
    const crownY = -spireH;
    drawCrystalShard(ctx, 0, crownY - 6, 3.4, theme, 8);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      drawCrystalShard(ctx, Math.cos(angle) * 5, crownY + Math.sin(angle) * 2.5, 2, theme, 5);
    }
  }
}

function drawCrystalShard(
  ctx: CanvasRenderingContext2D,
  x: number,
  tipY: number,
  width: number,
  theme: (typeof TOWER_THEME)["FROSTBORN"],
  /**
   * Shard length along its own axis. Defaults to a short ground-level
   * outcrop (spec's original use case). BUG FIX: the crown callers (stage
   * 6) used to pass a very negative `tipY` (near the spire's tip) while
   * this always hardcoded `baseY = 4` (ground level) — so each "small
   * crown shard" actually stretched from the crown all the way down to
   * the ground, and 5 of them overlapping is what painted a broad cyan
   * band across most of the tower's height, burying the stone body under
   * it. A shard now always spans exactly `length` from its own tip,
   * regardless of where on the spire it sits.
   */
  length = 7,
): void {
  const baseY = tipY + length;
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

/**
 * STORMCALLER — ELEVATED, NOT REPLACED (Visual Overhaul spec section 9):
 * the pillar-and-orb identity already reads well, so the goal here is
 * charge → discharge storytelling instead of a rebuild. Idle sparks run
 * at every stage so the tower never looks inert; `readiness` (0..1, how
 * close the next attack is) drives a visible CHARGE telegraph — the orb
 * tightens and brightens as it approaches ready — and `attackFlashMs`
 * drives a short DISCHARGE beat down through the pillar into the ground
 * the instant it fires. Neither parameter is read by any other tower, and
 * neither alters gameplay — both are purely cosmetic reads of state the
 * engine already exposes (tower.cooldownRemainingMs / attack timestamp).
 */
function drawStormcaller(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["STORMCALLER"],
  level: number,
  timeMs: number,
  visualStage = 1,
  readiness = 0,
  attackFlashMs = Infinity,
): void {
  const discharge = attackFlashMs < 180 ? 1 - attackFlashMs / 180 : 0;
  // Charge telegraph: only meaningfully visible in the last stretch before
  // ready, so it reads as "building up" rather than being on the whole time.
  const charge = Math.max(0, (Math.max(0, Math.min(1, readiness)) - 0.6) / 0.4);

  // Two-tier stone plinth.
  ctx.fillStyle = "#4a3f30";
  ctx.beginPath();
  ctx.ellipse(0, 7, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a4a38";
  ctx.beginPath();
  ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Discharge beat: a bright ground ring stamps outward from the plinth
  // the instant the attack fires — the "energy just left the structure"
  // beat, distinct from the ordinary projectile-impact VFX at the target.
  if (discharge > 0) {
    ctx.save();
    ctx.globalAlpha = discharge * 0.6;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5 + discharge * 2;
    ctx.beginPath();
    ctx.ellipse(0, 6, 14 + (1 - discharge) * 14, 6 + (1 - discharge) * 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Rune pillar.
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(-6, -26, 12, 30);
  ctx.fillStyle = theme.primary;
  for (let i = 0; i < 3; i++) {
    const bandPulse = 0.4 + 0.4 * Math.sin(timeMs / 500 + i * 1.4);
    ctx.globalAlpha = discharge > 0 ? 0.9 : bandPulse;
    ctx.fillRect(-6, -22 + i * 8, 12, 2.4);
  }
  ctx.globalAlpha = 1;

  // Discharge beat: a bright bolt races down the pillar's core into the
  // ground the instant the attack fires — energy visibly leaving the
  // structure through its own body, not just appearing at the orb.
  if (discharge > 0) {
    ctx.save();
    ctx.strokeStyle = "#f4faff";
    ctx.globalAlpha = discharge;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    const jitter = (n: number) => (((n * 9301 + 49297) % 233280) / 233280 - 0.5) * 5;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(jitter(1), -10);
    ctx.lineTo(jitter(2), 2);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }

  // Visual Evolution stage 2+: two small carved rune stones flanking the
  // pillar's base — a real added part, not just a brighter pillar.
  if (visualStage >= 2) {
    for (const sx of [-9, 9]) {
      ctx.save();
      ctx.translate(sx, 5);
      ctx.rotate(sx > 0 ? 0.15 : -0.15);
      ctx.fillStyle = "#4a3f30";
      ctx.fillRect(-2, -5, 4, 8);
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(timeMs / 450 + sx);
      ctx.fillRect(-1, -3, 2, 4);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // Visual Evolution stage 3+: paired lightning-rod spires jutting from the
  // pillar's top corners — the structure now actively draws energy from
  // above, not just channels it through the orb.
  if (visualStage >= 3) {
    for (const sx of [-6.5, 6.5]) {
      ctx.save();
      ctx.strokeStyle = "#2c2f34";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, -26);
      ctx.lineTo(sx * 1.3, -34);
      ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(timeMs / 240 + sx);
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(sx * 1.3, -34, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // Same runaway-per-level bug as the tower's overall scale: the orb's
  // rise and glow radius were unbounded (level * 1.4 / level * 1.3), so a
  // maxed Stormcaller's orb drifted ~74px above its plinth with a 55px
  // glow — high enough to visually sit on top of the enemy path. Capped to
  // a fixed total budget across the level range instead.
  const levelProgress = (level - 1) / (MAX_TOWER_LEVEL - 1);
  const orbY = -32 - levelProgress * 16;
  const chargeGlow = 1 + charge * 0.5 + discharge * 0.8;
  glowBlob(ctx, 0, orbY, (16 + levelProgress * 8) * chargeGlow, theme.glow);

  // A rotating arcane ring around the orb (drawn as a squashed ellipse for
  // a top-down "ring" read) — spins faster as the charge builds.
  ctx.save();
  ctx.translate(0, orbY);
  ctx.rotate(timeMs / (2000 - charge * 1400));
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.3 + charge * 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 11 - charge * 3, 4 - charge * 1, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.fillStyle = discharge > 0 ? "#f4faff" : theme.accent;
  ctx.beginPath();
  ctx.arc(0, orbY, 6 + charge * 1.5 - discharge * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Visual Evolution stage 4+: a second, smaller orb orbits the main one —
  // the structure now channels more than one focus of power.
  if (visualStage >= 4) {
    const secondaryAngle = timeMs / 900;
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(Math.cos(secondaryAngle) * 12, orbY + Math.sin(secondaryAngle) * 5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Crackling arcs jumping between the orb and the pillar top — always
  // present at idle (spec: "pequenos elementos elétricos durante idle"),
  // denser and brighter while charging or discharging so power visibly
  // builds and releases rather than sitting at one constant intensity.
  const arcIntensity = 1 + charge * 0.6 + discharge * 1.2;
  ctx.strokeStyle = discharge > 0 ? "#f4faff" : theme.primary;
  ctx.lineWidth = 1.3 * arcIntensity;
  ctx.globalAlpha = Math.min(1, 0.7 + charge * 0.3 + discharge * 0.3);
  const arcCount = 2 + Math.min(level, 3) + (charge > 0.4 ? 1 : 0) + (discharge > 0 ? 2 : 0);
  for (let i = 0; i < arcCount; i++) {
    const seed = Math.floor(timeMs / 110) + i * 17;
    const jitter = (n: number) => (((n * 9301 + 49297) % 233280) / 233280 - 0.5) * 12 * arcIntensity;
    ctx.beginPath();
    ctx.moveTo(0, orbY + 5);
    const midX = jitter(seed);
    const midY = orbY + (-24 - orbY) / 2 + jitter(seed + 1) * 0.4;
    ctx.lineTo(midX, midY);
    ctx.lineTo(jitter(seed + 2) * 0.6, -24);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Residual sparks: a brief handful of fading motes drifting off the orb
  // right after a discharge — the "aftermath" beat the spec asks for so
  // an attack doesn't just cut instantly back to idle.
  if (discharge > 0 && discharge < 0.7) {
    const fade = discharge / 0.7;
    ctx.save();
    ctx.globalAlpha = fade * 0.7;
    ctx.fillStyle = theme.accent;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + timeMs / 90;
      const r = 9 + (1 - fade) * 10;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, orbY + Math.sin(a) * r * 0.5, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Visual Evolution stage 5+: a faint standing energy field ripples at
  // ground level, fed continuously by the pillar — the structure now
  // sustains ambient power between attacks, not just at the orb.
  if (visualStage >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.12 * Math.sin(timeMs / 500) + discharge * 0.3;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 8, 19, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Visual Evolution stage 6 (final form): a faint storm-cloud halo hangs
  // above the orb, echoed by slow drifting sparks.
  if (visualStage >= 6) {
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.1 * Math.sin(timeMs / 600);
    ctx.fillStyle = theme.primary;
    ctx.beginPath();
    ctx.ellipse(0, orbY - 14, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
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

/**
 * Attack VFX (spec section 11): each tower's projectile now has its own
 * signature TRAVEL + IMPACT read instead of sharing one generic fading
 * line — Ironwood already had this (a lofted arrow); Inferno, Frostborn
 * and Stormcaller get their own here. None of this reads or affects
 * damage/stats — ProjectileInstance is purely cosmetic (see Projectile.ts).
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance): void {
  const progress = 1 - projectile.remainingMs / projectile.totalMs;
  const theme = TOWER_THEME[projectile.towerType];

  switch (projectile.towerType) {
    case "IRONWOOD":
      drawIronwoodArrow(ctx, projectile, progress);
      break;
    case "INFERNO":
      drawInfernoFireball(ctx, projectile, progress);
      break;
    case "FROSTBORN":
      drawFrostbornBolt(ctx, projectile, progress);
      break;
    case "STORMCALLER":
      drawStormcallerBolt(ctx, projectile, progress);
      break;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(1 - progress * 1.4, 0);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(projectile.to.x, projectile.to.y, projectile.isSpecial ? 8 : 4, 0, Math.PI * 2);
  ctx.fill();
  // Special Attack (spec section 27): an extra ring stamp at impact so a
  // special always reads as visibly bigger than a normal hit, even for
  // towers whose own impact dot barely changes size.
  if (projectile.isSpecial) {
    ctx.globalAlpha = Math.max(1 - progress * 1.4, 0) * 0.6;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(projectile.to.x, projectile.to.y, 14 + progress * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * INFERNO — a lofted, glowing fireball (heat-charge → launch → travel →
 * impact) with a fading ember trail behind it, and a bright flash-burst
 * right at impact instead of just a dot.
 */
function drawInfernoFireball(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance, progress: number): void {
  const { from, to } = projectile;
  // Special Attack (spec section 27) — "Firestorm": a visibly bigger,
  // slower-lofted fireball with a thicker ember trail, matching the much
  // larger burn radius it actually deals in CombatSystem's special block.
  const scale = projectile.isSpecial ? 1.9 : 1;
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const arcHeight = Math.min(14, dist * 0.16) * (projectile.isSpecial ? 1.6 : 1);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - arcHeight;
  const currentX = quadPoint(from.x, midX, to.x, progress);
  const currentY = quadPoint(from.y, midY, to.y, progress);

  // Ember trail: a handful of fading dots along the path just behind the
  // fireball's current position — reads as heat streaming off it in flight.
  ctx.save();
  for (let i = 1; i <= (projectile.isSpecial ? 7 : 4); i++) {
    const trailT = Math.max(0, progress - i * 0.05);
    const tx = quadPoint(from.x, midX, to.x, trailT);
    const ty = quadPoint(from.y, midY, to.y, trailT);
    ctx.globalAlpha = Math.max(0, 0.5 - i * 0.11);
    ctx.fillStyle = i % 2 === 0 ? "#ffb35a" : "#ff6a2e";
    ctx.beginPath();
    ctx.arc(tx, ty, (2.6 - i * 0.25) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The fireball itself: hot white core, orange corona.
  ctx.save();
  const impactGrow = progress > 0.88 ? (progress - 0.88) / 0.12 : 0;
  const radius = (3.6 + impactGrow * 5) * scale;
  const coreGrad = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, radius);
  coreGrad.addColorStop(0, "#fff4d8");
  coreGrad.addColorStop(0.4, "#ffb35a");
  coreGrad.addColorStop(1, "rgba(255,106,46,0)");
  ctx.fillStyle = coreGrad;
  ctx.globalAlpha = 1 - impactGrow * 0.5;
  ctx.beginPath();
  ctx.arc(currentX, currentY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * FROSTBORN — an arcane ice bolt that travels in a near-straight line
 * (no lofted arc — a precise beam of cold, not a lobbed projectile),
 * leaving a crystalline trail and crystallizing sharply on impact.
 */
function drawFrostbornBolt(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance, progress: number): void {
  const { from, to } = projectile;

  // Special Attack (spec section 27) — "Absolute Zero" freezes every enemy
  // in range from a nova CENTERED ON THE TOWER (see CombatSystem's special
  // block), not a bolt travelling to one target — so instead of the normal
  // directional shard, this reads as an expanding ring of frost radiating
  // outward from the tower itself.
  if (projectile.isSpecial) {
    const maxRadius = 90;
    const radius = maxRadius * Math.min(1, progress * 1.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress) * 0.8;
    ctx.strokeStyle = "#bdf3ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(from.x, from.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, 1 - progress) * 0.35;
    ctx.fillStyle = "#bdf3ff";
    ctx.beginPath();
    ctx.arc(from.x, from.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const currentX = from.x + (to.x - from.x) * progress;
  const currentY = from.y + (to.y - from.y) * progress;

  // Freezing trail: a thin, fading crystalline line behind the bolt.
  ctx.save();
  ctx.strokeStyle = "rgba(190,240,255,0.55)";
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 1 - progress * 0.3;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(currentX, currentY);
  ctx.stroke();
  ctx.restore();

  // The bolt itself: a small elongated shard oriented along its travel direction.
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.rotate(angle);
  const shardGrad = ctx.createLinearGradient(-5, 0, 3, 0);
  shardGrad.addColorStop(0, "rgba(220,249,255,0)");
  shardGrad.addColorStop(1, "#eafcff");
  ctx.fillStyle = shardGrad;
  ctx.beginPath();
  ctx.moveTo(3.5, 0);
  ctx.lineTo(-4, -1.6);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-4, 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Impact: sharp crystallization burst — small shards radiating from the
  // hit point in the last stretch of the projectile's life.
  if (progress > 0.85) {
    const t = (progress - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = "#bdf3ff";
    ctx.lineWidth = 1.2;
    const shardCount = 5;
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2;
      const r = 2 + t * 7;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * STORMCALLER — an instant jagged lightning bolt (electricity doesn't
 * meaningfully "travel" at readable game speed, so this collapses the
 * TRAVEL phase per spec section 11's "where it makes sense") with a
 * flicker driven by real randomness each frame (authentic crackle, not a
 * bug — a static bolt shape would read as a laser, not lightning), plus
 * a fading residual-spark aftermath along its path after the initial
 * flash instead of an instant cut to nothing.
 */
function drawStormcallerBolt(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance, progress: number): void {
  const theme = TOWER_THEME.STORMCALLER;
  const flashFade = progress < 0.3 ? 1 : Math.max(0, 1 - (progress - 0.3) / 0.7);
  // Special Attack (spec section 27) — "Chain Overload": a visibly thicker,
  // brighter-glowing bolt matching the much higher per-hit damage and
  // longer chain the CombatSystem special block actually resolves.
  const scale = projectile.isSpecial ? 2.2 : 1;

  ctx.save();
  ctx.strokeStyle = projectile.isSpecial ? "#f4faff" : theme.primary;
  ctx.lineWidth = 2.2 * (0.5 + flashFade * 0.5) * scale;
  ctx.globalAlpha = flashFade;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 6 * scale;

  drawJaggedBolt(ctx, projectile.from, projectile.to);
  let originForChain = projectile.to;
  for (const target of projectile.chainTargets) {
    drawJaggedBolt(ctx, originForChain, target);
    originForChain = target;
  }
  ctx.restore();

  // Residual sparks: small crackling motes lingering near the impact
  // points after the main flash fades — the "aftermath" beat.
  if (progress > 0.25) {
    const sparkFade = Math.min(1, (progress - 0.25) / 0.6);
    ctx.save();
    ctx.globalAlpha = (1 - sparkFade) * 0.7;
    ctx.fillStyle = theme.accent;
    const points = [projectile.to, ...projectile.chainTargets];
    const sparksPerPoint = projectile.isSpecial ? 5 : 2;
    for (const p of points) {
      for (let i = 0; i < sparksPerPoint; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 6 * scale;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0.8 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawJaggedBolt(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const segments = 5;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const nx = -dy;
  const ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jitter = (Math.random() - 0.5) * 6;
    ctx.lineTo(from.x + dx * t + (nx / len) * jitter, from.y + dy * t + (ny / len) * jitter);
  }
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
  // Special Attack (spec section 27) — "Piercing Shot": a visibly bigger,
  // brighter-trailed bolt matching the guaranteed heavy hit the
  // CombatSystem special block actually resolves.
  const scale = projectile.isSpecial ? 2.1 : 1;
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
  trailGradient.addColorStop(1, projectile.isSpecial ? "rgba(255,236,180,0.85)" : "rgba(212,247,154,0.6)");
  ctx.strokeStyle = trailGradient;
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, currentX, currentY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#5a3f22";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(3, 0);
  ctx.stroke();
  ctx.fillStyle = projectile.isSpecial ? "#ffecb4" : "#e8e0c8";
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
