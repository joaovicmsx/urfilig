import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from './authMiddleware.js';
import { paraRespostaPublica } from './usuarioPublico.js';

export const perfilRouter = Router();

/**
 * POST /api/usuario/onboarding
 * Grava os dados do formulário de onboarding do utilizador autenticado
 */
perfilRouter.post('/usuario/onboarding', exigirAutenticacao, async (req, res) => {
  const { nome, idade, localizacao, profissao, hobbies } = req.body;

  try {
    // Trata hobbies caso venham como array do frontend
    const hobbiesString = Array.isArray(hobbies) ? hobbies.join(', ') : hobbies;

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        ...(nome && { nome }),
        ...(idade && { idade: Number(idade) }),
        ...(localizacao && { localizacao }),
        ...(profissao && { profissao }),
        ...(hobbiesString && { hobbies: hobbiesString }),
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
    console.error('[perfil] Erro ao salvar onboarding:', erro.message);
    return res.status(500).json({ erro: 'Falha ao salvar os dados do onboarding' });
  }
});