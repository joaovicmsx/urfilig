import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const contatosRouter = Router();
contatosRouter.use(exigirAutenticacao);

// Listar contatos do utilizador
contatosRouter.get('/', async (req, res) => {
  try {
    const contatos = await prisma.contato.findMany({
      where: { usuarioId: String(req.usuarioId) },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json(contatos);
  } catch (erro) {
    console.error('[Contatos] Erro ao buscar contatos:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

// Criar novo contato
contatosRouter.post('/', async (req, res) => {
  try {
    const { 
      nome, telefone, email, dataContato, 
      status, perfilInvestidor, patrimonioEstimado, objetivoFinanceiro, anotacoes 
    } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'O campo "nome" é obrigatório.' });
    }

    const novoContato = await prisma.contato.create({
      data: {
        usuarioId: String(req.usuarioId),
        nome,
        telefone: telefone || null,
        email: email || null,
        dataContato: dataContato ? new Date(dataContato) : null,
        status: status || 'LEAD',
        perfilInvestidor: perfilInvestidor || 'Não Definido',
        patrimonioEstimado: patrimonioEstimado || null,
        objetivoFinanceiro: objetivoFinanceiro || null,
        anotacoes: anotacoes || null,
      },
    });

    return res.status(201).json(novoContato);
  } catch (erro) {
    console.error('[Contatos] Erro ao criar contato:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

// Atualizar contato existente
contatosRouter.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { 
      nome, telefone, email, dataContato, 
      status, perfilInvestidor, patrimonioEstimado, objetivoFinanceiro, anotacoes 
    } = req.body;

    const resultado = await prisma.contato.updateMany({
      where: { id, usuarioId: String(req.usuarioId) },
      data: {
        ...(nome !== undefined && { nome }),
        ...(telefone !== undefined && { telefone }),
        ...(email !== undefined && { email }),
        ...(dataContato !== undefined && { dataContato: dataContato ? new Date(dataContato) : null }),
        ...(status !== undefined && { status }),
        ...(perfilInvestidor !== undefined && { perfilInvestidor }),
        ...(patrimonioEstimado !== undefined && { patrimonioEstimado }),
        ...(objetivoFinanceiro !== undefined && { objetivoFinanceiro }),
        ...(anotacoes !== undefined && { anotacoes }),
      },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Contato não encontrado.' });
    }

    const atualizado = await prisma.contato.findFirst({ where: { id } });
    return res.json(atualizado);
  } catch (erro) {
    console.error('[Contatos] Erro ao atualizar contato:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});

// Eliminar contato
contatosRouter.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const resultado = await prisma.contato.deleteMany({
      where: { id, usuarioId: String(req.usuarioId) },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Contato não encontrado.' });
    }

    return res.json({ ok: true });
  } catch (erro) {
    console.error('[Contatos] Erro ao deletar contato:', erro);
    return res.status(500).json({ erro: erro.message });
  }
});