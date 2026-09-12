import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ganancia } from '../../src/dominio/valores/Ganancia.js';

test('se limita al rango [0, 2]', () => {
  assert.equal(new Ganancia(-5).valor, 0);
  assert.equal(new Ganancia(10).valor, 2);
  assert.equal(new Ganancia(1).valor, 1);
});

test('desdeMedicion sube la ganancia si el pico está muy bajo', () => {
  const g = Ganancia.desdeMedicion(-20); // señal floja, objetivo -3dB
  assert.ok(g.valor > 1, `esperaba ganancia > 1, obtuve ${g.valor}`);
});

test('desdeMedicion baja la ganancia si el pico ya está cerca de 0dB', () => {
  const g = Ganancia.desdeMedicion(-0.5); // señal casi al tope
  assert.ok(g.valor < 1, `esperaba ganancia < 1, obtuve ${g.valor}`);
});

test('desdeMedicion con silencio no toca nada (ganancia unidad)', () => {
  const g = Ganancia.desdeMedicion(-120);
  assert.equal(g.valor, 1);
});

test('combinada multiplica ambos factores', () => {
  const a = new Ganancia(0.5);
  const b = new Ganancia(0.5);
  assert.equal(a.combinada(b).valor, 0.25);
});
