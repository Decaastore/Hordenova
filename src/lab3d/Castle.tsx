import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FOREST, GOLD } from "./palette";
import { CASTLE_POSITION_3D } from "./worldData";
import { terrainHeightAt } from "./Terrain";
import type { CastleHandle } from "./effectsTypes";

/**
 * LAST BASTION — the point the player defends (requirement 9). Not a
 * generic box: a walled gatehouse with two flanking towers, banners, and
 * torchlight, sitting exactly where the real 2D map's path actually ends.
 * `onReady` exposes a `pulseDamage()` the demo controller calls when a
 * creature reaches it — a real visual reaction (shake + red flash +
 * darkening) rather than nothing happening.
 */
export function Castle({ onReady }: { onReady?: (h: CastleHandle) => void }) {
  const [cx, cz] = CASTLE_POSITION_3D;
  const y = terrainHeightAt(cx, cz);
  const groupRef = useRef<THREE.Group | null>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const damageT = useRef(0);
  const torchARef = useRef<THREE.PointLight>(null);
  const torchBRef = useRef<THREE.PointLight>(null);

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (torchARef.current) torchARef.current.intensity = 0.9 + Math.sin(t * 9) * 0.2;
    if (torchBRef.current) torchBRef.current.intensity = 0.9 + Math.sin(t * 9 + 1.4) * 0.2;
    if (damageT.current > 0) {
      damageT.current = Math.max(0, damageT.current - dt * 3);
      if (groupRef.current) {
        groupRef.current.position.x = cx + Math.sin(damageT.current * 40) * damageT.current * 0.06;
      }
      if (flashRef.current) flashRef.current.intensity = damageT.current * 5;
    } else {
      if (groupRef.current) groupRef.current.position.x = cx;
      if (flashRef.current) flashRef.current.intensity = 0;
    }
  });

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        if (g && onReady) onReady({ pulseDamage: () => (damageT.current = 1) });
      }}
      position={[cx, y, cz]}
    >
      {/* gate wall */}
      <mesh position={[0, 1.1, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.9, 0.5]} />
        <meshStandardMaterial color={"#5a5145"} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.9, 1.3, 0.55]} />
        <meshStandardMaterial color={"#241b12"} roughness={1} />
      </mesh>

      {[-1.35, 1.35].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 1.55, -0.3]} castShadow>
            <cylinderGeometry args={[0.55, 0.65, 3.0, 8]} />
            <meshStandardMaterial color={"#665a48"} roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.15, -0.3]} castShadow>
            <coneGeometry args={[0.72, 0.9, 8]} />
            <meshStandardMaterial color={"#3a2f22"} roughness={0.85} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <mesh key={b} position={[Math.cos((b / 6) * Math.PI * 2) * 0.6, 3.05, -0.3 + Math.sin((b / 6) * Math.PI * 2) * 0.6]} castShadow>
              <boxGeometry args={[0.14, 0.16, 0.14]} />
              <meshStandardMaterial color={"#665a48"} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[x < 0 ? 0.66 : -0.66, 1.7, -0.3]} castShadow>
            <planeGeometry args={[0.32, 0.9]} />
            <meshStandardMaterial color={GOLD} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      <pointLight ref={torchARef} position={[-0.55, 0.9, 0.35]} color={FOREST.accentWarm} intensity={0.9} distance={2.4} />
      <pointLight ref={torchBRef} position={[0.55, 0.9, 0.35]} color={FOREST.accentWarm} intensity={0.9} distance={2.4} />
      <pointLight ref={flashRef} position={[0, 1.2, 0.4]} color={"#ff3a2a"} intensity={0} distance={5} />
    </group>
  );
}
