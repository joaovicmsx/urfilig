import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criptografarCampoContato,
  descriptografarCampoContato,
  validarDadosContato,
} from '../src/persona/contatoSecurity.js';

const CHAVE = '8c6d26b04ce245cd9ec1d2f0fbdc1308b5290b9dc5ee09a62fb148cb238cd1a7';

test('contato é criptografado e descriptografado com AES-GCM', () => {
  const original = 'Pessoa Exemplo, informação privada';
  const cifrado = criptografarCampoContato(original, CHAVE);
  assert.notEqual(cifrado, original);
  assert.match(cifrado, /^enc:v1:/);
  assert.equal(descriptografarCampoContato(cifrado, CHAVE), original);
});

test('validador aceita contato com base legal confirmada', () => {
  const resultado = validarDadosContato({ nome: 'Pessoa Exemplo', email: 'pessoa@example.com', baseLegalConfirmada: true });
  assert.equal(resultado.erro, undefined);
  assert.equal(resultado.dados.nome, 'Pessoa Exemplo');
});

test('validador rejeita ausência de base legal, e-mail inválido e campos extensos', () => {
  assert.match(validarDadosContato({ nome: 'Pessoa Exemplo' }).erro, /base legal/i);
  assert.match(validarDadosContato({ nome: 'Pessoa Exemplo', email: 'inválido', baseLegalConfirmada: true }).erro, /e-mail/i);
  assert.match(validarDadosContato({ nome: 'x'.repeat(121), baseLegalConfirmada: true }).erro, /limite/i);
});

test('validador não aceita campos inesperados', () => {
  const resultado = validarDadosContato({ nome: 'Pessoa Exemplo', baseLegalConfirmada: true, usuarioId: 'outro' });
  assert.match(resultado.erro, /não reconhecidos/i);
});
