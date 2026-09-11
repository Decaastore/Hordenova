import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { IronwoodTower } from "./towers/IronwoodTower";
import { InfernoTower } from "./towers/InfernoTower";
import type { TowerHandle } from "./towers/towerTypes";
import { RunnerCreature } from "./creatures/RunnerCreature";
import { BruteCreature } from "./creatures/BruteCreature";
import { WraithCreature } from "./creatures/WraithCreature";
import { WardenCreature } from "./creatures/WardenCreature";
import type { CreatureHandle } from "./creatures/creatureTypes";
import { Castle } from "./Castle";
import type { CastleHandle } from "./effectsTypes";
import { EffectsManager, type EffectsHandle } from "./effects/EffectsManager";
import { TOWER_SLOTS_3D, path3DLength, pointAtDistance3D } from "./worldData";
import { terrainHeightAt } from "./Terrain";
import { TOWERS_3D, CREATURES_3D } from "./palette";

type ArchetypeKey = "RUNNER" | "BRUTE" | "WRAITH" | "WARDEN";

interface CreatureState {
  distance: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  speed: number;
  flightAltitude: number;
}

interface TowerCombatState {
  timer: number;
  phase: "idle" | "windup";
  targetKey: ArchetypeKey | null;
}

const ARCHETYPES: Record<ArchetypeKey, { speed: number; maxHp: number; flightAltitude: number; color: number }> = {
  RUNNER: { speed: 3.4, maxHp: 2, flightAltitude: 0, color: CREATURES_3D.RUNNER.accent },
  BRUTE: { speed: 1.1, maxHp: 5, flightAltitude: 0, color: CREATURES_3D.BRUTE.accent },
  WRAITH: { speed: 2.1, maxHp: 3, flightAltitude: 1.1, color: CREATURES_3D.DISABLER.accent },
  WARDEN: { speed: 0.75, maxHp: 9, flightAltitude: 0, color: CREATURES_3D.SHIELDBEARER.accent },
};

const TOTAL_PATH_LENGTH = path3DLength();
const TOWER_RANGE = 7.5;
const TOWER_ATTACK_INTERVAL = 1.9;
const TOWER_WINDUP_DURATION = 0.22;
const DEATH_ANIM_DURATION = 0.45;
const RESPAWN_DELAY = 1.3;

/**
 * Pulled out to a plain function (rather than inline `let` + closure
 * mutation) so TypeScript's control-flow narrowing on the returned key
 * stays sound at every call site — a `let` reassigned inside a nested
 * `.forEach` callback does not narrow reliably across the closure boundary.
 */
function findNearestAliveTarget(
  towerPosition: THREE.Vector3,
  states: Record<ArchetypeKey, CreatureState>,
  handles: Partial<Record<ArchetypeKey, CreatureHandle>>,
  range: number,
): ArchetypeKey | null {
  let nearestKey: ArchetypeKey | null = null;
  let nearestDist = Infinity;
  for (const key of Object.keys(states) as ArchetypeKey[]) {
    const state = states[key];
    const handle = handles[key];
    if (!handle || !state.alive) continue;
    const d = towerPosition.distanceTo(handle.root.position);
    if (d < range && d < nearestDist) {
      nearestDist = d;
      nearestKey = key;
    }
  }
  return nearestKey;
}

/**
 * TESTE VISUAL 3D — a small, entirely self-contained, VISUAL-ONLY combat
 * loop (requirement 13: no economy/balance/progression system is read
 * or written anywhere in this file). Towers periodically fire at whichever
 * archetype is currently nearest and alive; a hit decrements a fixed
 * cosmetic hp counter that has no relationship whatsoever to real
 * Tower/Enemy stats; death plays a burst + gold sparkle and respawns the
 * same archetype a moment later; reaching the castle pulses its damage
 * reaction and loops the creature back to the portal. This exists purely
 * to give the showcase mapa something alive to look at.
 */
export function DemoController() {
  const towerHandles = useRef<TowerHandle[]>([]);
  const creatureHandles = useRef<Partial<Record<ArchetypeKey, CreatureHandle>>>({});
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const castleHandle = useRef<CastleHandle | null>(null);
  const effectsHandle = useRef<EffectsHandle | null>(null);
  const towerCombat = useRef<TowerCombatState[]>([
    { timer: 0.3, phase: "idle", targetKey: null },
    { timer: 0.9, phase: "idle", targetKey: null },
    { timer: 1.5, phase: "idle", targetKey: null },
    { timer: 0.6, phase: "idle", targetKey: null },
  ]);

  const creatureStates = useRef<Record<ArchetypeKey, CreatureState>>({
    RUNNER: { distance: 0, hp: ARCHETYPES.RUNNER.maxHp, maxHp: ARCHETYPES.RUNNER.maxHp, alive: true, respawnTimer: 0, speed: ARCHETYPES.RUNNER.speed, flightAltitude: 0 },
    BRUTE: { distance: TOTAL_PATH_LENGTH * 0.4, hp: ARCHETYPES.BRUTE.maxHp, maxHp: ARCHETYPES.BRUTE.maxHp, alive: true, respawnTimer: 0, speed: ARCHETYPES.BRUTE.speed, flightAltitude: 0 },
    WRAITH: { distance: TOTAL_PATH_LENGTH * 0.7, hp: ARCHETYPES.WRAITH.maxHp, maxHp: ARCHETYPES.WRAITH.maxHp, alive: true, respawnTimer: 0, speed: ARCHETYPES.WRAITH.speed, flightAltitude: ARCHETYPES.WRAITH.flightAltitude },
    WARDEN: { distance: TOTAL_PATH_LENGTH * 0.15, hp: ARCHETYPES.WARDEN.maxHp, maxHp: ARCHETYPES.WARDEN.maxHp, alive: true, respawnTimer: 0, speed: ARCHETYPES.WARDEN.speed, flightAltitude: 0 },
  });

  const killCreature = (key: ArchetypeKey) => {
    const state = creatureStates.current[key];
    const handle = creatureHandles.current[key];
    if (!handle || !state.alive) return;
    state.alive = false;
    state.respawnTimer = RESPAWN_DELAY;
    const pos = handle.root.position;
    effectsHandle.current?.burst([pos.x, pos.y + 0.3, pos.z], ARCHETYPES[key].color);
    effectsHandle.current?.goldSparkle([pos.x, pos.y + 0.4, pos.z]);
    // death plays out in-place (collapse + sink, see the per-frame update below)
    // rather than vanishing instantly — "morte convincente" instead of a pop.
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);

    (Object.keys(creatureStates.current) as ArchetypeKey[]).forEach((key) => {
      const state = creatureStates.current[key];
      const handle = creatureHandles.current[key];
      if (!handle) return;

      if (!state.alive) {
        state.respawnTimer -= dt;
        const elapsed = RESPAWN_DELAY - state.respawnTimer;
        if (elapsed < DEATH_ANIM_DURATION) {
          const deathProgress = elapsed / DEATH_ANIM_DURATION;
          handle.root.visible = true;
          handle.root.scale.setScalar(Math.max(0.001, 1 - deathProgress));
          handle.root.rotation.z = deathProgress * 0.6;
        } else {
          handle.root.visible = false;
        }
        if (state.respawnTimer <= 0) {
          state.alive = true;
          state.hp = state.maxHp;
          state.distance = 0;
          handle.root.visible = true;
          handle.root.scale.setScalar(1);
          handle.root.rotation.z = 0;
        }
        return;
      }

      state.distance += state.speed * dt;
      if (state.distance >= TOTAL_PATH_LENGTH) {
        castleHandle.current?.pulseDamage();
        state.distance = 0;
      }
      const p = pointAtDistance3D(state.distance);
      const ground = terrainHeightAt(p.x, p.z);
      handle.root.position.set(p.x, ground + state.flightAltitude, p.z);
      handle.root.rotation.y = p.yaw + Math.PI;

      if (key === "WRAITH" && shadowMeshRef.current) {
        shadowMeshRef.current.position.set(p.x, ground + 0.02, p.z);
      }
    });

    // Two-phase fire sequence — "preparação" (anticipate/charge) then the
    // actual shot on windup completion — instead of firing instantly the
    // moment the cooldown hits zero, so towers read as winding up rather
    // than snapping to attention.
    towerCombat.current.forEach((combat, i) => {
      const tower = towerHandles.current[i];
      if (!tower) return;

      combat.timer -= dt;
      if (combat.timer > 0) return;

      if (combat.phase === "idle") {
        const targetKey = findNearestAliveTarget(tower.position, creatureStates.current, creatureHandles.current, TOWER_RANGE);
        if (targetKey === null) {
          combat.timer = 0.25; // keep checking soon rather than waiting a full cooldown with nothing in range
          return;
        }
        tower.anticipate?.();
        combat.phase = "windup";
        combat.targetKey = targetKey;
        combat.timer = TOWER_WINDUP_DURATION;
        return;
      }

      // windup complete — fire, provided the target is still alive and in range
      combat.phase = "idle";
      const targetKey = combat.targetKey;
      combat.targetKey = null;
      combat.timer = TOWER_ATTACK_INTERVAL + (i % 3) * 0.15;
      if (!targetKey) return;
      const targetHandle = creatureHandles.current[targetKey];
      const targetState = creatureStates.current[targetKey];
      if (!targetHandle || !targetState.alive) return;

      tower.trigger();
      const from: [number, number, number] = [tower.position.x, tower.position.y, tower.position.z];
      const to: [number, number, number] = [targetHandle.root.position.x, targetHandle.root.position.y + 0.3, targetHandle.root.position.z];
      const projectileColor = i < 2 ? TOWERS_3D.IRONWOOD.accent : TOWERS_3D.INFERNO.accent;
      effectsHandle.current?.fireProjectile(from, to, projectileColor, () => {
        const state = creatureStates.current[targetKey];
        const handle = creatureHandles.current[targetKey];
        if (!handle || !state.alive) return;
        handle.pulseHit();
        state.hp -= 1;
        if (state.hp <= 0) killCreature(targetKey);
      });
    });
  });

  const towerAt = (index: number) => TOWER_SLOTS_3D[index] ?? [0, 0];

  return (
    <group>
      <IronwoodTower
        position={[towerAt(0)[0], terrainHeightAt(towerAt(0)[0], towerAt(0)[1]), towerAt(0)[1]]}
        onReady={(h) => (towerHandles.current[0] = h)}
      />
      <IronwoodTower
        position={[towerAt(1)[0], terrainHeightAt(towerAt(1)[0], towerAt(1)[1]), towerAt(1)[1]]}
        evolved
        onReady={(h) => (towerHandles.current[1] = h)}
      />
      <InfernoTower
        position={[towerAt(2)[0], terrainHeightAt(towerAt(2)[0], towerAt(2)[1]), towerAt(2)[1]]}
        onReady={(h) => (towerHandles.current[2] = h)}
      />
      <InfernoTower
        position={[towerAt(3)[0], terrainHeightAt(towerAt(3)[0], towerAt(3)[1]), towerAt(3)[1]]}
        evolved
        onReady={(h) => (towerHandles.current[3] = h)}
      />

      <RunnerCreature onReady={(h) => (creatureHandles.current.RUNNER = h)} />
      <BruteCreature onReady={(h) => (creatureHandles.current.BRUTE = h)} />
      <WraithCreature onReady={(h) => (creatureHandles.current.WRAITH = h)} onShadowReady={(m) => (shadowMeshRef.current = m)} />
      <WardenCreature onReady={(h) => (creatureHandles.current.WARDEN = h)} />

      <Castle onReady={(h) => (castleHandle.current = h)} />
      <EffectsManager ref={effectsHandle} />
    </group>
  );
}
