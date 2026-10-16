/**
 * Detecção leve por palavra-chave (mesmo espírito do emotionDetector.js —
 * não é NLU de verdade, é um MVP intencional) de pedidos tipo "anota que
 * X", "lembra que X", "salva isso: X". Se bater, extrai o conteúdo real
 * a ser guardado como nota (Memory).
 */
const PADRAO_CRIAR_NOTA = /^(anota|anote|anotar|salva|salve|salvar|lembra|lembre|lembrar|grava|grave|gravar)\b[^a-zA-ZÀ-ÿ]*(que\s+|isso\s*:?\s*|a[íi]\s*:?\s*|:\s*)?(.+)/i;

export function detectarIntencaoDeNota(texto) {
  const match = texto.match(PADRAO_CRIAR_NOTA);
  if (!match) return null;

  const conteudo = match[3]?.trim();
  if (!conteudo || conteudo.length < 3) return null;

  return conteudo;
}
