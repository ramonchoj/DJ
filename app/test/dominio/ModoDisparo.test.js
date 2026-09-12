import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { ErrorValidacion } from '../../src/dominio/errores.js';

test('rechaza valores desconocidos', () => {
  assert.throws(() => new ModoDisparo('VOLADOR'), ErrorValidacion);
  assert.throws(() => ModoDisparo.desde('VOLADOR'), ErrorValidacion);
});

test('los predicados reconocen cada modo', () => {
  assert.equal(ModoDisparo.LOOP.esLoop(), true);
  assert.equal(ModoDisparo.LOOP.esMantener(), false);
  assert.equal(ModoDisparo.MANTENER.esMantener(), true);
  assert.equal(ModoDisparo.EXCLUSIVO.esExclusivo(), true);
  assert.equal(ModoDisparo.UN_TIRO.esExclusivo(), false);
});

test('igual compara por valor, no por instancia', () => {
  const a = ModoDisparo.desde('LOOP');
  const b = ModoDisparo.desde('LOOP');
  assert.equal(a.igual(b), true);
  assert.equal(a === ModoDisparo.LOOP, true); // los estáticos son singletons
});

test('es un objeto de valor inmutable', () => {
  const m = ModoDisparo.UN_TIRO;
  assert.throws(() => { m.valor = 'LOOP'; });
});
