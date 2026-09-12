import { GrabadorSesion } from '../aplicacion/puertos.js';

/**
 * Adaptador: graba la mezcla final a un archivo usando MediaRecorder sobre
 * un MediaStreamDestination conectado al nodo de salida compartido (por el
 * que pasan pads y decks). Formato: webm/opus (Chrome/Android) o mp4/aac
 * (Safari). Equivale al "record" de VirtualDJ, sin transmisión.
 */
export class GrabadorSesionWebAudio extends GrabadorSesion {
  #ctx; #fuente; #destino = null; #recorder = null; #trozos = []; #inicio = 0;

  constructor({ contexto, fuente }) {
    super();
    this.#ctx = contexto;
    this.#fuente = fuente;
  }

  soportado() {
    return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && typeof this.#ctx.createMediaStreamDestination === 'function';
  }

  grabando() { return this.#recorder?.state === 'recording'; }

  duracionSeg() { return this.grabando() ? (this.#ctx.currentTime - this.#inicio) : 0; }

  async iniciar() {
    if (this.grabando()) return;
    // No se espera a resume(): sin gesto del usuario la promesa puede no resolver
    // nunca; el contexto se reanuda solo con el primer toque en la página.
    if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
    this.#destino = this.#ctx.createMediaStreamDestination();
    this.#fuente.connect(this.#destino);
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      .find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';
    this.#recorder = new window.MediaRecorder(this.#destino.stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 192000 } : undefined);
    this.#trozos = [];
    this.#recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) this.#trozos.push(ev.data); };
    this.#recorder.start(1000);
    this.#inicio = this.#ctx.currentTime;
  }

  async detener() {
    const recorder = this.#recorder;
    if (!recorder) return new Blob([]);
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.#trozos, { type: recorder.mimeType || 'audio/webm' }));
      if (recorder.state !== 'inactive') recorder.stop(); else recorder.onstop();
    });
    try { this.#fuente.disconnect(this.#destino); } catch { /* */ }
    this.#destino = null; this.#recorder = null; this.#trozos = [];
    return blob;
  }
}
