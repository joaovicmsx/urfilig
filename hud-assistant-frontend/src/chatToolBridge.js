/* Atalhos de navegação do chat. Comandos que criam ou alteram dados ficam
 * no fluxo normal do chat e continuam chegando à API existente. */
const normalizar = (texto = '') => String(texto)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const contem = (texto, padroes) => padroes.some((padrao) => padrao.test(texto));

function visivel(elemento) {
  if (!elemento || elemento.hidden) return false;
  const estilo = getComputedStyle(elemento);
  return estilo.display !== 'none' && estilo.visibility !== 'hidden' && elemento.getClientRects().length > 0;
}

function clicar(seletores) {
  const botao = seletores.map((seletor) => document.querySelector(seletor)).find(Boolean);
  if (!botao || botao.disabled) return false;
  botao.click();
  return true;
}

const ferramentas = [
  { titulo: 'Calendário', match: (t) => contem(t, [/\b(abrir|abre|mostra|mostrar|ver|consultar)\b.*\b(calendario|agenda)\b/, /\b(minha|a)\s+(agenda|calendario)\s+(de )?hoje\b/, /\b(o que|quais compromissos).*(tenho|hoje)\b/]), click: ['#nav-calendario'], aberto: () => visivel(document.querySelector('#calendario-painel.aberta')), resposta: 'Calendário aberto.' },
  { titulo: 'Notas', match: (t) => contem(t, [/\b(abrir|abre|mostra|mostrar|ver|organizar)\b.*\b(notas?|memorias?)\b/, /\bminhas notas\b/]), click: ['#nav-cerebro'], aberto: () => visivel(document.querySelector('#cerebro-painel.aberta')), resposta: 'Notas abertas.' },
  { titulo: 'Lembretes', match: (t) => contem(t, [/\b(abrir|abre|mostra|mostrar|ver|consultar)\b.*\blembretes?\b/, /\bmeus lembretes\b/]), click: ['#btn-lembretes'], aberto: () => { const modal = document.querySelector('#intel-modal'); return visivel(modal) && /lembretes/i.test(document.querySelector('#intel-modal-titulo')?.textContent || ''); }, resposta: 'Lembretes abertos.' },
  { titulo: 'E-mails', match: (t) => contem(t, [/\b(abrir|abre|mostra|mostrar|ver|checar|consultar)\b.*\b(e-?mails?|caixa de entrada)\b/, /\bmeus e-?mails?\b/]), click: ['#nav-emails'], aberto: () => visivel(document.querySelector('#email-painel.aberta')), resposta: 'E-mails abertos.' },
  { titulo: 'Spotify', match: (t) => contem(t, [/\b(abrir|abre|mostra|mostrar|ver)\b.*\bspotify\b/, /\bmeu spotify\b/]), click: ['#nav-spotify'], aberto: () => visivel(document.querySelector('#spotify-drawer.aberta')), resposta: 'Spotify aberto.' },
  { titulo: 'Contatos', match: (t) => contem(t, [/\b(abrir|abre|mostra|mostrar|ver|procurar)\b.*\b(contatos?|pessoas)\b/, /\bmeus contatos\b/]), click: ['#nav-contatos'], aberto: () => visivel(document.querySelector('#contatos-painel.aberta')), resposta: 'Contatos abertos.' },
  { titulo: 'Empresas', match: (t) => contem(t, [/\b(abrir|abre|mostrar|mostra|buscar|procurar)\b.*\b(empresas?|leads?|prospeccao)\b/, /\bminhas empresas\b/]), click: ['#nav-prospeccao'], aberto: () => visivel(document.querySelector('#prospeccao-drawer.aberta')), resposta: 'Empresas abertas.' },
  { titulo: 'Tendências', match: (t) => contem(t, [/\b(tendencias|noticias em alta|o que esta em alta)\b/]), click: ['#btn-tendencias'], aberto: () => { const modal = document.querySelector('#intel-modal'); return visivel(modal) && /noticias em alta/i.test(document.querySelector('#intel-modal-titulo')?.textContent || ''); }, resposta: 'Tendências abertas.' },
  { titulo: 'Plano de hoje', match: (t) => contem(t, [/\b(plano|prioridades|tarefas)\b.*\b(de )?hoje\b/, /\bmeu dia\b/]), click: ['#btn-plano-hoje'], aberto: () => { const modal = document.querySelector('#intel-modal'); return visivel(modal) && /plano de hoje/i.test(document.querySelector('#intel-modal-titulo')?.textContent || ''); }, resposta: 'Plano de hoje aberto.' },
  { titulo: 'Resumo semanal', match: (t) => contem(t, [/\b(resumo|revisao|balanco)\b.*\b(semanal|da semana)\b/]), click: ['#btn-revisao-semanal'], aberto: () => { const modal = document.querySelector('#intel-modal'); return visivel(modal) && /resumo semanal/i.test(document.querySelector('#intel-modal-titulo')?.textContent || ''); }, resposta: 'Resumo semanal aberto.' },
  { titulo: 'Rotinas', match: (t) => contem(t, [/\b(abrir|abre|mostrar|mostra|ver|acompanhar)\b.*\b(rotinas?|habitos?)\b/, /\bminhas rotinas\b/]), click: ['#nav-routines'], aberto: () => visivel(document.querySelector('#routine-sidebar-list')) || visivel(document.querySelector('.routine-modal-backdrop')) || visivel(document.querySelector('#routine-board')), resposta: 'Rotinas abertas.' },
  { titulo: 'Dev Agent', match: (t) => contem(t, [/\b(abrir|abre|mostrar|mostra|ver|ir para)\b.*\b(dev ?agent|agente de (ia|codigo))\b/, /^\s*(dev ?agent)\s*$/]), click: ['#nav-dev-agent', '[data-chat-tool="dev-agent"]', '#dev-agent-open'], aberto: () => visivel(document.querySelector('#dev-agent-drawer.aberta')), resposta: 'Dev Agent aberto.' },
];

const aguardar = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Retorna true quando reconheceu um atalho e tratou a navegação no chat. */
export async function tentarAtalhoFerramentaChat(texto, { adicionarMensagem }) {
  const entrada = normalizar(texto);
  if (!entrada) return false;
  const ferramenta = ferramentas.find((item) => item.match(entrada));
  if (!ferramenta) return false;

  adicionarMensagem('Urfilig', `Abrindo ${ferramenta.titulo}…`);
  if (!ferramenta.aberto()) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!clicar(ferramenta.click)) {
      adicionarMensagem('Urfilig', `Não encontrei o botão para abrir ${ferramenta.titulo}.`);
      return true;
    }
  }

  const limite = Date.now() + 2500;
  while (!ferramenta.aberto() && Date.now() < limite) await aguardar(50);
  if (!ferramenta.aberto()) {
    adicionarMensagem('Urfilig', `Não consegui confirmar a abertura de ${ferramenta.titulo}. Tente novamente.`);
    return true;
  }
  adicionarMensagem('Urfilig', ferramenta.resposta);
  return true;
}
