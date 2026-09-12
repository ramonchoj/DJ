import { Grabadora } from '../../aplicacion/puertos/secundarios.js';

/**
 * Adaptador secundario: grabadora rápida con getUserMedia + MediaRecorder.
 * Devuelve un Blob (webm/opus en Chrome/Android, mp4/aac en Safari) que
 * Web Audio puede decodificar en el mismo navegador que lo grabó.
 */
export class GrabadoraMediaRecorder extends Grabadora {
  #recorder = null;
  #stream = null;
  #trozos = [];

  soportada() {
    return typeof navigator !== 'undefined'
      && Boolean(navigator.mediaDevices?.getUserMedia)
      && typeof window.MediaRecorder !== 'undefined';
  }

  grabando() {
    return this.#recorder?.state === 'recording';
  }

  async iniciar() {
    if (this.grabando()) return;
    this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      .find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';
    this.#recorder = new window.MediaRecorder(this.#stream, tipo ? { mimeType: tipo } : undefined);
    this.#trozos = [];
    this.#recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) this.#trozos.push(ev.data); };
    this.#recorder.start();
  }

  async detener() {
    const recorder = this.#recorder;
    if (!recorder) return new Blob([]);
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(this.#trozos, { type: recorder.mimeType || 'audio/webm' }));
      if (recorder.state !== 'inactive') recorder.stop(); else recorder.onstop();
    });
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = null;
    this.#recorder = null;
    this.#trozos = [];
    return blob;
  }
}
