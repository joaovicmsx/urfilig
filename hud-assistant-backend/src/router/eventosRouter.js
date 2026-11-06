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
    console.error('[Eventos] falha ao buscar eventos:', erro?.code || erro?.name || 'erro interno');
    res.status(500).json({ erro: 'Não foi possível buscar eventos.' });
  }
});

// Criar evento
eventosRouter.post('/eventos', async (req, res) => {
  const { titulo, descricao, dataInicio, dataFim, cor, etiqueta } = req.body || {};
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);

  if (!titulo || !dataInicio) {
    return res.status(400).json({ erro: 'Campos "titulo" e "dataInicio" são obrigatórios.' });
  }
  if (typeof titulo !== 'string' || titulo.trim().length > 160 || (descricao != null && (typeof descricao !== 'string' || descricao.length > 4000))) {
    return res.status(400).json({ erro: 'Título ou descrição fora do limite permitido.' });
  }
  if (typeof dataInicio !== 'string' || Number.isNaN(Date.parse(dataInicio)) || (dataFim && (typeof dataFim !== 'string' || Number.isNaN(Date.parse(dataFim))))) return res.status(400).json({ erro: 'Informe datas válidas.' });
  if (cor != null && (typeof cor !== 'string' || !/^#[\da-f]{6}$/i.test(cor))) return res.status(400).json({ erro: 'Informe uma cor válida.' });
  if (etiqueta != null && (typeof etiqueta !== 'string' || etiqueta.trim().length > 32)) return res.status(400).json({ erro: 'A etiqueta deve ter até 32 caracteres.' });

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
        etiqueta: typeof etiqueta === 'string' && etiqueta.trim() ? etiqueta.trim().slice(0, 32) : null,
      },
    });
    res.status(201).json(novoEvento);
  } catch (erro) {
    console.error('[Eventos] falha ao criar evento:', erro?.code || erro?.name || 'erro interno');
    res.status(500).json({ erro: 'Não foi possível criar o evento.' });
  }
});

// Editar evento
eventosRouter.put('/eventos/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, dataInicio, dataFim, cor, etiqueta } = req.body || {};
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);

  if (typeof id !== 'string' || id.length > 64 || (titulo !== undefined && (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 160)) || (descricao !== undefined && descricao !== null && (typeof descricao !== 'string' || descricao.length > 4000))) return res.status(400).json({ erro: 'Dados do evento inválidos.' });
  if (dataInicio !== undefined && (typeof dataInicio !== 'string' || Number.isNaN(Date.parse(dataInicio)))) return res.status(400).json({ erro: 'Informe uma data válida.' });
  if (dataFim !== undefined && dataFim !== null && (typeof dataFim !== 'string' || Number.isNaN(Date.parse(dataFim)))) return res.status(400).json({ erro: 'Informe uma data final válida.' });
  if (cor !== undefined && cor !== null && (typeof cor !== 'string' || !/^#[\da-f]{6}$/i.test(cor))) return res.status(400).json({ erro: 'Informe uma cor válida.' });
  if (etiqueta !== undefined && etiqueta !== null && (typeof etiqueta !== 'string' || etiqueta.trim().length > 32)) return res.status(400).json({ erro: 'A etiqueta deve ter até 32 caracteres.' });

  try {
    const data = {
      ...(titulo !== undefined && { titulo: titulo.trim() }),
      ...(descricao !== undefined && { descricao }),
      ...(dataInicio !== undefined && { dataInicio: new Date(dataInicio) }),
      ...(dataFim !== undefined && { dataFim: dataFim ? new Date(dataFim) : null }),
      ...(cor !== undefined && { cor }),
      ...(etiqueta !== undefined && { etiqueta: typeof etiqueta === 'string' && etiqueta.trim() ? etiqueta.trim() : null }),
    };
    if (!Object.keys(data).length) return res.status(400).json({ erro: 'Informe ao menos um campo para atualizar.' });

    const eventoAtualizado = await prisma.evento.updateMany({
      where: { id, usuarioId },
      data,
    });

    if (eventoAtualizado.count === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    res.json({ ok: true, mensagem: 'Evento atualizado.' });
  } catch (erro) {
    console.error('[Eventos] falha ao atualizar evento:', erro?.code || erro?.name || 'erro interno');
    res.status(500).json({ erro: 'Não foi possível atualizar o evento.' });
  }
});

// Deletar evento
eventosRouter.delete('/eventos/:id', async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuarioId || req.userId || (req.user && req.user.id);
  if (typeof id !== 'string' || id.length > 64) return res.status(400).json({ erro: 'Identificador de evento inválido.' });

  try {
    const deletado = await prisma.evento.deleteMany({
      where: { id, usuarioId },
    });

    if (deletado.count === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado.' });
    }

    res.json({ ok: true, mensagem: 'Evento deletado.' });
  } catch (erro) {
    console.error('[Eventos] falha ao deletar evento:', erro?.code || erro?.name || 'erro interno');
    res.status(500).json({ erro: 'Não foi possível remover o evento.' });
  }
});
