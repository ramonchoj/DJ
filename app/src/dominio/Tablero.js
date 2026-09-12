import { ErrorValidacion, ErrorConflicto, ErrorNoEncontrado } from './errores.js';
import { Banco } from './Banco.js';
import { Ajustes } from './valores/Ajustes.js';

/**
 * Agregado raíz: el tablero completo. Es el único punto de entrada para
 * mutar bancos/sonidos de forma consistente (invariantes globales:
 * nombres de banco únicos, tecla rápida única en todo el tablero).
 */
export class Tablero {
  constructor({ bancos = [], volumenMaestro = 1, ajustes = Ajustes.porDefecto(), version = 2 } = {}) {
    this.bancos = [...bancos].sort((a, b) => a.orden - b.orden);
    this.volumenMaestro = Math.min(1, Math.max(0, volumenMaestro));
    this.ajustes = ajustes instanceof Ajustes ? ajustes : new Ajustes(ajustes || {});
    this.version = version;
    this.#validar();
    Object.freeze(this.bancos);
    Object.freeze(this);
  }

  #validar() {
    const nombres = new Set();
    const teclas = new Set();
    for (const banco of this.bancos) {
      const clave = banco.nombre.toLowerCase();
      if (nombres.has(clave)) {
        throw new ErrorConflicto(`Nombre de banco repetido: "${banco.nombre}"`);
      }
      nombres.add(clave);
      for (const sonido of banco.listaSonidos()) {
        if (sonido.teclaRapida) {
          const k = sonido.teclaRapida.valor;
          if (teclas.has(k)) {
            throw new ErrorConflicto(`La tecla "${k}" está asignada a más de un sonido`);
          }
          teclas.add(k);
        }
      }
    }
  }

  bancoPorId(bancoId) {
    const banco = this.bancos.find((b) => b.id === bancoId);
    if (!banco) throw new ErrorNoEncontrado(`No existe el banco ${bancoId}`);
    return banco;
  }

  bancoPorNombre(nombre) {
    return this.bancos.find((b) => b.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  }

  sonidoEn(bancoId, slot) {
    return this.bancoPorId(bancoId).sonidoEn(slot);
  }

  buscarSonido(soundId) {
    for (const banco of this.bancos) {
      const sonido = banco.listaSonidos().find((s) => s.id === soundId);
      if (sonido) return { banco, sonido };
    }
    return null;
  }

  /** Busca por texto en todos los bancos. Devuelve [{banco, sonido, slot}]. */
  buscar(texto) {
    const resultados = [];
    for (const banco of this.bancos) {
      for (const sonido of banco.listaSonidos()) {
        if (sonido.coincideCon(texto)) {
          resultados.push({ banco, sonido, slot: banco.slotDe(sonido.id) });
        }
      }
    }
    return resultados;
  }

  sonidoConTecla(caracter) {
    const k = caracter.toUpperCase();
    for (const banco of this.bancos) {
      for (const sonido of banco.listaSonidos()) {
        if (sonido.teclaRapida && sonido.teclaRapida.valor === k) {
          return { banco, sonido, slot: banco.slotDe(sonido.id) };
        }
      }
    }
    return null;
  }

  conBanco(banco) {
    const resto = this.bancos.filter((b) => b.id !== banco.id);
    return new Tablero({ ...this, bancos: [...resto, banco] });
  }

  sinBanco(bancoId) {
    return new Tablero({ ...this, bancos: this.bancos.filter((b) => b.id !== bancoId) });
  }

  conVolumenMaestro(valor) {
    if (typeof valor !== 'number' || Number.isNaN(valor)) {
      throw new ErrorValidacion('El volumen maestro debe ser un número');
    }
    return new Tablero({ ...this, volumenMaestro: valor });
  }

  conAjustes(cambios) {
    return new Tablero({ ...this, ajustes: this.ajustes.con(cambios) });
  }

  crearBanco(nombre, color, { esCama = false } = {}) {
    if (this.bancoPorNombre(nombre)) {
      throw new ErrorConflicto(`Ya existe un banco llamado "${nombre}"`);
    }
    const orden = this.bancos.length ? Math.max(...this.bancos.map((b) => b.orden)) + 1 : 0;
    const banco = new Banco({ nombre, color, orden, esCama });
    return this.conBanco(banco);
  }

  /** Reordena los bancos según la lista de ids dada (los no listados van al final). */
  conBancosReordenados(idsEnOrden) {
    const posicion = new Map(idsEnOrden.map((id, i) => [id, i]));
    const bancos = this.bancos.map((b) => {
      const p = posicion.has(b.id) ? posicion.get(b.id) : idsEnOrden.length + b.orden;
      return b.conOrden(p);
    });
    return new Tablero({ ...this, bancos });
  }

  conSonidoAgregado(bancoId, slot, sonido) {
    const banco = this.bancoPorId(bancoId).conSonidoEn(slot, sonido);
    return this.conBanco(banco);
  }

  conSonidoActualizado(sonidoActualizado) {
    const encontrado = this.buscarSonido(sonidoActualizado.id);
    if (!encontrado) throw new ErrorNoEncontrado(`No existe el sonido ${sonidoActualizado.id}`);
    const banco = encontrado.banco.conSonidoActualizado(sonidoActualizado);
    return this.conBanco(banco);
  }

  sinSonido(soundId) {
    const encontrado = this.buscarSonido(soundId);
    if (!encontrado) return this;
    const banco = encontrado.banco.sinSonidoId(soundId);
    return this.conBanco(banco);
  }

  /**
   * Mueve un sonido a otro banco/slot. Si el destino está ocupado y está en
   * el mismo banco, intercambia (arrastrar y soltar); si está ocupado en
   * otro banco, lanza conflicto.
   */
  moverSonido(soundId, bancoDestinoId, slotDestino) {
    const encontrado = this.buscarSonido(soundId);
    if (!encontrado) throw new ErrorNoEncontrado(`No existe el sonido ${soundId}`);
    const origen = encontrado.banco;
    if (origen.id === bancoDestinoId) {
      const slotOrigen = origen.slotDe(soundId);
      if (slotOrigen === slotDestino) return this;
      return this.conBanco(origen.conSlotsIntercambiados(slotOrigen, slotDestino));
    }
    const sinOrigen = this.sinSonido(soundId);
    return sinOrigen.conSonidoAgregado(bancoDestinoId, slotDestino, encontrado.sonido);
  }

  todosLosSonidos() {
    return this.bancos.flatMap((b) => b.listaSonidos());
  }

  bancoDe(soundId) {
    return this.buscarSonido(soundId)?.banco || null;
  }

  toJSON() {
    return {
      version: this.version,
      volumenMaestro: this.volumenMaestro,
      ajustes: this.ajustes.toJSON(),
      bancos: this.bancos.map((b) => b.toJSON()),
    };
  }

  static vacio() {
    return new Tablero({});
  }

  static desdeJSON(json, SonidoClase) {
    return new Tablero({
      ...json,
      version: 2,
      ajustes: new Ajustes(json.ajustes || {}),
      bancos: (json.bancos || []).map((b) => Banco.desdeJSON(b, SonidoClase)),
    });
  }
}
