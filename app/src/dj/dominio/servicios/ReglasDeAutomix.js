/**
 * Servicio de dominio: cuándo y cómo mezclar la siguiente canción.
 *
 * Con los mismos conceptos que el automix "smart" de VirtualDJ:
 *  - inicioReal / finReal: donde de verdad empieza y termina el audio (sin silencio).
 *  - inicioFade / finFade: ventana en la que la pista siguiente debe entrar.
 * Si la pista no trae puntos (no analizada por VirtualDJ), se deducen de la
 * duración: fade de `fadeSeg` segundos antes del final.
 */
export function puntosDeMezcla(pista, { fadeSeg = 8 } = {}) {
  const p = pista.puntosMezcla;
  const dur = pista.duracionSeg;
  if (p && p.inicioFade != null && p.finFade != null) {
    // Si la ventana de salida que trae el análisis es más corta que el fade
    // configurado (canciones que terminan en seco), se adelanta el inicio
    // para garantizar al menos `fadeSeg` segundos de solapamiento.
    const finFade = p.finFade;
    return {
      inicioReal: p.inicioReal ?? 0,
      finReal: p.finReal ?? dur,
      inicioFade: Math.max(0, Math.min(p.inicioFade, finFade - fadeSeg)),
      finFade,
    };
  }
  return {
    inicioReal: 0,
    finReal: dur,
    inicioFade: Math.max(0, dur - fadeSeg),
    finFade: dur,
  };
}

/**
 * Decide si toca arrancar la siguiente pista.
 * `posicionSeg`: posición actual del deck que suena.
 * Devuelve { arrancar, duracionFadeSeg }.
 */
export function decidirTransicion(pistaActual, posicionSeg, { fadeSeg = 8 } = {}) {
  const p = puntosDeMezcla(pistaActual, { fadeSeg });
  const arrancar = posicionSeg >= p.inicioFade;
  const duracionFadeSeg = Math.max(1, Math.min(30, p.finFade - p.inicioFade));
  return { arrancar, duracionFadeSeg, restanteSeg: Math.max(0, p.finFade - posicionSeg) };
}

/**
 * Ajuste de tempo necesario en la pista entrante para igualar el BPM de la
 * que suena (beatmatch), limitado al rango del deck. Devuelve tempo (-0.12..0.12)
 * o 0 si falta algún BPM o la diferencia es demasiado grande.
 */
export function tempoParaIgualar(bpmObjetivo, bpmEntrante, { limite = 0.12 } = {}) {
  if (!bpmObjetivo || !bpmEntrante) return 0;
  // permitir doble/mitad de tempo (ej. 90 vs 180)
  const candidatos = [bpmEntrante, bpmEntrante * 2, bpmEntrante / 2];
  let mejor = 0;
  let mejorDist = Infinity;
  for (const b of candidatos) {
    const t = bpmObjetivo / b - 1;
    if (Math.abs(t) < mejorDist) { mejorDist = Math.abs(t); mejor = t; }
  }
  if (Math.abs(mejor) > limite) return 0;
  return Math.round(mejor * 1000) / 1000;
}

/** Compatibilidad armónica simplificada (rueda de Camelot) entre dos tonos tipo "A#m". */
const CAMELOT = { 'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B', 'B': '1B', 'F#': '2B', 'C#': '3B', 'G#': '4B', 'D#': '5B', 'A#': '6B', 'F': '7B',
  'Am': '8A', 'Em': '9A', 'Bm': '10A', 'F#m': '11A', 'C#m': '12A', 'G#m': '1A', 'D#m': '2A', 'A#m': '3A', 'Fm': '4A', 'Cm': '5A', 'Gm': '6A', 'Dm': '7A' };
export function tonosCompatibles(tonoA, tonoB) {
  const a = CAMELOT[tonoA]; const b = CAMELOT[tonoB];
  if (!a || !b) return null;
  const na = Number(a.slice(0, -1)); const nb = Number(b.slice(0, -1));
  if (a === b) return true;
  if (a.slice(-1) === b.slice(-1)) return Math.abs(na - nb) === 1 || Math.abs(na - nb) === 11;
  return na === nb; // relativa mayor/menor
}
