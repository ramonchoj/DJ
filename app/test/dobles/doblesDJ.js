import { MotorDJ, RepositorioBiblioteca, AnalizadorPista, ImportadorAnalisis, GrabadorSesion } from '../../src/dj/aplicacion/puertos.js';

export class MotorFalso extends MotorDJ {
  constructor() {
    super();
    this.decks = { A: this.#nuevo(), B: this.#nuevo() };
    this.crossfader = { a: 1, b: 1, rampaSeg: 0 };
    this.maestro = 1;
    this.atenuaciones = [];
    this.llamadas = [];
    this.cbTerminar = null;
  }
  #nuevo() { return { cargado: false, sonando: false, posicion: 0, duracion: 0, tasa: 1, loop: null, eq: null, volumen: 1, ganancia: 1 }; }
  async cargar(id, blob) { const d = this.decks[id]; d.cargado = true; d.duracion = blob?.duracionSeg ?? 180; d.posicion = 0; this.llamadas.push(['cargar', id]); return { duracionSeg: d.duracion }; }
  descargar(id) { this.decks[id] = this.#nuevo(); this.llamadas.push(['descargar', id]); }
  reproducir(id, desde) { const d = this.decks[id]; d.sonando = true; if (desde != null) d.posicion = desde; this.llamadas.push(['reproducir', id]); }
  pausar(id) { this.decks[id].sonando = false; this.llamadas.push(['pausar', id]); }
  saltar(id, seg) { this.decks[id].posicion = seg; this.llamadas.push(['saltar', id, seg]); }
  posicion(id) { return this.decks[id].posicion; }
  duracion(id) { return this.decks[id].duracion; }
  fijarTasa(id, t) { this.decks[id].tasa = t; }
  fijarLoop(id, l) { this.decks[id].loop = l; }
  fijarEq(id, eq) { this.decks[id].eq = { ...eq }; }
  fijarGananciaPista(id, g) { this.decks[id].ganancia = g; }
  fijarVolumen(id, v) { this.decks[id].volumen = v; }
  fijarCrossfader(a, b, rampaSeg = 0) { this.crossfader = { a, b, rampaSeg }; }
  fijarMaestro(v) { this.maestro = v; }
  atenuar(factor, ms) { this.atenuaciones.push({ factor, ms }); }
  restaurar() { this.atenuaciones.push({ restaurar: true }); }
  alTerminar(cb) { this.cbTerminar = cb; }
  /** helpers de prueba */
  avanzar(id, seg) { this.decks[id].posicion += seg; }
  simularFin(id) { this.decks[id].sonando = false; this.cbTerminar?.(id); }
}

export class RepositorioBibliotecaEnMemoria extends RepositorioBiblioteca {
  constructor() { super(); this.pistas = new Map(); this.audios = new Map(); this.estado = null; }
  async cargarPistas() { return [...this.pistas.values()]; }
  async guardarPista(p) { this.pistas.set(p.id, p); }
  async eliminarPista(id) { this.pistas.delete(id); this.audios.delete(id); }
  async guardarAudio(id, blob) { this.audios.set(id, blob); }
  async leerAudio(id) { return this.audios.get(id) || null; }
  async guardarEstado(json) { this.estado = JSON.parse(JSON.stringify(json)); }
  async cargarEstado() { return this.estado; }
}

export class AnalizadorPistaFalso extends AnalizadorPista {
  constructor(porDefecto = { duracionSeg: 180, picoDb: -3, bpm: 120 }) { super(); this.porDefecto = porDefecto; }
  async analizar(blob) { return { ...this.porDefecto, ...(blob?.analisis || {}) }; }
}

export class ImportadorFalso extends ImportadorAnalisis {
  constructor(mapa = new Map()) { super(); this.mapa = mapa; }
  async importar() { return this.mapa; }
}

export class RelojControlado {
  constructor(inicial = 1000) { this.t = inicial; }
  ahora() { return this.t; }
  avanzar(ms) { this.t += ms; }
}

/** Blob falso de pista con metadatos de análisis simulados. */
export function pistaBlob(nombre, { duracionSeg = 180, bpm = 120, picoDb = -3 } = {}) {
  return { esBlobFalso: true, nombre, duracionSeg, analisis: { duracionSeg, bpm, picoDb } };
}

export class GrabadorSesionFalso extends GrabadorSesion {
  constructor({ soportado = true } = {}) { super(); this._soportado = soportado; this.estado = 'inactivo'; this.seg = 0; }
  soportado() { return this._soportado; }
  grabando() { return this.estado === 'grabando'; }
  duracionSeg() { return this.seg; }
  async iniciar() { this.estado = 'grabando'; this.seg = 0; }
  async detener() { this.estado = 'inactivo'; return { esBlobFalso: true, size: 4096, type: 'audio/webm' }; }
}
