import { Router } from 'express';
import { prisma } from '../db/client.js';
import { perguntarOllama } from '../llm/ollamaClient.js';
import { emitirParaUsuario } from '../socket/index.js';
import { montarParticulas } from '../persona/particlesBuilder.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const leadsRouter = Router();
leadsRouter.use(exigirAutenticacao); // toda rota de leads exige login

const SYSTEM_PROMPT_PITCH = `
Você é assistente de vendas B2B de um desenvolvedor freelancer.
Stack: Java, Spring Boot, APIs REST, HTML/CSS.
Portfólio real: landing page para restaurante japonês (Kiyo Koi, mobile-first,
botão flutuante de WhatsApp), site para chaveiro com seção de serviços,
sistema de folha de pagamento em Java (Payroll Management System).
Gere uma mensagem curta (3-4 frases), persuasiva, sem parecer spam,
citando 1 exemplo concreto de portfólio relevante ao nicho do lead.
Nunca prometa prazo ou preço específico.
`;

/**
 * Pontua o lead antes de gastar uma chamada de Ollama gerando o pitch.
 * Mesma lógica que já estava na versão markdown, só que agora roda
 * antes de gravar no banco.
 */
function calcularScore(bio, nicho) {
  let score = 0;
  if (/agende|orçamento|contato/i.test(bio || '')) score += 2;
  if (/instagram\.com|linktr\.ee/i.test(bio || '')) score += 1;
  const nichosAlvo = ['consultoria esportiva', 'academia', 'personal trainer', 'escritório'];
  if (nichosAlvo.some((n) => (nicho || '').toLowerCase().includes(n))) score += 3;
  return score;
}

/**
 * POST /api/leads/novo  { nome, bio, contato, nicho }
 *
 * Dedup por contato agora é uma constraint UNIQUE composta
 * ([usuarioId, contato]) — dois usuários diferentes da Urfilig podem ter
 * um lead com o mesmo contato sem conflito, mas o mesmo usuário não pode
 * duplicar.
 */
leadsRouter.post('/leads/novo', async (req, res) => {
  const { nome, bio, contato, nicho } = req.body;

  if (!nome || !contato) {
    return res.status(400).json({ erro: 'Campos "nome" e "contato" são obrigatórios' });
  }

  const score = calcularScore(bio, nicho);

  try {
    let pitch = null;
    try {
      pitch = await perguntarOllama(
        `Nicho: ${nicho || 'não informado'}\nBio: ${bio || ''}`,
        SYSTEM_PROMPT_PITCH
      );
    } catch {
      // A indisponibilidade do modelo não deve impedir o usuário de registrar
      // um lead; ele ainda pode revisar os dados e preparar o contato manualmente.
      console.warn('[leads] Ollama indisponível; lead será salvo sem rascunho.');
    }

    const lead = await prisma.lead.create({
      data: { usuarioId: req.usuarioId, nome, contato, nicho, bio, score, pitch },
    });

    console.log(`[leads] usuário ${req.usuarioId} criou lead: ${lead.nome} (score ${lead.score})`);
    emitirParaUsuario(req.usuarioId, 'lead:pendente', lead);
    emitirParaUsuario(req.usuarioId, 'mascot:particles', await montarParticulas(req.usuarioId));

    res.status(201).json(lead);
  } catch (erro) {
    // P2002 = violação de constraint única do Prisma — contato já existe PRA ESSE usuário
    if (erro.code === 'P2002') {
      return res.status(409).json({ erro: 'Você já tem um lead com esse contato' });
    }
    console.error('[leads] erro ao criar lead:', erro.message);
    res.status(500).json({ erro: 'Falha ao criar lead (o Ollama está rodando?)' });
  }
});

/**
 * GET /api/leads?status=AGUARDANDO_APROVACAO
 * Lista SÓ os leads do usuário logado, ordenados por score (prioridade).
 */
leadsRouter.get('/leads', async (req, res) => {
  const { status } = req.query;

  const leads = await prisma.lead.findMany({
    where: { usuarioId: req.usuarioId, ...(status ? { statusFunil: status } : {}) },
    orderBy: { score: 'desc' },
  });

  res.json(leads);
});

/**
 * POST /api/leads/:id/aprovar
 * Marca o lead como aprovado — o envio em si continua manual. `updateMany`
 * com `usuarioId` na cláusula where garante que um usuário não consiga
 * aprovar (ou nem descobrir a existência de) um lead de outro usuário só
 * adivinhando o ID — sem isso, `update` por id sozinho seria uma falha de
 * autorização (IDOR).
 */
leadsRouter.post('/leads/:id/aprovar', async (req, res) => {
  try {
    const resultado = await prisma.lead.updateMany({
      where: { id: req.params.id, usuarioId: req.usuarioId },
      data: { statusFunil: 'APROVADO_AGUARDANDO_ENVIO', ultimaInteracao: new Date() },
    });

    if (resultado.count === 0) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    res.json(lead);
  } catch (erro) {
    console.error('[leads] erro ao aprovar lead:', erro.message);
    res.status(500).json({ erro: 'Falha ao aprovar lead' });
  }
});
