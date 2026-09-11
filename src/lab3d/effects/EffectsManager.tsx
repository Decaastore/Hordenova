import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../rng";

/**
 * TESTE VISUAL 3D — requirement 6 (attack VFX, death VFX, gold pickup)
 * implemented as a small pooled effect system: `fire`/`burst`/`sparkle`
 * push a descriptor into React state, each renders as its own
 * short-lived component that removes itself when its lifetime ends.
 * Deliberately restrained particle counts (requirement 6: "BELEZA +
 * LEITURA + PERFORMANCE", never an unreadable explosion) — a handful of
 * motes per event, not hundreds.
 */
export interface EffectsHandle {
  fireProjectile: (from: [number, number, number], to: [number, number, number], color: number, onImpact?: () => void) => void;
  burst: (at: [number, number, number], color: number) => void;
  goldSparkle: (at: [number, number, number]) => void;
}

let nextId = 1;

type Effect =
  | { id: number; kind: "projectile"; from: [number, number, number]; to: [number, number, number]; color: number; onImpact?: () => void }
  | { id: number; kind: "burst"; at: [number, number, number]; color: number }
  | { id: number; kind: "sparkle"; at: [number, number, number] };

export const EffectsManager = forwardRef<EffectsHandle>(function EffectsManager(_, ref) {
  const [effects, setEffects] = useState<Effect[]>([]);

  useImperativeHandle(ref, () => ({
    fireProjectile: (from, to, color, onImpact) => {
      setEffects((prev) => [...prev, { id: nextId++, kind: "projectile", from, to, color, onImpact }]);
    },
    burst: (at, color) => {
      setEffects((prev) => [...prev, { id: nextId++, kind: "burst", at, color }]);
    },
    goldSparkle: (at) => {
      setEffects((prev) => [...prev, { id: nextId++, kind: "sparkle", at }]);
    },
  }));

  const remove = (id: number) => setEffects((prev) => prev.filter((e) => e.id !== id));

  return (
    <group>
      {effects.map((e) => {
        if (e.kind === "projectile") return <Projectile key={e.id} {...e} onDone={() => remove(e.id)} />;
        if (e.kind === "burst") return <Burst key={e.id} {...e} onDone={() => remove(e.id)} />;
        return <GoldSparkle key={e.id} {...e} onDone={() => remove(e.id)} />;
      })}
    </group>
  );
});

function Projectile({
  from,
  to,
  color,
  onImpact,
  onDone,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: number;
  onImpact?: () => void;
  onDone: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const done = useRef(false);
  const DURATION = 0.32;

  useFrame((_, dt) => {
    t.current += dt / DURATION;
    if (t.current >= 1) {
      if (!done.current) {
        done.current = true;
        onImpact?.();
        onDone();
      }
      return;
    }
    if (ref.current) {
      const arc = Math.sin(t.current * Math.PI) * 0.6;
      ref.current.position.set(
        THREE.MathUtils.lerp(from[0], to[0], t.current),
        THREE.MathUtils.lerp(from[1], to[1], t.current) + arc,
        THREE.MathUtils.lerp(from[2], to[2], t.current),
      );
    }
  });

  return (
    <mesh ref={ref} position={from}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshBasicMaterial color={color} toneMapped={false} />
      <pointLight color={color} intensity={1.2} distance={1.2} />
    </mesh>
  );
}

function Burst({ at, color, onDone }: { at: [number, number, number]; color: number; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const life = useRef(0);
  const DURATION = 0.5;
  const velocities = useRef<[number, number, number][]>();
  if (!velocities.current) {
    const rand = mulberry32(at[0] * 1000 + at[2] * 7 + Date.now() % 997);
    velocities.current = Array.from({ length: 10 }, () => {
      const a = rand() * Math.PI * 2;
      const speed = 1.2 + rand() * 1.4;
      return [Math.cos(a) * speed, 1.4 + rand() * 1.6, Math.sin(a) * speed];
    });
  }

  useFrame((_, dt) => {
    life.current += dt;
    const t = life.current / DURATION;
    if (t >= 1) {
      onDone();
      return;
    }
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const v = velocities.current![i]!;
        child.position.set(v[0] * life.current, v[1] * life.current - 2.2 * life.current * life.current, v[2] * life.current);
        const mesh = child as THREE.Mesh;
        (mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
        mesh.scale.setScalar(1 - t * 0.4);
      });
    }
  });

  return (
    <group ref={groupRef} position={at}>
      {velocities.current.map((_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[0.05, 0]} />
          <meshBasicMaterial color={color} transparent opacity={1} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function GoldSparkle({ at, onDone }: { at: [number, number, number]; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const life = useRef(0);
  const DURATION = 0.7;

  useFrame((_, dt) => {
    life.current += dt;
    const t = life.current / DURATION;
    if (t >= 1) {
      onDone();
      return;
    }
    if (groupRef.current) {
      groupRef.current.position.y = at[1] + t * 0.7;
      groupRef.current.rotation.y += dt * 6;
      groupRef.current.children.forEach((child) => {
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - t;
      });
    }
  });

  return (
    <group ref={groupRef} position={at}>
      <mesh>
        <octahedronGeometry args={[0.09, 0]} />
        <meshBasicMaterial color={0xffd257} transparent opacity={1} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.14, 0.05, Math.sin((i / 3) * Math.PI * 2) * 0.14]}>
          <sphereGeometry args={[0.025, 5, 5]} />
          <meshBasicMaterial color={0xfff2c9} transparent opacity={1} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
