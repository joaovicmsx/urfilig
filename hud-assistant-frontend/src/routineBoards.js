import { showAlert, showConfirm } from './uiDialogs.js';
import { BACKEND_URL } from './authGuard.js';

const STORAGE_KEY = 'urfilig_routine_boards_v1';
const VIEW_KEY = 'urfilig_routine_board_view_v1';
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function readBoards() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map((board) => ({
      ...board,
      color: /^#[\da-f]{6}$/i.test(String(board.color || '')) ? board.color : '#9b78d0',
      checkins: board.checkins && typeof board.checkins === 'object' ? board.checkins : {},
    })) : [];
  } catch { return []; }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function iniciarQuadrosRotina() {
  const boardRoot = document.querySelector('#routine-board');
  const addButton = document.querySelector('#nav-routines');
  if (!addButton || !boardRoot) return;

  const save = (boards) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  };
  let view = { width: 340, height: 280, minimized: false, left: null, top: null };
  try { view = { ...view, ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') }; } catch { /* Mantém os valores padrão. */ }
  view.width = Math.max(280, Math.min(520, Number(view.width) || 340));
  view.height = Math.max(190, Math.min(560, Number(view.height) || 280));
  view.left = Number.isFinite(view.left) ? view.left : null;
  view.top = Number.isFinite(view.top) ? view.top : null;
  const saveView = () => localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  const applyView = () => {
    boardRoot.style.setProperty('--routine-board-width', `${view.width}px`);
    boardRoot.style.setProperty('--routine-board-height', `${view.height}px`);
    boardRoot.style.setProperty('--routine-board-left', Number.isFinite(view.left) ? `${view.left}px` : 'auto');
    boardRoot.style.setProperty('--routine-board-top', Number.isFinite(view.top) ? `${view.top}px` : 'auto');
    boardRoot.style.setProperty('--routine-board-right', Number.isFinite(view.left) ? 'auto' : '18px');
    boardRoot.style.setProperty('--routine-board-bottom', Number.isFinite(view.top) ? 'auto' : '96px');
  };
  const restoreButton = document.createElement('button');
  restoreButton.id = 'routine-board-restore';
  restoreButton.type = 'button';
  restoreButton.title = 'Mostrar quadro de rotinas';
  restoreButton.setAttribute('aria-label', 'Mostrar quadro de rotinas');
  restoreButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>';
  document.body.append(restoreButton);
  let listOpen = true;
  applyView();
  restoreButton.addEventListener('click', () => { view.minimized = false; saveView(); render(); });

  const sidebarList = document.createElement('aside');
  sidebarList.id = 'routine-sidebar-list';
  sidebarList.className = 'routine-sidebar-list';
  sidebarList.hidden = true;
  sidebarList.setAttribute('aria-label', 'Rotinas existentes');
  document.body.append(sidebarList);
  sidebarList.addEventListener('click', (event) => {
    if (event.target === sidebarList) fecharListaRotinas();
  });
  let sidebarListOpen = false;

  function renderSidebarList(boards) {
    sidebarList.hidden = !sidebarListOpen;
    if (!sidebarListOpen) return;

    const rows = boards.map((board) => {
      const inicio = new Date(board.createdAt); inicio.setHours(0, 0, 0, 0);
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const diasPassados = Math.max(0, Math.floor((Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / 86400000));
      const diaAtual = Math.min(board.days, diasPassados + 1);
      const fim = new Date(inicio); fim.setDate(fim.getDate() + board.days - 1); fim.setHours(23, 59, 59, 999);
      const ativa = Date.now() <= fim.getTime();
      const presencas = Object.keys(board.checkins || {}).length;
      return `<div class="routine-sidebar-item" data-routine-id="${escapeHtml(board.id)}"><button type="button" class="routine-sidebar-open"><span>${escapeHtml(board.name)}</span><small><i class="routine-sidebar-status${ativa ? ' ativo' : ''}"></i>${ativa ? 'Ativa' : 'Concluída'} · dia ${diaAtual}/${board.days} · ${presencas} ${presencas === 1 ? 'presença' : 'presenças'}</small></button><div class="routine-sidebar-actions"><button type="button" class="routine-sidebar-edit" aria-label="Editar ${escapeHtml(board.name)}" title="Editar rotina"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/></svg><span>Editar</span></button><button type="button" class="routine-sidebar-delete" aria-label="Excluir ${escapeHtml(board.name)}" title="Excluir rotina"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg><span>Excluir</span></button></div></div>`;
    }).join('');

    sidebarList.innerHTML = `<div class="routine-sidebar-dialog" role="dialog" aria-modal="true" aria-label="Minhas rotinas"><header><span>Minhas rotinas</span><div><button type="button" class="routine-sidebar-add">Nova</button><button type="button" class="routine-sidebar-close" aria-label="Fechar lista" title="Fechar">×</button></div></header>${rows || '<p class="routine-sidebar-empty">Nenhuma rotina criada.</p>'}</div>`;
    sidebarList.querySelector('.routine-sidebar-add').addEventListener('click', openForm);
    sidebarList.querySelector('.routine-sidebar-close').addEventListener('click', fecharListaRotinas);
    sidebarList.querySelectorAll('.routine-sidebar-item').forEach((item) => {
      const routineId = item.dataset.routineId;
      const board = boards.find((entry) => entry.id === routineId);
      item.querySelector('.routine-sidebar-open').addEventListener('click', () => {
      listOpen = true;
      fecharListaRotinas();
      const card = [...boardRoot.querySelectorAll('.routine-card')].find((item) => item.dataset.boardId === routineId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        card.classList.remove('routine-board-highlight');
        requestAnimationFrame(() => card.classList.add('routine-board-highlight'));
        window.setTimeout(() => card.classList.remove('routine-board-highlight'), 1200);
      }
      });
      item.querySelector('.routine-sidebar-edit').addEventListener('click', () => board && openForm(board));
      item.querySelector('.routine-sidebar-delete').addEventListener('click', async () => {
        if (!board) return;
        const confirmed = await showConfirm(`Excluir o quadro “${board.name}” e as presenças registradas?`, 'Excluir rotina');
        if (!confirmed) return;
        save(readBoards().filter((entry) => entry.id !== board.id));
        render();
      });
    });
  }

  function fecharListaRotinas() {
    sidebarListOpen = false;
    sidebarList.hidden = true;
    addButton.setAttribute('aria-expanded', String(listOpen && readBoards().length > 0));
  }

  const render = () => {
    const boards = readBoards();
    boardRoot.replaceChildren();
    boardRoot.hidden = boards.length === 0 || !listOpen || view.minimized;
    restoreButton.hidden = boards.length === 0 || !view.minimized;
    applyView();
    addButton.setAttribute('aria-expanded', String(boards.length > 0 && listOpen));
    renderSidebarList(boards);
    if (boards.length) {
      const heading = document.createElement('header');
      heading.className = 'routine-list-header';
      heading.innerHTML = `<strong>Rotinas</strong><div class="routine-list-actions"><button type="button" class="routine-add">Nova rotina</button><button type="button" class="routine-size" data-size="-1" aria-label="Diminuir quadro" title="Diminuir quadro">−</button><button type="button" class="routine-size" data-size="1" aria-label="Aumentar quadro" title="Aumentar quadro">+</button><button type="button" class="routine-move" aria-label="Mover quadro" title="Arraste para mover"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3m12-3 3-3m-3 3 3 3"/></svg></button><button type="button" class="routine-collapse" aria-label="Recolher quadro" title="Recolher quadro"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>`;
      heading.querySelector('.routine-add').addEventListener('click', openForm);
      heading.querySelectorAll('.routine-size').forEach((button) => button.addEventListener('click', () => {
        const step = Number(button.dataset.size);
        view.width = Math.max(280, Math.min(520, view.width + step * 36));
        view.height = Math.max(190, Math.min(560, view.height + step * 36));
        applyView(); saveView();
      }));
      heading.querySelector('.routine-collapse').addEventListener('click', () => { view.minimized = true; saveView(); render(); });
      const mover = heading.querySelector('.routine-move');
      mover.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const bounds = boardRoot.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = bounds.left;
        const originY = bounds.top;
        mover.setPointerCapture(event.pointerId);
        const move = (pointerEvent) => {
          const maxLeft = Math.max(0, window.innerWidth - bounds.width);
          const maxTop = Math.max(0, window.innerHeight - 52);
          view.left = Math.max(0, Math.min(maxLeft, originX + pointerEvent.clientX - startX));
          view.top = Math.max(0, Math.min(maxTop, originY + pointerEvent.clientY - startY));
          applyView();
        };
        const finish = () => {
          mover.removeEventListener('pointermove', move);
          mover.removeEventListener('pointerup', finish);
          mover.removeEventListener('pointercancel', finish);
          saveView();
        };
        mover.addEventListener('pointermove', move);
        mover.addEventListener('pointerup', finish, { once: true });
        mover.addEventListener('pointercancel', finish, { once: true });
      });
      boardRoot.append(heading);
    }
    boards.forEach((board) => {
      const card = document.createElement('article');
      card.className = 'routine-card';
      const inicio = new Date(board.createdAt); inicio.setHours(0, 0, 0, 0);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dias = Array.from({ length: board.days }, (_, index) => {
        const date = new Date(inicio); date.setDate(inicio.getDate() + index);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { date, key, day: index + 1 };
      });
      const diasHtml = dias.map(({ date, key, day }) => {
        const checked = Boolean(board.checkins?.[key]);
        const futuro = date > hoje;
        const label = `${date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${checked ? ` · presença às ${escapeHtml(board.checkins[key])}` : ''}`;
        return `<button type="button" class="routine-square${checked ? ' done' : ''}" data-routine-date="${key}" style="--routine-color:${escapeHtml(board.color)}" role="gridcell" aria-pressed="${checked}" aria-label="Dia ${day}: ${escapeHtml(label)}" title="${escapeHtml(label)}"${futuro ? ' disabled' : ''}>${day}</button>`;
      }).join('');
      card.dataset.boardId = board.id;
      const diaAtual = Math.min(board.days, Math.max(1, Math.floor((hoje - inicio) / 86400000) + 1));
      card.innerHTML = `<header><strong>${escapeHtml(board.name)}</strong><span class="routine-day-counter" style="--routine-color:${escapeHtml(board.color)}" aria-label="Dia ${diaAtual} de ${board.days}" title="Dia ${diaAtual} de ${board.days}"><strong>${diaAtual}</strong></span><button type="button" class="routine-remove" aria-label="Excluir quadro" title="Excluir quadro">×</button></header><div class="routine-squares" style="--routine-weeks:${Math.ceil(board.days / 7)}" role="grid" aria-label="Presenças de ${escapeHtml(board.name)}">${diasHtml}</div>`;
      card.querySelectorAll('.routine-square:not(:disabled)').forEach((square) => {
        square.addEventListener('click', async () => {
          const dataPresenca = square.dataset.routineDate;
          const quadroAtual = readBoards().find((item) => item.id === board.id);
          if (!quadroAtual) return;
          const jaMarcado = Boolean(quadroAtual.checkins?.[dataPresenca]);
          const dataLegivel = new Date(`${dataPresenca}T12:00:00`).toLocaleDateString('pt-BR');
          const confirmado = await showConfirm(
            jaMarcado
              ? `Remover a presença registrada em ${dataLegivel}?`
              : `Registrar presença em ${dataLegivel}?`,
            jaMarcado ? 'Desfazer presença' : 'Confirmar presença',
          );
          if (!confirmado) return;
          const quadros = readBoards();
          const alvo = quadros.find((item) => item.id === board.id);
          if (!alvo) return;
          if (jaMarcado) delete alvo.checkins[dataPresenca];
          else alvo.checkins[dataPresenca] = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          save(quadros);
          render();
        });
      });
      card.querySelector('.routine-remove').addEventListener('click', async () => {
        const confirmed = await showConfirm(`Excluir o quadro “${board.name}” e as presenças registradas?`, 'Excluir rotina');
        if (!confirmed) return;
        save(readBoards().filter((item) => item.id !== board.id));
        render();
      });
      boardRoot.append(card);
    });
  };

  const openForm = (boardEdicao = null) => {
    const modal = document.createElement('div');
    modal.className = 'routine-modal-backdrop';
    modal.innerHTML = `<form class="routine-modal"><header><h2>${boardEdicao ? 'Editar rotina' : 'Novo quadro de rotinas'}</h2><button type="button" class="routine-close" aria-label="Fechar">×</button></header><label>Nome<input name="name" maxlength="48" required value="${escapeHtml(boardEdicao?.name || '')}"></label><div class="routine-fields"><label>Duração em dias<div class="routine-number-control"><input name="days" type="number" min="1" max="365" value="${boardEdicao?.days || 30}" required><span class="routine-number-arrows"><button type="button" data-step="1" aria-label="Aumentar duração"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 12 5-5 5 5"/></svg></button><button type="button" data-step="-1" aria-label="Diminuir duração"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></button></span></div></label><label>Cor das presenças<input name="color" type="color" value="${escapeHtml(boardEdicao?.color || '#8b70d6')}" aria-label="Escolher cor das presenças"></label></div>${boardEdicao ? '' : '<label class="routine-reminder-toggle"><input name="createReminder" type="checkbox"><span>Criar lembrete</span></label><label class="routine-reminder-time" hidden>Horário do lembrete<input name="reminderTime" type="time"></label>'}<button class="routine-create" type="submit">${boardEdicao ? 'Salvar alterações' : 'Criar quadro'}</button></form>`;
    document.body.append(modal);
    const close = () => modal.remove();
    modal.querySelector('.routine-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    const durationInput = modal.querySelector('[name="days"]');
    const reminderToggle = modal.querySelector('[name="createReminder"]');
    const reminderTime = modal.querySelector('.routine-reminder-time');
    reminderToggle?.addEventListener('change', () => { reminderTime.hidden = !reminderToggle.checked; });
    modal.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
      const next = Math.max(1, Math.min(365, (Number(durationInput.value) || 1) + Number(button.dataset.step)));
      durationInput.value = String(next);
      durationInput.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const boardName = String(data.get('name')).trim();
      const boards = readBoards();
      const updates = { name: boardName, days: Math.max(1, Math.min(365, Number(data.get('days')) || 30)), color: String(data.get('color') || '#a855f7') };
      if (boardEdicao) {
        const index = boards.findIndex((entry) => entry.id === boardEdicao.id);
        if (index !== -1) boards[index] = { ...boards[index], ...updates };
      } else {
        boards.push({ id: crypto.randomUUID(), ...updates, createdAt: Date.now(), checkins: {} });
      }
      listOpen = true;
      save(boards); close(); render();
      if (!boardEdicao && data.get('createReminder') === 'on') {
        try {
          const now = new Date();
          const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T12:00:00`;
          const response = await fetch(`${BACKEND_URL}/api/agenda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('urfilig_token') || ''}` },
            body: JSON.stringify({ titulo: `Rotina: ${boardName}`, horario: data.get('reminderTime') || undefined, data: localDate }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.erro || 'Não foi possível criar o lembrete.');
        } catch (error) {
          await showAlert(`O quadro foi criado, mas o lembrete não foi salvo. ${error.message}`, 'Lembrete não criado');
        }
      }
    });
    modal.querySelector('[name="name"]').focus();
  };

  addButton.addEventListener('click', () => {
    if (!readBoards().length) { openForm(); return; }
    view.minimized = false;
    saveView();
    listOpen = true;
    sidebarListOpen = true;
    addButton.setAttribute('aria-expanded', 'true');
    render();
    boardRoot.classList.remove('routine-board-highlight');
    requestAnimationFrame(() => boardRoot.classList.add('routine-board-highlight'));
    window.setTimeout(() => boardRoot.classList.remove('routine-board-highlight'), 1200);
    boardRoot.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
  document.addEventListener('pointerdown', (event) => {
    if (document.querySelector('.routine-modal-backdrop')) return;
    if (!sidebarListOpen || sidebarList.contains(event.target) || addButton.contains(event.target)) return;
    fecharListaRotinas();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !sidebarListOpen) return;
    fecharListaRotinas();
  });
  // The chat hook marks the current day's square only when the user explicitly reports attendance.
  window.registrarPresencaRotina = (message) => {
    if (!/\b(fiz|marcar|registra|completei|conclu[ií])\b.*\b(presen[cç]a|rotina|h[aá]bito)\b/i.test(message)) return false;
    const boards = readBoards();
    if (!boards.length) return false;
    const timeText = message.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0];
    const timeWithHour = message.match(/\b(?:às?|por volta das?)\s*([01]?\d|2[0-3])(?:h|:([0-5]\d))?/i);
    const time = timeText || (timeWithHour ? `${timeWithHour[1].padStart(2, '0')}:${timeWithHour[2] || '00'}` : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    const key = todayKey();
    const nomeCitado = boards.filter((board) => message.toLocaleLowerCase('pt-BR').includes(board.name.toLocaleLowerCase('pt-BR')));
    if (!nomeCitado.length && boards.length > 1) return 'Há mais de um quadro de rotina. Diga o nome do quadro para eu registrar a presença correta.';
    const alvo = nomeCitado.length ? nomeCitado : boards;
    let registrada = false;
    alvo.forEach((board) => {
      const lastDay = new Date(board.createdAt); lastDay.setDate(lastDay.getDate() + board.days - 1); lastDay.setHours(23, 59, 59, 999);
      if (new Date() <= lastDay) { board.checkins[key] = time; registrada = true; }
    });
    if (!registrada) return 'Esse quadro já passou da duração definida e não recebeu uma nova presença.';
    save(boards); render(); return `Presença registrada${nomeCitado[0] ? ` em “${nomeCitado[0].name}”` : ''} às ${time}.`;
  };
  render();
}

