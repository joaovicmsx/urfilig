import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const agendaRouter = Router();
agendaRouter.use(exigirAutenticacao);

function limitesDoDia(dataString) {
  const base = dataString ? new Date(dataString) : new Date();
  const inicio = new Date(base);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(base);
  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

/**
 * POST /api/agenda  { titulo, horario?, data? }
 */
agendaRouter.post('/agenda', async (req, res) => {
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
});

/**
 * GET /api/agenda?data=2026-09-12  — lista os itens de um dia (padrão: hoje)
 */
agendaRouter.get('/agenda', async (req, res) => {
  const { inicio, fim } = limitesDoDia(req.query.data);

  const itens = await prisma.agendaItem.findMany({
    where: { usuarioId: req.usuarioId, data: { gte: inicio, lte: fim } },
    orderBy: { horario: 'asc' },
  });

  res.json(itens);
});

/**
 * POST /api/agenda/:id/concluir
 */
agendaRouter.post('/agenda/:id/concluir', async (req, res) => {
  const resultado = await prisma.agendaItem.updateMany({
    where: { id: req.params.id, usuarioId: req.usuarioId },
    data: { concluido: true },
  });

  if (resultado.count === 0) {
    return res.status(404).json({ erro: 'Item não encontrado' });
  }

  res.json({ ok: true });
});
