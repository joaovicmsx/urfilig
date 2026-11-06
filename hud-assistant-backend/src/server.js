import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import cron from 'node-cron';
import { configurarSocket } from './socket/index.js';

// Routers
import { contatosRouter } from './persona/contatosRouter.js';
import { comandoRouter } from './router/comandoRouter.js';
import { leadsRouter } from './leads/leadsRouter.js';
import { agendaRouter } from './agenda/agendaRouter.js';
import { cerebroRouter } from './persona/cerebroRouter.js';
import { eventosRouter } from './router/eventosRouter.js';
import { authRouter } from './auth/authRouter.js';
import { perfilRouter } from './auth/perfilRouter.js';
import { spotifyRouter } from './spotify/spotifyRouter.js';
import inteligenciaRouter from './router/inteligenciaRouter.js';

// Middlewares e Jobs
import { exigirAutenticacao } from './auth/authMiddleware.js';
import { evoluirPersonalidadeDoUsuario, evoluirPersonalidadeDeTodos } from './persona/evolutionJob.js';
import { gerarReflexaoDiariaDoUsuario, gerarReflexaoDiariaDeTodos } from './persona/reflectionJob.js';
import { atualizarClimaEEmitir } from './weather/weatherService.js';
import { prisma } from './db/client.js';

const app = express();

const originsPermitidas = new Set((process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map((origem) => origem.trim()).filter(Boolean));
for (const origem of ['tauri://localhost', 'https://tauri.localhost', 'http://tauri.localhost', 'http://localhost:5173', 'http://127.0.0.1:5173']) originsPermitidas.add(origem);

app.use(cors({
  origin(origem, callback) {
    // Chamadas nativas sem Origin não são protegidas por CORS; rotas privadas continuam exigindo JWT.
    if (!origem || originsPermitidas.has(origem)) return callback(null, true);
    const erro = new Error('Origem não permitida.');
    erro.status = 403;
    return callback(erro);
  },
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));

const limitesPorIp = new Map();
function limitarRequisicoes({ janelaMs, max, mensagem, bucket }) {
  return (req, res, next) => {
    // Uma chave por IP e categoria evita crescimento ilimitado com caminhos arbitrários.
    const chave = `${bucket || 'api'}:${req.ip}`;
    const agora = Date.now();
    let estado = limitesPorIp.get(chave);
    if (!estado || estado.expira <= agora) estado = { quantidade: 0, expira: agora + janelaMs };
    estado.quantidade += 1;
    limitesPorIp.set(chave, estado);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - estado.quantidade)));
    if (estado.quantidade > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((estado.expira - agora) / 1000))));
      return res.status(429).json({ erro: mensagem });
    }
    return next();
  };
}
const limiteApi = limitarRequisicoes({ janelaMs: 60_000, max: 240, mensagem: 'Muitas solicitações. Aguarde um minuto e tente novamente.', bucket: 'api' });
const limiteAuth = limitarRequisicoes({ janelaMs: 15 * 60_000, max: 20, mensagem: 'Muitas tentativas de autenticação. Aguarde e tente novamente.', bucket: 'auth' });
const limiteOAuthInicio = limitarRequisicoes({ janelaMs: 15 * 60_000, max: 10, mensagem: 'Muitas tentativas de autorização. Aguarde e tente novamente.', bucket: 'oauth-start' });
const limiteOAuthStatus = limitarRequisicoes({ janelaMs: 15 * 60_000, max: 360, mensagem: 'Consultas de autorização muito frequentes. Aguarde e tente novamente.', bucket: 'oauth-status' });
app.use('/api', limiteApi);
app.use('/api/auth/login', limiteAuth);
app.use('/api/auth/registrar', limiteAuth);
app.use('/api/auth/google/desktop/start', limiteOAuthInicio);
app.use('/api/auth/google/desktop/status', limiteOAuthStatus);
app.post('/api/auth/google', limiteAuth);

setInterval(() => {
  const agora = Date.now();
  for (const [chave, estado] of limitesPorIp) if (estado.expira <= agora) limitesPorIp.delete(chave);
}, 60_000).unref();

const httpServer = http.createServer(app);
const io = configurarSocket(httpServer);

// Rotas da API
app.use('/api', authRouter);
app.use('/api', perfilRouter);
app.use('/api', spotifyRouter);
app.use('/api', comandoRouter);
app.use('/api', leadsRouter);
app.use('/api', agendaRouter);
app.use('/api', eventosRouter);
app.use('/api/contatos', contatosRouter);
app.use('/api/cerebro', cerebroRouter);
app.use('/api/inteligencia', exigirAutenticacao, inteligenciaRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, backend: 'online', database: 'online' });
  } catch (erro) {
    const bancoIndisponivel = erro?.code === 'P1001' || erro?.code === 'P1002' ||
      (erro?.name === 'PrismaClientInitializationError' && /database server|timed out|connection/i.test(erro.message || ''));
    console.error('[health] banco indisponível:', erro?.code || erro?.name || 'erro interno');
    res.status(503).json({
      ok: false,
      backend: 'online',
      database: 'offline',
      erro: bancoIndisponivel
        ? 'O banco de dados não está acessível. Confira a internet e tente novamente.'
        : 'O backend não conseguiu verificar o banco de dados.',
    });
  }
});

app.post('/api/persona/evoluir-agora', exigirAutenticacao, async (req, res) => {
  await evoluirPersonalidadeDoUsuario(req.usuarioId);
  res.json({ ok: true });
});

app.post('/api/persona/refletir-agora', exigirAutenticacao, async (req, res) => {
  await gerarReflexaoDiariaDoUsuario(req.usuarioId);
  res.json({ ok: true });
});

cron.schedule('0 23 * * *', () => {
  console.log('[persona] rodando evolução autônoma agendada (todos os usuários)...');
  evoluirPersonalidadeDeTodos();
});

cron.schedule('30 23 * * *', () => {
  console.log('[persona] rodando reflexão diária agendada (todos os usuários)...');
  gerarReflexaoDiariaDeTodos();
});

atualizarClimaEEmitir();
cron.schedule('*/30 * * * *', atualizarClimaEEmitir);

// O middleware de erro fica depois das rotas para também tratar JSON inválido e erros encaminhados.
app.use((erro, _req, res, _next) => {
  console.error('[api] erro não tratado:', erro?.code || erro?.name || 'erro interno');
  if (res.headersSent) return;
  const status = Number.isInteger(erro?.status) && erro.status >= 400 && erro.status < 500 ? erro.status : 500;
  res.status(status).json({ erro: status === 413 ? 'A solicitação excedeu o tamanho permitido.' : status === 400 ? 'A solicitação é inválida.' : 'Não foi possível concluir a solicitação.' });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[server] rodando em http://localhost:${PORT}`);
});
