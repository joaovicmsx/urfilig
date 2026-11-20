import { prisma } from '../db/client.js';
import { emitirEstado, emitirResposta, emitirParaUsuario } from '../socket/index.js';
import { montarParticulas } from './particlesBuilder.js';
import { buscarClimaAtual } from '../weather/weatherService.js';
import { sintetizarFala } from '../voice/piperClient.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function periodoDoDia(hora) {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function montarTextoSaudacaoDiaria({ agora = new Date(), itensAgenda, leadsPendentes, clima } = {}) {
  const data = `${agora.getDate()} de ${MESES[agora.getMonth()]}`;
  const partes = [`${periodoDoDia(agora.getHours())}. Hoje é ${data}.`];
  if (clima?.temperature != null && Number.isFinite(Number(clima.temperature))) {
    partes.push(`A temperatura agora é ${Math.round(Number(clima.temperature))} °C.`);
  }
  if (Array.isArray(itensAgenda)) {
    partes.push(itensAgenda.length
      ? `Na agenda: ${itensAgenda.map((item) => `${item.horario ? `${item.horario} — ` : ''}${item.titulo}`).join('; ')}.`
      : 'Você não tem compromissos agendados para hoje.');
  }
  if (Number.isFinite(leadsPendentes)) {
    partes.push(leadsPendentes > 0
      ? `Há ${leadsPendentes} lead${leadsPendentes === 1 ? '' : 's'} aguardando sua aprovação.`
      : 'Não há atualizações pendentes.');
  }
  return partes.join(' ');
}

export async function gerarSaudacaoDiaria(usuarioId) {
  const agora = new Date();
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date(agora);
  fimDoDia.setHours(23, 59, 59, 999);
  const [itensAgenda, leadsPendentes, clima] = await Promise.all([
    prisma.agendaItem.findMany({ where: { usuarioId, data: { gte: inicioDoDia, lte: fimDoDia } }, orderBy: { horario: 'asc' } }),
    prisma.lead.count({ where: { usuarioId, statusFunil: 'AGUARDANDO_APROVACAO' } }),
    buscarClimaAtual().catch(() => null),
  ]);
  const resposta = montarTextoSaudacaoDiaria({ agora, itensAgenda, leadsPendentes, clima });
  emitirEstado(usuarioId, 'THINKING');
  emitirEstado(usuarioId, 'SPEAKING');
  const audioBase64 = await sintetizarFala(resposta);
  emitirResposta(usuarioId, resposta, undefined, audioBase64);
  emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));
  return resposta;
}
