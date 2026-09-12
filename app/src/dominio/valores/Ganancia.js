import { ErrorValidacion } from '../errores.js';

const MIN = 0;
const MAX = 2;
const OBJETIVO_PICO_DB = -3; // dejamos 3 dB de margen para evitar recorte (clipping)

/**
 * Objeto de valor: factor de ganancia lineal aplicado a un sonido (0..2,
 * donde 1 = sin cambio). Se calcula a partir de una medición de pico para
 * nivelar sonidos que llegan a volúmenes muy distintos (equivalente al
 * autogain de un mezclador).
 */
export class Ganancia {
  #valor;

  constructor(valor) {
    if (typeof valor !== 'number' || Number.isNaN(valor)) {
      throw new ErrorValidacion('La ganancia debe ser un número');
    }
    this.#valor = Math.min(MAX, Math.max(MIN, valor));
    Object.freeze(this);
  }

  static UNIDAD = new Ganancia(1);

  /**
   * Calcula la ganancia necesaria para que el pico de la señal llegue a
   * OBJETIVO_PICO_DB, a partir de una medición en dB (típicamente negativa,
   * 0 dB = máximo posible sin recorte).
   */
  static desdeMedicion(picoDb) {
    if (typeof picoDb !== 'number' || Number.isNaN(picoDb) || picoDb <= -100) {
      return Ganancia.UNIDAD; // silencio o medición inválida: no tocar
    }
    const diferenciaDb = OBJETIVO_PICO_DB - picoDb;
    const factor = Math.pow(10, diferenciaDb / 20);
    return new Ganancia(factor);
  }

  get valor() {
    return this.#valor;
  }

  combinada(otra) {
    const v = otra instanceof Ganancia ? otra.valor : otra;
    return new Ganancia(this.#valor * v);
  }

  toJSON() {
    return this.#valor;
  }
}
