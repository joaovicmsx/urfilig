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
  const [usuario, pastas, notasSoltas, bordoes, tracos, leads, diretrizes, reflexoes, memorias] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId } }),
    prisma.pasta.findMany({
      where: { usuarioId },
      include: { notas: { orderBy: [{ ordem: 'asc' }, { dataCriacao: 'desc' }] } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.nota.findMany({
      where: { usuarioId, pastaId: null },
      orderBy: [{ ordem: 'asc' }, { dataCriacao: 'desc' }],
    }),
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
    .map((hobby) => ({ id: `hobby-${hobby}`, label: hobby, strength: 0.6 }));

  const particulasPastas = pastas.map((pasta) => ({
    id: `pasta-${pasta.id}`,
    label: pasta.nome,
    strength: 0.9,
    isFolder: true,
    isNote: false,
  }));

  const particulasNotas = pastas.flatMap((pasta) => {
    const pastaRef = { id: `pasta-${pasta.id}`, label: pasta.nome };
    return pasta.notas.map((nota) => ({
      id: `nota-${nota.id}`,
      label: nota.titulo,
      strength: nota.importante ? 0.7 : 0.5,
      isFolder: false,
      isNote: true,
      folderRef: pastaRef,
    }));
  });

  const particulasNotasSoltas = notasSoltas.map((nota) => ({
    id: `nota-${nota.id}`,
    label: nota.titulo,
    strength: nota.importante ? 0.6 : 0.4,
    isFolder: false,
    isNote: true,
    folderRef: null,
  }));

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
    ...particulasPastas,
    ...particulasNotas,
    ...particulasNotasSoltas,
    ...particulasTracos,
    ...particulasBordoes,
    ...particulasLeads,
    ...particulasDiretrizes,
    ...particulasReflexoes,
    ...particulasMemorias,
  ];
}
