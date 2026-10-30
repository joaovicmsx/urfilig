import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Envia o prompt exclusivamente para a API do Gemini.
 */
export async function perguntarGemini(prompt, systemPrompt = '', { formatoJson = false } = {}) {
  if (!ai) {
    const error = new Error('Gemini indisponível: configure GEMINI_API_KEY no ambiente do backend.');
    error.code = 'GEMINI_NOT_CONFIGURED';
    throw error;
  }

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

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
    const mensagem = String(error?.message || '');
    if (Number(error?.status) === 401 || Number(error?.status) === 403 || /API key not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(mensagem)) {
      const configuracao = new Error('A chave configurada para Gemini foi rejeitada. Use uma chave da Gemini API criada no Google AI Studio; tokens OAuth não são aceitos como GEMINI_API_KEY.');
      configuracao.code = 'GEMINI_INVALID_API_KEY';
      throw configuracao;
    }
    console.error('[GeminiClient] Erro na chamada do Gemini:', error.status || error.code || 'erro');
    throw error;
  }
}
