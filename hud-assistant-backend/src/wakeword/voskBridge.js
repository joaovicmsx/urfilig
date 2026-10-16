import WebSocket from 'ws';
import { emitirEstado } from '../socket/index.js';
import { processarComando } from '../persona/comandoProcessor.js';

const PALAVRA_DE_ATIVACAO = (process.env.WAKE_WORD || 'ei assistente').toLowerCase();
const SILENCIO_PARA_ENCERRAR_MS = 1800; // tempo sem fala nova até considerar o comando "completo"
const URL_SERVIDOR_PYTHON = process.env.VOSK_SERVER_URL || 'ws://localhost:2700';

/**
 * Liga o Socket.io ao cliente WebSocket que conversa com o servidor
 * Python (wakeword_server.py). O Node nunca roda reconhecimento de fala
 * ele mesmo — só repassa áudio pra lá e recebe texto de volta. Isso
 * mantém o lado Node livre de dependência nativa.
 *
 * Fonte do áudio: hoje é o microfone local do PC, capturado direto na
 * aba do HUD (`frontend/src/main.js`) — usa o MESMO socket já autenticado
 * do resto do sistema, então `socket.usuarioId` já vem pronto aqui sem
 * nenhuma lógica extra. Essa função em si não sabe (nem precisa saber)
 * de onde o áudio vem — se um app mobile futuro mandar áudio pelo mesmo
 * protocolo (audio:config + audio:chunk), funciona igual.
 */
export function configurarWakeWord(io) {
  io.on('connection', (socket) => {
    let wsPython = null;
    let ouvindoComando = false;
    let timeoutSilencio = null;

    socket.on('audio:config', ({ sampleRate }) => {
      wsPython = new WebSocket(URL_SERVIDOR_PYTHON);

      wsPython.on('open', () => {
        wsPython.send(JSON.stringify({ sampleRate }));
        console.log(`[wakeword] usuário ${socket.usuarioId}: conectado ao servidor Python (sampleRate ${sampleRate})`);
      });

      wsPython.on('error', (erro) => {
        console.error(
          '[wakeword] não consegui conectar no servidor Python de reconhecimento:',
          erro.message,
          '— ele está rodando? (python wakeword_server.py, ver Setup do Wake Word no Obsidian)'
        );
      });

      wsPython.on('message', (dados) => {
        const { tipo, texto } = JSON.parse(dados.toString());
        if (!texto) return;
        if (tipo === 'parcial') verificarPalavraDeAtivacao(texto);
        else processarTrechoReconhecido(texto);
      });
    });

    socket.on('audio:chunk', (chunk) => {
      if (wsPython?.readyState === WebSocket.OPEN) {
        wsPython.send(Buffer.from(chunk));
      }
    });

    socket.on('disconnect', () => {
      wsPython?.close();
      clearTimeout(timeoutSilencio);
    });

    function verificarPalavraDeAtivacao(textoParcial) {
      if (ouvindoComando) return; // já ativado, aguardando o comando em si
      if (textoParcial.toLowerCase().includes(PALAVRA_DE_ATIVACAO)) {
        ouvindoComando = true;
        emitirEstado(socket.usuarioId, 'LISTENING');
        console.log(`[wakeword] usuário ${socket.usuarioId}: palavra de ativação detectada, aguardando comando...`);
        reiniciarTimeoutDeSilencio();
      }
    }

    async function processarTrechoReconhecido(texto) {
      if (!ouvindoComando) {
        // Também checa no resultado final, não só no parcial — a wake word
        // pode ter sido dita e finalizada antes de gerar um parcial útil.
        verificarPalavraDeAtivacao(texto);
        return;
      }

      clearTimeout(timeoutSilencio);
      ouvindoComando = false;

      const comando = texto.toLowerCase().startsWith(PALAVRA_DE_ATIVACAO)
        ? texto.slice(PALAVRA_DE_ATIVACAO.length).trim()
        : texto;

      if (!comando) {
        emitirEstado(socket.usuarioId, 'IDLE');
        return;
      }

      try {
        await processarComando(socket.usuarioId, comando);
      } catch (erro) {
        console.error(`[wakeword] usuário ${socket.usuarioId}: erro ao processar comando falado:`, erro.message);
        emitirEstado(socket.usuarioId, 'IDLE');
      }
    }

    function reiniciarTimeoutDeSilencio() {
      clearTimeout(timeoutSilencio);
      timeoutSilencio = setTimeout(() => {
        if (ouvindoComando) {
          console.log(`[wakeword] usuário ${socket.usuarioId}: silêncio após a ativação, voltando pro IDLE sem comando.`);
          ouvindoComando = false;
          emitirEstado(socket.usuarioId, 'IDLE');
        }
      }, SILENCIO_PARA_ENCERRAR_MS);
    }
  });
}
