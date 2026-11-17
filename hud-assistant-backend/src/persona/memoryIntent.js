/**
 * Detecção leve por palavra-chave (mesmo espírito do emotionDetector.js —
 * não é NLU de verdade, é um MVP intencional) de pedidos tipo "anota que
 * X", "lembra que X", "salva isso: X". Anotações explícitas viram Notas;
 * lembretes e memórias continuam no fluxo de Memory.
 */
const PADRAO_CRIAR_NOTA = /^(anota|anote|anotar|salva|salve|salvar|lembra|lembre|lembrar|grava|grave|gravar)\b[^a-zA-ZÀ-ÿ]*(que\s+|isso\s*:?\s*|a[íi]\s*:?\s*|:\s*)?(.+)/i;

function separarPastaFinal(texto) {
  const valor = String(texto || '').trim();
  const pasta = valor.match(/\s+(?:na|em)\s+pasta\s+(.+?)\s*[.!?]*$/i);
  if (!pasta) return { texto: valor, pastaNome: null };
  return {
    texto: valor.slice(0, pasta.index).trim(),
    pastaNome: limparTitulo(pasta[1]),
  };
}

function limparTitulo(titulo) {
  return String(titulo || '').trim().replace(/^(["“'`])/, '').replace(/["”'`]$/, '').replace(/[.!?]+$/, '').trim();
}

export function detectarCriacaoDeNota(texto) {
  const entrada = String(texto || '').trim();
  const explicita = entrada.match(/^\s*(?:cria|crie|criar|faça|faca|faz)\s+(?:(?:uma?|a)\s+)?nota\b(?:\s+(?:nova|novo))?(.*)$/i);

  if (explicita) {
    let { texto: restante, pastaNome } = separarPastaFinal(explicita[1]);
    const nomeExplicito = restante.match(/^\s*(?:com\s+)?(?:o\s+)?(?:nome|t[ií]tulo)\s+de\s+(.+)$/i);
    if (nomeExplicito) {
      restante = nomeExplicito[1];
    } else {
      const chamada = restante.match(/^\s*chamad[oa]\s+(.+)$/i);
      if (chamada) restante = chamada[1];
    }
    restante = restante.replace(/^\s*[:\-–]\s*/, '');
    const titulo = limparTitulo(restante);
    if (!titulo) return { titulo: null, conteudo: '', pastaNome, requerTitulo: true };
    return { titulo, conteudo: '', pastaNome, requerTitulo: false };
  }

  // Anotações pedidas com “anota...” devem aparecer no painel de Notas.
  const anotar = entrada.match(/^anota(?:r)?\b[^a-zA-ZÀ-ÿ]*(que\s+|isso\s*:?\s*|a[íi]\s*:?\s*|:\s*)?(.+)/i)
    || entrada.match(/^anote\b[^a-zA-ZÀ-ÿ]*(que\s+|isso\s*:?\s*|a[íi]\s*:?\s*|:\s*)?(.+)/i);
  const partesAnotacao = anotar ? separarPastaFinal(anotar[2]) : null;
  const conteudo = partesAnotacao?.texto;
  if (conteudo && conteudo.length >= 3) {
    return {
      titulo: limparTitulo(conteudo).slice(0, 160),
      conteudo,
      pastaNome: partesAnotacao.pastaNome,
      requerTitulo: false,
    };
  }
  return null;
}

export function detectarMovimentoDeNota(texto) {
  const entrada = String(texto || '').trim();
  const match = entrada.match(/^(?:coloca|coloque|p[õo]e|move|mova|passa|passe|adiciona|adicione|transfere|transfira)\s+(?:a\s+)?(?:nota\s+)?(.+?)\s+(?:na|em|para|pra)\s+(?:pasta\s+)?(.+?)\s*[.!?]*$/i);
  if (!match) return null;

  const referencia = limparTitulo(match[1]).replace(/^(?:a|o)\s+/i, '').trim();
  const pastaNome = limparTitulo(match[2]);
  const pronome = /^(?:ela|ele|essa|este|esta|essa nota|ela mesma|ele mesmo|ela aí)$/i.test(referencia);
  if (!referencia || !pastaNome) return null;
  return { notaNome: pronome ? null : referencia, usaUltimaNota: pronome, pastaNome };
}

export function detectarIntencaoDeNota(texto) {
  const match = texto.match(PADRAO_CRIAR_NOTA);
  if (!match) return null;

  const conteudo = match[3]?.trim();
  if (!conteudo || conteudo.length < 3) return null;

  return conteudo;
}
