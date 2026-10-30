import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { HeadTracker } from './headTracker.js';

const canvas = document.querySelector('#overlay-canvas');
const status = document.querySelector('#overlay-status');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
camera.position.set(0, .35, 5.4);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2545, 2.1));
const light = new THREE.DirectionalLight(0xffe3c2, 2.3); light.position.set(-2, 3, 4); scene.add(light);
let mascot = null;
let tracker = null;
let target = new THREE.Vector2();
let pointerActive = false;
const raycaster = new THREE.Raycaster();

new GLTFLoader().load('/models/mascote.glb', ({ scene: model }) => {
  mascot = model;
  const bounds = new THREE.Box3().setFromObject(mascot);
  const size = bounds.getSize(new THREE.Vector3());
  mascot.scale.setScalar(2.25 / (size.y || 1));
  bounds.setFromObject(mascot);
  mascot.position.y -= (bounds.min.y + bounds.max.y) / 2;
  // Use the same front-facing orientation as the main HUD; do not rotate the entire body.
  mascot.rotation.y = Math.PI / 2;
  scene.add(mascot);
  tracker = new HeadTracker(mascot);
  if (status) status.textContent = 'Urfilig · mova o mouse';
}, undefined, (error) => {
  console.error('[mascote-overlay] modelo indisponível:', error);
  if (status) status.textContent = 'Modelo do mascote indisponível';
});

window.addEventListener('pointermove', (event) => {
  target.set((event.clientX / innerWidth) * 2 - 1, -((event.clientY / innerHeight) * 2 - 1));
  pointerActive = true;
});
void listen('mascot:mouse', (event) => {
  target.set(event.payload.x, event.payload.y);
  pointerActive = true;
});
window.addEventListener('pointerleave', () => { pointerActive = false; });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
document.querySelector('#overlay-close')?.addEventListener('click', () => getCurrentWindow().close());
canvas.addEventListener('pointerdown', () => getCurrentWindow().startDragging());
const clock = new THREE.Clock();
function animate() {
  const delta = Math.min(clock.getDelta(), .08);
  if (tracker) {
    raycaster.setFromCamera(target, camera);
    tracker.atualizarAlvoComRaycaster(raycaster);
    tracker.update(delta, pointerActive);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
