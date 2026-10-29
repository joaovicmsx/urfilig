import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();
const getUsuarioId = (req) => req.usuarioId || req.userId || req.user?.id;
const inicioDoDia = (data = new Date()) => {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
};
const dataCurta = (data) => new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

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
  const usuarioId = getUsuarioId(req);
  try {
    const notas = await prisma.nota.findMany({ where: { usuarioId }, select: { titulo: true, conteudo: true } });
    const contagemPalavras = new Map();
    const ignorar = new Set(['para', 'como', 'mais', 'muito', 'sobre', 'entre', 'quando', 'onde', 'porque', 'isso', 'esta', 'esse', 'essa', 'com', 'sem', 'uma', 'uns', 'umas', 'dos', 'das', 'que', 'por', 'não', 'nos', 'nas', 'pelo', 'pela', 'ser', 'ter', 'sua', 'seu']);
    notas.forEach(({ titulo, conteudo }) => {
      const unicasDaNota = new Set((`${titulo} ${conteudo || ''}`.toLocaleLowerCase('pt-BR').match(/[a-zà-ú]{4,}/gi) || []));
      unicasDaNota.forEach((palavra) => { if (!ignorar.has(palavra)) contagemPalavras.set(palavra, (contagemPalavras.get(palavra) || 0) + 1); });
    });
    const tendencias = [...contagemPalavras.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([topico, relevancia]) => ({ topico, relevancia }));
    res.json({ ok: true, totalNotasAnalisadas: notas.length, tendencias });
  } catch (erro) {
    console.error('[Intel] Erro em tendencias:', erro);
    res.status(500).json({ erro: 'Erro ao analisar as notas.' });
  }
});

router.get('/plano-hoje', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const inicioHoje = inicioDoDia();
    const fimHoje = new Date(inicioHoje);
    fimHoje.setDate(fimHoje.getDate() + 1);
    const [compromissosHoje, notasRecentes] = await Promise.all([
      prisma.evento.findMany({ where: { usuarioId, dataInicio: { gte: inicioHoje, lt: fimHoje } }, orderBy: { dataInicio: 'asc' } }),
      prisma.nota.findMany({ where: { usuarioId }, take: 5, orderBy: { dataCriacao: 'desc' }, select: { id: true, titulo: true, dataCriacao: true } }),
    ]);
    res.json({ ok: true, plano: { data: inicioHoje.toLocaleDateString('pt-BR'), compromissosHoje, notasRecentes } });
  } catch (erro) {
    console.error('[Intel] Erro em plano-hoje:', erro);
    res.status(500).json({ erro: 'Erro ao carregar os dados de hoje.' });
  }
});

router.get('/revisao-semanal', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  try {
    const inicioPeriodo = new Date();
    inicioPeriodo.setDate(inicioPeriodo.getDate() - 7);
    const [notasCriadas, eventosAgendados, novosContatos] = await Promise.all([
      prisma.nota.count({ where: { usuarioId, dataCriacao: { gte: inicioPeriodo } } }),
      prisma.evento.count({ where: { usuarioId, dataInicio: { gte: inicioPeriodo } } }),
      prisma.contato.count({ where: { usuarioId, createdAt: { gte: inicioPeriodo } } }),
    ]);
    res.json({ ok: true, revisao: { periodo: 'Últimos 7 dias', notasCriadas, eventosAgendados, novosContatos } });
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
