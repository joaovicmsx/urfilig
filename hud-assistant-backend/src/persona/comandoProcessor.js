import { conversarComUrfilig } from '../llm/llmClient.js';
import { emitirEstado, emitirResposta, emitirParaUsuario } from '../socket/index.js';
import { detectarSentimento } from './emotionDetector.js';
import { detectarIntencaoDeNota } from './memoryIntent.js';
import { processarAcaoDeNotaNoChat } from './notaChatActions.js';
import { registrarInteracaoEmocional } from './promptBuilder.js';
import { montarParticulas } from './particlesBuilder.js';
import { sintetizarFala } from '../voice/piperClient.js';
import { prisma } from '../db/client.js';

// Importação do cliente HTTP para a API em Python do Urfilig (ajuste o caminho se necessário)
import { respostaPronta, respostaQuandoNaoSabe } from './respostasProntas.js';

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

export async function processarComando(usuarioId, texto, opcoesLLM = {}) {
  const { respostaViaHttp = false } = opcoesLLM;
  const { sentimento, prioridade } = detectarSentimento(texto);
  const conteudoNota = detectarIntencaoDeNota(texto);

  emitirEstado(usuarioId, 'THINKING');

  // 1. Processar ações específicas de nota (banco local Prisma)
  const acaoNota = await processarAcaoDeNotaNoChat(prisma, usuarioId, texto);
  if (acaoNota.handled) {
    const resposta = acaoNota.notaCriada
      ? respostaPronta('notaGuardada')
      : acaoNota.resposta;
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

  let resposta = '';
  let eventoCriado = null;
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

    const respostaDireta = respostaPronta('evento', eventoSalvo.titulo, eventoSalvo.dataInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
    if (respostaViaHttp) {
      emitirEstado(usuarioId, 'IDLE');
      return { resposta: respostaDireta, audio: null, eventoCriado };
    }

    resposta = respostaDireta;
  } 
  else if (comandoPasta && comandoPasta[1]) {
    const nomePasta = comandoPasta[1].trim().replace(/[.\s]+$/, '');
    const novaPasta = await prisma.pasta.create({
      data: { usuarioId, nome: nomePasta }
    });
    particulasAlteradas = true;
    resposta = respostaPronta('pasta', novaPasta.nome);
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
      resposta = respostaPronta('notaEditada', notaAtualizada.titulo);
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
    resposta = respostaPronta('notaGuardada');
  }

  // 3. O chat envia somente a mensagem atual à API conversacional.
  if (!resposta) {
    try {
      const resultado = await conversarComUrfilig(texto);
      resposta = resultado.source !== 'none' && resultado.reply ? resultado.reply : respostaQuandoNaoSabe();
    } catch (err) {
      console.warn('[chat] API própria indisponível; usando resposta pronta:', err?.code || err?.name || 'falha');
      resposta = respostaQuandoNaoSabe();
    }
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
  const perfil = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  const resposta = montarApresentacaoInicial(perfil);

  emitirEstado(usuarioId, 'SPEAKING');
  const audioBase64 = await sintetizarFala(resposta);
  emitirResposta(usuarioId, resposta, undefined, audioBase64);

  emitirParaUsuario(usuarioId, 'mascot:particles', await montarParticulas(usuarioId));
  return resposta;
}

export function montarApresentacaoInicial(perfil = {}) {
  perfil ||= {};
  const nome = typeof perfil.nome === 'string' && perfil.nome.trim() ? perfil.nome.trim() : '';
  const partes = [];
  if (perfil.idade != null && String(perfil.idade).trim()) partes.push(`${perfil.idade} anos`);
  if (perfil.localizacao?.trim()) partes.push(`mora em ${perfil.localizacao.trim()}`);
  if (perfil.profissao?.trim()) partes.push(`trabalha como ${perfil.profissao.trim()}`);
  if (perfil.hobbies?.trim()) partes.push(`gosta de ${perfil.hobbies.trim()}`);
  return `Oi${nome ? `, ${nome}` : ''}. Sou a Urfilig, sua assistente pessoal.${partes.length ? ` Já sei que você ${partes.join(', ')}.` : ''} Vamos começar.`;
}
