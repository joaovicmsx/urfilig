/**
 * Detecção leve de sinais emocionais por palavra-chave — não é análise de
 * sentimento de verdade, é um MVP intencionalmente simples. Suficiente pra
 * disparar um ajuste de tom na resposta; não deve ser tratado como
 * diagnóstico de estado emocional real.
 */
const PADROES = {
  estresse: /estressad[oa]|sobrecarregad[oa]|não aguento|apertado com (o )?prazo/i,
  tristeza: /triste|desanimad[oa]|sem vontade|para baixo/i,
  frustracao: /frustrad[oa]|irritad[oa]|puto|puta|deu erro de novo|não funciona nunca/i,
  entusiasmo: /consegui|funcionou|deu certo|show|mandou bem/i,
};

// Sinais que pedem uma resposta humana de verdade, não um ajuste de tom do
// personagem. Se aparecer isso, a prioridade é acolher e indicar apoio real
// — a lógica de persona/bordão fica em segundo plano nessa resposta.
const SINAIS_DE_ALERTA = /não aguento mais viver|quero desistir de tudo|não vejo saída|me machucar/i;

export function detectarSentimento(texto) {
  if (SINAIS_DE_ALERTA.test(texto)) {
    return { sentimento: 'alerta', prioridade: 'suporte_real' };
  }

  for (const [sentimento, regex] of Object.entries(PADROES)) {
    if (regex.test(texto)) {
      return { sentimento, prioridade: 'ajuste_de_tom' };
    }
  }

  return { sentimento: 'neutro', prioridade: 'normal' };
}
