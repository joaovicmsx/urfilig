 import 'dotenv/config';
 const apiKey = process.env.GROQ_API_KEY;
 
 export async function perguntarGroq(prompt, systemPrompt = '', { formatoJson = false } = {}) {
   if (!apiKey) throw new Error('Groq indisponível: configure GROQ_API_KEY.');
   const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
     method: 'POST',
     headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
     body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }], temperature: 0.6, ...(formatoJson ? { response_format: { type: 'json_object' } } : {}) }),
   });
   const dados = await resposta.json().catch(() => ({}));
   if (!resposta.ok) throw new Error(dados.error?.message || 'Groq respondeu HTTP ' + resposta.status);
   const texto = dados.choices?.[0]?.message?.content;
   if (!texto || !texto.trim()) throw new Error('Groq respondeu sem conteúdo.');
   return texto.trim();
 }