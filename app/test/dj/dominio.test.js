import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pista } from '../../src/dj/dominio/Pista.js';
import { Deck } from '../../src/dj/dominio/Deck.js';
import { Mezclador } from '../../src/dj/dominio/Mezclador.js';
import { Cola } from '../../src/dj/dominio/Cola.js';
import { puntosDeMezcla, decidirTransicion, tempoParaIgualar, tonosCompatibles } from '../../src/dj/dominio/servicios/ReglasDeAutomix.js';

test('Pista.desdeNombreArchivo separa artista y título, tolera prefijos numéricos y "(320 kbps)"', () => {
  assert.deepEqual(Pista.desdeNombreArchivo('Bee Gees - Stayin\' Alive (320 kbps).mp3'), { artista: 'Bee Gees', titulo: "Stayin' Alive" });
  assert.deepEqual(Pista.desdeNombreArchivo('03 - Todos con la Mano para Arriba.mp3'), { artista: '', titulo: 'Todos con la Mano para Arriba' });
  assert.deepEqual(Pista.desdeNombreArchivo('Que Pasa.mp3'), { artista: '', titulo: 'Que Pasa' });
});

test('Pista: cues se ordenan, se reemplazan por número y sobreviven al JSON', () => {
  let p = new Pista({ titulo: 'X', duracionSeg: 200 });
  p = p.conCue(2, 60).conCue(1, 10).conCue(2, 65, 'coro');
  assert.deepEqual(p.cues.map((c) => [c.num, c.seg]), [[1, 10], [2, 65]]);
  assert.equal(p.cue(2).nombre, 'coro');
  const r = Pista.desdeJSON(JSON.parse(JSON.stringify(p)));
  assert.equal(r.cues.length, 2);
  assert.equal(r.sinCue(1).cues.length, 1);
});

test('Deck: tempo limitado a ±12 %, tasa y BPM efectivo, loop en segundos', () => {
  const pista = new Pista({ titulo: 'X', bpm: 120 });
  const d = new Deck({ id: 'A', pista }).conTempo(0.5);
  assert.equal(d.tempo, 0.12);
  assert.ok(Math.abs(d.tasa - 1.12) < 1e-9);
  assert.equal(d.bpmEfectivo, 134.4);
  const d4 = d.conTempo(0).conLoop(4);
  assert.ok(Math.abs(d4.segundosDeLoop() - 2) < 1e-9); // 4 beats a 120 bpm = 2 s
  assert.throws(() => new Deck({ id: 'C' }));
});

test('Deck: EQ limitada a [-40, +12] dB y no puede "sonar" sin pista', () => {
  const d = new Deck({ id: 'B' }).conEq('baja', -99).conEq('alta', 30);
  assert.equal(d.eq.baja, -40);
  assert.equal(d.eq.alta, 12);
  assert.equal(new Deck({ id: 'B', sonando: true }).sonando, false);
});

test('Mezclador: curva full deja ambos al 100 % en el centro y apaga en el extremo opuesto', () => {
  assert.deepEqual(new Mezclador({ crossfader: 0 }).ganancias(), [1, 1]);
  assert.deepEqual(new Mezclador({ crossfader: -1 }).ganancias(), [1, 0]);
  assert.deepEqual(new Mezclador({ crossfader: 1 }).ganancias(), [0, 1]);
  const [a, b] = new Mezclador({ crossfader: 0, curva: 'suave' }).ganancias();
  assert.ok(Math.abs(a - b) < 1e-9 && a > 0.7 && a < 0.71);
});

test('Cola: agregar sin duplicar, al principio, mover, sacar siguiente', () => {
  let c = new Cola().agregar('a').agregar('b').agregar('a');
  assert.deepEqual(c.ids, ['b', 'a']);
  c = c.agregar('c', { alPrincipio: true });
  assert.equal(c.siguiente, 'c');
  c = c.mover('a', 0);
  assert.deepEqual(c.ids, ['a', 'c', 'b']);
  assert.deepEqual(c.sacarSiguiente().ids, ['c', 'b']);
  assert.equal(c.vaciar().vacia, true);
});

test('puntosDeMezcla usa los puntos de VirtualDJ si existen; si no, deduce del final', () => {
  const conVdj = new Pista({ titulo: 'X', duracionSeg: 300, puntosMezcla: { inicioReal: 0.3, finReal: 296, inicioFade: 280, finFade: 292 } });
  assert.deepEqual(puntosDeMezcla(conVdj), { inicioReal: 0.3, finReal: 296, inicioFade: 280, finFade: 292 });
  const sin = new Pista({ titulo: 'Y', duracionSeg: 200 });
  assert.deepEqual(puntosDeMezcla(sin, { fadeSeg: 8 }), { inicioReal: 0, finReal: 200, inicioFade: 192, finFade: 200 });
});

test('decidirTransicion arranca al llegar al inicio del fade y calcula su duración', () => {
  const p = new Pista({ titulo: 'X', duracionSeg: 200 });
  assert.equal(decidirTransicion(p, 100, { fadeSeg: 8 }).arrancar, false);
  const d = decidirTransicion(p, 192.5, { fadeSeg: 8 });
  assert.equal(d.arrancar, true);
  assert.equal(d.duracionFadeSeg, 8);
});

test('tempoParaIgualar: iguala BPM dentro del rango, acepta doble/mitad, 0 si no se puede', () => {
  assert.ok(Math.abs(tempoParaIgualar(123, 120) - 0.025) < 1e-9);
  assert.ok(Math.abs(tempoParaIgualar(120, 123) - (120 / 123 - 1)) < 1e-3);
  assert.equal(tempoParaIgualar(120, 240), 0); // mitad exacta: tempo 0
  assert.ok(Math.abs(tempoParaIgualar(123, 136) - (123 / 136 - 1)) < 1e-3); // −9.6 %: dentro del rango
  assert.equal(tempoParaIgualar(100, 136), 0); // −26 % (o +47 % a mitad): fuera de rango → 0
  assert.equal(tempoParaIgualar(null, 120), 0);
});

test('tonosCompatibles sigue la rueda de Camelot', () => {
  assert.equal(tonosCompatibles('Am', 'C'), true);   // relativa
  assert.equal(tonosCompatibles('C', 'G'), true);    // vecina
  assert.equal(tonosCompatibles('C', 'F#'), false);
  assert.equal(tonosCompatibles('C', 'X'), null);
});
