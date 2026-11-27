import type * as THREE from "three";

/**
 * In the published game, don't make the graphics card stop and report on
 * every shader it compiles: three.js's error check (`checkShaderErrors`)
 * forces each compile to finish on the spot, which froze the screen for
 * almost a second when a battle opened. The shaders are the same; the
 * check stays on while developing, where its messages are useful.
 */
export function tuneRenderer(gl: THREE.WebGLRenderer): void {
  if (!import.meta.env.DEV) gl.debug.checkShaderErrors = false;
}
