import { io } from 'socket.io-client';
import { BACKEND_URL } from './authGuard.js';

/** Conecta ao backend e encaminha os eventos usados pelo HUD e pela esfera. */
export function conectarSocket({ onParticles, onResponse, onWeather, onProspectingBatch, onProspectingError } = {}) {
   const socket = io(BACKEND_URL, {
   reconnectionDelay: 2000,
   auth: { token: localStorage.getItem('urfilig_token') },
 });
 
 socket.on('prospeccao:lote', (dados) => {
   if (typeof onProspectingBatch === 'function') onProspectingBatch(dados);
 });
 socket.on('prospeccao:erro', (dados) => {
   if (typeof onProspectingError === 'function') onProspectingError(dados);
 });

  socket.on('connect_error', (erro) => {
    console.warn('[socket] não conseguiu conectar ao backend:', erro.message);
    if (erro.message.includes('autenticado') || erro.message.includes('Token')) {
      localStorage.removeItem('urfilig_token');
      localStorage.removeItem('urfilig_usuario');
      window.location.href = '/login.html';
    }
  });
  socket.on('prospeccao:lote-pronto', (dados) => onProspectingBatch?.(dados));

  // Lista de partículas da Esfera Neural (memórias/leads/traços) — ver nota
  // "Persona Agêntica" e "Migração para Banco de Dados" no Obsidian pra
  // status de quais dados reais já alimentam isso no backend
  socket.on('mascot:particles', (particles) => {
    onParticles?.(particles);
  });

  socket.on('hud:response', ({ text, emotion, audio }) => {
    onResponse?.({ text, emotion, audio });
  });

  socket.on('agenda:lembrete', (lembrete) => {
    window.dispatchEvent(new CustomEvent('urfilig:lembrete', { detail: lembrete }));
  });

  // Clima de Contagem, MG — ver src/weather/weatherService.js no backend
  socket.on('weather:update', (dados) => {
   onWeather?.(dados);
 });
 
  return socket;
}
