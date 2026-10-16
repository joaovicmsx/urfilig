import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const CAMINHO_PIPER = process.env.PIPER_PATH || './piper/piper.exe';
const CAMINHO_MODELO_VOZ = process.env.PIPER_VOICE_MODEL || './piper/voz.onnx';

// Piper não tem um parâmetro simples de "pitch" como a Web Speech API — a
// altura da voz vem principalmente de QUAL modelo de voz você baixa (voz
// feminina/masculina, etc.). O que dá pra ajustar por parâmetro é o ritmo:
// length-scale > 1 deixa a fala mais lenta/arrastada (efeito melancólico).
const LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE || '1.15';

/**
 * Gera áudio a partir de texto usando o Piper (motor de TTS local, neural,
 * sem custo) — substitui a Web Speech API do navegador, que soa
 * inevitavelmente robótica por ser síntese básica do sistema operacional.
 *
 * Roda o Piper como processo externo (igual fizemos com o servidor Python
 * da wake word) em vez de um binding nativo do Node — evita repetir o
 * problema do ffi-napi/Visual Studio Build Tools.
 *
 * Retorna o áudio como base64 (WAV), ou `null` se o Piper não estiver
 * configurado/instalado — nesse caso o frontend cai de volta pra Web
 * Speech API como reserva, em vez de ficar mudo.
 */
export async function sintetizarFala(texto) {
  const arquivoSaida = path.join(os.tmpdir(), `urfilig-${randomUUID()}.wav`);

  try {
    await new Promise((resolve, reject) => {
      const processo = spawn(CAMINHO_PIPER, [
        '--model', CAMINHO_MODELO_VOZ,
        '--length_scale', String(LENGTH_SCALE),
        '--output_file', arquivoSaida,
      ]);

      let erroStderr = '';
      processo.stderr?.on('data', (dado) => { erroStderr += dado.toString(); });

      processo.on('error', (erro) => {
        reject(new Error(`Não consegui executar o Piper em "${CAMINHO_PIPER}": ${erro.message}`));
      });

      processo.on('close', (codigo) => {
        if (codigo === 0) resolve();
        else reject(new Error(`Piper saiu com código ${codigo}. stderr: ${erroStderr}`));
      });

      processo.stdin.write(texto);
      processo.stdin.end();
    });

    const audioBuffer = await fs.readFile(arquivoSaida);
    return audioBuffer.toString('base64');
  } catch (erro) {
    console.warn('[piper] falha ao sintetizar voz, frontend vai usar a Web Speech API como reserva:', erro.message);
    return null;
  } finally {
    await fs.unlink(arquivoSaida).catch(() => {});
  }
}
