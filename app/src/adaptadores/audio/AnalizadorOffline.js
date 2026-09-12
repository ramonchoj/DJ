import { AnalizadorAudio } from '../../aplicacion/puertos/secundarios.js';

/**
 * Adaptador secundario: mide pico y RMS de un audio usando OfflineAudioContext,
 * sin reproducirlo, para poder calcular la ganancia de normalización.
 */
export class AnalizadorOffline extends AnalizadorAudio {
  async medir(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctxTemporal = new Ctx();
    let audioBuffer;
    try {
      audioBuffer = await ctxTemporal.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      ctxTemporal.close();
    }

    let pico = 0;
    let sumaCuadrados = 0;
    let muestras = 0;
    for (let canal = 0; canal < audioBuffer.numberOfChannels; canal++) {
      const datos = audioBuffer.getChannelData(canal);
      for (let i = 0; i < datos.length; i++) {
        const v = Math.abs(datos[i]);
        if (v > pico) pico = v;
        sumaCuadrados += v * v;
        muestras += 1;
      }
    }
    const rms = muestras ? Math.sqrt(sumaCuadrados / muestras) : 0;
    const picoDb = pico > 0 ? 20 * Math.log10(pico) : -120;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;

    return {
      picoDb,
      rmsDb,
      duracionMs: Math.round(audioBuffer.duration * 1000),
    };
  }
}
