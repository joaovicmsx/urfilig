import { perguntarGemini } from './geminiClient.js';
import { perguntarOllama } from './ollamaClient.js';

// Se true, o fallback pro Ollama fica desativado (via .env: LLM_FALLBACK=false)
const FALLBACK_ATIVO = (process.env.LLM_FALLBACK ?? 'true') !== 'false';

/**
 * Verifica se o erro parece ser de cota/rate limit da API do Gemini
 * (429 / RESOURCE_EXHAUSTED / "quota").
 */
function erroDeQuota(erro) {
  const msg = String(erro?.message ?? erro).toLowerCase();
  const status = erro?.status ?? erro?.code ?? erro?.httpStatus;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}

/**
 * Ponto único de acesso ao LLM. Tenta o Gemini primeiro; se a chamada falhar
 * (quota estourada, rate limit, rede, etc.), cai automaticamente pro Ollama
 * local, que não tem limite de requisições.
 *
 * Assinatura idêntica às dos clients individuais, então basta trocar o import
 * nos arquivos que consomem.
 */
export async function perguntarLLM(prompt, systemPrompt = '', { formatoJson = false } = {}) {
  try {
    return await perguntarGemini(prompt, systemPrompt, { formatoJson });
  } catch (erro) {
    if (!FALLBACK_ATIVO) throw erro;

    console.warn(
      `[llmClient] Gemini falhou (${erroDeQuota(erro) ? 'quota/rate limit' : 'erro'}); caindo pro Ollama local.`,
      erro.message
    );

    try {
      return await perguntarOllama(prompt, systemPrompt, { formatoJson });
    } catch (erroOllama) {
      throw new Error(
        `Gemini falhou (${erro.message}) e o fallback pro Ollama também falhou (${erroOllama.message})`
      );
    }
  }
}
