import './loadingIndicator.css';

const requisicoesLentas = new Set();
const carregamentosExplicitos = new Set();
let indicador;
let timerEsconder;
let fetchInstrumentado = false;

function criarIndicador() {
  if (indicador || !document.body) return indicador;
  indicador = document.createElement('div');
  indicador.className = 'urfilig-loading-indicator';
  indicador.hidden = true;
  indicador.setAttribute('role', 'status');
  indicador.setAttribute('aria-live', 'polite');
  indicador.setAttribute('aria-label', 'Carregando');
  indicador.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path class="loading-trail" d="M8 47C16 40 18 23 35 8"/><path class="loading-trail" d="M6 17C19 20 18 37 32 52"/><path class="loading-trail" d="M45 57C43 43 49 24 59 13"/>
    <circle r="2.5"><animateMotion dur="1.8s" repeatCount="indefinite" path="M8 47C16 40 18 23 35 8"/></circle>
    <circle r="2.2"><animateMotion dur="2.2s" begin="-.7s" repeatCount="indefinite" path="M6 17C19 20 18 37 32 52"/></circle>
    <circle r="2.4"><animateMotion dur="2s" begin="-1.1s" repeatCount="indefinite" path="M45 57C43 43 49 24 59 13"/></circle>
  </svg>`;
  document.body.append(indicador);
  return indicador;
}

function atualizarIndicador() {
  const element = criarIndicador();
  if (!element) return;
  const carregando = requisicoesLentas.size > 0 || carregamentosExplicitos.size > 0;
  clearTimeout(timerEsconder);
  if (carregando) {
    element.hidden = false;
    element.classList.add('visivel');
    return;
  }
  element.classList.remove('visivel');
  timerEsconder = window.setTimeout(() => { element.hidden = true; }, 220);
}

export function iniciarIndicadorCarregamento() {
  const id = Symbol('urfilig-loading');
  carregamentosExplicitos.add(id);
  atualizarIndicador();
  let finalizado = false;
  return () => {
    if (finalizado) return;
    finalizado = true;
    carregamentosExplicitos.delete(id);
    atualizarIndicador();
  };
}

function instrumentarFetch() {
  if (fetchInstrumentado || typeof window.fetch !== 'function') return;
  fetchInstrumentado = true;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (...args) => {
    const requisicao = { visivel: false, timer: 0 };
    requisicao.timer = window.setTimeout(() => {
      requisicao.visivel = true;
      requisicoesLentas.add(requisicao);
      atualizarIndicador();
    }, 320);
    let promise;
    try {
      promise = fetchOriginal(...args);
    } catch (error) {
      clearTimeout(requisicao.timer);
      throw error;
    }
    return promise.finally(() => {
      clearTimeout(requisicao.timer);
      if (requisicao.visivel) {
        requisicoesLentas.delete(requisicao);
        atualizarIndicador();
      }
    });
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { criarIndicador(); instrumentarFetch(); }, { once: true });
} else {
  criarIndicador();
  instrumentarFetch();
}
