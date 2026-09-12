import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import type { EnemyType } from "@/config/enemyStats";
import type { EnemyInstance } from "@/entities/Enemy";
import { getEffectiveSpeed } from "@/entities/Enemy";
import type { CreatureHandle } from "@/lab3d/creatures/creatureTypes";
import { ENEMY_3D_REGISTRY } from "./creatureRegistry";
import { getContactShadowTexture } from "./contactShadowTexture";
import { computeScreenTransform, worldDirectionToThreeYaw, worldToThreeGround } from "./enemyProjection";

const DEATH_DURATION_S = 0.45;

interface TrackedEnemy {
  type: EnemyType;
  hp: number;
  dying: boolean;
  deathElapsed: number;
}

/**
 * INIMIGOS 3D — purely visual, generic across every registered enemy type
 * (see creatureRegistry.ts). Reads `engine.getRenderSnapshot()` itself
 * every frame (the same read `CanvasRenderer` already does) and mirrors
 * each REGISTERED enemy's position/orientation/HP/death onto its matching
 * 3D model; enemy types with no registry entry are left alone so
 * `CanvasRenderer` keeps drawing their existing 2D sprite. This layer
 * never computes a position, moves an enemy, changes HP, or grants gold —
 * the logical enemy in `entities/Enemy.ts`/`engine/GameEngine.ts` is the
 * only source of truth, and there is exactly ONE tracked instance per real
 * enemy id (no second entity, no second HP, no second route).
 * `hiddenIdsRef.current` is written here (the ids currently covered by a
 * 3D model) so `CanvasRenderer` can skip drawing the 2D sprite underneath
 * — see CanvasRenderer.tsx's `hidden3DEnemyIds` prop. The existing 2D HP
 * bar pass is NOT skipped for these ids — there is still only one HP bar,
 * drawn by the same code every other enemy uses.
 */
export function Enemy3DLayer({ engine, hiddenIdsRef }: { engine: GameEngine; hiddenIdsRef: React.RefObject<Set<string>> }) {
  const [renderedIds, setRenderedIds] = useState<string[]>([]);
  const trackedRef = useRef(new Map<string, TrackedEnemy>());
  const anchorsRef = useRef(new Map<string, THREE.Group>());
  const scaleGroupsRef = useRef(new Map<string, THREE.Group>());
  const handlesRef = useRef(new Map<string, CreatureHandle>());
  const renderedIdsRef = useRef<string[]>([]);
  const latestEnemiesRef = useRef(new Map<string, EnemyInstance>());

  useFrame((state, dt) => {
    const { width, height } = state.size;
    const transform = computeScreenTransform(width, height);

    const snapshot = engine.getRenderSnapshot();
    const registered = snapshot.enemies.filter((e) => ENEMY_3D_REGISTRY[e.type] !== undefined);
    const aliveIds = new Set(registered.map((e) => e.id));
    const tracked = trackedRef.current;

    latestEnemiesRef.current.clear();
    for (const enemy of registered) latestEnemiesRef.current.set(enemy.id, enemy);

    for (const enemy of registered) {
      const def = ENEMY_3D_REGISTRY[enemy.type]!;
      const modelScale = (def.worldHeight / def.localHeight) * transform.scale;

      let entry = tracked.get(enemy.id);
      if (!entry) {
        entry = { type: enemy.type, hp: enemy.hp, dying: false, deathElapsed: 0 };
        tracked.set(enemy.id, entry);
      } else if (enemy.hp < entry.hp) {
        handlesRef.current.get(enemy.id)?.pulseHit();
      }
      entry.hp = enemy.hp;

      // Ties the walk-cycle rate to the enemy's REAL current speed (slowed,
      // frozen, etc.) every frame via the handle's imperative setter — a
      // plain React prop would only refresh when this component itself
      // re-renders (i.e. when an enemy spawns/dies), not continuously.
      const speedRatio = Math.max(0.15, getEffectiveSpeed(enemy) / Math.max(enemy.baseSpeed, 0.0001));
      handlesRef.current.get(enemy.id)?.setSpeedMultiplier?.(speedRatio);

      const anchor = anchorsRef.current.get(enemy.id);
      const scaleGroup = scaleGroupsRef.current.get(enemy.id);
      if (anchor) {
        const [x, y, z] = worldToThreeGround(enemy.position, transform);
        anchor.position.set(x, y, z);
        anchor.rotation.y = worldDirectionToThreeYaw(enemy.direction);
      }
      if (scaleGroup) scaleGroup.scale.setScalar(modelScale);
    }

    // Deaths: an id present last frame but absent now. `entry.hp <= 0.01`
    // mirrors CanvasRenderer's own detectVfxEvents split between "died"
    // and "reached the castle" (Enemy.ts never marks a live field for
    // this) — only a genuine kill gets the shrink-out animation; reaching
    // the castle just removes the model instantly, exactly like the 2D
    // sprite already does.
    for (const [id, entry] of tracked) {
      if (aliveIds.has(id) || entry.dying) continue;
      if (entry.hp <= 0.01) {
        entry.dying = true;
        entry.deathElapsed = 0;
      } else {
        tracked.delete(id);
        anchorsRef.current.delete(id);
        scaleGroupsRef.current.delete(id);
        handlesRef.current.delete(id);
      }
    }

    // Advance death animations (shrink to zero, then unmount).
    for (const [id, entry] of tracked) {
      if (!entry.dying) continue;
      entry.deathElapsed += dt;
      const def = ENEMY_3D_REGISTRY[entry.type];
      const scaleGroup = scaleGroupsRef.current.get(id);
      if (scaleGroup && def) {
        const modelScale = (def.worldHeight / def.localHeight) * transform.scale;
        const t = Math.min(1, entry.deathElapsed / DEATH_DURATION_S);
        scaleGroup.scale.setScalar(modelScale * Math.max(0.001, 1 - t));
      }
      if (entry.deathElapsed >= DEATH_DURATION_S) {
        tracked.delete(id);
        anchorsRef.current.delete(id);
        scaleGroupsRef.current.delete(id);
        handlesRef.current.delete(id);
      }
    }

    // hiddenIdsRef only needs to cover ids that are ALIVE (still present in
    // snapshot.enemies) — a dead one is already absent from the 2D loop's
    // own iteration, so there is nothing left to hide by the time the
    // shrink animation runs.
    const hidden = hiddenIdsRef.current;
    if (hidden) {
      hidden.clear();
      for (const id of aliveIds) hidden.add(id);
    }

    const nextRendered = Array.from(tracked.keys());
    if (!arraysEqual(nextRendered, renderedIdsRef.current)) {
      renderedIdsRef.current = nextRendered;
      setRenderedIds(nextRendered);
    }
  });

  const shadowTexture = getContactShadowTexture();

  return (
    <>
      {renderedIds.map((id) => {
        const entry = trackedRef.current.get(id);
        const def = entry && ENEMY_3D_REGISTRY[entry.type];
        if (!def) return null;
        const enemy = latestEnemiesRef.current.get(id);
        const speedMultiplier = enemy ? Math.max(0.15, getEffectiveSpeed(enemy) / Math.max(enemy.baseSpeed, 0.0001)) : 1;
        const Component = def.Component;
        const shadowRadius = def.localHeight * def.shadowRadiusRatio;
        return (
          <group
            key={id}
            ref={(g) => {
              if (g) anchorsRef.current.set(id, g);
            }}
          >
            <group
              ref={(g) => {
                if (g) scaleGroupsRef.current.set(id, g);
              }}
            >
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.72, 1]}>
                <circleGeometry args={[shadowRadius, 24]} />
                <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
              </mesh>
              <Component onReady={(h) => handlesRef.current.set(id, h)} speedMultiplier={speedMultiplier} />
            </group>
          </group>
        );
      })}
    </>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  for (const v of a) if (!bSet.has(v)) return false;
  return true;
}
