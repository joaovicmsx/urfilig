/**
 * Voz da Urfilig via Web Speech API (SpeechSynthesis) — nativa do
 * navegador, sem custo, sem servidor externo.
 *
 * ⚠️ Limitação técnica importante: a Web Speech API não expõe o áudio
 * sintetizado como um stream editável, então **não é possível aplicar um
 * filtro eletrônico/robótico de verdade** por cima da voz (bitcrusher,
 * ring modulator, etc.) — o navegador gera o áudio internamente e manda
 * direto pro alto-falante, sem um nó de Web Audio no meio. O que dá pra
 * fazer aqui é aproximar o efeito "etéreo/melancólico" (inspirado na
 * banda Daughter) via escolha de voz + tom (pitch) mais grave + fala mais
 * devagar. Se quiser o toque eletrônico de verdade depois, isso normalmente
 * exige um motor de TTS dedicado (ElevenLabs, Piper com pós-processamento)
 * — um passo futuro maior, não um ajuste de parâmetro.
 */

// Heurística pra achar uma voz feminina em português — a Web Speech API
// não expõe gênero explicitamente, só nome/idioma, então isso é
// aproximado e depende de quais vozes o sistema operacional do usuário
// tem instaladas (varia entre Windows/Mac/navegadores).
const PISTAS_VOZ_FEMININA = [/maria/i, /female/i, /woman/i, /luciana/i, /francisca/i, /helena/i];

let vozEscolhida = null;
let ativa = true;

function escolherVoz() {
  if (!('speechSynthesis' in window)) return;
  const vozes = window.speechSynthesis.getVoices();
  if (vozes.length === 0) return; // ainda não carregou — onvoiceschanged vai chamar de novo

  const candidatasPt = vozes.filter((v) => v.lang?.toLowerCase().startsWith('pt'));
  const feminina = candidatasPt.find((v) => PISTAS_VOZ_FEMININA.some((regex) => regex.test(v.name)));

  vozEscolhida = feminina || candidatasPt[0] || vozes[0] || null;
  console.log('[voz]', vozEscolhida ? `usando "${vozEscolhida.name}"` : 'nenhuma voz encontrada nesse navegador.');
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = escolherVoz;
  escolherVoz(); // pode já vir populado em alguns navegadores, sem esperar o evento
}

/**
 * Fala o texto da resposta. Chamado automaticamente sempre que uma
 * resposta da IA chega (ver onResponse no main.js) — não precisa ser
 * disparado manualmente em cada lugar que recebe texto.
 */
export function falar(texto) {
  if (!ativa || !texto || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // interrompe qualquer fala anterior ainda em andamento

  const utterance = new SpeechSynthesisUtterance(texto);
  if (vozEscolhida) utterance.voice = vozEscolhida;
  utterance.lang = 'pt-BR';

  // Tom mais AGUDO (fina) + ritmo mais devagar (melancólica/arrastada) —
  // ajustado a partir do feedback real de que a versão anterior (mais
  // grave) não combinava. pitch vai de 0 a 2 (1 = padrão); rate de 0.1 a
  // 10 (1 = padrão). Se ainda não estiver no ponto, mexe só nesses 2
  // números — 1.3/1.4 de pitch é "fina" perceptível sem virar cômico.
  utterance.pitch = 1.3;
  utterance.rate = 0.82;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

export function pararFala() {
  window.speechSynthesis?.cancel();
}

export function definirVozAtiva(valor) {
  ativa = valor;
  if (!valor) pararFala();
}
