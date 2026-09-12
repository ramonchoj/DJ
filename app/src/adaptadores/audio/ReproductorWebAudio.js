import { Reproductor } from '../../aplicacion/puertos/secundarios.js';

/**
 * Adaptador secundario: reproduce sonidos con la Web Audio API.
 * Un AudioContext, un GainNode maestro (con AnalyserNode para el medidor),
 * un GainNode por reproducción activa (fade, ducking y detener individual).
 */
export class ReproductorWebAudio extends Reproductor {
  #ctx;
  #maestro;
  #analizador;
  #muestras;
  #buffers = new Map(); // soundId -> AudioBuffer
  #activos = new Map(); // token -> { soundId, bancoId, modo, source, gain, ganancia, inicio, duracion, loop }
  #contador = 0;

  constructor() {
    super();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.#ctx = new Ctx();
    this.#maestro = this.#ctx.createGain();
    this.#maestro.gain.value = 1;
    this.#analizador = this.#ctx.createAnalyser();
    this.#analizador.fftSize = 256;
    this.#muestras = new Uint8Array(this.#analizador.fftSize);
    this.#maestro.connect(this.#analizador);
    this.#analizador.connect(this.#ctx.destination);
  }

  async reanudar() {
    if (this.#ctx.state === 'suspended') await this.#ctx.resume();
  }

  async preparar(soundId, blob) {
    if (this.#buffers.has(soundId)) return;
    if (!blob) return;
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.#ctx.decodeAudioData(arrayBuffer.slice(0));
    this.#buffers.set(soundId, audioBuffer);
  }

  olvidar(soundId) {
    this.#buffers.delete(soundId);
  }

  disparar(soundId, { bancoId, ganancia = 1, tasa = 1, loop = false, modo } = {}) {
    const buffer = this.#buffers.get(soundId);
    if (!buffer) throw new Error(`Sonido no preparado en el reproductor: ${soundId}`);
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = tasa;
    const gain = this.#ctx.createGain();
    gain.gain.value = ganancia;
    source.connect(gain);
    gain.connect(this.#maestro);
    source.start(0);

    this.#contador += 1;
    const token = `tok_${this.#contador}`;
    const entrada = {
      soundId, bancoId, modo, source, gain, ganancia, loop,
      inicio: this.#ctx.currentTime,
      duracion: buffer.duration / tasa,
    };
    this.#activos.set(token, entrada);

    source.onended = () => {
      if (this.#activos.get(token)?.source === source) this.#activos.delete(token);
    };
    return token;
  }

  #desvanecerYDetener(entrada, fadeMs) {
    const { source, gain } = entrada;
    const ahora = this.#ctx.currentTime;
    const segundos = Math.max(0.001, fadeMs / 1000);
    try {
      gain.gain.cancelScheduledValues(ahora);
      gain.gain.setValueAtTime(gain.gain.value, ahora);
      gain.gain.linearRampToValueAtTime(0, ahora + segundos);
      source.stop(ahora + segundos + 0.02);
    } catch {
      try { source.stop(); } catch { /* ya estaba detenido */ }
    }
  }

  detener(token, { fadeMs = 30 } = {}) {
    const entrada = this.#activos.get(token);
    if (!entrada) return;
    this.#desvanecerYDetener(entrada, fadeMs);
    this.#activos.delete(token);
  }

  detenerSonido(soundId, { fadeMs = 30 } = {}) {
    for (const [token, entrada] of this.#activos.entries()) {
      if (entrada.soundId === soundId) {
        this.#desvanecerYDetener(entrada, fadeMs);
        this.#activos.delete(token);
      }
    }
  }

  detenerTodos({ fadeMs = 50 } = {}) {
    for (const [token, entrada] of this.#activos.entries()) {
      this.#desvanecerYDetener(entrada, fadeMs);
      this.#activos.delete(token);
    }
  }

  fijarMaestro(valor) {
    this.#maestro.gain.setTargetAtTime(valor, this.#ctx.currentTime, 0.02);
  }

  /**
   * Ducking: baja los sonidos indicados al factor dado (rampa de 80 ms) y,
   * si ms > 0, los devuelve a su ganancia original al terminar ese tiempo.
   * Con ms = 0 (el sonido nuevo es un loop) se quedan abajo hasta que se
   * dispare otra cosa o se detengan.
   */
  atenuar(soundIds, factor, ms) {
    const ids = new Set(soundIds);
    const ahora = this.#ctx.currentTime;
    for (const entrada of this.#activos.values()) {
      if (!ids.has(entrada.soundId)) continue;
      const g = entrada.gain.gain;
      g.cancelScheduledValues(ahora);
      g.setValueAtTime(g.value, ahora);
      g.linearRampToValueAtTime(entrada.ganancia * factor, ahora + 0.08);
      if (ms > 0) {
        const fin = ahora + ms / 1000;
        g.setValueAtTime(entrada.ganancia * factor, fin);
        g.linearRampToValueAtTime(entrada.ganancia, fin + 0.25);
      }
    }
  }

  activos() {
    const ahora = this.#ctx.currentTime;
    return [...this.#activos.entries()].map(([token, e]) => ({
      token,
      soundId: e.soundId,
      bancoId: e.bancoId,
      modo: e.modo,
      loop: e.loop,
      progreso: e.loop ? ((ahora - e.inicio) % e.duracion) / e.duracion : Math.min(1, (ahora - e.inicio) / e.duracion),
    }));
  }

  /** Nivel de salida 0..1 (pico de la última ventana). */
  nivel() {
    this.#analizador.getByteTimeDomainData(this.#muestras);
    let pico = 0;
    for (let i = 0; i < this.#muestras.length; i++) {
      const v = Math.abs(this.#muestras[i] - 128) / 128;
      if (v > pico) pico = v;
    }
    return pico;
  }
}
