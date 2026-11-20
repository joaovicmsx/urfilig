import { perguntarLLM } from '../llm/llmClient.js';
import { emitirEstado, emitirResposta, emitirParaUsuario } from '../socket/index.js';
import { detectarSentimento } from './emotionDetector.js';
import { detectarIntencaoDeNota } from './memoryIntent.js';
import { processarAcaoDeNotaNoChat } from './notaChatActions.js';
import { montarSystemPrompt, registrarInteracaoEmocional } from './promptBuilder.js';
import { montarParticulas } from './particlesBuilder.js';
import { sintetizarFala } from '../voice/piperClient.js';
import { prisma } from '../db/client.js';

// Importação do cliente HTTP para a API em Python do Urfilig (ajuste o caminho se necessário)
import { askUrfilig } from '../services/UrfiligClient.js';

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

function montarMensagemComContexto(texto, systemPrompt, historico) {
  // A API local pode impor limites menores que o backend. Mantenha a
  // mensagem abaixo de 3.5 mil caracteres e preserve sempre o pedido atual.
  if (texto.length > 2600) return texto;
  const conversa = historico.slice(-3).map((item) => `${item.autor}: ${item.texto.slice(0, 250)}`).join('\n');
  const sufixo = '\n\nContexto de resposta (use somente para formular a resposta):\n';
  const disponivel = Math.max(0, 3500 - texto.length - sufixo.length - conversa.length - 30);
  const instrucoes = String(systemPrompt || '').slice(0, Math.min(1600, Math.floor(disponivel * 0.65)));
  const historicoLimitado = conversa.slice(0, Math.max(0, disponivel - instrucoes.length));
  return `${texto}${sufixo}${instrucoes}${historicoLimitado ? `\nHistórico recente:\n${historicoLimitado}` : ''}`;
}

export async function processarComando(usuarioId, texto, opcoesLLM = {}) {
  const { respostaViaHttp = false } = opcoesLLM;
  const historico = Array.isArray(opcoesLLM.historico) ? opcoesLLM.historico : [];
  const { sentimento, prioridade } = detectarSentimento(texto);
  const conteudoNota = detectarIntencaoDeNota(texto);

  emitirEstado(usuarioId, 'THINKING');

  // 1. Processar ações específicas de nota (banco local Prisma)
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
    return resposta;
  }

let textoParaResposta = texto;
  let eventoCriado = null;
  let comandoExecutadoDireto = false;
  let particulasAlteradas = false;

  // 2. Comandos específicos de sistema (Criar Pasta, Editar Nota, Criar Evento, Guardar Memória)
  const comandoPasta = texto.match(/(?:crie|criar|cria|nova)\s+pasta\s+(?:chamada\s+)?(.+)/i);
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
    textoParaResposta = `O evento "${eventoSalvo.titulo}" foi salvo no calendário interno do Urfilig para ${dataFormatada}. Confirme brevemente.`;
    comandoExecutadoDireto = true;
  } 
  else if (comandoPasta && comandoPasta[1]) {
    const nomePasta = comandoPasta[1].trim().replace(/[.\s]+$/, '');
    const novaPasta = await prisma.pasta.create({
      data: { usuarioId, nome: nomePasta }
    });
    particulasAlteradas = true;
    textoParaResposta = `O usuário pediu para criar uma pasta chamada "${novaPasta.nome}". A pasta já foi criada com sucesso no banco de dados. Confirme de forma breve.`;
    comandoExecutadoDireto = true;
  } 
  else if (comandoEditarNota && comandoEditarNota[1]) {
    const termoBusca = comandoEditarNota[1].trim().toLowerCase();
    const notasDoUsuario = await prisma.nota.findMany({
      where: { pasta: { usuarioId } },
      include: { pasta: true }
    });
    const notaEncontrada = notasDoUsuario.find(n => 
      n.titulo.toLowerCase().includes(termoBusca) || termoBusca.includes(n.titulo.toLowerCase())
    );

    if (notaEncontrada) {
      const novoConteudo = texto.replace(/(?:edita|editar|atualiza|atualizar)\s+(?:a\s+)?nota\s+(?:do|da|de)?\s*[^\n,]+/i, '').replace(/^(?:,\s*|adiciona\s+|adicionando\s+|com\s+)/i, '').trim() || texto;
      const notaAtualizada = await prisma.nota.update({
        where: { id: notaEncontrada.id },
        data: { conteudo: novoConteudo }
      });
      textoParaResposta = `A nota "${notaAtualizada.titulo}" da pasta "${notaEncontrada.pasta.nome}" me foi atualizada com sucesso para: "${notaAtualizada.conteudo}". Confirme ao usuário que a nota foi editada.`;
      comandoExecutadoDireto = true;
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
    particulasAlteradas = true;
    textoParaResposta = `O usuário pediu pra você guardar isto: "${conteudoNota}". Você já salvou. Confirme isso de forma breve.`;
    comandoExecutadoDireto = true;
  }

  // 3. FLUXO DE INTELIGÊNCIA / RESPOSTA (Python API -> Fallback LLM)
  let resposta = '';
  let systemPrompt;

  // Se NÃO foi um comando do banco interno (criar pasta, evento, nota), consulta o servidor Python primeiro
  if (!comandoExecutadoDireto) {
    try {
      systemPrompt = await montarSystemPrompt(usuarioId, {
        sentimento, prioridade,
        responseStyle: opcoesLLM.responseStyle,
        responseTone: opcoesLLM.responseTone,
      });
      const mensagemComContexto = montarMensagemComContexto(texto, systemPrompt, historico);
      const respostaUrfilig = await askUrfilig(mensagemComContexto, false); // web: false por padrão

      // Se o Urfilig local souber (notes, web, model ou smalltalk), usa a resposta dele
      if (respostaUrfilig && respostaUrfilig.source !== 'none') {
        resposta = respostaUrfilig.reply;
      } else {
        const respostaSimples = await askUrfilig(texto, false);
        if (respostaSimples && respostaSimples.source !== 'none') resposta = respostaSimples.reply;
      }
    } catch (err) {
      console.warn('API própria do Urfilig rejeitou o contexto, tentando a mensagem sem contexto:', err.message);
      if (!systemPrompt || err.status === 400) {
        try {
          const respostaSimples = await askUrfilig(texto, false);
          if (respostaSimples && respostaSimples.source !== 'none') resposta = respostaSimples.reply;
        } catch (erroSimples) {
          console.warn('API própria também rejeitou a mensagem simples:', erroSimples.message);
        }
      }
    }
  }

  // 4. Usa a IA própria também para confirmar comandos que alteraram dados.
  if (!resposta) {
    if (!systemPrompt) {
      try {
        systemPrompt = await montarSystemPrompt(usuarioId, {
          sentimento, prioridade,
          responseStyle: opcoesLLM.responseStyle,
          responseTone: opcoesLLM.responseTone,
        });
      } catch (erroContexto) {
        console.warn('[prompt] contexto pessoal indisponível; usando contexto básico:', erroContexto?.code || erroContexto?.name || 'falha');
        systemPrompt = 'Você é a Urfilig, assistente pessoal do usuário. Responda em português com clareza e concisão.';
      }
    }
    resposta = await perguntarLLM(textoParaResposta, systemPrompt);
  }

  // 5. Envio de resposta e áudio
  emitirEstado(usuarioId, 'SPEAKING');
  let audio = null;
  try {
    audio = await sintetizarFala(resposta);
  } catch (err) {
    console.warn('Erro ao sintetizar fala:', err.message);
  }

  if (!respostaViaHttp) {
    emitirResposta(usuarioId, resposta, sentimento !== 'neutro' ? sentimento : undefined, audio);
  }

  await registrarInteracaoEmocional(usuarioId, { sentimento, contexto: texto, respostaDada: resposta });
  if (particulasAlteradas) {
    emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));
  }

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
  return resposta;
}
