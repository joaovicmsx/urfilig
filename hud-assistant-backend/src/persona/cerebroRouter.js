import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const cerebroRouter = Router();
cerebroRouter.use(exigirAutenticacao);

const parseId = (id) => {
  if (id === null || id === undefined) return id;
  const num = Number(id);
  return Number.isNaN(num) ? id : num;
};

// ---------- NOTAS SOLTAS (Sem Pasta) ----------
cerebroRouter.get('/notas-soltas', async (req, res) => {
  try {
    const usuarioId = parseId(req.usuarioId);
    if (!usuarioId) {
      return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    // Tentativa principal com ordenação
    let notas;
    try {
      notas = await prisma.nota.findMany({
        where: {
          usuarioId,
          pastaId: null,
        },
        orderBy: [
          { importante: 'desc' },
          { ordem: 'asc' },
        ],
      });
    } catch (ordemErr) {
      // Fallback caso as colunas 'importante' ou 'ordem' não existam no banco
      console.warn('[Cérebro] Fallback na ordenação de notas soltas:', ordemErr.message);
      notas = await prisma.nota.findMany({
        where: {
          usuarioId,
          pastaId: null,
        },
      });
    }

    return res.json(notas || []);
  } catch (erro) {
    console.error('[Cérebro] Erro ao buscar notas soltas:', erro);
    return res.json([]); // Retorna array vazio em vez de estourar Erro 500
  }
});

// ---------- PASTAS ----------
cerebroRouter.get('/pastas', async (req, res) => {
  try {
    const usuarioId = parseId(req.usuarioId);
    if (!usuarioId) {
      return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    let pastas;
    try {
      pastas = await prisma.pasta.findMany({
        where: { usuarioId },
        include: {
          notas: {
            orderBy: [
              { importante: 'desc' },
              { ordem: 'asc' },
            ],
          },
        },
      });
    } catch (ordemErr) {
      console.warn('[Cérebro] Fallback na ordenação de pastas/notas:', ordemErr.message);
      pastas = await prisma.pasta.findMany({
        where: { usuarioId },
        include: {
          notas: true,
        },
      });
    }

    return res.json(pastas || []);
  } catch (erro) {
    console.error('[Cérebro] Erro ao buscar pastas:', erro);
    return res.json([]);
  }
});

cerebroRouter.post('/pastas', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ erro: 'Campo "nome" é obrigatório' });
    }

    const pasta = await prisma.pasta.create({
      data: { usuarioId: parseId(req.usuarioId), nome },
    });
    return res.status(201).json(pasta);
  } catch (erro) {
    console.error('[Cérebro] Erro ao criar pasta:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

cerebroRouter.put('/pastas/:id', async (req, res) => {
  try {
    const { nome } = req.body;
    const id = parseId(req.params.id);

    const resultado = await prisma.pasta.updateMany({
      where: { id, usuarioId: parseId(req.usuarioId) },
      data: { ...(nome && { nome }) },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Pasta não encontrada' });
    }

    const atualizada = await prisma.pasta.findFirst({ where: { id } });
    return res.json(atualizada);
  } catch (erro) {
    console.error('[Cérebro] Erro ao atualizar pasta:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

cerebroRouter.delete('/pastas/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const resultado = await prisma.pasta.deleteMany({
      where: { id, usuarioId: parseId(req.usuarioId) },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Pasta não encontrada' });
    }
    return res.json({ ok: true });
  } catch (erro) {
    console.error('[Cérebro] Erro ao deletar pasta:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

// ---------- NOTAS ----------

cerebroRouter.post('/notas', async (req, res) => {
  try {
    const { titulo, conteudo, pastaId } = req.body;

    if (!titulo) {
      return res.status(400).json({ erro: 'Campo "titulo" é obrigatório' });
    }

    const usuarioIdParsed = parseId(req.usuarioId);
    let pastaIdParsed = null;

    if (pastaId !== undefined && pastaId !== null && pastaId !== '') {
      pastaIdParsed = parseId(pastaId);
    }

    let totalNotas = 0;
    try {
      totalNotas = await prisma.nota.count({
        where: {
          usuarioId: usuarioIdParsed,
          pastaId: pastaIdParsed,
        },
      });
    } catch (e) {}

    const nota = await prisma.nota.create({
      data: {
        usuarioId: usuarioIdParsed,
        pastaId: pastaIdParsed,
        titulo,
        conteudo: conteudo || '',
        ordem: totalNotas,
      },
    });

    return res.status(201).json(nota);
  } catch (erro) {
    console.error('[Cérebro] Erro ao criar nota genérica:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

cerebroRouter.get('/pastas/:pastaId/notas', async (req, res) => {
  try {
    const pastaId = parseId(req.params.pastaId);
    const usuarioId = parseId(req.usuarioId);

    let notas;
    try {
      notas = await prisma.nota.findMany({
        where: { pastaId, usuarioId },
        orderBy: [
          { importante: 'desc' },
          { ordem: 'asc' },
        ],
      });
    } catch (e) {
      notas = await prisma.nota.findMany({
        where: { pastaId, usuarioId },
      });
    }

    return res.json(notas || []);
  } catch (erro) {
    console.error('[Cérebro] Erro ao buscar notas:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

cerebroRouter.post('/pastas/:pastaId/notas', async (req, res) => {
  try {
    const { titulo, conteudo } = req.body;
    if (!titulo || !conteudo) {
      return res.status(400).json({ erro: 'Campos "titulo" e "conteudo" são obrigatórios' });
    }

    const pastaIdParsed = parseId(req.params.pastaId);
    const usuarioIdParsed = parseId(req.usuarioId);

    let totalNotas = 0;
    try {
      totalNotas = await prisma.nota.count({
        where: { pastaId: pastaIdParsed, usuarioId: usuarioIdParsed },
      });
    } catch (e) {}

    const nota = await prisma.nota.create({
      data: {
        usuarioId: usuarioIdParsed,
        pastaId: pastaIdParsed,
        titulo,
        conteudo,
        ordem: totalNotas,
      },
    });
    return res.status(201).json(nota);
  } catch (erro) {
    console.error('[Cérebro] Erro ao criar nota na pasta:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

cerebroRouter.put('/notas/:id', async (req, res) => {
  try {
    const { titulo, conteudo, importante, ordem, pastaId } = req.body;
    const id = parseId(req.params.id);

    let pastaIdTratado = undefined;
    if (pastaId !== undefined) {
      pastaIdTratado = pastaId === null ? null : parseId(pastaId);
    }

    const resultado = await prisma.nota.updateMany({
      where: { id, usuarioId: parseId(req.usuarioId) },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(conteudo !== undefined && { conteudo }),
        ...(importante !== undefined && { importante }),
        ...(ordem !== undefined && { ordem }),
        ...(pastaId !== undefined && { pastaId: pastaIdTratado }),
      },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Nota não encontrada' });
    }

    const atualizada = await prisma.nota.findFirst({ where: { id } });
    return res.json(atualizada);
  } catch (erro) {
    console.error('[Cérebro] Erro ao atualizar nota:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

cerebroRouter.delete('/notas/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const resultado = await prisma.nota.deleteMany({
      where: { id, usuarioId: parseId(req.usuarioId) },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Nota não encontrada' });
    }
    return res.json({ ok: true });
  } catch (erro) {
    console.error('[Cérebro] Erro ao deletar nota:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});