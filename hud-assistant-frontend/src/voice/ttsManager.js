/**
 * Voz da Urfilig via Web Speech API (SpeechSynthesis) — nativa do
 * navegador, sem custo, sem servidor externo.
 *
 * ⚠️ Limitação técnica importante: a Web Speech API não expõe o áudio
 * sintetizado como um stream editável, então **não é possível aplicar um
 * filtro eletrônico/robótico de verdade** por cima da voz (bitcrusher,
 * ring modulator, etc.) — o navegador gera o áudio internamente e manda
 * direto pro alto-falante, sem um nó de Web Audio no meio. O que dá pra
 * fazer aqui é escolher a voz em português mais natural disponível no sistema
 * e ajustar levemente o tom e o ritmo. A lista depende das vozes instaladas.
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
      const prioridade = (voz) => {
        const nome = voz.name || '';
        return (/natural|online|neural/i.test(nome) ? 2 : 0)
          + (/francisca|maria|luciana|helena|fernanda|camila|zira/i.test(nome) ? 1 : 0);
      };
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
export function falar(texto, { onEnd } = {}) {
  if (!ativa || !texto || !('speechSynthesis' in window)) return false;

  window.speechSynthesis.cancel(); // interrompe qualquer fala anterior ainda em andamento

  const textoLimpo = texto
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/([.!?])\1+/g, '$1')
    .trim();
  const utterance = new SpeechSynthesisUtterance(textoLimpo);
  if (vozEscolhida) utterance.voice = vozEscolhida;
  utterance.lang = 'pt-BR';
  utterance.onerror = (evento) => console.warn('[voz] a voz do sistema falhou:', evento.error || 'erro sem detalhe');
  utterance.onstart = () => console.info('[voz] voz do sistema iniciada');
  utterance.onend = () => onEnd?.();

  // Tom mais fino e ritmo natural. Limpa marcação de listas para evitar que
  // símbolos e quebras artificiais causem pausas estranhas na fala.
  utterance.pitch = 1.2;
  utterance.rate = 1.08;
  utterance.volume = 0.9;

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
