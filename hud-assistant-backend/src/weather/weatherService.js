import { emitirGlobal } from '../socket/index.js';

// Coordenadas de Contagem, MG
const LATITUDE = -19.9317;
const LONGITUDE = -44.0536;

// Open-Meteo é gratuito e não exige chave de API — importante pra um
// projeto pessoal sem orçamento de infraestrutura.
const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

const LIMITE_FRIO_CELSIUS = 20; // abaixo disso, mascote "veste" o casaco

let ultimoEstadoCasaco = null; // evita reemitir o mesmo estado repetidamente

/**
 * Busca o clima atual de Contagem, MG. Sem chave de API, sem custo —
 * qualquer volume de chamadas dentro do uso razoável de um projeto pessoal
 * é gratuito no Open-Meteo.
 */
export async function buscarClimaAtual() {
  const url = `${URL_BASE}?latitude=${LATITUDE}&longitude=${LONGITUDE}&current_weather=true&timezone=America%2FSao_Paulo`;
  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error(`Open-Meteo respondeu ${resposta.status}`);
  }

  const dados = await resposta.json();
  return dados.current_weather; // { temperature, windspeed, weathercode, ... }
}

/**
 * Consulta o clima, decide se o mascote deve estar "de casaco" ou não, e
 * emite os eventos pro frontend — só quando o estado realmente muda, pra
 * não ficar reemitindo a mesma coisa a cada consulta.
 *
 * IMPORTANTE: isso só tem efeito visual se o .glb do mascote tiver um
 * objeto chamado exatamente "Casaco" na hierarquia — se o modelo atual
 * ainda não tem essa peça modelada no Blender, o evento é emitido mas não
 * muda nada na tela (o Three.js simplesmente não acha o objeto).
 */
export async function atualizarClimaEEmitir() {
  try {
    const clima = await buscarClimaAtual();
    const estaFrio = clima.temperature < LIMITE_FRIO_CELSIUS;

    emitirGlobal('weather:update', {
      temperatura: clima.temperature,
      ventoKmh: clima.windspeed,
      codigo: clima.weathercode,
      atualizadoEm: new Date().toISOString(),
    });

    if (estaFrio !== ultimoEstadoCasaco) {
      ultimoEstadoCasaco = estaFrio;
      emitirGlobal('mascot:outfit', { part: 'Casaco', visible: estaFrio });
      console.log(`[clima] ${clima.temperature}°C em Contagem — casaco ${estaFrio ? 'visível' : 'escondido'}`);
    }
  } catch (erro) {
    console.error('[clima] falha ao consultar Open-Meteo:', erro.message);
  }
}
