import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerVideoId, extraerVideoIds, tasaMasCercana, TASAS_YOUTUBE } from '../../src/yt/adaptadores/youtube.js';
import { DJAPI } from '../../src/dj/aplicacion/DJAPI.js';
import { MotorFalso, RepositorioBibliotecaEnMemoria, RelojControlado } from '../dobles/doblesDJ.js';
import { AnalizadorPista } from '../../src/dj/aplicacion/puertos.js';

test('extraerVideoId acepta todos los formatos de enlace de YouTube y el id pelón', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&list=PL123&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    id,
  ]) assert.equal(extraerVideoId(u), id, u);
  assert.equal(extraerVideoId('https://vimeo.com/123'), null);
  assert.equal(extraerVideoId('hola'), null);
  assert.equal(extraerVideoId(''), null);
});

test('extraerVideoIds saca varios enlaces de un texto y no repite', () => {
  const t = 'https://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/watch?v=9bZkp7q19f0 , dQw4w9WgXcQ';
  assert.deepEqual(extraerVideoIds(t), ['dQw4w9WgXcQ', '9bZkp7q19f0']);
});

test('tasaMasCercana elige el paso de YouTube más cercano al tempo pedido', () => {
  assert.equal(tasaMasCercana(1.05), 1);
  assert.equal(tasaMasCercana(1.12), 1);
  assert.equal(tasaMasCercana(1.2), 1.25);
  assert.equal(tasaMasCercana(0.9), 1);
  assert.equal(tasaMasCercana(0.86), 0.75);
  assert.equal(tasaMasCercana(1.3, [1, 1.5]), 1.5);
  assert.equal(TASAS_YOUTUBE.length, 8);
});

class AnalizadorYouTubeFalso extends AnalizadorPista {
  async analizar(blob) { return { duracionSeg: 213, picoDb: -3, bpm: null, titulo: `Artista Prueba - Canción ${blob.videoId}` }; }
}

test('DJAPI con analizador de YouTube: el título viene del analizador y el archivo es el videoId', async () => {
  const repositorio = new RepositorioBibliotecaEnMemoria();
  const dj = new DJAPI({ motor: new MotorFalso(), repositorio, analizador: new AnalizadorYouTubeFalso(), importador: null, reloj: new RelojControlado() });
  await dj.iniciar();
  const p = await dj.importarArchivo({ videoId: 'dQw4w9WgXcQ' }, 'dQw4w9WgXcQ');
  assert.equal(p.artista, 'Artista Prueba');
  assert.equal(p.titulo, 'Canción dQw4w9WgXcQ');
  assert.equal(p.archivo, 'dQw4w9WgXcQ');
  assert.equal(p.duracionSeg, 213);
  assert.equal(p.bpm, null);
  assert.equal(p.origenAnalisis, 'ninguno');
  // el "audio" guardado es la referencia al video, no un blob
  assert.deepEqual(repositorio.audios.get(p.id), { videoId: 'dQw4w9WgXcQ' });
  // sin BPM, sync no cambia el tempo y la mezcla sigue funcionando
  await dj.cargar('A', p.id);
  assert.equal(dj.sincronizar('A'), 0);
});

test('precarga: automática al cargar y manual con precargar(); nunca sobre un deck sonando', async () => {
  const motor = new MotorFalso();
  const dj = new DJAPI({ motor, repositorio: new RepositorioBibliotecaEnMemoria(), analizador: new AnalizadorYouTubeFalso(), importador: null, reloj: new RelojControlado(), precargaAutomaticaSeg: 60 });
  await dj.iniciar();
  assert.deepEqual(dj.precarga('A'), { segundos: 0, fraccion: 0 }, 'deck vacío: nada en buffer');
  const p = await dj.importarArchivo({ videoId: 'dQw4w9WgXcQ' }, 'dQw4w9WgXcQ');
  await dj.cargar('A', p.id);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(motor.llamadas.filter((l) => l[0] === 'precargar'), [['precargar', 'A', 60]]);
  assert.equal(dj.precarga('A').segundos, 60);
  const r = await dj.precargar('A', { segundos: 120 });
  assert.equal(r.segundos, 120);
  assert.ok(Math.abs(r.fraccion - 120 / motor.duracion('A')) < 1e-9);
  dj.reproducir('A');
  const antes = motor.llamadas.length;
  await dj.precargar('A', { segundos: 200 });
  assert.equal(motor.llamadas.length, antes, 'sonando: no se toca el motor');
  await assert.rejects(() => dj.precargar('B'), /no tiene pista/);
});

test('sin precargaAutomaticaSeg no se precarga nada al cargar', async () => {
  const motor = new MotorFalso();
  const dj = new DJAPI({ motor, repositorio: new RepositorioBibliotecaEnMemoria(), analizador: new AnalizadorYouTubeFalso(), importador: null, reloj: new RelojControlado() });
  await dj.iniciar();
  const p = await dj.importarArchivo({ videoId: 'dQw4w9WgXcQ' }, 'dQw4w9WgXcQ');
  await dj.cargar('A', p.id);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(motor.llamadas.filter((l) => l[0] === 'precargar').length, 0);
});

test('colocar(): primer deck vacío A, luego B, después la cola', async () => {
  const motor = new MotorFalso();
  const dj = new DJAPI({ motor, repositorio: new RepositorioBibliotecaEnMemoria(), analizador: new AnalizadorYouTubeFalso(), importador: null, reloj: new RelojControlado() });
  await dj.iniciar();
  const ids = ['dQw4w9WgXcQ', '9bZkp7q19f0', 'kJQP7kiw5Fk'];
  const pistas = [];
  for (const id of ids) pistas.push(await dj.importarArchivo({ videoId: id }, id));
  assert.equal(dj.estado().pistas.length, 3, 'las tres siguen en la biblioteca');
  assert.equal(await dj.colocar(pistas[0].id), 'A');
  assert.equal(await dj.colocar(pistas[1].id), 'B');
  assert.equal(await dj.colocar(pistas[2].id), 'cola');
  const e = dj.estado();
  assert.equal(e.decks.A.pista.id, pistas[0].id);
  assert.equal(e.decks.B.pista.id, pistas[1].id);
  assert.deepEqual(e.cola.ids, [pistas[2].id]);
  assert.equal(e.pistas.length, 3);
});
