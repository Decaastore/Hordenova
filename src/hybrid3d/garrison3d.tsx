import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import type { CastleModel } from "@/battlefield3d/models/castleModel";
import type { Effects } from "@/battlefield3d/fx";
import { worldToLocalGround } from "@/rendering3d/enemyProjection";

/**
 * GUARNIÇÃO (config/garrison.ts) — the castle's soldiers, drawn as little
 * archers on the four towers, the gatehouse and the walls. They stand
 * watch facing the road, turn to the Boss or Mini-Boss the engine is
 * shooting at, draw their bows and loose arrows on every volley, and are
 * knocked off their feet when a boss blow shakes the castle, climbing back
 * up once it passes. Purely visual: the damage is the engine's.
 *
 * Lives inside the castle's own group, so everything here is in the castle
 * model's units (towers ~48 tall, gate facing +Z).
 */

/** Where soldier N stands, in the order they arrive as the garrison grows. */
const POSTS: readonly { anchor: string; dx: number; dz: number }[] = [
  { anchor: "postGate", dx: -4, dz: 1 },
  { anchor: "postGate", dx: 4, dz: 1 },
  { anchor: "postTowerL", dx: 0, dz: 0 },
  { anchor: "postTowerR", dx: 0, dz: 0 },
  { anchor: "postFrontL", dx: 0, dz: 1 },
  { anchor: "postFrontR", dx: 0, dz: 1 },
  { anchor: "postTowerBL", dx: 0, dz: 0 },
  { anchor: "postTowerBR", dx: 0, dz: 0 },
  { anchor: "postWallL", dx: 0, dz: 8 },
  { anchor: "postWallR", dx: 0, dz: 8 },
  { anchor: "postTowerL", dx: -4.5, dz: -1.5 },
  { anchor: "postTowerR", dx: 4.5, dz: -1.5 },
];

interface Soldier {
  root: THREE.Group;
  body: THREE.Group;
  bowArm: THREE.Group;
  yaw: number;
  fall: number;
  draw: number;
  bob: number;
}

interface Arrow {
  m: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  delay: number;
  dur: number;
  live: boolean;
}

const tabard = new THREE.MeshStandardMaterial({ color: "#2a5ab8", roughness: 0.8 });
const trim = new THREE.MeshStandardMaterial({ color: "#d8b04a", roughness: 0.4, metalness: 0.6 });
const iron = new THREE.MeshStandardMaterial({ color: "#6a6c72", roughness: 0.35, metalness: 0.8 });
const skin = new THREE.MeshStandardMaterial({ color: "#d8a882", roughness: 0.8 });
const leather = new THREE.MeshStandardMaterial({ color: "#4a3020", roughness: 0.9 });
const wood = new THREE.MeshStandardMaterial({ color: "#7a5228", roughness: 0.7 });
const shaftMat = new THREE.MeshStandardMaterial({ color: "#e8d8b0", roughness: 0.6, emissive: new THREE.Color("#ffcf7a"), emissiveIntensity: 0.6 });

function buildSoldier(): Soldier {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const S = 1.85;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * S, y * S, z * S);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  // legs, tabard over a mail body, belt, head, helmet with a nasal guard
  add(new THREE.BoxGeometry(0.7 * S, 2.2 * S, 0.8 * S), leather, -0.45, 1.1, 0);
  add(new THREE.BoxGeometry(0.7 * S, 2.2 * S, 0.8 * S), leather, 0.45, 1.1, 0);
  add(new THREE.CylinderGeometry(1.0 * S, 1.25 * S, 2.8 * S, 8), tabard, 0, 3.4, 0);
  add(new THREE.CylinderGeometry(1.05 * S, 1.05 * S, 0.35 * S, 8), trim, 0, 2.5, 0);
  add(new THREE.SphereGeometry(0.75 * S, 10, 8), skin, 0, 5.35, 0);
  const helm = add(new THREE.SphereGeometry(0.85 * S, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 5.45, 0);
  helm.scale.y = 1.15;
  add(new THREE.BoxGeometry(0.18 * S, 0.8 * S, 0.2 * S), iron, 0, 5.3, 0.8);
  // quiver on the back
  const quiver = add(new THREE.CylinderGeometry(0.35 * S, 0.3 * S, 2.2 * S, 6), leather, -0.5, 4.0, -1.0);
  quiver.rotation.z = 0.35;
  // the bow arm: pivots at the shoulder; the bow is held out in front
  const bowArm = new THREE.Group();
  bowArm.position.set(0.95 * S, 4.4 * S, 0);
  body.add(bowArm);
  add(new THREE.CylinderGeometry(0.25 * S, 0.25 * S, 1.8 * S, 6), tabard, 0, 0, 0.9, bowArm).rotation.x = Math.PI / 2;
  const bow = add(new THREE.TorusGeometry(1.5 * S, 0.12 * S, 5, 14, Math.PI), wood, 0, 0, 1.9, bowArm);
  bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
  return { root, body, bowArm, yaw: 0, fall: 0, draw: 0, bob: Math.random() * 6 };
}

export function Garrison({ engine, model, group, fx }: { engine: GameEngine; model: CastleModel; group: RefObject<THREE.Group>; fx: Effects }) {
  const soldiers = useMemo(() => POSTS.map(() => buildSoldier()), []);
  const arrows = useMemo<Arrow[]>(
    () =>
      Array.from({ length: 28 }, () => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 7, 5), shaftMat);
        m.visible = false;
        return { m, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, delay: 0, dur: 0.4, live: false };
      }),
    [],
  );
  const root = useMemo(() => {
    const g = new THREE.Group();
    POSTS.forEach((p, i) => {
      const a = model.anchors[p.anchor];
      const s = soldiers[i]!;
      if (a) s.root.position.set(a.x + p.dx, a.y, a.z + p.dz);
      else s.root.visible = false;
      g.add(s.root);
    });
    for (const a of arrows) g.add(a.m);
    return g;
  }, [model, soldiers, arrows]);
  const lastSeq = useRef(-1);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  /** An enemy's chest, in the castle model's own units. */
  const targetLocal = (id: string): THREE.Vector3 | null => {
    const g = group.current;
    if (!g || !g.parent) return null;
    const en = engine.getRenderSnapshot().enemies.find((e) => e.id === id);
    if (!en) return null;
    const [x, , z] = worldToLocalGround(en.position);
    const h = en.boss?.isMainBoss ? 46 : 32;
    g.updateMatrixWorld();
    const w = g.parent.localToWorld(tmp.set(x, h, z));
    return g.worldToLocal(w.clone());
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const snap = engine.getRenderSnapshot();
    const gar = snap.garrison;
    const count = gar?.soldiers ?? 0;
    const stunned = !!gar?.stunned;
    const volley = gar?.volley ?? null;
    const aim = volley ? targetLocal(volley.targetId) : null;

    // a new volley: every soldier on its feet looses an arrow, a little staggered
    if (volley && volley.seq !== lastSeq.current) {
      const first = lastSeq.current < 0;
      lastSeq.current = volley.seq;
      if (aim && !first && !stunned) {
        for (let i = 0; i < count; i++) {
          const s = soldiers[i]!;
          if (!s.root.visible) continue;
          const a = arrows.find((x) => !x.live);
          if (!a) break;
          s.draw = 1;
          a.from.copy(s.root.position).add(new THREE.Vector3(0, 8, 0));
          a.to.copy(aim).add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
          a.t = 0;
          a.delay = Math.random() * 0.18;
          a.dur = 0.32 + a.from.distanceTo(a.to) / 420;
          a.live = true;
        }
      }
    }

    soldiers.forEach((s, i) => {
      const on = i < count && model.anchors[POSTS[i]!.anchor] !== undefined;
      s.root.visible = on;
      if (!on) return;
      // face the target while there is one, otherwise watch the road (+Z)
      let want = Math.sin(performance.now() / 2400 + s.bob) * 0.35;
      if (aim) want = Math.atan2(aim.x - s.root.position.x, aim.z - s.root.position.z);
      let d = want - s.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * Math.min(1, dt * 6);
      s.root.rotation.y = s.yaw;
      // knocked down by a boss blow; climbing back up after
      s.fall += ((stunned ? 1 : 0) - s.fall) * Math.min(1, dt * (stunned ? 7 : 1.6));
      s.body.rotation.x = -s.fall * 1.35;
      s.body.position.y = -s.fall * 2.2 + Math.sin(performance.now() / 500 + s.bob) * 0.08;
      // drawing the bow, then easing back
      s.draw = Math.max(0, s.draw - dt * 2.4);
      s.bowArm.rotation.x = -0.15 - (aim ? 0.35 : 0) - s.draw * 0.25;
      s.bowArm.rotation.z = s.draw * 0.25;
    });

    for (const a of arrows) {
      if (!a.live) continue;
      if (a.delay > 0) {
        a.delay -= dt;
        a.m.visible = false;
        continue;
      }
      a.t += dt / a.dur;
      if (a.t >= 1) {
        a.live = false;
        a.m.visible = false;
        // a little burst of sparks where it strikes
        const g = group.current;
        if (g && g.parent) {
          g.updateMatrixWorld();
          const hit = g.parent.worldToLocal(g.localToWorld(a.to.clone()));
          fx.glow.emit(hit, { count: 3, color: "#ffe2a0", colorEnd: "#a04a10", size: 2.2, life: 0.35, speed: 40, up: 10, radius: 2 });
        }
        continue;
      }
      // a shallow arc from the wall down onto the target
      const t = a.t;
      const p = a.from.clone().lerp(a.to, t);
      p.y += Math.sin(t * Math.PI) * a.from.distanceTo(a.to) * 0.12;
      const ahead = a.from.clone().lerp(a.to, Math.min(1, t + 0.04));
      ahead.y += Math.sin(Math.min(1, t + 0.04) * Math.PI) * a.from.distanceTo(a.to) * 0.12;
      a.m.position.copy(p);
      a.m.quaternion.setFromUnitVectors(up, ahead.sub(p).normalize());
      a.m.visible = true;
    }
  });

  return <primitive object={root} />;
}
