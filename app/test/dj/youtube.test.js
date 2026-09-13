import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerVideoId, extraerVideoIds, tasaMasCercana, TASAS_YOUTUBE } from '../../src/yt/adaptadores/youtube.js';
import { DJAPI } from '../../src/dj/aplicacion/DJAPI.js';
import { MotorFalso, RepositorioBibliotecaEnMemoria, RelojControlado } from '../dobles/doblesDJ.js';
import { AnalizadorPista } from '../../src/dj/aplicacion/puertos.js';
import { BuscadorYouTube, duracionIso8601ASegundos } from '../../src/yt/adaptadores/BuscadorYouTube.js';

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
  // sin BPM, sync avisa que hay que marcarlo con TAP
  await dj.cargar('A', p.id);
  assert.throws(() => dj.sincronizar('A'), /TAP/);
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

test('fijarBpm (tap tempo) guarda el BPM en la pista y habilita SYNC entre dos videos', async () => {
  const motor = new MotorFalso();
  const dj = new DJAPI({ motor, repositorio: new RepositorioBibliotecaEnMemoria(), analizador: new AnalizadorYouTubeFalso(), importador: null, reloj: new RelojControlado() });
  await dj.iniciar();
  const a = await dj.importarArchivo({ videoId: 'dQw4w9WgXcQ' }, 'dQw4w9WgXcQ');
  const b = await dj.importarArchivo({ videoId: '9bZkp7q19f0' }, '9bZkp7q19f0');
  await dj.cargar('A', a.id); await dj.cargar('B', b.id);
  assert.throws(() => dj.sincronizar('B'), /TAP/, 'sin BPM avisa qué hacer');
  await dj.fijarBpm('A', 100.04);
  await dj.fijarBpm('B', 96);
  assert.equal(dj.pista(a.id).bpm, 100);
  assert.equal(dj.estado().decks.A.bpmEfectivo, 100);
  const t = dj.sincronizar('B');
  assert.ok(t > 0.03 && t < 0.05, `tempo ${t}`);
  assert.ok(Math.abs(dj.estado().decks.B.bpmEfectivo - 100) < 0.11);
  await assert.rejects(() => dj.fijarBpm('A', 500), /entre 40 y 250/);
});

test('BuscadorYouTube: arma la consulta, lee títulos/canal/duración y explica los errores', async () => {
  const llamadas = [];
  const fetchFalso = async (url) => {
    llamadas.push(url);
    if (url.includes('/search?')) return { ok: true, status: 200, json: async () => ({ items: [
      { id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'Rick &amp; Roll', channelTitle: 'Canal', thumbnails: { default: { url: 'https://i/1.jpg' } } } },
      { id: { videoId: '9bZkp7q19f0' }, snippet: { title: 'Gangnam', channelTitle: 'Psy', thumbnails: {} } },
      { id: { channelId: 'x' }, snippet: { title: 'un canal' } },
    ] }) };
    if (url.includes('/videos?')) return { ok: true, status: 200, json: async () => ({ items: [{ id: 'dQw4w9WgXcQ', contentDetails: { duration: 'PT3M33S' } }] }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const b = new BuscadorYouTube({ clave: 'AIzaPRUEBA', fetch: fetchFalso });
  const r = await b.buscar('never gonna');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { videoId: 'dQw4w9WgXcQ', titulo: 'Rick & Roll', canal: 'Canal', miniatura: 'https://i/1.jpg', duracionSeg: 213 });
  assert.equal(r[1].duracionSeg, 0);
  assert.ok(llamadas[0].includes('q=never+gonna') && llamadas[0].includes('videoEmbeddable=true') && llamadas[0].includes('key=AIzaPRUEBA'));
  assert.deepEqual(await b.buscar('   '), []);
  await assert.rejects(() => new BuscadorYouTube({ clave: '', fetch: fetchFalso }).buscar('x'), /Falta la clave/);
  const cuota = async () => ({ ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: 'quotaExceeded' }] } }) });
  await assert.rejects(() => new BuscadorYouTube({ clave: 'k', fetch: cuota }).buscar('x'), /cuota diaria/);
  const mala = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) });
  await assert.rejects(() => new BuscadorYouTube({ clave: 'k', fetch: mala }).buscar('x'), /rechazó la clave/);
  assert.equal(duracionIso8601ASegundos('PT1H2M3S'), 3723);
  assert.equal(duracionIso8601ASegundos('PT45S'), 45);
  assert.equal(duracionIso8601ASegundos(''), 0);
});
