/**
 * Adaptador primario: traduce teclas físicas a disparos de pad, usando las
 * teclas rápidas asignadas en el tablero actual. No conoce Web Audio ni
 * IndexedDB, solo llama a la fachada ConsolaAPI.
 */
export class AdaptadorTeclado {
  #consola;
  #presionadas = new Set();

  constructor(consola) {
    this.#consola = consola;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onKeyDown(ev) {
    if (ev.target && ['INPUT', 'TEXTAREA'].includes(ev.target.tagName)) return;
    if (ev.code === 'Escape') {
      this.#consola.detenerTodo();
      return;
    }
    const letra = ev.key.toUpperCase();
    if (this.#presionadas.has(letra)) return;
    this.#presionadas.add(letra);
    const encontrado = this.#consola.estado().sonidoConTecla(letra);
    if (encontrado) {
      this.#consola.dispararPad(encontrado.banco.id, encontrado.slot, { presionado: true }).catch(() => {});
    }
  }

  onKeyUp(ev) {
    const letra = ev.key.toUpperCase();
    this.#presionadas.delete(letra);
    const encontrado = this.#consola.estado().sonidoConTecla(letra);
    if (encontrado) {
      this.#consola.dispararPad(encontrado.banco.id, encontrado.slot, { presionado: false }).catch(() => {});
    }
  }

  destruir() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
