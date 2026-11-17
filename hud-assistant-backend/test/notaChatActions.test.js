import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarCriacaoDeNota, detectarMovimentoDeNota } from '../src/persona/memoryIntent.js';
import { atualizarNotaDoUsuario, processarAcaoDeNotaNoChat } from '../src/persona/notaChatActions.js';

function bancoFalso({ notas = [], pastas = [], falharNaMovimentacao = false } = {}) {
  const estado = { notas: structuredClone(notas), pastas: structuredClone(pastas) };
  let proximoIdPasta = Math.max(0, ...estado.pastas.map((item) => Number(item.id) || 0)) + 1;
  let proximoIdNota = Math.max(0, ...estado.notas.map((item) => Number(item.id) || 0)) + 1;
  const prisma = {
    nota: {
      findMany: async ({ where }) => estado.notas.filter((item) => item.usuarioId === where.usuarioId),
      findFirst: async ({ where }) => estado.notas.find((item) => Object.entries(where).every(([campo, valor]) => {
        if (campo === 'dataCriacao') return item.dataCriacao >= valor.gte;
        return item[campo] === valor;
      })) || null,
      count: async ({ where }) => estado.notas.filter((item) => item.usuarioId === where.usuarioId && item.pastaId === where.pastaId).length,
      create: async ({ data }) => {
        const item = { id: proximoIdNota++, importante: false, dataCriacao: new Date(), ...data };
        estado.notas.push(item);
        return item;
      },
      updateMany: async ({ where, data }) => {
        if (falharNaMovimentacao) throw Object.assign(new Error('offline'), { code: 'P1001' });
        const item = estado.notas.find((nota) => nota.id === where.id && nota.usuarioId === where.usuarioId);
        if (!item) return { count: 0 };
        Object.assign(item, data);
        return { count: 1 };
      },
    },
    pasta: {
      findMany: async ({ where }) => estado.pastas.filter((item) => item.usuarioId === where.usuarioId),
      findFirst: async ({ where }) => estado.pastas.find((item) => item.id === where.id && item.usuarioId === where.usuarioId) || null,
      create: async ({ data }) => {
        const item = { id: proximoIdPasta++, ...data };
        estado.pastas.push(item);
        return item;
      },
    },
  };
  return { prisma, estado };
}

const nota = (id, usuarioId, titulo, pastaId = null) => ({ id, usuarioId, titulo, conteudo: '', pastaId, dataCriacao: new Date() });
const pasta = (id, usuarioId, nome) => ({ id, usuarioId, nome });

test('extrai os títulos das três formas pedidas, sem apagar “A chamada”', () => {
  assert.equal(detectarCriacaoDeNota('Cria uma nota chamada jujuba').titulo, 'jujuba');
  assert.equal(detectarCriacaoDeNota('Faz uma nota com nome de lista de compras').titulo, 'lista de compras');
  assert.equal(detectarCriacaoDeNota('Cria uma nota chamada A chamada').titulo, 'A chamada');
  assert.equal(detectarCriacaoDeNota('Faz uma nota com nome de chamada de casa').titulo, 'chamada de casa');
  assert.deepEqual(detectarCriacaoDeNota('Anota comer na pasta contatos'), {
    titulo: 'comer', conteudo: 'comer', pastaNome: 'contatos', requerTitulo: false,
  });
});

test('detecta mover por “coloca” e “passa”, incluindo pronome para contexto', () => {
  assert.deepEqual(detectarMovimentoDeNota('Coloca a nota jujuba na pasta comidas'), { notaNome: 'jujuba', usaUltimaNota: false, pastaNome: 'comidas' });
  assert.deepEqual(detectarMovimentoDeNota('Passa jujuba pra comidas'), { notaNome: 'jujuba', usaUltimaNota: false, pastaNome: 'comidas' });
  assert.deepEqual(detectarMovimentoDeNota('Coloca ela na pasta comidas'), { notaNome: null, usaUltimaNota: true, pastaNome: 'comidas' });
});

test('cria diretamente na pasta existente e move pelo mesmo helper usado pela rota do painel', async () => {
  const { prisma, estado } = bancoFalso({ pastas: [pasta(5, 'u1', 'comidas')] });
  const criada = await processarAcaoDeNotaNoChat(prisma, 'u1', 'Cria uma nota chamada jujuba na pasta comidas');
  assert.equal(criada.notaCriada.titulo, 'jujuba');
  assert.equal(criada.notaCriada.conteudo, '');
  assert.equal(criada.notaCriada.pastaId, 5);

  const movimentada = await processarAcaoDeNotaNoChat(prisma, 'u1', 'Passa jujuba pra comidas');
  assert.equal(movimentada.notaMovida.id, criada.notaCriada.id);
  assert.equal(estado.notas.length, 1);
  assert.equal(estado.notas[0].pastaId, 5);
  const resultadoPainel = await atualizarNotaDoUsuario(prisma, { usuarioId: 'u1', notaId: estado.notas[0].id, data: { pastaId: null } });
  assert.equal(resultadoPainel.nota.pastaId, null);
});

test('reconsulta o contexto após “já tá criada” e move a nota existente', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(1, 'u2', 'jujuba')] });
  const pergunta = await processarAcaoDeNotaNoChat(prisma, 'u2', 'Adiciona a jujuba na pasta comidas');
  assert.match(pergunta.resposta, /Quer que eu crie/);
  assert.equal(estado.notas.length, 1);
  estado.pastas.push(pasta(7, 'u2', 'Comidas'));
  const continuacao = await processarAcaoDeNotaNoChat(prisma, 'u2', 'já tá criada');
  assert.equal(continuacao.notaMovida.pastaId, 7);
  assert.match(continuacao.resposta, /Comidas/);
  assert.equal(estado.notas.length, 1);
});

test('relaciona uma variação falada única ao nome real da pasta e salva sem perguntar', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(6, 'u2c', 'jujuba')], pastas: [pasta(12, 'u2c', 'comidas')] });
  const resultado = await processarAcaoDeNotaNoChat(prisma, 'u2c', 'Passa jujuba pra comida');
  assert.equal(resultado.notaMovida.pastaId, 12);
  assert.match(resultado.resposta, /pasta “comidas”/);
  assert.equal(estado.notas[0].pastaId, 12);
});

test('cria nota na pasta que melhor corresponde à variação do nome', async () => {
  const { prisma, estado } = bancoFalso({ pastas: [pasta(13, 'u2d', 'comidas')] });
  const resultado = await processarAcaoDeNotaNoChat(prisma, 'u2d', 'Cria uma nota chamada jujuba na pasta comida');
  assert.equal(resultado.notaCriada.titulo, 'jujuba');
  assert.equal(resultado.notaCriada.pastaId, 13);
  assert.match(resultado.resposta, /na pasta “comidas”/);
  assert.equal(estado.notas.length, 1);
});

test('“anota X na pasta Y” separa título e pasta e confirma o salvamento real', async () => {
  const { prisma, estado } = bancoFalso({ pastas: [pasta(14, 'u2e', 'contatos')] });
  const resultado = await processarAcaoDeNotaNoChat(prisma, 'u2e', 'Anota comer na pasta contatos');
  assert.equal(resultado.notaCriada.titulo, 'comer');
  assert.equal(resultado.notaCriada.conteudo, 'comer');
  assert.equal(resultado.notaCriada.pastaId, 14);
  assert.match(resultado.resposta, /Criei a nota “comer” na pasta “contatos”/);
  assert.equal(estado.notas.length, 1);
});

test('localiza o título legado “chamada jujuba” ao usuário pedir “jujuba”', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(2, 'u2b', 'chamada jujuba')], pastas: [pasta(9, 'u2b', 'comidas')] });
  const pergunta = await processarAcaoDeNotaNoChat(prisma, 'u2b', 'Move jujuba para comidas');
  assert.match(pergunta.resposta, /parecida/);
  const resultado = await processarAcaoDeNotaNoChat(prisma, 'u2b', 'sim');
  assert.equal(resultado.notaMovida.id, 2);
  assert.equal(estado.notas[0].titulo, 'chamada jujuba');
  assert.equal(estado.notas[0].pastaId, 9);
});

test('só cria pasta após confirmação explícita e já conclui a ação pendente', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(3, 'u3', 'jujuba')] });
  const pergunta = await processarAcaoDeNotaNoChat(prisma, 'u3', 'Coloca jujuba na pasta comidas');
  assert.match(pergunta.resposta, /Quer que eu crie/);
  const continuacao = await processarAcaoDeNotaNoChat(prisma, 'u3', 'sim');
  assert.equal(estado.pastas.length, 1);
  assert.equal(estado.notas[0].pastaId, estado.pastas[0].id);
  assert.equal(continuacao.notaMovida.id, 3);
});

test('não age quando nota ou pasta não existem e pede esclarecimento em duplicatas', async () => {
  const semItens = bancoFalso();
  assert.match((await processarAcaoDeNotaNoChat(semItens.prisma, 'u4', 'Move nota fantasma para comidas')).resposta, /Não encontrei a nota/);

  const duplicadas = bancoFalso({
    notas: [nota(10, 'u5', 'jujuba'), nota(11, 'u5', 'jujuba')],
    pastas: [pasta(1, 'u5', 'comidas'), pasta(2, 'u5', 'comidas')],
  });
  const ambiguoNota = await processarAcaoDeNotaNoChat(duplicadas.prisma, 'u5', 'Move jujuba pra comidas');
  assert.match(ambiguoNota.resposta, /mais de uma nota/);
  assert.equal(duplicadas.estado.notas.every((item) => item.pastaId === null), true);
  const escolheuNota = await processarAcaoDeNotaNoChat(duplicadas.prisma, 'u5', '2');
  assert.match(escolheuNota.resposta, /pastas com nomes muito parecidos/);
  const escolheuPasta = await processarAcaoDeNotaNoChat(duplicadas.prisma, 'u5', '2');
  assert.equal(escolheuPasta.notaMovida.id, 11);
  assert.equal(escolheuPasta.notaMovida.pastaId, 2);
});

test('pede escolha só quando duas pastas têm correspondência igualmente plausível', async () => {
  const { prisma, estado } = bancoFalso({
    notas: [nota(32, 'u5b', 'jujuba')],
    pastas: [pasta(41, 'u5b', 'comidas'), pasta(42, 'u5b', 'comidaz')],
  });
  const pergunta = await processarAcaoDeNotaNoChat(prisma, 'u5b', 'Move jujuba para comida');
  assert.match(pergunta.resposta, /pastas com nomes muito parecidos/);
  assert.equal(estado.notas[0].pastaId, null);
  const escolha = await processarAcaoDeNotaNoChat(prisma, 'u5b', '2');
  assert.equal(escolha.notaMovida.pastaId, 42);
});

test('erro do banco não é convertido em confirmação de sucesso', async () => {
  const { prisma } = bancoFalso({ notas: [nota(4, 'u6', 'jujuba')], pastas: [pasta(1, 'u6', 'comidas')], falharNaMovimentacao: true });
  await assert.rejects(processarAcaoDeNotaNoChat(prisma, 'u6', 'Move jujuba para comidas'), (error) => error.notaActionError && error.code === 'P1001');
});

test('notas e pastas de outro usuário não são encontradas nem alteradas', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(21, 'dono', 'jujuba')], pastas: [pasta(22, 'dono', 'comidas')] });
  const resultado = await processarAcaoDeNotaNoChat(prisma, 'intruso', 'Move jujuba para comidas');
  assert.match(resultado.resposta, /Não encontrei a nota/);
  assert.equal(estado.notas[0].pastaId, null);
  const movimentoDireto = await atualizarNotaDoUsuario(prisma, { usuarioId: 'intruso', notaId: 21, data: { pastaId: 22 } });
  assert.equal(movimentoDireto.status, 'pasta-nao-encontrada');
  assert.equal(estado.notas[0].pastaId, null);
});

test('contexto de “ela” aponta para a última nota criada pelo mesmo usuário', async () => {
  const { prisma, estado } = bancoFalso({ pastas: [pasta(8, 'u7', 'comidas')] });
  const criada = await processarAcaoDeNotaNoChat(prisma, 'u7', 'Cria uma nota chamada jujuba');
  const movida = await processarAcaoDeNotaNoChat(prisma, 'u7', 'Coloca ela na pasta comidas');
  assert.equal(movida.notaMovida.id, criada.notaCriada.id);
  assert.equal(estado.notas[0].pastaId, 8);
});
test('nomes parecidos exigem escolha explícita', async () => {
  const { prisma, estado } = bancoFalso({
    notas: [nota(30, 'u10', 'jujuba'), nota(31, 'u10', 'jujuba doce')],
    pastas: [pasta(40, 'u10', 'comidas')],
  });
  const resposta = await processarAcaoDeNotaNoChat(prisma, 'u10', 'Move jujuba para comidas');
  assert.match(resposta.resposta, /mais de uma nota/);
  assert.equal(estado.notas.every((item) => item.pastaId === null), true);
  const selecao = await processarAcaoDeNotaNoChat(prisma, 'u10', 'jujuba doce');
  assert.equal(selecao.notaMovida.id, 31);
});

test('“já tá criada” sem pasta encontrada não cria nem move automaticamente', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(50, 'u11', 'jujuba')] });
  await processarAcaoDeNotaNoChat(prisma, 'u11', 'Move jujuba para comidas');
  const resposta = await processarAcaoDeNotaNoChat(prisma, 'u11', 'já tá criada');
  assert.match(resposta.resposta, /Ainda não encontrei/);
  assert.equal(estado.pastas.length, 0);
  assert.equal(estado.notas[0].pastaId, null);
});

test('negação cancela a criação de pasta sem movimentar a nota', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(60, 'u12', 'jujuba')] });
  await processarAcaoDeNotaNoChat(prisma, 'u12', 'Move jujuba para comidas');
  const resposta = await processarAcaoDeNotaNoChat(prisma, 'u12', 'não');
  assert.match(resposta.resposta, /Não vou criar/);
  assert.equal(estado.pastas.length, 0);
  assert.equal(estado.notas[0].pastaId, null);
});

test('contexto pendente de um usuário não move notas de outro', async () => {
  const { prisma, estado } = bancoFalso({ notas: [nota(70, 'u13', 'jujuba')], pastas: [pasta(71, 'u13', 'comidas')] });
  await processarAcaoDeNotaNoChat(prisma, 'u13', 'Move nota inexistente para comidas');
  const respostaOutro = await processarAcaoDeNotaNoChat(prisma, 'u14', 'já tá criada');
  assert.equal(respostaOutro.handled, false);
  assert.equal(estado.notas[0].pastaId, null);
});
