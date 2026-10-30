import { BACKEND_URL } from './authGuard.js';

const NICHE_KEY = 'urfilig_prospeccao_nicho';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('urfilig_token')}`,
});
const create = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
};

export function iniciarProspeccao() {
  const drawer = document.querySelector('#prospeccao-drawer');
  const backdrop = document.querySelector('#prospeccao-backdrop');
  const nicheInput = document.querySelector('#prospeccao-nicho');
  const locationLabel = document.querySelector('#prospeccao-localizacao');
  const mapsLink = document.querySelector('#prospeccao-open-maps');
  const leadForm = document.querySelector('#prospeccao-lead-form');
  const status = document.querySelector('#prospeccao-status');
  const leadsContainer = document.querySelector('#prospeccao-leads');
  if (!drawer || !leadForm) return;

  let location = '';
  const close = () => {
    drawer.classList.remove('aberta');
    backdrop.classList.remove('visible');
    drawer.setAttribute('aria-hidden', 'true');
  };
  const say = (message) => { if (status) status.textContent = message; };
  const updateMapsLink = () => {
    const niche = nicheInput.value.trim();
    const canSearch = Boolean(niche && location);
    const query = [niche, location].join(' ');
    mapsLink.href = canSearch
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : '#';
    mapsLink.setAttribute('aria-disabled', String(!canSearch));
    mapsLink.tabIndex = canSearch ? 0 : -1;
  };
  updateMapsLink();

  async function api(path, options = {}) {
    const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.erro || 'A operação não foi concluída.');
    return data;
  }

  async function loadProfileLocation() {
    try {
      const data = await api('/api/auth/me', { cache: 'no-store' });
      const user = data.usuario || {};
      localStorage.setItem('urfilig_usuario', JSON.stringify(user));
      location = typeof user.localizacao === 'string' ? user.localizacao.trim() : '';
    } catch {
      let user = {};
      try { user = JSON.parse(localStorage.getItem('urfilig_usuario') || '{}'); } catch { /* usa cidade vazia */ }
      location = typeof user.localizacao === 'string' ? user.localizacao.trim() : '';
    }
    locationLabel.textContent = location || 'Defina cidade e estado no seu perfil';
    updateMapsLink();
  }

  async function loadLeads() {
    leadsContainer.replaceChildren(create('p', 'profile-message', 'Carregando empresas…'));
    try {
      const leads = await api('/api/leads?status=AGUARDANDO_APROVACAO', { cache: 'no-store' });
      leadsContainer.replaceChildren();
      if (!Array.isArray(leads) || !leads.length) {
        leadsContainer.append(create('p', 'profile-message', 'Nenhuma empresa salva ainda.'));
        return;
      }
      for (const lead of leads) {
        const card = create('article', 'prospeccao-lead-card');
        card.append(
          create('h4', '', lead.nome || 'Empresa'),
          create('p', 'prospeccao-lead-meta', [lead.nicho, lead.contato].filter(Boolean).join(' · ')),
          create('p', 'prospeccao-lead-bio', lead.bio || 'Nenhuma observação.'),
        );
        if (lead.pitch) {
          card.append(create('small', '', 'Sugestão de mensagem (rascunho)'), create('p', 'prospeccao-lead-pitch', lead.pitch));
        }
        const approve = create('button', 'profile-cancel', 'Marcar como revisada');
        approve.type = 'button';
        approve.addEventListener('click', async () => {
          approve.disabled = true;
          try {
            await api(`/api/leads/${encodeURIComponent(lead.id)}/aprovar`, { method: 'POST' });
            say('Empresa marcada como revisada. Nenhuma mensagem foi enviada.');
            await loadLeads();
          } catch (error) { say(error.message); approve.disabled = false; }
        });
        card.append(approve);
        leadsContainer.append(card);
      }
    } catch (error) {
      leadsContainer.replaceChildren(create('p', 'profile-message', error.message));
    }
  }

  async function open() {
    document.querySelector('#profile-drawer')?.classList.remove('aberta');
    document.querySelector('#profile-backdrop')?.classList.remove('visible');
    document.querySelectorAll('.sidebar-cerebro.aberta, .sidebar.aberta').forEach((panel) => panel.classList.remove('aberta'));
    document.querySelector('#email-painel')?.classList.remove('aberta');
    document.querySelector('#calendario-painel')?.classList.remove('aberta');
    document.querySelector('#menu-lateral')?.classList.remove('visible', 'aberto', 'active');
    document.querySelector('#menu-backdrop')?.classList.remove('visible', 'aberto');
    drawer.classList.add('aberta');
    backdrop.classList.add('visible');
    drawer.setAttribute('aria-hidden', 'false');
    nicheInput.value = localStorage.getItem(NICHE_KEY) || '';
    say('');
    await loadProfileLocation();
    await loadLeads();
    document.querySelector('#prospeccao-back')?.focus();
  }

  document.querySelector('#nav-prospeccao')?.addEventListener('click', open);
  document.querySelector('#prospeccao-back')?.addEventListener('click', close);
  document.querySelector('#prospeccao-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.querySelector('#menu-toggle')?.addEventListener('click', close, { capture: true });
  document.querySelectorAll('.hud-nav .nav-item:not(#nav-prospeccao)').forEach((item) => item.addEventListener('click', close, { capture: true }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  nicheInput.addEventListener('input', () => {
    localStorage.setItem(NICHE_KEY, nicheInput.value.trim());
    updateMapsLink();
  });
  mapsLink.addEventListener('click', (event) => {
    if (!nicheInput.value.trim()) {
      event.preventDefault();
      say('Digite o tipo de empresa que procura.');
    } else if (!location) {
      event.preventDefault();
      say('Defina cidade e estado no perfil para pesquisar nessa localização.');
    }
  });
  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const saveButton = document.querySelector('#prospeccao-save-lead');
    const nome = document.querySelector('#prospeccao-lead-name').value.trim();
    const contato = document.querySelector('#prospeccao-lead-contact').value.trim();
    const bio = document.querySelector('#prospeccao-lead-bio').value.trim();
    const nicho = nicheInput.value.trim();
    if (!nicho) { say('Digite o tipo de empresa antes de salvar.'); return; }
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando…';
    try {
      const lead = await api('/api/leads/novo', { method: 'POST', body: JSON.stringify({ nome, contato, nicho, bio }) });
      leadForm.reset();
      localStorage.setItem(NICHE_KEY, nicho);
      say(lead.pitch
        ? 'Empresa salva. A sugestão de mensagem está pronta para revisar.'
        : 'Empresa salva. Não foi possível gerar uma sugestão de mensagem agora.');
      await loadLeads();
    } catch (error) { say(error.message); }
    finally { saveButton.disabled = false; saveButton.textContent = 'Salvar'; }
  });
}
