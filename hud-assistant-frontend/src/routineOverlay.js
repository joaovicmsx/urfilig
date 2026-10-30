import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

const root = document.querySelector('#routine-overlay-content');
const key = 'urfilig_routine_boards_v1';
const today = new Date();
const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
function draw(boards = JSON.parse(localStorage.getItem(key) || '[]')) {
  root.replaceChildren();
  (Array.isArray(boards) ? boards : []).forEach((board) => {
    const card = document.createElement('article'); card.className = 'routine-overlay-card';
    const heading = document.createElement('strong'); heading.textContent = board.name;
    const count = Object.keys(board.checkins || {}).length;
    const meta = document.createElement('small'); meta.textContent = `${count} presenças · ${board.checkins?.[dayKey] ? `hoje às ${board.checkins[dayKey]}` : 'sem presença hoje'}`;
    const squares = document.createElement('div'); squares.className = 'routine-squares';
    const start = new Date(board.createdAt); start.setHours(0, 0, 0, 0);
    for (let empty = 0; empty < start.getDay(); empty++) { const blank = document.createElement('span'); blank.className = 'routine-square routine-square-empty'; squares.append(blank); }
    for (let index = 1; index <= Math.min(board.days, 42); index++) {
      const date = new Date(start); date.setDate(start.getDate() + index - 1);
      const keyDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const square = document.createElement('span'); square.className = `routine-square${board.checkins?.[keyDay] ? ' done' : ''}`; square.style.setProperty('--routine-color', board.color); square.textContent = date.getDate(); square.title = date.toLocaleDateString('pt-BR'); squares.append(square);
    }
    card.append(heading, meta, squares); root.append(card);
  });
}
void listen('routine:refresh', (event) => draw(event.payload));
window.addEventListener('storage', () => draw());
draw();
document.querySelector('#routine-overlay-close')?.addEventListener('click', () => getCurrentWindow().close());
document.querySelector('#routine-overlay')?.addEventListener('pointerdown', (event) => { if (event.target === event.currentTarget) void getCurrentWindow().startDragging(); });
