import { RepositorioTablero } from '../../aplicacion/puertos/secundarios.js';
import { Tablero } from '../../dominio/Tablero.js';
import { Sonido } from '../../dominio/Sonido.js';

const NOMBRE_BD = 'cabina';
const VERSION_BD = 1;
const ALMACEN_TABLERO = 'tablero';
const ALMACEN_AUDIOS = 'audios';
const CLAVE_TABLERO = 'actual';

function abrirBD() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_BD, VERSION_BD);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ALMACEN_TABLERO)) db.createObjectStore(ALMACEN_TABLERO);
      if (!db.objectStoreNames.contains(ALMACEN_AUDIOS)) db.createObjectStore(ALMACEN_AUDIOS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transaccion(db, almacen, modo) {
  return db.transaction(almacen, modo).objectStore(almacen);
}

function pedir(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Adaptador secundario: persiste el Tablero (JSON) y los blobs de audio en IndexedDB. */
export class RepositorioIndexedDB extends RepositorioTablero {
  #dbPromise;

  constructor() {
    super();
    this.#dbPromise = abrirBD();
  }

  async #db() {
    return this.#dbPromise;
  }

  async cargar() {
    const db = await this.#db();
    const json = await pedir(transaccion(db, ALMACEN_TABLERO, 'readonly').get(CLAVE_TABLERO));
    if (!json) return null;
    return Tablero.desdeJSON(json, Sonido);
  }

  async guardar(tablero) {
    const db = await this.#db();
    const store = transaccion(db, ALMACEN_TABLERO, 'readwrite');
    await pedir(store.put(tablero.toJSON(), CLAVE_TABLERO));
  }

  async guardarAudio(soundId, blob) {
    const db = await this.#db();
    const store = transaccion(db, ALMACEN_AUDIOS, 'readwrite');
    await pedir(store.put(blob, soundId));
  }

  async leerAudio(soundId) {
    const db = await this.#db();
    const store = transaccion(db, ALMACEN_AUDIOS, 'readonly');
    return pedir(store.get(soundId));
  }

  async eliminarAudio(soundId) {
    const db = await this.#db();
    const store = transaccion(db, ALMACEN_AUDIOS, 'readwrite');
    await pedir(store.delete(soundId));
  }
}
