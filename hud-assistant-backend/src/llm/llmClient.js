import { askUrfilig } from '../services/UrfiligClient.js';

/** Usa a IA própria do Urfilig para gerar texto; o Piper continua responsável pela voz. */
export async function perguntarLLM(prompt, systemPrompt = '', { formatoJson = false } = {}) {
  const instrucoes = [
    systemPrompt.trim(),
    formatoJson ? 'Responda somente com um objeto JSON válido, sem Markdown ou texto adicional.' : '',
  ].filter(Boolean).join('\n\n');
  const mensagem = instrucoes ? `${instrucoes}\n\nSolicitação:\n${prompt}` : prompt;
  const resultado = await askUrfilig(mensagem, false);
  const resposta = typeof resultado?.reply === 'string' ? resultado.reply.trim() : '';
  if (!resposta || resultado?.source === 'none') {
    const erro = new Error('A IA própria do Urfilig não conseguiu gerar uma resposta.');
    erro.code = 'URFILIG_NO_RESPONSE';
    throw erro;
  }
  return resposta;
}
