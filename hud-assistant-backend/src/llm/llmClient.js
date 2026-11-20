import { askUrfilig } from '../services/UrfiligClient.js';

const TIMEOUT_MS = 30_000;

/** Envia somente o texto digitado no chat para a API conversacional própria. */
export async function conversarComUrfilig(texto) {
  const mensagem = typeof texto === 'string' ? texto.trim() : '';
  if (!mensagem || mensagem.length > 2000) {
    const erro = new Error('A mensagem deve conter entre 1 e 2000 caracteres.');
    erro.code = 'URFILIG_API_ERROR';
    erro.status = 400;
    throw erro;
  }

  try {
    const resultado = await askUrfilig(mensagem, false, TIMEOUT_MS);
    return {
      reply: typeof resultado?.reply === 'string' ? resultado.reply.trim() : '',
      source: typeof resultado?.source === 'string' ? resultado.source : 'none',
    };
  } catch (causa) {
    const erro = new Error('A API própria do Urfilig está indisponível ou rejeitou a solicitação.');
    erro.code = 'URFILIG_API_ERROR';
    if (Number.isInteger(causa?.status)) erro.status = causa.status;
    erro.cause = causa;
    throw erro;
  }
}
