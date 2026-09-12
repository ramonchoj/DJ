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
 * de radio: Golpes, Efectos, Clásicos). Cada entrada trae, o bien `generar`
 * (función que sintetiza el audio en el navegador, sin archivos), o bien
 * `archivo` (ruta a una grabación real incluida con la app — los 9 samples
 * originales de VirtualDJ, ver notas/VIRTUALDJ_ARQUITECTURA_BINARIO.md).
 * Se prefiere `archivo` cuando existe una grabación real equivalente: suena
 * mucho más natural que la síntesis por osciladores.
 */
export function catalogoDeFabrica() {
  return {
    Golpes: [
      { nombre: 'Redoble', modo: 'UN_TIRO', tecla: 'R', emoji: '🥁', color: '#e63946', generar: redobleDeTambor },
      { nombre: 'Chiste malo', modo: 'UN_TIRO', tecla: 'C', emoji: '🥁', color: '#f1a208', generar: rimshot },
      { nombre: 'Correcto', modo: 'UN_TIRO', tecla: 'K', emoji: '✅', color: '#06d6a0', generar: () => campana(true) },
      { nombre: 'Incorrecto', modo: 'UN_TIRO', tecla: 'X', emoji: '❌', color: '#ef476f', generar: () => campana(false) },
      { nombre: 'Algo salió mal', modo: 'UN_TIRO', tecla: 'S', emoji: '💿', color: '#8338ec', generar: frenadoDeDisco },
      { nombre: 'Fanfarria', modo: 'UN_TIRO', tecla: 'V', emoji: '🎺', color: '#ffd60a', archivo: 'assets/mixkit/fanfare-722.mp3' },
      { nombre: 'Wah wah', modo: 'UN_TIRO', tecla: '6', emoji: '🎺', color: '#6a4c93', archivo: 'assets/mixkit/wahwah-471.mp3' },
      { nombre: 'Remate', modo: 'UN_TIRO', tecla: '7', emoji: '🥁', color: '#f4a261', archivo: 'assets/mixkit/remate-568.mp3' },
    ],
    Efectos: [
      { nombre: 'Air Horn', modo: 'UN_TIRO', tecla: 'A', emoji: '📯', color: '#fb5607', archivo: 'assets/vdj/air-horn.mp3' },
      { nombre: 'Sirena', modo: 'UN_TIRO', tecla: 'I', emoji: '🚨', color: '#3a86ff', archivo: 'assets/vdj/sirena.mp3' },
      { nombre: 'Aplausos', modo: 'UN_TIRO', tecla: 'P', emoji: '👏', color: '#2a9d8f', archivo: 'assets/vdj/aplausos.mp3' },
      { nombre: 'Explosión', modo: 'UN_TIRO', tecla: 'E', emoji: '💥', color: '#ff006e', archivo: 'assets/vdj/explosion.mp3' },
      { nombre: 'Risas', modo: 'UN_TIRO', tecla: 'L', emoji: '😂', color: '#ffbe0b', archivo: 'assets/vdj/risas.mp3' },
    ],
    Clásicos: [
      { nombre: 'Saxo', modo: 'UN_TIRO', tecla: 'Z', emoji: '🎷', color: '#8ac926', archivo: 'assets/vdj/saxo.mp3' },
      { nombre: 'Shots', modo: 'UN_TIRO', tecla: 'H', emoji: '🥃', color: '#ff6b6b', archivo: 'assets/vdj/shots.mp3' },
      { nombre: 'Hands Up', modo: 'UN_TIRO', tecla: 'U', emoji: '🙌', color: '#06d6a0', archivo: 'assets/vdj/hands-up.mp3' },
      { nombre: 'This This This', modo: 'UN_TIRO', tecla: 'T', emoji: '👉', color: '#ffbe0b', archivo: 'assets/vdj/this-this-this.mp3' },
    ],
    Reacciones: [
      { nombre: 'Bocina', modo: 'UN_TIRO', tecla: 'B', emoji: '📣', color: '#ff9f1c', archivo: 'assets/mixkit/car-horn-715.mp3' },
      { nombre: 'Abucheo', modo: 'UN_TIRO', tecla: 'O', emoji: '👎', color: '#6a4c93', archivo: 'assets/mixkit/boo-463.mp3' },
      { nombre: 'Multitud', modo: 'UN_TIRO', tecla: 'M', emoji: '🎉', color: '#2a9d8f', archivo: 'assets/mixkit/crowd-cheering-610.mp3' },
      { nombre: 'Brindis', modo: 'UN_TIRO', tecla: 'D', emoji: '🥂', color: '#f4a261', archivo: 'assets/mixkit/glass-1317.mp3' },
      { nombre: 'Redoble Final', modo: 'UN_TIRO', tecla: 'F', emoji: '🥁', color: '#e63946', archivo: 'assets/mixkit/drum-roll-577.mp3' },
      { nombre: 'Silbato', modo: 'UN_TIRO', tecla: 'W', emoji: '📢', color: '#3a86ff', archivo: 'assets/mixkit/whistle-616.mp3' },
      { nombre: 'Cuenta Regresiva', modo: 'UN_TIRO', tecla: 'Q', emoji: '⏱️', color: '#8338ec', archivo: 'assets/mixkit/countdown-916.mp3' },
      { nombre: 'Bajo', modo: 'UN_TIRO', tecla: 'J', emoji: '🔊', color: '#264653', archivo: 'assets/mixkit/bass-hit-2299.mp3' },
      { nombre: 'Matraca', modo: 'UN_TIRO', tecla: 'N', emoji: '🎊', color: '#ffbe0b', archivo: 'assets/mixkit/party-horn-527.mp3' },
      { nombre: 'Fuegos', modo: 'UN_TIRO', tecla: 'G', emoji: '🎆', color: '#ff006e', archivo: 'assets/mixkit/firework-3103.mp3' },
      { nombre: 'Ta-Da', modo: 'UN_TIRO', tecla: 'Y', emoji: '✨', color: '#ffd60a', archivo: 'assets/mixkit/tada-638.mp3' },
    ],
    Calle: [
      { nombre: 'Automóvil', modo: 'UN_TIRO', tecla: '1', emoji: '🚗', color: '#3a86ff', archivo: 'assets/mixkit/auto-1538.mp3' },
      { nombre: 'Moto', modo: 'UN_TIRO', tecla: '2', emoji: '🏍️', color: '#fb5607', archivo: 'assets/mixkit/moto-2732.mp3' },
      { nombre: 'Avión', modo: 'UN_TIRO', tecla: '3', emoji: '✈️', color: '#457b9d', archivo: 'assets/mixkit/avion-1577.mp3' },
      { nombre: 'Fierro viejo', modo: 'UN_TIRO', tecla: '4', emoji: '📢', color: '#e63946', archivo: 'assets/voces/fierro-viejo.mp3' },
      { nombre: 'Campana basura', modo: 'UN_TIRO', tecla: '5', emoji: '🔔', color: '#2a9d8f', archivo: 'assets/mixkit/campana-basura-sintetizada.mp3' },
      { nombre: 'Tamales', modo: 'UN_TIRO', tecla: '8', emoji: '🫔', color: '#ffbe0b', archivo: 'assets/voces/tamales.mp3' },
    ],
  };
}
