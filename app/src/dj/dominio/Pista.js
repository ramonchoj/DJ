import { ErrorValidacion } from '../../dominio/errores.js';
import { Ganancia } from '../../dominio/valores/Ganancia.js';

let contador = 0;
function idUnico() {
  contador += 1;
  return `pst_${Date.now().toString(36)}_${contador.toString(36)}`;
}

/**
 * Entidad: una canción de la biblioteca. El audio vive en el repositorio
 * (blob por id); aquí solo metadatos y análisis.
 *
 *  - bpm, tono: análisis (propio o importado de VirtualDJ).
 *  - ganancia: normalización automática (como autogain).
 *  - cues: hasta 8 hot cues en segundos.
 *  - puntosMezcla: { inicioReal, finReal, inicioFade, finFade } en segundos.
 *    Si vienen de VirtualDJ (automix POIs) se usan tal cual; si no, el
 *    servicio ReglasDeAutomix los deduce de la duración.
 */
export class Pista {
  constructor({
    id = idUnico(),
    titulo,
    artista = '',
    duracionSeg = 0,
    bpm = null,
    tono = null,
    ganancia = Ganancia.UNIDAD,
    cues = [],
    puntosMezcla = null,
    etiquetas = [],
    origenAnalisis = 'ninguno', // 'ninguno' | 'propio' | 'virtualdj'
    vecesTocada = 0,
    ultimaVez = null,
    archivo = '',
    creadoEn = Date.now(),
  }) {
    if (!titulo || !titulo.trim()) throw new ErrorValidacion('La pista requiere un título');
    this.id = id;
    this.titulo = titulo.trim().slice(0, 120);
    this.artista = (artista || '').trim().slice(0, 120);
    this.duracionSeg = Math.max(0, Number(duracionSeg) || 0);
    this.bpm = bpm === null || bpm === undefined ? null : Math.round(Number(bpm) * 10) / 10;
    this.tono = tono || null;
    this.ganancia = ganancia instanceof Ganancia ? ganancia : new Ganancia(ganancia);
    this.cues = Object.freeze([...cues].slice(0, 8).map((c) => ({ num: c.num, seg: Number(c.seg), nombre: c.nombre || '' })));
    this.puntosMezcla = puntosMezcla ? Object.freeze({ ...puntosMezcla }) : null;
    this.etiquetas = Object.freeze([...new Set(etiquetas.map((e) => String(e).trim().toLowerCase()).filter(Boolean))]);
    this.origenAnalisis = origenAnalisis;
    this.vecesTocada = vecesTocada;
    this.ultimaVez = ultimaVez;
    this.archivo = archivo;
    this.creadoEn = creadoEn;
    Object.freeze(this);
  }

  get nombreCompleto() {
    return this.artista ? `${this.artista} - ${this.titulo}` : this.titulo;
  }

  con(cambios) { return new Pista({ ...this, ...cambios }); }

  conCue(num, seg, nombre = '') {
    const resto = this.cues.filter((c) => c.num !== num);
    return this.con({ cues: [...resto, { num, seg, nombre }].sort((a, b) => a.num - b.num) });
  }

  sinCue(num) { return this.con({ cues: this.cues.filter((c) => c.num !== num) }); }

  cue(num) { return this.cues.find((c) => c.num === num) || null; }

  conAnalisis({ bpm, tono, ganancia, puntosMezcla, cues, origenAnalisis }) {
    return this.con({
      bpm: bpm ?? this.bpm,
      tono: tono ?? this.tono,
      ganancia: ganancia ?? this.ganancia,
      puntosMezcla: puntosMezcla ?? this.puntosMezcla,
      cues: cues ?? this.cues,
      origenAnalisis: origenAnalisis || this.origenAnalisis,
    });
  }

  marcadaComoTocada(ahora = Date.now()) {
    return this.con({ vecesTocada: this.vecesTocada + 1, ultimaVez: ahora });
  }

  coincideCon(texto) {
    const q = (texto || '').trim().toLowerCase();
    if (!q) return true;
    return this.titulo.toLowerCase().includes(q) || this.artista.toLowerCase().includes(q) || this.etiquetas.some((e) => e.includes(q));
  }

  /** Nombre de archivo sin extensión → { artista, titulo } ("Artista - Título"). */
  static desdeNombreArchivo(nombre) {
    const base = nombre
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\s*\(\d{3} kbps\)\s*$/i, '')
      .replace(/^\d{1,3}\s*[-.]\s+/, '') // "03 - " o "03. " de número de pista
      .trim();
    const m = base.match(/^(.+?)\s+-\s+(.+)$/);
    return m ? { artista: m[1].trim(), titulo: m[2].trim() } : { artista: '', titulo: base };
  }

  toJSON() {
    return {
      id: this.id, titulo: this.titulo, artista: this.artista, duracionSeg: this.duracionSeg,
      bpm: this.bpm, tono: this.tono, ganancia: this.ganancia.valor, cues: [...this.cues],
      puntosMezcla: this.puntosMezcla ? { ...this.puntosMezcla } : null, etiquetas: [...this.etiquetas],
      origenAnalisis: this.origenAnalisis, vecesTocada: this.vecesTocada, ultimaVez: this.ultimaVez,
      archivo: this.archivo, creadoEn: this.creadoEn,
    };
  }

  static desdeJSON(json) {
    return new Pista({ ...json, ganancia: new Ganancia(json.ganancia ?? 1) });
  }
}
