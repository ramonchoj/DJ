/**
 * Eventos de dominio: hechos que ya ocurrieron. La aplicación los publica;
 * los adaptadores primarios (UI) se suscriben para reaccionar. El dominio
 * nunca llama directamente a un adaptador.
 */
export const TiposEvento = Object.freeze({
  SONIDO_AGREGADO: 'SONIDO_AGREGADO',
  SONIDO_ACTUALIZADO: 'SONIDO_ACTUALIZADO',
  SONIDO_ELIMINADO: 'SONIDO_ELIMINADO',
  BANCO_CREADO: 'BANCO_CREADO',
  BANCO_ELIMINADO: 'BANCO_ELIMINADO',
  TABLERO_CAMBIADO: 'TABLERO_CAMBIADO',
  PAD_DISPARADO: 'PAD_DISPARADO',
  REPRODUCCION_DETENIDA: 'REPRODUCCION_DETENIDA',
  VOLUMEN_MAESTRO_CAMBIADO: 'VOLUMEN_MAESTRO_CAMBIADO',
});

export class BusEventos {
  #escuchas = new Map();

  suscribir(tipo, callback) {
    if (!this.#escuchas.has(tipo)) this.#escuchas.set(tipo, new Set());
    this.#escuchas.get(tipo).add(callback);
    return () => this.#escuchas.get(tipo)?.delete(callback);
  }

  publicar(tipo, detalle) {
    for (const cb of this.#escuchas.get(tipo) || []) {
      cb(detalle);
    }
  }
}
