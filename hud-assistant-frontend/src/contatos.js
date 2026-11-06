import { BACKEND_URL } from './authGuard.js';
import { showAlert } from './uiDialogs.js';

function getContatoKey(c) {
  return String(c.id || c._id || c.nome || '').trim();
}

function getFavoritosLocais() {
  try {
    return JSON.parse(localStorage.getItem('urfilig_contatos_favoritos') || '[]');
  } catch (e) {
    return [];
  }
}

function salvarFavoritoLocal(key, eFavorito) {
  if (!key) return;
  let favs = getFavoritosLocais();
  if (eFavorito) {
    if (!favs.includes(key)) favs.push(key);
  } else {
    favs = favs.filter(k => k !== key);
  }
  localStorage.setItem('urfilig_contatos_favoritos', JSON.stringify(favs));
}

// Caixa de Confirmação Customizada no mesmo padrão Clean Dark
function confirmarExclusao(nome) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modal.innerHTML = `
      <div style="background: #0d1117; border: 1px solid #21262d; border-radius: 12px; width: 100%; max-width: 380px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); box-sizing: border-box;">
        <div style="padding: 1rem 1.2rem; background: #161b22; border-bottom: 1px solid #21262d;">
          <h4 style="color: #f0f6fc; font-size: 0.95rem; font-weight: 600; margin: 0;">Excluir Contato</h4>
        </div>
        <div style="padding: 1.2rem; color: #c9d1d9; font-size: 0.88rem; line-height: 1.5;">
          Tem certeza que deseja excluir <strong id="nome-contato-exclusao"></strong>?
        </div>
        <div style="padding: 0.8rem 1.2rem; border-top: 1px solid #21262d; display: flex; justify-content: flex-end; gap: 8px; background: #161b22;">
          <button id="btn-modal-cancelar" style="background: transparent; border: none; color: #8b949e; padding: 8px 14px; font-size: 0.82rem; cursor: pointer;">Cancelar</button>
          <button id="btn-modal-confirmar" style="background: #f87171; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer;">Excluir</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#nome-contato-exclusao').textContent = nome;

    modal.querySelector('#btn-modal-cancelar').onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector('#btn-modal-confirmar').onclick = () => { modal.remove(); resolve(true); };
  });
}

function notificarSucesso(mensagem) {
  const aviso = document.createElement('div');
  aviso.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; background: #0d1117;
    border: 1px solid #21262d; color: #38bdf8;
    padding: 10px 18px; border-radius: 8px; font-size: 0.85rem;
    z-index: 10001; box-shadow: 0 10px 25px rgba(0,0,0,0.6);
    font-family: inherit;
  `;
  aviso.textContent = mensagem;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 3000);
}

export function iniciarModuloContatos() {
  const cabecalhoAuth = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
  });

  const iconeFechar = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  // Context Menu
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

    document.addEventListener('click', () => { contextMenu.style.display = 'none'; });
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

  // Painel de Contatos
  let painelContatos = document.getElementById('contatos-painel');
  if (!painelContatos) {
    painelContatos = document.createElement('div');
    painelContatos.id = 'contatos-painel';
    painelContatos.className = 'sidebar-cerebro';

    painelContatos.innerHTML = `
      <div class="sidebar-cerebro-header">
        <span id="contatos-titulo">Carteira de Contatos</span>
        <button id="contatos-fechar" type="button" aria-label="Fechar" title="Fechar painel">
          ${iconeFechar}
        </button>
      </div>

      <div class="contatos-busca-container">
        <input id="contatos-busca" type="text" placeholder="Buscar contato..." />
      </div>

      <div id="contatos-lista" class="cerebro-lista contatos-lista"></div>

      <div class="contatos-rodape">
        <button id="btn-novo-contato-rodape" type="button" class="contatos-btn-novo">
          + Novo Contato
        </button>
      </div>
    `;

    document.body.appendChild(painelContatos);

    document.getElementById('contatos-fechar').addEventListener('click', () => {
      painelContatos.classList.remove('aberta');
    });
  }

  // Modal Novo / Editar Contato
  let modalContato = document.getElementById('modal-contato-form');
  if (!modalContato) {
    modalContato = document.createElement('div');
    modalContato.id = 'modal-contato-form';
    modalContato.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);
      z-index: 9999; display: none; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modalContato.innerHTML = `
      <div style="background: #0d1117; border: 1px solid #21262d; border-radius: 12px; width: 100%; max-width: 500px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); box-sizing: border-box;">
        
        <div style="padding: 1rem 1.2rem; border-bottom: 1px solid #21262d; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #161b22;">
          <h3 id="modal-contato-titulo-txt" style="font-size: 0.95rem; font-weight: 600; color: #f0f6fc; margin: 0;">Novo Contato</h3>
          <button id="modal-contato-fechar" style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;" title="Fechar">
            ${iconeFechar}
          </button>
        </div>
        
        <form id="form-contato" style="padding: 1.2rem; display: flex; flex-direction: column; gap: 0.9rem; overflow-y: auto; flex: 1; box-sizing: border-box;">
          <input type="hidden" id="contato-id" />
          
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.75rem; color: #8b949e; font-weight: 600; letter-spacing: 0.3px;">NOME COMPLETO *</label>
            <input id="contato-nome" type="text" required style="background: #0d1117; border: 1px solid #30363d; color: #f0f6fc; font-size: 0.88rem; padding: 8px 12px; border-radius: 6px; width: 100%; outline: none; font-family: inherit; box-sizing: border-box;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; box-sizing: border-box;">
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label style="font-size: 0.75rem; color: #8b949e; font-weight: 600; letter-spacing: 0.3px;">TELEFONE / WHATSAPP</label>
              <input id="contato-telefone" type="text" style="background: #0d1117; border: 1px solid #30363d; color: #f0f6fc; font-size: 0.88rem; padding: 8px 12px; border-radius: 6px; width: 100%; outline: none; font-family: inherit; box-sizing: border-box;" />
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label style="font-size: 0.75rem; color: #8b949e; font-weight: 600; letter-spacing: 0.3px;">E-MAIL</label>
              <input id="contato-email" type="email" style="background: #0d1117; border: 1px solid #30363d; color: #f0f6fc; font-size: 0.88rem; padding: 8px 12px; border-radius: 6px; width: 100%; outline: none; font-family: inherit; box-sizing: border-box;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.75rem; color: #8b949e; font-weight: 600; letter-spacing: 0.3px;">DATA DO CONTATO</label>
            <input id="contato-data" type="date" style="background: #0d1117; border: 1px solid #30363d; color: #f0f6fc; font-size: 0.88rem; padding: 8px 12px; border-radius: 6px; width: 100%; outline: none; font-family: inherit; color-scheme: dark; box-sizing: border-box;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.75rem; color: #8b949e; font-weight: 600; letter-spacing: 0.3px;">ANOTAÇÕES & OBSERVAÇÕES</label>
            <textarea id="contato-anotacoes" rows="4" style="background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; font-size: 0.88rem; line-height: 1.5; padding: 10px 12px; border-radius: 6px; width: 100%; resize: none; outline: none; font-family: inherit; box-sizing: border-box;"></textarea>
          </div>
          <label style="display:flex;align-items:flex-start;gap:8px;color:#aab2bd;font-size:0.78rem;line-height:1.45;">
            <input id="contato-base-legal" type="checkbox" required style="margin-top:2px;accent-color:#9b62c9;" />
            <span>Confirmo que tenho autorização ou outra base legal para registrar estes dados neste app.</span>
          </label>
        </form>

        <div style="padding: 0.8rem 1.2rem; border-top: 1px solid #21262d; display: flex; justify-content: flex-end; background: #161b22;">
          <button type="button" id="btn-salvar-contato-modal" class="btn-dinamico-esfera" style="padding: 8px 18px; border-radius: 6px; font-weight: 500; font-size: 0.85rem; cursor: pointer;">Salvar Contato</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalContato);

    const fecharModal = () => { modalContato.style.display = 'none'; };
    document.getElementById('modal-contato-fechar').addEventListener('click', fecharModal);
    modalContato.addEventListener('click', (e) => { if (e.target === modalContato) fecharModal(); });
  }

  let listaContatosLocal = [];

  async function carregarContatos() {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/contatos`, { headers: cabecalhoAuth() });
      if (resp.ok) {
        listaContatosLocal = await resp.json();
        const favs = getFavoritosLocais();
        listaContatosLocal.forEach(c => {
          const key = getContatoKey(c);
          c.favorito = favs.includes(key) || !!c.favorito;
        });
        renderizarContatos(listaContatosLocal);
      }
    } catch (e) {
      console.error('[Contatos] Erro ao carregar:', e);
    }
  }

  async function salvarContatoNoCerebro(c) {
    try {
      const respPastas = await fetch(`${BACKEND_URL}/api/cerebro/pastas`, { headers: cabecalhoAuth() });
      let pastaContatos = null;

      if (respPastas.ok) {
        const pastas = await respPastas.json();
        pastaContatos = pastas.find(p => p.nome.toLowerCase() === 'contatos');
      }

      if (!pastaContatos) {
        const respNovaPasta = await fetch(`${BACKEND_URL}/api/cerebro/pastas`, {
          method: 'POST',
          headers: cabecalhoAuth(),
          body: JSON.stringify({ nome: 'Contatos' }),
        });
        if (respNovaPasta.ok) {
          pastaContatos = await respNovaPasta.json();
        }
      }

      if (!pastaContatos || !pastaContatos.id) {
        await showAlert('Não foi possível localizar ou criar a pasta "Contatos" no Cérebro.');
        return;
      }

      const respNota = await fetch(`${BACKEND_URL}/api/cerebro/pastas/${pastaContatos.id}/notas`, {
        method: 'POST',
        headers: cabecalhoAuth(),
        // Evita duplicar dados pessoais fora do armazenamento protegido de contatos.
        body: JSON.stringify({ titulo: 'Registro de contato protegido', conteudo: 'Os dados deste contato estão disponíveis na lista protegida de contatos.' }),
      });

      if (respNota.ok) {
        notificarSucesso(`"${c.nome}" salvo no Cérebro!`);
        if (typeof window.recarregarInterfaceNotas === 'function') {
          window.recarregarInterfaceNotas();
        }
      }
    } catch (err) {
      console.error('[Contatos] Erro ao salvar no Cérebro:', err);
    }
  }

  async function excluirContato(c) {
    const confirmado = await confirmarExclusao(c.nome);
    if (confirmado) {
      const key = getContatoKey(c);
      salvarFavoritoLocal(key, false);
      if (c.id) {
        await fetch(`${BACKEND_URL}/api/contatos/${c.id}`, { method: 'DELETE', headers: cabecalhoAuth() });
      }
      carregarContatos();
    }
  }

  // Lista Limpa: Fundo transparente, sem contornos, sem ícones genéricos
  function renderizarContatos(listaBruta) {
    const container = document.getElementById('contatos-lista');
    if (!container) return;
    container.innerHTML = '';

    if (listaBruta.length === 0) {
      container.innerHTML = `<p style="color:#484f58; font-size:0.85rem; text-align:center; padding: 2rem 1rem;">Nenhum contato encontrado.</p>`;
      return;
    }

    const lista = [...listaBruta].sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0));

    lista.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'contato-item-clean item-lista-limpo';
      item.style.cssText = `
        padding: 8px 12px; margin: 3px 0; border-radius: 6px; cursor: pointer;
        background: transparent; border: none; display: flex; flex-direction: column;
        gap: 2px; user-select: none;
      `;

      const nome = document.createElement('div');
      nome.style.cssText = 'font-size: 0.88rem; font-weight: 600; color: #f0f6fc;';
      nome.textContent = c.nome || 'Contato sem nome';
      item.append(nome);
      if (c.telefone) {
        const telefone = document.createElement('div');
        telefone.style.cssText = 'font-size: 0.78rem; color: #8b949e;';
        telefone.textContent = c.telefone;
        item.append(telefone);
      }
      if (c.email) {
        const email = document.createElement('div');
        email.style.cssText = 'font-size: 0.75rem; color: #64748b;';
        email.textContent = c.email;
        item.append(email);
      }

      item.addEventListener('click', () => { abrirFormContato(c); });

      item.addEventListener('contextmenu', (e) => {
        mostrarContextMenu(e, [
          { label: 'Editar', action: () => abrirFormContato(c) },
          { label: 'Salvar no Cérebro', action: () => salvarContatoNoCerebro(c) },
          { label: 'Excluir', danger: true, action: () => excluirContato(c) }
        ]);
      });

      container.appendChild(item);
    });
  }

  function abrirFormContato(c = null) {
    document.getElementById('modal-contato-titulo-txt').textContent = c ? 'Editar Contato' : 'Novo Contato';
    document.getElementById('contato-id').value = c ? c.id : '';
    document.getElementById('contato-nome').value = c ? c.nome : '';
    document.getElementById('contato-telefone').value = c ? c.telefone || '' : '';
    document.getElementById('contato-email').value = c ? c.email || '' : '';
    document.getElementById('contato-data').value = c && c.dataContato ? c.dataContato.split('T')[0] : '';
    document.getElementById('contato-anotacoes').value = c ? c.anotacoes || '' : '';
    document.getElementById('contato-base-legal').checked = false;

    modalContato.style.display = 'flex';
  }

  document.getElementById('btn-novo-contato-rodape')?.addEventListener('click', () => abrirFormContato());

  document.getElementById('btn-salvar-contato-modal')?.addEventListener('click', async () => {
    const btnSalvar = document.getElementById('btn-salvar-contato-modal');
    btnSalvar.textContent = 'Salvando...';
    btnSalvar.disabled = true;

    try {
      const id = document.getElementById('contato-id').value;
      const dados = {
        nome: document.getElementById('contato-nome').value.trim(),
        telefone: document.getElementById('contato-telefone').value.trim(),
        email: document.getElementById('contato-email').value.trim(),
        dataContato: document.getElementById('contato-data').value || null,
        anotacoes: document.getElementById('contato-anotacoes').value.trim(),
        baseLegalConfirmada: document.getElementById('contato-base-legal').checked,
      };

      if (!dados.nome) {
        await showAlert('Preencha pelo menos o nome do contato.');
        return;
      }
      if (!dados.baseLegalConfirmada) {
        await showAlert('Confirme a autorização ou base legal antes de salvar os dados do contato.');
        return;
      }

      const url = id ? `${BACKEND_URL}/api/contatos/${id}` : `${BACKEND_URL}/api/contatos`;
      const method = id ? 'PUT' : 'POST';

      const resp = await fetch(url, { method, headers: cabecalhoAuth(), body: JSON.stringify(dados) });

      if (resp.ok) {
        modalContato.style.display = 'none';
        carregarContatos();
      } else {
        const resultado = await resp.json().catch(() => ({}));
        await showAlert(resultado.erro || 'Não foi possível salvar o contato.');
      }
    } catch (err) {
      console.error('[Contatos] Erro ao salvar:', err);
    } finally {
      btnSalvar.textContent = 'Salvar Contato';
      btnSalvar.disabled = false;
    }
  });

  document.getElementById('contatos-busca')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtrados = listaContatosLocal.filter(c => 
      c.nome.toLowerCase().includes(q) || 
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.telefone && c.telefone.toLowerCase().includes(q))
    );
    renderizarContatos(filtrados);
  });

  const alternarContatos = () => {
    const estaAberto = painelContatos.classList.contains('aberta');
    if (estaAberto) {
      painelContatos.classList.remove('aberta');
    } else {
      document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((painel) => {
        if (painel !== painelContatos) painel.classList.remove('aberta');
      });
      painelContatos.classList.add('aberta');
      carregarContatos();
    }
  };

  window.alternarPainelContatos = alternarContatos;

  document.querySelector('#nav-contatos')?.addEventListener('click', (e) => {
    e.preventDefault();
    alternarContatos();
  });
}
