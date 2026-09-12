import { AnalizadorPista } from '../aplicacion/puertos.js';

/**
 * Adaptador: analiza una pista en el navegador.
 *  - duración y pico (dB) para la ganancia automática;
 *  - BPM por autocorrelación de la envolvente de energía (onsets), en el
 *    rango 60–200 BPM, prefiriendo 80–160 cuando hay ambigüedad de octava.
 * Es un detector sencillo: acierta en música con pulso claro (cumbia, salsa,
 * pop, rock). Cuando existe análisis de VirtualDJ, ese manda.
 */
export class AnalizadorBpm extends AnalizadorPista {
  constructor({ contexto = null } = {}) { super(); this.contexto = contexto; }

  async analizar(blob) {
    const ab = await blob.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = this.contexto || new Ctx();
    let buffer;
    try { buffer = await ctx.decodeAudioData(ab.slice(0)); }
    finally { if (!this.contexto) ctx.close(); }

    const sr = buffer.sampleRate;
    const canales = buffer.numberOfChannels;
    const n = buffer.length;
    // mezcla mono en bloques para no copiar todo
    const bloque = 1024;
    const nBloques = Math.floor(n / bloque);
    const energia = new Float32Array(nBloques);
    let pico = 0;
    const datos = [];
    for (let c = 0; c < canales; c++) datos.push(buffer.getChannelData(c));
    for (let b = 0; b < nBloques; b++) {
      let suma = 0;
      const ini = b * bloque;
      for (let i = ini; i < ini + bloque; i++) {
        let v = 0;
        for (let c = 0; c < canales; c++) v += datos[c][i];
        v /= canales;
        const a = Math.abs(v);
        if (a > pico) pico = a;
        suma += v * v;
      }
      energia[b] = Math.sqrt(suma / bloque);
    }
    const picoDb = pico > 0 ? 20 * Math.log10(pico) : -120;
    const bpm = detectarBpm(energia, sr / bloque);
    return { duracionSeg: buffer.duration, picoDb, bpm };
  }
}

/** Autocorrelación de la envolvente de onsets. `fs` = muestras de envolvente por segundo. */
export function detectarBpm(energia, fs, { min = 60, max = 200 } = {}) {
  const n = energia.length;
  if (n < fs * 10) return null; // menos de 10 s: no confiable
  // onset = derivada positiva, sin media
  const onset = new Float32Array(n);
  let media = 0;
  for (let i = 1; i < n; i++) { onset[i] = Math.max(0, energia[i] - energia[i - 1]); media += onset[i]; }
  media /= n;
  for (let i = 0; i < n; i++) onset[i] -= media;

  const lagMin = Math.floor(fs * 60 / max);
  const lagMax = Math.ceil(fs * 60 / min);
  let mejorLag = 0; let mejorVal = -Infinity;
  const valores = new Float32Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += onset[i] * onset[i - lag];
    valores[lag] = s / (n - lag);
  }
  // preferir el rango 80–160: penalizar levemente fuera de él
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = fs * 60 / lag;
    const peso = bpm >= 80 && bpm <= 160 ? 1 : 0.85;
    const v = valores[lag] * peso;
    if (v > mejorVal) { mejorVal = v; mejorLag = lag; }
  }
  if (!mejorLag || mejorVal <= 0) return null;
  // refinar con interpolación parabólica entre lags vecinos
  const y0 = valores[mejorLag - 1] || 0; const y1 = valores[mejorLag]; const y2 = valores[mejorLag + 1] || 0;
  const denom = (y0 - 2 * y1 + y2);
  const delta = denom !== 0 ? 0.5 * (y0 - y2) / denom : 0;
  const lagFino = mejorLag + Math.max(-0.5, Math.min(0.5, delta));
  return Math.round((fs * 60 / lagFino) * 10) / 10;
}
