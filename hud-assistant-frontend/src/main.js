import './windowChrome.js';
import './loadingIndicator.js';
import { getTimeColor } from './timeTheme.js';
import { invoke, isTauri } from '@tauri-apps/api/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { PersonalitySphere } from './personalitySphere.js';
import { carregarMascote } from './mascot/loader.js';
import { MascotMotionController } from './mascot/float.js';
import { encontrarMeshComMorphTargets, setExpression } from './mascot/expressions.js';
import { MascotStateMachine } from './mascot/stateMachine.js';
import { conectarSocket } from './socketClient.js';
import { falar } from './voice/ttsManager.js';
import { exigirLogin, validarSessao, sair, BACKEND_URL } from './authGuard.js';
import { iniciarMenuLateral } from './sideMenu.js';
import { iniciarProspeccao } from './prospeccao.js';
import { iniciarDevAgent } from './devAgent.js';
import { tentarAtalhoFerramentaChat } from './chatToolBridge.js';
import { iniciarSpotify } from './spotify.js';
import { carregarCalendarioUI } from './calendario.js';
import { iniciarModuloContatos } from './contatos.js';
import { iniciarQuadrosRotina } from './routineBoards.js';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emitTo, listen as listenTauri } from '@tauri-apps/api/event';
import { adicionarMensagemChat, iniciarNovaConversaChat, inicializarConversasChat, lerHistoricoChat, mostrarIndicadorPensando, ocultarIndicadorPensando, renderizarListaConversasChat, restaurarHistoricoChat, rolarChatParaFim } from './chatHistory.js';

// Camada final do chat: aplicada pelo JavaScript para não ser sobrescrita pelos temas globais.
function aplicarVisualFinalDoChat() {
  if (document.getElementById('urfilig-chat-visual-final')) return;
  const estilo = document.createElement('style');
  estilo.id = 'urfilig-chat-visual-final';
  estilo.textContent = `
    #chat-painel { z-index: 10040 !important; }
    /* O canvas frontal é irmão do chat. Camadas globais devem ficar acima dele. */
    #menu-backdrop, .menu-backdrop, .profile-backdrop { z-index: 10049 !important; }
    #menu-lateral, .menu-lateral, .profile-drawer, .sidebar-cerebro, .sidebar,
    #email-painel, #routine-sidebar-list:not([hidden]) { z-index: 10050 !important; }
    #modal-backdrop { z-index: 10059 !important; }
    #obsidian-modal, .intel-modal, .microfone-modal, .routine-modal-backdrop,
    .modal-overlay, .folder-move-backdrop, #modal-nota-detalhes, #modal-contato-form,
    #modal-evento-overlay, #urfilig-context-menu,
    body > div[style*="z-index: 10000"] { z-index: 10060 !important; }
    /* Mesmo timing do menu lateral: o painel fica montado e a classe muda apenas seu estado visual. */
    #chat-historico.chat-historico-direita {
      position: fixed !important; inset: auto !important; top: 50vh !important; left: 50vw !important;
      width: min(920px, calc(100vw - var(--rail-width) - 72px)) !important;
      height: min(610px, calc(100vh - 190px)) !important; min-height: 400px !important;
      margin: 0 !important; overflow: hidden !important;
      padding-bottom: 82px !important; box-sizing: border-box !important;
      opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;
      transform: translate3d(calc(-50% + var(--chat-origem-x, 0px)), calc(-50% + var(--chat-origem-y, 0px)), 0) scale(.24) !important;
      transform-origin: center center !important;
      transition: transform .26s cubic-bezier(.22, 1, .36, 1), opacity .16s ease, visibility 0s linear .26s, border-radius .26s cubic-bezier(.22, 1, .36, 1) !important;
      animation: none !important;
      background: rgba(12,18,40,.045) !important;
      border: 0 !important;
      border-radius: 30px !important;
      box-shadow: 0 22px 58px rgba(0,0,0,.22) !important;
      backdrop-filter: blur(20px) saturate(118%) !important; -webkit-backdrop-filter: blur(20px) saturate(118%) !important;
    }
    #chat-historico.chat-historico-direita.chat-aberto {
      opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;
      transform: translate3d(-50%, -50%, 0) scale(1) !important;
      border-radius: 30px !important;
      transition: transform .26s cubic-bezier(.22, 1, .36, 1), opacity .16s ease, visibility 0s linear 0s, border-radius .26s cubic-bezier(.22, 1, .36, 1) !important;
    }
    #chat-historico.chat-historico-direita.is-chat-closing { pointer-events: none !important; }
    #chat-historico .chat-historico-header,
    #chat-historico .chat-conversation-workspace,
    #chat-historico .chat-current-conversation { background: transparent !important; }
    #chat-historico .chat-conversations-panel { background: transparent !important; border-right-color: rgba(255,255,255,.10) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    #chat-historico .chat-conversations-heading { color: rgba(226,232,240,.38) !important; }
    #chat-sidebar-history, #chat-sidebar-conversation-list { background: transparent !important; }
    #chat-historico .chat-conversation-item, #chat-sidebar-history .chat-conversation-item {
      display: flex !important; flex-direction: column !important; gap: .22rem !important; appearance: none !important;
      background: transparent !important; background-color: transparent !important; background-image: none !important;
      border: 1px solid transparent !important; color: rgba(237,242,255,.64) !important; box-shadow: none !important;
    }
    #chat-historico .chat-conversation-item::before, #chat-historico .chat-conversation-item::after,
    #chat-sidebar-history .chat-conversation-item::before, #chat-sidebar-history .chat-conversation-item::after { content: none !important; display: none !important; }
    #chat-historico .chat-conversation-item small, #chat-sidebar-history .chat-conversation-item small { display: none !important; }
    #chat-historico .chat-conversation-item time, #chat-sidebar-history .chat-conversation-item time { color: rgba(226,232,240,.38) !important; font-size: .69rem !important; }
    #chat-historico .chat-conversation-item:hover, #chat-sidebar-history .chat-conversation-item:hover { background: transparent !important; background-image: none !important; border-color: rgba(255,255,255,.065) !important; color: rgba(255,255,255,.90) !important; }
    #chat-historico .chat-conversation-item.ativa, #chat-sidebar-history .chat-conversation-item.ativa { background: transparent !important; background-image: none !important; border-color: rgba(255,255,255,.10) !important; color: #fff !important; box-shadow: none !important; }
    #chat-historico .chat-conversation-title, #chat-sidebar-history .chat-conversation-title { color: inherit !important; }
    #chat-historico #chat-mensagens { background: transparent !important; }
    #chat-historico .chat-msg.urfilig { background: rgba(255,255,255,.014) !important; border: 0 !important; box-shadow: 0 8px 20px rgba(4,8,22,.045) !important; backdrop-filter: blur(5px) !important; -webkit-backdrop-filter: blur(5px) !important; }
    #chat-historico .chat-msg.usuario { background: rgba(116,82,192,.026) !important; border: 0 !important; box-shadow: 0 8px 20px rgba(94,65,157,.045) !important; backdrop-filter: blur(5px) !important; -webkit-backdrop-filter: blur(5px) !important; }
    #chat-historico .chat-conversations-panel, #chat-historico #chat-mensagens { scrollbar-width: thin !important; scrollbar-color: rgba(255,255,255,.34) transparent !important; }
    #chat-historico .chat-conversations-panel::-webkit-scrollbar, #chat-historico #chat-mensagens::-webkit-scrollbar { width: 7px !important; }
    #chat-historico .chat-conversations-panel::-webkit-scrollbar-track, #chat-historico #chat-mensagens::-webkit-scrollbar-track { background: transparent !important; }
    #chat-historico .chat-conversations-panel::-webkit-scrollbar-thumb, #chat-historico #chat-mensagens::-webkit-scrollbar-thumb { background: rgba(255,255,255,.28) !important; border: 2px solid transparent !important; border-radius: 99px !important; background-clip: padding-box !important; }
    #chat-historico .chat-conversations-panel::-webkit-scrollbar-thumb:hover, #chat-historico #chat-mensagens::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.48) !important; background-clip: padding-box !important; }
    #chat-historico .chat-resposta-acao,
    #chat-historico .chat-resposta-acao:hover,
    #chat-historico .chat-resposta-acao:focus,
    #chat-historico .chat-resposta-acao:active,
    #chat-historico .chat-resposta-acao:disabled {
      background: transparent !important; border: 0 !important; box-shadow: none !important; outline: 0 !important;
      width: 26px !important; height: 26px !important; padding: 0 !important; color: rgba(235,241,255,.88) !important;
    }
    #chat-historico .chat-resposta-acao:hover { color: #fff !important; transform: scale(1.12) !important; }
    #chat-historico .chat-resposta-acao.esta-ouvindo { color: #d8c7ff !important; animation: urfiligIconeOuvindo .85s ease-in-out infinite !important; }
    #chat-historico .chat-resposta-acao svg { width: 17px !important; height: 17px !important; pointer-events: none !important; }
    /* A barra e seus controles são independentes da janela do histórico. */
    #chat-restaurar {
      display: none !important;
      width: 52px !important; height: 52px !important; min-width: 52px !important; min-height: 52px !important;
      padding: 0 !important; box-sizing: border-box !important; border-radius: 50% !important; overflow: hidden !important;
      align-items: center !important; justify-content: center !important;
      transform: none !important; isolation: isolate !important;
    }
    #chat-restaurar svg { display: block !important; width: 22px !important; height: 22px !important; flex: 0 0 22px !important; }
    #chat-restaurar[hidden] { display: none !important; }
    #chat-restaurar:hover { transform: translateY(-2px) !important; }
    /* Barra permanente: não pertence à janela do histórico, fica sempre no centro inferior. */
    #chat-composer {
      position: fixed !important; z-index: 10042 !important; left: 50vw !important; top: calc(50% + 12px) !important; bottom: auto !important;
      width: min(740px, calc(100vw - var(--rail-width) - 48px)) !important; transform: translate(-50%, -50%) !important;
      display: flex !important; align-items: center !important; gap: 9px !important; pointer-events: auto !important;
    }
    #chat-composer .chat-form-inferior {
      position: relative !important; z-index: auto !important; left: auto !important; bottom: auto !important; top: auto !important;
      flex: 1 1 auto !important; width: auto !important; min-width: 0 !important; height: 132px !important; min-height: 132px !important; box-sizing: border-box !important;
      display: grid !important; grid-template-columns: minmax(0,1fr) !important; grid-template-rows: 20px minmax(24px,1fr) 34px !important;
      transform: none !important; padding: 14px 16px 12px !important; gap: 5px 8px !important; align-items: center !important;
      border-radius: 30px !important; background: var(--composer-surface) !important;
      border: 0 !important; box-shadow: none !important;
      backdrop-filter: blur(24px) saturate(120%) !important; -webkit-backdrop-filter: blur(24px) saturate(120%) !important;
    }
    #chat-composer .chat-form-inferior::before { content: none !important; }
    #chat-composer #chat-input { grid-column: 1 / -1 !important; grid-row: 2 !important; align-self: start !important; height: 30px !important; padding: 0 !important; color: var(--text-primary) !important; background: transparent !important; border: 0 !important; box-shadow: none !important; font-size: .86rem !important; line-height: 1.2 !important; }
    #chat-composer .chat-btn-enviar { min-height: 32px !important; margin-left: 2px !important; padding: 5px 14px !important; border-radius: 17px !important; font-size: .72rem !important; }
    #chat-composer .chat-composer-actions { grid-column: 1 !important; grid-row: 3 !important; display: flex !important; align-items: center !important; gap: 2px !important; width: 100% !important; min-width: 0 !important; }
    /* Nova conversa: bolha independente, no fim do compositor, ao lado de Enviar. */
    #chat-composer #chat-new-conversation {
      position: relative !important; z-index: 10045 !important; flex: 0 0 32px !important;
      width: 32px !important; height: 32px !important; min-width: 32px !important; padding: 0 !important;
      display: grid !important; place-items: center !important; border-radius: 50% !important; overflow: hidden !important;
      color: var(--text-primary) !important; background: transparent !important;
      border: 0 !important; box-shadow: none !important;
      font-size: 0 !important; line-height: 1 !important; backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    #chat-composer #chat-new-conversation::before { content: '+' !important; font-size: 22px !important; font-weight: 300 !important; line-height: 1 !important; }
    #chat-composer #chat-new-conversation { margin-right: auto !important; }
    #chat-composer #chat-new-conversation:hover { background: transparent !important; transform: translateY(-1px) !important; }
    #chat-composer #chat-new-conversation:focus-visible, #chat-composer #chat-input:focus-visible, #chat-historico .chat-resposta-acao:focus-visible { outline: 2px solid var(--text-primary) !important; outline-offset: 3px !important; }
    #chat-historico .chat-historico-header { pointer-events: none !important; }
    #chat-historico .chat-historico-header #chat-minimizar, #chat-composer #chat-new-conversation { pointer-events: auto !important; }
    #chat-composer .chat-form-inferior { overflow: visible !important; }
    #chat-painel.chat-expanded #chat-composer { top: auto !important; bottom: 22px !important; transform: translateX(-50%) !important; }
    #chat-painel.chat-expanded #chat-composer .chat-form-inferior { height: 76px !important; min-height: 76px !important; grid-template-columns: minmax(0,1fr) !important; grid-template-rows: 32px 34px !important; padding: 4px 9px !important; gap: 2px !important; border-radius: 28px !important; }
    #chat-painel.chat-expanded #chat-composer .chat-form-inferior::before { display: none !important; }
    #chat-painel.chat-expanded #chat-composer #chat-input { grid-column: 1 !important; grid-row: 1 !important; align-self: center !important; height: 32px !important; }
    #chat-painel.chat-expanded #chat-composer .chat-composer-actions { grid-column: 1 !important; grid-row: 2 !important; justify-content: flex-end !important; }
    #chat-painel.chat-expanded #chat-composer #chat-new-conversation { margin-right: auto !important; }
    @media (max-width: 720px) { #chat-composer { width: calc(100vw - 24px) !important; left: 50vw !important; top: calc(50% + 12px) !important; gap: 6px !important; } #chat-painel.chat-expanded #chat-composer { top: auto !important; bottom: 14px !important; } }
    #chat-historico .chat-menu-compartilhar { background: rgba(34,40,78,.42) !important; border-color: rgba(255,255,255,.24) !important; backdrop-filter: blur(18px) !important; -webkit-backdrop-filter: blur(18px) !important; }
    @keyframes urfiligIconeOuvindo { 50% { opacity: .42; transform: scale(1.18); } }
    @media (max-width: 720px) {
      #chat-historico.chat-historico-direita { left: 50vw !important; width: calc(100vw - 24px) !important; height: min(610px, calc(100vh - 150px)) !important; min-height: 350px !important; }
    }
  `;
  document.head.appendChild(estilo);

  const iconeOuvir = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.7 7.7 0 0 1 0 11"/></svg>';
  const aplicar = (elemento, propriedades) => {
    if (!elemento) return;
    Object.entries(propriedades).forEach(([chave, valor]) => elemento.style.setProperty(chave, valor, 'important'));
  };
  const reforcarVisual = () => {
    const historico = document.getElementById('chat-historico');
    aplicar(historico, {
      position: 'fixed', inset: 'auto', top: '50vh', left: '50vw', right: 'auto', bottom: 'auto',
      width: 'min(920px, calc(100vw - 72px))', height: 'min(610px, calc(100vh - 190px))',
      'min-height': '400px', margin: '0',
      background: 'rgba(12,18,40,.045)', 'border-radius': '30px', border: '0',
      'box-shadow': '0 22px 58px rgba(0,0,0,.22)',
      'backdrop-filter': 'blur(20px) saturate(118%)', '-webkit-backdrop-filter': 'blur(20px) saturate(118%)'
    });
    historico?.classList.toggle('chat-aberto', historico.style.display !== 'none' && !historico.classList.contains('is-chat-closing'));
    document.querySelectorAll('#chat-historico .chat-historico-header, #chat-historico .chat-conversation-workspace, #chat-historico .chat-current-conversation, #chat-historico #chat-mensagens').forEach((area) => aplicar(area, {
      background: 'transparent'
    }));
    document.querySelectorAll('#chat-historico .chat-conversations-panel').forEach((painel) => aplicar(painel, {
      background: 'transparent', 'border-right-color': 'rgba(255,255,255,.10)', 'backdrop-filter': 'none', '-webkit-backdrop-filter': 'none'
    }));
    document.querySelectorAll('#chat-historico .chat-conversation-item, #chat-sidebar-history .chat-conversation-item').forEach((item) => aplicar(item, {
      background: 'transparent', 'background-color': 'transparent', 'background-image': 'none', border: '1px solid transparent', 'box-shadow': 'none'
    }));
    document.querySelectorAll('#chat-historico .chat-msg.urfilig').forEach((mensagem) => aplicar(mensagem, {
      background: 'rgba(255,255,255,.014)', border: '0', 'box-shadow': '0 8px 20px rgba(4,8,22,.045)'
    }));
    document.querySelectorAll('#chat-historico .chat-msg.usuario').forEach((mensagem) => aplicar(mensagem, {
      background: 'rgba(116,82,192,.026)', border: '0', 'box-shadow': '0 8px 20px rgba(94,65,157,.045)'
    }));
    document.querySelectorAll('#chat-historico .chat-resposta-acao').forEach((botao) => aplicar(botao, {
      background: 'transparent', border: '0', 'box-shadow': 'none', padding: '0', width: '26px', height: '26px'
    }));
  };
  const corrigirBotaoOuvir = (botao) => {
    if (!botao || botao.querySelector('svg')) return;
    botao.innerHTML = iconeOuvir;
  };
  reforcarVisual();
  document.querySelectorAll('#chat-historico .chat-acao-ouvir').forEach(corrigirBotaoOuvir);
  new MutationObserver(() => {
    reforcarVisual();
    document.querySelectorAll('#chat-historico .chat-acao-ouvir').forEach(corrigirBotaoOuvir);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

document.addEventListener('DOMContentLoaded', aplicarVisualFinalDoChat, { once: true });

exigirLogin();
validarSessao();
window.sairDaUrfilig = sair;
window.carregarCalendarioUI = carregarCalendarioUI;

iniciarModuloContatos();
iniciarQuadrosRotina();

const canvas = document.querySelector('#hud-canvas');
const labelsCanvas = document.querySelector('#labels-canvas');
const ctx2d = labelsCanvas?.getContext('2d');

if (labelsCanvas) {
  labelsCanvas.style.pointerEvents = 'none';
}

const tooltip = document.querySelector('#memory-tooltip');
if (tooltip) tooltip.style.pointerEvents = 'none';

const accessibilityContainer = document.querySelector('#memory-accessibility');
const liveStatus = document.querySelector('#hud-live-status');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const dpr = Math.min(window.devicePixelRatio, 2);

const scene = new THREE.Scene();
const fundoEtereo = criarFundoEtereo();
scene.add(fundoEtereo);
scene.fog = new THREE.FogExp2(0x050506, 0.02);

// Câmara fixa
const camera = new THREE.PerspectiveCamera(52, (canvas?.getBoundingClientRect().width || window.innerWidth) / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.65, 14);

// --- Controlo de Zoom da Esfera ---
let targetSphereScale = 0.38;
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.2;

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  targetSphereScale -= event.deltaY * 0.0012;
  targetSphereScale = THREE.MathUtils.clamp(targetSphereScale, MIN_SCALE, MAX_SCALE);
}, { passive: false });

// --- Limitações de Área de Movimentação da Esfera ---
const LIMITES_ESFERA = {
  minX: -4.0,
  maxX: 4.0,
  minY: -4.8,
  maxY: 2.5,
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(dpr);
renderer.setSize(canvas?.getBoundingClientRect().width || window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

function redimensionarCanvasLabels() {
  if (!labelsCanvas) return;
  const currentDpr = Math.min(window.devicePixelRatio, 2);
  const width = canvas?.getBoundingClientRect().width || window.innerWidth;
  labelsCanvas.width = width * currentDpr;
  labelsCanvas.height = window.innerHeight * currentDpr;
  labelsCanvas.style.width = width + 'px';
  labelsCanvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', redimensionarCanvasLabels);
redimensionarCanvasLabels();

// --- Iluminação do Mascote Ampla e Clara ---
const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.6);
scene.add(luzAmbiente);

const luzMascote = new THREE.DirectionalLight(0xffedd5, 1.8);
luzMascote.position.set(-3.5, 2.0, 12);
luzMascote.target.position.set(-4.5, -2, 8);
scene.add(luzMascote);
scene.add(luzMascote.target);

const renderTarget = new THREE.WebGLRenderTarget(
  (canvas?.getBoundingClientRect().width || window.innerWidth) * dpr,
  window.innerHeight * dpr,
  { samples: 4, type: THREE.HalfFloatType }
);

const composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(dpr);
composer.setSize(canvas?.getBoundingClientRect().width || window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(canvas?.getBoundingClientRect().width || window.innerWidth, window.innerHeight),
  0.22,
  0.2,
  0.8
);
composer.addPass(bloomPass);
const smaaPass = new SMAAPass(window.innerWidth * dpr, window.innerHeight * dpr);
composer.addPass(smaaPass);

// A camada frontal é independente do painel, inclusive quando o chat está oculto.
// Ela fica acima do histórico; o compositor e menus do chat são recortados abaixo.
const cenaMascoteFrontal = new THREE.Scene();
const canvasMascoteFrontal = document.createElement('canvas');
canvasMascoteFrontal.id = 'mascote-frontal-canvas';
canvasMascoteFrontal.setAttribute('aria-hidden', 'true');
Object.assign(canvasMascoteFrontal.style, {
  position: 'fixed', margin: '0', padding: '0', border: '0',
  pointerEvents: 'none', zIndex: '10041',
});
document.body.appendChild(canvasMascoteFrontal);
let rendererMascoteFrontal = null;
let composerMascoteFallback = null;
try {
  rendererMascoteFrontal = new THREE.WebGLRenderer({
    canvas: canvasMascoteFrontal, alpha: true, antialias: true, powerPreference: 'high-performance',
  });
  rendererMascoteFrontal.setClearColor(0x000000, 0);
  rendererMascoteFrontal.setPixelRatio(dpr);
  rendererMascoteFrontal.setSize(canvas?.getBoundingClientRect().width || window.innerWidth, window.innerHeight, false);
  rendererMascoteFrontal.outputColorSpace = renderer.outputColorSpace;
  rendererMascoteFrontal.toneMapping = renderer.toneMapping;
  rendererMascoteFrontal.toneMappingExposure = renderer.toneMappingExposure;
} catch (erro) {
  // Se não houver segundo contexto WebGL, mantém o comportamento anterior
  // em vez de interromper toda a interface.
  rendererMascoteFrontal?.dispose();
  rendererMascoteFrontal = null;
  canvasMascoteFrontal.remove();
  console.warn('[mascote] camada frontal indisponível; usando canvas original', erro);
  composerMascoteFallback = new EffectComposer(renderer);
  composerMascoteFallback.setPixelRatio(dpr);
  composerMascoteFallback.setSize(canvas?.getBoundingClientRect().width || window.innerWidth, window.innerHeight);
  const passMascoteFallback = new RenderPass(cenaMascoteFrontal, camera);
  passMascoteFallback.clear = false;
  passMascoteFallback.clearDepth = true;
  composerMascoteFallback.addPass(passMascoteFallback);
}

// A projeção usa o retângulo real do canvas principal, inclusive a faixa lateral.
function alinharCanvasMascoteFrontal() {
  const rect = canvas.getBoundingClientRect();
  canvasMascoteFrontal.style.left = `${rect.left}px`;
  canvasMascoteFrontal.style.top = `${rect.top}px`;
  canvasMascoteFrontal.style.width = `${rect.width}px`;
  canvasMascoteFrontal.style.height = `${rect.height}px`;

  // O compositor e os menus internos estão no contexto de empilhamento do chat.
  // Recorta suas áreas sem movê-los, unindo sobreposições para a regra evenodd.
  const menus = [];
  document.querySelectorAll('#chat-composer, #chat-painel [role="menu"], #chat-painel .chat-conversation-menu').forEach((menu) => {
    if (!menu.getClientRects().length || getComputedStyle(menu).visibility === 'hidden') return;
    const r = menu.getBoundingClientRect();
    const x1 = Math.max(0, r.left - rect.left), y1 = Math.max(0, r.top - rect.top);
    const x2 = Math.min(rect.width, r.right - rect.left), y2 = Math.min(rect.height, r.bottom - rect.top);
    if (x1 < x2 && y1 < y2) menus.push({ x1, y1, x2, y2 });
  });
  const recortes = [];
  const limitesY = [...new Set(menus.flatMap(({ y1, y2 }) => [y1, y2]))].sort((a, b) => a - b);
  for (let i = 0; i < limitesY.length - 1; i++) {
    const y1 = limitesY[i], y2 = limitesY[i + 1];
    const intervalos = menus.filter((r) => r.y1 < y2 && r.y2 > y1).sort((a, b) => a.x1 - b.x1);
    let inicio = null, fim = null;
    intervalos.forEach((r) => {
      if (inicio === null) { inicio = r.x1; fim = r.x2; }
      else if (r.x1 <= fim) fim = Math.max(fim, r.x2);
      else { recortes.push(`M ${inicio} ${y1} H ${fim} V ${y2} H ${inicio} Z`); inicio = r.x1; fim = r.x2; }
    });
    if (inicio !== null) recortes.push(`M ${inicio} ${y1} H ${fim} V ${y2} H ${inicio} Z`);
  }
  canvasMascoteFrontal.style.clipPath = recortes.length
    ? `path(evenodd, "M 0 0 H ${rect.width} V ${rect.height} H 0 Z ${recortes.join(' ')}")`
    : 'none';
}
alinharCanvasMascoteFrontal();

// O mascote é movido para esta cena na inicialização. Luzes pertencem à cena,
// não ao renderer: sem esta cópia ele recebe só preto ao ser renderizado na
// camada frontal, embora a cena principal esteja iluminada.
const luzAmbienteMascoteFrontal = new THREE.AmbientLight(0xffffff, 2.15);
const luzCeuMascoteFrontal = new THREE.HemisphereLight(0xddeaff, 0x483653, 1.25);
const luzChaveMascoteFrontal = new THREE.DirectionalLight(0xfff1df, 2.4);
luzChaveMascoteFrontal.position.set(-3.5, 3.5, 12);
luzChaveMascoteFrontal.target.position.set(0, 0, 7);
const luzRecorteMascoteFrontal = new THREE.DirectionalLight(0xaecbff, 1.15);
luzRecorteMascoteFrontal.position.set(4, 1.5, 10);
luzRecorteMascoteFrontal.target.position.set(0, .3, 7);
cenaMascoteFrontal.add(
  luzAmbienteMascoteFrontal,
  luzCeuMascoteFrontal,
  luzChaveMascoteFrontal,
  luzChaveMascoteFrontal.target,
  luzRecorteMascoteFrontal,
  luzRecorteMascoteFrontal.target,
);

function criarFundoEtereo() {
  const geometria = new THREE.SphereGeometry(70, 32, 32);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      corTopo: { value: new THREE.Color('#26385f') },
      corMeio: { value: new THREE.Color('#1b2a4b') },
      corBase: { value: new THREE.Color('#111d37') },
      corVazio: { value: new THREE.Color('#0b1428') },
    },
    vertexShader: `
      varying vec3 vPosicao;
      void main() {
        vPosicao = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosicao;
      uniform vec3 corTopo;
      uniform vec3 corMeio;
      uniform vec3 corBase;
      uniform vec3 corVazio;
      void main() {
        float altura = normalize(vPosicao).y;
        vec3 cor = altura > 0.0
          ? mix(corMeio, corTopo, smoothstep(0.0, 1.0, altura))
          : mix(corMeio, corBase, 1.0 - smoothstep(-1.0, 0.0, altura));
        float nevoa = 0.15 + sin(vPosicao.x * 0.04) * sin(vPosicao.z * 0.04) * 0.08;
        cor = mix(cor, corVazio, clamp(nevoa, 0.0, 0.4));
        gl_FragColor = vec4(cor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(geometria, material);
}

let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let mixer = null;
let mascotRef = null;
let mascotStateMachine = null;
let motionController = null;
let faceMesh = null;
let muted = false;
let mascotePensando = false;
let escalaBaseMascote = 1;
let escalaAlvoMascote = 1;

let nodeArrastado = null;
const planoArrasto = new THREE.Plane();
const pontoIntersecao = new THREE.Vector3();

const ndcMouse = new THREE.Vector2();
const raycasterMouse = new THREE.Raycaster();
const tempVec = new THREE.Vector3();

const memorySphere = new PersonalitySphere(scene, {
  canvas,
  maxParticles: Number(import.meta.env.VITE_PERSONA_PARTICLE_LIMIT || 180),
  reducedMotion: reducedMotionQuery.matches,
  onHover: (particle) => {
    showTooltip(particle);
    if (particle?.corAtual) {
      const hex = '#' + particle.corAtual.getHexString();
      document.documentElement.style.setProperty('--accent-color', hex);
    }
  },
  onSelect: (particle) => {
    if (!particle) return;
    setLiveStatus('Selecionado: ' + (particle.label || particle.titulo));

    if (particle.corAtual) {
      const hex = '#' + particle.corAtual.getHexString();
      document.documentElement.style.setProperty('--accent-color', hex);
    }

    if (typeof window.abrirNotaPorId === 'function') {
      window.abrirNotaPorId(particle, false);
    }
  },
  onRightClick: (particle) => {
    if (!particle) return;
    memorySphere.emitDust(particle.position || particle.posicaoAtual, particle.corAtual, 40, 'explode');
    setLiveStatus('Menu de Opções (Botão Direito): ' + (particle.label || particle.titulo));

    if (typeof window.abrirMenuFlutuante === 'function') {
      window.abrirMenuFlutuante(particle, lastPointer.x, lastPointer.y);
    }
  },
  onParticles: (particles) => {
    syncAccessibleParticles(particles);
  },
});
// A esfera de relações passa a ocupar a região inferior do painel inicial,
// como uma pequena constelação, sem sair da cena nem perder os controles 3D.
memorySphere.grupo.position.set(0, -3.35, 0);
memorySphere.grupo.scale.setScalar(0.38);
function centralizarEsferaNaTela() {
  const rect = canvas?.getBoundingClientRect();
  if (!rect?.width) return;
  const deslocamentoPx = window.innerWidth / 2 - (rect.left + rect.width / 2);
  const larguraMundo = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    * camera.position.z * camera.aspect;
  memorySphere.grupo.position.x = deslocamentoPx * larguraMundo / rect.width;
}
centralizarEsferaNaTela();

function atualizarTemaPorHorario() {
  const rgb = getTimeColor();
  const cor = new THREE.Color(`rgb(${rgb.join(',')})`);
  const uniforms = fundoEtereo.material.uniforms;
  const agora = new Date();
  const hora = agora.getHours() + agora.getMinutes() / 60;
  const periodo = hora < 12 ? 'morning' : hora < 18 ? 'afternoon' : 'night';
  const coresAura = { morning: [255, 225, 150], afternoon: [255, 157, 105], night: [112, 151, 255] };
  const auraRgb = coresAura[periodo];
  const temaClaro = document.documentElement.dataset.theme === 'light';
  const cores = (temaClaro
    ? ['#f2e8ff', '#bfd1fa', '#78bce9', '#d1c7ef']
    : ['#173568', '#10264d', '#091a38', '#050e23'])
    .map((hex) => new THREE.Color(hex));
  uniforms.corTopo.value.copy(cores[0]);
  uniforms.corMeio.value.copy(cores[1]);
  uniforms.corBase.value.copy(cores[2]);
  uniforms.corVazio.value.copy(cores[3]);
  memorySphere.setTimeColor(cor);
  document.documentElement.style.setProperty('--time-accent', `rgb(${rgb.join(',')})`);
  document.documentElement.style.setProperty('--time-halo', `rgba(${rgb.join(',')}, .11)`);
  document.documentElement.style.setProperty('--aura-color', `rgba(${auraRgb.join(',')}, ${temaClaro ? '.22' : '.26'})`);
  document.documentElement.dataset.timePeriod = periodo;
}
atualizarTemaPorHorario();
setInterval(atualizarTemaPorHorario, 60_000);
new MutationObserver(atualizarTemaPorHorario).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function atualizarSaudacaoInicial() {
  const titulo = document.getElementById('home-greeting-title');
  const frase = document.getElementById('home-greeting-message');
  if (!titulo || !frase) return;
  const hora = new Date().getHours();
  const periodo = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  let nome = '';
  try {
    const usuario = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}');
    nome = String(usuario.nome || '').trim().split(/\s+/)[0];
  } catch { /* a saudação continua disponível sem o nome salvo */ }
  titulo.textContent = `${periodo}${nome ? `, ${nome}` : ''}`;
  frase.textContent = hora < 12
    ? 'Que o seu dia comece com leveza. Vamos no seu ritmo.'
    : hora < 18
      ? 'Faça uma pausa, respire e siga no seu ritmo.'
      : 'Desacelere um pouco. Amanhã é um novo começo.';
}
atualizarSaudacaoInicial();
setInterval(atualizarSaudacaoInicial, 60_000);

// CAPTURA DO BOTÃO DIREITO NO CANVAS
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const particulaIndex = hitTestPersonalizado(event.clientX, event.clientY);
  if (particulaIndex !== null && particulaIndex !== undefined) {
    memorySphere.rightClick(particulaIndex);
  }
});

const stateProxy = {
  transitionTo: (state) => mascotStateMachine?.transitionTo(state),
  setMode: (mode) => mascotStateMachine?.setMode(mode),
};
const motionProxy = {
  setMode: (mode) => motionController?.setMode(mode),
};

const socket = conectarSocket({
  stateMachine: stateProxy,
  motionController: motionProxy,
  onState: (state) => { if (isTauri()) void emitTo('mascote-overlay', 'mascot:state', { state }); },
  onMode: (mode) => { if (isTauri()) void emitTo('mascote-overlay', 'mascot:mode', { mode }); },
  onExpression: (shape, weight) => {
    if (faceMesh) setExpression(faceMesh, shape, weight);
    if (isTauri()) void emitTo('mascote-overlay', 'mascot:expression', { shape, weight });
  },
  onParticles: (particles) => {
    if (Array.isArray(particles) && particles.length > 0) {
      atualizarBolinhasDaEsfera(particles);
    }
  },
  onResponse: ({ text, emotion, audio }) => {
    ocultarIndicadorPensando();
    mascotePensando = false;
    escalaAlvoMascote = escalaBaseMascote;
    adicionarMensagemChat('Urfilig', text);
    if (audio) {
      const bytesRecebidos = typeof audio === 'string' ? Math.floor(audio.length * 3 / 4) : (audio.byteLength ?? audio.length ?? 0);
      console.info(`[voz] resposta recebida com áudio do Piper (${bytesRecebidos} bytes)`);
      const botaoAudio = adicionarBotaoReproduzirAudio(audio, text);
      void tocarAudioPiper(audio, text).then((iniciou) => {
        if (botaoAudio) botaoAudio.textContent = iniciou ? 'Ouvir novamente' : 'Ouvir resposta';
      });
    } else {
      console.warn('[voz] a resposta chegou sem áudio do Piper; usando síntese do sistema');
      falar(text, { onEnd: concluirFalaMascote });
    }
    setLiveStatus('Resposta recebida' + (emotion ? '. Tom: ' + emotion + '.' : '.'));

    if (typeof window.recarregarInterfaceNotas === 'function') {
      window.recarregarInterfaceNotas();
    }
  },
  onWeather: (dados) => showWeather(dados),
  onOutfit: (part, visible) => {
    alternarPecaDoMascote(part, visible);
    if (isTauri()) void emitTo('mascote-overlay', 'mascot:outfit', { part, visible });
  },
});

iniciarMenuLateral(socket);
iniciarProspeccao();
const processarComandoDevAgent = iniciarDevAgent();
iniciarSpotify();

window.recarregarEsferaNeural = carregarMemoriasECerebro;

function reconstruirCriacaoDeNotaPendente(texto) {
  const mensagens = lerHistoricoChat();
  const indicePergunta = mensagens.findLastIndex((mensagem) => mensagem.autor === 'Urfilig');
  if (indicePergunta < 0 || !/^Qual nome você quer dar à nota\?$/i.test(String(mensagens[indicePergunta].texto || '').trim())) {
    return texto;
  }

  const pedidoAnterior = [...mensagens.slice(0, indicePergunta)].reverse()
    .find((mensagem) => mensagem.autor === 'Você')?.texto?.trim();
  const pedido = pedidoAnterior?.match(/^\s*(?:cria|crie|criar|faz|faça|faca)\s+(?:(?:uma?|a)\s+)?nota\b(.*)$/i);
  if (!pedido) return texto;

  let restante = pedido[1].trim();
  let pasta = '';
  const pastaMatch = restante.match(/\s+(?:na|em)\s+pasta\s+(.+?)\s*[.!?]*$/i);
  if (pastaMatch) {
    pasta = pastaMatch[1].trim();
    restante = restante.slice(0, pastaMatch.index).trim();
  }
  restante = restante.replace(/^(?:nova|novo)\b\s*/i, '').trim();
  restante = restante.replace(/^(?:(?:com\s+(?:o\s+)?nome\s+de)|chamad[oa])\s*$/i, '').trim();
  if (restante) return texto;

  const titulo = String(texto || '').trim();
  if (!titulo) return texto;
  return `cria uma nota chamada "${titulo}"${pasta ? ` na pasta "${pasta}"` : ''}`;
}

function atualizarBolinhasDaEsfera(particulas) {
  memorySphere.setParticles(particulas);
  syncAccessibleParticles(particulas);
}

function fonteDaParticula(particula) {
  const id = String(particula?.id ?? '');
  if (id.startsWith('hobby-')) return 'perfil';
  if (id.startsWith('pasta-')) return 'pastas';
  if (id.startsWith('nota-')) return particula.folderRef ? 'pastas' : 'notasSoltas';
  if (id.startsWith('lembrete-')) return 'lembretes';
  // Versões antigas identificavam hobbies somente pelo rótulo.
  if (!particula?.isFolder && !particula?.isNote && !particula?.isReminder
      && typeof particula?.label === 'string' && particula.label.startsWith('Hobby: ')) return 'perfil';
  return null;
}

function montarParticulasDaFonte(fonte, valor) {
  const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const texto = (v) => typeof v === 'string' && v.trim().length > 0;
  const idValido = (v) => (typeof v === 'string' && v.trim().length > 0)
    || (typeof v === 'number' && Number.isSafeInteger(v));
  const ids = new Set();
  const registrar = (prefixo, id) => {
    if (!idValido(id)) throw new Error('ID ausente ou inválido');
    const chave = prefixo + id;
    if (ids.has(chave)) throw new Error('ID duplicado');
    ids.add(chave);
    return chave;
  };
  const notaValida = (nota) => objeto(nota) && texto(nota.titulo);
  const resultado = [];

  if (fonte === 'perfil') {
    if (!objeto(valor) || !objeto(valor.usuario)
        || !Object.prototype.hasOwnProperty.call(valor.usuario, 'hobbies')) {
      throw new Error('campo hobbies ausente');
    }
    const hobbies = valor.usuario.hobbies;
    if (hobbies !== null && typeof hobbies !== 'string'
        && !(Array.isArray(hobbies) && hobbies.every((hobby) => typeof hobby === 'string'))) {
      throw new Error('hobbies inválidos');
    }
    const lista = hobbies === null ? [] : typeof hobbies === 'string' ? hobbies.split(',') : hobbies;
    const nomes = new Set();
    lista.forEach((hobby) => {
      const nome = hobby.trim();
      if (!nome || nomes.has(nome)) return;
      nomes.add(nome);
      resultado.push({ id: 'hobby-' + nome, titulo: nome, label: nome, strength: 0.8,
        isFolder: false, isNote: false });
    });
  } else if (fonte === 'pastas') {
    if (!Array.isArray(valor)) throw new Error('pastas não é uma lista');
    valor.forEach((pasta) => {
      if (!objeto(pasta) || !texto(pasta.nome) || !Array.isArray(pasta.notas)) {
        throw new Error('pasta ou lista de notas inválida');
      }
      const folderObj = { id: registrar('pasta-', pasta.id), titulo: pasta.nome, label: pasta.nome,
        strength: 0.9, isFolder: true, isNote: false };
      resultado.push(folderObj);
      pasta.notas.forEach((nota) => {
        if (!notaValida(nota)) throw new Error('nota de pasta inválida');
        resultado.push({ id: registrar('nota-', nota.id), titulo: nota.titulo, label: nota.titulo,
          strength: 0.5, isFolder: false, isNote: true, folderRef: folderObj });
      });
    });
  } else if (fonte === 'notasSoltas') {
    if (!Array.isArray(valor)) throw new Error('notas soltas não é uma lista');
    valor.forEach((nota) => {
      if (!notaValida(nota)) throw new Error('nota solta inválida');
      resultado.push({ id: registrar('nota-', nota.id), titulo: nota.titulo, label: nota.titulo,
        strength: 0.4, isFolder: false, isNote: true, folderRef: null });
    });
  } else if (fonte === 'lembretes') {
    if (!Array.isArray(valor)) throw new Error('lembretes não é uma lista');
    valor.forEach((lembrete) => {
      if (!objeto(lembrete) || !texto(lembrete.titulo)
          || (lembrete.concluido != null && typeof lembrete.concluido !== 'boolean')) {
        throw new Error('lembrete inválido');
      }
      const id = registrar('lembrete-', lembrete.id);
      if (!lembrete.concluido) resultado.push({ id, titulo: lembrete.titulo,
        label: `Lembrete: ${lembrete.titulo}`, strength: 0.65,
        isFolder: false, isNote: false, isReminder: true });
    });
  }
  return resultado;
}

let carregamentoCerebroAtivo = false;
let carregamentoCerebroPendente = false;
async function carregarMemoriasECerebro() {
  // A tela chama esta carga no início, ao conectar o socket e após respostas.
  // Evite disparar os mesmos quatro endpoints em paralelo nesses momentos.
  if (carregamentoCerebroAtivo) {
    carregamentoCerebroPendente = true;
    return;
  }
  const token = localStorage.getItem('urfilig_token');
  if (!token) return;
  carregamentoCerebroAtivo = true;

  const buscarJson = async (rota) => {
    const resposta = await fetch(`${BACKEND_URL}${rota}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) throw new Error(`${rota}: HTTP ${resposta.status}`);
    return resposta.json();
  };

  try {
    const nomes = ['perfil', 'pastas', 'notasSoltas', 'lembretes'];
    // O backend de cérebro também responde 200 [] em alguns erros; essa resposta
    // é indistinguível de uma lista legitimamente vazia sem alterar o backend.
    const respostas = await Promise.allSettled([
      buscarJson('/api/auth/me'),
      buscarJson('/api/cerebro/pastas'),
      buscarJson('/api/cerebro/notas-soltas'),
      buscarJson('/api/agenda?lembretes=1'),
    ]);
    const atualizacoes = {};
    respostas.forEach((resposta, indice) => {
      const fonte = nomes[indice];
      try {
        if (resposta.status !== 'fulfilled') throw resposta.reason;
        // Montagem transacional: nenhuma parte de uma fonte inválida é aplicada.
        atualizacoes[fonte] = montarParticulasDaFonte(fonte, resposta.value);
      } catch (erro) {
        console.warn(`[main] Fonte ${fonte} preservada:`, erro?.message || 'resposta inválida');
      }
    });

    // Notas usam IDs globais. Nunca sobrescrever uma fonte preservada nem aceitar
    // o mesmo ID em duas respostas; rejeitar a atualização ambígua é mais seguro.
    let houveConflito;
    do {
      houveConflito = false;
      const donos = new Map();
      const conflitantes = new Set();
      const registrarDono = (id, fonte, atualizada) => {
        if (!id) return;
        const anteriores = donos.get(id) || [];
        anteriores.forEach((anterior) => {
          if (anterior.fonte !== fonte) {
            if (atualizada) conflitantes.add(fonte);
            if (anterior.atualizada) conflitantes.add(anterior.fonte);
          }
        });
        anteriores.push({ fonte, atualizada });
        donos.set(id, anteriores);
      };
      memorySphere.particulas.forEach((p) => {
        const fonte = fonteDaParticula(p);
        if (!fonte || !Object.prototype.hasOwnProperty.call(atualizacoes, fonte)) {
          registrarDono(p?.id, fonte, false);
        }
      });
      Object.entries(atualizacoes).forEach(([fonte, particulas]) => {
        particulas.forEach((p) => registrarDono(p.id, fonte, true));
      });
      conflitantes.forEach((fonte) => {
        delete atualizacoes[fonte];
        console.warn(`[main] Fonte ${fonte} preservada: ID em conflito com outra fonte`);
        houveConflito = true;
      });
    } while (houveConflito);

    if (!Object.keys(atualizacoes).length) return;
    const preservadas = memorySphere.particulas.filter((particula) => {
      const fonte = fonteDaParticula(particula);
      return !fonte || !Object.prototype.hasOwnProperty.call(atualizacoes, fonte);
    });
    atualizarBolinhasDaEsfera([...preservadas, ...Object.values(atualizacoes).flat()]);
  } catch (erro) {
    console.warn('[main] Erro ao carregar esfera neural:', erro.message);
  } finally {
    carregamentoCerebroAtivo = false;
    if (carregamentoCerebroPendente) {
      carregamentoCerebroPendente = false;
      queueMicrotask(() => void carregarMemoriasECerebro());
    }
  }
}

function extrairCoordenada3D(particula) {
  scene.updateMatrixWorld(true);
  const vetorLocal = new THREE.Vector3();
  const pos = particula.position || particula.posicaoAtual;
  if (pos) {
    vetorLocal.copy(pos);
    const grupoBase = memorySphere.grupo;
    if (grupoBase) {
      vetorLocal.applyMatrix4(grupoBase.matrixWorld);
    }
    return vetorLocal;
  }
  return null;
}

function hitTestPersonalizado(clientX, clientY) {
  const particulas = memorySphere.particulas || [];
  if (particulas.length === 0) return null;

  let melhorIndice = null;
  let menorDistancia = 45;
  const rectCanvas = canvas.getBoundingClientRect();

  for (let i = 0; i < particulas.length; i++) {
    const p = particulas[i];
    const pos3D = extrairCoordenada3D(p);
    if (!pos3D) continue;

    if (pos3D.z < -2.0) continue;

    tempVec.copy(pos3D);
    tempVec.project(camera);

    if (tempVec.z >= -1 && tempVec.z <= 1) {
      const telaX = rectCanvas.left + (tempVec.x * 0.5 + 0.5) * rectCanvas.width;
      const telaY = (tempVec.y * -0.5 + 0.5) * window.innerHeight;

      const distanciaReal = Math.hypot(telaX - clientX, telaY - clientY);
      if (distanciaReal < menorDistancia) {
        menorDistancia = distanciaReal;
        melhorIndice = i;
      }
    }
  }
  return melhorIndice;
}

document.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('urfilig_llm_provider');
  const chatHistorico = document.getElementById('chat-historico');
  const btnMinimizar = document.getElementById('chat-minimizar');
  const btnRestaurar = document.getElementById('chat-restaurar');
  const chatForm = document.getElementById('chat-form');
  const chatPainel = document.getElementById('chat-painel');
  let fechamentoDoChat;
  const duracaoDaTransicaoDoChat = 280;
  const atualizarOrigemDaAnimacaoDoChat = () => {
    if (!chatHistorico || !btnRestaurar) return;
    const origem = btnRestaurar.getBoundingClientRect();
    const destino = chatHistorico.getBoundingClientRect();
    if (!origem.width || !destino.width) return;
    const origemX = origem.left + origem.width / 2;
    const origemY = origem.top + origem.height / 2;
    const destinoX = destino.left + destino.width / 2;
    const destinoY = destino.top + destino.height / 2;
    chatHistorico.style.setProperty('--chat-origem-x', `${origemX - destinoX}px`);
    chatHistorico.style.setProperty('--chat-origem-y', `${origemY - destinoY}px`);
  };
  const abrirChat = () => {
    if (chatHistorico) {
      window.clearTimeout(fechamentoDoChat);
      const jaEstavaAberto = chatHistorico.classList.contains('chat-aberto');
      chatHistorico.style.display = 'flex';
      chatHistorico.classList.remove('is-chat-closing');
      if (!jaEstavaAberto) {
        atualizarOrigemDaAnimacaoDoChat();
        // O painel nasce visualmente do ícone e cresce até a posição final.
        void chatHistorico.offsetWidth;
        requestAnimationFrame(() => chatHistorico.classList.add('chat-aberto'));
      }
    }
    chatPainel?.classList.add('chat-expanded');
    if (!chatHistorico?.classList.contains('chat-aberto')) window.setTimeout(() => { if (btnRestaurar) btnRestaurar.hidden = true; }, 60);
    else if (btnRestaurar) btnRestaurar.hidden = true;
    document.querySelector('#nav-chats')?.setAttribute('aria-expanded', 'true');
    const sidebarHistory = document.querySelector('#chat-sidebar-history');
    if (sidebarHistory) sidebarHistory.hidden = false;
    rolarChatParaFim();
    window.setTimeout(() => document.getElementById('chat-input')?.focus(), 260);
  };
  const minimizarChat = () => {
    if (chatHistorico) {
      window.clearTimeout(fechamentoDoChat);
      if (btnRestaurar) {
        btnRestaurar.hidden = false;
        atualizarOrigemDaAnimacaoDoChat();
      }
      chatHistorico.classList.add('is-chat-closing');
      chatHistorico.classList.remove('chat-aberto');
      fechamentoDoChat = window.setTimeout(() => {
        chatHistorico.style.display = 'none';
        chatHistorico.classList.remove('is-chat-closing');
      }, duracaoDaTransicaoDoChat);
    }
    chatPainel?.classList.remove('chat-expanded');
    document.querySelector('#nav-chats')?.setAttribute('aria-expanded', 'false');
    const sidebarHistory = document.querySelector('#chat-sidebar-history');
    if (sidebarHistory) sidebarHistory.hidden = true;
  };

  if (btnMinimizar && chatHistorico && btnRestaurar) {
    btnMinimizar.addEventListener('click', minimizarChat);
    btnRestaurar.addEventListener('click', abrirChat);
  }
  document.querySelector('#nav-chats')?.addEventListener('click', abrirChat);

  if (chatForm) {
    const novoForm = chatForm.cloneNode(true);
    chatForm.parentNode.replaceChild(novoForm, chatForm);
    // O formulário é separado do painel do histórico para manter o compositor fixo.
    const composer = document.createElement('div');
    composer.id = 'chat-composer';
    chatPainel?.appendChild(composer);
    composer.appendChild(novoForm);
    const composerActions = document.createElement('div');
    composerActions.className = 'chat-composer-actions';
    novoForm.appendChild(composerActions);
    const novoChat = document.getElementById('chat-new-conversation');
    if (novoChat) {
      novoChat.textContent = '';
      novoChat.setAttribute('aria-label', 'Nova conversa');
      novoChat.title = 'Nova conversa';
      // Fica ao lado de Enviar, como uma bolha própria, sem alterar o comportamento da nova conversa.
      composerActions.appendChild(novoChat);
      novoChat.addEventListener('click', (event) => {
        event.preventDefault();
        iniciarNovaConversaChat();
      });
    }
    const sendButton = novoForm.querySelector('.chat-btn-enviar');
    const botaoMicrofone = document.createElement('button');
    botaoMicrofone.type = 'button';
    botaoMicrofone.className = 'chat-btn-microfone';
    botaoMicrofone.textContent = '🎙';
    botaoMicrofone.title = 'Ativar microfone';
    botaoMicrofone.setAttribute('aria-label', 'Ativar microfone');
    botaoMicrofone.style.cssText = 'min-height:32px;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer;padding:0 9px';
    botaoMicrofone.addEventListener('click', () => {
      if (!microfoneAtivo) {
        void iniciarMicrofoneLocal().then(() => {
          botaoMicrofone.textContent = microfoneAtivo ? '⏹' : '🎙';
          botaoMicrofone.title = microfoneAtivo ? 'Desativar microfone' : 'Ativar microfone';
          botaoMicrofone.setAttribute('aria-label', botaoMicrofone.title);
        });
      } else {
        pararMicrofoneLocal();
        botaoMicrofone.textContent = '🎙';
        botaoMicrofone.title = 'Ativar microfone';
        botaoMicrofone.setAttribute('aria-label', botaoMicrofone.title);
      }
    });
    composerActions.appendChild(botaoMicrofone);
    if (sendButton) composerActions.appendChild(sendButton);
    const expandirChatPelaBarra = () => {
      if (!chatHistorico?.classList.contains('chat-aberto')) abrirChat();
    };
    novoForm.addEventListener('pointerdown', expandirChatPelaBarra);
    novoForm.addEventListener('focusin', expandirChatPelaBarra);

    novoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const texto = input?.value?.trim();
      if (!texto) return;
      const textoParaEnviar = reconstruirCriacaoDeNotaPendente(texto);

      input.value = '';
      abrirChat();
      adicionarMensagemChat('Você', texto);
      mostrarIndicadorPensando();
      mascotePensando = true;
      escalaAlvoMascote = escalaBaseMascote * 0.42;
      setLiveStatus('Pensando...');

      const btnEnviar = novoForm.querySelector('button[type="submit"]');
      if (btnEnviar) btnEnviar.disabled = true;

      try {
        if (await processarComandoDevAgent?.(texto)) {
          ocultarIndicadorPensando();
          mascotePensando = false;
          escalaAlvoMascote = escalaBaseMascote;
          return;
        }
        if (await tentarAtalhoFerramentaChat(texto, { adicionarMensagem: adicionarMensagemChat })) {
          ocultarIndicadorPensando();
          mascotePensando = false;
          escalaAlvoMascote = escalaBaseMascote;
          return;
        }
        let preferencias = {};
        try { preferencias = JSON.parse(localStorage.getItem('urfilig_preferencias') || '{}'); } catch { /* mantém as preferências padrão */ }
        const resp = await fetch(`${BACKEND_URL}/api/comando`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
          },
          body: JSON.stringify({
            texto: textoParaEnviar,
            historico: lerHistoricoChat().slice(-13, -1).map(({ autor, texto: mensagem }) => ({ autor, texto: String(mensagem || '').slice(0, 4000) })),
            responseStyle: preferencias.responseStyle,
            responseTone: preferencias.responseTone,
          }),
        });

        const dados = await resp.json();
        if (resp.ok && dados.resposta) {
          ocultarIndicadorPensando();
          mascotePensando = false;
          escalaAlvoMascote = escalaBaseMascote;
          const registroRotina = window.registrarPresencaRotina?.(texto);
          adicionarMensagemChat('Urfilig', dados.resposta);
          if (dados.audio) {
            const botaoAudio = adicionarBotaoReproduzirAudio(dados.audio, dados.resposta);
            void tocarAudioPiper(dados.audio, dados.resposta).then((iniciou) => {
              if (botaoAudio) botaoAudio.textContent = iniciou ? 'Ouvir novamente' : 'Ouvir resposta';
            });
          } else {
            falar(dados.resposta, { onEnd: concluirFalaMascote });
          }
          if (typeof registroRotina === 'string') adicionarMensagemChat('Rotina', registroRotina);
          if (dados.eventoCriado && typeof window.carregarCalendarioUI === 'function') {
  await window.carregarCalendarioUI();
}
          if (dados.notaCriada || dados.notaMovida) {
            carregarMemoriasECerebro();
          }
          if ((dados.notaCriada || dados.notaMovida) && typeof window.recarregarInterfaceNotas === 'function') {
            await window.recarregarInterfaceNotas();
          }
        } else {
          ocultarIndicadorPensando();
          mascotePensando = false;
          escalaAlvoMascote = escalaBaseMascote;
          adicionarMensagemChat('Urfilig', dados.detalhe || dados.erro || 'Não consegui responder agora. Confira se a IA própria do Urfilig está disponível.');
        }
      } catch (err) {
        ocultarIndicadorPensando();
        mascotePensando = false;
        escalaAlvoMascote = escalaBaseMascote;
        console.error('[chat] Erro ao enviar comando:', err);
        adicionarMensagemChat('Urfilig', 'Não consegui concluir agora. Tente novamente em instantes.');
      } finally {
        if (btnEnviar) btnEnviar.disabled = false;
        document.getElementById('chat-input')?.focus();
      }
    });
  }

  if (isTauri()) {
    void listenTauri('mascot:chat-send', (event) => {
      const text = String(event.payload?.text || '').trim();
      const input = document.getElementById('chat-input');
      const form = document.getElementById('chat-form');
      if (!text || !input || !form) return;
      input.value = text;
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    });
    void listenTauri('mascot:chat-history-request', () => {
      void emitTo('mascote-overlay', 'mascot:chat-history', lerHistoricoChat());
    });
  }

  inicializarConversasChat();
  restaurarHistoricoChat();
  renderizarListaConversasChat();
});

socket.on('connect', () => {
  carregarMemoriasECerebro();
});

let solicitacaoMicrofone;
let microfoneAtivo = false;
let microfoneRecusado = false;
let streamMicrofone;
let contextoMicrofone;
let processadorMicrofone;
function pedirConsentimentoMicrofone() {
  const modal = document.querySelector('#microfone-modal');
  if (!modal) return Promise.resolve(false);
  modal.hidden = false;
  return new Promise((resolve) => {
    const permitir = modal.querySelector('#microfone-permitir');
    const negar = modal.querySelector('#microfone-negar');
    const finalizar = (autorizado) => {
      modal.hidden = true;
      permitir.removeEventListener('click', permitirMicrofone);
      negar.removeEventListener('click', negarMicrofone);
      resolve(autorizado);
    };
    const permitirMicrofone = () => finalizar(true);
    const negarMicrofone = () => finalizar(false);
    permitir.addEventListener('click', permitirMicrofone, { once: true });
    negar.addEventListener('click', negarMicrofone, { once: true });
  });
}

async function iniciarMicrofoneLocal() {
  if (solicitacaoMicrofone) return solicitacaoMicrofone;
  solicitacaoMicrofone = iniciarMicrofoneComConsentimento();
  try {
    await solicitacaoMicrofone;
  } finally {
    solicitacaoMicrofone = null;
  }
}

async function iniciarMicrofoneComConsentimento() {
  try {
    const autorizado = await pedirConsentimentoMicrofone();
    if (!autorizado) {
      microfoneRecusado = true;
      setLiveStatus('Microfone desativado. O chat continua disponível.');
      return;
    }
    if (isTauri()) await invoke('autorizar_microfone');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamMicrofone = stream;
    const audioCtx = contextoMicrofone = new AudioContext();
    microfoneAtivo = true;
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = processadorMicrofone = audioCtx.createScriptProcessor(4096, 1, 1);

    socket.emit('audio:config', { sampleRate: audioCtx.sampleRate });

    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = (evento) => {
      const entrada = evento.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(entrada.length);
      for (let i = 0; i < entrada.length; i++) {
        const amostra = Math.max(-1, Math.min(1, entrada[i]));
        pcm16[i] = amostra < 0 ? amostra * 0x8000 : amostra * 0x7fff;
      }
      socket.emit('audio:chunk', pcm16.buffer);
    };

    setLiveStatus('Microfone ativo.');
  } catch (erro) {
    console.error('[microfone] Não foi possível iniciar:', erro);
    setLiveStatus('Microfone indisponível.');
  }
}

function pararMicrofoneLocal() {
  processadorMicrofone?.disconnect();
  streamMicrofone?.getTracks().forEach((track) => track.stop());
  void contextoMicrofone?.close();
  processadorMicrofone = null;
  streamMicrofone = null;
  contextoMicrofone = null;
  microfoneAtivo = false;
  setLiveStatus('Microfone desativado.');
}

carregarMascote('/models/mascote.glb', scene)
  .then(({ mascote, mixer: loadedMixer, clips }) => {
    normalizarEscala(mascote, 1.6);

    mascote.traverse((filho) => {
      if (filho.isMesh && filho.material) {
        const materiais = Array.isArray(filho.material) ? filho.material : [filho.material];
        materiais.forEach((material) => {
          // Mantém os materiais e as texturas originais do GLB. Forçar os
          // parâmetros aqui removia a aparência própria do modelo e podia
          // deixá-lo escuro na camada frontal.
          material.needsUpdate = true;
        });
      }
    });

    mixer = loadedMixer;
    mascotRef = mascote;
    cenaMascoteFrontal.add(mascote);
    escalaBaseMascote = mascote.scale.x;
    escalaAlvoMascote = escalaBaseMascote;
    mascotStateMachine = new MascotStateMachine(mixer, clips);
    motionController = new MascotMotionController(mascote, {
      modo: 'fixo',
      // A posição é recalculada com base na barra do chat durante a renderização.
      posicaoFixa: new THREE.Vector3(0, 0, 8.0),
      pontoParaOlhar: new THREE.Vector3(0, 0, 20),
    });
    mascote.rotation.y = Math.PI / 2;
    mascote.visible = !mascotOverlayActive;

    faceMesh = encontrarMeshComMorphTargets(mascote);
    setLiveStatus('Pronta.');
  })
  .catch(() => {
    setLiveStatus('Modelo nao carregado.');
  });

function normalizarEscala(mascote, alturaAlvo) {
  const box = new THREE.Box3().setFromObject(mascote);
  const tamanho = box.getSize(new THREE.Vector3());
  const fator = alturaAlvo / (tamanho.y || 1);
  mascote.scale.setScalar(fator);
}

function posicionarMascoteSobreChat() {
  if (!mascotRef || !motionController || mascotOverlayActive) return;
  if (motionController.modo !== 'fixo') motionController.setMode?.('fixo');

  const chatHistorico = document.getElementById('chat-historico');
  const chatAberto = chatHistorico?.classList.contains('chat-aberto');
  if (chatAberto || chatHistorico?.classList.contains('is-chat-closing')) {
    mascotRef.visible = false;
    return;
  }

  const composerDoChat = document.getElementById('chat-composer');
  const canvasRect = canvas?.getBoundingClientRect();
  const chatRect = (composerDoChat || document.getElementById('chat-form'))?.getBoundingClientRect();
  if (!canvasRect?.width || !canvasRect.height || !chatRect?.width) return;

  mascotRef.visible = true;
  const depth = 7.45;
  const distance = Math.max(.1, camera.position.z - depth);
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
  const visibleWidth = visibleHeight * camera.aspect;

  // Mantém o mascote acima da barra quando o histórico está recolhido.
  const alvoX = window.innerWidth / 2;
  // O modelo cresce acima do ponto de ancoragem; deixá-lo 20 px acima do
  // compositor mantém o relógio e a saudação livres e evita cobrir a barra.
  const alvoY = chatRect.top - 20;
  const ndcX = ((alvoX - canvasRect.left) / canvasRect.width) * 2 - 1;
  const ndcY = 1 - ((alvoY - canvasRect.top) / canvasRect.height) * 2;
  motionController.posicaoFixa.set(
    ndcX * visibleWidth / 2,
    camera.position.y + ndcY * visibleHeight / 2,
    depth
  );
  motionController.pontoParaOlhar?.set(
    motionController.posicaoFixa.x,
    motionController.posicaoFixa.y - .12,
    20
  );
  // O modo fixo não aplica alterações posteriores a posicaoFixa sozinho.
  // Atualize a posição sem substituir a orientação frontal do modelo.
  mascotRef.position.copy(motionController.posicaoFixa);
}
let audioPiperAtual = null;
let urlAudioPiperTemporaria = null;
let contextoAudioPiper = null;
let fonteAudioPiper = null;
function concluirFalaMascote() { socket.emit('mascot:playback-ended'); }

// Libera o Web Audio dentro de um gesto real do usuário (política de autoplay do WebView2).
function prepararAudioPiper() {
  try {
    const AudioContextApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextApi) return;
    contextoAudioPiper ||= new AudioContextApi();
    if (contextoAudioPiper.state === 'suspended') void contextoAudioPiper.resume().catch((erro) => console.warn('[voz] o WebView não liberou o áudio:', erro.message));
  } catch (erro) {
    console.warn('[voz] não foi possível preparar o áudio:', erro.message);
  }
}

window.addEventListener('pointerdown', () => { void prepararAudioPiper(); }, { passive: true });
window.addEventListener('keydown', () => { void prepararAudioPiper(); }, { passive: true });

async function tocarAudioPiper(audioBase64, textoReserva = '') {
  if (textoReserva && falar(textoReserva, { onEnd: concluirFalaMascote })) {
    console.info('[voz] reprodução natural selecionada pelo sistema.');
    return true;
  }
  window.speechSynthesis?.cancel();
  audioPiperAtual?.pause();
  try { fonteAudioPiper?.stop(); } catch { /* áudio anterior já terminou */ }
  fonteAudioPiper = null;

  let bytes;
  if (audioBase64) {
    try {
      if (typeof audioBase64 === 'string') {
        const binario = atob(audioBase64);
        bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
      } else if (audioBase64 instanceof ArrayBuffer) {
        bytes = new Uint8Array(audioBase64);
      } else if (ArrayBuffer.isView(audioBase64)) {
        bytes = new Uint8Array(audioBase64.buffer, audioBase64.byteOffset, audioBase64.byteLength);
      } else if (audioBase64 instanceof Blob) {
        bytes = new Uint8Array(await audioBase64.arrayBuffer());
      } else {
        throw new Error(`formato de áudio não reconhecido: ${typeof audioBase64}`);
      }
      if (!bytes.length) throw new Error('O áudio recebido está vazio.');
    } catch (erro) {
      console.warn('[voz] áudio Piper inválido:', erro.message);
    }
  }

  try {
    if (contextoAudioPiper && bytes) {
      if (contextoAudioPiper.state === 'suspended') await contextoAudioPiper.resume();
      if (contextoAudioPiper.state !== 'running') throw new Error(`contexto de áudio ${contextoAudioPiper.state}`);
      const buffer = await contextoAudioPiper.decodeAudioData(bytes.buffer.slice(0));
      fonteAudioPiper = contextoAudioPiper.createBufferSource();
      fonteAudioPiper.buffer = buffer;
      fonteAudioPiper.onended = concluirFalaMascote;
      fonteAudioPiper.connect(contextoAudioPiper.destination);
      fonteAudioPiper.start();
      console.info('[voz] reprodução do Piper iniciada pelo Web Audio');
      return true;
    }
  } catch (erro) {
    console.warn('[voz] Web Audio não conseguiu tocar o Piper:', erro.message);
  }

  try {
    if (bytes) {
      if (urlAudioPiperTemporaria) URL.revokeObjectURL(urlAudioPiperTemporaria);
      urlAudioPiperTemporaria = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      audioPiperAtual ||= new Audio();
      audioPiperAtual.muted = false;
      audioPiperAtual.volume = 1;
      audioPiperAtual.src = urlAudioPiperTemporaria;
      audioPiperAtual.onended = concluirFalaMascote;
      await audioPiperAtual.play();
      console.info('[voz] reprodução do Piper iniciada pelo elemento de áudio');
      return true;
    }
  } catch (erro) {
    console.warn('[voz] elemento de áudio não conseguiu tocar o Piper:', erro.message);
  }

  console.warn('[voz] usando síntese de voz do sistema como reserva. Áudio Piper recebido:', Boolean(audioBase64));
  if (textoReserva) falar(textoReserva, { onEnd: concluirFalaMascote });
  return false;
}

function definirEstadoBotaoOuvir(botao, ouvindo) {
  if (!botao) return;
  botao.disabled = ouvindo;
  botao.classList.toggle('esta-ouvindo', ouvindo);
  const titulo = ouvindo ? 'Reproduzindo resposta' : (botao.dataset.label || 'Ouvir resposta');
  botao.setAttribute('aria-label', titulo);
  botao.title = titulo;
}

function adicionarBotaoReproduzirAudio(audioBase64, texto) {
  const mensagem = document.querySelector('#chat-mensagens .chat-msg.urfilig:last-child');
  if (!mensagem) return null;
  const botao = mensagem.querySelector('.chat-acao-ouvir');
  if (!botao) return null;
  botao.onclick = async () => {
    definirEstadoBotaoOuvir(botao, true);
    await tocarAudioPiper(audioBase64, texto);
    window.setTimeout(() => definirEstadoBotaoOuvir(botao, false), 700);
  };
  return botao;
}

document.addEventListener('urfilig:ouvir-resposta', async (event) => {
  const texto = String(event.detail?.texto || '');
  const botao = event.detail?.botao;
  if (!texto || !botao) return;
  definirEstadoBotaoOuvir(botao, true);
  falar(texto, { onEnd: concluirFalaMascote });
  window.setTimeout(() => definirEstadoBotaoOuvir(botao, false), 700);
});

document.addEventListener('urfilig:lembrete', (event) => {
  const lembrete = event.detail || {};
  const texto = `Lembrete: ${String(lembrete.titulo || 'compromisso')}`;
  setLiveStatus(texto);
  adicionarMensagemChat('Urfilig', texto);
});

function showWeather({ temperatura, codigo }) {
  const elementoClima = document.querySelector('#hud-clock-weather');
  if (!elementoClima || !Number.isFinite(Number(temperatura))) return;
  const descricoes = { 0: 'céu limpo', 1: 'poucas nuvens', 2: 'nublado', 3: 'encoberto', 45: 'neblina', 48: 'neblina', 51: 'garoa', 53: 'garoa', 55: 'garoa', 61: 'chuva leve', 63: 'chuva', 65: 'chuva forte', 71: 'neve', 80: 'pancadas de chuva', 95: 'trovoadas' };
  elementoClima.textContent = `Contagem · ${Math.round(temperatura)}°C · ${descricoes[codigo] || 'clima atual'}`;
}
fetch('https://api.open-meteo.com/v1/forecast?latitude=-19.9317&longitude=-44.0536&current_weather=true&timezone=America%2FSao_Paulo', { cache: 'no-store' })
  .then((response) => response.ok ? response.json() : null)
  .then((data) => {
    if (data?.current_weather) showWeather({ temperatura: data.current_weather.temperature, codigo: data.current_weather.weathercode });
  }).catch(() => {});

function atualizarRelogio() {
  const agora = new Date();
  const hora = document.querySelector('#hud-clock-time');
  const data = document.querySelector('#hud-clock-date');
  if (hora) hora.textContent = agora.toLocaleTimeString('pt-BR', { hour12: false });
  if (data) data.textContent = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000);

const overlayToggle = document.querySelector('#mascot-overlay-toggle');
let mascotOverlay = null;
let mascotOverlayActive = false;
let alterandoMascotOverlay = false;
function atualizarEstadoMascotOverlay(ativo, titulo = ativo ? 'Desativar sobreposição do mascote' : 'Sobrepor mascote') {
  mascotOverlayActive = ativo;
  if (mascotRef) mascotRef.visible = !ativo;
  overlayToggle.title = titulo;
  overlayToggle.setAttribute('aria-label', titulo);
  overlayToggle.setAttribute('aria-pressed', String(ativo));
}
overlayToggle?.addEventListener('click', async () => {
  if (!isTauri()) {
    overlayToggle.title = 'A sobreposição está disponível no aplicativo desktop';
    overlayToggle.setAttribute('aria-label', 'A sobreposição está disponível no aplicativo desktop');
    return;
  }
  if (alterandoMascotOverlay) return;
  alterandoMascotOverlay = true;
  const estavaAtivo = mascotOverlayActive;
  try {
    if (mascotOverlay) {
      await mascotOverlay.close();
      mascotOverlay = null;
      atualizarEstadoMascotOverlay(false);
      return;
    }
    let janela = await WebviewWindow.getByLabel('mascote-overlay');
    if (!janela) {
      janela = new WebviewWindow('mascote-overlay', {
        url: 'mascote-overlay.html', title: 'Mascote Urfilig', width: 360, height: 520,
        x: 88, y: Math.max(0, window.innerHeight - 540),
        decorations: false, transparent: true, alwaysOnTop: true, focus: false, focusable: false,
        resizable: false, skipTaskbar: true, shadow: false,
      });
      // A construção é assíncrona no Tauri: não esconda o mascote até
      // receber a confirmação, e trate o erro que chega por evento.
      await new Promise((resolve, reject) => {
        let concluido = false;
        const desinscrever = [];
        const finalizar = (erro) => {
          if (concluido) return;
          concluido = true;
          desinscrever.forEach((fn) => fn());
          if (erro) reject(erro); else resolve();
        };
        const registrar = (evento, callback) => {
          janela.once(evento, callback).then((fn) => {
            if (concluido) fn(); else desinscrever.push(fn);
          }, finalizar);
        };
        registrar('tauri://created', () => finalizar());
        registrar('tauri://error', (event) => finalizar(event.payload || event));
      });
    }
    mascotOverlay = janela;
    let janelaDestruida = false;
    await janela.once('tauri://destroyed', () => {
      janelaDestruida = true;
      if (mascotOverlay !== janela) return;
      mascotOverlay = null;
      atualizarEstadoMascotOverlay(false);
    });
    if (!janelaDestruida) atualizarEstadoMascotOverlay(true);
  } catch (error) {
    console.error('[mascote-overlay] falha:', error);
    if (!estavaAtivo) mascotOverlay = null;
    atualizarEstadoMascotOverlay(estavaAtivo, estavaAtivo ? 'Desativar sobreposição do mascote' : 'Não foi possível abrir o mascote');
  } finally {
    alterandoMascotOverlay = false;
  }
});

function alternarPecaDoMascote(nomeDaParte, visivel) {
  if (!mascotRef) return;
  const peca = mascotRef.getObjectByName(nomeDaParte);
  if (!peca) return;
  peca.visible = visivel;
}

function showTooltip(particle) {
  if (!particle) {
    if (tooltip) tooltip.hidden = true;
    return;
  }
  if (tooltip) {
    tooltip.textContent = particle.label || particle.titulo || '';
    tooltip.style.left = Math.min(lastPointer.x + 14, window.innerWidth - 230) + 'px';
    tooltip.style.top = Math.min(lastPointer.y + 14, window.innerHeight - 52) + 'px';
    tooltip.hidden = false;
  }
}

function syncAccessibleParticles(particles) {
  if (!accessibilityContainer) return;
  accessibilityContainer.replaceChildren();
  particles.forEach((particle, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'visually-hidden memory-accessibility-button';
    button.textContent = 'Memoria: ' + (particle.label || particle.titulo || '');
    button.addEventListener('focus', () => {
      memorySphere.focus(index);
      lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      showTooltip(particle);
    });
    button.addEventListener('blur', () => memorySphere.hover(null));
    button.addEventListener('click', () => {
      memorySphere.select(index);
    });
    accessibilityContainer.append(button);
  });
}

// ==========================================================
// GESTÃO DO RATO / EVENTOS DE PONTEIRO (CLIQUE VS ARRASTO CORRIGIDOS)
// ==========================================================

let drag = null;
let posicaoInicialClique = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (event) => {
  try {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;

    posicaoInicialClique = { x: event.clientX, y: event.clientY };

    const particulaIndex = hitTestPersonalizado(event.clientX, event.clientY);
    const isPan = event.button === 2 || event.shiftKey;

    if (particulaIndex !== null && event.button === 0 && !event.shiftKey) {
      nodeArrastado = memorySphere.particulas[particulaIndex];
      // SINCRONIZAÇÃO CRÍTICA COM A CLASSE DA ESFERA
      memorySphere.nodeArrastado = nodeArrastado;

      const posNodeWorld = extrairCoordenada3D(nodeArrastado);
      if (posNodeWorld) {
        const dirCam = camera.getWorldDirection(new THREE.Vector3()).negate();
        planoArrasto.setFromNormalAndCoplanarPoint(dirCam, posNodeWorld);
      } else {
        nodeArrastado = null;
        memorySphere.nodeArrastado = null;
      }
    }

    drag = {
      pointerId: event.pointerId,
      button: event.button,
      isPan,
      isNodeDrag: !!nodeArrastado,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      moved: false,
    };
    canvas.setPointerCapture?.(event.pointerId);
  } catch (err) {
    console.error('Erro no pointerdown:', err);
  }
});

canvas.addEventListener('pointermove', (event) => {
  try {
    lastPointer = { x: event.clientX, y: event.clientY };

    if (drag?.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      drag.deltaX = deltaX;
      drag.deltaY = deltaY;

      const distX = Math.abs(event.clientX - drag.startX);
      const distY = Math.abs(event.clientY - drag.startY);
      if (Math.hypot(distX, distY) > 5) {
        drag.moved = true;
      }

      if (drag.isNodeDrag && nodeArrastado) {
        const rect = canvas.getBoundingClientRect();
        ndcMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        ndcMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterMouse.setFromCamera(ndcMouse, camera);

        if (raycasterMouse.ray.intersectPlane(planoArrasto, pontoIntersecao)) {
          scene.updateMatrixWorld(true);
          const localTarget = memorySphere.grupo.worldToLocal(pontoIntersecao.clone());

          const tempo = performance.now() / 1000;
          const raioOrbita = 0.10;
          const velocidadeOrbita = 0.25;
          const offsetX = Math.sin(tempo * velocidadeOrbita + nodeArrastado.fase) * raioOrbita;
          const offsetY = Math.cos(tempo * (velocidadeOrbita * 1.2) + nodeArrastado.fase) * raioOrbita;
          const offsetZ = Math.sin(tempo * (velocidadeOrbita * 1.8) + nodeArrastado.fase) * raioOrbita;
          const posLocalBase = nodeArrastado.posicaoAtual.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

          // O alvo acompanha o cursor com uma mola suave; a posição visível
          // não teleporta e ainda pode reagir às colisões com outros nós.
          nodeArrastado.alvoArrasto.copy(localTarget.sub(posLocalBase));
        }
        if (tooltip) tooltip.hidden = true;
      } else if (drag.moved) {
        if (drag.isPan) {
          memorySphere.grupo.position.x += deltaX * 0.01;
          memorySphere.grupo.position.y -= deltaY * 0.01;

          memorySphere.grupo.position.x = THREE.MathUtils.clamp(
            memorySphere.grupo.position.x,
            LIMITES_ESFERA.minX,
            LIMITES_ESFERA.maxX
          );
          memorySphere.grupo.position.y = THREE.MathUtils.clamp(
            memorySphere.grupo.position.y,
            LIMITES_ESFERA.minY,
            LIMITES_ESFERA.maxY
          );
        } else {
          memorySphere.rotateBy(deltaX, deltaY);
        }
        if (tooltip) tooltip.hidden = true;
      }
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      return;
    }

    const particulaIndex = hitTestPersonalizado(event.clientX, event.clientY);
    if (particulaIndex !== null) {
      memorySphere.hover(particulaIndex);
      showTooltip(memorySphere.particulas[particulaIndex]);
      canvas.style.cursor = 'pointer';
    } else {
      memorySphere.hover(null);
      if (tooltip) tooltip.hidden = true;
      canvas.style.cursor = 'grab';
    }

    const rect = canvas.getBoundingClientRect();
    ndcMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndcMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  } catch (err) {
    console.error('Erro no pointermove:', err);
  }
});

window.addEventListener('pointermove', (event) => {
  lastPointer = { x: event.clientX, y: event.clientY };
  const rect = canvas.getBoundingClientRect();
  ndcMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}, { passive: true });

canvas.addEventListener('pointerup', (event) => {
  try {
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.moved) {
      const particulaIndex = hitTestPersonalizado(event.clientX, event.clientY);
      if (particulaIndex !== null && event.button === 0) {
        memorySphere.select(particulaIndex);
        const obj = memorySphere.particulas[particulaIndex];
        const nome = obj.label || obj.titulo;
        if (nome) {
          setLiveStatus('Selecionado: ' + nome);
        }
      }
    } else if (drag.moved && !drag.isPan && !drag.isNodeDrag) {
      memorySphere.setInertia(drag.deltaX, drag.deltaY);
    }

    // Ao soltar o nó, mostra apenas um efeito visual.
    if (nodeArrastado) {
      memorySphere.emitDust(nodeArrastado.position || nodeArrastado.posicaoAtual, nodeArrastado.corAtual, 30, 'explode');
      nodeArrastado.velocidadeArrasto?.multiplyScalar(0.12);
      nodeArrastado = null;
      memorySphere.nodeArrastado = null;
    }

    canvas.releasePointerCapture?.(event.pointerId);
    drag = null;
  } catch (err) {
    console.error('Erro no pointerup:', err);
  }
});

function setLiveStatus(message) {
  if (liveStatus) liveStatus.textContent = message;
}

reducedMotionQuery.addEventListener?.('change', (event) => {
  memorySphere.setReducedMotion(event.matches);
});

window.addEventListener('resize', () => {
  const currentDpr = Math.min(window.devicePixelRatio, 2);
  const width = canvas?.getBoundingClientRect().width || window.innerWidth;
  camera.aspect = width / window.innerHeight;
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  centralizarEsferaNaTela();
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(width, window.innerHeight, false);
  composer.setPixelRatio(currentDpr);
  composer.setSize(width, window.innerHeight);
  if (rendererMascoteFrontal) {
    rendererMascoteFrontal.setPixelRatio(currentDpr);
    rendererMascoteFrontal.setSize(width, window.innerHeight, false);
    alinharCanvasMascoteFrontal();
  } else {
    composerMascoteFallback.setPixelRatio(currentDpr);
    composerMascoteFallback.setSize(width, window.innerHeight);
  }
  bloomPass.setSize(width, window.innerHeight);
  smaaPass.setSize(width * currentDpr, window.innerHeight * currentDpr);
  redimensionarCanvasLabels();
});

function renderizarRotulosObsidian() {
  const particulas = memorySphere.particulas || [];
  if (!ctx2d || !labelsCanvas || particulas.length === 0) return;

  const currentDpr = Math.min(window.devicePixelRatio, 2);
  const canvasRect = canvas.getBoundingClientRect();
  ctx2d.clearRect(0, 0, labelsCanvas.width, labelsCanvas.height);

  const dirCam = new THREE.Vector3(0, 0, 1);
  const hoverParticle = memorySphere.hoverIndex !== null ? particulas[memorySphere.hoverIndex] : null;

  const activeFolder = hoverParticle
    ? (hoverParticle.isFolder ? hoverParticle : (hoverParticle.isNote ? hoverParticle.folderRef : null))
    : null;

  particulas.forEach((p) => {
    const labelText = p.label || p.titulo;
    if (!labelText) return;

    const pos3D = extrairCoordenada3D(p);
    if (!pos3D) return;

    const dirPonto = pos3D.clone().normalize();
    const facing = dirPonto.dot(dirCam);

    let deveExibir = false;

    if (!p.isNote) {
      deveExibir = true;
    } else {
      if (activeFolder && p.folderRef === activeFolder) {
        deveExibir = true;
      }
    }

    if (!deveExibir) return;

    let alphaLabel = THREE.MathUtils.clamp((facing - 0.1) / 0.5, 0, 1);

    if (hoverParticle === p) {
      alphaLabel = 1.0;
    }

    if (alphaLabel <= 0.02) return;

    tempVec.copy(pos3D);
    tempVec.project(camera);

    if (tempVec.z >= -1 && tempVec.z <= 1) {
      const px = (tempVec.x * 0.5 + 0.5) * canvasRect.width * currentDpr;
      const py = (tempVec.y * -0.5 + 0.5) * window.innerHeight * currentDpr;

      ctx2d.font = `600 ${11 * currentDpr}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      const textWidth = ctx2d.measureText(labelText).width;
      const boxHeight = 22 * currentDpr;
      const boxY = py + 26 * currentDpr;

      ctx2d.fillStyle = `rgba(20, 22, 26, ${0.78 * alphaLabel})`;
      ctx2d.beginPath();
      ctx2d.roundRect(px - textWidth / 2 - 8 * currentDpr, boxY, textWidth + 16 * currentDpr, boxHeight, 4 * currentDpr);
      ctx2d.fill();
      ctx2d.strokeStyle = `rgba(255, 255, 255, ${0.09 * alphaLabel})`;
      ctx2d.lineWidth = currentDpr;
      ctx2d.stroke();
      ctx2d.fillStyle = `rgba(238, 239, 242, ${alphaLabel})`;

      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(labelText, px, boxY + boxHeight / 2);
    }
  });
}

const clock = new THREE.Clock();
function animate() {
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;
  mixer?.update(delta);
  if (mascotRef) mascotRef.scale.setScalar(THREE.MathUtils.lerp(mascotRef.scale.x, escalaAlvoMascote, Math.min(1, delta * 8)));
  posicionarMascoteSobreChat();
  motionController?.update(elapsed, delta);

  memorySphere.grupo.scale.setScalar(
    THREE.MathUtils.lerp(memorySphere.grupo.scale.x, targetSphereScale, 0.1)
  );

  memorySphere.update(delta);
  if (!reducedMotionQuery.matches) memorySphere.grupo.rotation.y += delta * 0.009;
  composer.render();
  // A limpeza automática também remove a imagem ao ativar o overlay desktop.
  if (rendererMascoteFrontal) {
    alinharCanvasMascoteFrontal();
    rendererMascoteFrontal.render(cenaMascoteFrontal, camera);
  } else {
    renderer.clearDepth();
    composerMascoteFallback.render();
  }
  renderizarRotulosObsidian();
  requestAnimationFrame(animate);
}
animate();
