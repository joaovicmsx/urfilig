import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Envia o prompt exclusivamente para a API do Gemini.
 */
export async function perguntarGemini(prompt, systemPrompt = '', { formatoJson = false } = {}) {
  if (!ai) {
    console.error('[GeminiClient] Erro: GEMINI_API_KEY não configurada no .env');
    if (formatoJson) {
      return JSON.stringify({ erro: 'Chave de API não configurada.' });
    }
    return 'Chave do Gemini não configurada no servidor.';
  }

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const config = {
      systemInstruction: systemPrompt || undefined,
      temperature: 0.6,
    };

    if (formatoJson) {
      config.responseMimeType = 'application/json';
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: config
    });

    return response.text;

  } catch (error) {
    console.error('[GeminiClient] Erro na chamada do Gemini:', error.status || error.message);

    if (error.status === 429 || error.message?.includes('429')) {
      if (formatoJson) {
        return JSON.stringify({ erro: 'Limite de requisições excedido. Tente em alguns segundos.' });
      }
      return 'Excedi o limite de chamadas momentâneo da API. Aguarde alguns segundos e tente novamente!';
    }

    if (formatoJson) {
      return JSON.stringify({ erro: 'Não foi possível processar o comando no momento.' });
    }
    return 'Desculpe, tive um problema ao consultar minha inteligência. Tente novamente em instantes!';
  }
}