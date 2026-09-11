import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BruteCreature } from "@/lab3d/creatures/BruteCreature";
import type { CreatureHandle } from "@/lab3d/creatures/creatureTypes";
import type { TowerHandle } from "@/lab3d/towers/towerTypes";
import { EffectsManager, type EffectsHandle } from "@/lab3d/effects/EffectsManager";
import { HYBRID_PATH_SEGMENT, HYBRID_TOWER_SLOT } from "./hybridWorldData";
import { footprintToThree } from "./hybridProjection";
import { ModularIronwoodTower } from "./towers/ModularIronwoodTower";
import { ironwoodBaseSkin } from "./towers/skins/ironwoodBaseSkin";
import type { TowerSkinDefinition } from "./towers/towerSkinTypes";

const CREATURE_SCALE = 48;
// Derived from TESTE 3 (scale vs. Brute), not an arbitrary bump: the
// redesigned tower's own local height (foundation to crystal tip, ~1.64
// units) is close to the Brute's local height (~1.65 units), so matching
// TOWER_SCALE/CREATURE_SCALE to the same ratio would make them read as
// the same size — a defensive tower should read taller/heavier than the
// creature attacking it, so this scale is picked to put the tower's
// world-space height a deliberate margin above the Brute's (~96 vs ~79).
const TOWER_SCALE = 60;
const TOWER_RANGE = 220; // Three units (~ world units at our DISPLAY_SCALE=2)
const TOWER_WINDUP = 0.22;
const TOWER_COOLDOWN = 1.7;
const HITS_TO_KILL = 4;
const DEATH_DURATION = 0.45;
const RESPAWN_DELAY = 1.1;
const WALK_SPEED = 55; // Three units / second along the path

function pathLength(points: [number, number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  return total;
}

function pointAtDistance(points: [number, number, number][], distance: number): { x: number; z: number; yaw: number } {
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segLen = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 0;
      return { x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    remaining -= segLen;
  }
  const last = points[points.length - 1]!;
  return { x: last[0], z: last[2], yaw: 0 };
}

/**
 * PROVA DE CONCEITO HÍBRIDA — a deliberately tiny, single-creature/
 * single-tower combat loop (no archetype table, no wave system, no
 * economy) whose only job is to drive the visual demonstration this
 * experiment asks for: the tower spots the creature, winds up, fires,
 * the creature reacts, and eventually "dies" and respawns to loop the
 * demo. All cosmetic — no real damage numbers, no real Tower/Enemy
 * stats read or written anywhere in this file.
 */
interface Props {
  towerSkin?: TowerSkinDefinition;
}

export function HybridDemoController({ towerSkin = ironwoodBaseSkin }: Props) {
  const towerHandleRef = useRef<TowerHandle | null>(null);
  const towerYawRef = useRef<THREE.Group>(null);
  const creatureHandleRef = useRef<CreatureHandle | null>(null);
  // Position/rotation are set on this UNSCALED anchor (world-space
  // placement); CREATURE_SCALE is applied to a separate child group so
  // setting `.position` here never gets multiplied by the scale factor.
  const creatureAnchorRef = useRef<THREE.Group>(null);
  const creatureScaleRef = useRef<THREE.Group>(null);
  const effectsRef = useRef<EffectsHandle | null>(null);

  const pathPoints = useRef(HYBRID_PATH_SEGMENT.map((p) => footprintToThree(p))).current;
  const totalLength = useRef(pathLength(pathPoints)).current;
  const towerWorldPos = useRef(footprintToThree(HYBRID_TOWER_SLOT.position)).current;
  // 1.45 must match ModularIronwoodTower's IRONWOOD_CORE_HEIGHT constant —
  // this is where the crystal (and therefore the projectile's origin)
  // actually sits after the hero redesign.
  const towerCorePos = useRef<[number, number, number]>([towerWorldPos[0], towerWorldPos[1] + 1.45 * TOWER_SCALE, towerWorldPos[2]]).current;

  const state = useRef({
    distance: 0,
    direction: 1 as 1 | -1,
    alive: true,
    hits: 0,
    respawnTimer: 0,
    combatPhase: "idle" as "idle" | "windup",
    combatTimer: 0.4,
  });

  const killAndRespawn = () => {
    const s = state.current;
    const anchor = creatureAnchorRef.current;
    if (!anchor) return;
    s.alive = false;
    s.respawnTimer = RESPAWN_DELAY;
    const pos = anchor.position;
    effectsRef.current?.burst([pos.x, pos.y + 30, pos.z], towerSkin.effects.impactColor);
    effectsRef.current?.goldSparkle([pos.x, pos.y + 40, pos.z]);
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = state.current;
    const anchor = creatureAnchorRef.current;
    const scaleGroup = creatureScaleRef.current;
    const tower = towerHandleRef.current;
    if (!anchor || !scaleGroup) return;

    if (!s.alive) {
      anchor.visible = true;
      s.respawnTimer -= dt;
      const elapsed = RESPAWN_DELAY - s.respawnTimer;
      if (elapsed < DEATH_DURATION) {
        const t = elapsed / DEATH_DURATION;
        scaleGroup.scale.setScalar(CREATURE_SCALE * Math.max(0.001, 1 - t));
      } else {
        anchor.visible = false;
      }
      if (s.respawnTimer <= 0) {
        s.alive = true;
        s.hits = 0;
        s.distance = 0;
        s.direction = 1;
        anchor.visible = true;
        scaleGroup.scale.setScalar(CREATURE_SCALE);
      }
    } else {
      s.distance += WALK_SPEED * dt * s.direction;
      if (s.distance >= totalLength) {
        s.distance = totalLength;
        s.direction = -1;
      } else if (s.distance <= 0) {
        s.distance = 0;
        s.direction = 1;
      }
      const p = pointAtDistance(pathPoints, s.distance);
      anchor.position.set(p.x, 0, p.z);
      anchor.rotation.y = p.yaw + (s.direction < 0 ? Math.PI : 0);
    }

    if (towerYawRef.current) {
      const dx = anchor.position.x - towerWorldPos[0];
      const dz = anchor.position.z - towerWorldPos[2];
      const targetYaw = Math.atan2(dx, dz);
      const current = towerYawRef.current.rotation.y;
      let delta = targetYaw - current;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      towerYawRef.current.rotation.y = current + delta * Math.min(1, dt * 4);
    }

    if (tower) {
      s.combatTimer -= dt;
      if (s.combatTimer <= 0) {
        if (s.combatPhase === "idle") {
          const dx = anchor.position.x - towerWorldPos[0];
          const dz = anchor.position.z - towerWorldPos[2];
          const inRange = s.alive && Math.hypot(dx, dz) <= TOWER_RANGE;
          if (!inRange) {
            s.combatTimer = 0.2;
          } else {
            tower.anticipate?.();
            s.combatPhase = "windup";
            s.combatTimer = TOWER_WINDUP;
          }
        } else {
          s.combatPhase = "idle";
          s.combatTimer = TOWER_COOLDOWN;
          if (s.alive) {
            tower.trigger();
            const to: [number, number, number] = [anchor.position.x, anchor.position.y + 25, anchor.position.z];
            effectsRef.current?.fireProjectile(towerCorePos, to, towerSkin.effects.boltColor, () => {
              if (!state.current.alive) return;
              creatureHandleRef.current?.pulseHit();
              state.current.hits += 1;
              if (state.current.hits >= HITS_TO_KILL) killAndRespawn();
            });
          }
        }
      }
    }
  });

  return (
    <group>
      {/* Contact shadows — flat, static-opacity ellipses rather than a real
          shadow map (see HybridScene3D.tsx for why: shadow-mapping broke
          rendering entirely under this environment's software WebGL). The
          same trick the real 2D EntityRenderer.drawContactShadow already
          uses elsewhere in this game. */}
      <mesh position={[towerWorldPos[0], 0.05, towerWorldPos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[46, 20]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.34} />
      </mesh>

      <group ref={towerYawRef} position={towerWorldPos}>
        <group scale={TOWER_SCALE}>
          <ModularIronwoodTower position={[0, 0, 0]} skin={towerSkin} onReady={(h) => (towerHandleRef.current = h)} />
        </group>
      </group>

      <group ref={creatureAnchorRef}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[20, 16]} />
          <meshBasicMaterial color={0x000000} transparent opacity={0.35} />
        </mesh>
        <group ref={creatureScaleRef} scale={CREATURE_SCALE}>
          <BruteCreature onReady={(h) => (creatureHandleRef.current = h)} />
        </group>
      </group>

      <EffectsManager ref={effectsRef} />
    </group>
  );
}
