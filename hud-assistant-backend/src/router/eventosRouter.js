import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

const prisma = new PrismaClient();
export const eventosRouter = Router();

eventosRouter.use(exigirAutenticacao);

// Listar todos os eventos do usuário
eventosRouter.get('/eventos', async (req, res) => {
  // ATENÇÃO: Confirme se o seu middleware usa req.usuarioId, req.userId ou req.user.id
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);

  try {
    const eventos = await prisma.evento.findMany({
      where: { usuarioId },
      orderBy: { dataInicio: 'asc' },
    });
    res.json(eventos);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar eventos.', detalhe: erro.message });
  }
});

// Criar evento
eventosRouter.post('/eventos', async (req, res) => {
  // Agora recebemos o dataFim também
  const { titulo, descricao, dataInicio, dataFim, cor } = req.body;
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);

  if (!titulo || !dataInicio) {
    return res.status(400).json({ erro: 'Campos "titulo" e "dataInicio" são obrigatórios.' });
  }

  if (!usuarioId) {
    console.error('[Eventos] ERRO: ID do utilizador não encontrado. Verifique o authMiddleware!');
    return res.status(401).json({ erro: 'Utilizador não autenticado corretamente.' });
  }

  try {
    const novoEvento = await prisma.evento.create({
      data: {
        usuarioId,
        titulo,
        descricao,
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : undefined, // Salva o dataFim se ele existir
        cor: cor || '#3b82f6',
      },
    });
    res.status(201).json(novoEvento);
  } catch (erro) {
    console.error("=== ERRO AO CRIAR EVENTO ===");
    console.error(erro); // Vai imprimir o erro real e completo no terminal do VS Code!
    res.status(500).json({ erro: 'Erro ao criar evento.', detalhe: erro.message });
  }
});

// Editar evento
eventosRouter.put('/eventos/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, dataInicio, dataFim, cor } = req.body;
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);

  try {
    const eventoAtualizado = await prisma.evento.updateMany({
      where: { id, usuarioId },
      data: {
        titulo,
        descricao,
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : undefined,
        cor,
      },
    });

    if (eventoAtualizado.count === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    res.json({ ok: true, mensagem: 'Evento atualizado.' });
  } catch (erro) {
    console.error("=== ERRO AO ATUALIZAR EVENTO ===", erro);
    res.status(500).json({ erro: 'Erro ao atualizar evento.', detalhe: erro.message });
  }
});

// Deletar evento
eventosRouter.delete('/eventos/:id', async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);

  try {
    const deletado = await prisma.evento.deleteMany({
      where: { id, usuarioId },
    });

    if (deletado.count === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    res.json({ ok: true, mensagem: 'Evento deletado.' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar evento.', detalhe: erro.message });
  }
});