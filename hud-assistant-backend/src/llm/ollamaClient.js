import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

// Inicializa o cliente do Gemini usando a chave GEMINI_API_KEY do seu ficheiro .env
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Envia um prompt para a API do Google Gemini e retorna o texto de resposta.
 * Mantivemos o nome 'perguntarOllama' para não quebrar os imports do projeto.
 * 
 * `formatoJson: true` ativa o modo JSON nativo (usado pelo evolutionJob.js).
 */
export async function perguntarOllama(prompt, systemPrompt = '', { formatoJson = false } = {}) {
  const config = {};

  // Se houver um systemPrompt (personalidade/contexto), injeta nas configurações
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }

  // Se for exigido JSON (ex: evolutionJob), força o MIME type
  if (formatoJson) {
    config.responseMimeType = 'application/json';
  }

  try {
    const resposta = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: config,
    });

    return resposta.text;
  } catch (erro) {
    throw new Error(`Gemini respondeu com erro: ${erro.message}`);
  }
}