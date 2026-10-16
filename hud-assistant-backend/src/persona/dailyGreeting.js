import { prisma } from '../db/client.js';
import { perguntarLLM } from '../llm/llmClient.js';
import { emitirEstado, emitirResposta, emitirParaUsuario } from '../socket/index.js';
import { montarSystemPrompt } from './promptBuilder.js';
import { montarParticulas } from './particlesBuilder.js';
import { buscarClimaAtual } from '../weather/weatherService.js';
import { sintetizarFala } from '../voice/piperClient.js';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function periodoDoDia(hora) {
  if (hora < 12) return 'manhã';
  if (hora < 18) return 'tarde';
  return 'noite';
}

/**
 * Saudação disparada a cada login/abertura do HUD (Passo 4 do fluxo SaaS)
 * — diferente da [[apresentação inicial]] (só a primeira vez, focada em
 * "te conhecer"), essa é o briefing do dia: bom dia/tarde/noite + data +
 * temperatura atual + roteiro da agenda + atualizações pendentes.
 *
 * "Atualizações do dia" foi interpretado como leads aguardando aprovação
 * — é o dado mais próximo de "coisa pendente que precisa da sua atenção"
 * que já existe no sistema. Se você tinha outra coisa em mente, me avisa
 * que ajusto a fonte.
 */
export async function gerarSaudacaoDiaria(usuarioId) {
  const agora = new Date();
  const periodo = periodoDoDia(agora.getHours());
  const dataFormatada = `${agora.getDate()} de ${MESES[agora.getMonth()]}`;

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date();
  fimDoDia.setHours(23, 59, 59, 999);

  const [itensAgenda, leadsPendentes, clima] = await Promise.all([
    prisma.agendaItem.findMany({
      where: { usuarioId, data: { gte: inicioDoDia, lte: fimDoDia } },
      orderBy: { horario: 'asc' },
    }),
    prisma.lead.count({ where: { usuarioId, statusFunil: 'AGUARDANDO_APROVACAO' } }),
    buscarClimaAtual().catch(() => null),
  ]);

  const roteiro = itensAgenda.length > 0
    ? itensAgenda.map((i) => `${i.horario ? i.horario + ' - ' : ''}${i.titulo}`).join('; ')
    : 'nenhum compromisso agendado pra hoje';

  const atualizacoes = leadsPendentes > 0
    ? `${leadsPendentes} lead(s) aguardando sua aprovação`
    : 'nenhuma atualização pendente';

  const instrucao = `Gere uma saudação de "bom(a) ${periodo}" natural e breve (3-5 frases) pro
usuário, contando: a data de hoje (${dataFormatada}), a temperatura atual
(${clima ? Math.round(clima.temperature) + '°C' : 'não consegui checar agora'}),
o roteiro do dia (${roteiro}), e as atualizações do dia (${atualizacoes}).
Fale como uma pessoa contaria isso numa conversa breve de bom dia, não como
uma lista robótica de itens separados.`;

  emitirEstado(usuarioId, 'THINKING');
  const systemPrompt = await montarSystemPrompt(usuarioId, { sentimento: 'neutro', prioridade: 'normal' });
  const resposta = await perguntarLLM(instrucao, systemPrompt);

  emitirEstado(usuarioId, 'SPEAKING');
  const audioBase64 = await sintetizarFala(resposta);
  emitirResposta(usuarioId, resposta, undefined, audioBase64);
  console.log(`[saudacao] usuário ${usuarioId}: "${resposta}"`);

  emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));
  setTimeout(() => emitirEstado(usuarioId, 'IDLE'), 1500);

  return resposta;
}
