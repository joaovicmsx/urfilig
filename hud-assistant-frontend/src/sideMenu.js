import { BACKEND_URL } from './authGuard.js';

// =========================================================================
// MODAIS CUSTOMIZADOS (FONTE PADRÃO DA APLICAÇÃO - CLEAN DARK)
// =========================================================================

function confirmarAcao(titulo, mensagemHtml, textoConfirmar = 'Excluir', corConfirmar = '#f87171') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modal.innerHTML = `
      <div style="background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; width: 100%; max-width: 400px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.9); box-sizing: border-box;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
          <h4 style="color: #f0f6fc; font-size: 0.9rem; font-weight: 600; margin: 0; letter-spacing: 0.3px;">${titulo}</h4>
        </div>
        <div style="padding: 1.5rem; color: #c9d1d9; font-size: 0.88rem; line-height: 1.5;">
          ${mensagemHtml}
        </div>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btn-modal-cancelar" type="button" style="background: transparent; border: none; color: #8b949e; padding: 8px 14px; font-size: 0.82rem; cursor: pointer;">Cancelar</button>
          <button id="btn-modal-confirmar" type="button" style="background: ${corConfirmar}; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">${textoConfirmar}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-modal-cancelar').onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector('#btn-modal-confirmar').onclick = () => { modal.remove(); resolve(true); };
  });
}

function pedirTextoModal(titulo, labelInput, valorInicial = '') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modal.innerHTML = `
      <div style="background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; width: 100%; max-width: 400px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.9); box-sizing: border-box;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
          <h4 style="color: #f0f6fc; font-size: 0.9rem; font-weight: 600; margin: 0; letter-spacing: 0.3px;">${titulo}</h4>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <label style="font-size: 0.68rem; color: #8b949e; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">${labelInput}</label>
          <input id="input-modal-texto" type="text" value="${valorInicial}" style="background: transparent !important; border: none !important; border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important; color: #f0f6fc !important; font-size: 0.95rem !important; padding: 8px 0 !important; border-radius: 0 !important; width: 100% !important; outline: none !important; font-family: inherit; box-sizing: border-box;" />
        </div>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btn-modal-cancelar" type="button" style="background: transparent; border: none; color: #8b949e; padding: 8px 14px; font-size: 0.82rem; cursor: pointer;">Cancelar</button>
          <button id="btn-modal-salvar" type="button" class="btn-dinamico-esfera" style="padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">Salvar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const input = modal.querySelector('#input-modal-texto');
    input.focus();
    input.select();

    const fechar = (val) => { modal.remove(); resolve(val); };

    modal.querySelector('#btn-modal-cancelar').onclick = () => fechar(null);
    modal.querySelector('#btn-modal-salvar').onclick = () => fechar(input.value.trim());
    input.onkeydown = (e) => {
      if (e.key === 'Enter') fechar(input.value.trim());
      if (e.key === 'Escape') fechar(null);
    };
  });
}

function pedirSelecaoPastaModal(pastas) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    const opcoesHtml = pastas.map(p => `<option value="${p.id}" style="background:#0d1117; color:#f0f6fc;">${p.nome}</option>`).join('');

    modal.innerHTML = `
      <div style="background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; width: 100%; max-width: 400px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.9); box-sizing: border-box;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
          <h4 style="color: #f0f6fc; font-size: 0.9rem; font-weight: 600; margin: 0; letter-spacing: 0.3px;">Mover Nota</h4>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <label style="font-size: 0.68rem; color: #8b949e; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">SELECIONE A PASTA DE DESTINO</label>
          <select id="select-modal-pasta" style="background: transparent !important; border: none !important; border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important; color: #f0f6fc !important; font-size: 0.9rem !important; padding: 8px 0 !important; border-radius: 0 !important; width: 100% !important; outline: none !important; font-family: inherit; box-sizing: border-box;">
            <option value="" style="background: #0d1117; color: #f0f6fc;">Nota Solta (Sem Pasta)</option>
            ${opcoesHtml}
          </select>
        </div>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btn-modal-cancelar" type="button" style="background: transparent; border: none; color: #8b949e; padding: 8px 14px; font-size: 0.82rem; cursor: pointer;">Cancelar</button>
          <button id="btn-modal-mover" type="button" class="btn-dinamico-esfera" style="padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">Mover Nota</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const fechar = (val) => { modal.remove(); resolve(val); };

    modal.querySelector('#btn-modal-cancelar').onclick = () => fechar(undefined);
    modal.querySelector('#btn-modal-mover').onclick = () => {
      const select = modal.querySelector('#select-modal-pasta');
      fechar(select.value ? select.value : null);
    };
  });
}

// =========================================================================
// MÓDULO MENU LATERAL & CÉREBRO
// =========================================================================

export function iniciarMenuLateral(socket) {
  const cabecalhoAuth = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
  });

  const iconeFechar = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  const iconeSetaBaixo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  const menuToggle = document.querySelector('#menu-toggle');
  const menuLateral = document.querySelector('#menu-lateral');
  const menuBackdrop = document.querySelector('#menu-backdrop');

  function abrirMenu() {
    menuLateral?.classList.add('visible');
    menuBackdrop?.classList.add('visible');
  }

  function fecharMenu() {
    menuLateral?.classList.remove('visible');
    menuBackdrop?.classList.remove('visible');
  }

  menuToggle?.addEventListener('click', () => {
    menuLateral?.classList.contains('visible') ? fecharMenu() : abrirMenu();
  });

  menuBackdrop?.addEventListener('click', fecharMenu);

  document.querySelector('#menu-editar-perfil')?.addEventListener('click', () => {
    window.location.href = '/onboarding.html?editar=1';
  });

  document.querySelector('#menu-sair')?.addEventListener('click', () => {
    window.sairDaUrfilig?.();
  });

  document.querySelector('#menu-abrir-contatos')?.addEventListener('click', () => {
    fecharMenu();
    if (typeof window.alternarPainelContatos === 'function') {
      window.alternarPainelContatos();
    }
  });

  const painelCalendario = document.querySelector('#calendario-painel');
  const alternarPainelCalendario = async () => {
    const abrir = !painelCalendario?.classList.contains('aberta');
    document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((painel) => {
      if (painel !== painelCalendario) painel.classList.remove('aberta');
    });
    painelCalendario?.classList.toggle('aberta', abrir);
    if (abrir && typeof window.carregarCalendarioUI === 'function') await window.carregarCalendarioUI();
  };
  document.querySelector('#nav-calendario')?.addEventListener('click', (e) => {
    e.preventDefault();
    alternarPainelCalendario();
  });
  document.querySelector('#menu-abrir-calendario')?.addEventListener('click', () => {
    fecharMenu();
    alternarPainelCalendario();
  });
  document.querySelector('#calendario-fechar')?.addEventListener('click', () => painelCalendario?.classList.remove('aberta'));
  document.querySelector('#nav-emails')?.addEventListener('click', () => {
    window.location.href = new URL('./email.html', window.location.href).href;
  });
  // Menu de Contexto
  let contextMenu = document.getElementById('urfilig-context-menu');
  if (!contextMenu) {
    contextMenu = document.createElement('div');
    contextMenu.id = 'urfilig-context-menu';
    contextMenu.style.cssText = `
      position: fixed; display: none; z-index: 10000; background: #161b22;
      border: 1px solid #30363d; border-radius: 8px; padding: 6px 0; width: 170px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7); font-family: inherit;
    `;
    document.body.appendChild(contextMenu);

    document.addEventListener('click', () => {
      contextMenu.style.display = 'none';
    });
  }

  function mostrarContextMenu(e, itens) {
    e.preventDefault();
    e.stopPropagation();

    contextMenu.innerHTML = '';
    itens.forEach(item => {
      const el = document.createElement('div');
      el.textContent = item.label;
      el.style.cssText = `
        padding: 8px 14px; color: ${item.danger ? '#f87171' : '#c9d1d9'};
        font-size: 0.82rem; cursor: pointer; transition: background 0.15s ease;
      `;
      el.addEventListener('mouseenter', () => el.style.background = '#21262d');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        contextMenu.style.display = 'none';
        item.action();
      });
      contextMenu.appendChild(el);
    });

    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.display = 'block';
  }

  // Modal de Nota Clean Dark com Fonte Padrão + Seletor de Pasta
  let notaAtualModal = null;
  let pastaAlvoModal = null;
  let modalNota = document.getElementById('modal-nota-detalhes');

  if (!modalNota) {
    modalNota = document.createElement('div');
    modalNota.id = 'modal-nota-detalhes';
    modalNota.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 9999; display: none; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modalNota.innerHTML = `
      <div style="background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; width: 100%; max-width: 480px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9); box-sizing: border-box;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center;">
          <h3 id="modal-nota-header-txt" style="font-size: 0.95rem; font-weight: 600; color: #f0f6fc; margin: 0; letter-spacing: 0.3px;">Nota</h3>
          <button id="modal-nota-fechar" type="button" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; color: #8b949e;" title="Fechar">
            ${iconeFechar}
          </button>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.2rem; box-sizing: border-box;">
          
          <div style="display: flex; flex-direction: column; gap: 0.3rem;">
            <label style="font-size: 0.68rem; color: #8b949e; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">TÍTULO *</label>
            <input id="modal-nota-titulo" type="text" placeholder="Sem título..." style="background: transparent !important; border: none !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; color: #f0f6fc !important; font-size: 1rem !important; padding: 8px 0 !important; border-radius: 0 !important; width: 100% !important; outline: none !important; font-family: inherit; box-sizing: border-box;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.3rem;">
            <label style="font-size: 0.68rem; color: #8b949e; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">PASTA DE DESTINO</label>
            <select id="modal-nota-pasta-select" style="background: transparent !important; border: none !important; border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; color: #f0f6fc !important; font-size: 0.9rem !important; padding: 6px 0 !important; border-radius: 0 !important; width: 100% !important; outline: none !important; font-family: inherit; box-sizing: border-box; cursor: pointer;">
              <option value="" style="background:#0d1117; color:#f0f6fc;">Nota Solta (Sem Pasta)</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.3rem;">
            <label style="font-size: 0.68rem; color: #8b949e; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">CONTEÚDO (OPCIONAL)</label>
            <textarea id="modal-nota-conteudo" placeholder="Escreva suas anotações..." style="background: transparent !important; border: none !important; color: #c9d1d9 !important; font-size: 0.9rem !important; line-height: 1.6 !important; padding: 8px 0 !important; border-radius: 0 !important; width: 100% !important; height: 160px !important; resize: none !important; outline: none !important; font-family: inherit; box-sizing: border-box;"></textarea>
          </div>

        </div>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: flex-end;">
          <button id="modal-nota-salvar" type="button" class="btn-dinamico-esfera" style="padding: 9px 20px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.2s ease;">Salvar Alterações</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalNota);

    const fechar = () => { modalNota.style.display = 'none'; };
    modalNota.querySelector('#modal-nota-fechar').addEventListener('click', fechar);
    modalNota.addEventListener('click', (e) => { if (e.target === modalNota) fechar(); });

    modalNota.querySelector('#modal-nota-salvar').addEventListener('click', async () => {
      await salvarNotaModal();
    });
  }

  function atualizarOpcoesSeletorPasta(pastaSelecionadaId = null) {
    const select = modalNota.querySelector('#modal-nota-pasta-select');
    if (!select) return;

    let options = `<option value="" style="background:#0d1117; color:#f0f6fc;">Nota Solta (Sem Pasta)</option>`;
    pastas.forEach(p => {
      const isSel = String(p.id) === String(pastaSelecionadaId) ? 'selected' : '';
      options += `<option value="${p.id}" ${isSel} style="background:#0d1117; color:#f0f6fc;">${p.nome}</option>`;
    });
    select.innerHTML = options;
  }

  function abrirModalEditarNota(nota) {
    if (!modalNota) return;
    notaAtualModal = nota;
    pastaAlvoModal = nota.pastaId || null;

    atualizarOpcoesSeletorPasta(pastaAlvoModal);

    modalNota.querySelector('#modal-nota-header-txt').textContent = 'Editar Nota';
    modalNota.querySelector('#modal-nota-titulo').value = nota.titulo || nota.label || nota.nome || '';
    modalNota.querySelector('#modal-nota-conteudo').value = nota.conteudo || '';
    modalNota.querySelector('#modal-nota-salvar').textContent = 'Salvar Alterações';
    modalNota.style.display = 'flex';
  }

  function abrirModalCriarNota(pastaId = null) {
    if (!modalNota) return;
    notaAtualModal = null;
    pastaAlvoModal = pastaId;

    atualizarOpcoesSeletorPasta(pastaAlvoModal);

    modalNota.querySelector('#modal-nota-header-txt').textContent = pastaId ? 'Criar Nota na Pasta' : 'Criar Nova Nota';
    modalNota.querySelector('#modal-nota-titulo').value = '';
    modalNota.querySelector('#modal-nota-conteudo').value = '';
    modalNota.querySelector('#modal-nota-salvar').textContent = 'Criar Nota';
    modalNota.style.display = 'flex';
  }

  async function salvarNotaModal() {
    const titulo = modalNota.querySelector('#modal-nota-titulo').value.trim();
    const conteudo = modalNota.querySelector('#modal-nota-conteudo').value.trim();
    const selectPasta = modalNota.querySelector('#modal-nota-pasta-select');
    const pastaIdSelecionada = selectPasta ? (selectPasta.value ? selectPasta.value : null) : pastaAlvoModal;

    if (!titulo) {
      alert('O título não pode ficar vazio.');
      return;
    }

    const btnSalvar = modalNota.querySelector('#modal-nota-salvar');
    btnSalvar.textContent = 'Salvando...';
    btnSalvar.disabled = true;

    try {
      const payload = {
        titulo,
        conteudo: conteudo || '',
        pastaId: pastaIdSelecionada ? String(pastaIdSelecionada) : null,
        pasta_id: pastaIdSelecionada ? String(pastaIdSelecionada) : null
      };

      let resp;
      if (notaAtualModal && notaAtualModal.id && !String(notaAtualModal.id).startsWith('hobby-')) {
        resp = await fetch(`${BACKEND_URL}/api/cerebro/notas/${notaAtualModal.id}`, {
          method: 'PUT',
          headers: cabecalhoAuth(),
          body: JSON.stringify(payload),
        });
      } else {
        resp = await fetch(`${BACKEND_URL}/api/cerebro/notas`, {
          method: 'POST',
          headers: cabecalhoAuth(),
          body: JSON.stringify(payload),
        });
      }

      if (resp.ok) {
        modalNota.style.display = 'none';
        if (pastaIdSelecionada) {
          pastasAbertasState.set(String(pastaIdSelecionada), true);
        }
        await carregarPastasDoBackend(true);
      } else {
        alert('O servidor rejeitou esta gravação. Verifique se a sua API suporta mudar pastas neste endpoint.');
      }
    } catch (e) {
      console.error('[Cérebro] Erro ao salvar nota:', e);
    } finally {
      btnSalvar.textContent = notaAtualModal ? 'Salvar Alterações' : 'Criar Nota';
      btnSalvar.disabled = false;
    }
  }

  // Cérebro & Pastas
  const cerebroPainel = document.querySelector('#cerebro-painel');
  const listaPastas = document.querySelector('#cerebro-lista-pastas');

  let pastas = [];
  let notasSoltas = [];
  // Controla quais pastas estão ABERTAS. Por predefinição, iniciam todas fechadas.
  const pastasAbertasState = new Map();

  function alternarPainelCerebro() {
    if (cerebroPainel) {
      const estaAberta = cerebroPainel.classList.toggle('aberta');
      if (estaAberta) {
        document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((painel) => {
          if (painel !== cerebroPainel) painel.classList.remove('aberta');
        });
        carregarPastasDoBackend(true);
      }
    }
  }

  document.querySelector('#menu-abrir-cerebro')?.addEventListener('click', () => { fecharMenu(); alternarPainelCerebro(); });
  document.querySelector('#nav-cerebro')?.addEventListener('click', (e) => { e.preventDefault(); alternarPainelCerebro(); });
  document.querySelector('#cerebro-fechar')?.addEventListener('click', () => { cerebroPainel?.classList.remove('aberta'); });

  async function carregarPastasDoBackend(forcarAtualizar3D = false) {
    try {
      // 1. BLOQUEIO DE CACHE DO NAVEGADOR
      const ts = new Date().getTime(); 
      const fetchOpts = { headers: cabecalhoAuth(), cache: 'no-store' };

      // APENAS busca as pastas (que já devem trazer as notas embutidas no seu Backend)
      const respPastas = await fetch(`${BACKEND_URL}/api/cerebro/pastas?_t=${ts}`, fetchOpts);
      if (respPastas.ok) {
        pastas = await respPastas.json();
      }

      const mapaNotas = new Map();

      pastas.forEach(pasta => {
        if (pasta.notas && Array.isArray(pasta.notas)) {
          pasta.notas.forEach(nota => {
            const realId = nota.id || nota._id;
            if (realId) {
              mapaNotas.set(String(realId), { ...nota, id: realId, pastaId: String(pasta.id) });
            }
          });
        }
      });

      // AQUI FOI REMOVIDA A CHAMADA QUE GERAVA O ERRO 404 (fetch /api/cerebro/notas)

      try {
        const respUser = await fetch(`${BACKEND_URL}/api/auth/me?_t=${ts}`, fetchOpts);
        if (respUser.ok) {
          const { usuario } = await respUser.json();
          if (usuario && usuario.hobbies) {
            const listaHobbies = typeof usuario.hobbies === 'string' ? usuario.hobbies.split(',') : usuario.hobbies;
            listaHobbies.forEach(h => {
              const hNome = (typeof h === 'string' ? h : (h.nome || h.label || h.titulo || '')).trim();
              if (hNome) {
                const hKey = `hobby-${hNome.toLowerCase().replace(/\s+/g, '-')}`;
                if (!mapaNotas.has(hKey)) {
                  mapaNotas.set(hKey, { id: hKey, titulo: hNome, label: hNome, conteudo: `Hobby do perfil: ${hNome}`, pastaId: null });
                }
              }
            });
          }
        }
      } catch (e) {}

      const todasNotas = Array.from(mapaNotas.values());

      pastas.forEach(pasta => {
        pasta.notas = todasNotas.filter(n => n.pastaId !== null && n.pastaId !== undefined && String(n.pastaId) === String(pasta.id));
      });

      notasSoltas = todasNotas.filter(n => {
        const pid = n.pastaId ?? n.pasta_id ?? n.folderId;
        return pid === null || pid === undefined || pid === '' || pid === 0 || pid === '0' || pid === 'null' || pid === 'undefined';
      });

      if (forcarAtualizar3D && typeof window.recarregarEsferaNeural === 'function') {
        window.recarregarEsferaNeural();
      }

      renderizarInterfaceTextoPuro();
      garantirBotoesCriacaoNaUI();
    } catch (erro) {
      console.error('[Cérebro] Erro ao carregar pastas e notas:', erro);
    }
  }

  window.recarregarInterfaceNotas = () => carregarPastasDoBackend(true);

  // Busca Inteligente de Nós (Pastas e Notas) ao clicar na Esfera 3D
  window.abrirNotaPorId = function(alvo, abrirPainel = true) {
    if (!alvo) return;

    if (cerebroPainel) {
      cerebroPainel.classList.add('aberta');
    }

    const idStr = typeof alvo === 'object' ? String(alvo.id || '') : String(alvo);
    const labelStr = typeof alvo === 'object' ? String(alvo.label || alvo.titulo || alvo.nome || alvo.id || '') : String(alvo);

    const limpoId = idStr.replace(/^(nota-|pasta-|hobby-)/, '').trim();
    const limpoLabel = labelStr.replace(/^(nota-|pasta-|hobby-)/, '').trim();

    const isExplicitFolder = (typeof alvo === 'object' && (alvo.isFolder || alvo.type === 'folder' || alvo.type === 'pasta')) || idStr.startsWith('pasta-');

    const pastaEncontrada = pastas.find(p => 
      String(p.id) === limpoId || 
      String(p.id) === idStr || 
      p.nome.toLowerCase() === limpoLabel.toLowerCase() || 
      p.nome.toLowerCase() === limpoId.toLowerCase()
    );

    if (pastaEncontrada || isExplicitFolder) {
      const pastaAlvo = pastaEncontrada || { id: limpoId, nome: labelStr };
      const pId = String(pastaAlvo.id);

      pastasAbertasState.set(pId, true);
      renderizarInterfaceTextoPuro();

      setTimeout(() => {
        const elPasta = document.querySelector(`[data-pasta-id="${pId}"]`);
        if (elPasta) {
          elPasta.scrollIntoView({ behavior: 'smooth', block: 'center' });
          elPasta.style.transition = 'color 0.3s ease, background 0.3s ease';
          elPasta.style.color = '#38bdf8';
          elPasta.style.background = 'rgba(255, 255, 255, 0.08)';
          setTimeout(() => {
            elPasta.style.color = '';
            elPasta.style.background = 'transparent';
          }, 1800);
        }
      }, 100);
      return;
    }

    let notaEncontrada = notasSoltas.find(n => {
      const nid = String(n.id || '').toLowerCase();
      const ntit = String(n.titulo || n.label || n.nome || '').toLowerCase();
      return nid === idStr.toLowerCase() || nid === limpoId.toLowerCase() || ntit === limpoLabel.toLowerCase();
    });

    if (!notaEncontrada) {
      for (const p of pastas) {
        if (p.notas && Array.isArray(p.notas)) {
          notaEncontrada = p.notas.find(n => {
            const nid = String(n.id || '').toLowerCase();
            const ntit = String(n.titulo || n.label || n.nome || '').toLowerCase();
            return nid === idStr.toLowerCase() || nid === limpoId.toLowerCase() || ntit === limpoLabel.toLowerCase();
          });
          if (notaEncontrada) break;
        }
      }
    }

    if (notaEncontrada) {
      abrirModalEditarNota(notaEncontrada);
      return;
    }

    if (isNaN(limpoLabel) && limpoLabel && limpoLabel !== 'null' && limpoLabel !== 'undefined' && limpoLabel !== '2') {
      const itemObj = {
        id: idStr,
        titulo: labelStr,
        conteudo: `Item sem pasta: ${labelStr}`
      };
      abrirModalEditarNota(itemObj);
    }
  };

  async function renomearNota(nota) {
    const novoNome = await pedirTextoModal('Renomear Nota', 'NOVO TÍTULO', nota.titulo || nota.label);
    if (!novoNome) return;
    if (String(nota.id).startsWith('hobby-')) {
      nota.titulo = novoNome;
      renderizarInterfaceTextoPuro();
      return;
    }
    await fetch(`${BACKEND_URL}/api/cerebro/notas/${nota.id}`, {
      method: 'PUT', headers: cabecalhoAuth(), body: JSON.stringify({ titulo: novoNome })
    });
    carregarPastasDoBackend(true);
  }

  async function excluirNota(nota) {
    const confirmado = await confirmarAcao('Excluir Nota', `Tem certeza que deseja excluir a nota "<strong>${nota.titulo || nota.label}</strong>"?`);
    if (confirmado) {
      if (String(nota.id).startsWith('hobby-')) {
        notasSoltas = notasSoltas.filter(n => n.id !== nota.id);
        renderizarInterfaceTextoPuro();
        return;
      }
      await fetch(`${BACKEND_URL}/api/cerebro/notas/${nota.id}`, { method: 'DELETE', headers: cabecalhoAuth() });
      carregarPastasDoBackend(true);
    }
  }

  // ======================================================================================
  // TRUQUE MESTRE COM ROTA DIRETA E REFRESH SEGURO
  // ======================================================================================
  async function moverNotaParaPasta(nota) {
    const novaPastaId = await pedirSelecaoPastaModal(pastas);
    if (novaPastaId === undefined) return;

    const targetPastaId = novaPastaId ? String(novaPastaId) : null;
    const oldPastaId = nota.pastaId ?? nota.pasta_id ?? nota.folderId ?? null;

    if (String(targetPastaId) === String(oldPastaId)) return;

    if (String(nota.id).startsWith('hobby-')) {
      nota.pastaId = targetPastaId;
      nota.pasta_id = targetPastaId;
      if (targetPastaId) pastasAbertasState.set(String(targetPastaId), true);
      renderizarInterfaceTextoPuro();
      if (typeof window.recarregarEsferaNeural === 'function') window.recarregarEsferaNeural();
      return;
    }

    const payload = {
      titulo: nota.titulo || nota.label || nota.nome || 'Nota',
      conteudo: nota.conteudo || '',
      pastaId: targetPastaId,
      pasta_id: targetPastaId
    };

    try {
      console.log(`[Cérebro] A tentar mover nota ${nota.id} para a pasta ${targetPastaId}...`);

      const resp = await fetch(`${BACKEND_URL}/api/cerebro/notas/${nota.id}`, {
        method: 'PUT',
        headers: cabecalhoAuth(),
        body: JSON.stringify(payload)
      });

      console.log(`[Cérebro] Resposta da API ao mover:`, resp.status);

      if (resp.ok) {
        if (targetPastaId) pastasAbertasState.set(String(targetPastaId), true);
        
        // Aguarda meio segundo para garantir commit na base de dados antes de recarregar a UI
        await new Promise(resolve => setTimeout(resolve, 500));
        await carregarPastasDoBackend(true);
      } else {
        const erroCorpo = await resp.text();
        console.error('[Cérebro] Erro retornado pelo servidor:', erroCorpo);
        alert('O servidor recusou a alteração de pasta. Verifique a consola.');
      }
    } catch (e) {
      console.error('[Cérebro] Falha crítica de rede ou servidor offline:', e);
      alert('Erro de conexão com o servidor. Certifique-se de que o backend está online.');
    }
  }

  async function renomearPasta(pasta) {
    const novoNome = await pedirTextoModal('Renomear Pasta', 'NOVO NOME DA PASTA', pasta.nome);
    if (!novoNome) return;
    await fetch(`${BACKEND_URL}/api/cerebro/pastas/${pasta.id}`, {
      method: 'PUT', headers: cabecalhoAuth(), body: JSON.stringify({ nome: novoNome })
    });
    carregarPastasDoBackend(true);
  }

  async function excluirPasta(pasta) {
    const confirmado = await confirmarAcao('Excluir Pasta', `Tem certeza que deseja excluir a pasta "<strong>${pasta.nome}</strong>" e todas as suas notas?`);
    if (confirmado) {
      await fetch(`${BACKEND_URL}/api/cerebro/pastas/${pasta.id}`, { method: 'DELETE', headers: cabecalhoAuth() });
      carregarPastasDoBackend(true);
    }
  }

  function criarNotaTextoPuroUI(nota) {
    const div = document.createElement('div');
    div.className = 'cerebro-nota-item item-lista-limpo';
    div.style.cssText = `
      cursor: pointer; padding: 5px 8px 5px 22px; margin: 2px 0; border-radius: 6px;
      background: transparent; border: none; display: flex; align-items: center;
      justify-content: space-between; user-select: none; transition: background 0.15s ease;
    `;

    div.innerHTML = `
      <span style="font-size: 0.85rem; color: #c9d1d9; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${nota.titulo || nota.label || nota.nome}
      </span>
    `;

    div.addEventListener('click', () => { abrirModalEditarNota(nota); });

    div.addEventListener('contextmenu', (e) => {
      mostrarContextMenu(e, [
        { label: 'Editar', action: () => abrirModalEditarNota(nota) },
        { label: 'Renomear', action: () => renomearNota(nota) },
        { label: 'Mover para pasta', action: () => moverNotaParaPasta(nota) },
        { label: 'Excluir', danger: true, action: () => excluirNota(nota) }
      ]);
    });

    return div;
  }

  function renderizarInterfaceTextoPuro() {
    if (!listaPastas) return;
    listaPastas.innerHTML = '';

    if (pastas.length === 0 && notasSoltas.length === 0) {
      listaPastas.innerHTML = '<p style="color:#484f58; font-size:0.85rem; text-align:center; padding: 2rem 1rem;">Nenhuma pasta ou nota cadastrada.</p>';
      return;
    }

    listaPastas.addEventListener('contextmenu', (e) => {
      if (e.target === listaPastas) {
        mostrarContextMenu(e, [
          { label: 'Nova nota', action: () => abrirModalCriarNota(null) },
          { 
            label: 'Nova pasta', 
            action: async () => {
              const nomePasta = await pedirTextoModal('Nova Pasta', 'NOME DA PASTA', '');
              if (!nomePasta) return;
              await fetch(`${BACKEND_URL}/api/cerebro/pastas`, {
                method: 'POST',
                headers: cabecalhoAuth(),
                body: JSON.stringify({ nome: nomePasta }),
              });
              carregarPastasDoBackend(true);
            } 
          }
        ]);
      }
    });

    pastas.forEach((pasta) => {
      const pastaWrapper = document.createElement('div');
      pastaWrapper.style.cssText = 'margin-bottom: 6px;';

      const estaAberta = pastasAbertasState.get(String(pasta.id)) === true;
      const notasNaPasta = pasta.notas || [];

      const pastaHeader = document.createElement('div');
      pastaHeader.className = 'cerebro-pasta item-lista-limpo';
      pastaHeader.setAttribute('data-pasta-id', String(pasta.id));
      pastaHeader.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        background: transparent; border: none; padding: 6px 8px; border-radius: 6px; cursor: pointer;
        user-select: none; transition: background 0.2s ease;
      `;

      pastaHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <span style="display: flex; align-items: center; transform: ${estaAberta ? 'rotate(0deg)' : 'rotate(-90deg)'}; transition: transform 0.2s ease;">
            ${iconeSetaBaixo}
          </span>
          <span style="font-weight: 600; color: #f0f6fc; font-size: 0.88rem;">${pasta.nome}</span>
          <span style="font-size: 0.7rem; color: #8b949e; background: rgba(255, 255, 255, 0.05); padding: 1px 6px; border-radius: 10px;">${notasNaPasta.length}</span>
        </div>
      `;

      pastaHeader.addEventListener('click', () => {
        const estadoAtual = pastasAbertasState.get(String(pasta.id)) || false;
        pastasAbertasState.set(String(pasta.id), !estadoAtual);
        renderizarInterfaceTextoPuro();
      });

      pastaHeader.addEventListener('contextmenu', (e) => {
        mostrarContextMenu(e, [
          { label: 'Adicionar nota', action: () => abrirModalCriarNota(pasta.id) },
          { label: 'Renomear', action: () => renomearPasta(pasta) },
          { label: 'Excluir', danger: true, action: () => excluirPasta(pasta) }
        ]);
      });

      pastaWrapper.append(pastaHeader);

      if (estaAberta) {
        const containerNotas = document.createElement('div');
        if (notasNaPasta.length > 0) {
          notasNaPasta.forEach((nota) => {
            const notaEl = criarNotaTextoPuroUI(nota);
            containerNotas.append(notaEl);
          });
        } else {
          const vazio = document.createElement('div');
          vazio.style.cssText = 'font-size: 0.75rem; color: #484f58; margin: 4px 0 4px 22px; font-style: italic;';
          vazio.textContent = 'Pasta vazia';
          containerNotas.append(vazio);
        }
        pastaWrapper.append(containerNotas);
      }

      listaPastas.append(pastaWrapper);
    });

    if (notasSoltas.length > 0) {
      const separador = document.createElement('div');
      separador.innerHTML = `<h4 style="color:#8b949e; font-size: 0.72rem; text-transform: uppercase; margin: 1rem 0 0.4rem 0; letter-spacing: 0.8px;">Notas Soltas</h4>`;
      listaPastas.append(separador);

      notasSoltas.forEach((nota) => {
        const notaEl = criarNotaTextoPuroUI(nota);
        listaPastas.append(notaEl);
      });
    }
  }

  function garantirBotoesCriacaoNaUI() {
    const formAntigo = document.querySelector('#cerebro-painel form, .cerebro-form-fixo');
    if (formAntigo) {
      formAntigo.style.display = 'none';
    }

    let containerBotoes = document.getElementById('urfilig-acoes-criacao');
    if (!containerBotoes && cerebroPainel) {
      containerBotoes = document.createElement('div');
      containerBotoes.id = 'urfilig-acoes-criacao';
      containerBotoes.style.cssText = `
        padding: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex; gap: 8px; margin-top: auto; background: #0d1117;
      `;

      containerBotoes.innerHTML = `
        <button id="btn-criar-nova-nota" type="button" class="btn-dinamico-esfera" style="flex: 1; padding: 9px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">+ Nova Nota</button>
        <button id="btn-criar-nova-pasta" type="button" style="background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); color: #c9d1d9; padding: 9px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer;">+ Pasta</button>
      `;

      cerebroPainel.appendChild(containerBotoes);

      containerBotoes.querySelector('#btn-criar-nova-nota').addEventListener('click', () => {
        abrirModalCriarNota(null);
      });

      containerBotoes.querySelector('#btn-criar-nova-pasta').addEventListener('click', async () => {
        const nomePasta = await pedirTextoModal('Nova Pasta', 'NOME DA PASTA', '');
        if (!nomePasta) return;
        await fetch(`${BACKEND_URL}/api/cerebro/pastas`, {
          method: 'POST',
          headers: cabecalhoAuth(),
          body: JSON.stringify({ nome: nomePasta }),
        });
        carregarPastasDoBackend(true);
      });
    }
  }

  if (socket) {
    socket.off('hud:response');
    socket.on('hud:response', () => {
      carregarPastasDoBackend(true);
    });
  }

  carregarPastasDoBackend(false);
}