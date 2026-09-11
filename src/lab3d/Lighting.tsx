import { useMemo } from "react";
import * as THREE from "three";
import { FOREST } from "./palette";
import { mulberry32 } from "./rng";

/**
 * TESTE VISUAL 3D — requirement 7 (cinematic lighting): a warm low-angle
 * "sun" casting real shadows, a cool sky-tinted ambient fill (hemisphere
 * light, so shadowed faces read as sky-lit blue-green rather than flat
 * black), exponential fog tinted to the Ancient Forest palette (depth +
 * atmosphere), and a handful of soft additive light-shaft cones standing
 * in for sunlight breaking through canopy — the exact "luz atravessando
 * as árvores" cue requirement 3's forest bullet list asks for.
 */
export function Lighting() {
  const shafts = useMemo(() => {
    const rand = mulberry32(555);
    return Array.from({ length: 5 }, () => ({
      x: (rand() - 0.5) * 30,
      z: (rand() - 0.5) * 20,
      rot: (rand() - 0.5) * 0.3,
      scale: 0.7 + rand() * 0.6,
    }));
  }, []);

  return (
    <>
      <color attach="background" args={[FOREST.skyBottom]} />
      <fogExp2 attach="fog" args={[FOREST.fog, 0.028]} />

      {/* Lower ambient/hemisphere fill than a "safe", evenly-lit scene would
          use — real contrast (bright hot spots, genuinely dark recesses)
          rather than flat, toylike lighting — but not so low the scene reads
          as a murky brown wash; the directional key light carries most of
          the exposure. */}
      <hemisphereLight args={[FOREST.skyTop, FOREST.groundShadowed, 0.65]} />
      <ambientLight color={FOREST.skyTop} intensity={0.3} />

      <directionalLight
        position={[14, 18, 8]}
        intensity={2.6}
        color={FOREST.accentWarm}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0018}
      />
      {/* Cool neutral rim/back light from the opposite side — separates
          silhouettes from the background without washing the whole scene
          in the toxic-green magic accent. That green stays reserved for
          actual magic sources (rune-cores, crystals, attacks) via their
          own localized emissives/point-lights, per the palette's own
          comment: "used sparingly so towers/enemies/VFX still pop." */}
      <directionalLight position={[-11, 7, -9]} intensity={0.5} color={FOREST.waterLight} />

      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, 6, s.z]} rotation={[0.18, s.rot, 0]}>
          <coneGeometry args={[1.6 * s.scale, 12, 10, 1, true]} />
          <meshBasicMaterial
            color={FOREST.accentWarm}
            transparent
            opacity={0.045}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  );
}
