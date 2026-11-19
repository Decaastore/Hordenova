import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import type { Effects } from "@/battlefield3d/fx";
import { builtBuildings, type CityBuildingId } from "@/config/city";
import { getCityPlots, type CityPlot } from "@/data/cityPlots";
import { getMapLayout } from "@/data/mapLayouts";
import { buildCityModel, setCharred, type CityModel } from "@/battlefield3d/models/cityModels";
import { worldToLocalGround } from "@/rendering3d/enemyProjection";

/**
 * THE CITY IN 3D (config/city.ts, data/cityPlots.ts) — the buildings behind
 * the castle as real models (battlefield3d/models/cityModels.ts), and the
 * people who live there: little townsfolk strolling from door to door,
 * stopping to chat, smoke curling from the chimneys. When a building
 * catches fire it blackens and burns, the people nearby flee from it with
 * their arms up, and a few run back and forth with buckets from the
 * nearest well-door to throw water on the flames. A newly raised building
 * grows up out of the ground in a puff of dust.
 */

const VILLAGERS_PER_BUILDING = 3;
const MAX_VILLAGERS = 22;
const WALK = 9;
const RUN = 34;
/** Model units to scene units: the buildings stand about half the castle's width. */
const CITY_SCALE = 1.75;
const PERSON_SCALE = 1.8;

interface Placed {
  id: CityBuildingId;
  plot: CityPlot;
  model: CityModel;
  group: THREE.Group;
  /** Door and fire points in the scene's ground space. */
  door: THREE.Vector3;
  fire: THREE.Vector3[];
  rise: number;
  char: number;
}

interface Villager {
  root: THREE.Group;
  legs: [THREE.Object3D, THREE.Object3D];
  arms: [THREE.Object3D, THREE.Object3D];
  bucket: THREE.Object3D;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  wait: number;
  phase: number;
  role: "walk" | "flee" | "bucket";
  /** Bucket runners: full (heading to the fire) or empty (heading back). */
  full: boolean;
  home: number;
}

const CLOTHES = ["#7a3a2a", "#3a5a8a", "#5a7a3a", "#8a6a3a", "#6a3a6a", "#4a4a4a", "#9a8a6a", "#2a6a6a"];
const SKIN = ["#e0b090", "#c89070", "#a87050", "#f0c8a8"];

function buildVillager(i: number): Villager {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: CLOTHES[i % CLOTHES.length], roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[i % SKIN.length], roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: "#2a1e14", roughness: 0.9 });
  const S = 1.1 * PERSON_SCALE;
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x * S, y * S, z * S);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const leg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * S, 2.2 * S, 0);
    root.add(pivot);
    part(new THREE.BoxGeometry(0.6 * S, 2.2 * S, 0.7 * S), dark, 0, -1.1, 0, pivot);
    return pivot;
  };
  const arm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * S, 4.6 * S, 0);
    root.add(pivot);
    part(new THREE.BoxGeometry(0.45 * S, 2 * S, 0.5 * S), cloth, 0, -1, 0, pivot);
    part(new THREE.SphereGeometry(0.32 * S, 6, 5), skin, 0, -2.1, 0, pivot);
    return pivot;
  };
  const legs: [THREE.Object3D, THREE.Object3D] = [leg(-0.4), leg(0.4)];
  part(new THREE.CylinderGeometry(0.9 * S, 1.15 * S, 2.8 * S, 8), cloth, 0, 3.4, 0);
  part(new THREE.SphereGeometry(0.72 * S, 10, 8), skin, 0, 5.5, 0);
  // hair or a hood
  const hair = part(new THREE.SphereGeometry(0.76 * S, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 3 === 0 ? cloth : dark, 0, 5.6, -0.05);
  hair.scale.y = 0.9;
  const arms: [THREE.Object3D, THREE.Object3D] = [arm(-1.05), arm(1.05)];
  const bucket = part(new THREE.CylinderGeometry(0.7 * S, 0.55 * S, 1.1 * S, 8), new THREE.MeshStandardMaterial({ color: "#7a5a3a", roughness: 0.8 }), 0, -2.6, 0.2, arms[1]);
  bucket.visible = false;
  return { root, legs, arms, bucket, pos: new THREE.Vector3(), target: new THREE.Vector3(), wait: Math.random() * 3, phase: Math.random() * 6, role: "walk", full: true, home: i };
}

function ground(p: { x: number; y: number }): THREE.Vector3 {
  const [x, y, z] = worldToLocalGround(p);
  return new THREE.Vector3(x, y, z);
}

export function City3D({ engine, fx }: { engine: GameEngine; fx: Effects }) {
  const snap0 = engine.getRenderSnapshot();
  const layout = getMapLayout(snap0.biomeId);
  const plots = useMemo(() => getCityPlots(layout), [layout]);
  const root = useMemo(() => new THREE.Group(), []);
  const placed = useRef(new Map<CityBuildingId, Placed>());
  const villagers = useMemo(() => Array.from({ length: MAX_VILLAGERS }, (_, i) => buildVillager(i)), []);
  const smokeT = useRef(0);
  const fireT = useRef(0);

  useEffect(() => {
    for (const v of villagers) {
      v.root.visible = false;
      root.add(v.root);
    }
    return () => {
      root.clear();
      placed.current.clear();
    };
  }, [root, villagers]);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const hud = engine.getHudSnapshot();
    const built = new Set(builtBuildings(hud.seasonBestWave).map((b) => b.id));
    const burning = hud.city.burning;

    // raise / remove buildings
    for (const plot of plots) {
      const have = placed.current.get(plot.id);
      if (built.has(plot.id) && !have) {
        const model = buildCityModel(plot.id, plot.id.length * 31 + Math.round(plot.position.x));
        const group = new THREE.Group();
        group.add(model.root);
        const at = ground(plot.position);
        group.position.copy(at);
        // facing the camera, turned a little so the town doesn't look stamped out
        group.rotation.y = Math.PI + (plot.flip ? 0.22 : -0.22);
        group.scale.setScalar(CITY_SCALE);
        root.add(group);
        group.updateMatrixWorld(true);
        const toScene = (v: THREE.Vector3) => v.clone().applyMatrix4(model.root.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
        root.updateMatrixWorld(true);
        const fresh = placed.current.size > 0 || performance.now() > 4000;
        placed.current.set(plot.id, {
          id: plot.id,
          plot,
          model,
          group,
          door: toScene(model.door),
          fire: model.firePoints.map(toScene),
          rise: fresh ? 0 : 1,
          char: 0,
        });
        if (fresh) fx.smoke.emit(at.clone().add(new THREE.Vector3(0, 3, 0)), { count: 18, color: "#b8a888", colorEnd: "#6a5a48", size: 18, life: 1.6, speed: 30, up: 6, grow: 2, alpha: 0.5, drag: 2, radius: 14 });
      } else if (!built.has(plot.id) && have) {
        root.remove(have.group);
        placed.current.delete(plot.id);
      }
    }

    const list = [...placed.current.values()];
    smokeT.current += dt;
    fireT.current += dt;
    const puff = smokeT.current > 0.45;
    if (puff) smokeT.current = 0;
    const flame = fireT.current > 0.09;
    if (flame) fireT.current = 0;

    for (const p of list) {
      // growing out of the ground
      if (p.rise < 1) {
        p.rise = Math.min(1, p.rise + dt / 1.4);
        const e = 1 - Math.pow(1 - p.rise, 3);
        p.group.scale.set(CITY_SCALE, CITY_SCALE * (0.15 + 0.85 * e), CITY_SCALE);
      }
      const isBurning = (burning[p.id] ?? 0) > 0;
      p.char += ((isBurning ? 1 : 0) - p.char) * Math.min(1, dt * (isBurning ? 1.6 : 0.4));
      setCharred(p.model, p.char);
      const crystal = p.model.root.getObjectByName("crystal");
      if (crystal) {
        crystal.rotation.y += dt * 0.8;
        crystal.position.y = 61 + Math.sin(performance.now() / 600) * 0.8;
      }
      if (isBurning) {
        if (flame) {
          for (const f of p.fire) {
            fx.glow.emit(f, { count: 5, color: "#fff1a0", colorEnd: "#ff3a0a", size: 13, life: 0.8, speed: 12, up: 34, grow: 1.4, drag: 2, radius: 7 });
            if (Math.random() < 0.3) fx.glow.emit(f, { count: 2, color: "#ffb347", colorEnd: "#ff2a00", size: 1.6, life: 1.4, speed: 18, up: 40, drag: 0.6, radius: 3 });
          }
        }
        if (puff) for (const f of p.fire) fx.smoke.emit(f.clone().add(new THREE.Vector3(0, 6, 0)), { count: 2, color: "#2a2420", colorEnd: "#0e0c0a", size: 16, life: 3.2, speed: 6, up: 20, grow: 2.6, alpha: 0.6, drag: 0.4, radius: 4 });
      } else if (puff && p.rise >= 1) {
        // chimney smoke and the forge's sparks
        for (const c of p.model.chimneys) {
          const at = c.clone().applyMatrix4(p.model.root.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
          fx.smoke.emit(at, { count: 1, color: "#d8d0c8", colorEnd: "#8a8480", size: 5, life: 3, speed: 2, up: 9, grow: 2.2, alpha: 0.35, drag: 0.3, radius: 0.6 });
        }
        for (const g of p.model.glows) {
          const at = g.at.clone().applyMatrix4(p.model.root.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
          fx.glow.emit(at, { count: 1, color: "#ffffff", colorEnd: g.color, size: 2.2, life: 0.7, speed: 8, up: 10, drag: 1, radius: 1 });
        }
      }
    }

    // ---- the townsfolk ----
    const fires = list.filter((p) => (burning[p.id] ?? 0) > 0);
    const want = Math.min(MAX_VILLAGERS, list.filter((p) => p.rise >= 1).length * VILLAGERS_PER_BUILDING);
    const doors = list.map((p) => p.door);
    villagers.forEach((v, i) => {
      const active = i < want && doors.length > 0;
      if (!active) {
        v.root.visible = false;
        return;
      }
      if (!v.root.visible) {
        // step out of a door
        const d = doors[i % doors.length]!;
        v.pos.copy(d).add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
        v.target.copy(v.pos);
        v.root.visible = true;
      }
      // who does what while something burns: the nearest few fetch water, everyone near it flees
      const nearestFire = fires.reduce<Placed | null>((best, f) => (!best || f.door.distanceTo(v.pos) < best.door.distanceTo(v.pos) ? f : best), null);
      const prevRole = v.role;
      if (nearestFire && nearestFire.door.distanceTo(v.pos) < 170) v.role = i % 3 === 0 ? "bucket" : "flee";
      else v.role = "walk";
      if (v.role !== prevRole) v.wait = 0;

      let speed = WALK;
      if (v.role === "flee" && nearestFire) {
        speed = RUN;
        if (v.pos.distanceTo(v.target) < 3 || prevRole !== "flee") {
          // away from the flames, towards another building's door
          const away = v.pos.clone().sub(nearestFire.door).setY(0).normalize();
          const options = list.filter((p) => p !== nearestFire);
          const pick = options.sort((a, b) => b.door.clone().sub(nearestFire.door).normalize().dot(away) - a.door.clone().sub(nearestFire.door).normalize().dot(away))[0];
          v.target.copy(pick ? pick.door : v.pos.clone().addScaledVector(away, 80)).add(new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16));
        }
      } else if (v.role === "bucket" && nearestFire) {
        speed = RUN * 0.8;
        const well = list.filter((p) => p !== nearestFire).sort((a, b) => a.door.distanceTo(nearestFire.door) - b.door.distanceTo(nearestFire.door))[0]?.door ?? nearestFire.door.clone().add(new THREE.Vector3(40, 0, 0));
        const fireSpot = nearestFire.door.clone().add(new THREE.Vector3(0, 0, 0));
        if (prevRole !== "bucket") v.full = false;
        v.target.copy(v.full ? fireSpot : well);
        if (v.pos.distanceTo(v.target) < 4) {
          if (v.full) {
            // splash!
            fx.glow.emit(nearestFire.fire[0] ?? fireSpot, { count: 8, color: "#e8f4ff", colorEnd: "#4a8ad8", size: 2.4, life: 0.5, speed: 30, up: 14, gravity: 60, radius: 3 });
            fx.smoke.emit((nearestFire.fire[0] ?? fireSpot).clone(), { count: 3, color: "#f0f0f0", colorEnd: "#a0a0a0", size: 12, life: 1.4, speed: 8, up: 16, grow: 2, alpha: 0.45, radius: 3 });
          }
          v.full = !v.full;
        }
      } else {
        // strolling from door to door, stopping for a while at each
        if (v.pos.distanceTo(v.target) < 2) {
          v.wait -= dt;
          speed = 0;
          if (v.wait <= 0) {
            const d = doors[Math.floor(Math.random() * doors.length)]!;
            v.target.copy(d).add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14));
            v.wait = 1.5 + Math.random() * 4;
          }
        }
      }
      v.bucket.visible = v.role === "bucket";

      const to = v.target.clone().sub(v.pos).setY(0);
      const dist = to.length();
      if (dist > 0.5 && speed > 0) {
        v.pos.addScaledVector(to.normalize(), Math.min(dist, speed * dt));
        const yaw = Math.atan2(to.x, to.z);
        let dy = yaw - v.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        v.root.rotation.y += dy * Math.min(1, dt * 10);
        v.phase += dt * (speed > WALK ? 16 : 7);
      } else {
        v.phase += dt * 1.2;
      }
      const moving = dist > 0.5 && speed > 0;
      const swing = moving ? Math.sin(v.phase) * (speed > WALK ? 0.9 : 0.5) : 0;
      v.legs[0].rotation.x = swing;
      v.legs[1].rotation.x = -swing;
      if (v.role === "flee") {
        // arms flung up in panic
        v.arms[0].rotation.x = Math.PI * 0.85 + Math.sin(v.phase * 1.3) * 0.3;
        v.arms[1].rotation.x = Math.PI * 0.85 - Math.sin(v.phase * 1.3) * 0.3;
        v.arms[0].rotation.z = -0.3;
        v.arms[1].rotation.z = 0.3;
      } else {
        v.arms[0].rotation.x = -swing * 0.8;
        v.arms[1].rotation.x = v.role === "bucket" ? -0.4 : swing * 0.8;
        v.arms[0].rotation.z = 0;
        v.arms[1].rotation.z = 0;
      }
      v.root.position.set(v.pos.x, Math.abs(Math.sin(v.phase)) * (moving ? (speed > WALK ? 0.7 : 0.25) : 0), v.pos.z);
    });
  });

  return <primitive object={root} />;
}
