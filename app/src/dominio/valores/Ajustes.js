import { ErrorValidacion } from '../errores.js';

/**
 * Objeto de valor: ajustes globales del tablero.
 *  - unoALaVez: si es true, disparar un pad corta todo lo demás (salvo las
 *    camas musicales). Para fiestas donde no se quiere ruido encimado.
 *  - ducking: factor (0..1) al que bajan las camas musicales mientras suena
 *    un golpe/efecto encima. 1 = no atenuar; 0.3 = bajan al 30%.
 */
export class Ajustes {
  constructor({ unoALaVez = false, ducking = 0.3 } = {}) {
    if (typeof ducking !== 'number' || Number.isNaN(ducking) || ducking < 0 || ducking > 1) {
      throw new ErrorValidacion('El ducking debe ser un número entre 0 y 1');
    }
    this.unoALaVez = Boolean(unoALaVez);
    this.ducking = ducking;
    Object.freeze(this);
  }

  static porDefecto() {
    return new Ajustes();
  }

  con(cambios) {
    return new Ajustes({ ...this, ...cambios });
  }

  toJSON() {
    return { unoALaVez: this.unoALaVez, ducking: this.ducking };
  }
}
