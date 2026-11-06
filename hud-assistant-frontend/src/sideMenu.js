import { BACKEND_URL } from './authGuard.js';
import { showAlert, showConfirm } from './uiDialogs.js';
import { iniciarPaineisDados } from './dataPanels.js';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { confirmarAcao, pedirSelecaoPastaModal, pedirTextoModal } from './sideMenuDialogs.js';

// =========================================================================
// MODAIS CUSTOMIZADOS (FONTE PADRÃO DA APLICAÇÃO - CLEAN DARK)
// =========================================================================

export function iniciarMenuLateral(socket) {
  const cabecalhoAuth = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
  });

  iniciarPaineisDados({ backendUrl: BACKEND_URL, cabecalhoAuth, fecharMenu });

  const iconeFechar = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  const iconeSetaBaixo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  const menuToggle = document.querySelector('#menu-toggle');
  const menuLateral = document.querySelector('#menu-lateral');
  const menuBackdrop = document.querySelector('#menu-backdrop');
  const profileDrawer = document.querySelector('#profile-drawer');
  const profileBackdrop = document.querySelector('#profile-backdrop');
  const pluginsDrawer = document.querySelector('#plugins-drawer');
  const pluginsBackdrop = document.querySelector('#plugins-backdrop');
  const profileForm = document.querySelector('#profile-form');
  const profileMessage = document.querySelector('#profile-message');
  const profileSaveButton = document.querySelector('#profile-save');
  const accountEmail = document.querySelector('#settings-account-email');
  const deleteEmailInput = document.querySelector('#settings-delete-email');
  const deleteAccountButton = document.querySelector('#settings-delete-account');
  const deleteMessage = document.querySelector('#settings-delete-message');
  const profilePrefs = (() => {
    try {
      return { responseStyle: 'equilibrada', responseTone: 'natural', showWeather: true,
        ...JSON.parse(localStorage.getItem('urfilig_preferencias') || '{}') };
    } catch { return { responseStyle: 'equilibrada', responseTone: 'natural', showWeather: true }; }
  })();
  delete profilePrefs.skyMotion;

  const aplicarPreferenciasPerfil = (prefs = profilePrefs) => {
    document.body.classList.toggle('pref-hide-weather', !prefs.showWeather);
  };
  aplicarPreferenciasPerfil();

  function fecharPerfil() {
    profileDrawer?.classList.remove('aberta');
    profileBackdrop?.classList.remove('visible');
    profileDrawer?.setAttribute('aria-hidden', 'true');
  }

  function fecharPlugins() {
    pluginsDrawer?.classList.remove('aberta');
    pluginsBackdrop?.classList.remove('visible');
    pluginsDrawer?.setAttribute('aria-hidden', 'true');
  }

  function minimizarChatAoNavegar() {
    const chat = document.querySelector('#chat-historico');
    if (!chat || chat.style.display === 'none') return;
    chat.style.display = 'none';
    const restaurar = document.querySelector('#chat-restaurar');
    if (restaurar) restaurar.hidden = false;
    document.querySelector('#chat-painel')?.classList.remove('chat-expanded');
    document.querySelector('#nav-chats')?.setAttribute('aria-expanded', 'false');
    const listaLateral = document.querySelector('#chat-sidebar-history');
    if (listaLateral) listaLateral.hidden = true;
  }

  function abrirPlugins() {
    fecharMenu();
    fecharPerfil();
    minimizarChatAoNavegar();
    document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((painel) => painel.classList.remove('aberta'));
    document.querySelector('#email-painel')?.classList.remove('aberta');
    document.querySelector('#calendario-painel')?.classList.remove('aberta');
    pluginsDrawer?.classList.add('aberta');
    pluginsBackdrop?.classList.add('visible');
    pluginsDrawer?.setAttribute('aria-hidden', 'false');
    atualizarStatusPlugins();
  }

  async function atualizarStatusPlugins() {
    let usuario = {};
    try { usuario = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}'); } catch { /* estado conectado pode ficar sem nome */ }
    let spotifyConectado = false;
    try {
      spotifyConectado = Boolean(JSON.parse(localStorage.getItem(`urfilig_spotify_session:${usuario.id || 'local'}`) || 'null')?.refreshToken);
    } catch { /* conta não conectada */ }
    const spotifyStatus = document.querySelector('#settings-spotify-status');
    if (spotifyStatus) spotifyStatus.textContent = spotifyConectado ? 'Conta vinculada neste perfil' : 'Não conectado';

    const gmailStatus = document.querySelector('#settings-gmail-status');
    if (gmailStatus) gmailStatus.textContent = localStorage.getItem('google_access_token') ? 'Autorização salva; validade verificada ao abrir E-mails' : 'Não conectado';

    const geminiStatus = document.querySelector('#settings-gemini-status');
    const ollamaStatus = document.querySelector('#settings-ollama-status');
    try {
      const response = await fetch(`${BACKEND_URL}/api/inteligencia/llm-status`, { headers: cabecalhoAuth(), cache: 'no-store' });
      const status = response.ok ? await response.json() : null;
      if (!status) throw new Error('status indisponível');
      if (geminiStatus) geminiStatus.textContent = status.gemini ? 'Chave configurada; validação ao enviar mensagem' : 'Configure uma chave da Gemini API';
      if (ollamaStatus) ollamaStatus.textContent = status.ollama
        ? `Disponível · ${status.ollamaModel}`
        : status.ollamaServidor ? `Modelo ${status.ollamaModel} não encontrado` : 'Servidor local indisponível';
    } catch {
      if (geminiStatus) geminiStatus.textContent = 'Não foi possível consultar a configuração';
      if (ollamaStatus) ollamaStatus.textContent = 'Não foi possível consultar o serviço local';
    }
  }

  async function abrirPerfil() {
    fecharMenu();
    fecharPlugins();
    minimizarChatAoNavegar();
    document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((painel) => painel.classList.remove('aberta'));
    document.querySelector('#email-painel')?.classList.remove('aberta');
    document.querySelector('#calendario-painel')?.classList.remove('aberta');
    profileDrawer?.classList.add('aberta');
    profileBackdrop?.classList.add('visible');
    profileDrawer?.setAttribute('aria-hidden', 'false');
    if (profileMessage) profileMessage.textContent = '';
    if (deleteMessage) deleteMessage.textContent = '';
    if (deleteEmailInput) deleteEmailInput.value = '';
    if (deleteAccountButton) deleteAccountButton.disabled = true;

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, { headers: cabecalhoAuth(), cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.erro || 'Não foi possível carregar o perfil.');
      const usuario = payload.usuario || {};
      localStorage.setItem('urfilig_usuario', JSON.stringify(usuario));
      if (accountEmail) accountEmail.textContent = usuario.email || 'E-mail indisponível';
      for (const [field, value] of Object.entries({
        nome: usuario.nome || '', idade: usuario.idade ?? '', localizacao: usuario.localizacao || '',
        profissao: usuario.profissao || '', hobbies: usuario.hobbies || '',
      })) {
        const input = profileForm?.elements.namedItem(field);
        if (input) input.value = value;
      }
    } catch (error) {
      let usuario = {};
      try { usuario = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}'); } catch { /* formulário permanece vazio */ }
      if (accountEmail) accountEmail.textContent = usuario.email || 'E-mail indisponível';
      for (const [field, value] of Object.entries({
        nome: usuario.nome || '', idade: usuario.idade ?? '', localizacao: usuario.localizacao || '',
        profissao: usuario.profissao || '', hobbies: usuario.hobbies || '',
      })) {
        const input = profileForm?.elements.namedItem(field);
        if (input) input.value = value;
      }
      if (profileMessage) profileMessage.textContent = 'Dados locais carregados. O perfil precisa de conexão para ser salvo.';
    }

    const prefs = profilePrefs;
    const style = document.querySelector(`input[name="profile-response-style"][value="${prefs.responseStyle || 'equilibrada'}"]`);
    const tone = document.querySelector(`input[name="profile-response-tone"][value="${prefs.responseTone || 'natural'}"]`);
    const showWeather = document.querySelector('#profile-show-weather');
    document.querySelectorAll('input[name="profile-response-style"], input[name="profile-response-tone"]').forEach((input) => { input.checked = false; });
    if (style) style.checked = true;
    if (tone) tone.checked = true;
    if (showWeather) showWeather.checked = prefs.showWeather !== false;
    profileDrawer?.querySelector('#profile-back')?.focus();
  }

  // O menu sempre inicia fechado, inclusive se a WebView restaurar o estado anterior.
  menuLateral?.classList.remove('visible', 'aberto', 'active');
  menuBackdrop?.classList.remove('visible', 'aberto');
  menuLateral?.setAttribute('aria-hidden', 'true');
  menuToggle?.setAttribute('aria-expanded', 'false');

  function abrirMenu() {
    menuLateral?.classList.add('visible');
    menuBackdrop?.classList.add('visible');
    menuLateral?.setAttribute('aria-hidden', 'false');
    menuToggle?.setAttribute('aria-expanded', 'true');
  }

  function fecharMenu() {
    menuLateral?.classList.remove('visible');
    menuBackdrop?.classList.remove('visible');
    menuLateral?.setAttribute('aria-hidden', 'true');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }

  menuToggle?.addEventListener('click', () => {
    fecharPerfil();
    fecharPlugins();
    menuLateral?.classList.contains('visible') ? fecharMenu() : abrirMenu();
  });
  const navItems = [...document.querySelectorAll('.hud-nav .nav-item:not(#nav-logout):not(#mascot-overlay-toggle)')];
  const estadoNavAberto = () => {
    const aberto = (seletor) => Boolean(document.querySelector(seletor));
    const modalDados = document.querySelector('#intel-modal.visible');
    const tituloDados = document.querySelector('#intel-modal-titulo')?.textContent?.trim();
    const tituloNavDados = {
      'Notícias em alta': '#btn-tendencias',
      Lembretes: '#btn-lembretes',
      'Plano de hoje': '#btn-plano-hoje',
      'Resumo semanal': '#btn-revisao-semanal',
    };
    if (modalDados && tituloNavDados[tituloDados]) return tituloNavDados[tituloDados];

    const destinos = [
      ['#nav-chats', '#chat-historico:not([style*="display: none"])'],
      ['#nav-cerebro', '#cerebro-painel.aberta'],
      ['#nav-calendario', '#calendario-painel.aberta'],
      ['#nav-emails', '#email-painel.aberta'],
      ['#nav-spotify', '#spotify-drawer.aberta'],
      ['#nav-contatos', '#contatos-painel.aberta'],
      ['#nav-prospeccao', '#prospeccao-drawer.aberta'],
      ['#nav-profile', '#profile-drawer.aberta'],
      ['#nav-plugins', '#plugins-drawer.aberta'],
    ];
    const destinoAberto = destinos.find(([, seletor]) => aberto(seletor));
    if (destinoAberto) return destinoAberto[0];
    if (aberto('#routine-sidebar-list:not([hidden])') || aberto('.routine-modal-backdrop')) return '#nav-routines';
    return null;
  };
  const sincronizarNavAtiva = () => {
    const idAtivo = estadoNavAberto();
    navItems.forEach((item) => {
      const ativo = item.id === idAtivo;
      item.classList.toggle('active', ativo);
      if (ativo) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  };
  const observadorNav = new MutationObserver((mutacoes) => {
    if (mutacoes.some((mutacao) => mutacao.type === 'attributes'
      || [...mutacao.addedNodes, ...mutacao.removedNodes].some((node) => node instanceof Element
        && (node.matches('.routine-modal-backdrop') || node.querySelector('.routine-modal-backdrop'))))) {
      sincronizarNavAtiva();
    }
  });
  observadorNav.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'aria-hidden', 'style'],
    childList: true,
  });
  sincronizarNavAtiva();
  document.querySelectorAll('.hud-nav .nav-item:not(#nav-profile)').forEach((item) => {
    item.addEventListener('click', () => { fecharPerfil(); if (item.id !== 'nav-chats') minimizarChatAoNavegar(); }, { capture: true });
  });
  document.querySelectorAll('.hud-nav .nav-item:not(#nav-plugins)').forEach((item) => {
    item.addEventListener('click', fecharPlugins, { capture: true });
  });

  menuBackdrop?.addEventListener('click', fecharMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { fecharPerfil(); fecharPlugins(); fecharMenu(); }
  });

  document.querySelector('#menu-editar-perfil')?.addEventListener('click', abrirPerfil);
  document.querySelector('#nav-profile')?.addEventListener('click', abrirPerfil);
  profileBackdrop?.addEventListener('click', fecharPerfil);
  pluginsBackdrop?.addEventListener('click', fecharPlugins);
  document.querySelector('#profile-back')?.addEventListener('click', fecharPerfil);
  document.querySelector('#profile-close')?.addEventListener('click', fecharPerfil);
  document.querySelector('#plugins-back')?.addEventListener('click', fecharPlugins);
  document.querySelector('#plugins-close')?.addEventListener('click', fecharPlugins);
  document.querySelector('#profile-cancel')?.addEventListener('click', fecharPerfil);
  document.querySelector('#nav-plugins')?.addEventListener('click', abrirPlugins);
  deleteEmailInput?.addEventListener('input', () => {
    const esperado = accountEmail?.textContent?.trim().toLocaleLowerCase('pt-BR') || '';
    const digitado = deleteEmailInput.value.trim().toLocaleLowerCase('pt-BR');
    if (deleteAccountButton) deleteAccountButton.disabled = !esperado || digitado !== esperado;
    if (deleteMessage) deleteMessage.textContent = '';
  });
  deleteAccountButton?.addEventListener('click', async () => {
    const email = deleteEmailInput?.value.trim() || '';
    if (!email || deleteAccountButton.disabled) return;
    const confirmado = await showConfirm(
      'Esta ação apaga permanentemente sua conta e os dados associados. Não será possível desfazer.',
      'Excluir conta permanentemente',
    );
    if (!confirmado) return;
    deleteAccountButton.disabled = true;
    deleteAccountButton.textContent = 'Excluindo…';
    if (deleteMessage) deleteMessage.textContent = '';
    try {
      const response = await fetch(`${BACKEND_URL}/api/usuario/conta`, {
        method: 'DELETE', headers: cabecalhoAuth(), body: JSON.stringify({ confirmarEmail: email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro || 'Não foi possível excluir a conta.');
      let usuario = {};
      try { usuario = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}'); } catch { /* continua removendo o restante local */ }
      for (const key of ['urfilig_preferencias', 'urfilig_llm_provider', 'urfilig_prospeccao_nicho', 'urfilig_routine_boards_v1', 'urfilig_contatos_favoritos', 'google_access_token', 'redirect_after_login']) localStorage.removeItem(key);
      if (usuario.id) localStorage.removeItem(`urfilig_spotify_session:${usuario.id}`);
      if (deleteMessage) deleteMessage.textContent = 'Conta excluída. Encerrando sessão…';
      window.setTimeout(() => window.sairDaUrfilig?.(), 350);
    } catch (error) {
      if (deleteMessage) deleteMessage.textContent = error.message;
      deleteAccountButton.disabled = false;
      deleteAccountButton.textContent = 'Excluir minha conta';
    }
  });
  document.querySelectorAll('[data-settings-plugin]').forEach((button) => button.addEventListener('click', () => {
    const destination = button.dataset.settingsPlugin === 'spotify' ? '#nav-spotify' : '#nav-emails';
    fecharPerfil();
    document.querySelector(destination)?.click();
  }));
  document.querySelectorAll('[data-settings-provider]').forEach((button) => button.addEventListener('click', () => {
    const provider = document.querySelector('#quick-chat-provider');
    if (!provider) return;
    provider.value = button.dataset.settingsProvider;
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    if (profileMessage) profileMessage.textContent = `${button.dataset.settingsProvider === 'ollama' ? 'Ollama local' : 'Gemini'} selecionado para o chat.`;
  }));
  const linksServicos = {
    obsidian: ['https://obsidian.md', 'Obsidian', '#settings-obsidian-status'],
    notion: ['https://www.notion.so/login', 'Notion', '#settings-notion-status'],
    claude: ['https://claude.ai/login', 'Claude', '#settings-claude-status'],
    openai: ['https://chatgpt.com', 'GPT / Codex', '#settings-openai-status'],
  };
  document.querySelectorAll('[data-settings-service]').forEach((button) => button.addEventListener('click', async () => {
    const servico = linksServicos[button.dataset.settingsService];
    if (!servico) return;
    try {
      if (isTauri()) await invoke('abrir_url_externa', { url: servico[0] });
      else window.open(servico[0], '_blank', 'noopener,noreferrer');
      const status = document.querySelector(servico[2]);
      if (status) status.textContent = `Serviço aberto · conta ainda não vinculada à Urfilig`;
      if (profileMessage) profileMessage.textContent = `${servico[1]} aberto. A conta ainda não está vinculada à Urfilig; veja o requisito indicado no cartão.`;
    } catch {
      if (profileMessage) profileMessage.textContent = `Não foi possível abrir ${servico[1]}.`;
    }
  }));
  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!profileForm || !profileSaveButton) return;
    profileMessage.textContent = '';
    profileSaveButton.disabled = true;
    profileSaveButton.textContent = 'Salvando…';
    const formData = new FormData(profileForm);
    const payload = Object.fromEntries(formData.entries());
    payload.idade = payload.idade ? Number(payload.idade) : null;
    payload.hobbies = payload.hobbies.split(',').map((item) => item.trim()).filter(Boolean);
    try {
      const response = await fetch(`${BACKEND_URL}/api/usuario/perfil`, {
        method: 'PATCH', headers: cabecalhoAuth(), body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.erro || 'Não foi possível salvar o perfil.');
      localStorage.setItem('urfilig_usuario', JSON.stringify(result.usuario));
      Object.assign(profilePrefs, {
        responseStyle: document.querySelector('input[name="profile-response-style"]:checked')?.value || 'equilibrada',
        responseTone: document.querySelector('input[name="profile-response-tone"]:checked')?.value || 'natural',
        showWeather: document.querySelector('#profile-show-weather')?.checked !== false,
      });
      localStorage.setItem('urfilig_preferencias', JSON.stringify(profilePrefs));
      aplicarPreferenciasPerfil();
      if (profileMessage) profileMessage.textContent = 'Alterações salvas.';
      setTimeout(fecharPerfil, 450);
    } catch (error) {
      if (profileMessage) profileMessage.textContent = error.message || 'Falha ao salvar as alterações.';
    } finally {
      profileSaveButton.disabled = false;
      profileSaveButton.textContent = 'Salvar alterações';
    }
  });

  const confirmarSaida = async () => {
    const confirmado = await showConfirm('Deseja sair da sua conta agora?', 'Sair da Urfilig');
    if (confirmado) window.sairDaUrfilig?.();
  };
  document.querySelector('#menu-sair')?.addEventListener('click', confirmarSaida);
  document.querySelector('#nav-logout')?.addEventListener('click', confirmarSaida);
  document.querySelector('#nav-contatos')?.addEventListener('click', () => window.alternarPainelContatos?.());

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

  const painelEmail = document.querySelector('#email-painel');
  const fecharEmail = () => {
    painelEmail?.classList.remove('aberta');
    painelEmail?.setAttribute('aria-hidden', 'true');
  };
  const abrirEmail = () => {
    document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((painel) => painel.classList.remove('aberta'));
    fecharMenu();
    painelEmail?.classList.add('aberta');
    painelEmail?.setAttribute('aria-hidden', 'false');
  };
  document.querySelector('#nav-emails')?.addEventListener('click', (event) => {
    event.preventDefault();
    abrirEmail();
  });
  document.querySelector('#email-fechar')?.addEventListener('click', fecharEmail);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') fecharEmail(); });
  // Fecha painéis laterais ao clicar fora deles; a captura acontece antes de
  // os botões de navegação abrirem outro painel.
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const target = event.target;
    const closeIfOutside = (selector, isOpen, close) => {
      const panel = document.querySelector(selector);
      if (panel && isOpen(panel) && !panel.contains(target)) close(panel);
    };

    closeIfOutside('#menu-lateral', (panel) => panel.classList.contains('visible'), fecharMenu);
    closeIfOutside('#profile-drawer', (panel) => panel.classList.contains('aberta'), fecharPerfil);
    closeIfOutside('#prospeccao-drawer', (panel) => panel.classList.contains('aberta'), (panel) => {
      panel.classList.remove('aberta');
      document.querySelector('#prospeccao-backdrop')?.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
    });
    closeIfOutside('#spotify-drawer', (panel) => panel.classList.contains('aberta'), (panel) => {
      panel.classList.remove('aberta');
      document.querySelector('#spotify-backdrop')?.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
      document.querySelector('#spotify-backdrop')?.setAttribute('aria-hidden', 'true');
    });
    closeIfOutside('#email-painel', (panel) => panel.classList.contains('aberta'), fecharEmail);
    closeIfOutside('#calendario-painel', (panel) => panel.classList.contains('aberta'), (panel) => panel.classList.remove('aberta'));
    closeIfOutside('#cerebro-painel', (panel) => panel.classList.contains('aberta'), (panel) => panel.classList.remove('aberta'));
    closeIfOutside('#contatos-painel', (panel) => panel.classList.contains('aberta'), (panel) => panel.classList.remove('aberta'));
  }, true);
  window.addEventListener('message', (event) => {
    if (event.origin === window.location.origin && event.data?.type === 'urfilig:close-email') fecharEmail();
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
    modalNota.classList.add('urfilig-note-modal');
    modalNota.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px);
      z-index: 9999; display: none; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: inherit;
    `;

    modalNota.innerHTML = `
      <div class="urfilig-note-card" style="background: #171719; backdrop-filter: blur(16px); border: 1px solid #555; border-radius: 12px; width: 100%; max-width: 480px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55); box-sizing: border-box;">
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
      await showAlert('O título não pode ficar vazio.');
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
        await showAlert('O servidor rejeitou esta gravação. Verifique a conexão e tente novamente.');
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

      // Notas sem pasta têm uma rota própria; não fazem parte da resposta de /pastas.
      const respNotasSoltas = await fetch(`${BACKEND_URL}/api/cerebro/notas-soltas?_t=${ts}`, fetchOpts);
      if (respNotasSoltas.ok) {
        const notasSemPasta = await respNotasSoltas.json();
        if (Array.isArray(notasSemPasta)) {
          notasSemPasta.forEach(nota => {
            const realId = nota.id || nota._id;
            if (realId) {
              mapaNotas.set(String(realId), { ...nota, id: realId, pastaId: null });
            }
          });
        }
      }

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
    const confirmado = await confirmarAcao('Excluir Nota', `Tem certeza que deseja excluir a nota "${nota.titulo || nota.label}"?`);
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
  async function moverNotaParaPasta(nota, pastaDestinoDireto) {
    const oldPastaId = nota.pastaId ?? nota.pasta_id ?? nota.folderId ?? null;
    const novaPastaId = pastaDestinoDireto === undefined
      ? await pedirSelecaoPastaModal(pastas, oldPastaId)
      : pastaDestinoDireto;
    if (novaPastaId === undefined) return;

    const targetPastaId = novaPastaId ? String(novaPastaId) : null;

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
        await showAlert('O servidor recusou a alteração de pasta. A nota continua na pasta anterior.');
      }
    } catch (e) {
      console.error('[Cérebro] Falha crítica de rede ou servidor offline:', e);
      await showAlert('Erro de conexão com o servidor. Certifique-se de que o backend está online.');
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
    const confirmado = await confirmarAcao('Excluir Pasta', `Tem certeza que deseja excluir a pasta "${pasta.nome}" e todas as suas notas?`);
    if (confirmado) {
      await fetch(`${BACKEND_URL}/api/cerebro/pastas/${pasta.id}`, { method: 'DELETE', headers: cabecalhoAuth() });
      carregarPastasDoBackend(true);
    }
  }

  function criarNotaTextoPuroUI(nota) {
    const div = document.createElement('div');
    div.draggable = !String(nota.id).startsWith('hobby-');
    div.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', String(nota.id));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
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

      pastaHeader.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        pastaHeader.classList.add('pasta-destino-arrasto');
      });
      pastaHeader.addEventListener('dragleave', () => pastaHeader.classList.remove('pasta-destino-arrasto'));
      pastaHeader.addEventListener('drop', async (event) => {
        event.preventDefault();
        pastaHeader.classList.remove('pasta-destino-arrasto');
        const notaId = event.dataTransfer?.getData('text/plain');
        const notaArrastada = [...notasSoltas, ...pastas.flatMap((item) => item.notas || [])]
          .find((item) => String(item.id) === String(notaId));
        if (notaArrastada) await moverNotaParaPasta(notaArrastada, String(pasta.id));
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
