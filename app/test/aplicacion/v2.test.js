import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsolaAPI } from '../../src/aplicacion/ConsolaAPI.js';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { TiposEvento } from '../../src/dominio/eventos.js';
import {
  RepositorioEnMemoria, ReproductorFalso, AnalizadorFalso, EmpaquetadorFalso, RelojFalso, GrabadoraFalsa, blobFalso,
} from '../dobles/dobles.js';

function nuevaConsola(opts = {}) {
  const repositorio = opts.repositorio || new RepositorioEnMemoria();
  const reproductor = opts.reproductor || new ReproductorFalso();
  const analizador = opts.analizador || new AnalizadorFalso();
  const empaquetador = opts.empaquetador || new EmpaquetadorFalso();
  const reloj = opts.reloj || new RelojFalso();
  const grabadora = 'grabadora' in opts ? opts.grabadora : new GrabadoraFalsa();
  const consola = new ConsolaAPI({ repositorio, reproductor, analizador, empaquetador, reloj, grabadora });
  return { consola, repositorio, reproductor, analizador, grabadora };
}

async function conGolpesYCamas() {
  const ctx = nuevaConsola();
  const { consola } = ctx;
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  t = await consola.crearBanco('Camas', '#222', { esCama: true });
  const golpes = t.bancoPorNombre('Golpes');
  const camas = t.bancoPorNombre('Camas');
  t = await consola.agregarSonido({ bancoId: golpes.id, slot: 0, nombre: 'Air Horn', blob: blobFalso() });
  t = await consola.agregarSonido({ bancoId: golpes.id, slot: 1, nombre: 'Aplausos', blob: blobFalso() });
  t = await consola.agregarSonido({ bancoId: camas.id, slot: 0, nombre: 'Cama', blob: blobFalso(), modo: ModoDisparo.LOOP });
  return { ...ctx, t, golpes: t.bancoPorId(golpes.id), camas: t.bancoPorId(camas.id) };
}

test('el disparo aplica ganancia efectiva (normalización × volumen) y tasa por tono', async () => {
  const analizador = new AnalizadorFalso({ picoDb: -3, rmsDb: -18, duracionMs: 2000 }); // ganancia ≈ 1
  const { consola, reproductor } = nuevaConsola({ analizador });
  await consola.iniciar();
  let t = await consola.crearBanco('Golpes', '#111');
  t = await consola.agregarSonido({ bancoId: t.bancos[0].id, slot: 0, nombre: 'X', blob: blobFalso() });
  const id = t.bancos[0].sonidoEn(0).id;
  await consola.editarSonido(id, { volumen: 0.5, tono: 12 });
  await consola.dispararPad(t.bancos[0].id, 0);
  const d = reproductor.disparos[0];
  assert.ok(Math.abs(d.opciones.ganancia - 0.5) < 0.01, `ganancia ${d.opciones.ganancia}`);
  assert.equal(d.opciones.tasa, 2);
});

test('ducking: al disparar un golpe se atenúan las camas activas por la duración del golpe', async () => {
  const { consola, reproductor, golpes, camas, t } = await conGolpesYCamas();
  await consola.dispararPad(camas.id, 0); // cama sonando en loop
  const camaId = t.bancoPorId(camas.id).sonidoEn(0).id;
  await consola.dispararPad(golpes.id, 0); // golpe encima
  assert.equal(reproductor.atenuaciones.length, 1);
  assert.deepEqual(reproductor.atenuaciones[0].soundIds, [camaId]);
  assert.equal(reproductor.atenuaciones[0].factor, 0.3);
  assert.equal(reproductor.atenuaciones[0].ms, 1000); // duración del golpe (AnalizadorFalso)
});

test('ducking: una cama no atenúa a otra cama, y con ducking=1 no se atenúa nada', async () => {
  const { consola, reproductor, golpes, camas } = await conGolpesYCamas();
  await consola.dispararPad(camas.id, 0);
  await consola.agregarSonido({ bancoId: camas.id, slot: 1, nombre: 'Cama 2', blob: blobFalso(), modo: ModoDisparo.LOOP });
  await consola.dispararPad(camas.id, 1);
  assert.equal(reproductor.atenuaciones.length, 0);
  await consola.editarAjustes({ ducking: 1 });
  await consola.dispararPad(golpes.id, 0);
  assert.equal(reproductor.atenuaciones.length, 0);
});

test('modo uno a la vez: un golpe corta los otros golpes pero no las camas', async () => {
  const { consola, reproductor, golpes, camas, t } = await conGolpesYCamas();
  await consola.editarAjustes({ unoALaVez: true });
  await consola.dispararPad(camas.id, 0);
  await consola.dispararPad(golpes.id, 0);
  const airHornId = t.bancoPorId(golpes.id).sonidoEn(0).id;
  const camaId = t.bancoPorId(camas.id).sonidoEn(0).id;
  await consola.dispararPad(golpes.id, 1); // Aplausos: debe cortar Air Horn, no la cama
  assert.ok(reproductor.detenidos.some((d) => d.soundId === airHornId));
  assert.ok(!reproductor.detenidos.some((d) => d.soundId === camaId));
  assert.equal(reproductor.activos().length, 2); // cama + aplausos
});

test('modo libre (por defecto): los golpes se solapan', async () => {
  const { consola, reproductor, golpes } = await conGolpesYCamas();
  await consola.dispararPad(golpes.id, 0);
  await consola.dispararPad(golpes.id, 1);
  assert.equal(reproductor.activos().length, 2);
});

test('buscar() desde la fachada filtra en todos los bancos', async () => {
  const { consola } = await conGolpesYCamas();
  assert.equal(consola.buscar('cama').length, 1);
  assert.equal(consola.buscar('a').length, 3);
});

test('editarBanco cambia nombre, color y marca de cama; reordenarBancos persiste', async () => {
  const { consola, repositorio, golpes, camas } = await conGolpesYCamas();
  let t = await consola.editarBanco(golpes.id, { nombre: 'Stingers', color: '#abc', esCama: false });
  assert.equal(t.bancoPorId(golpes.id).nombre, 'Stingers');
  assert.equal(t.bancoPorId(golpes.id).color, '#abc');
  t = await consola.reordenarBancos([camas.id, golpes.id]);
  assert.deepEqual(t.bancos.map((b) => b.id), [camas.id, golpes.id]);
  assert.deepEqual(repositorio.tablero.bancos.map((b) => b.id), [camas.id, golpes.id]);
});

test('editarAjustes persiste y publica AJUSTES_CAMBIADOS', async () => {
  const { consola, repositorio } = await conGolpesYCamas();
  let recibido = null;
  consola.suscribir(TiposEvento.AJUSTES_CAMBIADOS, (e) => { recibido = e.ajustes; });
  const t = await consola.editarAjustes({ unoALaVez: true, ducking: 0.5 });
  assert.equal(t.ajustes.unoALaVez, true);
  assert.equal(repositorio.tablero.ajustes.ducking, 0.5);
  assert.equal(recibido.ducking, 0.5);
});

test('grabar: iniciar → detener deja un pad nuevo con origen GRABADO y normalizado', async () => {
  const { consola, grabadora, golpes } = await conGolpesYCamas();
  assert.equal(consola.grabacionSoportada(), true);
  await consola.iniciarGrabacion();
  assert.equal(consola.grabando(), true);
  assert.equal(grabadora.estado, 'grabando');
  const t = await consola.detenerGrabacion({ bancoId: golpes.id, nombre: 'Nombre del festejado' });
  assert.equal(consola.grabando(), false);
  const nuevo = t.bancoPorId(golpes.id).listaSonidos().find((s) => s.nombre === 'Nombre del festejado');
  assert.ok(nuevo);
  assert.equal(nuevo.origen, 'GRABADO');
  assert.equal(nuevo.duracionMs, 1000);
});

test('grabar sin soporte de micrófono lanza error claro y no cambia el tablero', async () => {
  const { consola } = nuevaConsola({ grabadora: new GrabadoraFalsa({ soportada: false }) });
  await consola.iniciar();
  assert.equal(consola.grabacionSoportada(), false);
  await assert.rejects(() => consola.iniciarGrabacion(), /micrófono/);
});

test('grabar sin grabadora inyectada (null) se reporta como no soportado', async () => {
  const { consola } = nuevaConsola({ grabadora: null });
  await consola.iniciar();
  assert.equal(consola.grabacionSoportada(), false);
});

test('eliminarBanco detiene y borra los audios de todos sus sonidos', async () => {
  const { consola, repositorio, reproductor, golpes, t } = await conGolpesYCamas();
  const ids = t.bancoPorId(golpes.id).listaSonidos().map((s) => s.id);
  const r = await consola.eliminarBanco(golpes.id);
  assert.equal(r.bancos.length, 1);
  for (const id of ids) {
    assert.equal(repositorio.audios.has(id), false);
    assert.ok(reproductor.detenidos.some((d) => d.soundId === id));
  }
});

test('exportar e importar conserva ajustes, camas, volumen y tono', async () => {
  const { consola, golpes, camas, t } = await conGolpesYCamas();
  const id = t.bancoPorId(golpes.id).sonidoEn(0).id;
  await consola.editarSonido(id, { volumen: 0.7, tono: -5, emoji: '📯' });
  await consola.editarAjustes({ unoALaVez: true });
  const paquete = await consola.exportarTablero();

  const { consola: destino } = nuevaConsola();
  await destino.iniciar();
  const r = await destino.importarTablero(paquete, { reemplazar: true });
  assert.equal(r.ajustes.unoALaVez, true);
  assert.equal(r.bancoPorId(camas.id).esCama, true);
  const s = r.buscarSonido(id).sonido;
  assert.equal(s.volumen, 0.7);
  assert.equal(s.tono, -5);
  assert.equal(s.emoji, '📯');
});
