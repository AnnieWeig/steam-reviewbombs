import { camera, labelRenderer } from "./scene.js";

export const FIXED_PHI   = 1.2;
export const FIXED_THETA = 0.0;

/** Mutable orbit parameters — modify in place to update the view. */
export const spherical = { theta: FIXED_THETA, phi: FIXED_PHI, radius: 20 };
export const target    = new THREE.Vector3(0, 0, 0);

export function updateCamera() {
  camera.position.set(
    target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
    target.y + spherical.radius * Math.cos(spherical.phi),
    target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
  );
  camera.lookAt(target);
}

/** Remove all stale label DOM nodes so CSS2DRenderer re-positions them cleanly. */
export function resetLabelRenderer() {
  while (labelRenderer.domElement.firstChild)
    labelRenderer.domElement.removeChild(labelRenderer.domElement.firstChild);
}