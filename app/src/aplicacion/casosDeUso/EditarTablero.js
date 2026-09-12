import { TiposEvento } from '../../dominio/eventos.js';

/**
 * Caso de uso: operaciones de edición del tablero (CRUD sobre bancos y
 * sonidos). Cada método persiste y publica el evento correspondiente.
 */
export class EditarTablero {
  constructor({ repositorio, reproductor, bus }) {
    this.repositorio = repositorio;
    this.reproductor = reproductor;
    this.bus = bus;
  }

  async #persistirYPublicar(tableroNuevo) {
    await this.repositorio.guardar(tableroNuevo);
    this.bus.publicar(TiposEvento.TABLERO_CAMBIADO, { tablero: tableroNuevo });
    return tableroNuevo;
  }

  async crearBanco(tablero, nombre, color) {
    const t = tablero.crearBanco(nombre, color);
    this.bus.publicar(TiposEvento.BANCO_CREADO, { nombre });
    return this.#persistirYPublicar(t);
  }

  async renombrarBanco(tablero, bancoId, nuevoNombre) {
    const banco = tablero.bancoPorId(bancoId).renombrado(nuevoNombre);
    return this.#persistirYPublicar(tablero.conBanco(banco));
  }

  async eliminarBanco(tablero, bancoId) {
    const banco = tablero.bancoPorId(bancoId);
    for (const sonido of banco.listaSonidos()) {
      await this.repositorio.eliminarAudio(sonido.id);
    }
    const t = tablero.sinBanco(bancoId);
    this.bus.publicar(TiposEvento.BANCO_ELIMINADO, { bancoId });
    return this.#persistirYPublicar(t);
  }

  async editarSonido(tablero, soundId, cambios) {
    const encontrado = tablero.buscarSonido(soundId);
    const actualizado = encontrado.sonido.con(cambios);
    const t = tablero.conSonidoActualizado(actualizado);
    this.bus.publicar(TiposEvento.SONIDO_ACTUALIZADO, { sonido: actualizado });
    return this.#persistirYPublicar(t);
  }

  async moverSonido(tablero, soundId, bancoDestinoId, slotDestino) {
    const t = tablero.moverSonido(soundId, bancoDestinoId, slotDestino);
    return this.#persistirYPublicar(t);
  }

  async eliminarSonido(tablero, soundId) {
    this.reproductor.detenerSonido(soundId, { fadeMs: 30 });
    await this.repositorio.eliminarAudio(soundId);
    const t = tablero.sinSonido(soundId);
    this.bus.publicar(TiposEvento.SONIDO_ELIMINADO, { soundId });
    return this.#persistirYPublicar(t);
  }

  async fijarVolumenMaestro(tablero, valor) {
    const t = tablero.conVolumenMaestro(valor);
    this.reproductor.fijarMaestro(valor);
    this.bus.publicar(TiposEvento.VOLUMEN_MAESTRO_CAMBIADO, { valor });
    return this.#persistirYPublicar(t);
  }
}
