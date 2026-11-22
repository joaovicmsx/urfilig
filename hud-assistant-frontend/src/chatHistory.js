
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
 return true;
 } catch (erro) {
 console.warn('[chat] Não foi possível salvar as conversas:', erro);
 return false;
 }
}

export function rolarChatParaFim() {
 const chatMensagens = document.getElementById('chat-mensagens');
 if (!chatMensagens) return;
 requestAnimationFrame(() => {
 chatMensagens.scrollTop = chatMensagens.scrollHeight;
 });
}

export function mostrarIndicadorPensando() {
 const chatMensagens = document.getElementById('chat-mensagens');
 if (!chatMensagens || document.getElementById('chat-pensando')) return;
 const indicador = document.createElement('div');
 indicador.id = 'chat-pensando';
 indicador.className = 'chat-pensando';
 indicador.setAttribute('role', 'status');
 indicador.setAttribute('aria-live', 'polite');
 indicador.innerHTML = '<span class="sr-only">Urfilig está pensando</span><i></i><i></i><i></i>';
 chatMensagens.appendChild(indicador);
 rolarChatParaFim();
}

export function ocultarIndicadorPensando() {
 document.getElementById('chat-pensando')?.remove();
}

function iconeAcao(tipo) {
 const icones = {
 ouvir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.7 7.7 0 0 1 0 11"/></svg>',
 copiar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>',
 compartilhar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
 };
 return icones[tipo] || '';
}

function mostrarEstadoAcao(botao, estado) {
 const tituloOriginal = botao.dataset.label || '';
 botao.classList.add('confirmado');
 botao.setAttribute('aria-label', estado);
 botao.title = estado;
 window.setTimeout(() => {
 botao.classList.remove('confirmado');
 botao.setAttribute('aria-label', tituloOriginal);
 botao.title = tituloOriginal;
 }, 1400);
}

function copiarTexto(texto, botao) {
 const finalizar = (sucesso) => mostrarEstadoAcao(botao, sucesso ? 'Copiado' : 'Não foi possível copiar');
 if (navigator.clipboard?.writeText) {
 navigator.clipboard.writeText(texto).then(() => finalizar(true)).catch(() => finalizar(false));
 return;
 }
 const area = document.createElement('textarea');
 area.value = texto;
 area.style.position = 'fixed';
 area.style.opacity = '0';
 document.body.appendChild(area);
 area.select();
 try { document.execCommand('copy'); finalizar(true); } catch { finalizar(false); }
 area.remove();
}

function fecharMenuCompartilhar() {
 document.querySelectorAll('.chat-menu-compartilhar.aberto').forEach((menu) => menu.classList.remove('aberto'));
}

function abrirCompartilhamentoNativo(texto, botao) {
 if (!navigator.share) {
 copiarTexto(texto, botao);
 return;
 }
 navigator.share({ title: 'Urfilig', text: texto })
 .then(() => mostrarEstadoAcao(botao, 'Compartilhado'))
 .catch(() => {});
}

function criarLinkCompartilhamento(nome, url, icone) {
 const link = document.createElement('a');
 link.className = 'chat-opcao-compartilhar';
 link.href = url;
 link.target = '_blank';
 link.rel = 'noopener noreferrer';
 link.title = nome;
 link.setAttribute('aria-label', nome);
 link.innerHTML = icone;
 link.addEventListener('click', fecharMenuCompartilhar);
 return link;
}

function criarBotaoCompartilhamento(nome, icone, aoClicar) {
 const botao = document.createElement('button');
 botao.type = 'button';
 botao.className = 'chat-opcao-compartilhar';
 botao.title = nome;
 botao.setAttribute('aria-label', nome);
 botao.innerHTML = icone;
 botao.addEventListener('click', () => {
 aoClicar();
 fecharMenuCompartilhar();
 });
 return botao;
}

function alternarMenuCompartilhar(texto, botao) {
 const pai = botao.parentElement;
 let menu = pai?.querySelector('.chat-menu-compartilhar');
 if (!menu) {
 const valor = encodeURIComponent(texto);
 const assunto = encodeURIComponent('Resposta do Urfilig');
 const copiar = () => copiarTexto(texto, botao);
 menu = document.createElement('div');
 menu.className = 'chat-menu-compartilhar';
 menu.setAttribute('role', 'menu');
 menu.append(
 criarLinkCompartilhamento('WhatsApp', `https://wa.me/?text=${valor}`, '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6Z"/><path d="M8.5 8.2c.2-.5.4-.5.7-.5h.4c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .6l-.4.5c-.1.1-.2.3-.1.4.4.8 1.1 1.5 1.9 1.9.1.1.3 0 .4-.1l.5-.6c.1-.2.4-.2.6-.1l1.6.8c.2.1.4.3.4.5v.4c0 .3-.2.5-.5.7-.4.2-1.2.4-2.3-.1-1-.4-2.3-1.3-3.5-2.7-1.2-1.4-1.6-2.7-1.5-3.6Z"/></svg>'),
 criarLinkCompartilhamento('E-mail', `mailto:?subject=${assunto}&body=${valor}`, '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 5.5L19.5 7"/></svg>'),
 criarLinkCompartilhamento('Telegram', `https://t.me/share/url?url=&text=${valor}`, '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-3 18-6.2-5-3.1 3 .7-4.4L17 7.3 7.5 13l-4.2-1.4L21 3Z"/></svg>'),
 criarBotaoCompartilhamento('Mais opções do sistema', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>', () => abrirCompartilhamentoNativo(texto, botao)),
 criarBotaoCompartilhamento('Copiar texto', '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>', copiar)
 );
 pai.appendChild(menu);
 }
 const estavaAberto = menu.classList.contains('aberto');
 fecharMenuCompartilhar();
 if (!estavaAberto) menu.classList.add('aberto');
}

function criarBotaoAcao(tipo, titulo, texto, aoClicar) {
 const botao = document.createElement('button');
 botao.type = 'button';
 botao.className = 'chat-resposta-acao chat-acao-' + tipo;
 botao.dataset.label = titulo;
 botao.setAttribute('aria-label', titulo);
 botao.title = titulo;
 botao.innerHTML = iconeAcao(tipo);
 botao.addEventListener('click', aoClicar);
 return botao;
}

function criarAcoesResposta(texto) {
 const acoes = document.createElement('div');
 acoes.className = 'chat-resposta-acoes';
 const ouvir = criarBotaoAcao('ouvir', 'Ouvir resposta', texto, () => {
 document.dispatchEvent(new CustomEvent('urfilig:ouvir-resposta', { detail: { texto, botao: ouvir } }));
 });
 const copiar = criarBotaoAcao('copiar', 'Copiar resposta', texto, () => copiarTexto(texto, copiar));
 const compartilhar = criarBotaoAcao('compartilhar', 'Compartilhar resposta', texto, () => alternarMenuCompartilhar(texto, compartilhar));
 acoes.append(ouvir, copiar, compartilhar);
 return acoes;
}

export function inicializarConversasChat() {
 let listaJaSalva = false;
 try {
 const salvas = JSON.parse(localStorage.getItem(obterChaveConversasChat()) || 'null');
 listaJaSalva = Array.isArray(salvas);
 conversasChat = listaJaSalva ? salvas.filter((item) => item && Array.isArray(item.mensagens)) : [];
 } catch { conversasChat = []; }

 // Um array salvo, mesmo vazio, já substituiu o formato legado; não o ressuscite.
 if (!listaJaSalva) {
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
 if (Number.isNaN(data.getTime())) return '';
 const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
 const horario = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
 return `${dataFormatada} · ${horario}`;
}

// O menu é anexado ao body para não ser cortado pelas áreas roláveis do histórico.
let menuConversaAberto = null;
let eventosConversasInstalados = false;

function fecharMenuConversa(devolverFoco = false) {
 if (!menuConversaAberto) return;
 const { menu, botao } = menuConversaAberto;
 menuConversaAberto = null;
 menu.remove();
 botao.setAttribute('aria-expanded', 'false');
 if (devolverFoco && botao.isConnected) botao.focus({ preventScroll: true });
}

function exibirDialogoConversa({ titulo, mensagem, valor, confirmar, somenteLeitura = false, focoAnterior }) {
 return new Promise((resolve) => {
  const fundo = document.createElement('div'); fundo.className = 'chat-dialog-backdrop';
  const caixa = document.createElement('form'); caixa.className = 'chat-dialog';
  caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-label', titulo);
  const heading = document.createElement('h2'); heading.textContent = titulo;
  const label = document.createElement('label'); label.textContent = mensagem;
  let campo;
  if (valor !== undefined) {
   campo = document.createElement(somenteLeitura ? 'textarea' : 'input');
   if (!somenteLeitura) { campo.type = 'text'; campo.maxLength = 100; campo.required = true; }
   else { campo.readOnly = true; campo.rows = 8; }
   campo.value = valor; label.append(campo);
  }
  const acoes = document.createElement('div'); acoes.className = 'chat-dialog-actions';
  const cancelar = document.createElement('button'); cancelar.type = 'button'; cancelar.textContent = somenteLeitura ? 'Fechar' : 'Cancelar';
  acoes.append(cancelar);
  if (!somenteLeitura) { const ok = document.createElement('button'); ok.type = 'submit'; ok.textContent = confirmar; acoes.append(ok); }
  let encerrado = false;
  const terminar = (resultado) => { if (encerrado) return; encerrado = true; fundo.remove(); if (focoAnterior?.isConnected) focoAnterior.focus(); resolve(resultado); };
  cancelar.addEventListener('click', () => terminar(null));
  caixa.addEventListener('submit', (evento) => { evento.preventDefault(); if (campo && !campo.value.trim()) { campo.focus(); return; } terminar(campo ? campo.value.trim() : true); });
  fundo.addEventListener('pointerdown', (evento) => { if (evento.target === fundo) terminar(null); });
  fundo.addEventListener('keydown', (evento) => {
   if (evento.key === 'Escape') { evento.preventDefault(); evento.stopPropagation(); terminar(null); }
   if (evento.key === 'Tab') {
    const controles = [...caixa.querySelectorAll('input, textarea, button')];
    const primeiro = controles[0], ultimo = controles.at(-1);
    if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
   }
  });
  caixa.append(heading, label, acoes); fundo.append(caixa); document.body.append(fundo);
  (campo || cancelar).focus(); campo?.select();
 });
}

function avisarConversa(texto) {
 let aviso = document.getElementById('chat-conversation-notice');
 if (!aviso) { aviso = document.createElement('div'); aviso.id = 'chat-conversation-notice'; aviso.className = 'chat-conversation-notice'; aviso.setAttribute('role', 'status'); document.body.append(aviso); }
 aviso.textContent = texto;
 window.clearTimeout(avisarConversa.timer);
 avisarConversa.timer = window.setTimeout(() => aviso.remove(), 4000);
}

async function compartilharConversaChat(conversa, focoAnterior) {
 const texto = `${conversa.titulo || 'Conversa'}\n\n${conversa.mensagens.map((mensagem) => `${mensagem.autor || 'Urfilig'}: ${mensagem.texto || ''}`).join('\n\n')}`;
 if (typeof navigator.share === 'function') {
  try { await navigator.share({ title: conversa.titulo || 'Conversa', text: texto }); return; }
  catch (erro) { if (erro?.name === 'AbortError') return; }
 }
 try {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
  await navigator.clipboard.writeText(texto); avisarConversa('Conversa copiada. Cole onde quiser compartilhar.');
 } catch {
  await exibirDialogoConversa({ titulo: 'Copiar conversa', mensagem: 'Compartilhamento indisponível. Copie o texto selecionado:', valor: texto, somenteLeitura: true, focoAnterior });
 }
}

// O histórico anterior à lista de conversas pode permanecer como uma cópia local.
// Só o removemos quando suas mensagens correspondem ao início da conversa excluída.
function removerCopiaLegadaDaConversa(conversa) {
 try {
  const chave = obterChaveHistoricoChat();
  const legado = JSON.parse(localStorage.getItem(chave) || 'null');
  if (Array.isArray(legado) && legado.length && legado.length <= conversa.mensagens.length && legado.every((mensagem, indice) => {
   const atual = conversa.mensagens[indice];
   return mensagem && atual && mensagem.autor === atual.autor && mensagem.texto === atual.texto && mensagem.criadoEm === atual.criadoEm;
  })) localStorage.removeItem(chave);
  return true;
 } catch (erro) {
  console.warn('[chat] Não foi possível verificar ou remover a cópia antiga:', erro);
  return false;
 }
}

async function executarAcaoConversaChat(id, acao, focoAnterior) {
 const conversa = conversasChat?.find((item) => String(item.id) === id);
 if (!conversa) return;
 const listaOrigem = focoAnterior?.closest('#chat-conversation-list, #chat-sidebar-conversation-list');
 if (acao === 'compartilhar') { await compartilharConversaChat(conversa, focoAnterior); return; }
 if (acao === 'renomear') {
  const titulo = await exibirDialogoConversa({ titulo: 'Renomear conversa', mensagem: 'Novo nome da conversa', valor: conversa.titulo || 'Conversa anterior', confirmar: 'Salvar', focoAnterior });
  if (titulo === null || !conversasChat.includes(conversa)) return;
  conversa.titulo = titulo; conversa.tituloPersonalizado = true;
 } else if (acao === 'fixar') {
  conversa.fixada = !conversa.fixada;
 } else if (acao === 'excluir') {
  const confirmado = await exibirDialogoConversa({ titulo: 'Excluir conversa', mensagem: `Excluir a conversa “${conversa.titulo || 'Conversa anterior'}” deste dispositivo? Esta ação não pode ser desfeita.`, confirmar: 'Excluir', focoAnterior });
  const indice = conversasChat.indexOf(conversa);
  if (!confirmado || indice < 0) return;
  conversasChat.splice(indice, 1);
  if (String(conversaChatAtualId) === id) {
   conversaChatAtualId = conversasChat.at(-1)?.id || null;
   if (!conversaChatAtualId) iniciarNovaConversaChat(false);
   restaurarHistoricoChat();
  }
 } else return;
 const salvo = salvarConversasChat();
 if (!salvo) avisarConversa('Não foi possível salvar. A alteração pode ser perdida ao fechar o aplicativo.');
 else if (acao === 'excluir' && !removerCopiaLegadaDaConversa(conversa)) avisarConversa('Conversa excluída, mas não foi possível verificar ou remover a cópia antiga.');
 if (acao === 'renomear' && String(conversaChatAtualId) === id) {
  const titulo = document.getElementById('chat-active-title'); if (titulo) titulo.textContent = conversa.titulo;
 }
 renderizarListaConversasChat();
 if (listaOrigem?.isConnected) {
  const linhas = [...listaOrigem.querySelectorAll('.chat-conversation-row')];
  const linha = linhas.find((item) => item.dataset.chatId === id) || linhas[0];
  linha?.querySelector('.chat-options-btn')?.focus({ preventScroll: true });
 }
}

function abrirMenuConversaChat(botao, id) {
 if (menuConversaAberto?.botao === botao) { fecharMenuConversa(true); return; }
 fecharMenuConversa(); fecharMenuCompartilhar();
 const conversa = conversasChat?.find((item) => String(item.id) === id); if (!conversa) return;
 const menu = document.createElement('div'); menu.className = 'chat-conversation-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Opções da conversa');
 const opcoes = [['compartilhar', 'Compartilhar', '↗'], ['fixar', conversa.fixada ? 'Desafixar' : 'Fixar', '⌖'], ['renomear', 'Renomear', '✎'], ['excluir', 'Excluir', '×']];
 opcoes.forEach(([acao, texto, icone]) => {
  const opcao = document.createElement('button'); opcao.type = 'button'; opcao.dataset.chatAction = acao; opcao.setAttribute('role', 'menuitem');
  if (acao === 'excluir') opcao.classList.add('chat-conversation-menu-delete');
  const simbolo = document.createElement('span'); simbolo.className = 'chat-conversation-menu-icon'; simbolo.setAttribute('aria-hidden', 'true'); simbolo.textContent = icone;
  const rotulo = document.createElement('span'); rotulo.textContent = texto; opcao.append(simbolo, rotulo); menu.append(opcao);
 });
 document.body.append(menu);
 const pos = botao.getBoundingClientRect(); const largura = menu.offsetWidth, altura = menu.offsetHeight, margem = 8;
 const topo = pos.bottom + 4 + altura <= window.innerHeight - margem ? pos.bottom + 4 : pos.top - altura - 4;
 menu.style.left = `${Math.max(margem, Math.min(pos.right - largura, window.innerWidth - largura - margem))}px`;
 menu.style.top = `${Math.max(margem, Math.min(topo, window.innerHeight - altura - margem))}px`;
 botao.setAttribute('aria-expanded', 'true'); menuConversaAberto = { menu, botao, id };
 menu.querySelector('button')?.focus({ preventScroll: true });
}

function instalarEventosConversasChat() {
 if (eventosConversasInstalados) return; eventosConversasInstalados = true;
 document.addEventListener('click', (evento) => {
  const alvo = evento.target instanceof Element ? evento.target : null; if (!alvo) return;
  const acao = alvo.closest('[data-chat-action]');
  if (acao && menuConversaAberto?.menu.contains(acao)) {
   const { id, botao } = menuConversaAberto; const tipo = acao.dataset.chatAction;
   fecharMenuConversa(); void executarAcaoConversaChat(id, tipo, botao); return;
  }
  const controle = alvo.closest('[data-chat-control]');
  const lista = controle?.closest('#chat-conversation-list, #chat-sidebar-conversation-list');
  if (!controle || !lista || !lista.contains(controle)) return;
  const item = controle.closest('[data-chat-id]'); if (!item || !lista.contains(item)) return;
  const id = item.dataset.chatId;
  if (controle.dataset.chatControl === 'options') abrirMenuConversaChat(controle, id);
  else if (controle.dataset.chatControl === 'select') {
   fecharMenuConversa();
   if (lista.id === 'chat-sidebar-conversation-list') document.getElementById('nav-chats')?.click();
   const conversa = conversasChat?.find((c) => String(c.id) === id); if (conversa) selecionarConversaChat(conversa.id);
  }
 });
 document.addEventListener('pointerdown', (evento) => {
  if (menuConversaAberto && !menuConversaAberto.menu.contains(evento.target) && !menuConversaAberto.botao.contains(evento.target)) fecharMenuConversa();
 });
 document.addEventListener('keydown', (evento) => {
  if (!menuConversaAberto) return;
  if (evento.key === 'Escape') { evento.preventDefault(); evento.stopPropagation(); fecharMenuConversa(true); return; }
  const itens = [...menuConversaAberto.menu.querySelectorAll('[role="menuitem"]')];
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) {
   evento.preventDefault(); const indice = itens.indexOf(document.activeElement);
   const proximo = evento.key === 'Home' ? 0 : evento.key === 'End' ? itens.length - 1 : (indice + (evento.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
   const escolhido = itens[proximo];
   escolhido?.focus({ preventScroll: true });
   if (escolhido) {
    const menu = menuConversaAberto.menu;
    if (escolhido.offsetTop < menu.scrollTop) menu.scrollTop = escolhido.offsetTop;
    else if (escolhido.offsetTop + escolhido.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = escolhido.offsetTop + escolhido.offsetHeight - menu.clientHeight;
   }
  } else if (evento.key === 'Tab') { fecharMenuConversa(true); }
 });
 window.addEventListener('resize', () => fecharMenuConversa());
 document.addEventListener('scroll', (evento) => {
  if (menuConversaAberto && !menuConversaAberto.menu.contains(evento.target)) fecharMenuConversa();
 }, true);
}

export function renderizarListaConversasChat() {
 const listas = [document.getElementById('chat-conversation-list'), document.getElementById('chat-sidebar-conversation-list')].filter(Boolean);
 if (!listas.length) return;
 instalarEventosConversasChat(); fecharMenuConversa();
 const ordenadas = [...(conversasChat || [])].sort((a, b) => Number(!!b.fixada) - Number(!!a.fixada) || new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm));
 listas.forEach((lista) => {
  lista.replaceChildren();
  ordenadas.forEach((conversa) => {
   const linha = document.createElement('div'); linha.className = 'chat-conversation-row'; linha.dataset.chatId = String(conversa.id); linha.setAttribute('role', 'listitem');
   const item = document.createElement('button'); item.type = 'button'; item.dataset.chatControl = 'select';
   item.className = `chat-conversation-item${conversa.id === conversaChatAtualId ? ' ativa' : ''}`;
   if (conversa.id === conversaChatAtualId) item.setAttribute('aria-current', 'true');
   const titulo = document.createElement('span'); titulo.className = 'chat-conversation-title';
   titulo.textContent = `${conversa.fixada ? '📌 ' : ''}${conversa.titulo || 'Conversa anterior'}`;
   const data = document.createElement('time'); data.textContent = formatarDataConversaChat(conversa.atualizadoEm || conversa.criadoEm);
   item.append(titulo, data);
   const opcoes = document.createElement('button'); opcoes.type = 'button'; opcoes.className = 'chat-options-btn'; opcoes.dataset.chatControl = 'options';
   opcoes.setAttribute('aria-label', `Opções da conversa ${conversa.titulo || 'Conversa anterior'}`); opcoes.setAttribute('aria-haspopup', 'menu'); opcoes.setAttribute('aria-expanded', 'false');
   opcoes.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
   linha.append(item, opcoes); lista.append(linha);
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
 const msgDiv = document.createElement('article');
 msgDiv.className = autor === 'Você' ? 'chat-msg usuario' : 'chat-msg urfilig';
 const conteudo = document.createElement('div');
 conteudo.className = 'chat-msg-conteudo';
 const autorEl = document.createElement('strong');
 autorEl.textContent = `${autor}:`;
 conteudo.append(autorEl, document.createTextNode(` ${texto}`));
 msgDiv.appendChild(conteudo);
 if (autor === 'Urfilig') {
  msgDiv.appendChild(criarAcoesResposta(texto));
 }
 chatMensagens.appendChild(msgDiv);
 rolarChatParaFim();
 return msgDiv;
}

export function restaurarHistoricoChat() {
 const chatMensagens = document.getElementById('chat-mensagens');
 if (!chatMensagens) return;
 ocultarIndicadorPensando();
 chatMensagens.replaceChildren();
 const conversa = obterConversaChatAtual();
 conversa?.mensagens.forEach(({ autor, texto }) => renderizarMensagemChat(String(autor || 'Urfilig'), texto));
 const titulo = document.getElementById('chat-active-title');
 if (titulo) titulo.textContent = conversa?.titulo || 'Conversa';
 rolarChatParaFim();
}

export function adicionarMensagemChat(autor, texto) {
 const mensagem = String(texto ?? '');
 const conversa = obterConversaChatAtual();
 if (!conversa || !renderizarMensagemChat(autor, mensagem)) return;
 conversa.mensagens.push({ autor, texto: mensagem, criadoEm: new Date().toISOString() });
 if (autor === 'Você' && conversa.titulo === 'Nova conversa' && !conversa.tituloPersonalizado) conversa.titulo = mensagem.replace(/\s+/g, ' ').trim().slice(0, 42) || 'Nova conversa';
 conversa.atualizadoEm = new Date().toISOString();
 salvarConversasChat();
 const titulo = document.getElementById('chat-active-title');
 if (titulo) titulo.textContent = conversa.titulo;
 renderizarListaConversasChat();
}
