import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tablero } from '../../src/dominio/Tablero.js';
import { Sonido } from '../../src/dominio/Sonido.js';
import { Ajustes } from '../../src/dominio/valores/Ajustes.js';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { ErrorValidacion } from '../../src/dominio/errores.js';
import { sonidosAAtenuar, sonidosACortarUnoALaVez } from '../../src/dominio/servicios/ReglasDeDucking.js';

// --- Sonido: volumen, tono, emoji ---

test('volumen manual se limita a [0, 1.5] y se multiplica con la ganancia automática', () => {
  const s = new Sonido({ nombre: 'X', ganancia: 0.5, volumen: 3 });
  assert.equal(s.volumen, 1.5);
  assert.equal(s.gananciaEfectiva, 0.75);
  assert.equal(new Sonido({ nombre: 'X', volumen: -1 }).volumen, 0);
  assert.equal(new Sonido({ nombre: 'X' }).volumen, 1);
});

test('tono se limita a [-12, 12] semitonos y define la tasa de reproducción', () => {
  assert.equal(new Sonido({ nombre: 'X', tono: 40 }).tono, 12);
  assert.equal(new Sonido({ nombre: 'X', tono: -40 }).tono, -12);
  assert.equal(new Sonido({ nombre: 'X' }).tasaReproduccion, 1);
  assert.equal(new Sonido({ nombre: 'X', tono: 12 }).tasaReproduccion, 2);
  assert.equal(new Sonido({ nombre: 'X', tono: -12 }).tasaReproduccion, 0.5);
  assert.ok(Math.abs(new Sonido({ nombre: 'X', tono: 7 }).tasaReproduccion - 1.4983) < 0.001);
});

test('emoji se guarda recortado y sobrevive al JSON', () => {
  const s = new Sonido({ nombre: 'Aplausos', emoji: '👏', volumen: 0.8, tono: 3 });
  const r = Sonido.desdeJSON(JSON.parse(JSON.stringify(s)));
  assert.equal(r.emoji, '👏');
  assert.equal(r.volumen, 0.8);
  assert.equal(r.tono, 3);
});

test('un sonido v1 (sin volumen/tono/emoji) se carga con valores por defecto', () => {
  const v1 = { id: 'a', nombre: 'Viejo', color: '#000', modo: 'UN_TIRO', ganancia: 1.2, teclaRapida: null, duracionMs: 100, origen: 'FABRICA', creadoEn: 1 };
  const s = Sonido.desdeJSON(v1);
  assert.equal(s.volumen, 1);
  assert.equal(s.tono, 0);
  assert.equal(s.emoji, '');
});

test('coincideCon busca por nombre (sin distinguir mayúsculas) y por tecla', () => {
  const s = new Sonido({ nombre: 'Air Horn', teclaRapida: 'A' });
  assert.equal(s.coincideCon('horn'), true);
  assert.equal(s.coincideCon('AIR'), true);
  assert.equal(s.coincideCon('a'), true);
  assert.equal(s.coincideCon('sirena'), false);
  assert.equal(s.coincideCon(''), true);
});

// --- Ajustes ---

test('Ajustes valida el rango del ducking', () => {
  assert.throws(() => new Ajustes({ ducking: 2 }), ErrorValidacion);
  assert.throws(() => new Ajustes({ ducking: -0.1 }), ErrorValidacion);
  const a = Ajustes.porDefecto();
  assert.equal(a.unoALaVez, false);
  assert.equal(a.ducking, 0.3);
  assert.equal(a.con({ unoALaVez: true }).unoALaVez, true);
});

test('un tablero v1 (sin ajustes) se carga con ajustes por defecto y versión 2', () => {
  const v1 = { version: 1, volumenMaestro: 0.8, bancos: [] };
  const t = Tablero.desdeJSON(v1, Sonido);
  assert.equal(t.version, 2);
  assert.equal(t.ajustes.ducking, 0.3);
  assert.equal(t.volumenMaestro, 0.8);
});

// --- Tablero: búsqueda, reordenar, camas, intercambio de slots ---

function tableroConDosBancos() {
  let t = Tablero.vacio().crearBanco('Golpes', '#111').crearBanco('Camas', '#222', { esCama: true });
  const golpes = t.bancoPorNombre('Golpes');
  const camas = t.bancoPorNombre('Camas');
  t = t.conSonidoAgregado(golpes.id, 0, new Sonido({ nombre: 'Air Horn', teclaRapida: 'A' }));
  t = t.conSonidoAgregado(golpes.id, 1, new Sonido({ nombre: 'Aplausos' }));
  t = t.conSonidoAgregado(camas.id, 0, new Sonido({ nombre: 'Cama salsa', modo: ModoDisparo.LOOP }));
  return { t, golpes: t.bancoPorId(golpes.id), camas: t.bancoPorId(camas.id) };
}

test('buscar() encuentra sonidos en todos los bancos con su slot', () => {
  const { t } = tableroConDosBancos();
  const r = t.buscar('a');
  assert.equal(r.length, 3); // Air Horn (tecla A + nombre), Aplausos, Cama salsa
  const salsa = t.buscar('salsa');
  assert.equal(salsa.length, 1);
  assert.equal(salsa[0].banco.nombre, 'Camas');
  assert.equal(salsa[0].slot, 0);
  assert.equal(t.buscar('zzz').length, 0);
});

test('crearBanco con esCama marca el banco como cama musical', () => {
  const { camas, golpes } = tableroConDosBancos();
  assert.equal(camas.esCama, true);
  assert.equal(golpes.esCama, false);
  assert.equal(golpes.comoCama(true).esCama, true);
});

test('conBancosReordenados cambia el orden según la lista de ids', () => {
  const { t, golpes, camas } = tableroConDosBancos();
  assert.deepEqual(t.bancos.map((b) => b.nombre), ['Golpes', 'Camas']);
  const r = t.conBancosReordenados([camas.id, golpes.id]);
  assert.deepEqual(r.bancos.map((b) => b.nombre), ['Camas', 'Golpes']);
});

test('moverSonido dentro del mismo banco a un slot ocupado intercambia (arrastrar y soltar)', () => {
  const { t, golpes } = tableroConDosBancos();
  const airHorn = golpes.sonidoEn(0);
  const aplausos = golpes.sonidoEn(1);
  const r = t.moverSonido(airHorn.id, golpes.id, 1);
  assert.equal(r.bancoPorId(golpes.id).sonidoEn(1).id, airHorn.id);
  assert.equal(r.bancoPorId(golpes.id).sonidoEn(0).id, aplausos.id);
});

test('moverSonido a un slot libre de otro banco lo traslada', () => {
  const { t, golpes, camas } = tableroConDosBancos();
  const airHorn = golpes.sonidoEn(0);
  const r = t.moverSonido(airHorn.id, camas.id, 3);
  assert.equal(r.bancoPorId(golpes.id).sonidoEn(0), null);
  assert.equal(r.bancoPorId(camas.id).sonidoEn(3).id, airHorn.id);
});

test('listaSonidos() devuelve los sonidos ordenados por slot', () => {
  let t = Tablero.vacio().crearBanco('B', '#000');
  const b = t.bancos[0];
  t = t.conSonidoAgregado(b.id, 5, new Sonido({ nombre: 'Cinco' }));
  t = t.conSonidoAgregado(b.id, 1, new Sonido({ nombre: 'Uno' }));
  t = t.conSonidoAgregado(b.id, 3, new Sonido({ nombre: 'Tres' }));
  assert.deepEqual(t.bancos[0].listaSonidos().map((s) => s.nombre), ['Uno', 'Tres', 'Cinco']);
});

// --- Reglas de ducking y uno-a-la-vez ---

test('sonidosAAtenuar: solo camas activas, y solo si el nuevo no es cama', () => {
  const esCama = (id) => id === 'camas';
  const activos = [
    { soundId: 'cama1', bancoId: 'camas' },
    { soundId: 'golpe1', bancoId: 'golpes' },
  ];
  assert.deepEqual(sonidosAAtenuar({ bancoNuevoId: 'golpes', activos, esBancoCama: esCama, ducking: 0.3 }), ['cama1']);
  assert.deepEqual(sonidosAAtenuar({ bancoNuevoId: 'camas', activos, esBancoCama: esCama, ducking: 0.3 }), []);
  assert.deepEqual(sonidosAAtenuar({ bancoNuevoId: 'golpes', activos, esBancoCama: esCama, ducking: 1 }), []);
});

test('sonidosACortarUnoALaVez: corta todo menos las camas y el propio sonido', () => {
  const esCama = (id) => id === 'camas';
  const activos = [
    { soundId: 'cama1', bancoId: 'camas' },
    { soundId: 'golpe1', bancoId: 'golpes' },
    { soundId: 'nuevo', bancoId: 'golpes' },
  ];
  assert.deepEqual(sonidosACortarUnoALaVez({ activos, esBancoCama: esCama, soundIdNuevo: 'nuevo' }), ['golpe1']);
});
