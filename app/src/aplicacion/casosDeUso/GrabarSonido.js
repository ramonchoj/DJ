import { ErrorValidacion } from '../../dominio/errores.js';
import { AgregarSonido } from './AgregarSonido.js';

/**
 * Caso de uso: grabadora rápida. Graba con el micrófono y deja el resultado
 * como un pad nuevo del banco indicado, pasando por el mismo camino que un
 * sonido subido (normalización de volumen incluida).
 */
export class GrabarSonido {
  #grabando = false;

  constructor({ repositorio, analizador, reproductor, grabadora, bus }) {
    this.grabadora = grabadora;
    this.agregar = new AgregarSonido({ repositorio, analizador, reproductor, bus });
  }

  soportada() {
    return Boolean(this.grabadora && this.grabadora.soportada());
  }

  grabando() {
    return this.#grabando;
  }

  async iniciar() {
    if (!this.soportada()) throw new ErrorValidacion('Este navegador no permite grabar con el micrófono');
    if (this.#grabando) return;
    await this.grabadora.iniciar();
    this.#grabando = true;
  }

  async detenerYGuardar(tablero, { bancoId, slot, nombre }) {
    if (!this.#grabando) throw new ErrorValidacion('No hay una grabación en curso');
    const blob = await this.grabadora.detener();
    this.#grabando = false;
    if (!blob || blob.size === 0) throw new ErrorValidacion('La grabación quedó vacía');
    return this.agregar.ejecutar(tablero, {
      bancoId,
      slot,
      nombre: nombre || `Grabación ${new Date().toLocaleTimeString()}`,
      blob,
      origen: 'GRABADO',
    });
  }

  async cancelar() {
    if (!this.#grabando) return;
    try { await this.grabadora.detener(); } catch { /* ignorar */ }
    this.#grabando = false;
  }
}
