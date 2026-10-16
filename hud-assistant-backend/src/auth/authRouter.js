import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db/client.js';
import { paraRespostaPublica } from './usuarioPublico.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRACAO = '7d';
const CUSTO_HASH = 12; // fator de custo do bcrypt — 12 é um padrão seguro atual

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const authRouter = Router();

function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: JWT_EXPIRACAO });
}

/**
 * POST /api/auth/registrar { email, senha, nome? }
 */
authRouter.post('/auth/registrar', async (req, res) => {
  const { email, senha, nome } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }
  if (senha.length < 8) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres' });
  }

  const jaExiste = await prisma.usuario.findUnique({ where: { email } });
  if (jaExiste) {
    return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail' });
  }

  const senhaHash = await bcrypt.hash(senha, CUSTO_HASH);
  const usuario = await prisma.usuario.create({ data: { email, nome, senhaHash } });

  res.status(201).json({ token: gerarToken(usuario), usuario: paraRespostaPublica(usuario) });
});

/**
 * POST /api/auth/login { email, senha }
 */
authRouter.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Mensagem genérica de propósito nos dois casos (email não existe / senha
  // errada) — não dar pista pra quem está tentando adivinhar contas válidas
  if (!usuario || !usuario.senhaHash) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
  }

  res.json({ token: gerarToken(usuario), usuario: paraRespostaPublica(usuario) });
});

/**
 * POST /api/auth/google { credential?, access_token? }
 *
 * Suporta tanto ID Tokens (JWT do Google Identity Web) quanto Access Tokens
 * (provenientes de OAuth2 implicit flow / redirecionamento desktop/Tauri).
 */
authRouter.post('/auth/google', async (req, res) => {
  const { credential, access_token } = req.body;
  const tokenFornecido = credential || access_token;

  if (!tokenFornecido) {
    return res.status(400).json({ erro: 'Token do Google é obrigatório' });
  }

  let email, nome, googleSub;

  // 1. Tenta validar via ID Token JWT oficial
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: tokenFornecido,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    email = payload.email;
    nome = payload.name;
    googleSub = payload.sub;
  } catch (errIdToken) {
    // 2. Se falhar como ID Token, faz o fallback consultando a UserInfo API do Google com o access_token
    try {
      const respUserInfo = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${tokenFornecido}` },
      });

      if (!respUserInfo.ok) {
        throw new Error('Falha ao validar access_token junto ao Google');
      }

      const userData = await respUserInfo.json();
      email = userData.email;
      nome = userData.name;
      googleSub = userData.sub;
    } catch (errAccessToken) {
      console.error('[auth] falha ao verificar token do Google:', errIdToken.message, '|', errAccessToken.message);
      return res.status(401).json({ erro: 'Token do Google inválido' });
    }
  }

  try {
    let usuario = await prisma.usuario.findUnique({ where: { googleId: googleSub } });

    if (!usuario) {
      // Se já existe uma conta com esse e-mail (criada via senha), vincula o Google a ela
      const contaExistente = await prisma.usuario.findUnique({ where: { email } });
      usuario = contaExistente
        ? await prisma.usuario.update({ where: { id: contaExistente.id }, data: { googleId: googleSub } })
        : await prisma.usuario.create({
            data: { email, nome, googleId: googleSub },
          });
    }

    res.json({ token: gerarToken(usuario), usuario: paraRespostaPublica(usuario) });
  } catch (erro) {
    console.error('[auth] erro ao sincronizar usuário do Google no banco:', erro.message);
    res.status(500).json({ erro: 'Erro interno ao processar autenticação' });
  }
});

/**
 * GET /api/auth/me — usado pelo frontend pra validar se o token salvo
 * ainda é válido antes de mostrar o HUD (em vez da tela de login)
 */
authRouter.get('/auth/me', async (req, res) => {
  const cabecalho = req.headers.authorization;
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado' });
    res.json({ usuario: paraRespostaPublica(usuario) });
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
});