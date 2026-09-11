import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../rng";
import { getParticleSprite, getShardSprite } from "../proceduralTextures";

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
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }, [from, to]);

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
    <mesh ref={ref} position={from} quaternion={quaternion}>
      <sphereGeometry args={[0.085, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
      <pointLight color={color} intensity={2.2} distance={1.8} />
      {/* trailing streak behind the projectile head — gives the shot weight/speed instead of reading as a floating dot */}
      <mesh position={[0, 0, -0.22]} scale={[0.55, 0.55, 1.6]}>
        <sphereGeometry args={[0.075, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
      </mesh>
    </mesh>
  );
}

interface GlowSpec {
  v: [number, number, number];
  size: number;
}
interface DebrisSpec {
  v: [number, number, number];
  size: number;
  spin: number;
}

/**
 * Impact burst — split into two particle families so a hit reads as
 * "something physical broke" rather than just a colored glow: soft round
 * dust/energy motes (light gravity, fade out) plus a few angular debris
 * chips (heavier gravity, tumbling via SpriteMaterial.rotation, desaturated
 * toward rock/bone rather than the pure hit color) — on top of the ground
 * shockwave ring and impact flash light.
 */
function Burst({ at, color, onDone }: { at: [number, number, number]; color: number; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const debrisGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const life = useRef(0);
  const DURATION = 0.55;
  const GLOW_COUNT = 10;
  const DEBRIS_COUNT = 7;
  const glowSprite = getParticleSprite();
  const shardSprite = getShardSprite();
  const debrisColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color(0x33302c), 0.55).getHex(), [color]);

  const specs = useRef<GlowSpec[]>();
  const debrisSpecs = useRef<DebrisSpec[]>();
  if (!specs.current) {
    const rand = mulberry32(at[0] * 1000 + at[2] * 7 + (Date.now() % 997));
    specs.current = Array.from({ length: GLOW_COUNT }, () => {
      const a = rand() * Math.PI * 2;
      const speed = 1.4 + rand() * 1.8;
      return { v: [Math.cos(a) * speed, 1.6 + rand() * 1.8, Math.sin(a) * speed], size: 0.16 + rand() * 0.14 };
    });
    debrisSpecs.current = Array.from({ length: DEBRIS_COUNT }, () => {
      const a = rand() * Math.PI * 2;
      const speed = 1.8 + rand() * 2.6;
      return { v: [Math.cos(a) * speed, 1.2 + rand() * 2.4, Math.sin(a) * speed], size: 0.05 + rand() * 0.05, spin: (rand() - 0.5) * 14 };
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
        const spec = specs.current![i]!;
        if (!spec) return;
        const v = spec.v;
        child.position.set(v[0] * life.current, v[1] * life.current - 2.6 * life.current * life.current, v[2] * life.current);
        const sprite = child as THREE.Sprite;
        (sprite.material as THREE.SpriteMaterial).opacity = (1 - t) * 0.85;
        sprite.scale.setScalar((1 - t * 0.3) * spec.size);
      });
    }
    if (debrisGroupRef.current) {
      debrisGroupRef.current.children.forEach((child, i) => {
        const spec = debrisSpecs.current![i]!;
        if (!spec) return;
        const v = spec.v;
        child.position.set(v[0] * life.current, v[1] * life.current - 4.2 * life.current * life.current, v[2] * life.current);
        const sprite = child as THREE.Sprite;
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.opacity = 1 - t;
        mat.rotation += spec.spin * dt;
        sprite.scale.setScalar((1 - t * 0.2) * spec.size);
      });
    }
    if (ringRef.current) {
      const ringT = Math.min(1, t / 0.6);
      ringRef.current.scale.setScalar(0.15 + ringT * 2.2);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - ringT) * 0.6;
    }
    if (flashRef.current) flashRef.current.intensity = Math.max(0, 3.5 - t * 12);
  });

  return (
    <group position={at}>
      <group ref={groupRef}>
        {specs.current.map((_, i) => (
          <sprite key={i} scale={0.2}>
            <spriteMaterial map={glowSprite} color={color} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
      <group ref={debrisGroupRef}>
        {debrisSpecs.current!.map((_, i) => (
          <sprite key={i} scale={0.06}>
            <spriteMaterial map={shardSprite} color={debrisColor} transparent opacity={1} depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
      {/* ground shockwave — the "impacto que transmite força" cue, not just floating motes */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <ringGeometry args={[0.5, 0.68, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={flashRef} color={color} intensity={3.5} distance={3.5} />
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
