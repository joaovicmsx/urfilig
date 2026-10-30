const $ = (selector) => document.querySelector(selector);
const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
};
const items = (value) => Array.isArray(value) ? value : [];
const count = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const localDateValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asDate = (value, options = { dateStyle: 'medium' }) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-BR', options) : '—';
};
const dateInputValue = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return localDateValue();
  return localDateValue(date);
};

export function iniciarPaineisDados({ backendUrl, cabecalhoAuth, fecharMenu }) {
  const modal = $('#intel-modal');
  const titulo = $('#intel-modal-titulo');
  const corpo = $('#intel-modal-corpo');
  const fechar = () => modal?.classList.remove('visible', 'trends-wide');
  $('#intel-modal-fechar')?.addEventListener('click', fechar);
  modal?.addEventListener('click', (event) => { if (event.target === modal) fechar(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') fechar(); });

  const criarSecao = (heading, values, formatter) => {
    const section = node('section', 'intel-simple-section');
    section.append(node('h4', '', heading));
    const list = items(values);
    if (!list.length) {
      section.append(node('p', 'intel-empty', 'Nada registrado neste período.'));
      return section;
    }
    const rows = node('div', 'intel-simple-list');
    list.forEach((item) => {
      const row = node('article', 'intel-simple-row');
      const details = formatter(item);
      row.append(node('strong', '', details.title || 'Sem título'), node('small', '', details.meta || ''));
      rows.append(row);
    });
    section.append(rows);
    return section;
  };

  const carregar = async (route, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${backendUrl}/api/inteligencia/${route}${query ? `?${query}` : ''}`, {
      headers: cabecalhoAuth(), cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.erro || 'Não foi possível carregar estes dados.');
    return payload;
  };

  const abrir = (heading) => {
    fecharMenu();
    if (titulo) titulo.textContent = heading;
    corpo?.replaceChildren(node('p', 'intel-loading', 'Carregando…'));
    modal?.classList.add('visible');
  };
  const exibirErro = (error) => corpo?.replaceChildren(node('p', 'intel-empty', error.message || 'Não foi possível carregar estes dados.'));

  async function contarEmailsDaSemana() {
    const token = localStorage.getItem('google_access_token');
    if (!token) return null;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const googleDate = (date) => `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const before = new Date(end);
    before.setDate(before.getDate() + 1);
    const queryBase = `after:${googleDate(start)} before:${googleDate(before)}`;
    const estimate = async (query) => {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('q', `${queryBase} ${query}`);
      url.searchParams.set('maxResults', '1');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Gmail indisponível');
      const data = await response.json();
      return count(data.resultSizeEstimate);
    };
    try {
      const [sent, received] = await Promise.all([estimate('in:sent'), estimate('-in:sent -in:drafts -in:trash -in:spam')]);
      return { sent, received };
    } catch { return null; }
  }

  async function renderWeekly(payload = {}) {
    const source = payload.revisao || payload;
    const data = {
      dataAtual: source.dataAtual || new Date().toISOString(),
      inicioPeriodo: source.inicioPeriodo || new Date(Date.now() - 6 * 86400000).toISOString(),
      fimPeriodo: source.fimPeriodo || new Date().toISOString(),
      tarefasFeitas: count(source.tarefasFeitas), tarefasCriadas: count(source.tarefasCriadas),
      notasCriadas: count(source.notasCriadas), eventosAgendados: count(source.eventosAgendados),
      tarefas: items(source.tarefas), alertasCompromissos: items(source.alertasCompromissos || source.proximosEventos),
    };
    const emailCounts = await contarEmailsDaSemana();
    const summary = node('p', 'intel-week-period', `Hoje: ${asDate(data.dataAtual)} · últimos 7 dias (${asDate(data.inicioPeriodo)} — ${asDate(data.fimPeriodo)})`);
    const kpis = node('div', 'intel-kpi-grid');
    [
      ['Tarefas concluídas', data.tarefasFeitas], ['Tarefas adicionadas', data.tarefasCriadas],
      ['Notas criadas', data.notasCriadas], ['E-mails enviados', emailCounts?.sent],
      ['E-mails recebidos', emailCounts?.received], ['Compromissos na semana', data.eventosAgendados],
    ].forEach(([label, value]) => {
      const tile = node('article', 'intel-kpi');
      tile.append(node('small', '', label), node('strong', '', value === undefined ? '—' : String(value)));
      kpis.append(tile);
    });
    const parts = [summary, kpis];
    if (!emailCounts) parts.push(node('p', 'intel-week-note', 'Conecte o Gmail para estimar as mensagens enviadas e recebidas.'));
    parts.push(
      criarSecao('Tarefas', data.tarefas, (task) => ({
        title: task.titulo,
        meta: [asDate(task.data, { dateStyle: 'short' }), task.horario, task.concluido ? 'Concluída' : 'Pendente'].filter(Boolean).join(' · '),
      })),
      criarSecao('Alertas de compromissos próximos', data.alertasCompromissos, (event) => ({
        title: event.titulo,
        meta: asDate(event.dataInicio, { dateStyle: 'short', timeStyle: 'short' }),
      })),
    );
    corpo.replaceChildren(...parts);
  }

  function renderPlan(source = {}) {
    const tasks = items(source.tarefas);
    const events = items(source.compromissosHoje);
    const notes = items(source.notasRecentes);
    const day = dateInputValue(source.data);
    const completed = Number.isFinite(Number(source.tarefasConcluidas))
      ? Number(source.tarefasConcluidas) : tasks.filter((task) => task.concluido).length;
    corpo.replaceChildren();

    const heading = node('div', 'intel-plan-header');
    heading.append(node('strong', '', source.dataTexto || new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'full' })));
    const picker = document.createElement('input');
    picker.type = 'date'; picker.value = day; picker.setAttribute('aria-label', 'Escolher dia do plano');
    picker.addEventListener('change', () => atualizarPlano(picker.value));
    heading.append(picker);
    const progress = node('section', 'intel-plan-progress');
    progress.append(node('strong', '', `${completed} de ${tasks.length} tarefas concluídas`));
    const track = node('div', 'intel-progress-track');
    const fill = node('span');
    fill.style.width = `${tasks.length ? Math.min(100, completed / tasks.length * 100) : 0}%`;
    track.append(fill); progress.append(track);

    const taskSection = node('section', 'intel-simple-section intel-plan-tasks');
    taskSection.append(node('h4', '', 'Meu plano'));
    const form = node('form', 'intel-task-form');
    const titleInput = document.createElement('input'); titleInput.name = 'titulo'; titleInput.placeholder = 'Adicionar tarefa'; titleInput.required = true; titleInput.maxLength = 140;
    const timeInput = document.createElement('input'); timeInput.name = 'horario'; timeInput.type = 'time'; timeInput.setAttribute('aria-label', 'Horário');
    const save = node('button', '', 'Adicionar'); save.type = 'submit';
    form.append(titleInput, timeInput, save);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); save.disabled = true;
      try {
        const response = await fetch(`${backendUrl}/api/agenda`, {
          method: 'POST', headers: cabecalhoAuth(),
          body: JSON.stringify({ titulo: titleInput.value.trim(), horario: timeInput.value || undefined, data: `${day}T12:00:00` }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.erro || 'Não foi possível salvar a tarefa.');
        await atualizarPlano(day);
      } catch (error) { exibirErro(error); } finally { save.disabled = false; }
    });
    taskSection.append(form);
    if (!tasks.length) taskSection.append(node('p', 'intel-empty', 'Adicione tarefas para planejar este dia.'));
    tasks.forEach((task) => {
      const row = node('label', `intel-task${task.concluido ? ' concluida' : ''}`);
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.concluido); checkbox.disabled = Boolean(task.concluido);
      checkbox.addEventListener('change', async () => {
        try {
          const response = await fetch(`${backendUrl}/api/agenda/${encodeURIComponent(task.id)}/concluir`, { method: 'POST', headers: cabecalhoAuth() });
          if (!response.ok) throw new Error('Não foi possível concluir a tarefa.');
          await atualizarPlano(day);
        } catch (error) { exibirErro(error); }
      });
      row.append(checkbox, node('span', '', task.titulo), node('small', '', task.horario || ''));
      taskSection.append(row);
    });
    corpo.append(heading, progress, taskSection,
      criarSecao('Compromissos', events, (event) => ({ title: event.titulo, meta: asDate(event.dataInicio, { hour: '2-digit', minute: '2-digit' }) })),
      criarSecao('Notas deste dia', notes, (note) => ({ title: note.titulo, meta: asDate(note.dataCriacao, { hour: '2-digit', minute: '2-digit' }) })),
    );
  }

  async function atualizarPlano(day) {
    try {
      const payload = await carregar('plano-hoje', day ? { data: day } : {});
      if (!payload.plano) throw new Error('O servidor devolveu uma resposta incompatível para o plano. Atualize o backend e tente novamente.');
      renderPlan(payload.plano);
    } catch (error) { exibirErro(error); }
  }

  const videoId = (url = '') => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      const youtubeHost = parsed.hostname === 'youtu.be' || parsed.hostname === 'youtube.com' || parsed.hostname.endsWith('.youtube.com');
      if (!youtubeHost) return null;
      let id = parsed.hostname === 'youtu.be' ? parsed.pathname.slice(1) : parsed.searchParams.get('v');
      if (!id && youtubeHost) id = parsed.pathname.split('/').filter(Boolean).at(-1);
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    } catch { return null; }
  };
  const safeHttpUrl = (value) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  };
  async function renderTrends(payload = {}, focoSelecionado = 'todos') {
    const trends = items(payload.tendencias);
    if (payload.fonte !== 'Google Trends' || !trends.length || !trends.some((trend) => trend.pais)) {
      throw new Error('O backend ainda está servindo tendências antigas das notas. Reinicie ou atualize o servidor para carregar as tendências da internet.');
    }
    const lead = node('div', 'intel-trends-intro');
    lead.append(node('p', '', `Tópicos em alta no Google Trends · Brasil, EUA, Reino Unido, Índia e Japão`));
    const filtros = { tecnologia: /tecnologia|inteligência artificial|software|celular|apple|google|microsoft|jogo|games|internet|app/i, economia: /economia|dólar|bolsa|ações|juros|inflação|banco|pix|investimento|petróleo/i, esportes: /futebol|esporte|jogo|copa|campeonato|nba|f1|formula 1|tenis|olimp/i, entretenimento: /filme|série|musica|música|show|ator|atriz|celebridade|tv|novela/i, saude: /saúde|medicina|doença|vacina|hospital|bem-estar|fitness/i, mundo: /brasil|mundo|governo|presidente|eleição|guerra|país|internacional|clima/i };
    const filtro = document.createElement('select'); filtro.className = 'intel-trend-filter'; filtro.setAttribute('aria-label', 'Filtrar assuntos em alta');
    [['todos','Todos os assuntos'],['tecnologia','Tecnologia'],['economia','Economia'],['esportes','Esportes'],['entretenimento','Entretenimento'],['saude','Saúde'],['mundo','Mundo']].forEach(([value,label]) => { const option=document.createElement('option'); option.value=value; option.textContent=label; filtro.append(option); });
    filtro.value = focoSelecionado; filtro.addEventListener('change', () => renderTrends(payload, filtro.value));
    lead.append(filtro, node('small', '', `Atualizado ${asDate(payload.atualizadoEm, { hour: '2-digit', minute: '2-digit' })}`));
    const grid = node('div', 'intel-trend-grid');
    const trendsFiltradas = focoSelecionado === 'todos' ? trends : trends.filter((trend) => filtros[focoSelecionado]?.test([trend.topico, ...items(trend.noticias).map((news) => news.titulo)].join(' ')));
    const topics = node('section', 'intel-trend-topics');
    topics.append(node('strong', '', 'Assuntos em alta agora'));
    trendsFiltradas.slice(0, 12).forEach((trend) => {
      const topic = node('a', 'intel-trend-topic', trend.topico);
      topic.href = `https://trends.google.com/trends/explore?geo=BR&q=${encodeURIComponent(trend.topico)}`;
      topic.target = '_blank'; topic.rel = 'noopener noreferrer';
      topics.append(topic);
    });
    trendsFiltradas.forEach((trend) => {
      const card = node('article', 'intel-trend-card');
      const news = items(trend.noticias);
      if (safeHttpUrl(news[0]?.imagem)) {
        const image = document.createElement('img'); image.className = 'intel-trend-image'; image.src = safeHttpUrl(news[0].imagem); image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => image.remove(), { once: true }); card.append(image);
      }
      card.append(node('small', 'intel-trend-meta', [trend.pais, trend.buscas && `${trend.buscas} buscas`, trend.publicadoEm && asDate(trend.publicadoEm, { dateStyle: 'short', timeStyle: 'short' })].filter(Boolean).join(' · ')));
      card.append(node('h4', '', trend.topico));
      if (!news.length && trend.noticia) news.push({ titulo: trend.noticia, fonte: trend.fonteNoticia, url: trend.url, imagem: trend.imagem });
      news.slice(0, 3).forEach((story) => {
        const article = node('div', 'intel-news-story');
        if (safeHttpUrl(story.imagem) && story.imagem !== news[0]?.imagem) {
          const image = document.createElement('img'); image.src = safeHttpUrl(story.imagem); image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => image.remove(), { once: true }); article.append(image);
        }
        const text = node('div', 'intel-news-copy');
        text.append(node('strong', '', story.titulo || 'Notícia relacionada'), node('small', '', story.fonte || 'Fonte da notícia'));
        const youtube = videoId(story.url);
        if (youtube) {
          const frame = document.createElement('iframe'); frame.className = 'intel-news-video'; frame.src = `https://www.youtube-nocookie.com/embed/${youtube}`; frame.title = `Vídeo relacionado: ${trend.topico}`; frame.loading = 'lazy'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.allowFullscreen = true; article.append(frame);
        }
        const articleUrl = safeHttpUrl(story.url);
        if (articleUrl) { const link = node('a', 'intel-news-link', 'Ler notícia'); link.href = articleUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; text.append(link); }
        article.append(text); card.append(article);
      });
      const trendLink = node('a', 'intel-news-link', 'Mais notícias e vídeos sobre o tema');
      trendLink.href = `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(trend.topico)}`; trendLink.target = '_blank'; trendLink.rel = 'noopener noreferrer'; card.append(trendLink);
      const videoLink = node('a', 'intel-news-link', 'Vídeos relacionados');
      videoLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(trend.topico)}`; videoLink.target = '_blank'; videoLink.rel = 'noopener noreferrer'; card.append(videoLink);
      grid.append(card);
    });
    const source = node('a', 'intel-source-link', 'Abrir Google Trends'); source.href = 'https://trends.google.com/trending?geo=BR'; source.target = '_blank'; source.rel = 'noopener noreferrer';
    if (!trendsFiltradas.length) grid.append(node('p', 'intel-trend-empty', 'Nenhum assunto dessa categoria está entre as tendências atuais. Escolha outro tema para ver o que está em alta agora.'));
    corpo.replaceChildren(lead, topics, grid, source);
  }

  const reports = {
    'btn-tendencias': { title: 'Notícias em alta', route: 'tendencias', render: renderTrends },
    'btn-plano-hoje': { title: 'Plano de hoje', route: 'plano-hoje', render: (payload) => renderPlan(payload.plano) },
    'btn-revisao-semanal': { title: 'Resumo semanal', route: 'revisao-semanal', render: renderWeekly },
  };
  Object.entries(reports).forEach(([id, report]) => {
    $(`#${id}`)?.addEventListener('click', async () => {
      abrir(report.title);
      modal?.classList.toggle('trends-wide', report.route === 'tendencias');
      try { await report.render(await carregar(report.route)); } catch (error) { exibirErro(error); }
    });
  });

  return { fechar };
}
