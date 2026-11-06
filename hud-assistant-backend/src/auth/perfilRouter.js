import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from './authMiddleware.js';
import { paraRespostaPublica } from './usuarioPublico.js';

export const perfilRouter = Router();

perfilRouter.delete('/usuario/conta', exigirAutenticacao, async (req, res) => {
  const emailConfirmado = typeof req.body?.confirmarEmail === 'string'
    ? req.body.confirmarEmail.trim().toLowerCase()
    : '';
  if (!emailConfirmado) {
    return res.status(400).json({ erro: 'Digite o e-mail da conta para confirmar a exclusão.' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: req.usuarioId },
        select: { email: true },
      });
      if (!usuario) {
        const erro = new Error('Conta não encontrada.');
        erro.status = 404;
        throw erro;
      }
      if (usuario.email.trim().toLowerCase() !== emailConfirmado) {
        const erro = new Error('O e-mail informado não corresponde à conta.');
        erro.status = 400;
        throw erro;
      }

      const memorias = await tx.memory.findMany({
        where: { usuarioId: req.usuarioId },
        select: { id: true },
      });
      const memoriaIds = memorias.map(({ id }) => id);
      if (memoriaIds.length) {
        await tx.memoryLink.deleteMany({
          where: { OR: [{ origemId: { in: memoriaIds } }, { destinoId: { in: memoriaIds } }] },
        });
      }
      await tx.usuario.delete({ where: { id: req.usuarioId } });
    });
    return res.json({ mensagem: 'Conta e dados associados excluídos.' });
  } catch (erro) {
    if (erro.status === 400 || erro.status === 404) return res.status(erro.status).json({ erro: erro.message });
    console.error('[perfil] falha ao excluir conta:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Não foi possível excluir a conta agora.' });
  }
});

perfilRouter.patch('/usuario/perfil', exigirAutenticacao, async (req, res) => {
  const { nome, idade, localizacao, profissao, hobbies } = req.body || {};
  if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 1 || nome.trim().length > 80)) {
    return res.status(400).json({ erro: 'Informe um nome válido de até 80 caracteres.' });
  }
  if (idade !== undefined && idade !== null && (!Number.isInteger(Number(idade)) || Number(idade) < 1 || Number(idade) > 120)) {
    return res.status(400).json({ erro: 'A idade deve estar entre 1 e 120 anos.' });
  }
  for (const [label, value, max] of [['localização', localizacao, 100], ['profissão', profissao, 100]]) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > max)) {
      return res.status(400).json({ erro: `O campo ${label} excede o limite de ${max} caracteres.` });
    }
  }
  const hobbiesString = Array.isArray(hobbies) ? hobbies.join(', ') : hobbies;
  if (hobbiesString !== undefined && hobbiesString !== null && (typeof hobbiesString !== 'string' || hobbiesString.length > 600)) {
    return res.status(400).json({ erro: 'Interesses e atividades devem ter até 600 caracteres.' });
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(idade !== undefined && { idade: idade === null ? null : Number(idade) }),
        ...(localizacao !== undefined && { localizacao: localizacao?.trim() || null }),
        ...(profissao !== undefined && { profissao: profissao?.trim() || null }),
        ...(hobbies !== undefined && { hobbies: hobbiesString?.trim() || null }),
      },
    });
    return res.json({ usuario: paraRespostaPublica(usuario) });
  } catch (erro) {
    console.error('[perfil] falha ao atualizar perfil:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Falha ao salvar as alterações do perfil.' });
  }
});

/**
 * POST /api/usuario/onboarding
 * Grava os dados do formulário de onboarding do utilizador autenticado
 */
perfilRouter.post('/usuario/onboarding', exigirAutenticacao, async (req, res) => {
  const { nome, idade, localizacao, profissao, hobbies } = req.body || {};
  if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 1 || nome.trim().length > 80)) return res.status(400).json({ erro: 'Informe um nome válido de até 80 caracteres.' });
  if (idade !== undefined && idade !== null && (!Number.isInteger(Number(idade)) || Number(idade) < 1 || Number(idade) > 120)) return res.status(400).json({ erro: 'A idade deve estar entre 1 e 120 anos.' });
  if (localizacao !== undefined && localizacao !== null && (typeof localizacao !== 'string' || localizacao.length > 100)) return res.status(400).json({ erro: 'A localização deve ter até 100 caracteres.' });
  if (profissao !== undefined && profissao !== null && (typeof profissao !== 'string' || profissao.length > 100)) return res.status(400).json({ erro: 'A profissão deve ter até 100 caracteres.' });
  if (hobbies !== undefined && hobbies !== null && !((typeof hobbies === 'string' && hobbies.length <= 600) || (Array.isArray(hobbies) && hobbies.length <= 30 && hobbies.every((item) => typeof item === 'string' && item.length <= 80)))) return res.status(400).json({ erro: 'Interesses e atividades excedem o limite permitido.' });

  try {
    // Trata hobbies caso venham como array do frontend
    const hobbiesString = Array.isArray(hobbies) ? hobbies.join(', ') : hobbies;

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        ...(nome && { nome: nome.trim() }),
        ...(idade && { idade: Number(idade) }),
        ...(localizacao && { localizacao: localizacao.trim() }),
        ...(profissao && { profissao: profissao.trim() }),
        ...(hobbiesString && { hobbies: hobbiesString.trim() }),
        onboardingConcluido: true, // Libera o acesso ao HUD
      },
    });

    return res.json({
      mensagem: 'Onboarding concluído com sucesso!',
      usuario: typeof paraRespostaPublica === 'function' 
        ? paraRespostaPublica(usuarioAtualizado) 
        : usuarioAtualizado,
    });
  } catch (erro) {
    console.error('[perfil] falha ao salvar onboarding:', erro?.code || erro?.name || 'erro interno');
    return res.status(500).json({ erro: 'Falha ao salvar os dados do onboarding' });
  }
});
