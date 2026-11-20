import test from 'node:test';
import assert from 'node:assert/strict';
import { respostaProntaComSorteio, respostaQuandoNaoSabe } from '../src/persona/respostasProntas.js';
import { criarRascunhoPadrao } from '../src/routines/pitchTemplates.js';
import { conversarComUrfilig } from '../src/llm/llmClient.js';
import { montarTextoSaudacaoDiaria } from '../src/persona/dailyGreeting.js';

async function comFetchMock(fetchMock, executar) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try { await executar(); } finally { globalThis.fetch = original; }
}

test('respostas prontas são selecionáveis sem aleatoriedade implícita', () => {
  const primeira = respostaProntaComSorteio('evento', () => 0, 'Consulta', '20/11/2026');
  const ultima = respostaProntaComSorteio('evento', () => 0.99, 'Consulta', '20/11/2026');
  assert.notEqual(primeira, ultima);
  assert.equal(respostaQuandoNaoSabe(), 'Isso eu ainda não sei. Anota no cofre ou pergunta de outro jeito.');
  assert.throws(() => respostaProntaComSorteio('desconhecida'), TypeError);
});

test('rascunho de prospecção usa só dados fornecidos e continua sendo rascunho', () => {
  const pitch = criarRascunhoPadrao({ nome: 'Café Central', categoria: 'cafeteria', endereco: '' });
  assert.match(pitch, /Café Central/);
  assert.match(pitch, /cafeteria/);
  assert.match(pitch, /Posso te mostrar uma ideia/);
  assert.doesNotMatch(pitch, /prazo|preço|http/i);
});

test('conversarComUrfilig envia somente a mensagem limpa e trata resposta normal', async () => {
  await comFetchMock(async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8780/chat');
    assert.deepEqual(JSON.parse(options.body), { message: 'oi', web: false });
    return { ok: true, json: async () => ({ reply: ' Olá! ', source: 'smalltalk', from_model: true }) };
  }, async () => assert.deepEqual(await conversarComUrfilig('  oi  '), { reply: 'Olá!', source: 'smalltalk' }));
});

test('conversarComUrfilig preserva source none sem inventar resposta', async () => {
  await comFetchMock(async () => ({ ok: true, json: async () => ({ reply: '', source: 'none' }) }), async () => {
    assert.deepEqual(await conversarComUrfilig('pergunta'), { reply: '', source: 'none' });
  });
});

test('conversarComUrfilig tipa rejeição 400', async () => {
  await comFetchMock(async () => ({ ok: false, status: 400 }), async () => {
    await assert.rejects(conversarComUrfilig('pergunta'), (erro) => erro.code === 'URFILIG_API_ERROR' && erro.status === 400);
  });
});

test('conversarComUrfilig rejeita texto vazio ou acima de 2000 caracteres antes do fetch', async () => {
  await comFetchMock(async () => assert.fail('fetch não deve ser chamado'), async () => {
    await assert.rejects(conversarComUrfilig('   '), (erro) => erro.code === 'URFILIG_API_ERROR' && erro.status === 400);
    await assert.rejects(conversarComUrfilig('x'.repeat(2001)), (erro) => erro.code === 'URFILIG_API_ERROR' && erro.status === 400);
  });
});

test('conversarComUrfilig tipa timeout e API fora do ar sem expor o texto', async () => {
  for (const causa of [Object.assign(new Error('aborted'), { name: 'TimeoutError' }), new TypeError('fetch failed')]) {
    await comFetchMock(async () => { throw causa; }, async () => {
      await assert.rejects(conversarComUrfilig('texto privado'), (erro) => erro.code === 'URFILIG_API_ERROR' && !erro.message.includes('texto privado'));
    });
  }
});

test('saudação usa somente dados presentes no template', () => {
  const texto = montarTextoSaudacaoDiaria({
    agora: new Date(2026, 10, 20, 14, 0),
    itensAgenda: [{ horario: '15:00', titulo: 'Dentista' }],
    leadsPendentes: 1,
    clima: { temperature: 21.4 },
  });
  assert.match(texto, /Boa tarde/);
  assert.match(texto, /20 de novembro/);
  assert.match(texto, /21 °C/);
  assert.match(texto, /15:00 — Dentista/);
  assert.match(texto, /1 lead aguardando/);
  const semDados = montarTextoSaudacaoDiaria({ agora: new Date(2026, 10, 20, 8) });
  assert.doesNotMatch(semDados, /temperatura|agenda|lead|atualizaç/i);
});
