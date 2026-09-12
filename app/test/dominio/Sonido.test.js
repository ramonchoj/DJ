import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sonido } from '../../src/dominio/Sonido.js';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { Ganancia } from '../../src/dominio/valores/Ganancia.js';
import { ErrorValidacion } from '../../src/dominio/errores.js';

test('un sonido requiere nombre no vacío', () => {
  assert.throws(() => new Sonido({ nombre: '' }), ErrorValidacion);
  assert.throws(() => new Sonido({ nombre: '   ' }), ErrorValidacion);
});

test('un sonido nuevo tiene modo UN_TIRO y ganancia unidad por defecto', () => {
  const s = new Sonido({ nombre: 'Aplausos' });
  assert.equal(s.modo.valor, 'UN_TIRO');
  assert.equal(s.ganancia.valor, 1);
  assert.equal(s.teclaRapida, null);
});

test('con() devuelve una copia inmutable con el cambio aplicado', () => {
  const s = new Sonido({ nombre: 'Sirena' });
  const s2 = s.renombrado('Sirena de alerta');
  assert.equal(s.nombre, 'Sirena');
  assert.equal(s2.nombre, 'Sirena de alerta');
  assert.notEqual(s, s2);
  assert.throws(() => { s.nombre = 'hackeo'; });
});

test('conModo acepta un ModoDisparo o un string', () => {
  const s = new Sonido({ nombre: 'Cama' }).conModo(ModoDisparo.LOOP);
  assert.equal(s.modo.valor, 'LOOP');
  const s2 = new Sonido({ nombre: 'Cama' }).con({ modo: 'EXCLUSIVO' });
  assert.equal(s2.modo.valor, 'EXCLUSIVO');
});

test('conTecla normaliza a mayúscula un solo carácter', () => {
  const s = new Sonido({ nombre: 'Air Horn' }).conTecla('a');
  assert.equal(s.teclaRapida.valor, 'A');
});

test('serializa y reconstruye desde JSON sin perder datos', () => {
  const original = new Sonido({
    nombre: 'Redoble',
    color: '#ff0000',
    modo: ModoDisparo.LOOP,
    ganancia: new Ganancia(1.5),
    teclaRapida: 'r',
    duracionMs: 2500,
    origen: 'FABRICA',
  });
  const json = JSON.parse(JSON.stringify(original));
  const reconstruido = Sonido.desdeJSON(json);
  assert.equal(reconstruido.nombre, 'Redoble');
  assert.equal(reconstruido.modo.valor, 'LOOP');
  assert.equal(reconstruido.ganancia.valor, 1.5);
  assert.equal(reconstruido.teclaRapida.valor, 'R');
  assert.equal(reconstruido.duracionMs, 2500);
  assert.equal(reconstruido.origen, 'FABRICA');
});

test('dos sonidos nuevos nunca comparten id', () => {
  const a = new Sonido({ nombre: 'A' });
  const b = new Sonido({ nombre: 'B' });
  assert.notEqual(a.id, b.id);
});
