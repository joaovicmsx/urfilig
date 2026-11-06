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
import { HeadTracker } from './mascot/headTracker.js';
import { encontrarMeshComMorphTargets, setExpression } from './mascot/expressions.js';
import { MascotStateMachine } from './mascot/stateMachine.js';
import { conectarSocket } from './socketClient.js';
import { falar } from './voice/ttsManager.js';
import { exigirLogin, validarSessao, sair, BACKEND_URL } from './authGuard.js';
import { iniciarMenuLateral } from './sideMenu.js';
import { iniciarProspeccao } from './prospeccao.js';
import { iniciarSpotify } from './spotify.js';
import { carregarCalendarioUI } from './calendario.js';
import { iniciarModuloContatos } from './contatos.js';
import { iniciarQuadrosRotina } from './routineBoards.js';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emitTo, listen as listenTauri } from '@tauri-apps/api/event';
import { adicionarMensagemChat, iniciarNovaConversaChat, inicializarConversasChat, lerHistoricoChat, renderizarListaConversasChat, restaurarHistoricoChat } from './chatHistory.js';

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
let targetSphereScale = 1.0;
const MIN_SCALE = 0.5;
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
  minY: -2.5,
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
let headTracker = null;
let faceMesh = null;
let muted = false;
let mousePresenteNaTela = false;

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

function atualizarTemaPorHorario() {
  const rgb = getTimeColor();
  const cor = new THREE.Color(`rgb(${rgb.join(',')})`);
  const uniforms = fundoEtereo.material.uniforms;
  const hora = new Date().getHours() + new Date().getMinutes() / 60;
  const paleta = [
    [0,  ['#263957', '#7d89a7', '#b99191', '#263650']],
    [5,  ['#354b69', '#a18ca5', '#d49a7d', '#34445d']],
    [7,  ['#9fc4df', '#c6bad5', '#e1c2a5', '#819fbe']],
    [10, ['#aacde6', '#c9c5dc', '#e4d2b8', '#95b5d1']],
    [14, ['#a6c5df', '#c9bfd9', '#e2c9ae', '#91a9c8']],
    [16, ['#91afd0', '#c5a7be', '#dfa783', '#788fac']],
    [18, ['#5d7399', '#b98e9e', '#d28e73', '#3c4b68']],
    [20, ['#354a67', '#9c8ba5', '#ca967d', '#30405d']],
    [22, ['#293c5a', '#818ba8', '#b88f88', '#293a55']],
    [24, ['#263957', '#7d89a7', '#b99191', '#263650']],
  ];
  let indice = 0;
  while (indice < paleta.length - 2 && hora > paleta[indice + 1][0]) indice++;
  const [horaInicial, coresIniciais] = paleta[indice];
  const [horaFinal, coresFinais] = paleta[indice + 1];
  const fator = (hora - horaInicial) / (horaFinal - horaInicial);
  const cores = coresIniciais.map((hex, i) => new THREE.Color(hex).lerp(new THREE.Color(coresFinais[i]), fator));
  uniforms.corTopo.value.copy(cores[0]);
  uniforms.corMeio.value.copy(cores[1]);
  uniforms.corBase.value.copy(cores[2]);
  uniforms.corVazio.value.copy(cores[3]);
  memorySphere.setTimeColor(cor);
  document.documentElement.style.setProperty('--time-accent', `rgb(${rgb.join(',')})`);
  document.documentElement.style.setProperty('--time-halo', `rgba(${rgb.join(',')}, .11)`);
}
atualizarTemaPorHorario();
setInterval(atualizarTemaPorHorario, 60_000);

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
  onExpression: (shape, weight) => {
    if (faceMesh) setExpression(faceMesh, shape, weight);
  },
  onParticles: (particles) => {
    if (Array.isArray(particles) && particles.length > 0) {
      atualizarBolinhasDaEsfera(particles);
    }
  },
  onResponse: ({ text, emotion, audio }) => {
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
      falar(text);
    }
    setLiveStatus('Resposta recebida' + (emotion ? '. Tom: ' + emotion + '.' : '.'));

    if (typeof window.recarregarInterfaceNotas === 'function') {
      window.recarregarInterfaceNotas();
    }
  },
  onWeather: (dados) => showWeather(dados),
  onOutfit: (part, visible) => alternarPecaDoMascote(part, visible),
});

iniciarMenuLateral(socket);
iniciarProspeccao();
iniciarSpotify();

window.recarregarEsferaNeural = carregarMemoriasECerebro;

function atualizarBolinhasDaEsfera(particulas) {
  memorySphere.setParticles(particulas);
  syncAccessibleParticles(particulas);
}

function ehParticulaDoCerebro(particula) {
  const id = String(particula?.id || '');
  const label = String(particula?.label || '');
  return Boolean(particula?.isNote || particula?.isFolder)
    || /^(hobby|pasta|nota)-/.test(id)
    || id.startsWith('lembrete-')
    || label.startsWith('Hobby: ');
}

async function carregarMemoriasECerebro() {
  const token = localStorage.getItem('urfilig_token');
  if (!token) return;

  try {
    const particulas = [];

    const respMe = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respMe.ok) return;
    if (respMe.ok) {
      const { usuario } = await respMe.json();
      if (usuario?.hobbies) {
        const hobbiesLista = typeof usuario.hobbies === 'string'
          ? usuario.hobbies.split(',')
          : usuario.hobbies;

        hobbiesLista.forEach((hobby) => {
          const hobbyNome = hobby.trim();
          if (hobbyNome) {
            particulas.push({
              id: 'hobby-' + hobbyNome,
              titulo: hobbyNome,
              label: hobbyNome,
              strength: 0.8,
              isFolder: false,
              isNote: false,
            });
          }
        });
      }
    }

    const respCerebro = await fetch(`${BACKEND_URL}/api/cerebro/pastas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respCerebro.ok) return;
    if (respCerebro.ok) {
      const pastas = await respCerebro.json();
      if (Array.isArray(pastas)) {
        pastas.forEach((pasta) => {
          const folderObj = {
            id: 'pasta-' + pasta.id,
            titulo: pasta.nome,
            label: pasta.nome,
            strength: 0.9,
            isFolder: true,
            isNote: false,
          };
          particulas.push(folderObj);

          if (pasta.notas && Array.isArray(pasta.notas)) {
            pasta.notas.forEach((nota) => {
              particulas.push({
                id: 'nota-' + nota.id,
                titulo: nota.titulo,
                label: nota.titulo,
                strength: 0.5,
                isFolder: false,
                isNote: true,
                folderRef: folderObj,
              });
            });
          }
        });
      }
    }

    const respNotasSoltas = await fetch(`${BACKEND_URL}/api/cerebro/notas-soltas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respNotasSoltas.ok) return;
    if (respNotasSoltas.ok) {
      const notasSoltas = await respNotasSoltas.json();
      if (Array.isArray(notasSoltas)) {
        notasSoltas.forEach((nota) => {
          particulas.push({
            id: 'nota-' + nota.id,
            titulo: nota.titulo,
            label: nota.titulo,
            strength: 0.4,
            isFolder: false,
            isNote: true,
            folderRef: null,
          });
        });
      }
    }

    const respLembretes = await fetch(`${BACKEND_URL}/api/agenda?lembretes=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respLembretes.ok) {
      const lembretes = await respLembretes.json();
      if (Array.isArray(lembretes)) {
        lembretes.filter((lembrete) => !lembrete.concluido).forEach((lembrete) => {
          particulas.push({
            id: `lembrete-${lembrete.id}`,
            titulo: lembrete.titulo,
            label: `Lembrete: ${lembrete.titulo}`,
            strength: 0.65,
            isFolder: false,
            isNote: false,
            isReminder: true,
          });
        });
      }
    }

    const outrasParticulas = memorySphere.particulas.filter((particula) => !ehParticulaDoCerebro(particula));
    const mescladas = [...outrasParticulas, ...particulas];
    const unicas = new Map();
    mescladas.forEach((particula) => {
      const chave = particula.id || `${particula.isFolder ? 'pasta' : particula.isNote ? 'nota' : 'no'}:${particula.label}`;
      unicas.set(chave, particula);
    });
    atualizarBolinhasDaEsfera([...unicas.values()]);
  } catch (erro) {
    console.warn('[main] Erro ao carregar esfera neural:', erro.message);
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
  const chatHistorico = document.getElementById('chat-historico');
  const btnMinimizar = document.getElementById('chat-minimizar');
  const btnRestaurar = document.getElementById('chat-restaurar');
  const chatForm = document.getElementById('chat-form');
  const chatPainel = document.getElementById('chat-painel');
  const abrirChat = () => {
    if (chatHistorico) chatHistorico.style.display = 'flex';
    if (btnRestaurar) btnRestaurar.hidden = true;
    chatPainel?.classList.add('chat-expanded');
    document.querySelector('#nav-chats')?.setAttribute('aria-expanded', 'true');
    const sidebarHistory = document.querySelector('#chat-sidebar-history');
    if (sidebarHistory) sidebarHistory.hidden = false;
  };
  const minimizarChat = () => {
    if (chatHistorico) chatHistorico.style.display = 'none';
    if (btnRestaurar) btnRestaurar.hidden = false;
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
  document.querySelector('#chat-new-conversation')?.addEventListener('click', iniciarNovaConversaChat);

  if (chatForm) {
    const novoForm = chatForm.cloneNode(true);
    chatForm.parentNode.replaceChild(novoForm, chatForm);
    const quickProvider = document.querySelector('#quick-chat-provider');
    const provider = quickProvider;
    if (quickProvider) {
      quickProvider.value = localStorage.getItem('urfilig_llm_provider') || 'gemini';
      const trigger = document.querySelector('#chat-model-trigger');
      const label = document.querySelector('#chat-model-label');
      const menu = document.querySelector('#chat-model-menu');
      const renderProvider = () => {
        const provider = quickProvider.value === 'ollama' ? 'ollama' : 'gemini';
        quickProvider.value = provider;
        if (label) label.textContent = provider === 'ollama' ? 'Local' : 'Gemini';
        menu?.querySelectorAll('[data-chat-provider]').forEach((option) => {
          option.setAttribute('aria-checked', String(option.dataset.chatProvider === provider));
        });
      };
      renderProvider();
      quickProvider.addEventListener('change', () => {
        localStorage.setItem('urfilig_llm_provider', quickProvider.value);
        renderProvider();
      });
      trigger?.addEventListener('click', () => {
        const abrir = menu?.hidden;
        if (menu) menu.hidden = !abrir;
        trigger.setAttribute('aria-expanded', String(Boolean(abrir)));
      });
      menu?.querySelectorAll('[data-chat-provider]').forEach((option) => option.addEventListener('click', () => {
        quickProvider.value = option.dataset.chatProvider;
        quickProvider.dispatchEvent(new Event('change', { bubbles: true }));
        menu.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
      }));
      document.addEventListener('pointerdown', (event) => {
        const control = document.getElementById('chat-model-control');
        if (control && !control.contains(event.target) && menu && !menu.hidden) {
          menu.hidden = true;
          trigger?.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !menu || menu.hidden) return;
        menu.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus();
      });
    }

    novoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const texto = input?.value?.trim();
      if (!texto) return;

      input.value = '';
      adicionarMensagemChat('Você', texto);

      const btnEnviar = novoForm.querySelector('button[type="submit"]');
      if (btnEnviar) btnEnviar.disabled = true;

      try {
        let preferencias = {};
        try { preferencias = JSON.parse(localStorage.getItem('urfilig_preferencias') || '{}'); } catch { /* mantém as preferências padrão */ }
        const resp = await fetch(`${BACKEND_URL}/api/comando`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
          },
          body: JSON.stringify({
            texto,
            provider: provider?.value || localStorage.getItem('urfilig_llm_provider') || 'gemini',
            responseStyle: preferencias.responseStyle || 'equilibrada',
            responseTone: preferencias.responseTone || 'natural',
          }),
        });

        const dados = await resp.json();
        if (resp.ok && dados.resposta) {
          const registroRotina = window.registrarPresencaRotina?.(texto);
          adicionarMensagemChat('Urfilig', dados.resposta);
          if (dados.audio) {
            const botaoAudio = adicionarBotaoReproduzirAudio(dados.audio, dados.resposta);
            void tocarAudioPiper(dados.audio, dados.resposta).then((iniciou) => {
              if (botaoAudio) botaoAudio.textContent = iniciou ? 'Ouvir novamente' : 'Ouvir resposta';
            });
          } else {
            falar(dados.resposta);
          }
          if (typeof registroRotina === 'string') adicionarMensagemChat('Rotina', registroRotina);
          carregarMemoriasECerebro();
          if (typeof window.recarregarInterfaceNotas === 'function') {
            window.recarregarInterfaceNotas();
          }
        } else {
          adicionarMensagemChat('Urfilig', dados.detalhe || dados.erro || 'Não consegui responder agora. Confira o estado do Gemini ou do Ollama no menu inferior esquerdo.');
        }
      } catch (err) {
        console.error('[chat] Erro ao enviar comando:', err);
      } finally {
        if (btnEnviar) btnEnviar.disabled = false;
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
  carregarMemoriasECerebro();
});

socket.on('connect', () => {
  carregarMemoriasECerebro();
});

let solicitacaoMicrofone;
let microfoneAtivo = false;
let microfoneRecusado = false;
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
    const audioCtx = new AudioContext();
    microfoneAtivo = true;
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);

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

carregarMascote('/models/mascote.glb', scene)
  .then(({ mascote, mixer: loadedMixer, clips }) => {
    normalizarEscala(mascote, 1.6);

    mascote.traverse((filho) => {
      if (filho.isMesh && filho.material) {
        const materiais = Array.isArray(filho.material) ? filho.material : [filho.material];
        materiais.forEach((material) => {
          material.metalness = 0.0;
          material.roughness = 0.85;
          if (material.emissive) {
            material.emissive.setHex(0x000000);
            material.emissiveIntensity = 0.0;
          }
        });
      }
    });

    mixer = loadedMixer;
    mascotRef = mascote;
    mascotStateMachine = new MascotStateMachine(mixer, clips);
    motionController = new MascotMotionController(mascote, {
      modo: 'fixo',
      // A posição é recalculada com base na barra do chat durante a renderização.
      posicaoFixa: new THREE.Vector3(0, 0, 8.0),
      pontoParaOlhar: new THREE.Vector3(0, 0, 20),
    });
    mascote.rotation.y = Math.PI / 2;
    mascote.visible = !mascotOverlayActive;

    headTracker = new HeadTracker(mascote);
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
  if (!mascotRef || !motionController || mascotOverlayActive || motionController.modo !== 'fixo') return;
  const chat = document.getElementById('chat-form');
  if (!chat) return;
  const canvasRect = canvas.getBoundingClientRect();
  const chatRect = chat.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height || !chatRect.width) return;

  const depth = motionController.posicaoFixa.z;
  const distance = Math.max(.1, camera.position.z - depth);
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
  const visibleWidth = visibleHeight * camera.aspect;
  const pixelX = (chatRect.left + chatRect.right) / 2;
  // A origem do mascote fica nos pés: encosta o modelo logo acima da barra.
  const pixelY = chatRect.top - 8;
  const ndcX = ((pixelX - canvasRect.left) / canvasRect.width) * 2 - 1;
  const ndcY = 1 - ((pixelY - canvasRect.top) / canvasRect.height) * 2;
  motionController.posicaoFixa.set(
    ndcX * visibleWidth / 2,
    camera.position.y + ndcY * visibleHeight / 2,
    depth,
  );
  mascotRef.position.copy(motionController.posicaoFixa);
}

let audioPiperAtual = null;
let urlAudioPiperTemporaria = null;
let contextoAudioPiper = null;
let fonteAudioPiper = null;

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
  if (textoReserva && falar(textoReserva)) {
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
      await audioPiperAtual.play();
      console.info('[voz] reprodução do Piper iniciada pelo elemento de áudio');
      return true;
    }
  } catch (erro) {
    console.warn('[voz] elemento de áudio não conseguiu tocar o Piper:', erro.message);
  }

  console.warn('[voz] usando síntese de voz do sistema como reserva. Áudio Piper recebido:', Boolean(audioBase64));
  if (textoReserva) falar(textoReserva);
  return false;
}

function adicionarBotaoReproduzirAudio(audioBase64, texto) {
  const mensagem = document.querySelector('#chat-mensagens .chat-msg.urfilig:last-child');
  if (!mensagem) return null;
  if (mensagem.querySelector('.chat-audio-retry')) return mensagem.querySelector('.chat-audio-retry');
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'chat-audio-retry';
  botao.textContent = 'Reproduzir áudio';
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    botao.textContent = 'Reproduzindo…';
    const iniciou = await tocarAudioPiper(audioBase64, texto);
    botao.disabled = false;
    botao.textContent = iniciou ? 'Ouvir novamente' : 'Tentar novamente';
  });
  mensagem.appendChild(botao);
  return botao;
}

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

const providerSelect = document.querySelector('#quick-chat-provider');
if (providerSelect) {
  providerSelect.value = localStorage.getItem('urfilig_llm_provider') || 'gemini';
}

const overlayToggle = document.querySelector('#mascot-overlay-toggle');
let mascotOverlay = null;
let mascotOverlayActive = false;
overlayToggle?.addEventListener('click', async () => {
  if (!isTauri()) {
    overlayToggle.title = 'A sobreposição está disponível no aplicativo desktop';
    overlayToggle.setAttribute('aria-label', 'A sobreposição está disponível no aplicativo desktop');
    return;
  }
  try {
    if (mascotOverlay) {
      await mascotOverlay.close(); mascotOverlay = null;
      mascotOverlayActive = false;
      if (mascotRef) mascotRef.visible = true;
      overlayToggle.title = 'Sobrepor mascote';
      overlayToggle.setAttribute('aria-label', 'Sobrepor mascote');
      overlayToggle.setAttribute('aria-pressed', 'false');
      return;
    }
    mascotOverlay = await WebviewWindow.getByLabel('mascote-overlay');
    if (!mascotOverlay) {
      mascotOverlay = new WebviewWindow('mascote-overlay', {
        url: 'mascote-overlay.html', title: 'Mascote Urfilig', width: 360, height: 520,
        x: 88, y: Math.max(0, window.innerHeight - 540),
        decorations: false, transparent: true, alwaysOnTop: true, focus: false, focusable: false,
        resizable: false, skipTaskbar: true, shadow: false,
      });
      mascotOverlay.once('tauri://destroyed', () => {
        mascotOverlay = null;
        mascotOverlayActive = false;
        if (mascotRef) mascotRef.visible = true;
        if (overlayToggle) { overlayToggle.title = 'Sobrepor mascote'; overlayToggle.setAttribute('aria-label', 'Sobrepor mascote'); overlayToggle.setAttribute('aria-pressed', 'false'); }
      });
      mascotOverlay.once('tauri://error', (error) => console.error('[mascote-overlay] falha ao abrir', error));
    }
    mascotOverlayActive = true;
    if (mascotRef) mascotRef.visible = false;
    overlayToggle.title = 'Desativar sobreposição do mascote';
    overlayToggle.setAttribute('aria-label', 'Desativar sobreposição do mascote');
    overlayToggle.setAttribute('aria-pressed', 'true');
  } catch (error) {
    console.error('[mascote-overlay] falha:', error);
    mascotOverlayActive = false;
    if (mascotRef) mascotRef.visible = true;
    overlayToggle.title = 'Não foi possível abrir o mascote';
    overlayToggle.setAttribute('aria-label', 'Não foi possível abrir o mascote');
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
    mousePresenteNaTela = true;

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
  mousePresenteNaTela = true;
  const rect = canvas.getBoundingClientRect();
  ndcMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndcMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}, { passive: true });
window.addEventListener('pointerleave', () => { mousePresenteNaTela = false; });
window.addEventListener('blur', () => { mousePresenteNaTela = false; });

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
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(width, window.innerHeight, false);
  composer.setPixelRatio(currentDpr);
  composer.setSize(width, window.innerHeight);
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
  posicionarMascoteSobreChat();
  motionController?.update(elapsed, delta);

  if (headTracker) {
    if (mousePresenteNaTela) {
      raycasterMouse.setFromCamera(ndcMouse, camera);
      headTracker.atualizarAlvoComRaycaster(raycasterMouse);
    }
    headTracker.update(delta, mousePresenteNaTela);
  }

  memorySphere.grupo.scale.setScalar(
    THREE.MathUtils.lerp(memorySphere.grupo.scale.x, targetSphereScale, 0.1)
  );

  memorySphere.update(delta);
  if (!reducedMotionQuery.matches) memorySphere.grupo.rotation.y += delta * 0.009;
  composer.render();
  renderizarRotulosObsidian();
  requestAnimationFrame(animate);
}
animate();
