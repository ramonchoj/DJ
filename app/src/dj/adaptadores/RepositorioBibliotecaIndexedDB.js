import { RepositorioBiblioteca } from '../aplicacion/puertos.js';
import { Pista } from '../dominio/Pista.js';

const NOMBRE_BD = 'cabina-dj';
const VERSION_BD = 1;
const PISTAS = 'pistas';
const AUDIOS = 'audios';
const ESTADO = 'estado';

function abrir(nombre = NOMBRE_BD) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(nombre, VERSION_BD);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of [PISTAS, AUDIOS, ESTADO]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const pedir = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export class RepositorioBibliotecaIndexedDB extends RepositorioBiblioteca {
  #db;
  constructor({ nombre = NOMBRE_BD } = {}) { super(); this.#db = abrir(nombre); }
  async #store(nombre, modo) { return (await this.#db).transaction(nombre, modo).objectStore(nombre); }

  async cargarPistas() {
    const s = await this.#store(PISTAS, 'readonly');
    const todas = await pedir(s.getAll());
    return todas.map((j) => Pista.desdeJSON(j));
  }
  async guardarPista(p) { await pedir((await this.#store(PISTAS, 'readwrite')).put(p.toJSON(), p.id)); }
  async eliminarPista(id) {
    await pedir((await this.#store(PISTAS, 'readwrite')).delete(id));
    await pedir((await this.#store(AUDIOS, 'readwrite')).delete(id));
  }
  async guardarAudio(id, blob) { await pedir((await this.#store(AUDIOS, 'readwrite')).put(blob, id)); }
  async leerAudio(id) { return pedir((await this.#store(AUDIOS, 'readonly')).get(id)); }
  async guardarEstado(json) { await pedir((await this.#store(ESTADO, 'readwrite')).put(json, 'actual')); }
  async cargarEstado() { return (await pedir((await this.#store(ESTADO, 'readonly')).get('actual'))) || null; }
}
