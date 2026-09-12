import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tablero } from '../../src/dominio/Tablero.js';
import { Sonido } from '../../src/dominio/Sonido.js';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { ErrorConflicto, ErrorNoEncontrado } from '../../src/dominio/errores.js';

function tableroConBanco(nombre = 'Golpes') {
  return Tablero.vacio().crearBanco(nombre, '#111');
}

test('no permite dos bancos con el mismo nombre (sin distinguir mayúsculas)', () => {
  const t = tableroConBanco('Golpes');
  assert.throws(() => t.crearBanco('golpes', '#222'), ErrorConflicto);
});

test('agregar un sonido a un slot y volver a leerlo', () => {
  let t = tableroConBanco();
  const banco = t.bancos[0];
  const sonido = new Sonido({ nombre: 'Air Horn' });
  t = t.conSonidoAgregado(banco.id, 0, sonido);
  assert.equal(t.sonidoEn(banco.id, 0).nombre, 'Air Horn');
});

test('no permite dos sonidos con la misma tecla rápida en todo el tablero', () => {
  let t = tableroConBanco();
  const banco = t.bancos[0];
  const s1 = new Sonido({ nombre: 'Air Horn', teclaRapida: 'A' });
  const s2 = new Sonido({ nombre: 'Aplausos', teclaRapida: 'A' });
  t = t.conSonidoAgregado(banco.id, 0, s1);
  assert.throws(() => t.conSonidoAgregado(banco.id, 1, s2), ErrorConflicto);
});

test('no permite pisar un slot ocupado por otro sonido', () => {
  let t = tableroConBanco();
  const banco = t.bancos[0];
  const s1 = new Sonido({ nombre: 'Uno' });
  const s2 = new Sonido({ nombre: 'Dos' });
  t = t.conSonidoAgregado(banco.id, 0, s1);
  assert.throws(() => t.conSonidoAgregado(banco.id, 0, s2), ErrorConflicto);
});

test('mover un sonido lo saca del slot original', () => {
  let t = tableroConBanco('Golpes');
  t = t.crearBanco('Camas', '#222');
  const golpes = t.bancoPorNombre('Golpes');
  const camas = t.bancoPorNombre('Camas');
  const s = new Sonido({ nombre: 'Loop base' });
  t = t.conSonidoAgregado(golpes.id, 0, s);
  t = t.moverSonido(s.id, camas.id, 0);
  assert.equal(t.bancoPorId(golpes.id).sonidoEn(0), null);
  assert.equal(t.bancoPorId(camas.id).sonidoEn(0).id, s.id);
});

test('buscarSonido encuentra por id en cualquier banco', () => {
  let t = tableroConBanco();
  const banco = t.bancos[0];
  const s = new Sonido({ nombre: 'Risa' });
  t = t.conSonidoAgregado(banco.id, 3, s);
  const encontrado = t.buscarSonido(s.id);
  assert.equal(encontrado.sonido.nombre, 'Risa');
  assert.equal(encontrado.banco.id, banco.id);
});

test('sonidoConTecla ubica banco, sonido y slot', () => {
  let t = tableroConBanco();
  const banco = t.bancos[0];
  const s = new Sonido({ nombre: 'Sirena', teclaRapida: 's' });
  t = t.conSonidoAgregado(banco.id, 2, s);
  const r = t.sonidoConTecla('S');
  assert.equal(r.slot, 2);
  assert.equal(r.sonido.nombre, 'Sirena');
});

test('eliminar un sonido lo quita de su banco', () => {
  let t = tableroConBanco();
  const banco = t.bancos[0];
  const s = new Sonido({ nombre: 'Explosión' });
  t = t.conSonidoAgregado(banco.id, 0, s);
  t = t.sinSonido(s.id);
  assert.equal(t.bancoPorId(banco.id).sonidoEn(0), null);
});

test('bancoPorId lanza ErrorNoEncontrado si no existe', () => {
  const t = tableroConBanco();
  assert.throws(() => t.bancoPorId('no-existe'), ErrorNoEncontrado);
});

test('volumenMaestro se limita a [0,1]', () => {
  let t = Tablero.vacio();
  assert.equal(t.conVolumenMaestro(-1).volumenMaestro, 0);
  assert.equal(t.conVolumenMaestro(5).volumenMaestro, 1);
});

test('el tablero es inmutable: cada operación devuelve una instancia nueva', () => {
  const t1 = Tablero.vacio();
  const t2 = t1.crearBanco('X', '#000');
  assert.notEqual(t1, t2);
  assert.equal(t1.bancos.length, 0);
  assert.equal(t2.bancos.length, 1);
});

test('serializa y reconstruye el tablero completo desde JSON', () => {
  let t = tableroConBanco('Golpes');
  const banco = t.bancos[0];
  t = t.conSonidoAgregado(banco.id, 0, new Sonido({ nombre: 'Redoble', modo: ModoDisparo.LOOP }));
  const json = JSON.parse(JSON.stringify(t));
  const reconstruido = Tablero.desdeJSON(json, Sonido);
  assert.equal(reconstruido.bancos.length, 1);
  assert.equal(reconstruido.bancos[0].sonidoEn(0).nombre, 'Redoble');
  assert.equal(reconstruido.bancos[0].sonidoEn(0).modo.valor, 'LOOP');
});
