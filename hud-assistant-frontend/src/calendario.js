import { BACKEND_URL } from './authGuard.js';
import { showAlert, showConfirm } from './uiDialogs.js';

let dataAtual = new Date();
let eventosCache = [];

const cabecalhoAuth = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
});

export async function carregarCalendarioUI() {
  await buscarEventos();
  renderizarEstrutura();
}

window.carregarCalendarioUI = carregarCalendarioUI;

async function buscarEventos() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/eventos`, {
      headers: cabecalhoAuth(),
    });
    if (res.ok) {
      eventosCache = await res.json();
    }
  } catch (e) {
    console.error('[Calendário] Erro ao buscar eventos:', e);
  }
}

function renderizarEstrutura() {
  const container = document.querySelector('#calendario-conteudo');
  if (!container) return;

  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const nomeMes = dataAtual.toLocaleString('pt-BR', { month: 'long' });

  let htmlDias = '';

  for (let i = 0; i < primeiroDia; i++) {
    htmlDias += `<div style="background: transparent;"></div>`;
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const diaFormatado = String(dia).padStart(2, '0');
    const mesFormatado = String(mes + 1).padStart(2, '0');
    const dataIso = `${ano}-${mesFormatado}-${diaFormatado}`;

    // Procura eventos cuja data comece com YYYY-MM-DD
    const eventosDoDia = eventosCache.filter((e) => e.dataInicio && e.dataInicio.startsWith(dataIso));

    const htmlEventos = eventosDoDia
      .map(
        (ev) => `<div class="item-evento" data-id="${ev.id}" style="border-left: 2px solid ${ev.cor || '#ffffff'}; background: #121215; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; color: #f8fafc; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ev.titulo}">${ev.titulo}</div>`
      )
      .join('');

    htmlDias += `
      <div data-data="${dataIso}" style="background: #09090b; padding: 8px; min-height: 75px; display: flex; flex-direction: column; gap: 4px; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 500; font-size: 0.8rem; color: #94a3b8;">${dia}</span>
          <button type="button" class="btn-add-evento" data-data="${dataIso}" style="background: none; border: none; color: #475569; cursor: pointer; font-size: 0.9rem; padding: 0;">+</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px; overflow-y: auto; max-height: 55px;">
          ${htmlEventos}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem; width: 100%; height: 100%; color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button id="btn-mes-anterior" type="button" style="background: #09090b; border: none; color: #94a3b8; padding: 6px 12px; border-radius: 6px; cursor: pointer;">◀</button>
        <h3 style="margin: 0; text-transform: capitalize; font-size: 1rem; font-weight: 600; color: #ffffff;">${nomeMes} ${ano}</h3>
        <button id="btn-proximo-mes" type="button" style="background: #09090b; border: none; color: #94a3b8; padding: 6px 12px; border-radius: 6px; cursor: pointer;">▶</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.75rem; font-weight: 500; color: #475569;">
        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; overflow-y: auto;">
        ${htmlDias}
      </div>
    </div>
  `;

  configurarEventosDOM();
}

function configurarEventosDOM() {
  document.querySelector('#btn-mes-anterior')?.addEventListener('click', () => {
    dataAtual.setMonth(dataAtual.getMonth() - 1);
    renderizarEstrutura();
  });

  document.querySelector('#btn-proximo-mes')?.addEventListener('click', () => {
    dataAtual.setMonth(dataAtual.getMonth() + 1);
    renderizarEstrutura();
  });

  document.querySelectorAll('.btn-add-evento').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      abrirModalEvento({ dataInicio: btn.dataset.data });
    };
  });

  document.querySelectorAll('.item-evento').forEach((card) => {
    card.onclick = (e) => {
      e.stopPropagation();
      const evento = eventosCache.find((item) => item.id === card.dataset.id);
      if (evento) abrirModalEvento(evento);
    };
  });
}

function abrirModalEvento(evento = {}) {
  const isEdicao = !!evento.id;
  const dataValida = evento.dataInicio ? evento.dataInicio.split('T')[0] : '';

  const modalHtml = `
    <div id="modal-evento-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div style="background: #09090b; border-radius: 12px; padding: 1.8rem; width: 90%; max-width: 360px;">
        <h4 style="margin: 0 0 1.2rem 0; color: #ffffff; font-size: 1rem; font-weight: 600;">${isEdicao ? 'Editar Evento' : 'Novo Evento'}</h4>
        <form id="form-evento" style="display: flex; flex-direction: column; gap: 0.8rem;">
          <input type="text" id="ev-titulo" placeholder="Título do evento" value="${evento.titulo || ''}" required style="background: #121215; border: none; color: #ffffff; padding: 10px 12px; border-radius: 8px; font-size: 0.85rem; outline: none;" />
          <textarea id="ev-desc" placeholder="Descrição (opcional)" style="background: #121215; border: none; color: #ffffff; padding: 10px 12px; border-radius: 8px; font-size: 0.85rem; resize: vertical; min-height: 60px; outline: none;">${evento.descricao || ''}</textarea>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="date" id="ev-data" value="${dataValida}" required style="background: #121215; border: none; color: #ffffff; padding: 10px 12px; border-radius: 8px; font-size: 0.85rem; flex: 1; outline: none;" />
            <input type="color" id="ev-cor" value="${evento.cor || '#ffffff'}" style="background: none; border: none; width: 32px; height: 32px; cursor: pointer;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 1.2rem;">
            <button type="button" id="btn-fechar-modal" style="background: #121215; border: none; color: #94a3b8; padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">Cancelar</button>
            ${isEdicao ? `<button type="button" id="btn-apagar-ev" style="background: #ef4444; border: none; color: #ffffff; padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">Apagar</button>` : ''}
            <button type="submit" id="btn-salvar-ev" style="background: #1e293b; border: none; color: #ffffff; padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.querySelector('#modal-evento-overlay');
  document.querySelector('#btn-fechar-modal').onclick = () => modal.remove();

  if (isEdicao) {
    document.querySelector('#btn-apagar-ev').onclick = async () => {
      if (await showConfirm('Deseja excluir este evento?')) {
        await fetch(`${BACKEND_URL}/api/eventos/${evento.id}`, {
          method: 'DELETE',
          headers: cabecalhoAuth(),
        });
        modal.remove();
        carregarCalendarioUI();
      }
    };
  }

  document.querySelector('#form-evento').onsubmit = async (e) => {
    e.preventDefault();
    const btnSalvar = document.querySelector('#btn-salvar-ev');
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    const rawData = document.querySelector('#ev-data').value; // Formato YYYY-MM-DD

    // Força a interpretação direta em UTC adicionando o sufixo Z
    const dataInicioIso = `${rawData}T00:00:00.000Z`;
    const dataFimIso = `${rawData}T23:59:59.999Z`;

    const corpo = {
      titulo: document.querySelector('#ev-titulo').value.trim(),
      descricao: document.querySelector('#ev-desc').value.trim() || null,
      dataInicio: dataInicioIso,
      dataFim: dataFimIso,
      cor: document.querySelector('#ev-cor').value,
    };

    const url = isEdicao ? `${BACKEND_URL}/api/eventos/${evento.id}` : `${BACKEND_URL}/api/eventos`;
    const metodo = isEdicao ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: cabecalhoAuth(),
        body: JSON.stringify(corpo),
      });

      if (res.ok) {
        modal.remove();
        await carregarCalendarioUI();
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('[Calendário] Erro do Backend:', err);
        await showAlert('Erro ao salvar evento: ' + (err.erro || err.message || 'Verifique a conexão.'));
      }
    } catch (erro) {
      await showAlert('Erro de conexão com o servidor: ' + erro.message);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar';
    }
  };
}
