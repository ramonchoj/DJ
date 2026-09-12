import { ErrorNoEncontrado } from '../../dominio/errores.js';
import { sonidosACortar } from '../../dominio/servicios/ReglasDeSolapamiento.js';
import { TiposEvento } from '../../dominio/eventos.js';

/**
 * Caso de uso: disparar (o soltar) el pad de un banco/slot.
 * `presionado` solo importa para el modo MANTENER (pointerdown/up, keydown/up).
 */
export class DispararPad {
  constructor({ repositorio, reproductor, bus }) {
    this.repositorio = repositorio;
    this.reproductor = reproductor;
    this.bus = bus;
  }

  async ejecutar(tablero, bancoId, slot, { presionado = true } = {}) {
    const banco = tablero.bancoPorId(bancoId);
    const sonido = banco.sonidoEn(slot);
    if (!sonido) throw new ErrorNoEncontrado(`No hay sonido en el banco "${banco.nombre}", slot ${slot}`);

    if (sonido.modo.esMantener()) {
      if (!presionado) {
        this.reproductor.detenerSonido(sonido.id, { fadeMs: 30 });
        this.bus.publicar(TiposEvento.REPRODUCCION_DETENIDA, { soundId: sonido.id });
        return { sonido, token: null };
      }
      // presionado === true: sigue abajo y dispara normalmente.
    } else if (!presionado) {
      // Para cualquier modo que no sea MANTENER, el evento de "soltar" (pointerup/keyup)
      // no significa nada: sin este corte, cada toque disparaba el sonido dos veces
      // (una al presionar y otra al soltar), sonando como si se repitiera solo.
      return { sonido, token: null };
    }

    const aCortar = sonidosACortar(sonido, bancoId, this.reproductor.activos());
    for (const idACortar of aCortar) {
      this.reproductor.detenerSonido(idACortar, { fadeMs: 60 });
    }

    const blob = await this.repositorio.leerAudio(sonido.id);
    await this.reproductor.preparar(sonido.id, blob);
    const token = this.reproductor.disparar(sonido.id, {
      bancoId,
      ganancia: sonido.ganancia.valor,
      loop: sonido.modo.esLoop(),
      modo: sonido.modo,
    });

    this.bus.publicar(TiposEvento.PAD_DISPARADO, { bancoId, slot, soundId: sonido.id, token });
    return { sonido, token };
  }
}
