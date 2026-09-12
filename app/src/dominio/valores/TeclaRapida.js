import { ErrorValidacion } from '../errores.js';

/**
 * Objeto de valor: una tecla física de un carácter asignada a un pad.
 */
export class TeclaRapida {
  #valor;

  constructor(caracter) {
    if (typeof caracter !== 'string' || caracter.trim().length === 0) {
      throw new ErrorValidacion('La tecla rápida no puede estar vacía');
    }
    this.#valor = caracter.trim().slice(0, 1).toUpperCase();
    Object.freeze(this);
  }

  get valor() {
    return this.#valor;
  }

  igual(otra) {
    return otra instanceof TeclaRapida && otra.valor === this.#valor;
  }

  toJSON() {
    return this.#valor;
  }
}
