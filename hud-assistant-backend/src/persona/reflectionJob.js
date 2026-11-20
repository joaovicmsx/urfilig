import { prisma } from '../db/client.js';

function contarPorTipo(itens, campo = 'tipo') {
  return itens.reduce((contagem, item) => {
    const tipo = item[campo] || 'não classificado';
    contagem[tipo] = (contagem[tipo] || 0) + 1;
    return contagem;
  }, {});
}

export function gerarTextoReflexao({ estatisticas = [], registrosEmocionais = [] } = {}) {
  const contagens = contarPorTipo(estatisticas);
  const usos = Object.values(contagens).reduce((soma, n) => soma + n, 0);
  const emocao = contarPorTipo(registrosEmocionais, 'sentimentoDetectado');
  const dominante = Object.entries(emocao).sort((a, b) => b[1] - a[1])[0]?.[0];
  const resumoUso = usos
    ? `Hoje registrei ${usos} interação${usos === 1 ? '' : 'ões'}${Object.keys(contagens).length ? ` em ${Object.keys(contagens).length} tipo${Object.keys(contagens).length === 1 ? '' : 's'} de uso` : ''}.`
    : 'Hoje não há interações de uso registradas.';
  const resumoEmocao = dominante
    ? `O sinal emocional mais frequente foi “${dominante}”, com ${emocao[dominante]} registro${emocao[dominante] === 1 ? '' : 's'}.`
    : 'Não há sinais emocionais registrados hoje.';
  return `${resumoUso} ${resumoEmocao}`;
}

export async function gerarReflexaoDiariaDoUsuario(usuarioId) {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  try {
    const [estatisticas, registrosEmocionais] = await Promise.all([
      prisma.estatisticaUso.findMany({ where: { usuarioId, createdAt: { gte: inicioDoDia } } }),
      prisma.registroEmocional.findMany({ where: { usuarioId, createdAt: { gte: inicioDoDia } } }),
    ]);
    if (!estatisticas.length && !registrosEmocionais.length) {
      console.log(`[persona] usuário ${usuarioId}: sem interações hoje — pulando a reflexão diária.`);
      return;
    }
    await prisma.reflexao.create({ data: { usuarioId, conteudo: gerarTextoReflexao({ estatisticas, registrosEmocionais }) } });
    console.log(`[persona] usuário ${usuarioId}: reflexão diária por regras registrada.`);
  } catch (erro) {
    console.error(`[persona] usuário ${usuarioId}: falha ao registrar a reflexão diária:`, erro?.code || erro?.name || 'falha');
  }
}

export async function gerarReflexaoDiariaDeTodos() {
  try {
    const usuarios = await prisma.usuario.findMany({ select: { id: true } });
    for (const { id } of usuarios) await gerarReflexaoDiariaDoUsuario(id);
  } catch (erro) {
    console.error('[persona] falha ao listar usuários para reflexão diária:', erro?.code || erro?.name || 'falha');
  }
}
