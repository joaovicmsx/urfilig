import { prisma } from '../db/client.js';
import { perguntarLLM } from '../llm/llmClient.js';

const SYSTEM_PROMPT_REFLEXAO = `
Você é a Urfilig, assistente pessoal do usuário. Escreva uma reflexão curta
(2-4 frases, primeira pessoa) sobre o dia de hoje, baseada nos dados abaixo.
Não é uma mensagem pro usuário — é uma anotação sua, pro seu próprio cofre
de memória, que você mesma vai reler depois. Seja honesta sobre o que
realmente aconteceu; se o dia foi tranquilo e sem muito dado, diga isso
em vez de inventar drama.

Responda só o texto da reflexão, sem aspas, sem markdown, sem prefixo.
`;

/**
 * Gera a reflexão diária PRA UM usuário específico.
 */
export async function gerarReflexaoDiariaDoUsuario(usuarioId) {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const [estatisticas, registrosEmocionais] = await Promise.all([
    prisma.estatisticaUso.findMany({ where: { usuarioId, createdAt: { gte: inicioDoDia } } }),
    prisma.registroEmocional.findMany({ where: { usuarioId, createdAt: { gte: inicioDoDia } } }),
  ]);

  if (estatisticas.length === 0 && registrosEmocionais.length === 0) {
    console.log(`[persona] usuário ${usuarioId}: sem interações hoje — pulando a reflexão diária.`);
    return;
  }

  const prompt = `
Estatísticas de uso de hoje:
${JSON.stringify(resumirPorTipo(estatisticas), null, 2)}

Sinais emocionais detectados hoje:
${JSON.stringify(resumirPorTipo(registrosEmocionais.map((r) => ({ tipo: r.sentimentoDetectado }))), null, 2)}
`;

  try {
    const reflexao = await perguntarLLM(prompt, SYSTEM_PROMPT_REFLEXAO);
    await prisma.reflexao.create({ data: { usuarioId, conteudo: reflexao.trim() } });
    console.log(`[persona] usuário ${usuarioId}: reflexão diária registrada.`);
  } catch (erro) {
    console.error(`[persona] usuário ${usuarioId}: falha ao gerar a reflexão diária:`, erro.message);
  }
}

/**
 * Roda a reflexão diária pra TODOS os usuários — usado pelo cron noturno.
 */
export async function gerarReflexaoDiariaDeTodos() {
  const usuarios = await prisma.usuario.findMany({ select: { id: true } });
  for (const { id } of usuarios) {
    await gerarReflexaoDiariaDoUsuario(id);
  }
}

function resumirPorTipo(itens) {
  const contagem = {};
  for (const item of itens) {
    contagem[item.tipo] = (contagem[item.tipo] || 0) + 1;
  }
  return contagem;
}
