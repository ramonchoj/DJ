import { ErrorValidacion } from './errores.js';
import { ModoDisparo } from './valores/ModoDisparo.js';
import { Ganancia } from './valores/Ganancia.js';
import { TeclaRapida } from './valores/TeclaRapida.js';

const ORIGENES = Object.freeze(['SUBIDO', 'FABRICA', 'IMPORTADO', 'GRABADO']);
export const TONO_MIN = -12;
export const TONO_MAX = 12;
export const VOLUMEN_MAX = 1.5;

let contador = 0;
function idUnico() {
  contador += 1;
  return `snd_${Date.now().toString(36)}_${contador.toString(36)}`;
}

function limitar(valor, min, max, porDefecto) {
  const n = Number(valor);
  if (Number.isNaN(n)) return porDefecto;
  return Math.min(max, Math.max(min, n));
}

/**
 * Entidad: un sonido asignable a un pad. No contiene el audio en sí (eso
 * vive en el repositorio, referenciado por id); el dominio solo conoce sus
 * metadatos y comportamiento.
 *
 *  - ganancia: corrección automática calculada al importar (normalización).
 *  - volumen:  ajuste manual del usuario (0..1.5). Ambos se multiplican.
 *  - tono:     semitonos de cambio de tono en vivo (-12..12), 0 = original.
 */
export class Sonido {
  constructor({
    id = idUnico(),
    nombre,
    emoji = '',
    color = '#3a86ff',
    modo = ModoDisparo.UN_TIRO,
    ganancia = Ganancia.UNIDAD,
    volumen = 1,
    tono = 0,
    teclaRapida = null,
    duracionMs = 0,
    origen = 'SUBIDO',
    creadoEn = Date.now(),
  }) {
    if (!nombre || !nombre.trim()) {
      throw new ErrorValidacion('El sonido requiere un nombre');
    }
    if (!ORIGENES.includes(origen)) {
      throw new ErrorValidacion(`Origen inválido: "${origen}"`);
    }
    this.id = id;
    this.nombre = nombre.trim().slice(0, 60);
    this.emoji = (emoji || '').trim().slice(0, 4);
    this.color = color;
    this.modo = modo instanceof ModoDisparo ? modo : ModoDisparo.desde(modo);
    this.ganancia = ganancia instanceof Ganancia ? ganancia : new Ganancia(ganancia);
    this.volumen = limitar(volumen, 0, VOLUMEN_MAX, 1);
    this.tono = Math.round(limitar(tono, TONO_MIN, TONO_MAX, 0));
    this.teclaRapida = teclaRapida
      ? (teclaRapida instanceof TeclaRapida ? teclaRapida : new TeclaRapida(teclaRapida))
      : null;
    this.duracionMs = Math.max(0, Number(duracionMs) || 0);
    this.origen = origen;
    this.creadoEn = creadoEn;
    Object.freeze(this);
  }

  /** Factor total que se aplica al reproducir: normalización × ajuste manual. */
  get gananciaEfectiva() {
    return this.ganancia.valor * this.volumen;
  }

  /** Velocidad de reproducción equivalente al cambio de tono (2^(semitonos/12)). */
  get tasaReproduccion() {
    return Math.pow(2, this.tono / 12);
  }

  con(cambios) {
    return new Sonido({ ...this, ...cambios });
  }

  renombrado(nuevoNombre) {
    return this.con({ nombre: nuevoNombre });
  }

  conModo(modo) {
    return this.con({ modo });
  }

  conGanancia(ganancia) {
    return this.con({ ganancia });
  }

  conVolumen(volumen) {
    return this.con({ volumen });
  }

  conTono(tono) {
    return this.con({ tono });
  }

  conTecla(caracterOTecla) {
    return this.con({ teclaRapida: caracterOTecla });
  }

  sinTecla() {
    return this.con({ teclaRapida: null });
  }

  coincideCon(texto) {
    const q = (texto || '').trim().toLowerCase();
    if (!q) return true;
    return this.nombre.toLowerCase().includes(q) || (this.teclaRapida?.valor || '').toLowerCase() === q;
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      emoji: this.emoji,
      color: this.color,
      modo: this.modo.valor,
      ganancia: this.ganancia.valor,
      volumen: this.volumen,
      tono: this.tono,
      teclaRapida: this.teclaRapida ? this.teclaRapida.valor : null,
      duracionMs: this.duracionMs,
      origen: this.origen,
      creadoEn: this.creadoEn,
    };
  }

  static desdeJSON(json) {
    return new Sonido({
      ...json,
      modo: ModoDisparo.desde(json.modo),
      ganancia: new Ganancia(json.ganancia),
      teclaRapida: json.teclaRapida ? new TeclaRapida(json.teclaRapida) : null,
    });
  }
}
