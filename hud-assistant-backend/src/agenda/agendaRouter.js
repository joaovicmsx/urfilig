import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const agendaRouter = Router();
agendaRouter.use(exigirAutenticacao);
const TIMEZONE_AGENDA = 'America/Sao_Paulo';

// Express 4 não encaminha rejeições de handlers async automaticamente.
// Sem este adaptador, uma falha de conexão do Prisma pode virar unhandled
// rejection e derrubar o processo inteiro do backend.
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function dataLocalComoInstante(dataString, horario = '00:00') {
  const data = String(dataString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const hora = String(horario).match(/^(\d{2}):(\d{2})$/);
  if (!data || !hora) return new Date(NaN);
  const [ano, mes, dia] = data.slice(1).map(Number);
  const [h, min] = hora.slice(1).map(Number);
  const utcAlvo = Date.UTC(ano, mes - 1, dia, h, min);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(utcAlvo)).reduce((obj, item) => ({ ...obj, [item.type]: item.value }), {});
  const representadoComoUtc = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day), Number(partes.hour), Number(partes.minute));
  return new Date(utcAlvo - (representadoComoUtc - utcAlvo));
}

function limitesDoDia(dataString) {
  if (!dataString || !/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    const hoje = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE_AGENDA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).reduce((obj, item) => ({ ...obj, [item.type]: item.value }), {});
    dataString = `${hoje.year}-${hoje.month}-${hoje.day}`;
  }
  const [ano, mes, dia] = dataString.split('-').map(Number);
  const amanha = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10);
  return { inicio: dataLocalComoInstante(dataString), fim: new Date(dataLocalComoInstante(amanha).getTime() - 1) };
}

function dataDoLembrete(dataString, horario) {
  return dataLocalComoInstante(dataString, horario);
}

/** Cria um lembrete e o registra também nas Notas e no Calendário. */
agendaRouter.post('/lembretes', asyncRoute(async (req, res) => {
  const titulo = String(req.body?.titulo || '').trim();
  const horario = String(req.body?.horario || '').trim();
  const data = req.body?.data;
  if (!titulo || !data || !horario) {
    return res.status(400).json({ erro: 'Informe o nome, o dia e o horário do lembrete.' });
  }

  const dataLembrete = dataDoLembrete(data, horario);
  if (Number.isNaN(dataLembrete.getTime())) {
    return res.status(400).json({ erro: 'A data do lembrete é inválida.' });
  }

  const item = await prisma.$transaction(async (tx) => {
    const lembrete = await tx.agendaItem.create({
      data: { usuarioId: req.usuarioId, titulo, horario, data: dataLembrete },
    });
    let pasta = await tx.pasta.findFirst({ where: { usuarioId: req.usuarioId, nome: 'Lembretes' } });
    if (!pasta) pasta = await tx.pasta.create({ data: { usuarioId: req.usuarioId, nome: 'Lembretes' } });
    await tx.nota.create({
      data: {
        usuarioId: req.usuarioId,
        pastaId: pasta.id,
        titulo,
        conteudo: `Lembrete para ${dataLembrete.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`,
      },
    });
    await tx.evento.create({
      data: {
        usuarioId: req.usuarioId,
        titulo,
        descricao: 'Lembrete',
        dataInicio: dataLembrete,
        etiqueta: 'Lembrete',
        cor: '#c58ad8',
      },
    });
    return lembrete;
  });

  res.status(201).json(item);
}));

/**
 * POST /api/agenda  { titulo, horario?, data? }
 */
agendaRouter.post('/agenda', asyncRoute(async (req, res) => {
  const { titulo, horario, data } = req.body;

  if (!titulo) {
    return res.status(400).json({ erro: 'Campo "titulo" é obrigatório' });
  }

  const item = await prisma.agendaItem.create({
    data: {
      usuarioId: req.usuarioId,
      titulo,
      horario: horario || null,
      data: data ? new Date(data) : new Date(),
    },
  });

  res.status(201).json(item);
}));

/**
 * GET /api/agenda?data=2026-09-12  — lista os itens de um dia (padrão: hoje)
 */
agendaRouter.get('/agenda', asyncRoute(async (req, res) => {
  if (req.query.lembretes === '1') {
    const [itens, eventos] = await Promise.all([
      prisma.agendaItem.findMany({ where: { usuarioId: req.usuarioId }, orderBy: [{ data: 'asc' }, { horario: 'asc' }] }),
      prisma.evento.findMany({ where: { usuarioId: req.usuarioId, etiqueta: 'Lembrete' }, select: { titulo: true, dataInicio: true } }),
    ]);
    const chaves = new Set(eventos.map((evento) => `${evento.titulo}|${evento.dataInicio.getTime()}`));
    return res.json(itens.filter((item) => chaves.has(`${item.titulo}|${item.data.getTime()}`)));
  }

  const where = { usuarioId: req.usuarioId };
  if (req.query.todos !== '1') {
    const { inicio, fim } = limitesDoDia(req.query.data);
    where.data = { gte: inicio, lte: fim };
  }

  const itens = await prisma.agendaItem.findMany({
    where,
    orderBy: [{ data: 'asc' }, { horario: 'asc' }],
  });

  res.json(itens);
}));

/**
 * POST /api/agenda/:id/concluir
 */
agendaRouter.post('/agenda/:id/concluir', asyncRoute(async (req, res) => {
  const resultado = await prisma.agendaItem.updateMany({
    where: { id: req.params.id, usuarioId: req.usuarioId },
    data: { concluido: true },
  });

  if (resultado.count === 0) {
    return res.status(404).json({ erro: 'Item não encontrado' });
  }

  res.json({ ok: true });
}));
