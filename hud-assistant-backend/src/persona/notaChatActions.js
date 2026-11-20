import { detectarCriacaoDeNota, detectarMovimentoDeNota } from './memoryIntent.js';

const contextosPendentes = new Map();
const ultimaNotaPorUsuario = new Map();
const criacoesEmAndamento = new Map();
const TTL_CONTEXTO_MS = 30 * 60 * 1000;
const JANELA_DUPLICATA_MS = 2 * 60 * 1000;

export function normalizarNomeNota(valor = '') {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

function nomeNotaLegado(valor = '') {
  return normalizarNomeNota(valor).replace(/^(?:chamada|chamado)\s+/, '');
}

function limparContextosExpirados(usuarioId) {
  const pendente = contextosPendentes.get(usuarioId);
  if (pendente && pendente.expiraEm < Date.now()) contextosPendentes.delete(usuarioId);
  const ultima = ultimaNotaPorUsuario.get(usuarioId);
  if (ultima && ultima.expiraEm < Date.now()) ultimaNotaPorUsuario.delete(usuarioId);
}

function mensagemErroBanco(erro) {
  const falha = new Error('Não foi possível concluir a ação da nota no banco.');
  falha.notaActionError = true;
  falha.code = typeof erro?.code === 'string' ? erro.code : undefined;
  return falha;
}

async function lerDadosDoUsuario(prisma, usuarioId) {
  const [notas, pastas] = await Promise.all([
    prisma.nota.findMany({ where: { usuarioId }, select: { id: true, usuarioId: true, titulo: true, conteudo: true, pastaId: true, dataCriacao: true } }),
    prisma.pasta.findMany({ where: { usuarioId }, select: { id: true, usuarioId: true, nome: true } }),
  ]);
  return {
    notas: notas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR') || String(a.id).localeCompare(String(b.id))),
    pastas: pastas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || String(a.id).localeCompare(String(b.id))),
  };
}

function acharCorrespondencias(lista, nome, campo) {
  const alvo = normalizarNomeNota(nome);
  if (!alvo) return [];
  const exatas = lista.filter((item) => normalizarNomeNota(item[campo]) === alvo);
  const parecidas = lista.filter((item) => {
    const nomeItem = normalizarNomeNota(item[campo]);
    if (nomeItem === alvo) return false;
    return nomeItem.includes(alvo) || alvo.includes(nomeItem) || (campo === 'titulo' && nomeNotaLegado(item[campo]) === alvo);
  });
  const correspondencias = [...new Map([...exatas, ...parecidas].map((item) => [String(item.id), item])).values()];
  correspondencias.precisaEsclarecer = exatas.length !== 1 || parecidas.length > 0;
  return correspondencias;
}

function precisaEsclarecer(opcoes) {
  return opcoes.length > 0 && (opcoes.length > 1 || Boolean(opcoes.precisaEsclarecer));
}

function distanciaEdicao(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const acima = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = acima;
    }
  }
  return linha[b.length];
}

function similaridadeNome(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 0.9 - (Math.abs(a.length - b.length) / Math.max(a.length, b.length)) * 0.12;
  return 1 - distanciaEdicao(a, b) / Math.max(a.length, b.length);
}

function resolverPastaPorNome(pastas, nome) {
  const alvo = normalizarNomeNota(nome);
  if (!alvo) return { pasta: null, candidatas: [], ambigua: false };
  const pontuadas = pastas
    .map((pasta) => ({ pasta, score: similaridadeNome(alvo, normalizarNomeNota(pasta.nome)) }))
    .filter((item) => item.score >= 0.78)
    .sort((a, b) => b.score - a.score || a.pasta.nome.localeCompare(b.pasta.nome, 'pt-BR') || String(a.pasta.id).localeCompare(String(b.pasta.id)));
  if (!pontuadas.length) return { pasta: null, candidatas: [], ambigua: false };
  const melhor = pontuadas[0];
  const empate = pontuadas.filter((item) => melhor.score - item.score < 0.06);
  if (empate.length > 1) return { pasta: null, candidatas: empate.map((item) => item.pasta), ambigua: true };
  return { pasta: melhor.pasta, candidatas: [melhor.pasta], ambigua: false };
}

function alternativa(numero) {
  if (/^(?:1|primeira|primeiro|a primeira|o primeiro)$/i.test(numero.trim())) return 0;
  if (/^(?:2|segunda|segundo|a segunda|o segundo)$/i.test(numero.trim())) return 1;
  if (/^(?:3|terceira|terceiro|a terceira|o terceiro)$/i.test(numero.trim())) return 2;
  return null;
}

function alternativas(texto, quantidade) {
  const entrada = normalizarNomeNota(texto);
  if (/^(?:as duas|ambas|ambos|os dois|todas|todos)$/i.test(entrada)) {
    return quantidade === 2 ? [0, 1] : null;
  }
  const numeros = [...entrada.matchAll(/\d+/g)].map((item) => Number(item[0]) - 1);
  if (numeros.length > 1 && numeros.every((item) => item >= 0 && item < quantidade)) {
    return [...new Set(numeros)];
  }
  const unica = alternativa(texto);
  return unica !== null && unica < quantidade ? [unica] : null;
}

function salvarPendente(usuarioId, contexto) {
  contextosPendentes.set(usuarioId, { ...contexto, expiraEm: Date.now() + TTL_CONTEXTO_MS });
}

function listarOpcoes(itens, campo) {
  return itens.slice(0, 5).map((item, indice) => `${indice + 1}. ${item[campo]}`).join('; ');
}

async function concluirCriacao(prisma, usuarioId, criacao, pasta) {
  const titulo = String(criacao.titulo || '').trim().slice(0, 160);
  const conteudo = String(criacao.conteudo || '');
  if (!titulo) return { resposta: 'Qual nome você quer dar à nota?', precisaEsclarecer: true };
  if (conteudo.length > 20000) return { resposta: 'O conteúdo da nota deve ter até 20.000 caracteres.', precisaEsclarecer: true };
  const pastaId = pasta?.id ?? null;
  const chave = `${usuarioId}\u0000${pastaId}\u0000${normalizarNomeNota(titulo)}\u0000${conteudo}`;
  let salvamento = criacoesEmAndamento.get(chave);
  if (!salvamento) {
    salvamento = (async () => {
      const recente = await prisma.nota.findFirst({
        where: {
          usuarioId, pastaId, titulo, conteudo,
          dataCriacao: { gte: new Date(Date.now() - JANELA_DUPLICATA_MS) },
        },
        orderBy: { dataCriacao: 'desc' },
      });
      if (recente) return { nota: recente, duplicada: true };
      const ordem = await prisma.nota.count({ where: { usuarioId, pastaId } });
      return {
        nota: await prisma.nota.create({ data: { usuarioId, pastaId, titulo, conteudo, ordem } }),
        duplicada: false,
      };
    })();
    criacoesEmAndamento.set(chave, salvamento);
  }
  let salvo;
  try {
    salvo = await salvamento;
  } finally {
    if (criacoesEmAndamento.get(chave) === salvamento) criacoesEmAndamento.delete(chave);
  }
  const { nota, duplicada } = salvo;
  ultimaNotaPorUsuario.set(usuarioId, { id: nota.id, titulo: nota.titulo, expiraEm: Date.now() + TTL_CONTEXTO_MS });
  contextosPendentes.delete(usuarioId);
  return {
    resposta: duplicada
      ? `A nota “${nota.titulo}” já estava salva${pasta ? ` na pasta “${pasta.nome}”` : ''}.`
      : `Criei a nota “${nota.titulo}”${pasta ? ` na pasta “${pasta.nome}”` : ''}.`,
    notaCriada: nota,
    duplicada,
  };
}

async function concluirMovimento(prisma, usuarioId, nota, pasta) {
  if (Number(nota.pastaId) === Number(pasta.id)) {
    contextosPendentes.delete(usuarioId);
    ultimaNotaPorUsuario.set(usuarioId, { id: nota.id, titulo: nota.titulo, expiraEm: Date.now() + TTL_CONTEXTO_MS });
    return { resposta: `A nota “${nota.titulo}” já está na pasta “${pasta.nome}”.`, notaMovida: nota };
  }
  const resultado = await atualizarNotaDoUsuario(prisma, {
    usuarioId,
    notaId: nota.id,
    data: { pastaId: pasta.id },
  });
  if (resultado.status !== 'atualizada') {
    const acaoPendente = { acao: 'mover', notaId: nota.id, notaNome: nota.titulo, pastaNome: pasta.nome };
    if (resultado.status === 'pasta-nao-encontrada') {
      salvarPendente(usuarioId, { ...acaoPendente, aguardandoCriarPasta: true, tipoPendente: 'pasta', candidatos: null });
      return { resposta: `A pasta “${pasta.nome}” não está mais disponível. Quer que eu a crie?`, precisaEsclarecer: true };
    }
    salvarPendente(usuarioId, { ...acaoPendente, notaId: null, tipoPendente: 'nota', candidatos: null });
    return { resposta: `Não encontrei mais a nota “${nota.titulo}”. Confirme se ela ainda existe.`, precisaEsclarecer: true };
  }
  const atualizada = resultado.nota;
  contextosPendentes.delete(usuarioId);
  ultimaNotaPorUsuario.set(usuarioId, { id: atualizada.id, titulo: atualizada.titulo, expiraEm: Date.now() + TTL_CONTEXTO_MS });
  return { resposta: `Mudei a nota “${atualizada.titulo}” para a pasta “${pasta.nome}”.`, notaMovida: atualizada };
}

async function concluirMovimentos(prisma, usuarioId, notas, pasta) {
  const ids = notas.map((nota) => nota.id);
  const resultado = await prisma.nota.updateMany({
    where: { usuarioId, id: { in: ids } },
    data: { pastaId: pasta.id },
  });
  if (resultado.count !== ids.length) {
    const dados = await lerDadosDoUsuario(prisma, usuarioId);
    const restantes = dados.notas.filter((nota) => ids.some((id) => String(id) === String(nota.id)));
    salvarPendente(usuarioId, { acao: 'mover', notaIds: restantes.map((nota) => nota.id), pastaNome: pasta.nome, tipoPendente: 'nota', candidatos: restantes.map((nota) => nota.id) });
    return { resposta: 'Uma das notas deixou de estar disponível. Confira quais notas ainda deseja mover.', precisaEsclarecer: true };
  }
  const atualizadas = await prisma.nota.findMany({ where: { usuarioId, id: { in: ids } } });
  contextosPendentes.delete(usuarioId);
  ultimaNotaPorUsuario.set(usuarioId, { id: atualizadas[0]?.id, titulo: atualizadas[0]?.titulo, expiraEm: Date.now() + TTL_CONTEXTO_MS });
  return {
    resposta: `Mudei ${atualizadas.length === 2 ? 'as duas notas' : `${atualizadas.length} notas`} para a pasta “${pasta.nome}”: ${atualizadas.map((nota) => `“${nota.titulo}”`).join(', ')}.`,
    notaMovida: atualizadas[0],
    notasMovidas: atualizadas,
  };
}

async function executarAcaoPendente(prisma, usuarioId, pendente, selecao = null, criarPasta = false) {
  const { notas, pastas } = await lerDadosDoUsuario(prisma, usuarioId);
  let nota;
  let notasSelecionadas = [];
  if (pendente.acao === 'criar') {
    nota = null;
  } else if (pendente.notaId !== undefined && pendente.notaId !== null) {
    nota = notas.find((item) => String(item.id) === String(pendente.notaId));
    if (nota) notasSelecionadas = [nota];
  } else if (Array.isArray(pendente.notaIds) && pendente.notaIds.length) {
    notasSelecionadas = notas.filter((item) => pendente.notaIds.some((id) => String(id) === String(item.id)));
    nota = notasSelecionadas[0];
  } else if (pendente.notaNome) {
    const opcoes = acharCorrespondencias(notas, pendente.notaNome, 'titulo');
    if (precisaEsclarecer(opcoes) && selecao === null) {
      salvarPendente(usuarioId, { ...pendente, tipoPendente: 'nota', candidatos: opcoes.map((item) => item.id) });
      const pergunta = opcoes.length > 1
        ? `Encontrei mais de uma nota parecida: ${listarOpcoes(opcoes, 'titulo')}. Qual delas?`
        : `Encontrei uma nota parecida, “${opcoes[0].titulo}”. É essa?`;
      return { resposta: pergunta, precisaEsclarecer: true };
    }
    nota = selecao !== null ? opcoes[selecao] : opcoes[0];
    if (nota) notasSelecionadas = [nota];
  }
  if (!nota && pendente.acao !== 'criar') {
    salvarPendente(usuarioId, { ...pendente, tipoPendente: 'nota', candidatos: null });
    return { resposta: `Não encontrei a nota “${pendente.notaNome || 'recente'}”. Qual é o título exato?`, precisaEsclarecer: true };
  }

  const resolucaoPasta = resolverPastaPorNome(pastas, pendente.pastaNome);
  const pastasDoMesmoNome = resolucaoPasta.candidatas;
  let pasta = pendente.pastaId !== undefined && pendente.pastaId !== null
    ? pastas.find((item) => String(item.id) === String(pendente.pastaId))
    : selecao !== null && pendente.tipoPendente === 'pasta' ? pastasDoMesmoNome[selecao] : resolucaoPasta.pasta;
  if (resolucaoPasta.ambigua && pendente.pastaId == null && !(selecao !== null && pendente.tipoPendente === 'pasta')) {
    salvarPendente(usuarioId, { ...pendente, notaId: notasSelecionadas.length > 1 ? null : (nota?.id ?? null), notaIds: notasSelecionadas.map((item) => item.id), tipoPendente: 'pasta', candidatos: pastasDoMesmoNome.map((item) => item.id) });
    const pergunta = `Encontrei pastas com nomes muito parecidos: ${listarOpcoes(pastasDoMesmoNome, 'nome')}. Qual delas?`;
    return { resposta: pergunta, precisaEsclarecer: true };
  }
  if (!pasta && criarPasta) {
    // Releitura acima garante que uma pasta já criada por outra ação seja reutilizada.
    pasta = await prisma.pasta.create({ data: { usuarioId, nome: pendente.pastaNome } });
  }
  if (!pasta) {
    if (!pendente.pastaNome || normalizarNomeNota(pendente.pastaNome) === 'pasta') {
      salvarPendente(usuarioId, { ...pendente, notaId: null, notaIds: notasSelecionadas.map((item) => item.id), tipoPendente: null, candidatos: null, aguardandoNomePasta: true });
      return { resposta: 'Qual é o nome da pasta para onde devo mover a nota?', precisaEsclarecer: true };
    }
    salvarPendente(usuarioId, { ...pendente, notaId: notasSelecionadas.length > 1 ? null : nota.id, notaIds: notasSelecionadas.map((item) => item.id), tipoPendente: 'pasta', candidatos: null, aguardandoCriarPasta: true });
    return { resposta: `Não encontrei a pasta “${pendente.pastaNome}”. Quer que eu crie essa pasta?`, precisaEsclarecer: true };
  }

  if (pendente.acao === 'criar') return concluirCriacao(prisma, usuarioId, pendente.criacao, pasta);
  if (notasSelecionadas.length > 1) return concluirMovimentos(prisma, usuarioId, notasSelecionadas, pasta);
  return concluirMovimento(prisma, usuarioId, nota, pasta);
}

function eRespostaSobrePastaCriada(texto) {
  return /\b(?:j[aá]\s+(?:(?:est[aá]|t[aá])\s+criad[ao]|existe|foi\s+criad[ao])|existe|est[aá]\s+criad[ao])\b/i.test(texto);
}

function eConfirmacaoCriar(texto) {
  return /^(?:sim|s|pode|pode sim|isso|ok|certo|cria|crie|pode criar)(?:\b|[,!.])/i.test(texto.trim());
}

function eNegativa(texto) {
  return /^(?:n[aã]o|negativo|deixa|cancela|não precisa)(?:\b|[,!.])/i.test(texto.trim());
}

export async function atualizarNotaDoUsuario(prisma, { usuarioId, notaId, data }) {
  if (data.pastaId !== undefined && data.pastaId !== null) {
    const pasta = await prisma.pasta.findFirst({ where: { id: data.pastaId, usuarioId }, select: { id: true } });
    if (!pasta) return { status: 'pasta-nao-encontrada' };
  }
  const resultado = await prisma.nota.updateMany({ where: { id: notaId, usuarioId }, data });
  if (!resultado.count) return { status: 'nota-nao-encontrada' };
  const nota = await prisma.nota.findFirst({ where: { id: notaId, usuarioId } });
  return { status: 'atualizada', nota };
}

export async function processarAcaoDeNotaNoChat(prisma, usuarioId, texto) {
  limparContextosExpirados(usuarioId);
  const criacao = detectarCriacaoDeNota(texto);
  const movimento = detectarMovimentoDeNota(texto);
  const pendente = contextosPendentes.get(usuarioId);

  try {
    if (pendente && !criacao && !movimento) {
      if (pendente.tipoPendente && pendente.candidatos?.length) {
        const dadosAtuais = await lerDadosDoUsuario(prisma, usuarioId);
        const opcoesAtuais = pendente.tipoPendente === 'nota' ? dadosAtuais.notas : dadosAtuais.pastas;
        const itensValidos = opcoesAtuais.filter((item) => pendente.candidatos.some((id) => String(id) === String(item.id)));
        const indices = alternativas(texto, itensValidos.length);
        const nomeCampo = pendente.tipoPendente === 'nota' ? 'titulo' : 'nome';
        const escolhaPorNome = itensValidos.filter((item) => normalizarNomeNota(item[nomeCampo]) === normalizarNomeNota(texto));
        const selecaoMultipla = pendente.tipoPendente === 'nota' && pendente.acao === 'mover' && indices?.length > 1
          ? indices.map((index) => itensValidos[index]).filter(Boolean)
          : null;
        const selecionado = indices?.length === 1
          ? itensValidos[indices[0]]
          : escolhaPorNome.length === 1 ? escolhaPorNome[0]
            : pendente.candidatos.length === 1 && eConfirmacaoCriar(texto) ? itensValidos[0] : null;
        if (selecaoMultipla?.length > 1) {
          const atualizada = { ...pendente, notaId: null, notaIds: selecaoMultipla.map((item) => item.id), tipoPendente: null, candidatos: null };
          const resposta = await executarAcaoPendente(prisma, usuarioId, atualizada);
          return { handled: true, ...resposta };
        }
        if (selecionado) {
          const atualizada = { ...pendente, [pendente.tipoPendente === 'nota' ? 'notaId' : 'pastaId']: selecionado.id, tipoPendente: null, candidatos: null };
          if (pendente.tipoPendente === 'nota') atualizada.notaId = selecionado.id;
          else atualizada.pastaId = selecionado.id;
          const resposta = await executarAcaoPendente(prisma, usuarioId, atualizada, null);
          return { handled: true, ...resposta };
        }
        const nomes = listarOpcoes(itensValidos, nomeCampo);
        const aceitarAmbas = pendente.tipoPendente === 'nota' && pendente.acao === 'mover' && itensValidos.length === 2 ? ' Você também pode responder “as duas”.' : '';
        return { handled: true, resposta: `Responda com o número ou o título/nome exato do item: ${nomes || 'as opções anteriores'}.${aceitarAmbas}`, precisaEsclarecer: true };
      }

      if (pendente.aguardandoNomePasta) {
        const nomeInformado = String(texto || '').trim().replace(/[.!?]+$/, '');
        if (!nomeInformado || /^(?:sim|s|n[aã]o|ok|certo)$/i.test(nomeInformado)) {
          return { handled: true, resposta: 'Diga o nome da pasta para onde devo mover a nota.', precisaEsclarecer: true };
        }
        const dados = await lerDadosDoUsuario(prisma, usuarioId);
        const resolucao = resolverPastaPorNome(dados.pastas, nomeInformado);
        if (resolucao.ambigua) {
          salvarPendente(usuarioId, { ...pendente, pastaNome: nomeInformado, aguardandoNomePasta: false, tipoPendente: 'pasta', candidatos: resolucao.candidatas.map((item) => item.id) });
          return { handled: true, resposta: `Encontrei pastas parecidas: ${listarOpcoes(resolucao.candidatas, 'nome')}. Qual delas?`, precisaEsclarecer: true };
        }
        const resposta = await executarAcaoPendente(prisma, usuarioId, { ...pendente, pastaNome: nomeInformado, aguardandoNomePasta: false });
        return { handled: true, ...resposta };
      }

      if (pendente.aguardandoCriarPasta) {
        if (eNegativa(texto)) {
          contextosPendentes.delete(usuarioId);
          return { handled: true, resposta: 'Tudo bem. Não vou criar a pasta nem concluir a movimentação.' };
        }
        const dados = await lerDadosDoUsuario(prisma, usuarioId);
        const resolucaoPasta = resolverPastaPorNome(dados.pastas, pendente.pastaNome);
        if (resolucaoPasta.pasta) {
          const resposta = await executarAcaoPendente(prisma, usuarioId, pendente, null, false);
          return { handled: true, ...resposta };
        }
        if (resolucaoPasta.ambigua) {
          const resposta = await executarAcaoPendente(prisma, usuarioId, pendente);
          return { handled: true, ...resposta };
        }
        if (eRespostaSobrePastaCriada(texto)) {
          return { handled: true, resposta: `Ainda não encontrei a pasta “${pendente.pastaNome}”. Confira o nome ou diga “sim” se quer que eu crie.`, precisaEsclarecer: true };
        }
        if (eConfirmacaoCriar(texto)) {
          const resposta = await executarAcaoPendente(prisma, usuarioId, pendente, null, true);
          return { handled: true, ...resposta };
        }
        // Resposta livre pode corrigir o nome da pasta; consulta novamente com o nome informado.
        const novoNome = String(texto || '').trim().replace(/[.!?]+$/, '');
        if (novoNome) {
          const ajustado = { ...pendente, pastaNome: novoNome };
          const resposta = await executarAcaoPendente(prisma, usuarioId, ajustado);
          return { handled: true, ...resposta };
        }
      }
      if (pendente.tipoPendente === 'nota' && !pendente.candidatos?.length) {
        const novoNome = String(texto || '').trim().replace(/[.!?]+$/, '');
        if (pendente.notaNome) {
          const opcoesAtuais = acharCorrespondencias((await lerDadosDoUsuario(prisma, usuarioId)).notas, pendente.notaNome, 'titulo');
          if (opcoesAtuais.length === 1) {
            const resposta = await executarAcaoPendente(prisma, usuarioId, { ...pendente, notaId: opcoesAtuais[0].id, tipoPendente: null });
            return { handled: true, ...resposta };
          }
          if (opcoesAtuais.length > 1) {
            const resposta = await executarAcaoPendente(prisma, usuarioId, pendente);
            return { handled: true, ...resposta };
          }
        }
        if (eRespostaSobrePastaCriada(texto) || eConfirmacaoCriar(texto)) {
          return { handled: true, resposta: 'Ainda não encontrei essa nota. Diga o título exato dela para eu tentar novamente.', precisaEsclarecer: true };
        }
        if (novoNome && !/^(?:sim|n[aã]o|ok|certo)$/i.test(novoNome)) {
          const resposta = await executarAcaoPendente(prisma, usuarioId, { ...pendente, notaNome: novoNome, tipoPendente: null });
          return { handled: true, ...resposta };
        }
        return { handled: true, resposta: `Ainda não encontrei a nota. Diga o título exato para continuar.`, precisaEsclarecer: true };
      }
    }

    if (criacao?.requerTitulo) return { handled: true, resposta: 'Qual nome você quer dar à nota?', precisaEsclarecer: true };
    if (criacao) {
      if (criacao.pastaNome) {
        const dados = await lerDadosDoUsuario(prisma, usuarioId);
        const resolucaoPasta = resolverPastaPorNome(dados.pastas, criacao.pastaNome);
        const pastas = resolucaoPasta.candidatas;
        const acao = { acao: 'criar', pastaNome: criacao.pastaNome, criacao };
        if (resolucaoPasta.ambigua) {
          salvarPendente(usuarioId, { ...acao, tipoPendente: 'pasta', candidatos: pastas.map((item) => item.id) });
          const pergunta = `Encontrei pastas com nomes muito parecidos: ${listarOpcoes(pastas, 'nome')}. Qual delas?`;
          return { handled: true, resposta: pergunta, precisaEsclarecer: true };
        }
        if (!resolucaoPasta.pasta) {
          salvarPendente(usuarioId, { ...acao, aguardandoCriarPasta: true });
          return { handled: true, resposta: `Não encontrei a pasta “${criacao.pastaNome}”. Quer que eu crie essa pasta?`, precisaEsclarecer: true };
        }
        return { handled: true, ...await concluirCriacao(prisma, usuarioId, criacao, resolucaoPasta.pasta) };
      }
      return { handled: true, ...await concluirCriacao(prisma, usuarioId, criacao, null) };
    }

    if (movimento) {
      let notaId = null;
      if (movimento.usaUltimaNota) notaId = ultimaNotaPorUsuario.get(usuarioId)?.id ?? null;
      if (!movimento.notaNome && !notaId) {
        salvarPendente(usuarioId, { acao: 'mover', pastaNome: movimento.pastaNome, tipoPendente: 'nota', notaNome: null });
        return { handled: true, resposta: 'Qual nota você quer mover? Diga o título dela.', precisaEsclarecer: true };
      }
      const acao = { acao: 'mover', notaId, notaNome: movimento.notaNome, pastaNome: movimento.pastaNome };
      return { handled: true, ...await executarAcaoPendente(prisma, usuarioId, acao) };
    }
    if (pendente) return { handled: true, resposta: 'Ainda estou aguardando você identificar a nota ou a pasta. Qual item devo usar?', precisaEsclarecer: true };
    return { handled: false };
  } catch (erro) {
    throw mensagemErroBanco(erro);
  }
}
