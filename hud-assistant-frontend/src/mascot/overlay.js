import * as THREE from 'three';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen } from '@tauri-apps/api/event';
import { HeadTracker } from './headTracker.js';
import { carregarMascote } from './loader.js';
import { MascotStateMachine } from './stateMachine.js';

const canvas = document.querySelector('#overlay-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
camera.position.set(0, .24, 4.3);
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

carregarMascote('/models/mascote.glb', scene, 2.25).then(({ mascote, mixer: loadedMixer, clips }) => {
  mascot = mascote;
  mascot.position.set(0, -.92, 0);
  mascot.rotation.set(0, Math.PI / 2, 0);
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
  tracker = new HeadTracker(mascot, { distanciaAlvo: 4 });
}).catch((error) => {
  console.error('[mascote-overlay] modelo indisponível:', error);
});
void listen('mascot:mouse', (event) => {
  target.set(event.payload.x, event.payload.y);
  pointerActive = true;
});
const chatPanel = document.querySelector('#overlay-chat');
const chatToggle = document.querySelector('#overlay-chat-toggle');
const chatMessages = document.querySelector('#overlay-chat-messages');
const chatInput = document.querySelector('#overlay-chat-input');
function renderChatMessage(message) {
  if (!chatMessages || !message?.texto) return;
  chatMessages.querySelector('.overlay-chat-empty')?.remove();
  const item = document.createElement('article');
  item.className = message.autor === 'Você' ? 'overlay-chat-message usuario' : 'overlay-chat-message';
  const author = document.createElement('strong');
  author.textContent = message.autor || 'Urfilig';
  const text = document.createElement('p');
  text.textContent = message.texto;
  item.append(author, text);
  chatMessages.append(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
async function setChatOpen(open) {
  if (!chatPanel || !chatToggle) return;
  chatPanel.hidden = !open;
  chatToggle.setAttribute('aria-expanded', String(open));
  chatToggle.setAttribute('aria-label', open ? 'Fechar chat' : 'Abrir chat');
  if (open) {
    try {
      const overlayWindow = getCurrentWindow();
      await overlayWindow.setFocusable(true);
      await overlayWindow.setFocus();
      chatInput?.focus();
    } catch (error) {
      console.warn('[mascote-overlay] não foi possível habilitar o teclado do chat:', error);
    }
    void emit('mascot:chat-history-request');
  } else {
    void getCurrentWindow().setFocusable(false).catch(() => {});
  }
}
chatToggle?.addEventListener('click', () => setChatOpen(chatPanel?.hidden));
document.querySelector('#overlay-chat-close')?.addEventListener('click', () => setChatOpen(false));
document.querySelector('#overlay-chat-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput?.value.trim();
  if (!text) return;
  chatInput.value = '';
  void emit('mascot:chat-send', { text }).catch(() => renderChatMessage({ autor: 'Urfilig', texto: 'Não foi possível enviar. Confira se a janela principal está aberta.' }));
});
void listen('mascot:chat-message', (event) => renderChatMessage(event.payload));
void listen('mascot:chat-history', (event) => {
  if (!chatMessages) return;
  chatMessages.replaceChildren();
  const messages = Array.isArray(event.payload) ? event.payload.slice(-80) : [];
  if (!messages.length) {
    const empty = document.createElement('p');
    empty.className = 'overlay-chat-empty';
    empty.textContent = 'Ainda não há mensagens nesta conversa.';
    chatMessages.append(empty);
  } else messages.forEach(renderChatMessage);
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
