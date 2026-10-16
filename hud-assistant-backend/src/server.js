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
import inteligenciaRouter from './router/inteligenciaRouter.js';

// Middlewares e Jobs
import { exigirAutenticacao } from './auth/authMiddleware.js';
import { evoluirPersonalidadeDoUsuario, evoluirPersonalidadeDeTodos } from './persona/evolutionJob.js';
import { gerarReflexaoDiariaDoUsuario, gerarReflexaoDiariaDeTodos } from './persona/reflectionJob.js';
import { atualizarClimaEEmitir } from './weather/weatherService.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = configurarSocket(httpServer);

// Rotas da API
app.use('/api', authRouter);
app.use('/api', perfilRouter);
app.use('/api', comandoRouter);
app.use('/api', leadsRouter);
app.use('/api', agendaRouter);
app.use('/api', eventosRouter);
app.use('/api/contatos', contatosRouter);
app.use('/api/cerebro', cerebroRouter);
app.use('/api/inteligencia', exigirAutenticacao, inteligenciaRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[server] rodando em http://localhost:${PORT}`);
});