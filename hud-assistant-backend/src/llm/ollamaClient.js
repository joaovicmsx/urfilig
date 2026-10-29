import 'dotenv/config';

const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

/** Chama o servidor Ollama local pelo endpoint oficial /api/chat. */
export async function perguntarOllama(prompt, systemPrompt = '', { formatoJson = false, model } = {}) {
  const nomeModelo = model || process.env.OLLAMA_MODEL || 'llama3.1';
  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS) || 120000),
      body: JSON.stringify({
        model: nomeModelo,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        stream: false,
        ...(formatoJson ? { format: 'json' } : {}),
      }),
    });
  } catch (error) {
    throw new Error(`Ollama indisponível. Inicie o serviço e confirme se o modelo ${nomeModelo} está instalado. (${error.message})`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Ollama respondeu HTTP ${response.status}. Verifique se o modelo ${nomeModelo} está instalado.`);
  const text = payload.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Ollama respondeu sem conteúdo.');
  return text.trim();
}
