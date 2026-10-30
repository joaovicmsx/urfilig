import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();
router.get('/llm-status', async (_req, res) => {
  const provider = process.env.LLM_PROVIDER || 'gemini';
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  let geminiEstado = gemini ? 'chave configurada; validação ocorre na primeira chamada' : 'configure uma chave da Gemini API';
  const ollamaBase = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  let ollamaServidor = false;
  let ollama = false;
  let ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1';
  let modelosInstalados = [];
  try {
    const response = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(1600) });
    if (response.ok) {
      ollamaServidor = true;
      const data = await response.json();
      modelosInstalados = Array.isArray(data.models) ? data.models.map((item) => item.name).filter(Boolean) : [];
      const modeloConfiguradoInstalado = modelosInstalados.some((item) => item === ollamaModel || item.startsWith(`${ollamaModel}:`));
      ollama = modeloConfiguradoInstalado || modelosInstalados.length > 0;
      if (!modeloConfiguradoInstalado && modelosInstalados.length) ollamaModel = modelosInstalados[0];
    }
  } catch { /* Ollama é opcional; o status não deve derrubar a tela. */ }
  res.json({ provider, gemini, geminiEstado, ollamaServidor, ollama, ollamaModel, modelosInstalados });
});
const getUsuarioId = (req) => req.usuarioId || req.userId || req.user?.id;
const inicioDoDia = (data = new Date()) => {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
};
const dataCurta = (data) => new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dataSolicitada = (valor) => {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return inicioDoDia();
  const [ano, mes, dia] = valor.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};
let cacheTendencias = { atualizadoEm: 0, dados: null };
const decodificarXml = (valor = '') => valor
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
async function lerTendenciasGoogle(geo, pais) {
  const resposta = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, {
    signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Urfilig/1.0 (live-trends)' },
  });
  if (!resposta.ok) throw new Error(`Google Trends respondeu ${resposta.status}`);
  const xml = await resposta.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, item]) => {
    const campo = (nome) => decodificarXml(item.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)<\\/${nome}>`, 'i'))?.[1]?.trim() || '');
    const topico = campo('title');
    const noticias = [...item.matchAll(/<ht:news_item(?:\s[^>]*)?>([\s\S]*?)<\/ht:news_item>/gi)].map(([, bloco]) => {
      const detalhe = (nome) => decodificarXml(bloco.match(new RegExp(`<ht:${nome}[^>]*>([\\s\\S]*?)<\\/ht:${nome}>`, 'i'))?.[1]?.trim() || '');
      return { titulo: detalhe('news_item_title'), url: detalhe('news_item_url'), fonte: detalhe('news_item_source'), imagem: detalhe('news_item_picture') };
    }).filter((noticia) => noticia.titulo || noticia.url);
    return topico ? { topico, buscas: campo('ht:approx_traffic'), publicadoEm: campo('pubDate'), pais, noticias } : null;
  }).filter(Boolean).slice(0, 8);
}

router.get('/metricas', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const inicioHoje = inicioDoDia();
    const inicioSemana = inicioDoDia();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const [totalNotas, totalPastas, eventosHoje, eventosSemana, contatos, leads] = await Promise.all([
      prisma.nota.count({ where: { usuarioId } }),
      prisma.pasta.count({ where: { usuarioId } }),
      prisma.evento.count({ where: { usuarioId, dataInicio: { gte: inicioHoje } } }),
      prisma.evento.count({ where: { usuarioId, dataInicio: { gte: inicioSemana } } }),
      prisma.contato.count({ where: { usuarioId } }),
      prisma.lead.count({ where: { usuarioId } }),
    ]);
    res.json({ ok: true, metricas: { totalNotas, totalPastas, eventosHoje, eventosSemana, contatos, leads } });
  } catch (erro) {
    console.error('[Intel] Erro em metricas:', erro);
    res.status(500).json({ erro: 'Erro ao extrair métricas.' });
  }
});

router.get('/resumo-inbox', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const hoje = inicioDoDia();
    const [proximosEventos, notasRecentes, contatosRecentes] = await Promise.all([
      prisma.evento.findMany({ where: { usuarioId, dataInicio: { gte: hoje } }, take: 5, orderBy: { dataInicio: 'asc' } }),
      prisma.nota.findMany({ where: { usuarioId }, take: 5, orderBy: { dataCriacao: 'desc' } }),
      prisma.contato.findMany({ where: { usuarioId }, take: 5, orderBy: { updatedAt: 'desc' }, select: { id: true, nome: true, status: true, updatedAt: true } }),
    ]);
    res.json({ ok: true, resumo: {
      data: new Date().toLocaleDateString('pt-BR'),
      proximosEventos: proximosEventos.map(({ id, titulo, dataInicio }) => ({ id, titulo, horario: dataInicio, horarioTexto: dataCurta(dataInicio) })),
      notasRecentes: notasRecentes.map(({ id, titulo, dataCriacao }) => ({ id, titulo, data: dataCriacao, dataTexto: dataCurta(dataCriacao) })),
      contatosRecentes,
    } });
  } catch (erro) {
    console.error('[Intel] Erro em resumo-inbox:', erro);
    res.status(500).json({ erro: 'Erro ao gerar resumo.' });
  }
});

router.get('/tendencias', async (req, res) => {
  if (cacheTendencias.dados && Date.now() - cacheTendencias.atualizadoEm < 5 * 60 * 1000) {
    return res.json({ ok: true, fonte: 'Google Trends', atualizadoEm: cacheTendencias.atualizadoEm, tendencias: cacheTendencias.dados });
  }
  try {
    const regioes = [['BR', 'Brasil'], ['US', 'Estados Unidos'], ['GB', 'Reino Unido'], ['IN', 'Índia'], ['JP', 'Japão']];
    const resultados = await Promise.allSettled(regioes.map(([geo, pais]) => lerTendenciasGoogle(geo, pais)));
    const tendencias = resultados.flatMap((resultado) => resultado.status === 'fulfilled' ? resultado.value : []);
    const porTopico = new Map();
    tendencias.forEach((item) => {
      const chave = item.topico.toLocaleLowerCase('pt-BR');
      const existente = porTopico.get(chave);
      if (existente) existente.pais += `, ${item.pais}`;
      else porTopico.set(chave, item);
    });
    const unicas = [...porTopico.values()];
    if (!unicas.length) throw new Error('Google Trends indisponível no momento.');
    cacheTendencias = { atualizadoEm: Date.now(), dados: unicas };
    res.json({ ok: true, fonte: 'Google Trends', atualizadoEm: cacheTendencias.atualizadoEm, tendencias: unicas });
  } catch (erro) {
    console.error('[Intel] Erro em tendencias:', erro);
    res.status(503).json({ erro: 'Não foi possível atualizar as tendências da internet agora.' });
  }
});

router.get('/plano-hoje', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const inicioHoje = dataSolicitada(req.query.data);
    const fimHoje = new Date(inicioHoje);
    fimHoje.setDate(fimHoje.getDate() + 1);
    const fimDoDia = fimHoje;
    const [compromissosHoje, tarefas, notasRecentes] = await Promise.all([
      prisma.evento.findMany({ where: { usuarioId, dataInicio: { gte: inicioHoje, lt: fimHoje } }, orderBy: { dataInicio: 'asc' } }),
      prisma.agendaItem.findMany({ where: { usuarioId, data: { gte: inicioHoje, lt: fimDoDia } }, orderBy: [{ concluido: 'asc' }, { horario: 'asc' }] }),
      prisma.nota.findMany({ where: { usuarioId, dataCriacao: { gte: inicioHoje, lt: fimDoDia } }, orderBy: { dataCriacao: 'desc' }, select: { id: true, titulo: true, dataCriacao: true } }),
    ]);
    res.json({ ok: true, plano: { data: inicioHoje.toISOString().slice(0, 10), dataTexto: inicioHoje.toLocaleDateString('pt-BR', { dateStyle: 'full' }), hoje: inicioDoDia().getTime() === inicioHoje.getTime(), compromissosHoje, tarefas, tarefasConcluidas: tarefas.filter((item) => item.concluido).length, notasRecentes } });
  } catch (erro) {
    console.error('[Intel] Erro em plano-hoje:', erro);
    res.status(500).json({ erro: 'Erro ao carregar os dados de hoje.' });
  }
});

router.get('/revisao-semanal', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const fimPeriodo = new Date();
    const inicioPeriodo = inicioDoDia(new Date(fimPeriodo.getTime() - 6 * 24 * 60 * 60 * 1000));
    const proximosDias = new Date(inicioDoDia());
    proximosDias.setDate(proximosDias.getDate() + 7);
    const [notasCriadas, eventosAgendados, novosContatos, tarefasFeitas, tarefasCriadas, tarefas, alertasCompromissos] = await Promise.all([
      prisma.nota.count({ where: { usuarioId, dataCriacao: { gte: inicioPeriodo, lte: fimPeriodo } } }),
      prisma.evento.count({ where: { usuarioId, dataInicio: { gte: inicioPeriodo, lte: fimPeriodo } } }),
      prisma.contato.count({ where: { usuarioId, createdAt: { gte: inicioPeriodo, lte: fimPeriodo } } }),
      prisma.agendaItem.count({ where: { usuarioId, data: { gte: inicioPeriodo, lte: fimPeriodo }, concluido: true } }),
      prisma.agendaItem.count({ where: { usuarioId, createdAt: { gte: inicioPeriodo, lte: fimPeriodo } } }),
      prisma.agendaItem.findMany({ where: { usuarioId, data: { gte: inicioPeriodo, lte: fimPeriodo } }, orderBy: [{ data: 'desc' }, { horario: 'asc' }], take: 12, select: { titulo: true, horario: true, data: true, concluido: true } }),
      prisma.evento.findMany({ where: { usuarioId, dataInicio: { gte: new Date(), lt: proximosDias } }, orderBy: { dataInicio: 'asc' }, take: 8, select: { titulo: true, dataInicio: true } }),
    ]);
    res.json({ ok: true, revisao: { dataAtual: new Date().toISOString(), inicioPeriodo: inicioPeriodo.toISOString(), fimPeriodo: fimPeriodo.toISOString(), periodo: 'Últimos 7 dias', tarefasFeitas, tarefasCriadas, tarefas, notasCriadas, eventosAgendados, novosContatos, alertasCompromissos } });
  } catch (erro) {
    console.error('[Intel] Erro em revisao-semanal:', erro);
    res.status(500).json({ erro: 'Erro ao gerar revisão semanal.' });
  }
});

router.get('/insights', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const inicioHoje = inicioDoDia();
    const [totalNotas, totalPastas, eventosHoje, eventosProximos, leadsAguardando] = await Promise.all([
      prisma.nota.count({ where: { usuarioId } }),
      prisma.pasta.count({ where: { usuarioId } }),
      prisma.evento.count({ where: { usuarioId, dataInicio: { gte: inicioHoje } } }),
      prisma.evento.findMany({ where: { usuarioId, dataInicio: { gte: inicioHoje } }, take: 3, orderBy: { dataInicio: 'asc' }, select: { titulo: true, dataInicio: true } }),
      prisma.lead.count({ where: { usuarioId, statusFunil: 'AGUARDANDO_APROVACAO' } }),
    ]);
    const insights = [];
    if (!totalNotas) insights.push({ tipo: 'dados', mensagem: 'Ainda não há notas registradas para analisar tendências.' });
    if (!eventosHoje) insights.push({ tipo: 'agenda', mensagem: 'Não há eventos agendados para hoje.' });
    else insights.push({ tipo: 'agenda', mensagem: `Há ${eventosHoje} evento(s) registrado(s) para hoje.` });
    if (totalNotas && !totalPastas) insights.push({ tipo: 'organizacao', mensagem: 'Há notas registradas e nenhuma pasta criada.' });
    if (leadsAguardando) insights.push({ tipo: 'leads', mensagem: `${leadsAguardando} lead(s) aguardam aprovação no CRM.` });
    res.json({ ok: true, insights, proximosEventos: eventosProximos });
  } catch (erro) {
    console.error('[Intel] Erro em insights:', erro);
    res.status(500).json({ erro: 'Erro ao carregar insights.' });
  }
});

export default router;
