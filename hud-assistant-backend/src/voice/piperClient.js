import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const DIRETORIO_BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function localizarArquivo(configurado, padrao) {
  const candidatos = [];
  if (configurado?.trim()) {
    candidatos.push(path.isAbsolute(configurado)
      ? configurado
      : path.resolve(process.cwd(), configurado));
    if (!path.isAbsolute(configurado)) candidatos.push(path.resolve(DIRETORIO_BACKEND, configurado));
  }
  candidatos.push(path.join(DIRETORIO_BACKEND, padrao));

  for (const candidato of new Set(candidatos)) {
    try {
      await fs.access(candidato);
      return candidato;
    } catch { /* tenta o próximo caminho, inclusive o recurso empacotado */ }
  }
  throw new Error(`Arquivo do Piper não encontrado. Caminhos verificados: ${[...new Set(candidatos)].join(', ')}`);
}

// O Piper não separa tom e duração. Mantemos o modelo sem alteração de pitch
// para preservar a naturalidade e usamos apenas uma desaceleração leve.
const LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE || '1.2';
/**
 * Gera áudio a partir de texto usando o Piper (motor de TTS local, neural,
 * sem custo) — substitui a Web Speech API do navegador, que soa
 * inevitavelmente robótica por ser síntese básica do sistema operacional.
 *
 * Roda o Piper como processo externo (igual fizemos com o servidor Python
 * da wake word) em vez de um binding nativo do Node — evita repetir o
 * problema do ffi-napi/Visual Studio Build Tools.
 *
 * Retorna os bytes WAV em um Buffer, ou `null` se o Piper não estiver
 * configurado/instalado — nesse caso o frontend cai de volta pra Web
 * Speech API como reserva, em vez de ficar mudo.
 */
export async function sintetizarFala(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return null;

  const arquivoSaida = path.join(os.tmpdir(), `urfilig-${randomUUID()}.wav`);

  try {
    const caminhoPiper = await localizarArquivo(process.env.PIPER_PATH, path.join('piper', process.platform === 'win32' ? 'piper.exe' : 'piper'));
    const caminhoModeloVoz = await localizarArquivo(process.env.PIPER_VOICE_MODEL, path.join('piper', 'pt_BR-faber-medium.onnx'));
    const inicioModelo = await fs.open(caminhoModeloVoz, 'r');
    const cabecalhoModelo = Buffer.alloc(64);
    try { await inicioModelo.read(cabecalhoModelo, 0, cabecalhoModelo.length, 0); }
    finally { await inicioModelo.close(); }
    if (cabecalhoModelo.toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) {
      throw new Error(`O modelo de voz ainda é um ponteiro Git LFS, não o arquivo ONNX: ${caminhoModeloVoz}`);
    }

    await new Promise((resolve, reject) => {
      const processo = spawn(caminhoPiper, [
        '--model', caminhoModeloVoz,
        '--length_scale', String(LENGTH_SCALE),
        '--espeak_data', path.join(path.dirname(caminhoPiper), 'espeak-ng-data'),
        '--output_file', arquivoSaida,
      ], {
        cwd: path.dirname(caminhoPiper),
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let erroStderr = '';
      processo.stderr?.on('data', (dado) => {
        if (erroStderr.length < 4000) erroStderr += dado.toString().slice(0, 4000 - erroStderr.length);
      });
      processo.stdin?.on('error', reject);

      processo.on('error', (erro) => {
        reject(new Error(`Não consegui executar o Piper em "${caminhoPiper}": ${erro.message}`));
      });

      processo.on('close', (codigo) => {
        if (codigo === 0) resolve();
        else reject(new Error(`Piper saiu com código ${codigo}. stderr: ${erroStderr}`));
      });

      processo.stdin.write(texto);
      processo.stdin.end('\n');
    });

    const audioBuffer = await fs.readFile(arquivoSaida);
    console.info(`[piper] síntese concluída (${audioBuffer.length} bytes).`);
    // Buffer é enviado como anexo binário do Socket.IO. Base64 adicionava ~33%
    // ao tamanho e podia ultrapassar o limite padrão de mensagens do transporte.
    return audioBuffer;
  } catch (erro) {
    console.warn('[piper] falha ao sintetizar voz, frontend vai usar a Web Speech API como reserva:', erro.message);
    return null;
  } finally {
    await fs.unlink(arquivoSaida).catch(() => {});
  }
}
