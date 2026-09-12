function noImplementado(nombre) {
  throw new Error(`Puerto no implementado: ${nombre}`);
}

/** Persistencia del agregado Tablero y de los blobs de audio. */
export class RepositorioTablero {
  async cargar() { noImplementado('RepositorioTablero.cargar'); }
  async guardar(_tablero) { noImplementado('RepositorioTablero.guardar'); }
  async guardarAudio(_soundId, _blob) { noImplementado('RepositorioTablero.guardarAudio'); }
  async leerAudio(_soundId) { noImplementado('RepositorioTablero.leerAudio'); }
  async eliminarAudio(_soundId) { noImplementado('RepositorioTablero.eliminarAudio'); }
}

/**
 * Motor de reproducción de audio.
 *  disparar(soundId, { bancoId, ganancia, loop, modo, tasa }) -> token
 *  atenuar(soundIds, factor, ms): baja esos sonidos al factor dado y los
 *    devuelve a su nivel pasados `ms` milisegundos (ducking).
 *  nivel(): 0..1, nivel de salida actual (para el medidor).
 */
export class Reproductor {
  async preparar(_soundId, _blob) { noImplementado('Reproductor.preparar'); }
  disparar(_soundId, _opciones) { noImplementado('Reproductor.disparar'); }
  detener(_token, _opciones) { noImplementado('Reproductor.detener'); }
  detenerSonido(_soundId, _opciones) { noImplementado('Reproductor.detenerSonido'); }
  detenerTodos(_opciones) { noImplementado('Reproductor.detenerTodos'); }
  fijarMaestro(_valor) { noImplementado('Reproductor.fijarMaestro'); }
  atenuar(_soundIds, _factor, _ms) { noImplementado('Reproductor.atenuar'); }
  activos() { noImplementado('Reproductor.activos'); }
  nivel() { return 0; }
  olvidar(_soundId) { /* opcional: liberar el buffer decodificado */ }
}

/** Medición de audio para poder normalizar volumen al importar. */
export class AnalizadorAudio {
  async medir(_blob) { noImplementado('AnalizadorAudio.medir'); }
}

/** Exportar/importar el tablero completo con sus audios. */
export class Empaquetador {
  async empaquetar(_tablero, _audiosPorId) { noImplementado('Empaquetador.empaquetar'); }
  async desempaquetar(_blob) { noImplementado('Empaquetador.desempaquetar'); }
}

/** Grabación rápida con el micrófono. */
export class Grabadora {
  soportada() { return false; }
  async iniciar() { noImplementado('Grabadora.iniciar'); }
  /** @returns {Promise<Blob>} */
  async detener() { noImplementado('Grabadora.detener'); }
  grabando() { return false; }
}

/** Fuente de tiempo, aislada para que las pruebas sean deterministas. */
export class Reloj {
  ahora() { noImplementado('Reloj.ahora'); }
}
