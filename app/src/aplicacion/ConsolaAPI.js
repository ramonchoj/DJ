import { Tablero } from '../dominio/Tablero.js';
import { Sonido } from '../dominio/Sonido.js';
import { BusEventos, TiposEvento } from '../dominio/eventos.js';
import { DispararPad } from './casosDeUso/DispararPad.js';
import { DetenerTodo } from './casosDeUso/DetenerTodo.js';
import { AgregarSonido } from './casosDeUso/AgregarSonido.js';
import { EditarTablero } from './casosDeUso/EditarTablero.js';
import { PadAleatorio } from './casosDeUso/PadAleatorio.js';
import { ExportarImportarTablero } from './casosDeUso/ExportarImportarTablero.js';

/**
 * Puerto primario (fachada): la única puerta de entrada que usan los
 * adaptadores primarios (UI táctil, teclado, MIDI...). Mantiene el estado
 * actual del Tablero en memoria y delega cada operación en su caso de uso.
 */
export class ConsolaAPI {
  #tablero = Tablero.vacio();
  #bus = new BusEventos();

  constructor({ repositorio, reproductor, analizador, empaquetador, reloj }) {
    this.repositorio = repositorio;
    this.reproductor = reproductor;
    this.reloj = reloj;

    this.ucDisparar = new DispararPad({ repositorio, reproductor, bus: this.#bus });
    this.ucDetenerTodo = new DetenerTodo({ reproductor, bus: this.#bus });
    this.ucAgregar = new AgregarSonido({ repositorio, analizador, reproductor, bus: this.#bus });
    this.ucEditar = new EditarTablero({ repositorio, reproductor, bus: this.#bus });
    this.ucAleatorio = new PadAleatorio({ repositorio, reproductor, bus: this.#bus });
    this.ucExportarImportar = new ExportarImportarTablero({ repositorio, reproductor, empaquetador, bus: this.#bus });

    this.#bus.suscribir(TiposEvento.TABLERO_CAMBIADO, ({ tablero }) => {
      this.#tablero = tablero;
    });
  }

  async iniciar() {
    const guardado = await this.repositorio.cargar();
    this.#tablero = guardado || Tablero.vacio();
    this.reproductor.fijarMaestro(this.#tablero.volumenMaestro);
    for (const sonido of this.#tablero.todosLosSonidos()) {
      try {
        const blob = await this.repositorio.leerAudio(sonido.id);
        if (blob) await this.reproductor.preparar(sonido.id, blob);
      } catch {
        // audio faltante: se ignora, el pad seguirá visible pero no sonará
      }
    }
    return this.#tablero;
  }

  estado() {
    return this.#tablero;
  }

  suscribir(tipo, callback) {
    return this.#bus.suscribir(tipo, callback);
  }

  async dispararPad(bancoId, slot, opciones = {}) {
    return this.ucDisparar.ejecutar(this.#tablero, bancoId, slot, opciones);
  }

  detenerTodo(opciones = {}) {
    return this.ucDetenerTodo.ejecutar(opciones);
  }

  async agregarSonido(datos) {
    const { tablero } = await this.ucAgregar.ejecutar(this.#tablero, datos);
    return tablero;
  }

  async crearBanco(nombre, color) {
    return this.ucEditar.crearBanco(this.#tablero, nombre, color);
  }

  async renombrarBanco(bancoId, nuevoNombre) {
    return this.ucEditar.renombrarBanco(this.#tablero, bancoId, nuevoNombre);
  }

  async eliminarBanco(bancoId) {
    return this.ucEditar.eliminarBanco(this.#tablero, bancoId);
  }

  async editarSonido(soundId, cambios) {
    return this.ucEditar.editarSonido(this.#tablero, soundId, cambios);
  }

  async moverSonido(soundId, bancoDestinoId, slotDestino) {
    return this.ucEditar.moverSonido(this.#tablero, soundId, bancoDestinoId, slotDestino);
  }

  async eliminarSonido(soundId) {
    return this.ucEditar.eliminarSonido(this.#tablero, soundId);
  }

  async fijarVolumenMaestro(valor) {
    return this.ucEditar.fijarVolumenMaestro(this.#tablero, valor);
  }

  async padAleatorio(bancoId) {
    return this.ucAleatorio.ejecutar(this.#tablero, bancoId);
  }

  async exportarTablero() {
    return this.ucExportarImportar.exportar(this.#tablero);
  }

  async importarTablero(blob, opciones = {}) {
    return this.ucExportarImportar.importar(blob, { ...opciones, tableroActual: this.#tablero });
  }
}

export { Sonido };
