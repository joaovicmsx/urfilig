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
const PISTAS_VOZ_FEMININA = [/maria/i, /female/i, /woman/i, /luciana/i, /francisca/i, /helena/i, /fernanda/i, /camila/i, /zira/i, /feminina/i];

let vozEscolhida = null;
let ativa = true;

function escolherVoz() {
  if (!('speechSynthesis' in window)) return;
  const vozes = window.speechSynthesis.getVoices();
  if (vozes.length === 0) return;

  const candidatasPt = vozes.filter((voz) => voz.lang?.toLowerCase().startsWith('pt'));
  const feminina = candidatasPt
    .filter((voz) => PISTAS_VOZ_FEMININA.some((regex) => regex.test(voz.name)))
    .sort((a, b) => {
      const prioridade = (voz) => /natural|online|neural/i.test(voz.name) ? 1 : 0;
      return prioridade(b) - prioridade(a);
    })[0];

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
  if (!ativa || !texto || !('speechSynthesis' in window)) return false;

  window.speechSynthesis.cancel(); // interrompe qualquer fala anterior ainda em andamento

  const utterance = new SpeechSynthesisUtterance(texto);
  if (vozEscolhida) utterance.voice = vozEscolhida;
  utterance.lang = 'pt-BR';
  utterance.onerror = (evento) => console.warn('[voz] a voz do sistema falhou:', evento.error || 'erro sem detalhe');
  utterance.onstart = () => console.info('[voz] voz do sistema iniciada');

  // Interpretação mais introspectiva: tom um pouco mais agudo,
  // ritmo calmo e volume suave. Mantém uma entrega natural em português.
  utterance.pitch = 1.15;
  utterance.rate = 1;
  utterance.volume = 0.86;

  window.speechSynthesis.speak(utterance);
  // Algumas versões do WebView2 carregam as vozes depois da primeira fala.
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  return true;
}

export function pararFala() {
  window.speechSynthesis?.cancel();
}

export function definirVozAtiva(valor) {
  ativa = valor;
  if (!valor) pararFala();
}
