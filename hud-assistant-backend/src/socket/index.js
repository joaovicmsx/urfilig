import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { montarParticulas } from '../persona/particlesBuilder.js';

let io;

/**
 * Inicializa o Socket.io em cima do servidor HTTP existente. Cada conexão
 * precisa se autenticar com um JWT válido (mesmo token do login) e entra
 * numa "sala" privada (`usuario:<id>`) — é isso que garante que os
 * eventos de um usuário (estado do mascote, respostas, partículas) não
 * vazem pra tela de outro usuário conectado ao mesmo tempo.
 */
export function configurarSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' }, // restrinja pro domínio/IP do frontend quando ele existir
    maxHttpBufferSize: 5 * 1024 * 1024,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Não autenticado — token ausente'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.usuarioId = payload.sub;
      next();
    } catch {
      next(new Error('Token inválido ou expirado'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`usuario:${socket.usuarioId}`);
    console.log(`[socket] cliente conectado: ${socket.id} (usuário ${socket.usuarioId})`);

    // Manda a Esfera Neural completa assim que conecta — antes disso, o
    // frontend só tinha os hobbies do perfil populados localmente, e essa
    // lista local sumia por completo assim que qualquer comando disparava
    // uma lista nova (e menor) vinda do backend. Agora o backend já é a
    // única fonte de verdade desde o primeiro segundo.
    montarParticulas(socket.usuarioId)
      .then((particulas) => socket.emit('mascot:particles', particulas))
      .catch((erro) => console.error('[socket] falha ao montar partículas iniciais:', erro.message));

    socket.on('disconnect', () => {
      console.log(`[socket] cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

// Helpers de emissão — sempre por usuário, nunca broadcast global (exceto
// o helper explicitamente marcado "SemUsuario" abaixo, usado só pela wake
// word enquanto ela não tem autenticação própria).

export function emitirEstado(usuarioId, estado) {
  io?.to(`usuario:${usuarioId}`).emit('mascot:state', { state: estado });
}

/**
 * `audio` é opcional e vem do Piper (src/voice/piperClient.js) como WAV binário — se
 * a síntese local falhar ou não estiver configurada, vem `null`/`undefined`
 * e o frontend usa a Web Speech API do navegador como reserva.
 */
export function emitirResposta(usuarioId, texto, emocao, audio) {
  io?.to(`usuario:${usuarioId}`).emit('hud:response', {
    text: texto,
    emotion: emocao,
    audio: audio || null,
  });
}

// Helper genérico — usado por módulos que não são o fluxo de comando/mascote
// (ex: leadsRouter emitindo 'lead:pendente')
export function emitirParaUsuario(usuarioId, evento, payload) {
  io?.to(`usuario:${usuarioId}`).emit(evento, payload);
}

/**
 * Broadcast global de verdade, usado só pra dados que genuinamente NÃO são
 * por usuário — hoje só o clima (mesma cidade hardcoded pra todo mundo).
 */
export function emitirGlobal(evento, payload) {
  io?.emit(evento, payload);
}
