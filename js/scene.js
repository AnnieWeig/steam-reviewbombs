import { CSS2DRenderer } from "./css2d.js";

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

export const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// WebGL renderer — alpha:true so AR mode can make it transparent
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x111111, 1);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.zIndex = "0";

// CSS2D label renderer
export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.style.cssText = "position:absolute;top:0;pointer-events:none;z-index:1;";
document.body.appendChild(labelRenderer.domElement);

// Shared raycaster + mouse vector
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
