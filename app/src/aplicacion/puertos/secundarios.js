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

/** Motor de reproducción de audio. */
export class Reproductor {
  async preparar(_soundId, _blob) { noImplementado('Reproductor.preparar'); }
  disparar(_soundId, _opciones) { noImplementado('Reproductor.disparar'); }
  detener(_token, _opciones) { noImplementado('Reproductor.detener'); }
  detenerSonido(_soundId, _opciones) { noImplementado('Reproductor.detenerSonido'); }
  detenerTodos(_opciones) { noImplementado('Reproductor.detenerTodos'); }
  fijarMaestro(_valor) { noImplementado('Reproductor.fijarMaestro'); }
  activos() { noImplementado('Reproductor.activos'); }
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

/** Fuente de tiempo, aislada para que las pruebas sean deterministas. */
export class Reloj {
  ahora() { noImplementado('Reloj.ahora'); }
}
