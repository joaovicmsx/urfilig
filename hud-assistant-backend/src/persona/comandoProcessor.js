import { perguntarLLM } from '../llm/llmClient.js';
import { emitirEstado, emitirResposta, emitirParaUsuario } from '../socket/index.js';
import { detectarSentimento } from './emotionDetector.js';
import { detectarIntencaoDeNota } from './memoryIntent.js';
import { processarAcaoDeNotaNoChat } from './notaChatActions.js';
import { montarSystemPrompt, registrarInteracaoEmocional } from './promptBuilder.js';
import { montarParticulas } from './particlesBuilder.js';
import { sintetizarFala } from '../voice/piperClient.js';
import { prisma } from '../db/client.js';

const MESES = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};
function semAcentos(texto = '') {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function extrairNovoEvento(texto) {
  const pedido = /\b(?:cria|crie|adiciona|adicionar|marca|marcar|agenda|agendar)\b/i.test(texto)
    && /\b(?:evento|compromisso)\b/i.test(texto);
  const data = texto.match(/\b(?:no\s+)?dia\s+(\d{1,2})(?:\s+de\s+([a-záàâãéêíóôõúç]+))?(?:\s+(?:deste|desse)\s+m[eê]s)?\b/i);
  const nome = texto.match(/\b(?:chamado|chamada|com\s+(?:o\s+)?nome\s+de)\s+["“]?(.+?)["”]?\s*[.!?]*$/i);
  if (!pedido || !data || !nome) return null;
  const dia = Number(data[1]);
  const mesNome = semAcentos(data[2] || '').toLowerCase();
  const hoje = new Date();
  const mes = mesNome ? MESES[mesNome] : hoje.getMonth();
  const ano = hoje.getFullYear();
  const titulo = nome[1]
    .replace(/\s+(?:no\s+)?dia\s+\d{1,2}(?:\s+de\s+[a-záàâãéêíóôõúç]+)?(?:\s+(?:deste|desse)\s+m[eê]s)?\s*$/i, '')
    .trim()
    .replace(/[.!?]+$/, '')
    .slice(0, 160);
  const dataInicio = new Date(Date.UTC(ano, mes, dia, 12, 0, 0));
if (!titulo || mes === undefined || dataInicio.getUTCMonth() !== mes || dataInicio.getUTCDate() !== dia) return null;
  return { titulo, dataInicio };
}

const PROMPT_APRESENTACAO = `Gere uma saudação de boas-vindas calorosa pra primeira vez que a
pessoa abre o HUD, logo depois de completar o cadastro e o onboarding.
Cumprimente pelo nome dela, e mostre que você já sabe algo sobre quem ela
é — usando o que estiver disponível no perfil (idade, localização,
profissão, hobbies) de forma natural, como uma pessoa comentaria, não como
quem está recitando um formulário de volta. Não use saudação genérica tipo
"Olá, tudo bem?" — seja específica e pessoal. 2-4 frases.`;

export async function processarComando(usuarioId, texto, opcoesLLM = {}) {
  const { respostaViaHttp = false } = opcoesLLM;
  const { sentimento, prioridade } = detectarSentimento(texto);
  const conteudoNota = detectarIntencaoDeNota(texto);

  emitirEstado(usuarioId, 'THINKING');

  const acaoNota = await processarAcaoDeNotaNoChat(prisma, usuarioId, texto);
  if (acaoNota.handled) {
    const resposta = acaoNota.resposta;
    if (respostaViaHttp) {
      emitirEstado(usuarioId, 'IDLE');
      return {
        resposta,
        audio: null,
        ...(acaoNota.notaCriada && { notaCriada: { id: acaoNota.notaCriada.id, titulo: acaoNota.notaCriada.titulo, conteudo: acaoNota.notaCriada.conteudo } }),
        ...(acaoNota.notaMovida && { notaMovida: { id: acaoNota.notaMovida.id, titulo: acaoNota.notaMovida.titulo, pastaId: acaoNota.notaMovida.pastaId } }),
      };
    }
    emitirEstado(usuarioId, 'SPEAKING');
    let audio = null;
    try { audio = await sintetizarFala(resposta); } catch { /* áudio opcional */ }
    emitirResposta(usuarioId, resposta, sentimento !== 'neutro' ? sentimento : undefined, audio);
    if (acaoNota.notaCriada || acaoNota.notaMovida) emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));
    setTimeout(() => emitirEstado(usuarioId, 'IDLE'), 1500);
    return resposta;
  }

  let textoParaGemini = texto;
  let eventoCriado = null;

  // 1. Comando: Criar Pasta
  const comandoPasta = texto.match(/(?:crie|criar|cria|nova)\s+pasta\s+(?:chamada\s+)?(.+)/i);

  // 2. Comando: Editar / Atualizar Nota existente
  const comandoEditarNota = texto.match(/(?:edita|editar|atualiza|atualizar)\s+(?:a\s+)?nota\s+(?:do|da|de)?\s*([^\n,]+)/i);
  const novoEvento = extrairNovoEvento(texto);

  if (novoEvento) {
  const eventoSalvo = await prisma.evento.create({
    data: {
      usuarioId,
      titulo: novoEvento.titulo,
      descricao: 'Criado pelo chat do Urfilig.',
      dataInicio: novoEvento.dataInicio,
      dataFim: new Date(novoEvento.dataInicio.getTime() + 60 * 60 * 1000),
      cor: '#c58ad8',
      etiqueta: 'Urfilig',
    },
  });

  eventoCriado = {
    id: eventoSalvo.id,
    titulo: eventoSalvo.titulo,
    dataInicio: eventoSalvo.dataInicio.toISOString(),
    origem: 'urfilig',
  };

 const respostaDireta = 'Evento "' + eventoSalvo.titulo + '" salvo no calendário para ' + eventoSalvo.dataInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) + '.';
 if (respostaViaHttp) {
   emitirEstado(usuarioId, 'IDLE');
   return { resposta: respostaDireta, audio: null, eventoCriado };
 }

  const dataFormatada = eventoSalvo.dataInicio.toLocaleDateString('pt-BR', {
    timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric',
  });
 textoParaGemini = `O evento "${eventoSalvo.titulo}" foi salvo no calendário interno do Urfilig para ${dataFormatada}. Confirme brevemente.`;
} else

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

  const systemPrompt = await montarSystemPrompt(usuarioId, {
    sentimento, prioridade,
    responseStyle: opcoesLLM.responseStyle,
    responseTone: opcoesLLM.responseTone,
  });
  const resposta = await perguntarLLM(textoParaGemini, systemPrompt, { provider: opcoesLLM.provider });

  emitirEstado(usuarioId, 'SPEAKING');
  const audio = await sintetizarFala(resposta);
  if (!respostaViaHttp) {
    emitirResposta(usuarioId, resposta, sentimento !== 'neutro' ? sentimento : undefined, audio);
  }

  await registrarInteracaoEmocional(usuarioId, { sentimento, contexto: texto, respostaDada: resposta });
  emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));

  setTimeout(() => emitirEstado(usuarioId, 'IDLE'), 1500);

  return respostaViaHttp
    ? { resposta, audio: audio?.toString('base64') || null, eventoCriado }
    : resposta;
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
