import { prisma } from '../db/client.js';

/**
 * Constrói a lista COMPLETA de partículas da Esfera Neural — é a única
 * fonte de verdade agora (antes só cobria bordões/traços/leads, e isso
 * causava as partículas de hobbies, criadas no frontend, desaparecerem
 * assim que o backend mandava uma lista menor depois de qualquer comando).
 *
 * Inclui: hobbies do perfil (onboarding), traços de temperamento,
 * bordões, leads, diretrizes, reflexões e notas de memória (Memory —
 * criadas quando o usuário pede pra "anotar"/"lembrar" algo, ver
 * memoryIntent.js).
 */
export async function montarParticulas(usuarioId) {
  const [usuario, bordoes, tracos, leads, diretrizes, reflexoes, memorias] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
    prisma.bordao.findMany({ where: { usuarioId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.temperamento.findMany({ where: { usuarioId, ativo: true } }),
    prisma.lead.findMany({ where: { usuarioId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.diretriz.findMany({ where: { usuarioId, ativo: true }, take: 40 }),
    prisma.reflexao.findMany({ where: { usuarioId }, orderBy: { data: 'desc' }, take: 20 }),
    prisma.memory.findMany({ where: { usuarioId }, orderBy: { createdAt: 'desc' }, take: 60 }),
  ]);

  const particulasHobbies = (usuario?.hobbies || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((hobby) => ({ label: `Hobby: ${hobby}`, strength: 0.6 }));

  const particulasTracos = tracos.map((t) => ({
    label: `Traço: ${t.traco}`,
    strength: t.intensidade / 5,
  }));

  const particulasBordoes = bordoes.map((b) => ({
    label: `Bordão: ${b.texto.slice(0, 40)}`,
    strength: Math.min(b.vezesUsado / 10, 1),
  }));

  const particulasLeads = leads.map((l) => ({
    label: `Lead: ${l.nome}`,
    strength: Math.min((l.score || 0) / 6, 1),
  }));

  const particulasDiretrizes = diretrizes.map((d) => ({
    label: `Diretriz: ${d.conteudo.slice(0, 40)}`,
    strength: 0.7,
  }));

  const particulasReflexoes = reflexoes.map((r) => ({
    label: `Reflexão: ${r.conteudo.slice(0, 40)}`,
    strength: 0.5,
  }));

  const particulasMemorias = memorias.map((m) => ({
    label: m.titulo,
    strength: 0.6,
  }));

  return [
    ...particulasHobbies,
    ...particulasTracos,
    ...particulasBordoes,
    ...particulasLeads,
    ...particulasDiretrizes,
    ...particulasReflexoes,
    ...particulasMemorias,
  ];
}
