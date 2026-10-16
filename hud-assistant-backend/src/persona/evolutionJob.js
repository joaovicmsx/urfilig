import { prisma } from '../db/client.js';
import { perguntarLLM } from '../llm/llmClient.js';
const SYSTEM_PROMPT_EVOLUCAO = `
Você está analisando seus próprios registros de interação com o usuário pra
decidir como sua personalidade e suas regras de comportamento devem evoluir.
Baseado nos dados abaixo, proponha ajustes de temperamento, novos bordões,
e/ou novas diretrizes de comportamento (regras que você quer seguir daqui
pra frente, tipo "ser mais direto de manhã" ou "nunca sugerir preço sem o
usuário pedir primeiro").

Responda SOMENTE em JSON, nesse formato exato, sem markdown, sem texto antes ou depois:
{
  "tracos": [{ "traco": "string curta", "evidencia": "por que você concluiu isso" }],
  "bordoes": [{ "situacao": "categoria_curta_sem_espaco", "texto": "a fala em si" }],
  "diretrizes": [{ "conteudo": "a regra em si, em primeira pessoa", "tags": "tag1,tag2" }]
}

Se não houver dado suficiente pra propor algo novo com confiança, responda
com arrays vazios. Não invente padrões que os dados não sustentam. Só
proponha uma diretriz nova se ela for genuinamente diferente das que já
existem — não repita uma diretriz já ativa com outras palavras.
`;

/**
 * Roda a evolução de personalidade PRA UM usuário específico. Extraído
 * como função própria pra poder ser chamado tanto em loop (todos os
 * usuários, via cron) quanto isoladamente (rota manual de teste, só o
 * usuário logado).
 */
export async function evoluirPersonalidadeDoUsuario(usuarioId) {
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // últimos 7 dias

  const [estatisticas, registrosEmocionais, tracosAtuais, diretrizesAtivas] = await Promise.all([
    prisma.estatisticaUso.findMany({ where: { usuarioId, createdAt: { gte: desde } } }),
    prisma.registroEmocional.findMany({ where: { usuarioId, createdAt: { gte: desde } } }),
    prisma.temperamento.findMany({ where: { usuarioId, ativo: true } }),
    prisma.diretriz.findMany({ where: { usuarioId, ativo: true } }),
  ]);

  if (estatisticas.length === 0 && registrosEmocionais.length === 0) {
    console.log(`[persona] usuário ${usuarioId}: sem dados suficientes ainda pra evoluir a personalidade.`);
    return;
  }

  const resumoUso = resumirPorTipo(estatisticas);
  const resumoEmocional = resumirPorTipo(
    registrosEmocionais.map((r) => ({ tipo: r.sentimentoDetectado }))
  );

  const prompt = `
Traços de temperamento atuais: ${tracosAtuais.map((t) => t.traco).join(', ') || 'nenhum ainda'}

Diretrizes já ativas (não repita nenhuma dessas com outras palavras):
${diretrizesAtivas.map((d) => `- ${d.conteudo}`).join('\n') || 'nenhuma ainda'}

Últimos 7 dias de uso:
${JSON.stringify(resumoUso, null, 2)}

Últimos 7 dias de sinais emocionais detectados:
${JSON.stringify(resumoEmocional, null, 2)}
`;

  let resultado;
  try {
    const respostaBruta = await perguntarLLM(prompt, SYSTEM_PROMPT_EVOLUCAO, { formatoJson: true });
    resultado = JSON.parse(respostaBruta);
  } catch (erro) {
    console.error(`[persona] usuário ${usuarioId}: falha ao gerar ou interpretar a evolução:`, erro.message);
    return;
  }

  for (const t of resultado.tracos || []) {
    const existente = await prisma.temperamento.findFirst({ where: { usuarioId, traco: t.traco } });
    if (existente) {
      await prisma.temperamento.update({
        where: { id: existente.id },
        data: { intensidade: Math.min(existente.intensidade + 1, 5), evidencia: t.evidencia },
      });
    } else {
      await prisma.temperamento.create({ data: { usuarioId, traco: t.traco, evidencia: t.evidencia } });
    }
  }

  for (const b of resultado.bordoes || []) {
    await prisma.bordao.create({ data: { usuarioId, situacao: b.situacao, texto: b.texto } });
  }

  for (const d of resultado.diretrizes || []) {
    await prisma.diretriz.create({ data: { usuarioId, conteudo: d.conteudo, tags: d.tags || '' } });
  }

  console.log(
    `[persona] usuário ${usuarioId}: evolução consolidada — ${resultado.tracos?.length || 0} traço(s), ` +
    `${resultado.bordoes?.length || 0} bordão(ões), ${resultado.diretrizes?.length || 0} diretriz(es) nova(s)`
  );
}

/**
 * Roda a evolução pra TODOS os usuários cadastrados — usado pelo cron
 * noturno (ver server.js). Cada usuário evolui de forma independente,
 * com os próprios dados.
 */
export async function evoluirPersonalidadeDeTodos() {
  const usuarios = await prisma.usuario.findMany({ select: { id: true } });
  for (const { id } of usuarios) {
    await evoluirPersonalidadeDoUsuario(id);
  }
}

function resumirPorTipo(itens) {
  const contagem = {};
  for (const item of itens) {
    contagem[item.tipo] = (contagem[item.tipo] || 0) + 1;
  }
  return contagem;
}
