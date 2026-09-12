import { Reproductor } from '../../aplicacion/puertos/secundarios.js';

/**
 * Adaptador secundario: reproduce sonidos con la Web Audio API.
 * Un AudioContext, un GainNode maestro, un GainNode por reproducción activa
 * (para poder aplicar fade y detenerla sola sin afectar a las demás).
 */
export class ReproductorWebAudio extends Reproductor {
  #ctx;
  #maestro;
  #buffers = new Map(); // soundId -> AudioBuffer
  #activos = new Map(); // token -> { soundId, bancoId, modo, source, gain }
  #contador = 0;

  constructor() {
    super();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.#ctx = new Ctx();
    this.#maestro = this.#ctx.createGain();
    this.#maestro.gain.value = 1;
    this.#maestro.connect(this.#ctx.destination);
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

  disparar(soundId, { bancoId, ganancia = 1, loop = false, modo } = {}) {
    const buffer = this.#buffers.get(soundId);
    if (!buffer) throw new Error(`Sonido no preparado en el reproductor: ${soundId}`);
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = this.#ctx.createGain();
    gain.gain.value = ganancia;
    source.connect(gain);
    gain.connect(this.#maestro);
    source.start(0);

    this.#contador += 1;
    const token = `tok_${this.#contador}`;
    this.#activos.set(token, { soundId, bancoId, modo, source, gain });

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

  activos() {
    return [...this.#activos.entries()].map(([token, e]) => ({
      token, soundId: e.soundId, bancoId: e.bancoId, modo: e.modo,
    }));
  }
}
