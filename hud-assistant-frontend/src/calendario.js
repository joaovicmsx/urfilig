import { BACKEND_URL } from './authGuard.js';
import { showAlert, showConfirm } from './uiDialogs.js';

let dataAtual = new Date();
let eventosCache = [];
let filtroEtiqueta = '__todas__';

function escaparHtml(valor = '') {
  return String(valor).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caractere]);
}

function corSegura(cor) {
  return /^#[0-9a-f]{6}$/i.test(String(cor || '')) ? cor : '#aeb8c4';
}

function normalizarEtiqueta(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

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
  const etiquetas = new Map();
  eventosCache.forEach((evento) => {
    const nome = normalizarEtiqueta(evento.etiqueta);
    if (!nome) return;
    const chave = nome.toLocaleLowerCase('pt-BR');
    if (!etiquetas.has(chave)) etiquetas.set(chave, { nome, cor: corSegura(evento.cor) });
  });
  const filtrosHtml = [
    `<button type="button" class="evento-filtro" data-filtro="__todas__" aria-pressed="${filtroEtiqueta === '__todas__'}">Todos</button>`,
    ...[...etiquetas.entries()].map(([chave, item]) => `<button type="button" class="evento-filtro" data-filtro="${escaparHtml(chave)}" aria-pressed="${filtroEtiqueta === chave}" style="--filtro-cor:${item.cor}"><span aria-hidden="true"></span>${escaparHtml(item.nome)}</button>`),
  ].join('');

  let htmlDias = '';

  for (let i = 0; i < primeiroDia; i++) {
    htmlDias += `<div style="background: transparent;"></div>`;
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const diaFormatado = String(dia).padStart(2, '0');
    const mesFormatado = String(mes + 1).padStart(2, '0');
    const dataIso = `${ano}-${mesFormatado}-${diaFormatado}`;

    // Procura eventos cuja data comece com YYYY-MM-DD
    const eventosDoDia = eventosCache.filter((e) => {
      if (!e.dataInicio || !e.dataInicio.startsWith(dataIso)) return false;
      if (filtroEtiqueta === '__todas__') return true;
      return normalizarEtiqueta(e.etiqueta).toLocaleLowerCase('pt-BR') === filtroEtiqueta;
    });

    const htmlEventos = eventosDoDia
      .map((ev) => {
        const etiqueta = ev.etiqueta ? `<span class="evento-etiqueta">${escaparHtml(ev.etiqueta)}</span>` : '';
        return `<button type="button" class="item-evento" data-id="${escaparHtml(ev.id)}" style="--evento-cor:${corSegura(ev.cor)}" title="${escaparHtml(ev.titulo)}">${etiqueta}<span class="evento-titulo">${escaparHtml(ev.titulo)}</span></button>`;
      })
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

      <div class="evento-filtros" aria-label="Filtrar compromissos por etiqueta">${filtrosHtml || '<span>Sem etiquetas</span>'}</div>

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
  document.querySelectorAll('.evento-filtro').forEach((button) => {
    button.addEventListener('click', () => {
      filtroEtiqueta = button.dataset.filtro || '__todas__';
      renderizarEstrutura();
    });
  });

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
  const corInicial = corSegura(evento.cor);
  const etiquetaInicial = normalizarEtiqueta(evento.etiqueta);

  const modalHtml = `
    <div id="modal-evento-overlay" class="evento-overlay">
      <section class="evento-dialog" role="dialog" aria-modal="true" aria-labelledby="evento-form-titulo">
        <h4 id="evento-form-titulo">${isEdicao ? 'Editar evento' : 'Novo evento'}</h4>
        <form id="form-evento" class="evento-form">
          <input type="text" id="ev-titulo" placeholder="Título do evento" value="${escaparHtml(evento.titulo || '')}" required />
          <textarea id="ev-desc" placeholder="Descrição (opcional)">${escaparHtml(evento.descricao || '')}</textarea>
          <label class="evento-campo-data">Data<input type="date" id="ev-data" value="${dataValida}" required /></label>
          <label class="evento-campo-etiqueta">Etiqueta<input type="text" id="ev-etiqueta" maxlength="32" placeholder="Nome da etiqueta" value="${escaparHtml(etiquetaInicial)}" /></label>
          <label class="evento-cor-personalizada">Cor do evento<input type="color" id="ev-cor" value="${corInicial}" /></label>
          <div class="evento-preview" id="evento-cor-preview" style="--evento-cor:${corInicial}" aria-live="polite"><span class="evento-preview-ponto"></span><span class="evento-preview-etiqueta">${escaparHtml(etiquetaInicial || 'Sem etiqueta')}</span><span class="evento-preview-titulo">${escaparHtml(evento.titulo || 'Seu evento')}</span></div>
          <div class="evento-acoes">
            <button type="button" id="btn-fechar-modal">Cancelar</button>
            ${isEdicao ? `<button type="button" id="btn-apagar-ev" class="evento-apagar">Apagar</button>` : ''}
            <button type="submit" id="btn-salvar-ev" class="evento-salvar">Salvar</button>
          </div>
        </form>
      </section>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.querySelector('#modal-evento-overlay');
  document.querySelector('#btn-fechar-modal').onclick = () => modal.remove();
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });

  const seletorCor = document.querySelector('#ev-cor');
  const campoEtiqueta = document.querySelector('#ev-etiqueta');
  const previewCor = document.querySelector('#evento-cor-preview');
  const previewEtiqueta = previewCor.querySelector('.evento-preview-etiqueta');
  const atualizarPreview = () => {
    const cor = corSegura(seletorCor.value);
    previewCor.style.setProperty('--evento-cor', cor);
    previewEtiqueta.textContent = campoEtiqueta.value.trim() || 'Sem etiqueta';
  };
  seletorCor.addEventListener('input', atualizarPreview);
  campoEtiqueta.addEventListener('input', atualizarPreview);
  document.querySelector('#ev-titulo').addEventListener('input', (event) => {
    previewCor.querySelector('.evento-preview-titulo').textContent = event.currentTarget.value.trim() || 'Seu evento';
  });

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
      cor: corSegura(document.querySelector('#ev-cor').value),
      etiqueta: normalizarEtiqueta(campoEtiqueta.value).slice(0, 32) || null,
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
