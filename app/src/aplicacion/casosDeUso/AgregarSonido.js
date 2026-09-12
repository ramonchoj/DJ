import { Sonido } from '../../dominio/Sonido.js';
import { Ganancia } from '../../dominio/valores/Ganancia.js';
import { TiposEvento } from '../../dominio/eventos.js';

/**
 * Caso de uso: dar de alta un sonido nuevo (subido por el usuario o
 * importado) en un slot concreto de un banco. Mide el audio para calcular
 * una ganancia que nivele el volumen percibido frente a los demás sonidos.
 */
export class AgregarSonido {
  constructor({ repositorio, analizador, reproductor, bus }) {
    this.repositorio = repositorio;
    this.analizador = analizador;
    this.reproductor = reproductor;
    this.bus = bus;
  }

  async ejecutar(tablero, { bancoId, slot, nombre, blob, origen = 'SUBIDO', color, modo, teclaRapida }) {
    const banco = tablero.bancoPorId(bancoId);
    const slotFinal = slot ?? banco.primerSlotLibre();

    const medicion = await this.analizador.medir(blob);
    const ganancia = Ganancia.desdeMedicion(medicion.picoDb);

    const sonido = new Sonido({
      nombre,
      color,
      modo,
      teclaRapida,
      ganancia,
      duracionMs: medicion.duracionMs,
      origen,
    });

    await this.repositorio.guardarAudio(sonido.id, blob);
    await this.reproductor.preparar(sonido.id, blob);

    const tableroNuevo = tablero.conSonidoAgregado(bancoId, slotFinal, sonido);
    await this.repositorio.guardar(tableroNuevo);

    this.bus.publicar(TiposEvento.SONIDO_AGREGADO, { sonido, bancoId, slot: slotFinal });
    this.bus.publicar(TiposEvento.TABLERO_CAMBIADO, { tablero: tableroNuevo });
    return { tablero: tableroNuevo, sonido };
  }
}
