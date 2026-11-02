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
        '--output_file', arquivoSaida,
      ], { stdio: ['pipe', 'ignore', 'pipe'] });

      let erroStderr = '';
      processo.stderr?.on('data', (dado) => { erroStderr += dado.toString(); });
      processo.stdin?.on('error', reject);

      processo.on('error', (erro) => {
        reject(new Error(`Não consegui executar o Piper em "${CAMINHO_PIPER}": ${erro.message}`));
      });

      processo.on('close', (codigo) => {
        if (codigo === 0) resolve();
        else reject(new Error(`Piper saiu com código ${codigo}. stderr: ${erroStderr}`));
      });

      processo.stdin.write(texto);
      processo.stdin.end('\n');
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
