 import { perguntarGemini } from './geminiClient.js';
 import { perguntarOllama } from './ollamaClient.js';
 import { perguntarGroq } from './groqClient.js';
 
 const FALLBACK_ATIVO = (process.env.LLM_FALLBACK ?? 'true') !== 'false';
 
 export async function perguntarLLM(prompt, systemPrompt = '', { formatoJson = false, provider } = {}) {
   const escolhido = provider || process.env.LLM_PROVIDER || 'groq';
 
   if (escolhido === 'ollama') return perguntarOllama(prompt, systemPrompt, { formatoJson });
   if (!['gemini', 'groq'].includes(escolhido)) {
     throw new Error('Provedor de IA inválido. Use Groq, Gemini ou Ollama.');
   }
 
   try {
     if (escolhido === 'groq') return await perguntarGroq(prompt, systemPrompt, { formatoJson });
     return await perguntarGemini(prompt, systemPrompt, { formatoJson });
   } catch (erro) {
     if (!FALLBACK_ATIVO) throw erro;
 
     console.warn('[llmClient] ' + escolhido + ' falhou; caindo pro Ollama local.', erro.message);
    try {
       return await perguntarOllama(prompt, systemPrompt, { formatoJson });
     } catch (erroOllama) {
      throw new Error(escolhido + ' falhou (' + erro.message + ') e o fallback Ollama também falhou (' + erroOllama.message + ')');
     }
   }
 }