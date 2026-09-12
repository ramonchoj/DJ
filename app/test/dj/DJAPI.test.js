import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DJAPI, EventosDJ } from '../../src/dj/aplicacion/DJAPI.js';
import { MotorFalso, RepositorioBibliotecaEnMemoria, AnalizadorPistaFalso, ImportadorFalso, RelojControlado, pistaBlob } from '../dobles/doblesDJ.js';

function nuevoDJ(opts = {}) {
  const motor = opts.motor || new MotorFalso();
  const repositorio = opts.repositorio || new RepositorioBibliotecaEnMemoria();
  const analizador = opts.analizador || new AnalizadorPistaFalso();
  const importador = 'importador' in opts ? opts.importador : new ImportadorFalso();
  const reloj = opts.reloj || new RelojControlado();
  const dj = new DJAPI({ motor, repositorio, analizador, importador, reloj });
  return { dj, motor, repositorio, analizador, importador, reloj };
}

async function conBiblioteca() {
  const ctx = nuevoDJ();
  await ctx.dj.iniciar();
  const p1 = await ctx.dj.importarArchivo(pistaBlob('a.mp3', { duracionSeg: 200, bpm: 120 }), 'Bee Gees - Stayin Alive.mp3');
  const p2 = await ctx.dj.importarArchivo(pistaBlob('b.mp3', { duracionSeg: 240, bpm: 123 }), 'Que Pasa.mp3');
  const p3 = await ctx.dj.importarArchivo(pistaBlob('c.mp3', { duracionSeg: 180, bpm: 100 }), 'Tarzan Boy.mp3');
  return { ...ctx, p1, p2, p3 };
}

test('importarArchivo analiza, normaliza y guarda; el mismo archivo no se duplica', async () => {
  const { dj, repositorio, p1 } = await conBiblioteca();
  assert.equal(p1.artista, 'Bee Gees');
  assert.equal(p1.titulo, 'Stayin Alive');
  assert.equal(p1.bpm, 120);
  assert.equal(p1.duracionSeg, 200);
  assert.equal(p1.origenAnalisis, 'propio');
  assert.ok(repositorio.audios.has(p1.id));
  const otra = await dj.importarArchivo(pistaBlob('a.mp3'), 'Bee Gees - Stayin Alive.mp3');
  assert.equal(otra.id, p1.id);
  assert.equal(dj.estado().pistas.length, 3);
});

test('buscar filtra por artista/título sin distinguir mayúsculas', async () => {
  const { dj } = await conBiblioteca();
  assert.equal(dj.buscar('bee').length, 1);
  assert.equal(dj.buscar('QUE').length, 1);
  assert.equal(dj.buscar('').length, 3);
});

test('importarAnalisisVirtualDJ aplica bpm/tono/cues/puntos por nombre de archivo', async () => {
  const mapa = new Map([['Que Pasa.mp3', { bpm: 136, tono: 'F#m', cues: [{ num: 1, seg: 30 }], puntosMezcla: { inicioReal: 0.5, finReal: 238, inicioFade: 225, finFade: 236 } }]]);
  const { dj, p2 } = await conBiblioteca();
  dj.importador.mapa = mapa;
  const r = await dj.importarAnalisisVirtualDJ('<xml/>');
  assert.deepEqual(r, { aplicados: 1, disponibles: 1 });
  const p = dj.pista(p2.id);
  assert.equal(p.bpm, 136);
  assert.equal(p.tono, 'F#m');
  assert.equal(p.origenAnalisis, 'virtualdj');
  assert.equal(p.cue(1).seg, 30);
  assert.equal(p.puntosMezcla.inicioFade, 225);
});

test('cargar en un deck: gananacia/eq/tasa aplicadas, salta al inicio real; loadSecurity bloquea si suena', async () => {
  const { dj, motor, p1, p2 } = await conBiblioteca();
  await dj.editarPista(p1.id, { puntosMezcla: { inicioReal: 1.5, finReal: 199, inicioFade: 190, finFade: 198 } });
  await dj.cargar('A', p1.id);
  assert.equal(motor.decks.A.cargado, true);
  assert.equal(motor.decks.A.posicion, 1.5);
  assert.ok(Math.abs(motor.decks.A.ganancia - 1) < 0.01);
  dj.reproducir('A');
  await assert.rejects(() => dj.cargar('A', p2.id), /sonando/);
  await dj.cargar('A', p2.id, { forzar: true });
  assert.equal(dj.deck('A').pista.id, p2.id);
});

test('reproducir/pausar/alternar reflejan en el motor y marcan la pista como tocada una vez', async () => {
  const { dj, motor, p1 } = await conBiblioteca();
  await dj.cargar('A', p1.id);
  dj.alternar('A');
  assert.equal(motor.decks.A.sonando, true);
  assert.equal(dj.deck('A').sonando, true);
  dj.alternar('A');
  assert.equal(motor.decks.A.sonando, false);
  dj.alternar('A');
  assert.equal(dj.pista(p1.id).vecesTocada, 1); // dos plays en <60 s cuentan una vez
  assert.equal(dj.estado().historial.length, 1);
});

test('tempo y sync: el deck B se iguala al BPM efectivo de A', async () => {
  const { dj, motor, p1, p2 } = await conBiblioteca(); // A=120, B=123
  await dj.cargar('A', p1.id);
  await dj.cargar('B', p2.id);
  dj.fijarTempo('A', 0.05); // A → 126 bpm
  assert.equal(dj.deck('A').bpmEfectivo, 126);
  const t = dj.sincronizar('B');
  assert.ok(Math.abs(t - (126 / 123 - 1)) < 1e-3);
  assert.ok(Math.abs(motor.decks.B.tasa - (1 + t)) < 1e-9);
});

test('hot cue: primera vez fija en la posición actual, segunda vez salta; borrar', async () => {
  const { dj, motor, p1 } = await conBiblioteca();
  await dj.cargar('A', p1.id);
  motor.decks.A.posicion = 42;
  const c = await dj.cue('A', 1);
  assert.deepEqual([c.num, c.seg], [1, 42]);
  motor.decks.A.posicion = 90;
  await dj.cue('A', 1);
  assert.equal(motor.decks.A.posicion, 42);
  await dj.borrarCue('A', 1);
  assert.equal(dj.deck('A').pista.cue(1), null);
});

test('loop de 4 beats a 120 bpm = 2 s desde la posición; repetir lo quita; el tempo lo recalcula', async () => {
  const { dj, motor, p1 } = await conBiblioteca();
  await dj.cargar('A', p1.id);
  motor.decks.A.posicion = 10;
  dj.loop('A', 4);
  assert.deepEqual(motor.decks.A.loop, { inicioSeg: 10, finSeg: 12 });
  dj.fijarTempo('A', 0.12); // 134.4 bpm → 4 beats = 1.786 s
  assert.ok(Math.abs(motor.decks.A.loop.finSeg - 10 - 60 / 134.4 * 4) < 1e-6);
  dj.loop('A', 4);
  assert.equal(motor.decks.A.loop, null);
});

test('eq y volumen por deck llegan al motor', async () => {
  const { dj, motor, p1 } = await conBiblioteca();
  await dj.cargar('A', p1.id);
  dj.fijarEq('A', 'baja', -40);
  dj.fijarVolumen('A', 0.5);
  assert.equal(motor.decks.A.eq.baja, -40);
  assert.equal(motor.decks.A.volumen, 0.5);
});

test('crossfader y maestro se aplican al motor y se persisten', async () => {
  const { dj, motor, repositorio } = await conBiblioteca();
  await dj.fijarCrossfader(-1);
  assert.deepEqual([motor.crossfader.a, motor.crossfader.b], [1, 0]);
  await dj.fijarMaestro(0.6);
  assert.equal(motor.maestro, 0.6);
  assert.equal(repositorio.estado.mezclador.crossfader, -1);
});

test('cola: encolar/desencolar/mover se persisten y sobreviven a reiniciar', async () => {
  const { dj, repositorio, p1, p2, p3 } = await conBiblioteca();
  await dj.encolar(p1.id); await dj.encolar(p2.id); await dj.encolar(p3.id, { alPrincipio: true });
  assert.deepEqual(dj.estado().cola.ids, [p3.id, p1.id, p2.id]);
  await dj.moverEnCola(p2.id, 0);
  await dj.desencolar(p3.id);
  assert.deepEqual(dj.estado().cola.ids, [p2.id, p1.id]);
  const { dj: dj2 } = nuevoDJ({ repositorio });
  await dj2.iniciar();
  assert.deepEqual(dj2.estado().cola.ids, [p2.id, p1.id]);
});

test('automix: activar con nada sonando arranca la primera de la cola en el deck activo', async () => {
  const { dj, motor, p1, p2 } = await conBiblioteca();
  await dj.encolar(p1.id); await dj.encolar(p2.id);
  await dj.activarAutomix(true);
  assert.equal(dj.deck('A').pista.id, p1.id);
  assert.equal(motor.decks.A.sonando, true);
  assert.deepEqual(dj.estado().cola.ids, [p2.id]);
  assert.deepEqual([motor.crossfader.a, motor.crossfader.b], [1, 0]);
});

test('automix: al llegar al punto de mezcla arranca la siguiente en B con beatmatch y crossfade; al terminar el fade libera A', async () => {
  const { dj, motor, reloj, p1, p2 } = await conBiblioteca(); // p1 200 s @120, p2 @123
  await dj.encolar(p1.id); await dj.encolar(p2.id);
  await dj.activarAutomix(true);
  let transiciones = 0;
  dj.suscribir(EventosDJ.TRANSICION, () => { transiciones += 1; });

  motor.decks.A.posicion = 100;
  await dj.tick();
  assert.equal(dj.deck('B').pista, null, 'todavía no toca mezclar');

  motor.decks.A.posicion = 193; // fade por defecto 8 s → inicioFade = 192
  await dj.tick();
  assert.equal(dj.deck('B').pista.id, p2.id);
  assert.equal(motor.decks.B.sonando, true);
  assert.ok(Math.abs(motor.decks.B.tasa - 120 / 123) < 1e-3, 'B igualado al BPM de A');
  assert.deepEqual([motor.crossfader.a, motor.crossfader.b, motor.crossfader.rampaSeg], [0, 1, 8]);
  assert.ok(dj.estado().transicion);
  assert.equal(transiciones, 1);

  reloj.avanzar(3000);
  await dj.tick();
  assert.ok(dj.estado().transicion, 'sigue en transición a los 3 s');
  reloj.avanzar(6000);
  await dj.tick();
  assert.equal(dj.estado().transicion, null);
  assert.equal(dj.deck('A').pista, null, 'A quedó libre');
  assert.equal(dj.estado().deckActivo, 'B');
  assert.equal(motor.decks.A.sonando, false);
  assert.equal(dj.estado().cola.vacia, true);
});

test('mezclarYa fuerza la transición aunque no sea el punto de mezcla; sin cola no hace nada', async () => {
  const { dj, motor, p1, p2 } = await conBiblioteca();
  await dj.cargar('A', p1.id); dj.reproducir('A');
  assert.equal(await dj.mezclarYa(), false);
  await dj.encolar(p2.id);
  assert.equal(await dj.mezclarYa(4), true);
  assert.equal(motor.decks.B.sonando, true);
  assert.equal(motor.crossfader.rampaSeg, 4);
});

test('cuando la pista termina sola, el deck deja de estar "sonando"', async () => {
  const { dj, motor, p1 } = await conBiblioteca();
  await dj.cargar('A', p1.id); dj.reproducir('A');
  motor.simularFin('A');
  assert.equal(dj.deck('A').sonando, false);
});

test('eliminarPista la saca de la cola y descarga el deck que la tenía', async () => {
  const { dj, motor, p1, p2 } = await conBiblioteca();
  await dj.cargar('A', p1.id);
  await dj.encolar(p1.id); await dj.encolar(p2.id);
  await dj.eliminarPista(p1.id);
  assert.equal(dj.deck('A').pista, null);
  assert.deepEqual(dj.estado().cola.ids, [p2.id]);
  assert.equal(motor.decks.A.cargado, false);
  assert.throws(() => dj.pista(p1.id));
});

test('atenuar (talkover) llega al motor', async () => {
  const { dj, motor } = await conBiblioteca();
  dj.atenuar(0.3, 1500);
  assert.deepEqual(motor.atenuaciones, [{ factor: 0.3, ms: 1500 }]);
});

test('grabación de sesión: iniciar/detener devuelve un archivo y publica cambios; sin soporte, error claro', async () => {
  const { GrabadorSesionFalso } = await import('../dobles/doblesDJ.js');
  const grab = new GrabadorSesionFalso();
  const { dj } = nuevoDJ();
  dj.grabadorSesion = grab;
  await dj.iniciar();
  assert.equal(dj.grabacionSesionSoportada(), true);
  let eventos = 0;
  dj.suscribir(EventosDJ.AUTOMIX_CAMBIADO, () => { eventos += 1; });
  await dj.iniciarGrabacionSesion();
  assert.equal(dj.grabandoSesion(), true);
  const blob = await dj.detenerGrabacionSesion();
  assert.equal(blob.size, 4096);
  assert.equal(dj.grabandoSesion(), false);
  assert.equal(eventos, 2);
  await assert.rejects(() => dj.detenerGrabacionSesion(), /grabación/);
  dj.grabadorSesion = new GrabadorSesionFalso({ soportado: false });
  await assert.rejects(() => dj.iniciarGrabacionSesion(), /grabar/);
});
