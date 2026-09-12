import { MotorDJ } from '../aplicacion/puertos.js';

// Frecuencias de EQ iguales a las de VirtualDJ (settings.xml): 200 / 1700 / 6500 Hz.
const EQ_BAJA_HZ = 200;
const EQ_MEDIA_HZ = 1700;
const EQ_ALTA_HZ = 6500;

/**
 * Adaptador: dos decks + mezclador sobre Web Audio.
 *
 * deck:  buffer → gainPista (autogain) → EQ baja → EQ media → EQ alta → gainVol → gainCross → analyser ─┐
 * master:                                                                               gainDuck → gainMaestro → destino
 *
 * Comparte el AudioContext con la consola de pads (mismo destino, misma
 * política de autoplay) si se le pasa `contexto`.
 */
export class MotorWebAudio extends MotorDJ {
  #ctx;
  #duck;
  #maestro;
  #decks = {};
  #cbTerminar = null;
  #picosCache = new Map();

  constructor({ contexto = null } = {}) {
    super();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.#ctx = contexto || new Ctx();
    this.#duck = this.#ctx.createGain();
    this.#maestro = this.#ctx.createGain();
    this.#duck.connect(this.#maestro);
    this.#maestro.connect(this.#ctx.destination);
    for (const id of ['A', 'B']) this.#decks[id] = this.#crearDeck();
  }

  get contexto() { return this.#ctx; }

  #crearDeck() {
    const c = this.#ctx;
    const gainPista = c.createGain();
    const baja = c.createBiquadFilter(); baja.type = 'lowshelf'; baja.frequency.value = EQ_BAJA_HZ;
    const media = c.createBiquadFilter(); media.type = 'peaking'; media.frequency.value = EQ_MEDIA_HZ; media.Q.value = 1;
    const alta = c.createBiquadFilter(); alta.type = 'highshelf'; alta.frequency.value = EQ_ALTA_HZ;
    const gainVol = c.createGain();
    const gainCross = c.createGain();
    const analyser = c.createAnalyser(); analyser.fftSize = 256;
    gainPista.connect(baja); baja.connect(media); media.connect(alta); alta.connect(gainVol); gainVol.connect(gainCross); gainCross.connect(analyser); analyser.connect(this.#duck);
    return {
      buffer: null, source: null, gainPista, baja, media, alta, gainVol, gainCross, analyser,
      muestras: new Uint8Array(analyser.fftSize),
      offset: 0, inicio: 0, sonando: false, tasa: 1, loop: null, deteniendoManual: false,
    };
  }

  async reanudar() { if (this.#ctx.state === 'suspended') await this.#ctx.resume(); }

  async cargar(id, blob) {
    const d = this.#decks[id];
    this.#detenerFuente(d);
    const ab = await blob.arrayBuffer();
    d.buffer = await this.#ctx.decodeAudioData(ab.slice(0));
    d.offset = 0; d.sonando = false; d.loop = null;
    this.#picosCache.delete(id);
    return { duracionSeg: d.buffer.duration };
  }

  descargar(id) {
    const d = this.#decks[id];
    this.#detenerFuente(d);
    d.buffer = null; d.offset = 0; d.sonando = false; d.loop = null;
    this.#picosCache.delete(id);
  }

  #detenerFuente(d) {
    if (!d.source) return;
    d.deteniendoManual = true;
    try { d.source.stop(); } catch { /* ya detenida */ }
    try { d.source.disconnect(); } catch { /* */ }
    d.source = null;
  }

  #arrancarFuente(d, id) {
    const s = this.#ctx.createBufferSource();
    s.buffer = d.buffer;
    s.playbackRate.value = d.tasa;
    if (d.loop) { s.loop = true; s.loopStart = d.loop.inicioSeg; s.loopEnd = d.loop.finSeg; }
    s.connect(d.gainPista);
    d.deteniendoManual = false;
    s.onended = () => {
      if (d.source !== s) return;
      d.source = null;
      if (d.deteniendoManual) return;
      d.sonando = false; d.offset = d.buffer ? d.buffer.duration : 0;
      this.#cbTerminar?.(id);
    };
    s.start(0, Math.min(d.offset, Math.max(0, d.buffer.duration - 0.01)));
    d.source = s;
    d.inicio = this.#ctx.currentTime;
    d.sonando = true;
  }

  reproducir(id, desdeSeg) {
    const d = this.#decks[id];
    if (!d.buffer) return;
    if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
    if (desdeSeg != null) d.offset = desdeSeg;
    if (d.sonando) return;
    this.#arrancarFuente(d, id);
  }

  pausar(id) {
    const d = this.#decks[id];
    if (!d.sonando) return;
    d.offset = this.posicion(id);
    d.sonando = false;
    this.#detenerFuente(d);
  }

  saltar(id, seg) {
    const d = this.#decks[id];
    if (!d.buffer) return;
    const s = Math.max(0, Math.min(d.buffer.duration, seg));
    if (d.sonando) { this.#detenerFuente(d); d.offset = s; d.sonando = false; this.#arrancarFuente(d, id); }
    else d.offset = s;
  }

  posicion(id) {
    const d = this.#decks[id];
    if (!d.buffer) return 0;
    if (!d.sonando) return d.offset;
    let pos = d.offset + (this.#ctx.currentTime - d.inicio) * d.tasa;
    if (d.loop && pos > d.loop.finSeg) {
      const largo = d.loop.finSeg - d.loop.inicioSeg;
      pos = d.loop.inicioSeg + ((pos - d.loop.inicioSeg) % largo);
    }
    return Math.min(pos, d.buffer.duration);
  }

  duracion(id) { return this.#decks[id].buffer?.duration || 0; }

  fijarTasa(id, tasa) {
    const d = this.#decks[id];
    if (d.sonando) { d.offset = this.posicion(id); d.inicio = this.#ctx.currentTime; }
    d.tasa = tasa;
    if (d.source) d.source.playbackRate.setTargetAtTime(tasa, this.#ctx.currentTime, 0.05);
  }

  fijarLoop(id, loop) {
    const d = this.#decks[id];
    if (d.sonando) { d.offset = this.posicion(id); d.inicio = this.#ctx.currentTime; }
    d.loop = loop ? { inicioSeg: loop.inicioSeg, finSeg: loop.finSeg } : null;
    if (d.source) {
      d.source.loop = Boolean(loop);
      if (loop) { d.source.loopStart = loop.inicioSeg; d.source.loopEnd = loop.finSeg; }
    }
  }

  fijarEq(id, { baja = 0, media = 0, alta = 0 }) {
    const d = this.#decks[id];
    const t = this.#ctx.currentTime;
    d.baja.gain.setTargetAtTime(baja, t, 0.02);
    d.media.gain.setTargetAtTime(media, t, 0.02);
    d.alta.gain.setTargetAtTime(alta, t, 0.02);
  }

  fijarGananciaPista(id, g) { this.#decks[id].gainPista.gain.setTargetAtTime(g, this.#ctx.currentTime, 0.02); }
  fijarVolumen(id, v) { this.#decks[id].gainVol.gain.setTargetAtTime(v, this.#ctx.currentTime, 0.02); }

  fijarCrossfader(a, b, rampaSeg = 0) {
    const t = this.#ctx.currentTime;
    for (const [id, valor] of [['A', a], ['B', b]]) {
      const g = this.#decks[id].gainCross.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      if (rampaSeg > 0) g.linearRampToValueAtTime(valor, t + rampaSeg); else g.setTargetAtTime(valor, t, 0.02);
    }
  }

  fijarMaestro(v) { this.#maestro.gain.setTargetAtTime(v, this.#ctx.currentTime, 0.02); }

  atenuar(factor, ms) {
    const g = this.#duck.gain;
    const t = this.#ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(factor, t + 0.08);
    if (ms > 0) {
      const fin = t + ms / 1000;
      g.setValueAtTime(factor, fin);
      g.linearRampToValueAtTime(1, fin + 0.3);
    }
  }

  restaurar() {
    const g = this.#duck.gain;
    const t = this.#ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1, t + 0.3);
  }

  formaDeOnda(id, puntos = 300) {
    const d = this.#decks[id];
    if (!d.buffer) return new Float32Array(0);
    const clave = `${id}:${puntos}`;
    if (this.#picosCache.has(clave)) return this.#picosCache.get(clave);
    const datos = d.buffer.getChannelData(0);
    const bloque = Math.max(1, Math.floor(datos.length / puntos));
    const picos = new Float32Array(puntos);
    for (let i = 0; i < puntos; i++) {
      let max = 0;
      const ini = i * bloque;
      const fin = Math.min(datos.length, ini + bloque);
      for (let j = ini; j < fin; j += 4) { const v = Math.abs(datos[j]); if (v > max) max = v; }
      picos[i] = max;
    }
    this.#picosCache.set(clave, picos);
    return picos;
  }

  nivel(id) {
    const d = this.#decks[id];
    d.analyser.getByteTimeDomainData(d.muestras);
    let pico = 0;
    for (let i = 0; i < d.muestras.length; i++) { const v = Math.abs(d.muestras[i] - 128) / 128; if (v > pico) pico = v; }
    return pico;
  }

  alTerminar(cb) { this.#cbTerminar = cb; }
}
