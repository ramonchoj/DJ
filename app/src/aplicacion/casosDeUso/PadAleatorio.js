import { elegirSonidoAleatorio } from '../../dominio/servicios/SelectorAleatorio.js';
import { DispararPad } from './DispararPad.js';

/**
 * Caso de uso: "pad ruleta" — elige un sonido al azar dentro de un banco
 * (evitando repetir el último) y lo dispara con la misma lógica que un
 * disparo normal.
 */
export class PadAleatorio {
  #ultimoPorBanco = new Map();

  constructor({ repositorio, reproductor, bus }) {
    this.dispararPad = new DispararPad({ repositorio, reproductor, bus });
  }

  async ejecutar(tablero, bancoId) {
    const banco = tablero.bancoPorId(bancoId);
    const ultimo = this.#ultimoPorBanco.get(bancoId) || null;
    const sonido = elegirSonidoAleatorio(banco, ultimo);
    if (!sonido) return null;
    this.#ultimoPorBanco.set(bancoId, sonido.id);
    const slot = banco.slotDe(sonido.id);
    return this.dispararPad.ejecutar(tablero, bancoId, slot, { presionado: true });
  }
}
