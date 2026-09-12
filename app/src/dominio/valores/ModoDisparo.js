import { ErrorValidacion } from '../errores.js';

/**
 * Objeto de valor: cómo se comporta un sonido al dispararse.
 *  - UN_TIRO:   suena completo, se puede solapar con cualquier otro.
 *  - LOOP:      repite en bucle hasta que se vuelve a tocar el mismo pad.
 *  - MANTENER:  suena mientras el pad está presionado; se corta al soltar.
 *  - EXCLUSIVO: como UN_TIRO, pero corta cualquier otro sonido EXCLUSIVO
 *               del mismo banco (para camas musicales que no deben sumarse).
 */
const VALORES = Object.freeze(['UN_TIRO', 'LOOP', 'MANTENER', 'EXCLUSIVO']);

export class ModoDisparo {
  #valor;

  constructor(valor) {
    if (!VALORES.includes(valor)) {
      throw new ErrorValidacion(`Modo de disparo inválido: "${valor}". Válidos: ${VALORES.join(', ')}`);
    }
    this.#valor = valor;
    Object.freeze(this);
  }

  static UN_TIRO = new ModoDisparo('UN_TIRO');
  static LOOP = new ModoDisparo('LOOP');
  static MANTENER = new ModoDisparo('MANTENER');
  static EXCLUSIVO = new ModoDisparo('EXCLUSIVO');

  static valores() {
    return VALORES;
  }

  static desde(valor) {
    switch (valor) {
      case 'UN_TIRO': return ModoDisparo.UN_TIRO;
      case 'LOOP': return ModoDisparo.LOOP;
      case 'MANTENER': return ModoDisparo.MANTENER;
      case 'EXCLUSIVO': return ModoDisparo.EXCLUSIVO;
      default: throw new ErrorValidacion(`Modo de disparo inválido: "${valor}"`);
    }
  }

  get valor() {
    return this.#valor;
  }

  esLoop() {
    return this.#valor === 'LOOP';
  }

  esMantener() {
    return this.#valor === 'MANTENER';
  }

  esExclusivo() {
    return this.#valor === 'EXCLUSIVO';
  }

  igual(otro) {
    return otro instanceof ModoDisparo && otro.valor === this.#valor;
  }

  toString() {
    return this.#valor;
  }

  toJSON() {
    return this.#valor;
  }
}
