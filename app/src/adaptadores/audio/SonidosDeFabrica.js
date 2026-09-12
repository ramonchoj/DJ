/**
 * Genera los sonidos "de fábrica" sintetizándolos con OfflineAudioContext
 * (nada de archivos externos que descargar). Cada función devuelve un
 * AudioBuffer que luego se convierte a WAV/Blob para pasar por el mismo
 * camino que un sonido subido por el usuario (AgregarSonido).
 *
 * Sonidos incluidos: los "clásicos" identificados en el análisis de radio
 * (ver notas/LENGUAJE_Y_FEATURES_RADIO.md): aplausos, air horn, sirena,
 * redoble de tambor, rimshot ("ba-dum-tss"), campana correcto/incorrecto,
 * frenado de disco (record scratch stop), explosión y risa.
 */

const SR = 44100;

function crearContexto(duracionSeg) {
  return new OfflineAudioContext(1, Math.ceil(SR * duracionSeg), SR);
}

function ruidoBlanco(ctx, duracionSeg, envolvente) {
  const n = Math.ceil(SR * duracionSeg);
  const buffer = ctx.createBuffer(1, n, SR);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    datos[i] = (Math.random() * 2 - 1) * envolvente(t);
  }
  return buffer;
}

function tonoEnvolvente(ctx, { freqInicial, freqFinal = freqInicial, duracionSeg, forma = 'sine', envolvente }) {
  const osc = ctx.createOscillator();
  osc.type = forma;
  osc.frequency.setValueAtTime(freqInicial, 0);
  if (freqFinal !== freqInicial) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqFinal), duracionSeg);
  const gain = ctx.createGain();
  gain.gain.setValueCurveAtTime(envolvente, 0, duracionSeg);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(0);
  osc.stop(duracionSeg);
  return ctx.startRendering();
}

function curva(duracionSeg, fn, pasos = 200) {
  const arr = new Float32Array(pasos);
  for (let i = 0; i < pasos; i++) arr[i] = fn(i / (pasos - 1) * duracionSeg);
  return arr;
}

async function airHorn() {
  const dur = 1.4;
  const ctx = crearContexto(dur);
  return tonoEnvolvente(ctx, {
    freqInicial: 370, freqFinal: 340, duracionSeg: dur, forma: 'sawtooth',
    envolvente: curva(dur, (t) => (t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / (dur - 0.05) * 0.3)) * 0.55),
  });
}

async function sirena() {
  const dur = 2.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * dur), SR);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const t0 = ctx.currentTime;
  for (let ciclo = 0; ciclo < 3; ciclo++) {
    const base = (dur / 3) * ciclo;
    osc.frequency.setValueAtTime(500, t0 + base);
    osc.frequency.linearRampToValueAtTime(1000, t0 + base + dur / 6);
    osc.frequency.linearRampToValueAtTime(500, t0 + base + dur / 3);
  }
  const gain = ctx.createGain();
  gain.gain.setValueCurveAtTime(curva(dur, (t) => 0.4 * Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.1)), 0, dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(0); osc.stop(dur);
  return ctx.startRendering();
}

async function aplausos() {
  const dur = 2.2;
  const ctx = crearContexto(dur);
  const buffer = ruidoBlanco(ctx, dur, (t) => {
    // muchos "clicks" superpuestos con decaimiento -> textura de aplauso
    const ruidoBase = 0.18;
    const pulso = Math.sin(t * 37) > 0.6 ? 0.35 : 0;
    const ataque = Math.min(1, t / 0.05);
    const cola = Math.max(0, 1 - t / dur);
    return (ruidoBase + pulso) * ataque * cola;
  });
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

async function redobleDeTambor() {
  const dur = 1.8;
  const ctx = crearContexto(dur);
  const buffer = ruidoBlanco(ctx, dur, (t) => {
    const golpes = Math.abs(Math.sin(t * 55 * (1 + t))); // acelera hacia el final
    return 0.5 * golpes * Math.min(1, t / 0.02);
  });
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

async function rimshot() {
  const dur = 0.35;
  const ctx = crearContexto(dur);
  const ruido = ruidoBlanco(ctx, dur, (t) => 0.6 * Math.exp(-t * 30));
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, 0);
  osc.frequency.exponentialRampToValueAtTime(60, dur);
  const gainOsc = ctx.createGain();
  gainOsc.gain.setValueCurveAtTime(curva(dur, (t) => 0.7 * Math.exp(-t * 25)), 0, dur);
  const srcRuido = ctx.createBufferSource();
  srcRuido.buffer = ruido;
  srcRuido.connect(ctx.destination);
  srcRuido.start(0);
  osc.connect(gainOsc); gainOsc.connect(ctx.destination);
  osc.start(0); osc.stop(dur);
  return ctx.startRendering();
}

async function campana(correcta) {
  const dur = correcta ? 0.9 : 0.7;
  const ctx = crearContexto(dur);
  const frecuencias = correcta ? [880, 1318.5] : [220, 233];
  const destino = ctx.destination;
  frecuencias.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = correcta ? 'sine' : 'square';
    osc.frequency.setValueAtTime(freq, 0);
    if (!correcta) osc.frequency.setValueAtTime(freq, dur * 0.4); // segundo "beep"
    const gain = ctx.createGain();
    const inicio = correcta ? i * 0.12 : (i === 0 ? 0 : dur * 0.4);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.setValueAtTime(0.5, inicio);
    gain.gain.exponentialRampToValueAtTime(0.001, Math.min(dur, inicio + 0.4));
    osc.connect(gain); gain.connect(destino);
    osc.start(0); osc.stop(dur);
  });
  return ctx.startRendering();
}

async function frenadoDeDisco() {
  const dur = 0.9;
  const ctx = crearContexto(dur);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, 0);
  osc.frequency.exponentialRampToValueAtTime(20, dur);
  const gain = ctx.createGain();
  gain.gain.setValueCurveAtTime(curva(dur, (t) => 0.4 * Math.max(0, 1 - t / dur)), 0, dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(0); osc.stop(dur);
  return ctx.startRendering();
}

async function explosion() {
  const dur = 1.2;
  const ctx = crearContexto(dur);
  const buffer = ruidoBlanco(ctx, dur, (t) => 0.7 * Math.exp(-t * 4));
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.setValueAtTime(2000, 0);
  filtro.frequency.exponentialRampToValueAtTime(200, dur);
  src.connect(filtro); filtro.connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

async function risa() {
  const dur = 1.6;
  const ctx = crearContexto(dur);
  const jas = 5;
  for (let i = 0; i < jas; i++) {
    const t0 = (i / jas) * dur * 0.85;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300 + i * 15, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + 0.2);
  }
  return ctx.startRendering();
}

/** Convierte un AudioBuffer a un Blob WAV (PCM 16-bit) reproducible en cualquier navegador. */
export function audioBufferAWav(buffer) {
  const numCanales = buffer.numberOfChannels;
  const largo = buffer.length * numCanales * 2 + 44;
  const arrayBuffer = new ArrayBuffer(largo);
  const view = new DataView(arrayBuffer);
  const escribirCadena = (offset, cadena) => {
    for (let i = 0; i < cadena.length; i++) view.setUint8(offset + i, cadena.charCodeAt(i));
  };
  escribirCadena(0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * numCanales * 2, true);
  escribirCadena(8, 'WAVE');
  escribirCadena(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCanales, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numCanales * 2, true);
  view.setUint16(32, numCanales * 2, true);
  view.setUint16(34, 16, true);
  escribirCadena(36, 'data');
  view.setUint32(40, buffer.length * numCanales * 2, true);

  let offset = 44;
  const canales = [];
  for (let c = 0; c < numCanales; c++) canales.push(buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCanales; c++) {
      const muestra = Math.max(-1, Math.min(1, canales[c][i]));
      view.setInt16(offset, muestra < 0 ? muestra * 0x8000 : muestra * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Catálogo de sonidos de fábrica, organizado por banco (categorías reales
 * de radio: Golpes, Efectos, Camas). Cada entrada: nombre, modo y una
 * función generadora perezosa (solo se sintetiza si el usuario la usa).
 */
export function catalogoDeFabrica() {
  return {
    Golpes: [
      { nombre: 'Redoble', modo: 'UN_TIRO', tecla: 'R', color: '#e63946', generar: redobleDeTambor },
      { nombre: 'Chiste malo', modo: 'UN_TIRO', tecla: 'C', color: '#f1a208', generar: rimshot },
      { nombre: 'Correcto', modo: 'UN_TIRO', tecla: 'K', color: '#06d6a0', generar: () => campana(true) },
      { nombre: 'Incorrecto', modo: 'UN_TIRO', tecla: 'X', color: '#ef476f', generar: () => campana(false) },
      { nombre: 'Algo salió mal', modo: 'UN_TIRO', tecla: 'S', color: '#8338ec', generar: frenadoDeDisco },
    ],
    Efectos: [
      { nombre: 'Air Horn', modo: 'UN_TIRO', tecla: 'A', color: '#fb5607', generar: airHorn },
      { nombre: 'Sirena', modo: 'UN_TIRO', tecla: 'I', color: '#3a86ff', generar: sirena },
      { nombre: 'Aplausos', modo: 'UN_TIRO', tecla: 'P', color: '#2a9d8f', generar: aplausos },
      { nombre: 'Explosión', modo: 'UN_TIRO', tecla: 'E', color: '#ff006e', generar: explosion },
      { nombre: 'Risas', modo: 'UN_TIRO', tecla: 'L', color: '#ffbe0b', generar: risa },
    ],
  };
}
