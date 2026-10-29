import { Router } from 'express';
import { emitirEstado } from '../socket/index.js';
import { processarComando, gerarApresentacaoInicial } from '../persona/comandoProcessor.js';
import { gerarSaudacaoDiaria } from '../persona/dailyGreeting.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const comandoRouter = Router();

/**
 * POST /api/comando/saudacao-diaria  (exige Authorization: Bearer <token>)
 *
 * Disparada em TODO login/abertura do HUD (Passo 4 do fluxo SaaS) — e
 * também pelo script de detecção de desbloqueio de tela do Windows, ver
 * "Saudação Diária + Automação Windows" no Obsidian.
 */
comandoRouter.post('/comando/saudacao-diaria', exigirAutenticacao, async (req, res) => {
  try {
    const resposta = await gerarSaudacaoDiaria(req.usuarioId);
    res.json({ resposta });
  } catch (erro) {
    console.error('[erro ao gerar saudação diária]', erro.message);
    emitirEstado(req.usuarioId, 'IDLE');
    res.status(500).json({ erro: 'Falha ao gerar a saudação', detalhe: erro.message });
  }
});

/**
 * POST /api/comando/apresentacao  (exige Authorization: Bearer <token>)
 *
 * Disparada pelo frontend uma única vez, na primeira abertura do HUD logo
 * depois do onboarding (Passo 3 do fluxo SaaS) — não recebe texto nenhum
 * do usuário, é a Urfilig se apresentando sozinha usando o perfil recém-
 * preenchido.
 */
comandoRouter.post('/comando/apresentacao', exigirAutenticacao, async (req, res) => {
  try {
    const resposta = await gerarApresentacaoInicial(req.usuarioId);
    res.json({ resposta });
  } catch (erro) {
    console.error('[erro ao gerar apresentação inicial]', erro.message);
    emitirEstado(req.usuarioId, 'IDLE');
    res.status(500).json({ erro: 'Falha ao gerar a apresentação', detalhe: erro.message });
  }
});

/**
 * POST /api/comando  { "texto": "..." }  (exige Authorization: Bearer <token>)
 *
 * Entrada digitada (teste manual, ou futura interface de texto). A wake
 * word (Fase 4) usa o mesmo núcleo via processarComando(), só que disparado
 * por fala reconhecida em vez de uma requisição HTTP.
 */
comandoRouter.post('/comando', exigirAutenticacao, async (req, res) => {
  const { texto, provider } = req.body;

  if (!texto || typeof texto !== 'string') {
    return res.status(400).json({ erro: 'Campo "texto" (string) é obrigatório' });
  }

  try {
    if (provider && !['gemini', 'ollama'].includes(provider)) return res.status(400).json({ erro: 'Provedor inválido. Use gemini ou ollama.' });
    const resposta = await processarComando(req.usuarioId, texto, { provider });
    res.json({ resposta });
  } catch (erro) {
    console.error('[erro ao processar comando]', erro.message);
    emitirEstado(req.usuarioId, 'IDLE');
    res.status(500).json({
      erro: 'Falha ao processar o comando',
      detalhe: erro.message, // exposto de propósito — projeto local, ajuda a diagnosticar rápido
    });
  }
});
