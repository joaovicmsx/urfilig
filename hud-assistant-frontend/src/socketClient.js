import { io } from 'socket.io-client';
import { BACKEND_URL } from './authGuard.js';

/**
 * Conecta no backend e distribui os eventos pros handlers passados —
 * formato de callbacks em vez de receber a stateMachine direto, porque
 * agora tem mais de um sistema reagindo ao socket (stateMachine, motion
 * controller, esfera de partículas, expressões faciais).
 */
export function conectarSocket({ stateMachine, motionController, onExpression, onParticles, onResponse, onWeather, onOutfit } = {}) {
  const socket = io(BACKEND_URL, {
    reconnectionDelay: 2000,
    auth: { token: localStorage.getItem('urfilig_token') },
  });

  socket.on('connect', () => {
    console.log('[socket] conectado ao backend em', BACKEND_URL);
  });

  socket.on('connect_error', (erro) => {
    console.warn('[socket] não conseguiu conectar ao backend:', erro.message);
    if (erro.message.includes('autenticado') || erro.message.includes('Token')) {
      localStorage.removeItem('urfilig_token');
      localStorage.removeItem('urfilig_usuario');
      window.location.href = '/login.html';
    }
  });

  socket.on('mascot:state', ({ state }) => {
    stateMachine?.transitionTo(state);
  });

  // Modo comportamental (ex: "orbit" vs "flutuar") — ainda não emitido pelo
  // backend atual, reservado pra quando a Persona Agêntica quiser influenciar
  // o movimento (ex: parar de orbitar e "prestar atenção" durante LISTENING)
  socket.on('mascot:mode', ({ mode }) => {
    stateMachine?.setMode(mode);
    motionController?.setMode(mode);
  });

  socket.on('mascot:expression', ({ shape, weight }) => {
    onExpression?.(shape, weight);
  });

  // Lista de partículas da Esfera Neural (memórias/leads/traços) — ver nota
  // "Persona Agêntica" e "Migração para Banco de Dados" no Obsidian pra
  // status de quais dados reais já alimentam isso no backend
  socket.on('mascot:particles', (particles) => {
    onParticles?.(particles);
  });

  socket.on('hud:response', ({ text, emotion, audio }) => {
    onResponse?.({ text, emotion, audio });
  });

  // Clima de Contagem, MG — ver src/weather/weatherService.js no backend
  socket.on('weather:update', (dados) => {
    onWeather?.(dados);
  });

  // Alterna a visibilidade de uma parte nomeada do .glb do mascote (ex:
  // "Casaco" quando está frio). Só funciona se o modelo tiver essa peça.
  socket.on('mascot:outfit', ({ part, visible }) => {
    onOutfit?.(part, visible);
  });

  return socket;
}
