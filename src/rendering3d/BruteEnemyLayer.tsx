import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import { BruteCreature } from "@/lab3d/creatures/BruteCreature";
import type { CreatureHandle } from "@/lab3d/creatures/creatureTypes";
import { computeScreenTransform, worldDirectionToThreeYaw, worldToThreeGround } from "./enemyProjection";

/**
 * How tall a BRUTE's 3D model reads on screen, in WORLD units (the same
 * 1000x600 space `entities/Enemy.ts` positions live in) — NOT a fixed
 * pixel/Three-unit count, so it scales exactly the way the 2D sprites do
 * when the window resizes (CanvasRenderer's own `scale` is reapplied
 * every frame below). `BruteCreature`'s own unscaled model is ~1.65
 * local units tall (torso + legs), so this is converted to a model
 * scale factor, not used directly.
 */
const BRUTE_WORLD_HEIGHT = 34;
const BRUTE_LOCAL_HEIGHT = 1.65;
const DEATH_DURATION_S = 0.45;

interface TrackedEnemy {
  hp: number;
  dying: boolean;
  deathElapsed: number;
}

/**
 * INIMIGOS 3D — purely visual. Reads `engine.getRenderSnapshot()` itself
 * every frame (the same read `CanvasRenderer` already does) and mirrors
 * BRUTE positions/orientations onto 3D models; it never computes a
 * position, moves an enemy, changes HP, or grants gold — the logical
 * enemy in `entities/Enemy.ts`/`engine/GameEngine.ts` is the only source
 * of truth. `hiddenIdsRef.current` is written here (the ids currently
 * covered by a 3D model) so `CanvasRenderer` can skip drawing the 2D
 * sprite underneath — see CanvasRenderer.tsx's `hidden3DEnemyIds` prop.
 */
export function BruteEnemyLayer({ engine, hiddenIdsRef }: { engine: GameEngine; hiddenIdsRef: React.RefObject<Set<string>> }) {
  const [renderedIds, setRenderedIds] = useState<string[]>([]);
  const trackedRef = useRef(new Map<string, TrackedEnemy>());
  const anchorsRef = useRef(new Map<string, THREE.Group>());
  const scaleGroupsRef = useRef(new Map<string, THREE.Group>());
  const handlesRef = useRef(new Map<string, CreatureHandle>());
  const renderedIdsRef = useRef<string[]>([]);

  useFrame((state, dt) => {
    const { width, height } = state.size;
    const transform = computeScreenTransform(width, height);
    const modelScale = (BRUTE_WORLD_HEIGHT / BRUTE_LOCAL_HEIGHT) * transform.scale;

    const snapshot = engine.getRenderSnapshot();
    const brutes = snapshot.enemies.filter((e) => e.type === "BRUTE");
    const aliveIds = new Set(brutes.map((e) => e.id));
    const tracked = trackedRef.current;

    for (const enemy of brutes) {
      let entry = tracked.get(enemy.id);
      if (!entry) {
        entry = { hp: enemy.hp, dying: false, deathElapsed: 0 };
        tracked.set(enemy.id, entry);
      } else if (enemy.hp < entry.hp) {
        handlesRef.current.get(enemy.id)?.pulseHit();
      }
      entry.hp = enemy.hp;

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
      const scaleGroup = scaleGroupsRef.current.get(id);
      if (scaleGroup) {
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

  return (
    <>
      {renderedIds.map((id) => (
        <group
          key={id}
          ref={(g) => {
            if (g) anchorsRef.current.set(id, g);
          }}
        >
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.32, 16]} />
            <meshBasicMaterial color={0x000000} transparent opacity={0.35} />
          </mesh>
          <group
            ref={(g) => {
              if (g) scaleGroupsRef.current.set(id, g);
            }}
          >
            <BruteCreature onReady={(h) => handlesRef.current.set(id, h)} />
          </group>
        </group>
      ))}
    </>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  for (const v of a) if (!bSet.has(v)) return false;
  return true;
}
