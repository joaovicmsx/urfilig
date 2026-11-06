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

const textoDentroDoLimite = (valor, maximo, obrigatorio = false) =>
  typeof valor === 'string' && valor.length <= maximo && (!obrigatorio || Boolean(valor.trim()));
const logErroCerebro = (contexto, erro) => console.error(`[Cérebro] ${contexto}:`, erro?.code || erro?.name || 'erro interno');

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
      logErroCerebro('fallback ao ordenar notas soltas', ordemErr);
      notas = await prisma.nota.findMany({
        where: {
          usuarioId,
          pastaId: null,
        },
      });
    }

    return res.json(notas || []);
  } catch (erro) {
    logErroCerebro('falha ao buscar notas soltas', erro);
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
      logErroCerebro('fallback ao ordenar pastas/notas', ordemErr);
      pastas = await prisma.pasta.findMany({
        where: { usuarioId },
        include: {
          notas: true,
        },
      });
    }

    return res.json(pastas || []);
  } catch (erro) {
    logErroCerebro('falha ao buscar pastas', erro);
    return res.json([]);
  }
});

cerebroRouter.post('/pastas', async (req, res) => {
  try {
    const { nome } = req.body || {};
    if (!textoDentroDoLimite(nome, 80, true)) {
      return res.status(400).json({ erro: 'Informe um nome de pasta com até 80 caracteres.' });
    }

    const pasta = await prisma.pasta.create({
      data: { usuarioId: parseId(req.usuarioId), nome: nome.trim() },
    });
    return res.status(201).json(pasta);
  } catch (erro) {
    logErroCerebro('falha ao criar pasta', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
  }
});

cerebroRouter.put('/pastas/:id', async (req, res) => {
  try {
    const { nome } = req.body || {};
    const id = parseId(req.params.id);
    if (!textoDentroDoLimite(nome, 80, true)) return res.status(400).json({ erro: 'Informe um nome de pasta com até 80 caracteres.' });

    const resultado = await prisma.pasta.updateMany({
      where: { id, usuarioId: parseId(req.usuarioId) },
      data: { nome: nome.trim() },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Pasta não encontrada' });
    }

    const atualizada = await prisma.pasta.findFirst({ where: { id } });
    return res.json(atualizada);
  } catch (erro) {
    logErroCerebro('falha ao atualizar pasta', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
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
    logErroCerebro('falha ao remover pasta', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
  }
});

// ---------- NOTAS ----------

cerebroRouter.post('/notas', async (req, res) => {
  try {
    const { titulo, conteudo, pastaId } = req.body || {};
    if (!textoDentroDoLimite(titulo, 160, true) || (conteudo !== undefined && !textoDentroDoLimite(conteudo, 20000))) {
      return res.status(400).json({ erro: 'Informe um título válido e conteúdo com até 20.000 caracteres.' });
    }

    const usuarioIdParsed = parseId(req.usuarioId);
    let pastaIdParsed = null;

    if (pastaId !== undefined && pastaId !== null && pastaId !== '') {
      pastaIdParsed = parseId(pastaId);
      const pastaDestino = await prisma.pasta.findFirst({
        where: { id: pastaIdParsed, usuarioId: usuarioIdParsed },
        select: { id: true },
      });
      if (!pastaDestino) return res.status(404).json({ erro: 'Pasta não encontrada.' });
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
        titulo: titulo.trim(),
        conteudo: conteudo || '',
        ordem: totalNotas,
      },
    });

    return res.status(201).json(nota);
  } catch (erro) {
    logErroCerebro('falha ao criar nota', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
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
      logErroCerebro('fallback ao ordenar notas', e);
      notas = await prisma.nota.findMany({
        where: { pastaId, usuarioId },
      });
    }

    return res.json(notas || []);
  } catch (erro) {
    logErroCerebro('falha ao buscar notas', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
  }
});

cerebroRouter.post('/pastas/:pastaId/notas', async (req, res) => {
  try {
    const { titulo, conteudo } = req.body || {};
    if (!textoDentroDoLimite(titulo, 160, true) || !textoDentroDoLimite(conteudo, 20000, true)) {
      return res.status(400).json({ erro: 'Informe um título e conteúdo válidos (até 20.000 caracteres).' });
    }

    const pastaIdParsed = parseId(req.params.pastaId);
    const usuarioIdParsed = parseId(req.usuarioId);
    const pastaDestino = await prisma.pasta.findFirst({
      where: { id: pastaIdParsed, usuarioId: usuarioIdParsed },
      select: { id: true },
    });
    if (!pastaDestino) return res.status(404).json({ erro: 'Pasta não encontrada.' });

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
        titulo: titulo.trim(),
        conteudo,
        ordem: totalNotas,
      },
    });
    return res.status(201).json(nota);
  } catch (erro) {
    logErroCerebro('falha ao criar nota na pasta', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
  }
});

cerebroRouter.put('/notas/:id', async (req, res) => {
  try {
    const { titulo, conteudo, importante, ordem, pastaId } = req.body || {};
    const id = parseId(req.params.id);
    if (titulo !== undefined && !textoDentroDoLimite(titulo, 160, true)) return res.status(400).json({ erro: 'O título deve ter até 160 caracteres.' });
    if (conteudo !== undefined && !textoDentroDoLimite(conteudo, 20000)) return res.status(400).json({ erro: 'O conteúdo deve ter até 20.000 caracteres.' });
    if (importante !== undefined && typeof importante !== 'boolean') return res.status(400).json({ erro: 'O campo de importância deve ser verdadeiro ou falso.' });
    if (ordem !== undefined && (!Number.isInteger(ordem) || ordem < 0 || ordem > 1000000)) return res.status(400).json({ erro: 'A ordem informada é inválida.' });
    if (pastaId !== undefined && pastaId !== null && (typeof pastaId !== 'string' && typeof pastaId !== 'number')) return res.status(400).json({ erro: 'A pasta de destino é inválida.' });

    let pastaIdTratado = undefined;
    if (pastaId !== undefined) {
      pastaIdTratado = pastaId === null ? null : parseId(pastaId);
      if (pastaIdTratado !== null) {
        const pastaDestino = await prisma.pasta.findFirst({ where: { id: pastaIdTratado, usuarioId: parseId(req.usuarioId) }, select: { id: true } });
        if (!pastaDestino) return res.status(400).json({ erro: 'A pasta de destino não foi encontrada.' });
      }
    }

    const resultado = await prisma.nota.updateMany({
      where: { id, usuarioId: parseId(req.usuarioId) },
      data: {
        ...(titulo !== undefined && { titulo: titulo.trim() }),
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
    logErroCerebro('falha ao atualizar nota', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
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
    logErroCerebro('falha ao remover nota', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir esta operação.' });
  }
});
