import * as THREE from 'three';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { HeadTracker } from './headTracker.js';
import { carregarMascote } from './loader.js';
import { MascotStateMachine } from './stateMachine.js';

const canvas = document.querySelector('#overlay-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
camera.position.set(0, .72, 5.4);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const light = new THREE.DirectionalLight(0xffedd5, 1.8);
light.position.set(-3.5, 2, 12); light.target.position.set(-4.5, -2, 8);
scene.add(light, light.target);
let mascot = null;
let tracker = null;
let mixer = null;
let mascotStateMachine = null;
let target = new THREE.Vector2();
let pointerActive = false;
const raycaster = new THREE.Raycaster();

carregarMascote('/models/mascote.glb', scene, 1.6).then(({ mascote, mixer: loadedMixer, clips }) => {
  mascot = mascote;
  mascot.position.set(0, -.42, 0);
  mascot.rotation.set(0, 0, 0);
  mascot.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.metalness = 0;
      material.roughness = .85;
      if (material.emissive) { material.emissive.setHex(0); material.emissiveIntensity = 0; }
    });
  });
  mixer = loadedMixer;
  mascotStateMachine = new MascotStateMachine(mixer, clips);
  tracker = new HeadTracker(mascot);
}).catch((error) => {
  console.error('[mascote-overlay] modelo indisponível:', error);
});
void listen('mascot:mouse', (event) => {
  target.set(event.payload.x, event.payload.y);
  pointerActive = true;
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
document.querySelector('#overlay-close')?.addEventListener('click', () => getCurrentWindow().close());
canvas.addEventListener('pointerdown', () => getCurrentWindow().startDragging());
const clock = new THREE.Clock();
function animate() {
  const delta = Math.min(clock.getDelta(), .08);
  mixer?.update(delta);
  if (tracker) {
    raycaster.setFromCamera(target, camera);
    tracker.atualizarAlvoComRaycaster(raycaster);
    tracker.update(delta, pointerActive);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
