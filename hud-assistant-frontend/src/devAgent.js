import { BACKEND_URL } from './authGuard.js';
import { adicionarMensagemChat } from './chatHistory.js';

const create = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
};

const STATUS_LABELS = {
  PLANEJADA: 'Planejada',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADA: 'Aprovada',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDA: 'Concluída',
  BLOQUEADA: 'Bloqueada',
  CANCELADA: 'Cancelada',
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('urfilig_token') || ''}`,
});

export function iniciarDevAgent() {
  const drawer = document.querySelector('#dev-agent-drawer');
  const backdrop = document.querySelector('#dev-agent-backdrop');
  const form = document.querySelector('#dev-agent-form');
  const repoInput = document.querySelector('#dev-agent-repository');
  const descriptionInput = document.querySelector('#dev-agent-description');
  const providerSelect = document.querySelector('#dev-agent-provider');
  const createButton = document.querySelector('#dev-agent-create');
  const tasksContainer = document.querySelector('#dev-agent-tasks');
  const message = document.querySelector('#dev-agent-message');
  const refreshButton = document.querySelector('#dev-agent-refresh');
  if (!drawer || !backdrop || !form || !tasksContainer) return;
  let perguntaPendente = null;

  const say = (text, isError = false) => {
    message.textContent = text || '';
    message.classList.toggle('is-error', isError);
  };

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
        cache: options.cache || 'no-store',
      });
    } catch {
      throw new Error('Não foi possível conectar ao backend. Confira se o serviço está ativo e tente novamente.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || `A API respondeu com erro (${response.status}).`);
    return data;
  }

  const normalizar = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const repoRegex = /\b([a-z0-9](?:[a-z0-9_.-]{0,37}[a-z0-9])?)\/([a-z0-9](?:[a-z0-9_.-]{0,98}[a-z0-9])?)\b/i;
  const lerRepositorio = (texto) => texto.match(repoRegex)?.[0] || '';
  const provedorAtual = () => localStorage.getItem('urfilig_llm_provider') === 'ollama' ? 'ollama' : 'gemini';
  const statusLabel = (status) => STATUS_LABELS[status] || status || 'Status indisponível';

  function mensagemChat(texto) {
    adicionarMensagemChat('Dev Agent', texto);
  }

  function adicionarCardAoChat(card) {
    const stream = document.querySelector('#chat-mensagens');
    if (!stream) return;
    stream.append(card);
    stream.scrollTop = stream.scrollHeight;
  }

  function cardEtapas(titulo, etapas) {
    const card = create('section', 'chat-msg urfilig dev-agent-chat-progress');
    card.setAttribute('aria-label', titulo);
    card.append(create('strong', '', `Dev Agent: ${titulo}`));
    const list = create('ol', 'dev-agent-chat-steps');
    etapas.forEach((etapa, index) => {
      const item = create('li', index === 0 ? 'is-current' : '', etapa);
      item.dataset.step = String(index);
      list.append(item);
    });
    card.append(list);
    adicionarCardAoChat(card);
    return {
      etapa(index, state = 'is-current') {
        list.querySelectorAll('li').forEach((item, itemIndex) => {
          item.classList.toggle('is-done', itemIndex < index || (itemIndex === index && state === 'is-done'));
          item.classList.toggle('is-current', itemIndex === index && state === 'is-current');
        });
      },
      concluir(index = etapas.length - 1) {
        list.querySelectorAll('li').forEach((item, itemIndex) => {
          item.classList.toggle('is-done', itemIndex <= index);
          item.classList.remove('is-current');
        });
      },
      falhar(texto) {
        card.append(create('p', 'dev-agent-chat-error', texto));
        card.classList.add('has-error');
      },
    };
  }

  function criarCardTarefa(task, { titulo = 'Tarefa do Dev Agent' } = {}) {
    const card = create('article', 'chat-msg urfilig dev-agent-chat-card');
    const top = create('header', 'dev-agent-chat-card-head');
    const name = create('div', 'dev-agent-chat-card-title');
    name.append(create('strong', '', task.repositorio || 'Repositório'), create('span', '', statusLabel(task.status)));
    top.append(name);
    if (task.plano?.risco) top.append(create('span', `dev-agent-risk risk-${String(task.plano.risco).toLowerCase()}`, `Risco ${String(task.plano.risco).toLowerCase()}`));
    card.append(create('small', 'dev-agent-chat-card-kicker', titulo), top);
    if (task.descricao) card.append(create('p', 'dev-agent-chat-card-description', task.descricao));
    card.append(create('p', 'dev-agent-chat-card-summary', task.plano?.resumo || task.plano?.objetivo || 'Plano sem resumo disponível.'));
    if (task.plano?.objetivo && task.plano.objetivo !== task.plano.resumo) {
      card.append(create('p', 'dev-agent-chat-card-objective', `Objetivo: ${task.plano.objetivo}`));
    }
    const actions = create('footer', 'dev-agent-chat-card-actions');
    if (task.status === 'AGUARDANDO_APROVACAO') {
      const approve = create('button', 'profile-save', 'Aprovar');
      approve.type = 'button';
      approve.addEventListener('click', () => executarTransicao(task, 'aprovar', approve, card));
      const cancel = create('button', 'profile-cancel', 'Cancelar');
      cancel.type = 'button';
      cancel.addEventListener('click', () => executarTransicao(task, 'cancelar', cancel, card));
      actions.append(approve, cancel);
    } else if (task.status === 'APROVADA') {
      const cancel = create('button', 'profile-cancel', 'Cancelar');
      cancel.type = 'button';
      cancel.addEventListener('click', () => executarTransicao(task, 'cancelar', cancel, card));
      actions.append(cancel);
    }
    if (task.status === 'APROVADA') actions.append(create('small', 'dev-agent-chat-card-note', 'A aprovação não inicia execução.'));
    if (actions.childElementCount) card.append(actions);
    return card;
  }

  async function executarTransicao(task, action, button, card) {
    button.disabled = true;
    const verbo = action === 'aprovar' ? 'Registrando aprovação' : 'Cancelando tarefa';
    mensagemChat(`${verbo}: ${task.repositorio}.`);
    try {
      const data = await api(`/api/dev-agent/tarefas/${encodeURIComponent(task.id)}/${action}`, { method: 'POST' });
      const atualizada = data.tarefa || { ...task, status: action === 'aprovar' ? 'APROVADA' : 'CANCELADA' };
      card.replaceWith(criarCardTarefa(atualizada));
      mensagemChat(data.aviso || (action === 'aprovar'
        ? 'Aprovação registrada. Nenhum código foi executado.'
        : 'Tarefa cancelada.'));
      mensagemChat(`${atualizada.repositorio} · ${statusLabel(atualizada.status)} · risco ${atualizada.plano?.risco || 'não informado'} · ${atualizada.plano?.resumo || atualizada.plano?.objetivo || atualizada.descricao}`);
      await carregarTarefas();
    } catch (error) {
      mensagemChat(`Não foi possível ${action === 'aprovar' ? 'aprovar' : 'cancelar'}: ${error.message}`);
      button.disabled = false;
    }
  }

  async function listarNoChat() {
    const progress = cardEtapas('Consultando tarefas', ['Entendendo pedido', 'Buscando tarefas', 'Lista pronta']);
    progress.etapa(1);
    try {
      const data = await api('/api/dev-agent/tarefas');
      const tarefas = Array.isArray(data.tarefas) ? data.tarefas : [];
      progress.concluir();
      if (!tarefas.length) {
        mensagemChat('Não encontrei tarefas do Dev Agent ainda. Você pode pedir para criar uma tarefa e um plano.');
        return;
      }
      mensagemChat(`Encontrei ${tarefas.length} ${tarefas.length === 1 ? 'tarefa' : 'tarefas'}:`);
      tarefas.slice(0, 8).forEach((task) => {
        mensagemChat(`${task.repositorio} · ${statusLabel(task.status)} · risco ${task.plano?.risco || 'não informado'} · ${task.plano?.resumo || task.plano?.objetivo || task.descricao}`);
        adicionarCardAoChat(criarCardTarefa(task, { titulo: 'Tarefa' }));
      });
      if (tarefas.length > 8) mensagemChat(`Mostrando as 8 mais recentes de ${tarefas.length}.`);
    } catch (error) {
      progress.falhar(error.message);
      mensagemChat(`Erro ao listar tarefas: ${error.message}`);
    }
  }

  function inferirDescricao(texto, repositorio) {
    let resultado = texto.replace(/^.*?\b(?:tarefa|plano)\b/i, '');
    if (repositorio) resultado = resultado.replace(repositorio, '');
    resultado = resultado.replace(/\b(?:no|do|para o|em|no\s+|em\s+)?\s*(?:reposit[oó]rio|repo)\b/gi, ' ');
    resultado = resultado.replace(/^\s*(?:para|sobre|de|que|:|-|,)+\s*/i, '');
    resultado = resultado.replace(/\s+\b(?:no|em|do)\s*$/i, '');
    resultado = resultado.replace(/\s+(?:usando|com)\s+(?:o\s+)?(?:gemini|ollama|modelo local)\b.*$/i, '');
    return resultado.replace(/\s+/g, ' ').trim().replace(/[.?!]+$/, '');
  }

  async function criarTarefaNoChat(repositorio, descricao, provider = provedorAtual()) {
    if (!repositorio) {
      perguntaPendente = { tipo: 'criar-repositorio', descricao, provider };
      mensagemChat('Em qual repositório? Envie no formato organizacao/projeto.');
      return;
    }
    if (!descricao || descricao.length < 10) {
      perguntaPendente = { tipo: 'criar-descricao', repositorio, provider };
      mensagemChat('O que a tarefa deve fazer? Descreva o resultado esperado em uma frase.');
      return;
    }
    const progress = cardEtapas('Preparando tarefa', ['Entendendo pedido', 'Criando plano', 'Plano pronto']);
    progress.etapa(1);
    try {
      const data = await api('/api/dev-agent/tarefas', {
        method: 'POST',
        body: JSON.stringify({ repositorio, descricao, provider }),
      });
      const task = data.tarefa;
      progress.concluir();
      mensagemChat('Plano pronto para revisão. Nada foi executado.');
      if (task) {
        mensagemChat(`${task.repositorio} · ${statusLabel(task.status)} · risco ${task.plano?.risco || 'não informado'} · ${task.plano?.resumo || task.plano?.objetivo || task.descricao}`);
        adicionarCardAoChat(criarCardTarefa(task));
      }
      await carregarTarefas();
    } catch (error) {
      progress.falhar(error.message);
      mensagemChat(`Não consegui criar o plano: ${error.message}`);
    }
  }

  function enumerarTarefas(tarefas) {
    return tarefas.map((task, index) => `${index + 1}. ${task.repositorio} — ${task.descricao}`).join('\n');
  }

  function escolherTarefa(texto, tarefas) {
    const normal = normalizar(texto);
    const numero = normal.match(/\b(?:a\s+)?(\d{1,2})\b/)?.[1];
    if (numero && Number(numero) >= 1 && Number(numero) <= tarefas.length) return tarefas[Number(numero) - 1];
    const ordinal = normal.match(/\b(primeira|primeiro|segunda|segundo|terceira|terceiro|ultima|ultimo)\b/)?.[1];
    if (ordinal) {
      const index = ordinal.startsWith('prime') ? 0 : ordinal.startsWith('seg') ? 1 : ordinal.startsWith('terc') ? 2 : tarefas.length - 1;
      return tarefas[index] || null;
    }
    const repo = lerRepositorio(texto);
    const termo = normalizar(repo || texto).trim();
    const matches = tarefas.filter((task) => termo && `${normalizar(task.repositorio)} ${normalizar(task.descricao)} ${normalizar(task.id)}`.includes(termo));
    return matches.length === 1 ? matches[0] : null;
  }

  async function selecionarParaTransicao(acao, referencia = '') {
    try {
      const data = await api('/api/dev-agent/tarefas');
      const todas = Array.isArray(data.tarefas) ? data.tarefas : [];
      const candidatas = todas.filter((task) => acao === 'aprovar'
        ? task.status === 'AGUARDANDO_APROVACAO'
        : ['AGUARDANDO_APROVACAO', 'APROVADA'].includes(task.status));
      if (!candidatas.length) {
        mensagemChat(acao === 'aprovar' ? 'Não há tarefas aguardando aprovação.' : 'Não há tarefas que possam ser canceladas.');
        perguntaPendente = null;
        return;
      }
      const escolhida = referencia ? escolherTarefa(referencia, candidatas) : candidatas.length === 1 ? candidatas[0] : null;
      if (!escolhida) {
        perguntaPendente = { tipo: 'escolher-tarefa', acao, tarefas: candidatas };
        mensagemChat(`Qual tarefa deseja ${acao === 'aprovar' ? 'aprovar' : 'cancelar'}? Responda com o número ou repositório:\n${enumerarTarefas(candidatas)}`);
        return;
      }
      perguntaPendente = null;
      const progress = cardEtapas(acao === 'aprovar' ? 'Aprovando tarefa' : 'Cancelando tarefa', ['Entendendo pedido', 'Atualizando status', 'Status atualizado']);
      progress.etapa(1);
      try {
        const result = await api(`/api/dev-agent/tarefas/${encodeURIComponent(escolhida.id)}/${acao}`, { method: 'POST' });
        progress.concluir();
        const atualizada = result.tarefa || { ...escolhida, status: acao === 'aprovar' ? 'APROVADA' : 'CANCELADA' };
        mensagemChat(result.aviso || (acao === 'aprovar' ? 'Aprovação registrada. Nada foi executado.' : 'Tarefa cancelada.'));
        mensagemChat(`${atualizada.repositorio} · ${statusLabel(atualizada.status)} · risco ${atualizada.plano?.risco || 'não informado'} · ${atualizada.plano?.resumo || atualizada.plano?.objetivo || atualizada.descricao}`);
        adicionarCardAoChat(criarCardTarefa(atualizada));
        await carregarTarefas();
      } catch (error) {
        progress.falhar(error.message);
        mensagemChat(`Erro ao ${acao === 'aprovar' ? 'aprovar' : 'cancelar'} a tarefa: ${error.message}`);
      }
    } catch (error) {
      mensagemChat(`Não consegui consultar as tarefas: ${error.message}`);
    }
  }

  async function resolverPergunta(texto) {
    const pendente = perguntaPendente;
    if (!pendente) return false;
    const resposta = String(texto || '').trim();
    if (/^(nao|não|deixa|cancelar|esquece)$/i.test(resposta)) {
      perguntaPendente = null;
      mensagemChat('Tudo bem, não fiz nenhuma alteração.');
      return true;
    }
    if (pendente.tipo === 'criar-repositorio') {
      const repo = lerRepositorio(resposta);
      if (!repo) {
        mensagemChat('Não identifiquei o repositório. Envie no formato organizacao/projeto.');
      } else {
        perguntaPendente = null;
        await criarTarefaNoChat(repo, pendente.descricao, pendente.provider);
      }
      return true;
    }
    if (pendente.tipo === 'criar-descricao') {
      perguntaPendente = null;
      await criarTarefaNoChat(pendente.repositorio, resposta, pendente.provider);
      return true;
    }
    if (pendente.tipo === 'escolher-tarefa') {
      const task = escolherTarefa(resposta, pendente.tarefas);
      if (!task) {
        mensagemChat('Não consegui identificar uma única tarefa. Responda com o número da lista ou o repositório.');
      } else {
        perguntaPendente = null;
        await selecionarParaTransicao(pendente.acao, task.id);
      }
      return true;
    }
    perguntaPendente = null;
    return false;
  }

  async function processarMensagemChat(texto) {
    if (await resolverPergunta(texto)) return true;
    const normal = normalizar(texto);
    const criar = /\b(crie|criar|monte|montar|planeje|planejar|abra|adicionar|adicione)\b.*\b(tarefa|plano)\b/.test(normal)
      || /^\s*(tarefa|plano)\s*:/i.test(normal);
    if (criar) {
      const repositorio = lerRepositorio(texto);
      await criarTarefaNoChat(repositorio, inferirDescricao(texto, repositorio));
      return true;
    }
    if (/\b(tarefa|tarefas|plano|planos)\b/.test(normal) && /\b(listar|lista|mostre|mostrar|ver|consultar|quais|minhas|listar|buscar)\b/.test(normal)) {
      await listarNoChat();
      return true;
    }
    const aprovarVerbo = /\b(aprova|aprovar|aprove|aprovaria)\b/.test(normal);
    const cancelarVerbo = /\b(cancela|cancelar|cancele|desistir)\b/.test(normal);
    const referenciaExplicita = /\b(tarefa|plano|primeira|segundo|segunda|terceira|terceiro|ultima|ultimo|isso|essa|essa tarefa|#?\d+)\b/.test(normal) || Boolean(lerRepositorio(texto));
    const comandoDireto = /^(aprova|aprovar|aprove|cancela|cancelar|cancele|desistir)$/i.test(normal.trim());
    const aprovar = aprovarVerbo && (referenciaExplicita || comandoDireto);
    const cancelar = cancelarVerbo && (referenciaExplicita || comandoDireto);
    if (aprovar || cancelar) {
      const acao = aprovar ? 'aprovar' : 'cancelar';
      const referencia = lerRepositorio(texto) || texto.match(/\b(?:id\s*)?([a-z0-9_-]{10,64})\b/i)?.[1] || texto.match(/\b(?:a\s+)?(?:#\s*)?\d{1,2}\b|primeir[oa]|segund[oa]|terceir[oa]|ultim[oa]/i)?.[0] || '';
      await selecionarParaTransicao(acao, referencia);
      return true;
    }
    return false;
  }

  function fechar() {
    drawer.classList.remove('aberta');
    backdrop.classList.remove('visible');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  function renderTask(task) {
    const card = create('article', 'dev-agent-task');
    const heading = create('header', 'dev-agent-task-heading');
    const headingText = create('div');
    headingText.append(create('h4', '', task.repositorio || 'Repositório'), create('span', 'dev-agent-status', STATUS_LABELS[task.status] || task.status || 'Status indisponível'));
    heading.append(headingText);
    if (task.plano?.risco) heading.append(create('span', `dev-agent-risk risk-${String(task.plano.risco).toLowerCase()}`, `Risco ${String(task.plano.risco).toLowerCase()}`));
    card.append(heading, create('p', 'dev-agent-task-description', task.descricao || ''));

    const plan = task.plano;
    if (plan && typeof plan === 'object') {
      const summary = create('p', 'dev-agent-plan-summary', plan.resumo || plan.objetivo || 'Plano indisponível.');
      card.append(summary);
      const lists = [
        ['Etapas', plan.etapas],
        ['Arquivos prováveis', plan.arquivosProvaveis],
        ['Verificações sugeridas', plan.testes],
        ['Bloqueios', plan.bloqueios],
      ];
      for (const [title, values] of lists) {
        if (!Array.isArray(values) || !values.length) continue;
        const details = create('details', 'dev-agent-plan-details');
        details.append(create('summary', '', `${title} (${values.length})`));
        const list = create('ul');
        values.forEach((value) => list.append(create('li', '', value)));
        details.append(list);
        card.append(details);
      }
    } else {
      card.append(create('p', 'dev-agent-plan-summary', 'Esta tarefa ainda não tem um plano disponível.'));
    }

    const actions = create('footer', 'dev-agent-task-actions');
    if (task.status === 'AGUARDANDO_APROVACAO') {
      const approve = create('button', 'profile-save', 'Aprovar');
      approve.type = 'button';
      approve.addEventListener('click', () => transition(task.id, 'aprovar', approve, 'Aprovada. A execução continua desativada nesta tela.'));
      const cancel = create('button', 'profile-cancel', 'Cancelar');
      cancel.type = 'button';
      cancel.addEventListener('click', () => transition(task.id, 'cancelar', cancel, 'Tarefa cancelada.'));
      actions.append(approve, cancel);
    } else if (task.status === 'APROVADA') {
      const cancel = create('button', 'profile-cancel', 'Cancelar tarefa');
      cancel.type = 'button';
      cancel.addEventListener('click', () => transition(task.id, 'cancelar', cancel, 'Tarefa cancelada.'));
      actions.append(cancel, create('span', 'dev-agent-execution-note', 'A execução não é iniciada pelo frontend.'));
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }

  async function carregarTarefas() {
    tasksContainer.replaceChildren(create('p', 'profile-message', 'Carregando tarefas…'));
    try {
      const data = await api('/api/dev-agent/tarefas');
      const tasks = Array.isArray(data.tarefas) ? data.tarefas : [];
      tasksContainer.replaceChildren();
      if (!tasks.length) {
        tasksContainer.append(create('p', 'profile-message', 'Nenhuma tarefa criada ainda.'));
        return;
      }
      tasks.forEach((task) => tasksContainer.append(renderTask(task)));
    } catch (error) {
      tasksContainer.replaceChildren(create('p', 'profile-message is-error', error.message));
    }
  }

  async function transition(id, action, button, successMessage) {
    button.disabled = true;
    say('Salvando…');
    try {
      const result = await api(`/api/dev-agent/tarefas/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      say(result.aviso || successMessage);
      await carregarTarefas();
    } catch (error) {
      say(error.message, true);
      button.disabled = false;
    }
  }

  async function abrir() {
    document.querySelectorAll('.profile-drawer.aberta').forEach((panel) => {
      if (panel !== drawer) panel.classList.remove('aberta');
    });
    document.querySelectorAll('.profile-backdrop.visible').forEach((panel) => {
      if (panel !== backdrop) panel.classList.remove('visible');
    });
    document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta, #email-painel.aberta').forEach((panel) => panel.classList.remove('aberta'));
    document.querySelector('#menu-lateral')?.classList.remove('visible', 'aberto', 'active');
    document.querySelector('#menu-backdrop')?.classList.remove('visible', 'aberto');
    drawer.classList.add('aberta');
    backdrop.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    say('');
    await carregarTarefas();
    document.querySelector('#dev-agent-back')?.focus();
  }

  document.querySelector('#nav-dev-agent')?.addEventListener('click', abrir);
  document.querySelector('#dev-agent-back')?.addEventListener('click', fechar);
  document.querySelector('#dev-agent-close')?.addEventListener('click', fechar);
  backdrop.addEventListener('click', fechar);
  refreshButton?.addEventListener('click', carregarTarefas);
  document.querySelector('#menu-toggle')?.addEventListener('click', fechar, { capture: true });
  document.querySelectorAll('.hud-nav .nav-item:not(#nav-dev-agent)').forEach((item) => item.addEventListener('click', fechar, { capture: true }));
  document.addEventListener('click', (event) => {
    if (event.button === 0 && event.target instanceof Element && drawer.classList.contains('aberta')
      && !drawer.contains(event.target) && !document.querySelector('#nav-dev-agent')?.contains(event.target)) fechar();
  }, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') fechar(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    createButton.disabled = true;
    createButton.textContent = 'Preparando plano…';
    say('');
    try {
      const data = await api('/api/dev-agent/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          repositorio: repoInput.value.trim(),
          descricao: descriptionInput.value.trim(),
          provider: providerSelect.value,
        }),
      });
      say(data.aviso || 'Tarefa criada e plano preparado. Revise antes de aprovar.');
      form.reset();
      providerSelect.value = 'gemini';
      await carregarTarefas();
    } catch (error) {
      say(error.message, true);
    } finally {
      createButton.disabled = false;
      createButton.textContent = 'Criar tarefa e plano';
    }
  });

  return processarMensagemChat;
}
