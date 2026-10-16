import { perguntarLLM } from '../llm/llmClient.js';
import { emitirEstado, emitirResposta, emitirParaUsuario } from '../socket/index.js';
import { detectarSentimento } from './emotionDetector.js';
import { detectarIntencaoDeNota } from './memoryIntent.js';
import { montarSystemPrompt, registrarInteracaoEmocional } from './promptBuilder.js';
import { montarParticulas } from './particlesBuilder.js';
import { sintetizarFala } from '../voice/piperClient.js';
import { prisma } from '../db/client.js';

const PROMPT_APRESENTACAO = `Gere uma saudação de boas-vindas calorosa pra primeira vez que a
pessoa abre o HUD, logo depois de completar o cadastro e o onboarding.
Cumprimente pelo nome dela, e mostre que você já sabe algo sobre quem ela
é — usando o que estiver disponível no perfil (idade, localização,
profissão, hobbies) de forma natural, como uma pessoa comentaria, não como
quem está recitando um formulário de volta. Não use saudação genérica tipo
"Olá, tudo bem?" — seja específica e pessoal. 2-4 frases.`;

export async function processarComando(usuarioId, texto) {
  const { sentimento, prioridade } = detectarSentimento(texto);
  const conteudoNota = detectarIntencaoDeNota(texto);

  emitirEstado(usuarioId, 'THINKING');

  let textoParaGemini = texto;

  // 1. Comando: Criar Pasta
  const comandoPasta = texto.match(/(?:crie|criar|cria|nova)\s+pasta\s+(?:chamada\s+)?(.+)/i);

  // 2. Comando: Editar / Atualizar Nota existente
  const comandoEditarNota = texto.match(/(?:edita|editar|atualiza|atualizar)\s+(?:a\s+)?nota\s+(?:do|da|de)?\s*([^\n,]+)/i);

  if (comandoPasta && comandoPasta[1]) {
    const nomePasta = comandoPasta[1].trim().replace(/[.\s]+$/, '');
    
    const novaPasta = await prisma.pasta.create({
      data: {
        usuarioId,
        nome: nomePasta
      }
    });

    textoParaGemini = `O usuário pediu para criar uma pasta chamada "${novaPasta.nome}". A pasta já foi criada com sucesso no banco de dados. Confirme de forma breve.`;
  } 
  else if (comandoEditarNota && comandoEditarNota[1]) {
    const termoBusca = comandoEditarNota[1].trim().toLowerCase();

    // Busca a nota correspondente no banco do usuário
    const notasDoUsuario = await prisma.nota.findMany({
      where: {
        pasta: { usuarioId }
      },
      include: { pasta: true }
    });

    const notaEncontrada = notasDoUsuario.find(n => 
      n.titulo.toLowerCase().includes(termoBusca) || termoBusca.includes(n.titulo.toLowerCase())
    );

    if (notaEncontrada) {
      // Extrai o conteúdo relevante fornecido pelo usuário
      const novoConteudo = texto.replace(/(?:edita|editar|atualiza|atualizar)\s+(?:a\s+)?nota\s+(?:do|da|de)?\s*[^\n,]+/i, '').replace(/^(?:,\s*|adiciona\s+|adicionando\s+|com\s+)/i, '').trim() || texto;

      const notaAtualizada = await prisma.nota.update({
        where: { id: notaEncontrada.id },
        data: { conteudo: novoConteudo }
      });

      textoParaGemini = `A nota "${notaAtualizada.titulo}" da pasta "${notaEncontrada.pasta.nome}" foi atualizada com sucesso para: "${notaAtualizada.conteudo}". Confirme ao usuário que a nota foi editada.`;
    }
  } 
  else if (conteudoNota) {
    await prisma.memory.create({
      data: {
        usuarioId,
        categoria: 'nota',
        titulo: conteudoNota.slice(0, 60),
        conteudo: conteudoNota,
        tags: '',
      },
    });
    textoParaGemini = `O usuário pediu pra você guardar isto: "${conteudoNota}". Você já salvou. Confirme isso de forma breve.`;
  }

  const systemPrompt = await montarSystemPrompt(usuarioId, { sentimento, prioridade });
  const resposta = await perguntarLLM(textoParaGemini, systemPrompt);

  emitirEstado(usuarioId, 'SPEAKING');
  const audioBase64 = await sintetizarFala(resposta);
  emitirResposta(usuarioId, resposta, sentimento !== 'neutro' ? sentimento : undefined, audioBase64);

  await registrarInteracaoEmocional(usuarioId, { sentimento, contexto: texto, respostaDada: resposta });
  emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));

  setTimeout(() => emitirEstado(usuarioId, 'IDLE'), 1500);

  return resposta;
}

export async function gerarApresentacaoInicial(usuarioId) {
  emitirEstado(usuarioId, 'THINKING');
  const systemPrompt = await montarSystemPrompt(usuarioId, { sentimento: 'neutro', prioridade: 'normal' });
  const resposta = await perguntarLLM(PROMPT_APRESENTACAO, systemPrompt);

  emitirEstado(usuarioId, 'SPEAKING');
  const audioBase64 = await sintetizarFala(resposta);
  emitirResposta(usuarioId, resposta, undefined, audioBase64);

  emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));
  setTimeout(() => emitirEstado(usuarioId, 'IDLE'), 1500);

  return resposta;
}