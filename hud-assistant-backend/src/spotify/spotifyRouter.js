import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { exigirAutenticacao } from '../auth/authMiddleware.js';

export const spotifyRouter = Router();

const authRequests = new Map();
const PORT = process.env.PORT || 3000;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID?.trim() || '';
const REDIRECT_URI = `http://127.0.0.1:${PORT}/api/spotify/callback`;
const SCOPES = [
  'streaming',
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

function randomUrlSafe(length = 64) {
  return randomBytes(length).toString('base64url');
}

function clearExpiredRequests() {
  const expiration = Date.now() - 10 * 60 * 1000;
  for (const [state, session] of authRequests) {
    if (session.createdAt < expiration) authRequests.delete(state);
  }
  while (authRequests.size > 50) authRequests.delete(authRequests.keys().next().value);
}

function callbackPage(message, success) {
  const title = success ? 'Conta conectada' : 'Conexão não concluída';
  const color = success ? '#a7d7ba' : '#e6b4b4';
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Urfilig</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090a0d;color:#eceef2;font:15px system-ui"><main style="width:min(440px,calc(100% - 40px));padding:28px;border-radius:18px;background:rgba(27,29,35,.88);box-shadow:0 18px 60px #0008"><h1 style="margin:0 0 12px;color:${color};font-size:20px;font-weight:500">${title}</h1><p style="margin:0;line-height:1.6;color:#b9bdc7">${message}</p><p style="margin:18px 0 0;color:#888e9b;font-size:13px">Volte para a Urfilig para continuar.</p></main></body></html>`;
}

spotifyRouter.post('/spotify/auth/start', exigirAutenticacao, (req, res) => {
  clearExpiredRequests();
  if (!/^[A-Za-z0-9]{32}$/.test(SPOTIFY_CLIENT_ID)) {
    return res.status(503).json({ erro: 'A conexão com o Spotify ainda não está configurada.' });
  }

  const state = randomUrlSafe(32);
  const verifier = randomUrlSafe(64);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  authRequests.set(state, { userId: req.usuarioId, clientId: SPOTIFY_CLIENT_ID, verifier, createdAt: Date.now(), status: 'pending' });

  const url = new URL('https://accounts.spotify.com/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString();
  res.json({ authorizationUrl: url.toString(), state, redirectUri: REDIRECT_URI });
});

spotifyRouter.get('/spotify/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const session = authRequests.get(state);
  if (!session || session.status !== 'pending' || Date.now() - session.createdAt > 10 * 60 * 1000) {
    return res.status(400).type('html').send(callbackPage('A autorização expirou. Volte à Urfilig e conecte novamente.', false));
  }
  if (req.query.error || typeof req.query.code !== 'string') {
    session.status = 'denied';
    return res.type('html').send(callbackPage('A autorização foi cancelada ou recusada.', false));
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: REDIRECT_URI,
        client_id: session.clientId,
        code_verifier: session.verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokens = await response.json().catch(() => ({}));
    if (!response.ok || !tokens.access_token || !tokens.refresh_token) {
      session.status = 'error';
      return res.status(400).type('html').send(callbackPage('O Spotify não concluiu a autorização. Volte à Urfilig e tente conectar novamente.', false));
    }
    session.tokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: Number(tokens.expires_in) || 3600,
      scope: tokens.scope || '',
    };
    session.status = 'connected';
    return res.type('html').send(callbackPage('A conta Spotify foi autorizada com sucesso.', true));
  } catch {
    session.status = 'error';
    return res.status(502).type('html').send(callbackPage('Não foi possível falar com o serviço de autorização do Spotify. Tente novamente.', false));
  }
});

spotifyRouter.get('/spotify/auth/status', exigirAutenticacao, (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const session = authRequests.get(state);
  if (!session || session.userId !== req.usuarioId) return res.status(404).json({ erro: 'Sessão de autorização não encontrada.' });
  if (session.status === 'pending') return res.json({ status: 'pending' });
  authRequests.delete(state);
  if (session.status !== 'connected') return res.json({ status: session.status });
  return res.json({ status: 'connected', clientId: session.clientId, ...session.tokens });
});
