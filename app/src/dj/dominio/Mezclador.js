/**
 * Objeto de valor: estado del mezclador. crossfader en [-1 (solo A), +1 (solo B)].
 * Curva "suave" (equal power) como la de una mezcladora de DJ: en el centro
 * ambos decks suenan al 100 % (curva Full de VirtualDJ = mezcla plena).
 */
export class Mezclador {
  constructor({ crossfader = 0, maestro = 1, curva = 'full' } = {}) {
    this.crossfader = Math.max(-1, Math.min(1, Number(crossfader) || 0));
    this.maestro = Math.max(0, Math.min(1, Number(maestro) ?? 1));
    this.curva = ['full', 'suave'].includes(curva) ? curva : 'full';
    Object.freeze(this);
  }

  con(cambios) { return new Mezclador({ ...this, ...cambios }); }

  /** Ganancias [A, B] que resultan de la posición del crossfader. */
  ganancias() {
    const x = this.crossfader;
    if (this.curva === 'full') {
      // "Full": el deck queda al 100 % en todo el recorrido salvo el extremo opuesto.
      return [x >= 1 ? 0 : Math.min(1, 1 - Math.max(0, x - 0.8) * 5), x <= -1 ? 0 : Math.min(1, 1 - Math.max(0, -x - 0.8) * 5)];
    }
    // "suave": potencia constante
    const t = (x + 1) / 2;
    return [Math.cos(t * Math.PI / 2), Math.sin(t * Math.PI / 2)];
  }

  toJSON() { return { crossfader: this.crossfader, maestro: this.maestro, curva: this.curva }; }
}
