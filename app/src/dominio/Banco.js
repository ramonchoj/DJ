import { ErrorValidacion, ErrorConflicto, ErrorNoEncontrado } from './errores.js';

let contador = 0;
function idUnico() {
  contador += 1;
  return `bnk_${Date.now().toString(36)}_${contador.toString(36)}`;
}

/**
 * Entidad: un banco/categoría del tablero (ej. "Golpes", "Camas musicales").
 * Contiene slots: posición numérica (0-based) -> Sonido | null.
 */
export class Banco {
  constructor({ id = idUnico(), nombre, color = '#22223b', orden = 0, slots = {} }) {
    if (!nombre || !nombre.trim()) {
      throw new ErrorValidacion('El banco requiere un nombre');
    }
    this.id = id;
    this.nombre = nombre.trim().slice(0, 40);
    this.color = color;
    this.orden = orden;
    // copia defensiva, claves normalizadas a string de número
    this.slots = Object.freeze({ ...slots });
    Object.freeze(this);
  }

  sonidoEn(slot) {
    return this.slots[String(slot)] || null;
  }

  slotDe(soundId) {
    for (const [slot, sonido] of Object.entries(this.slots)) {
      if (sonido && sonido.id === soundId) return Number(slot);
    }
    return null;
  }

  primerSlotLibre() {
    let slot = 0;
    while (this.slots[String(slot)]) slot += 1;
    return slot;
  }

  listaSonidos() {
    return Object.values(this.slots).filter(Boolean);
  }

  conSonidoEn(slot, sonido) {
    const clave = String(slot);
    if (this.slots[clave] && this.slots[clave].id !== sonido.id) {
      throw new ErrorConflicto(`El slot ${slot} del banco "${this.nombre}" ya tiene un sonido`);
    }
    return new Banco({ ...this, slots: { ...this.slots, [clave]: sonido } });
  }

  sinSonidoId(soundId) {
    const nuevos = { ...this.slots };
    for (const clave of Object.keys(nuevos)) {
      if (nuevos[clave] && nuevos[clave].id === soundId) delete nuevos[clave];
    }
    return new Banco({ ...this, slots: nuevos });
  }

  conSonidoActualizado(sonidoActualizado) {
    const clave = this.slotDe(sonidoActualizado.id);
    if (clave === null) {
      throw new ErrorNoEncontrado(`El sonido ${sonidoActualizado.id} no está en el banco "${this.nombre}"`);
    }
    return this.conSonidoEn(clave, sonidoActualizado);
  }

  renombrado(nuevoNombre) {
    return new Banco({ ...this, nombre: nuevoNombre });
  }

  toJSON() {
    const slots = {};
    for (const [k, v] of Object.entries(this.slots)) slots[k] = v.toJSON();
    return { id: this.id, nombre: this.nombre, color: this.color, orden: this.orden, slots };
  }

  static desdeJSON(json, SonidoClase) {
    const slots = {};
    for (const [k, v] of Object.entries(json.slots || {})) slots[k] = SonidoClase.desdeJSON(v);
    return new Banco({ ...json, slots });
  }
}
