import { Router } from 'express';
import { prisma } from '../db/client.js';
import { exigirAutenticacao } from '../auth/authMiddleware.js';
import {
  CAMPOS_CONTATO_PROTEGIDOS,
  criptografarCamposContato,
  protegerContato,
  validarChaveCriptografiaContato,
  validarDadosContato,
} from './contatoSecurity.js';

export const contatosRouter = Router();
contatosRouter.use(exigirAutenticacao);

function responderErroContato(res, erro) {
  if (erro?.code === 'CONTACTS_ENCRYPTION_KEY_MISSING') {
    return res.status(503).json({ erro: 'O armazenamento protegido de contatos não está configurado neste servidor.' });
  }
  console.error('[Contatos] operação não concluída:', erro?.code || erro?.name || 'erro interno');
  return res.status(500).json({ erro: 'Não foi possível concluir a operação com contatos.' });
}

async function migrarContatoLegado(contato, usuarioId) {
  const camposSemProtecao = CAMPOS_CONTATO_PROTEGIDOS.some((campo) => {
    const valor = contato[campo];
    return typeof valor === 'string' && valor !== '' && !valor.startsWith('enc:v1:');
  });
  if (!camposSemProtecao) return contato;
  const dadosCriptografados = criptografarCamposContato(Object.fromEntries(
    CAMPOS_CONTATO_PROTEGIDOS.map((campo) => [campo, contato[campo]]),
  ));
  await prisma.contato.updateMany({ where: { id: contato.id, usuarioId }, data: dadosCriptografados });
  return { ...contato, ...dadosCriptografados };
}

contatosRouter.get('/', async (req, res) => {
  try {
    validarChaveCriptografiaContato();
    const usuarioId = String(req.usuarioId);
    const contatos = await prisma.contato.findMany({ where: { usuarioId }, orderBy: { updatedAt: 'desc' } });
    const resultado = [];
    for (const contato of contatos) {
      const migrado = await migrarContatoLegado(contato, usuarioId);
      resultado.push(protegerContato(migrado));
    }
    return res.json(resultado);
  } catch (erro) {
    return responderErroContato(res, erro);
  }
});

contatosRouter.post('/', async (req, res) => {
  const validacao = validarDadosContato(req.body);
  if (validacao.erro) return res.status(400).json({ erro: validacao.erro });
  try {
    validarChaveCriptografiaContato();
    const data = criptografarCamposContato(validacao.dados);
    data.usuarioId = String(req.usuarioId);
    data.consentimentoContatoEm = new Date();
    const contato = await prisma.contato.create({ data });
    return res.status(201).json(protegerContato(contato));
  } catch (erro) {
    return responderErroContato(res, erro);
  }
});

contatosRouter.put('/:id', async (req, res) => {
  if (typeof req.params.id !== 'string' || req.params.id.length > 64) return res.status(400).json({ erro: 'Identificador de contato inválido.' });
  const validacao = validarDadosContato(req.body, { parcial: true });
  if (validacao.erro) return res.status(400).json({ erro: validacao.erro });
  try {
    validarChaveCriptografiaContato();
    const data = criptografarCamposContato(validacao.dados);
    data.consentimentoContatoEm = new Date();
    const resultado = await prisma.contato.updateMany({
      where: { id: req.params.id, usuarioId: String(req.usuarioId) },
      data,
    });
    if (resultado.count === 0) return res.status(404).json({ erro: 'Contato não encontrado.' });
    const atualizado = await prisma.contato.findFirst({ where: { id: req.params.id, usuarioId: String(req.usuarioId) } });
    return res.json(protegerContato(atualizado));
  } catch (erro) {
    return responderErroContato(res, erro);
  }
});

contatosRouter.delete('/:id', async (req, res) => {
  if (typeof req.params.id !== 'string' || req.params.id.length > 64) return res.status(400).json({ erro: 'Identificador de contato inválido.' });
  try {
    const resultado = await prisma.contato.deleteMany({ where: { id: req.params.id, usuarioId: String(req.usuarioId) } });
    if (resultado.count === 0) return res.status(404).json({ erro: 'Contato não encontrado.' });
    return res.json({ ok: true });
  } catch (erro) {
    return responderErroContato(res, erro);
  }
});
