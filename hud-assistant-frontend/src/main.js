import './windowChrome.js';
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
import { carregarCalendarioUI } from './calendario.js';
import { iniciarModuloContatos } from './contatos.js';

exigirLogin();
validarSessao();
window.sairDaUrfilig = sair;
window.carregarCalendarioUI = carregarCalendarioUI;

iniciarModuloContatos();

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
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
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
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

function redimensionarCanvasLabels() {
  if (!labelsCanvas) return;
  const currentDpr = Math.min(window.devicePixelRatio, 2);
  labelsCanvas.width = window.innerWidth * currentDpr;
  labelsCanvas.height = window.innerHeight * currentDpr;
  labelsCanvas.style.width = window.innerWidth + 'px';
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
  window.innerWidth * dpr,
  window.innerHeight * dpr,
  { samples: 4, type: THREE.HalfFloatType }
);

const composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(dpr);
composer.setSize(window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.08,
  0.15,
  0.98
);
composer.addPass(bloomPass);

const smaaPass = new SMAAPass(window.innerWidth * dpr, window.innerHeight * dpr);
composer.addPass(smaaPass);

function criarFundoEtereo() {
  const geometria = new THREE.SphereGeometry(70, 32, 32);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      corTopo: { value: new THREE.Color(0x24212a) },
      corMeio: { value: new THREE.Color(0x1c1b22) },
      corBase: { value: new THREE.Color(0x15141a) },
      corVazio: { value: new THREE.Color(0x101015) },
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
          : mix(corMeio, corBase, smoothstep(0.0, -1.0, altura));
        float nevoa = 0.15 + sin(vPosicao.x * 0.04) * sin(vPosicao.z * 0.04) * 0.08;
        cor = mix(cor, corVazio, clamp(nevoa, 0.0, 0.4));
        gl_FragColor = vec4(cor, 1.0);
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
let audioContext = null;
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
    memorySphere.playParticleSound('implode');
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
    memorySphere.playParticleSound('explode');
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
  const base = cor.clone().multiplyScalar(0.36);
  const uniforms = fundoEtereo.material.uniforms;
  uniforms.corTopo.value.copy(base.clone().multiplyScalar(1.3));
  uniforms.corMeio.value.copy(base);
  uniforms.corBase.value.copy(base.clone().multiplyScalar(0.72));
  uniforms.corVazio.value.copy(cor.clone().multiplyScalar(0.055));
  memorySphere.setTimeColor(cor);
  document.documentElement.style.setProperty('--time-accent', `rgb(${rgb.join(',')})`);
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
      tocarAudioPiper(audio);
    } else {
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

window.recarregarEsferaNeural = carregarMemoriasECerebro;

function atualizarBolinhasDaEsfera(particulas) {
  memorySphere.setParticles(particulas);
  syncAccessibleParticles(particulas);
}

async function carregarMemoriasECerebro() {
  const token = localStorage.getItem('urfilig_token');
  if (!token) return;

  try {
    const particulas = [];

    const respMe = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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

    if (particulas.length > 0) {
      atualizarBolinhasDaEsfera(particulas);
    }
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

  for (let i = 0; i < particulas.length; i++) {
    const p = particulas[i];
    const pos3D = extrairCoordenada3D(p);
    if (!pos3D) continue;

    if (pos3D.z < -2.0) continue;

    tempVec.copy(pos3D);
    tempVec.project(camera);

    if (tempVec.z >= -1 && tempVec.z <= 1) {
      const telaX = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
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

  if (btnMinimizar && chatHistorico && btnRestaurar) {
    btnMinimizar.addEventListener('click', () => {
      chatHistorico.style.display = 'none';
      btnRestaurar.hidden = false;
    });
    btnRestaurar.addEventListener('click', () => {
      chatHistorico.style.display = 'flex';
      btnRestaurar.hidden = true;
    });
  }

  if (chatForm) {
    const novoForm = chatForm.cloneNode(true);
    chatForm.parentNode.replaceChild(novoForm, chatForm);

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
        const resp = await fetch(`${BACKEND_URL}/api/comando`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
          },
          body: JSON.stringify({ texto }),
        });

        const dados = await resp.json();
        if (resp.ok && dados.resposta) {
          carregarMemoriasECerebro();
          if (typeof window.recarregarInterfaceNotas === 'function') {
            window.recarregarInterfaceNotas();
          }
        }
      } catch (err) {
        console.error('[chat] Erro ao enviar comando:', err);
      } finally {
        if (btnEnviar) btnEnviar.disabled = false;
      }
    });
  }

  carregarMemoriasECerebro();
});

function adicionarMensagemChat(autor, texto) {
  const chatMensagens = document.getElementById('chat-mensagens');
  if (!chatMensagens) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = autor === 'Você' ? 'chat-msg usuario' : 'chat-msg urfilig';
  msgDiv.innerHTML = `<strong>${autor}:</strong> ${texto}`;
  chatMensagens.appendChild(msgDiv);
  chatMensagens.scrollTop = chatMensagens.scrollHeight;
}

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
        filho.material.metalness = 0.0;
        filho.material.roughness = 0.85;
        if (filho.material.emissive) {
          filho.material.emissive.setHex(0x000000);
          filho.material.emissiveIntensity = 0.0;
        }
      }
    });

    mixer = loadedMixer;
    mascotRef = mascote;
    mascotStateMachine = new MascotStateMachine(mixer, clips);
    motionController = new MascotMotionController(mascote, {
      modo: 'fixo',
      posicaoFixa: new THREE.Vector3(-4.5, -2, 8.0),
      pontoParaOlhar: new THREE.Vector3(-4.5, -2, 20),
    });
    mascote.rotation.y = Math.PI / 2;

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

let audioPiperAtual = null;
function tocarAudioPiper(audioBase64) {
  window.speechSynthesis?.cancel();
  audioPiperAtual?.pause();

  audioPiperAtual = new Audio(`data:audio/wav;base64,${audioBase64}`);
  audioPiperAtual.play().catch((erro) => {
    console.warn('[main] falha ao tocar audio:', erro.message);
  });
}

function showWeather({ temperatura }) {
  let elementoClima = document.querySelector('#hud-weather');
  if (!elementoClima) {
    elementoClima = document.createElement('div');
    elementoClima.id = 'hud-weather';
    elementoClima.style.cssText =
      'position:fixed;top:1.4rem;right:5.5rem;z-index:2;color:#a5f3fc;font-size:0.85rem;opacity:0.85;';
    document.body.append(elementoClima);
  }
  elementoClima.textContent = `${Math.round(temperatura)}°C — Contagem`;
}

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
      unlockAudio();
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
    unlockAudio();

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

          nodeArrastado.offsetArrasto.copy(localTarget.sub(posLocalBase));
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

    // AO SOLTAR O NÓ: EMITE POEIRA E TOCAR SOM DE FINALIZAÇÃO
    if (nodeArrastado) {
      memorySphere.emitDust(nodeArrastado.position || nodeArrastado.posicaoAtual, nodeArrastado.corAtual, 30, 'explode');
      memorySphere.playParticleSound('explode');
      nodeArrastado = null;
      memorySphere.nodeArrastado = null;
    }

    canvas.releasePointerCapture?.(event.pointerId);
    drag = null;
  } catch (err) {
    console.error('Erro no pointerup:', err);
  }
});

function unlockAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

function setLiveStatus(message) {
  if (liveStatus) liveStatus.textContent = message;
}

reducedMotionQuery.addEventListener?.('change', (event) => {
  memorySphere.setReducedMotion(event.matches);
});

window.addEventListener('resize', () => {
  const currentDpr = Math.min(window.devicePixelRatio, 2);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(currentDpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
  smaaPass.setSize(window.innerWidth * currentDpr, window.innerHeight * currentDpr);
  redimensionarCanvasLabels();
});

function renderizarRotulosObsidian() {
  const particulas = memorySphere.particulas || [];
  if (!ctx2d || !labelsCanvas || particulas.length === 0) return;

  const currentDpr = Math.min(window.devicePixelRatio, 2);
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
      const px = (tempVec.x * 0.5 + 0.5) * window.innerWidth * currentDpr;
      const py = (tempVec.y * -0.5 + 0.5) * window.innerHeight * currentDpr;

      ctx2d.font = `600 ${11 * currentDpr}px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      const textWidth = ctx2d.measureText(labelText).width;
      const boxHeight = 22 * currentDpr;
      const boxY = py + 26 * currentDpr;

      ctx2d.fillStyle = `rgba(232, 226, 208, ${0.96 * alphaLabel})`;
      ctx2d.beginPath();
      ctx2d.roundRect(px - textWidth / 2 - 8 * currentDpr, boxY, textWidth + 16 * currentDpr, boxHeight, 4 * currentDpr);
      ctx2d.fill();
      ctx2d.fillStyle = `rgba(24, 24, 26, ${alphaLabel})`;

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
  composer.render();
  renderizarRotulosObsidian();
  requestAnimationFrame(animate);
}
animate();
