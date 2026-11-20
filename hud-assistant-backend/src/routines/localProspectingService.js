import { prisma } from '../db/client.js';
import { emitirParaUsuario } from '../socket/index.js';
import { criarRascunhoPadrao } from './pitchTemplates.js';

const SERPER_PLACES_URL = 'https://google.serper.dev/places';
const NICHOS_PADRAO = ['barbearia', 'salão de beleza', 'oficina mecânica', 'restaurante', 'clínica de estética', 'pet shop', 'academia', 'loja de roupas'];

function textoSeguro(valor, limite = 500) {
  return String(valor || '').trim().replace(/\s+/g, ' ').slice(0, limite);
}

export function normalizarTelefone(valor) {
  const numeros = String(valor || '').replace(/\D/g, '');
  if (!numeros) return null;
  if (numeros.length === 10 || numeros.length === 11) return '+55' + numeros;
 if (numeros.length === 12 || numeros.length === 13) return '+' + numeros;
  return null;
}

function temSiteProprio(empresa) {
  const site = textoSeguro(empresa.website || empresa.site || empresa.url, 300);
  return Boolean(site && !/google\.com|maps\.google|facebook\.com|instagram\.com|wa\.me|whatsapp\.com/i.test(site));
}

function lerResultados(payload) {
  const candidatos = [...(Array.isArray(payload?.places) ? payload.places : []), ...(Array.isArray(payload?.organic) ? payload.organic : [])];
  return candidatos.map((item) => ({
    nome: textoSeguro(item.title || item.name, 140),
    telefone: normalizarTelefone(item.phone || item.telefone),
    endereco: textoSeguro(item.address || item.endereco || item.snippet, 350),
    categoria: textoSeguro(item.category || item.type, 120),
    website: textoSeguro(item.website || item.link || item.url, 300),
  }));
}

async function pesquisarNoSerper({ consulta, localizacao }) {
  const chave = process.env.SERPER_API_KEY;
  if (!chave) throw new Error('SERPER_API_KEY não configurada no backend.');
  const resposta = await fetch(SERPER_PLACES_URL, {
    method: 'POST',
    headers: { 'X-API-KEY': chave, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ q: consulta, location: localizacao, gl: 'br', hl: 'pt-br' }),
  });
  const payload = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(payload.message || 'Busca local indisponível (HTTP ' + resposta.status + ').');
  return lerResultados(payload);
}

/** Pesquisa somente contatos públicos e nunca envia mensagens. */
export async function prepararLoteProspeccao({ usuarioId, execucao, quantidade }) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { localizacao: true } });
  const localizacao = textoSeguro(usuario?.localizacao, 180);
  if (!localizacao) throw new Error('Defina cidade e estado no perfil antes de usar a prospecção automática.');

  const limite = Math.min(Math.max(Number(quantidade) || 15, 1), 15);
  const existentes = await prisma.lead.findMany({ where: { usuarioId }, select: { contato: true } });
  const contatosExistentes = new Set(existentes.map((lead) => lead.contato));
  const candidatos = [];
  const vistos = new Set(contatosExistentes);

  for (const nicho of NICHOS_PADRAO) {
    if (candidatos.length >= limite) break;
    let resultados = [];
   try { resultados = await pesquisarNoSerper({ consulta: nicho + ' em ' + localizacao, localizacao }); }
    catch (erro) { console.warn('[prospeccao] busca falhou para ' + nicho + ':', erro.message); continue; }
    for (const empresa of resultados) {
      if (candidatos.length >= limite) break;
      if (!empresa.nome || !empresa.telefone || !empresa.endereco || temSiteProprio(empresa) || vistos.has(empresa.telefone)) continue;
      vistos.add(empresa.telefone);
      candidatos.push({ ...empresa, categoria: empresa.categoria || nicho });
    }
  }

  const leads = [];
  for (const empresa of candidatos) {
    const pitch = criarRascunhoPadrao(empresa);
    try {
      const lead = await prisma.lead.create({ data: {
        usuarioId, nome: empresa.nome, contato: empresa.telefone, nicho: empresa.categoria,
        bio: 'Endereço: ' + empresa.endereco + '. Contato público validado pela busca local.',
        score: 1, pitch, statusFunil: 'AGUARDANDO_APROVACAO',
      }});
      leads.push(lead);
    } catch (erro) { if (erro.code !== 'P2002') throw erro; }
  }

  await prisma.execucaoRotina.update({ where: { id: execucao.id }, data: { status: 'CONCLUIDA', concluidaEm: new Date() } });
  const lote = {
    rotinaId: execucao.rotinaId, execucaoId: execucao.id, quantidadeSolicitada: limite, quantidadePreparada: leads.length,
    leads: leads.map(({ id, nome, contato, nicho, bio, pitch }) => ({ id, nome, contato, nicho, bio, pitch })),
   mensagem: leads.length ? 'Encontrei ' + leads.length + ' empresa' + (leads.length === 1 ? '' : 's') + ' para sua aprovação. Nenhuma mensagem foi enviada.' : 'Nenhuma empresa nova foi encontrada. Nenhuma mensagem foi enviada.',
  };
  emitirParaUsuario(usuarioId, 'prospeccao:lote-pronto', lote);
  return lote;
}
