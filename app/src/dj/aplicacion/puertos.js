function noImplementado(nombre) {
  throw new Error(`Puerto no implementado: ${nombre}`);
}

/**
 * Motor de audio de los decks + mezclador. Un solo puerto porque en Web
 * Audio ambas cosas viven en el mismo grafo.
 */
export class MotorDJ {
  /** @returns {Promise<{duracionSeg:number}>} */
  async cargar(_deckId, _blob) { noImplementado('MotorDJ.cargar'); }
  descargar(_deckId) { noImplementado('MotorDJ.descargar'); }
  reproducir(_deckId, _desdeSeg) { noImplementado('MotorDJ.reproducir'); }
  pausar(_deckId) { noImplementado('MotorDJ.pausar'); }
  saltar(_deckId, _seg) { noImplementado('MotorDJ.saltar'); }
  /** @returns {number} segundos */
  posicion(_deckId) { noImplementado('MotorDJ.posicion'); }
  duracion(_deckId) { noImplementado('MotorDJ.duracion'); }
  fijarTasa(_deckId, _tasa) { noImplementado('MotorDJ.fijarTasa'); }
  fijarLoop(_deckId, _loop /* {inicioSeg, finSeg} | null */) { noImplementado('MotorDJ.fijarLoop'); }
  fijarEq(_deckId, _eq /* {baja, media, alta} dB */) { noImplementado('MotorDJ.fijarEq'); }
  fijarGananciaPista(_deckId, _ganancia) { noImplementado('MotorDJ.fijarGananciaPista'); }
  fijarVolumen(_deckId, _v) { noImplementado('MotorDJ.fijarVolumen'); }
  fijarCrossfader(_gananciaA, _gananciaB, _rampaSeg = 0) { noImplementado('MotorDJ.fijarCrossfader'); }
  fijarMaestro(_v) { noImplementado('MotorDJ.fijarMaestro'); }
  /** Ducking de toda la música (talkover): baja al factor y vuelve tras ms (0 = hasta restaurar). */
  atenuar(_factor, _ms) { noImplementado('MotorDJ.atenuar'); }
  restaurar() { noImplementado('MotorDJ.restaurar'); }
  /** @returns {Float32Array} picos 0..1, `puntos` valores */
  formaDeOnda(_deckId, _puntos) { return new Float32Array(0); }
  nivel(_deckId) { return 0; }
  /** Callback cuando una pista termina sola. */
  alTerminar(_cb) { /* opcional */ }
}

/** Persistencia de la biblioteca (pistas + audio) y del estado del DJ. */
export class RepositorioBiblioteca {
  async cargarPistas() { noImplementado('RepositorioBiblioteca.cargarPistas'); }
  async guardarPista(_pista) { noImplementado('RepositorioBiblioteca.guardarPista'); }
  async eliminarPista(_id) { noImplementado('RepositorioBiblioteca.eliminarPista'); }
  async guardarAudio(_id, _blob) { noImplementado('RepositorioBiblioteca.guardarAudio'); }
  async leerAudio(_id) { noImplementado('RepositorioBiblioteca.leerAudio'); }
  async guardarEstado(_json) { noImplementado('RepositorioBiblioteca.guardarEstado'); }
  async cargarEstado() { noImplementado('RepositorioBiblioteca.cargarEstado'); }
}

/** Análisis de una pista: duración, pico (para ganancia) y BPM. */
export class AnalizadorPista {
  /** @returns {Promise<{duracionSeg:number, picoDb:number, bpm:number|null}>} */
  async analizar(_blob) { noImplementado('AnalizadorPista.analizar'); }
}

/**
 * Importa análisis externos (por ahora: database.xml de VirtualDJ).
 * @returns {Promise<Map<string, {bpm, tono, ganancia, cues, puntosMezcla}>>} por nombre de archivo (sin ruta)
 */
export class ImportadorAnalisis {
  async importar(_texto) { noImplementado('ImportadorAnalisis.importar'); }
}
