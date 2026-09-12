import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsolaAPI } from '../../src/aplicacion/ConsolaAPI.js';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { TiposEvento } from '../../src/dominio/eventos.js';
import {
  RepositorioEnMemoria,
  ReproductorFalso,
  AnalizadorFalso,
  EmpaquetadorFalso,
  RelojFalso,
  blobFalso,
} from '../dobles/dobles.js';

function nuevaConsola(opts = {}) {
  const repositorio = opts.repositorio || new RepositorioEnMemoria();
  const reproductor = opts.reproductor || new ReproductorFalso();
  const analizador = opts.analizador || new AnalizadorFalso();
  const empaquetador = opts.empaquetador || new EmpaquetadorFalso();
  const reloj = opts.reloj || new RelojFalso();
  const consola = new ConsolaAPI({ repositorio, reproductor, analizador, empaquetador, reloj });
  return { consola, repositorio, reproductor, analizador, empaquetador, reloj };
}

test('iniciar() con repositorio vacío arranca con un tablero vacío', async () => {
  const { consola } = nuevaConsola();
  const t = await consola.iniciar();
  assert.equal(t.bancos.length, 0);
});

test('crearBanco + agregarSonido + dispararPad reproduce el sonido correcto', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  const banco = t.bancos[0];
  t = await consola.agregarSonido({ bancoId: banco.id, slot: 0, nombre: 'Air Horn', blob: blobFalso() });
  const sonido = t.bancos[0].sonidoEn(0);

  const resultado = await consola.dispararPad(banco.id, 0);
  assert.equal(resultado.sonido.id, sonido.id);
  assert.equal(reproductor.disparos.length, 1);
  assert.equal(reproductor.disparos[0].soundId, sonido.id);
});

test('dispararPad en un slot vacío lanza error', async () => {
  const { consola } = nuevaConsola();
  await consola.iniciar();
  const t = await consola.crearBanco('Vacío', '#000');
  await assert.rejects(() => consola.dispararPad(t.bancos[0].id, 0));
});

test('agregarSonido nivela el volumen: pico bajo produce ganancia > 1', async () => {
  const analizador = new AnalizadorFalso({ picoDb: -20, rmsDb: -30, duracionMs: 500 });
  const { consola } = nuevaConsola({ analizador });
  await consola.iniciar();
  const t0 = await consola.crearBanco('Golpes', '#111');
  const t = await consola.agregarSonido({ bancoId: t0.bancos[0].id, slot: 0, nombre: 'Bajo', blob: blobFalso() });
  const sonido = t.bancos[0].sonidoEn(0);
  assert.ok(sonido.ganancia.valor > 1, `esperaba ganancia > 1, fue ${sonido.ganancia.valor}`);
});

test('detenerTodo llama detenerTodos del reproductor y publica el evento', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  let recibido = false;
  consola.suscribir(TiposEvento.REPRODUCCION_DETENIDA, () => { recibido = true; });
  consola.detenerTodo();
  assert.equal(reproductor.detenidos.length, 1);
  assert.equal(reproductor.detenidos[0].todo, true);
  assert.equal(recibido, true);
});

test('UN_TIRO no se dispara dos veces al soltar el pad (bug de doble reproducción)', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  t = await consola.agregarSonido({ bancoId: t.bancos[0].id, slot: 0, nombre: 'Air Horn', blob: blobFalso() });
  const banco = t.bancos[0];

  await consola.dispararPad(banco.id, 0, { presionado: true });  // pointerdown / keydown
  await consola.dispararPad(banco.id, 0, { presionado: false }); // pointerup / keyup

  assert.equal(reproductor.disparos.length, 1, 'el sonido debe sonar una sola vez por toque');
});

test('LOOP tampoco se dispara al soltar el pad (solo al volver a tocarlo)', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Camas', '#111');
  t = await consola.agregarSonido({ bancoId: t.bancos[0].id, slot: 0, nombre: 'Cama', blob: blobFalso(), modo: ModoDisparo.LOOP });
  const banco = t.bancos[0];

  await consola.dispararPad(banco.id, 0, { presionado: true });
  await consola.dispararPad(banco.id, 0, { presionado: false });
  assert.equal(reproductor.disparos.length, 1);

  await consola.dispararPad(banco.id, 0, { presionado: true }); // segundo toque real: sí debe sonar
  assert.equal(reproductor.disparos.length, 2);
});

test('modo MANTENER: soltar el pad detiene solo ese sonido, no todo', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  const t0 = await consola.crearBanco('Camas', '#111');
  const t = await consola.agregarSonido({
    bancoId: t0.bancos[0].id, slot: 0, nombre: 'Redoble', blob: blobFalso(), modo: ModoDisparo.MANTENER,
  });
  const banco = t.bancos[0];
  await consola.dispararPad(banco.id, 0, { presionado: true });
  assert.equal(reproductor.disparos.length, 1);
  await consola.dispararPad(banco.id, 0, { presionado: false });
  assert.equal(reproductor.detenidos.length, 1);
  assert.equal(reproductor.detenidos[0].soundId, t.bancos[0].sonidoEn(0).id);
});

test('modo EXCLUSIVO corta otra cama del mismo banco antes de sonar', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Camas', '#111');
  const bancoId = t.bancos[0].id;
  t = await consola.agregarSonido({ bancoId, slot: 0, nombre: 'Cama A', blob: blobFalso(), modo: ModoDisparo.EXCLUSIVO });
  t = await consola.agregarSonido({ bancoId, slot: 1, nombre: 'Cama B', blob: blobFalso(), modo: ModoDisparo.EXCLUSIVO });

  await consola.dispararPad(bancoId, 0); // suena A
  await consola.dispararPad(bancoId, 1); // debe cortar A y sonar B

  const idA = t.bancos[0].sonidoEn(0).id;
  const cortoA = reproductor.detenidos.some((d) => d.soundId === idA);
  assert.equal(cortoA, true);
});

test('padAleatorio dispara un sonido del banco y evita repetir el último', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Risas', '#111');
  const bancoId = t.bancos[0].id;
  t = await consola.agregarSonido({ bancoId, slot: 0, nombre: 'Risa 1', blob: blobFalso() });
  t = await consola.agregarSonido({ bancoId, slot: 1, nombre: 'Risa 2', blob: blobFalso() });

  const vistos = new Set();
  for (let i = 0; i < 10; i++) {
    const r = await consola.padAleatorio(bancoId);
    vistos.add(r.sonido.nombre);
  }
  assert.equal(reproductor.disparos.length, 10);
  assert.ok(vistos.size >= 1);
});

test('editarSonido cambia nombre/color y persiste', async () => {
  const { consola, repositorio } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  t = await consola.agregarSonido({ bancoId: t.bancos[0].id, slot: 0, nombre: 'Viejo', blob: blobFalso() });
  const soundId = t.bancos[0].sonidoEn(0).id;
  t = await consola.editarSonido(soundId, { nombre: 'Nuevo nombre' });
  assert.equal(t.buscarSonido(soundId).sonido.nombre, 'Nuevo nombre');
  assert.equal(repositorio.tablero.buscarSonido(soundId).sonido.nombre, 'Nuevo nombre');
});

test('eliminarSonido borra el audio del repositorio y detiene si sonaba', async () => {
  const { consola, repositorio, reproductor } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  t = await consola.agregarSonido({ bancoId: t.bancos[0].id, slot: 0, nombre: 'X', blob: blobFalso() });
  const soundId = t.bancos[0].sonidoEn(0).id;
  assert.ok(repositorio.audios.has(soundId));
  t = await consola.eliminarSonido(soundId);
  assert.equal(repositorio.audios.has(soundId), false);
  assert.equal(t.buscarSonido(soundId), null);
  assert.ok(reproductor.detenidos.some((d) => d.soundId === soundId));
});

test('moverSonido lo reubica en otro banco/slot', async () => {
  const { consola } = nuevaConsola();
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  t = await consola.crearBanco('Camas', '#222');
  const golpes = t.bancoPorNombre('Golpes');
  const camas = t.bancoPorNombre('Camas');
  t = await consola.agregarSonido({ bancoId: golpes.id, slot: 0, nombre: 'X', blob: blobFalso() });
  const soundId = t.bancos.find((b) => b.id === golpes.id).sonidoEn(0).id;
  t = await consola.moverSonido(soundId, camas.id, 0);
  assert.equal(t.bancoPorId(golpes.id).sonidoEn(0), null);
  assert.equal(t.bancoPorId(camas.id).sonidoEn(0).id, soundId);
});

test('fijarVolumenMaestro actualiza el tablero y llama al reproductor', async () => {
  const { consola, reproductor } = nuevaConsola();
  await consola.iniciar();
  const t = await consola.fijarVolumenMaestro(0.4);
  assert.equal(t.volumenMaestro, 0.4);
  assert.equal(reproductor.maestro, 0.4);
});

test('exportar + importar (reemplazar=true) reconstruye el mismo tablero', async () => {
  const { consola: origen } = nuevaConsola();
  await origen.iniciar();
  let t = await origen.crearBanco('Golpes', '#111');
  t = await origen.agregarSonido({ bancoId: t.bancos[0].id, slot: 0, nombre: 'Air Horn', blob: blobFalso() });
  const paquete = await origen.exportarTablero();

  const { consola: destino } = nuevaConsola();
  await destino.iniciar();
  const tImportado = await destino.importarTablero(paquete, { reemplazar: true });
  assert.equal(tImportado.bancos.length, 1);
  assert.equal(tImportado.bancos[0].sonidoEn(0).nombre, 'Air Horn');
});

test('iniciar() vuelve a cargar el estado guardado por el repositorio (persistencia)', async () => {
  const repositorio = new RepositorioEnMemoria();
  const { consola: c1 } = nuevaConsola({ repositorio });
  await c1.iniciar();
  await c1.crearBanco('Golpes', '#111');

  const { consola: c2 } = nuevaConsola({ repositorio });
  const t2 = await c2.iniciar();
  assert.equal(t2.bancos.length, 1);
  assert.equal(t2.bancos[0].nombre, 'Golpes');
});
