import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const CAMPOS_CONTATO_PROTEGIDOS = [
  'nome', 'telefone', 'email', 'perfilInvestidor', 'patrimonioEstimado', 'objetivoFinanceiro', 'anotacoes',
];

function chaveDeCriptografia(chaveHex = process.env.CONTACTS_ENCRYPTION_KEY) {
  if (typeof chaveHex !== 'string' || !/^[a-f\d]{64}$/i.test(chaveHex)) {
    const erro = new Error('A chave de criptografia dos contatos não está configurada.');
    erro.code = 'CONTACTS_ENCRYPTION_KEY_MISSING';
    throw erro;
  }
  return Buffer.from(chaveHex, 'hex');
}

export function validarChaveCriptografiaContato(chaveHex = process.env.CONTACTS_ENCRYPTION_KEY) {
  chaveDeCriptografia(chaveHex);
}

export function criptografarCampoContato(valor, chaveHex) {
  if (valor === null || valor === undefined || valor === '') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chaveDeCriptografia(chaveHex), iv);
  const cifrado = Buffer.concat([cipher.update(String(valor), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${cifrado.toString('hex')}`;
}

export function descriptografarCampoContato(valor, chaveHex) {
  if (valor === null || valor === undefined || valor === '') return valor ?? null;
  // Permite a migração gradual de registros legados que ainda estão em texto puro.
  if (typeof valor !== 'string' || !valor.startsWith('enc:v1:')) return valor;
  const [, versao, ivHex, tagHex, dadosHex] = valor.split(':');
  if (versao !== 'v1' || !/^[a-f\d]{24}$/i.test(ivHex || '') || !/^[a-f\d]{32}$/i.test(tagHex || '') || !/^(?:[a-f\d]{2})*$/i.test(dadosHex || '')) {
    throw new Error('Registro de contato criptografado inválido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', chaveDeCriptografia(chaveHex), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dadosHex, 'hex')), decipher.final()]).toString('utf8');
}

export function validarDadosContato(body, { parcial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { erro: 'Envie os dados do contato em formato válido.' };
  const permitidos = new Set([...CAMPOS_CONTATO_PROTEGIDOS, 'dataContato', 'tipoData', 'status', 'baseLegalConfirmada']);
  if (Object.keys(body).some((campo) => !permitidos.has(campo))) return { erro: 'O contato contém campos não reconhecidos.' };
  if (!parcial && body.baseLegalConfirmada !== true) return { erro: 'Confirme que possui base legal para registrar os dados deste contato.' };
  if (parcial && body.baseLegalConfirmada !== true) return { erro: 'Confirme que possui base legal para registrar os dados deste contato.' };

  const dados = {};
  for (const campo of CAMPOS_CONTATO_PROTEGIDOS) {
    if (parcial && !(campo in body)) continue;
    const valor = body[campo] == null ? '' : body[campo];
    if (typeof valor !== 'string') return { erro: `O campo ${campo} deve ser um texto.` };
    const texto = valor.trim();
    const limites = { nome: 120, telefone: 40, email: 254, perfilInvestidor: 80, patrimonioEstimado: 120, objetivoFinanceiro: 240, anotacoes: 4000 };
    if (texto.length > limites[campo]) return { erro: `O campo ${campo} excede o limite de ${limites[campo]} caracteres.` };
    if (campo === 'nome' && !texto) return { erro: 'O nome do contato é obrigatório.' };
    if (campo === 'email' && texto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) return { erro: 'Informe um e-mail válido.' };
    if (campo === 'telefone' && texto && !/^[+\d().\s-]+$/.test(texto)) return { erro: 'Informe um telefone válido.' };
    dados[campo] = texto || null;
  }

  if (!parcial || 'dataContato' in body) {
    const data = body.dataContato;
    if (data == null || data === '') dados.dataContato = null;
    else if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(data) || Number.isNaN(Date.parse(data))) {
      return { erro: 'Informe uma data de contato válida.' };
    } else dados.dataContato = new Date(data);
  }
  if (!parcial || 'status' in body) {
    const status = body.status ?? 'LEAD';
    if (typeof status !== 'string' || !['LEAD', 'REUNIAO_AGENDADA', 'PROPOSTA_ENVIADA', 'CLIENTE_ATIVO', 'INATIVO'].includes(status)) return { erro: 'Selecione um status válido para o contato.' };
    dados.status = status;
  }
  if ('tipoData' in body) {
    if (body.tipoData !== null && !['ULTIMO_CONTATO', 'PROXIMO_CONTATO'].includes(body.tipoData)) return { erro: 'Selecione um tipo de data válido.' };
    dados.tipoData = body.tipoData;
  }
  return { dados };
}

export function protegerContato(contato, chaveHex) {
  const protegido = { ...contato };
  for (const campo of CAMPOS_CONTATO_PROTEGIDOS) protegido[campo] = descriptografarCampoContato(contato[campo], chaveHex);
  return protegido;
}

export function criptografarCamposContato(dados, chaveHex) {
  const resultado = { ...dados };
  for (const campo of CAMPOS_CONTATO_PROTEGIDOS) {
    if (campo in resultado) resultado[campo] = criptografarCampoContato(resultado[campo], chaveHex);
  }
  return resultado;
}
