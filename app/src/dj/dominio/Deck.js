import { ErrorValidacion } from '../../dominio/errores.js';

export const TEMPO_MAX = 0.12; // ±12 %, como el pitchRange por defecto de VirtualDJ

/**
 * Entidad: el estado de un deck (A o B). Inmutable; el reproductor real es
 * un adaptador que refleja este estado.
 */
export class Deck {
  constructor({ id, pista = null, sonando = false, tempo = 0, loopBeats = 0, eq = { baja: 0, media: 0, alta: 0 }, volumen = 1, cargadoEn = null }) {
    if (!['A', 'B'].includes(id)) throw new ErrorValidacion('El deck debe ser A o B');
    this.id = id;
    this.pista = pista;
    this.sonando = Boolean(sonando) && Boolean(pista);
    this.tempo = Math.max(-TEMPO_MAX, Math.min(TEMPO_MAX, Number(tempo) || 0));
    this.loopBeats = [0, 1, 2, 4, 8, 16].includes(loopBeats) ? loopBeats : 0;
    this.eq = Object.freeze({
      baja: limitarDb(eq.baja), media: limitarDb(eq.media), alta: limitarDb(eq.alta),
    });
    this.volumen = Math.max(0, Math.min(1, Number(volumen) ?? 1));
    this.cargadoEn = cargadoEn;
    Object.freeze(this);
  }

  get tasa() { return 1 + this.tempo; }

  get bpmEfectivo() { return this.pista?.bpm ? Math.round(this.pista.bpm * this.tasa * 10) / 10 : null; }

  con(cambios) { return new Deck({ ...this, ...cambios }); }
  conPista(pista, ahora = Date.now()) { return this.con({ pista, sonando: false, loopBeats: 0, cargadoEn: ahora }); }
  vacio() { return this.con({ pista: null, sonando: false, loopBeats: 0 }); }
  reproduciendo(sonando) { return this.con({ sonando }); }
  conTempo(tempo) { return this.con({ tempo }); }
  conLoop(beats) { return this.con({ loopBeats: beats }); }
  conEq(banda, db) { return this.con({ eq: { ...this.eq, [banda]: db } }); }
  conVolumen(v) { return this.con({ volumen: v }); }

  /** Duración de un loop de N beats en segundos, según el BPM efectivo. */
  segundosDeLoop(beats = this.loopBeats) {
    const bpm = this.bpmEfectivo;
    if (!bpm || !beats) return 0;
    return (60 / bpm) * beats;
  }

  toJSON() {
    return { id: this.id, pistaId: this.pista?.id || null, sonando: this.sonando, tempo: this.tempo, loopBeats: this.loopBeats, eq: { ...this.eq }, volumen: this.volumen };
  }
}

function limitarDb(v) {
  const n = Number(v) || 0;
  return Math.max(-40, Math.min(12, n));
}
