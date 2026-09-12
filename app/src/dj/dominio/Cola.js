/**
 * Objeto de valor: la cola de canciones por tocar (sidelist / automix list
 * de VirtualDJ). Lista ordenada de ids de pista.
 */
export class Cola {
  constructor(ids = []) {
    this.ids = Object.freeze([...ids]);
    Object.freeze(this);
  }

  get vacia() { return this.ids.length === 0; }
  get siguiente() { return this.ids[0] || null; }

  agregar(id, { alPrincipio = false } = {}) {
    const resto = this.ids.filter((x) => x !== id);
    return new Cola(alPrincipio ? [id, ...resto] : [...resto, id]);
  }

  quitar(id) { return new Cola(this.ids.filter((x) => x !== id)); }
  sacarSiguiente() { return new Cola(this.ids.slice(1)); }
  vaciar() { return new Cola([]); }

  mover(id, nuevaPosicion) {
    const sin = this.ids.filter((x) => x !== id);
    const pos = Math.max(0, Math.min(sin.length, nuevaPosicion));
    return new Cola([...sin.slice(0, pos), id, ...sin.slice(pos)]);
  }

  toJSON() { return [...this.ids]; }
}
