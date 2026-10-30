import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from '@tauri-apps/api/core';
import { emitTo } from '@tauri-apps/api/event';

const STORAGE_KEY = 'urfilig_routine_boards_v1';
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function readBoards() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
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
    void emitTo('routine-overlay', 'routine:refresh', boards).catch(() => {});
  };
  let routineOverlay = null;
  const render = () => {
    const boards = readBoards();
    boardRoot.replaceChildren();
    boardRoot.hidden = boards.length === 0;
    boardRoot.classList.toggle('has-unpinned', boards.some((board) => !board.fixed));
    boards.forEach((board) => {
      const card = document.createElement('article');
      card.className = `routine-card${board.fixed ? ' is-fixed' : ''}`;
      const elapsed = Math.max(0, Math.floor((Date.now() - board.createdAt) / 86400000));
      const inicio = new Date(board.createdAt); inicio.setHours(0, 0, 0, 0);
      const dias = Array.from({ length: board.days }, (_, index) => {
        const date = new Date(inicio); date.setDate(inicio.getDate() + index);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { date, key, day: index + 1 };
      });
      const completed = Object.keys(board.checkins || {}).length;
      const blanks = Array.from({ length: inicio.getDay() }, () => '<span class="routine-square routine-square-empty" aria-hidden="true"></span>').join('');
      const diasHtml = dias.map(({ date, key, day }) => {
        const checked = Boolean(board.checkins?.[key]);
        return `<span class="routine-square${checked ? ' done' : ''}" style="--routine-color:${escapeHtml(board.color)}" title="${date.toLocaleDateString('pt-BR')}${checked ? ` · presença ${escapeHtml(board.checkins[key])}` : ''}">${date.getDate()}</span>`;
      }).join('');
      card.innerHTML = `<header><div><strong>${escapeHtml(board.name)}</strong><small>Iniciado em ${inicio.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })} · ${Math.min(board.days, elapsed + 1)}/${board.days} dias · ${completed} presenças</small></div><button type="button" class="routine-remove" aria-label="Excluir quadro">×</button></header><div class="routine-squares" aria-label="Presenças do quadro ${escapeHtml(board.name)}">${blanks}${diasHtml}</div><footer><label><input class="routine-fixed" type="checkbox" ${board.fixed ? 'checked' : ''}> Fixar no canto</label><button type="button" class="routine-overlay-open">Sobrepor na área de trabalho</button></footer><small class="routine-hint">No chat, diga “fiz presença na academia às 9:00”.</small>`;
      card.querySelector('.routine-remove').addEventListener('click', () => {
        save(readBoards().filter((item) => item.id !== board.id)); render();
      });
      card.querySelector('.routine-fixed').addEventListener('change', (event) => {
        const updated = readBoards().map((item) => item.id === board.id ? { ...item, fixed: event.target.checked } : item);
        save(updated); render();
      });
      card.querySelector('.routine-overlay-open').addEventListener('click', async () => {
        if (!isTauri()) { card.querySelector('.routine-hint').textContent = 'A sobreposição está disponível no aplicativo desktop.'; return; }
        try {
          routineOverlay = await WebviewWindow.getByLabel('routine-overlay');
          if (!routineOverlay) {
            routineOverlay = new WebviewWindow('routine-overlay', { url: 'routine-overlay.html', title: 'Rotina Urfilig', width: 360, height: 210, decorations: false, transparent: true, alwaysOnTop: true, focus: false, focusable: false, resizable: true, skipTaskbar: true, shadow: false });
            routineOverlay.once('tauri://destroyed', () => { routineOverlay = null; });
          } else await routineOverlay.show();
          void emitTo('routine-overlay', 'routine:refresh', readBoards());
        } catch (error) { console.error('[rotinas] erro abrindo sobreposição:', error); }
      });
      boardRoot.append(card);
    });
  };

  const openForm = () => {
    const modal = document.createElement('div');
    modal.className = 'routine-modal-backdrop';
    modal.innerHTML = `<form class="routine-modal"><header><h2>Novo quadro de rotinas</h2><button type="button" class="routine-close" aria-label="Fechar">×</button></header><label>Nome<input name="name" maxlength="48" placeholder="Ex.: Caminhada diária" required></label><div class="routine-fields"><label>Duração em dias<input name="days" type="number" min="1" max="365" value="30" required></label><label>Cor das presenças<input name="color" type="color" value="#e7c94d"></label></div><label class="routine-pin-choice"><input name="fixed" type="checkbox" checked> Mostrar fixo na tela inicial</label><button class="routine-create" type="submit">Criar quadro</button></form>`;
    document.body.append(modal);
    const close = () => modal.remove();
    modal.querySelector('.routine-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const boards = readBoards();
      boards.push({ id: crypto.randomUUID(), name: String(data.get('name')).trim(), days: Math.max(1, Math.min(365, Number(data.get('days')) || 30)), color: String(data.get('color') || '#e7c94d'), createdAt: Date.now(), checkins: {}, fixed: data.get('fixed') === 'on' });
      save(boards); close(); render();
    });
    modal.querySelector('[name="name"]').focus();
  };

  addButton.addEventListener('click', openForm);
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

