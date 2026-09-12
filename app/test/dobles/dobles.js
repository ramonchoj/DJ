import { RepositorioTablero, Reproductor, AnalizadorAudio, Empaquetador, Reloj, Grabadora } from '../../src/aplicacion/puertos/secundarios.js';

export class RepositorioEnMemoria extends RepositorioTablero {
  constructor() {
    super();
    this.tablero = null;
    this.audios = new Map();
  }
  async cargar() { return this.tablero; }
  async guardar(tablero) { this.tablero = tablero; }
  async guardarAudio(soundId, blob) { this.audios.set(soundId, blob); }
  async leerAudio(soundId) { return this.audios.get(soundId) || null; }
  async eliminarAudio(soundId) { this.audios.delete(soundId); }
}

export class ReproductorFalso extends Reproductor {
  #activos = [];
  constructor() {
    super();
    this.preparados = new Set();
    this.disparos = [];
    this.detenidos = [];
    this.atenuaciones = [];
    this.maestro = 1;
  }
  async preparar(soundId) { this.preparados.add(soundId); }
  disparar(soundId, opciones) {
    const token = `tok_${this.disparos.length}`;
    this.disparos.push({ soundId, opciones, token });
    this.#activos.push({ soundId, bancoId: opciones.bancoId, modo: opciones.modo, token });
    return token;
  }
  detener(token, opciones) {
    this.detenidos.push({ token, opciones });
    this.#activos = this.#activos.filter((a) => a.token !== token);
  }
  detenerSonido(soundId, opciones) {
    this.detenidos.push({ soundId, opciones });
    this.#activos = this.#activos.filter((a) => a.soundId !== soundId);
  }
  detenerTodos(opciones) {
    this.detenidos.push({ todo: true, opciones });
    this.#activos = [];
  }
  fijarMaestro(valor) { this.maestro = valor; }
  atenuar(soundIds, factor, ms) { this.atenuaciones.push({ soundIds: [...soundIds], factor, ms }); }
  activos() { return this.#activos; }
  nivel() { return 0; }
  /** Simula que un sonido terminó por sí solo. */
  simularFin(soundId) { this.#activos = this.#activos.filter((a) => a.soundId !== soundId); }
}

export class AnalizadorFalso extends AnalizadorAudio {
  constructor(medicion = { picoDb: -3, rmsDb: -18, duracionMs: 1000 }) {
    super();
    this.medicion = medicion;
  }
  async medir() { return this.medicion; }
}

export class EmpaquetadorFalso extends Empaquetador {
  async empaquetar(tablero, audiosPorId) { return { tablero, audiosPorId, esBlobFalso: true }; }
  async desempaquetar(paquete) { return { tablero: paquete.tablero, audiosPorId: paquete.audiosPorId }; }
}

export class GrabadoraFalsa extends Grabadora {
  constructor({ soportada = true, resultado = { esBlobFalso: true, size: 1234, type: 'audio/webm' } } = {}) {
    super();
    this._soportada = soportada;
    this.resultado = resultado;
    this.estado = 'inactiva';
  }
  soportada() { return this._soportada; }
  async iniciar() { this.estado = 'grabando'; }
  async detener() { this.estado = 'inactiva'; return this.resultado; }
  grabando() { return this.estado === 'grabando'; }
}

export class RelojFalso extends Reloj {
  constructor(inicial = 0) { super(); this.valor = inicial; }
  ahora() { return this.valor; }
  avanzar(ms) { this.valor += ms; }
}

export function blobFalso(nombre = 'audio.mp3') {
  return { esBlobFalso: true, nombre, size: 100 };
}
