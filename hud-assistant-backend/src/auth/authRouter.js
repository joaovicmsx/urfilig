import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db/client.js';
import { paraRespostaPublica } from './usuarioPublico.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRACAO = '7d';
const CUSTO_HASH = 12; // fator de custo do bcrypt — 12 é um padrão seguro atual

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const loginsDesktop = new Map();

export const authRouter = Router();

function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: JWT_EXPIRACAO });
}

async function sincronizarUsuarioGoogle({ email, nome, googleSub }) {
  let usuario = await prisma.usuario.findUnique({ where: { googleId: googleSub } });
  if (!usuario) {
    const contaExistente = await prisma.usuario.findUnique({ where: { email } });
    usuario = contaExistente
      ? await prisma.usuario.update({ where: { id: contaExistente.id }, data: { googleId: googleSub } })
      : await prisma.usuario.create({ data: { email, nome, googleId: googleSub } });
  }
  return { token: gerarToken(usuario), usuario: paraRespostaPublica(usuario) };
}

function responderCallback(res, mensagem, status = 200) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Urfilig</title><body style="font:16px sans-serif;background:#111;color:#eee;padding:3rem"><h1>${mensagem}</h1><p>Você pode fechar esta aba e voltar ao Urfilig.</p></body></html>`);
}

/** Inicia OAuth nativo: navegador externo + callback loopback + PKCE. */
authRouter.post('/auth/google/desktop/start', async (req, res) => {
  const { clientId, clientSecret: clientSecretBody, emailAccess = false } = req.body;
  const clientSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET || clientSecretBody;
  if (!clientId || !clientSecret || !/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    return res.status(400).json({ erro: 'ID ou segredo do cliente Google Desktop ausente ou inválido' });
  }

  const estado = randomBytes(32).toString('hex');
  const { codeVerifier, codeChallenge } = await new OAuth2Client().generateCodeVerifierAsync();
  const sessao = { status: 'pending', criadoEm: Date.now(), server: null, emailAccess: emailAccess === true };
  loginsDesktop.set(estado, sessao);

  const callbackServer = createServer(async (reqCallback, resCallback) => {
    const callbackUrl = new URL(reqCallback.url, 'http://127.0.0.1');
    if (callbackUrl.pathname !== '/oauth2callback') return responderCallback(resCallback, 'Endereço inválido.', 404);
    if (callbackUrl.searchParams.get('state') !== estado) {
      sessao.status = 'error';
      sessao.erro = 'Resposta OAuth inválida. Tente novamente.';
      responderCallback(resCallback, 'Não foi possível validar o login.', 400);
      return;
    }
    if (callbackUrl.searchParams.has('error')) {
      sessao.status = 'error';
      sessao.erro = 'O login com Google foi cancelado.';
      responderCallback(resCallback, 'Login cancelado. Volte ao Urfilig.');
      return;
    }

    try {
      const code = callbackUrl.searchParams.get('code');
      if (!code) throw new Error('O Google não retornou o código de autorização.');
      const redirectUri = `http://127.0.0.1:${callbackServer.address().port}/oauth2callback`;
      const oauthClient = new OAuth2Client({ clientId, clientSecret, redirectUri });
      const { tokens } = await oauthClient.getToken({ code, codeVerifier, redirect_uri: redirectUri });
      if (!tokens.id_token) throw new Error('O Google não retornou um ID token.');
      const ticket = await oauthClient.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified || !payload.sub) throw new Error('A conta Google não pôde ser validada.');
      if (sessao.emailAccess) {
        if (!tokens.access_token) throw new Error('O Google não retornou um token de acesso ao Gmail.');
        sessao.resultado = { accessToken: tokens.access_token, email: payload.email };
      } else {
        sessao.resultado = await sincronizarUsuarioGoogle({ email: payload.email, nome: payload.name, googleSub: payload.sub });
      }
      sessao.status = 'complete';
      responderCallback(resCallback, sessao.emailAccess ? 'Conta conectada! Volte ao Urfilig e feche esta aba.' : 'Login concluído! Volte ao Urfilig.');
    } catch (erro) {
      console.error('[auth] falha no OAuth Desktop:', erro.message, erro.response?.data || '');
      sessao.status = 'error';
      sessao.erro = 'Não foi possível concluir o login com Google.';
      responderCallback(resCallback, 'Não foi possível concluir o login. Volte ao Urfilig.', 400);
    } finally {
      setTimeout(() => callbackServer.close(), 250);
    }
  });

  callbackServer.on('error', (erro) => {
    console.error('[auth] erro no callback loopback:', erro.message);
    sessao.status = 'error';
    sessao.erro = 'Não foi possível abrir o retorno local do Google.';
  });
  callbackServer.listen(0, '127.0.0.1', () => {
    const redirectUri = `http://127.0.0.1:${callbackServer.address().port}/oauth2callback`;
    sessao.server = callbackServer;
    const oauthClient = new OAuth2Client({ clientId, clientSecret, redirectUri });
    const authUrl = oauthClient.generateAuthUrl({
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: [
        'openid', 'email', 'profile',
        ...(sessao.emailAccess ? ['https://www.googleapis.com/auth/gmail.readonly'] : []),
      ],
      state: estado,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'online',
      prompt: 'select_account',
    });
    res.json({ state: estado, authUrl });
  });

  setTimeout(() => {
    if (loginsDesktop.get(estado) === sessao && sessao.status === 'pending') {
      sessao.status = 'error';
      sessao.erro = 'O tempo para concluir o login expirou. Tente novamente.';
      callbackServer.close();
    }
  }, 5 * 60 * 1000).unref();
});

authRouter.get('/auth/google/desktop/status', (req, res) => {
  const sessao = loginsDesktop.get(req.query.state);
  if (!sessao) return res.status(404).json({ erro: 'Sessão de login não encontrada.' });
  if (sessao.status === 'complete') {
    loginsDesktop.delete(req.query.state);
    return res.json({ status: 'complete', ...sessao.resultado });
  }
  if (sessao.status === 'error') {
    loginsDesktop.delete(req.query.state);
    return res.json({ status: 'error', erro: sessao.erro });
  }
  return res.json({ status: 'pending' });
});

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
    res.json(await sincronizarUsuarioGoogle({ email, nome, googleSub }));
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
