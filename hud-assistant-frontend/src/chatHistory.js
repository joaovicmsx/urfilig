import { isTauri } from '@tauri-apps/api/core';
import { emitTo } from '@tauri-apps/api/event';

const CHAT_HISTORY_PREFIX = 'urfilig_chat_history_v1:';
const CHAT_CONVERSATIONS_PREFIX = 'urfilig_chat_conversations_v1:';
const CHAT_CURRENT_PREFIX = 'urfilig_chat_current_v1:';
let conversasChat = null;
let conversaChatAtualId = null;

function obterIdentidadeChat() {
  try {
    const usuario = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}');
    return String(usuario.id || usuario.email || 'local').trim().toLowerCase() || 'local';
  } catch {
    return 'local';
  }
}

function obterChaveHistoricoChat() { return `${CHAT_HISTORY_PREFIX}${obterIdentidadeChat()}`; }
function obterChaveConversasChat() { return `${CHAT_CONVERSATIONS_PREFIX}${obterIdentidadeChat()}`; }
function obterChaveConversaAtualChat() { return `${CHAT_CURRENT_PREFIX}${obterIdentidadeChat()}`; }

function criarIdConversaChat() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tituloInicialConversa(mensagens = []) {
  const primeira = mensagens.find((mensagem) => mensagem.autor === 'Você' && mensagem.texto)?.texto;
  return primeira ? String(primeira).replace(/\s+/g, ' ').trim().slice(0, 42) : 'Conversa anterior';
}

function salvarConversasChat() {
  try {
    localStorage.setItem(obterChaveConversasChat(), JSON.stringify(conversasChat || []));
    if (conversaChatAtualId) localStorage.setItem(obterChaveConversaAtualChat(), conversaChatAtualId);
  } catch (erro) {
    console.warn('[chat] Não foi possível salvar as conversas:', erro);
  }
}

export function inicializarConversasChat() {
  try {
    const salvas = JSON.parse(localStorage.getItem(obterChaveConversasChat()) || 'null');
    conversasChat = Array.isArray(salvas) ? salvas.filter((item) => item && Array.isArray(item.mensagens)) : [];
  } catch { conversasChat = []; }

  if (!conversasChat.length) {
    let legado = [];
    try {
      const salvo = JSON.parse(localStorage.getItem(obterChaveHistoricoChat()) || '[]');
      if (Array.isArray(salvo)) legado = salvo.filter((item) => item && typeof item.texto === 'string');
    } catch { /* Começa sem mensagens se o histórico antigo estiver inválido. */ }
    if (legado.length) {
      const criadoEm = legado[0].criadoEm || new Date().toISOString();
      conversasChat.push({ id: criarIdConversaChat(), titulo: tituloInicialConversa(legado), mensagens: legado, criadoEm, atualizadoEm: legado.at(-1)?.criadoEm || criadoEm });
    }
  }

  try { conversaChatAtualId = localStorage.getItem(obterChaveConversaAtualChat()); } catch { conversaChatAtualId = null; }
  if (!conversasChat.some((item) => item.id === conversaChatAtualId)) conversaChatAtualId = conversasChat.at(-1)?.id || null;
  if (!conversaChatAtualId) iniciarNovaConversaChat(false);
  salvarConversasChat();
}

function obterConversaChatAtual() {
  if (!Array.isArray(conversasChat)) inicializarConversasChat();
  let conversa = conversasChat.find((item) => item.id === conversaChatAtualId);
  if (!conversa) {
    iniciarNovaConversaChat(false);
    conversa = conversasChat.find((item) => item.id === conversaChatAtualId);
  }
  return conversa;
}

export function iniciarNovaConversaChat(salvar = true) {
  if (!Array.isArray(conversasChat)) conversasChat = [];
  const agora = new Date().toISOString();
  const conversa = { id: criarIdConversaChat(), titulo: 'Nova conversa', mensagens: [], criadoEm: agora, atualizadoEm: agora };
  conversasChat.push(conversa);
  conversaChatAtualId = conversa.id;
  if (salvar) salvarConversasChat();
  if (document.getElementById('chat-mensagens')) {
    restaurarHistoricoChat();
    renderizarListaConversasChat();
  }
  return conversa;
}

function selecionarConversaChat(id) {
  if (!conversasChat?.some((item) => item.id === id)) return;
  conversaChatAtualId = id;
  salvarConversasChat();
  restaurarHistoricoChat();
  renderizarListaConversasChat();
}

function formatarDataConversaChat(valor) {
  const data = new Date(valor || Date.now());
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function renderizarListaConversasChat() {
  const listas = [document.getElementById('chat-conversation-list'), document.getElementById('chat-sidebar-conversation-list')].filter(Boolean);
  if (!listas.length) return;
  const ordenadas = [...(conversasChat || [])].sort((a, b) => new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm));
  listas.forEach((lista, indiceLista) => {
    lista.replaceChildren();
    ordenadas.forEach((conversa) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `chat-conversation-item${conversa.id === conversaChatAtualId ? ' ativa' : ''}`;
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-current', String(conversa.id === conversaChatAtualId));
      const titulo = document.createElement('span');
      titulo.className = 'chat-conversation-title';
      titulo.textContent = conversa.titulo || 'Conversa anterior';
      const ultima = conversa.mensagens?.at(-1);
      const resumo = document.createElement('small');
      resumo.textContent = ultima?.texto ? String(ultima.texto).replace(/\s+/g, ' ').slice(0, indiceLista ? 22 : 54) : 'Sem mensagens';
      const data = document.createElement('time');
      data.textContent = formatarDataConversaChat(conversa.atualizadoEm || conversa.criadoEm);
      item.append(titulo, resumo, data);
      item.addEventListener('click', () => {
        if (indiceLista) document.getElementById('nav-chats')?.click();
        selecionarConversaChat(conversa.id);
      });
      lista.append(item);
    });
  });
}

export function lerHistoricoChat() {
  const conversa = obterConversaChatAtual();
  return conversa?.mensagens || [];
}

function renderizarMensagemChat(autor, texto) {
  const chatMensagens = document.getElementById('chat-mensagens');
  if (!chatMensagens) return null;
  const msgDiv = document.createElement('div');
  msgDiv.className = autor === 'Você' ? 'chat-msg usuario' : 'chat-msg urfilig';
  const autorEl = document.createElement('strong');
  autorEl.textContent = `${autor}:`;
  msgDiv.append(autorEl, document.createTextNode(` ${texto}`));
  chatMensagens.appendChild(msgDiv);
  chatMensagens.scrollTop = chatMensagens.scrollHeight;
  return msgDiv;
}

export function restaurarHistoricoChat() {
  const chatMensagens = document.getElementById('chat-mensagens');
  if (!chatMensagens) return;
  chatMensagens.replaceChildren();
  const conversa = obterConversaChatAtual();
  conversa?.mensagens.forEach(({ autor, texto }) => renderizarMensagemChat(String(autor || 'Urfilig'), texto));
  const titulo = document.getElementById('chat-active-title');
  if (titulo) titulo.textContent = conversa?.titulo || 'Conversa';
}

export function adicionarMensagemChat(autor, texto) {
  const mensagem = String(texto ?? '');
  const conversa = obterConversaChatAtual();
  if (!conversa || !renderizarMensagemChat(autor, mensagem)) return;
  conversa.mensagens.push({ autor, texto: mensagem, criadoEm: new Date().toISOString() });
  if (autor === 'Você' && conversa.titulo === 'Nova conversa') conversa.titulo = mensagem.replace(/\s+/g, ' ').trim().slice(0, 42) || 'Nova conversa';
  conversa.atualizadoEm = new Date().toISOString();
  salvarConversasChat();
  const titulo = document.getElementById('chat-active-title');
  if (titulo) titulo.textContent = conversa.titulo;
  renderizarListaConversasChat();
  if (isTauri()) void emitTo('mascote-overlay', 'mascot:chat-message', { autor, texto: mensagem });
}
