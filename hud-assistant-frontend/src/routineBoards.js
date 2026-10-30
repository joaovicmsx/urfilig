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
  };
  const render = () => {
    const boards = readBoards();
    boardRoot.replaceChildren();
    boardRoot.hidden = boards.length === 0;
    if (boards.length) {
      const activeCount = boards.filter((board) => {
        const end = new Date(board.createdAt); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + board.days); end.setMilliseconds(-1);
        return Date.now() <= end.getTime();
      }).length;
      const heading = document.createElement('header');
      heading.className = 'routine-list-header';
      heading.innerHTML = `<div><strong>Rotinas</strong><small>${activeCount} ativa${activeCount === 1 ? '' : 's'} · ${boards.length} quadro${boards.length === 1 ? '' : 's'} criado${boards.length === 1 ? '' : 's'}</small></div><button type="button" class="routine-add">+ Nova</button>`;
      heading.querySelector('.routine-add').addEventListener('click', openForm);
      boardRoot.append(heading);
    }
    boards.forEach((board) => {
      const card = document.createElement('article');
      card.className = 'routine-card';
      const inicio = new Date(board.createdAt); inicio.setHours(0, 0, 0, 0);
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const elapsed = Math.max(0, Math.floor((Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / 86400000));
      const fim = new Date(inicio); fim.setDate(fim.getDate() + board.days - 1); fim.setHours(23, 59, 59, 999);
      const ativa = Date.now() <= fim.getTime();
      const dias = Array.from({ length: board.days }, (_, index) => {
        const date = new Date(inicio); date.setDate(inicio.getDate() + index);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { date, key, day: index + 1 };
      });
      const completed = Object.keys(board.checkins || {}).filter((key) => dias.some((day) => day.key === key)).length;
      const frequencia = Math.min(100, Math.round((completed / Math.max(1, Math.min(board.days, elapsed + 1))) * 100));
      const blanks = Array.from({ length: inicio.getDay() }, () => '<span class="routine-square routine-square-empty" aria-hidden="true"></span>').join('');
      const diasHtml = dias.map(({ date, key, day }) => {
        const checked = Boolean(board.checkins?.[key]);
        return `<span class="routine-square${checked ? ' done' : ''}" style="--routine-color:${escapeHtml(board.color)}" title="${date.toLocaleDateString('pt-BR')}${checked ? ` · presença ${escapeHtml(board.checkins[key])}` : ''}">${date.getDate()}</span>`;
      }).join('');
      card.innerHTML = `<header><div><strong>${escapeHtml(board.name)}</strong><small>${ativa ? 'Rotina ativa' : 'Período encerrado'} · ${completed} de ${Math.min(board.days, elapsed + 1)} presenças até hoje</small></div><button type="button" class="routine-remove" aria-label="Excluir quadro">×</button></header><div class="routine-squares" aria-label="Presenças do quadro ${escapeHtml(board.name)}">${blanks}${diasHtml}</div><div class="routine-progress" role="progressbar" aria-label="Frequência da rotina" aria-valuenow="${frequencia}" aria-valuemin="0" aria-valuemax="100"><span style="width:${frequencia}%;--routine-color:${escapeHtml(board.color)}"></span></div><footer><span>${inicio.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })} — ${fim.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })}</span><span>${frequencia}% de presença</span></footer><small class="routine-hint">Registre no chat: “fiz presença ${escapeHtml(board.name)} às 9:00”.</small>`;
      card.querySelector('.routine-remove').addEventListener('click', () => {
        save(readBoards().filter((item) => item.id !== board.id)); render();
      });
      boardRoot.append(card);
    });
  };

  const openForm = () => {
    const modal = document.createElement('div');
    modal.className = 'routine-modal-backdrop';
    modal.innerHTML = `<form class="routine-modal"><header><h2>Novo quadro de rotinas</h2><button type="button" class="routine-close" aria-label="Fechar">×</button></header><label>Nome<input name="name" maxlength="48" placeholder="Ex.: Caminhada diária" required></label><div class="routine-fields"><label>Duração em dias<input name="days" type="number" min="1" max="365" value="30" required></label><label>Cor das presenças<input name="color" type="color" value="#a855f7"></label></div><p>O quadro ficará visível na tela inicial até o fim do período.</p><button class="routine-create" type="submit">Criar quadro</button></form>`;
    document.body.append(modal);
    const close = () => modal.remove();
    modal.querySelector('.routine-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const boards = readBoards();
      boards.push({ id: crypto.randomUUID(), name: String(data.get('name')).trim(), days: Math.max(1, Math.min(365, Number(data.get('days')) || 30)), color: String(data.get('color') || '#a855f7'), createdAt: Date.now(), checkins: {} });
      save(boards); close(); render();
    });
    modal.querySelector('[name="name"]').focus();
  };

  addButton.addEventListener('click', () => {
    if (!readBoards().length) { openForm(); return; }
    boardRoot.classList.remove('routine-board-highlight');
    requestAnimationFrame(() => boardRoot.classList.add('routine-board-highlight'));
    window.setTimeout(() => boardRoot.classList.remove('routine-board-highlight'), 1200);
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

