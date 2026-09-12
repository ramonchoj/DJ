import { Tablero } from '../../dominio/Tablero.js';
import { Sonido } from '../../dominio/Sonido.js';
import { TiposEvento } from '../../dominio/eventos.js';

/** Caso de uso: respaldo completo del tablero (metadatos + audios). */
export class ExportarImportarTablero {
  constructor({ repositorio, reproductor, empaquetador, bus }) {
    this.repositorio = repositorio;
    this.reproductor = reproductor;
    this.empaquetador = empaquetador;
    this.bus = bus;
  }

  async exportar(tablero) {
    const audiosPorId = {};
    for (const sonido of tablero.todosLosSonidos()) {
      audiosPorId[sonido.id] = await this.repositorio.leerAudio(sonido.id);
    }
    return this.empaquetador.empaquetar(tablero, audiosPorId);
  }

  async importar(blob, { reemplazar = false, tableroActual = null } = {}) {
    const { tablero: tableroImportado, audiosPorId } = await this.empaquetador.desempaquetar(blob);
    let tablero = reemplazar || !tableroActual ? Tablero.desdeJSON(tableroImportado.toJSON(), Sonido) : tableroActual;

    if (reemplazar || !tableroActual) {
      for (const [soundId, audioBlob] of Object.entries(audiosPorId)) {
        await this.repositorio.guardarAudio(soundId, audioBlob);
        await this.reproductor.preparar(soundId, audioBlob);
      }
    } else {
      for (const banco of tableroImportado.bancos) {
        if (!tablero.bancoPorNombre(banco.nombre)) {
          tablero = tablero.crearBanco(banco.nombre, banco.color);
        }
        const destino = tablero.bancoPorNombre(banco.nombre);
        for (const sonido of banco.listaSonidos()) {
          const slot = destino.primerSlotLibre();
          tablero = tablero.conSonidoAgregado(destino.id, slot, sonido);
          const audioBlob = audiosPorId[sonido.id];
          if (audioBlob) {
            await this.repositorio.guardarAudio(sonido.id, audioBlob);
            await this.reproductor.preparar(sonido.id, audioBlob);
          }
        }
      }
    }

    await this.repositorio.guardar(tablero);
    this.bus.publicar(TiposEvento.TABLERO_CAMBIADO, { tablero });
    return tablero;
  }
}
