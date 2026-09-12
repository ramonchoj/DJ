import { TiposEvento } from '../../dominio/eventos.js';

/** Caso de uso: botón de pánico — corta toda reproducción activa. */
export class DetenerTodo {
  constructor({ reproductor, bus }) {
    this.reproductor = reproductor;
    this.bus = bus;
  }

  ejecutar({ fadeMs = 50 } = {}) {
    this.reproductor.detenerTodos({ fadeMs });
    this.bus.publicar(TiposEvento.REPRODUCCION_DETENIDA, { todo: true });
  }
}
