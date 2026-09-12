import { ErrorValidacion } from './errores.js';
import { ModoDisparo } from './valores/ModoDisparo.js';
import { Ganancia } from './valores/Ganancia.js';
import { TeclaRapida } from './valores/TeclaRapida.js';

const ORIGENES = Object.freeze(['SUBIDO', 'FABRICA', 'IMPORTADO']);

let contador = 0;
function idUnico() {
  contador += 1;
  return `snd_${Date.now().toString(36)}_${contador.toString(36)}`;
}

/**
 * Entidad: un sonido asignable a un pad. No contiene el audio en sí (eso
 * vive en el repositorio, referenciado por id); el dominio solo conoce sus
 * metadatos y comportamiento.
 */
export class Sonido {
  constructor({
    id = idUnico(),
    nombre,
    color = '#3a86ff',
    modo = ModoDisparo.UN_TIRO,
    ganancia = Ganancia.UNIDAD,
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
    this.color = color;
    this.modo = modo instanceof ModoDisparo ? modo : ModoDisparo.desde(modo);
    this.ganancia = ganancia instanceof Ganancia ? ganancia : new Ganancia(ganancia);
    this.teclaRapida = teclaRapida
      ? (teclaRapida instanceof TeclaRapida ? teclaRapida : new TeclaRapida(teclaRapida))
      : null;
    this.duracionMs = Math.max(0, Number(duracionMs) || 0);
    this.origen = origen;
    this.creadoEn = creadoEn;
    Object.freeze(this);
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

  conTecla(caracterOTecla) {
    return this.con({ teclaRapida: caracterOTecla });
  }

  sinTecla() {
    return this.con({ teclaRapida: null });
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      color: this.color,
      modo: this.modo.valor,
      ganancia: this.ganancia.valor,
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
