import { ErrorNoEncontrado } from '../../dominio/errores.js';
import { sonidosACortar } from '../../dominio/servicios/ReglasDeSolapamiento.js';
import { sonidosAAtenuar, sonidosACortarUnoALaVez } from '../../dominio/servicios/ReglasDeDucking.js';
import { TiposEvento } from '../../dominio/eventos.js';

const FADE_CORTE_MS = 60;
const FADE_SOLTAR_MS = 30;

/**
 * Caso de uso: disparar (o soltar) el pad de un banco/slot.
 * `presionado` solo importa para el modo MANTENER (pointerdown/up, keydown/up).
 *
 * Aplica, en este orden:
 *  1. modo "uno a la vez" (ajuste global): corta todo lo que no sea cama;
 *  2. reglas de solapamiento del modo EXCLUSIVO (corta otras camas del mismo banco);
 *  3. dispara con ganancia efectiva (normalización × volumen manual) y tasa por tono;
 *  4. ducking: atenúa las camas activas mientras dura el sonido nuevo.
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
        this.reproductor.detenerSonido(sonido.id, { fadeMs: FADE_SOLTAR_MS });
        this.bus.publicar(TiposEvento.REPRODUCCION_DETENIDA, { soundId: sonido.id });
        return { sonido, token: null };
      }
    } else if (!presionado) {
      // Soltar el dedo/tecla no significa nada fuera de MANTENER: sin este
      // corte, cada toque disparaba el sonido dos veces.
      return { sonido, token: null };
    }

    // Modo LOOP: un segundo toque sobre un loop que ya suena lo detiene.
    if (sonido.modo.esLoop() && this.reproductor.activos().some((a) => a.soundId === sonido.id)) {
      this.reproductor.detenerSonido(sonido.id, { fadeMs: FADE_CORTE_MS });
      this.bus.publicar(TiposEvento.REPRODUCCION_DETENIDA, { soundId: sonido.id });
      return { sonido, token: null };
    }

    const esBancoCama = (id) => {
      try { return tablero.bancoPorId(id).esCama; } catch { return false; }
    };
    const activos = this.reproductor.activos();

    if (tablero.ajustes.unoALaVez) {
      for (const id of sonidosACortarUnoALaVez({ activos, esBancoCama, soundIdNuevo: sonido.id })) {
        this.reproductor.detenerSonido(id, { fadeMs: FADE_CORTE_MS });
      }
    }

    for (const idACortar of sonidosACortar(sonido, bancoId, activos)) {
      this.reproductor.detenerSonido(idACortar, { fadeMs: FADE_CORTE_MS });
    }

    const blob = await this.repositorio.leerAudio(sonido.id);
    await this.reproductor.preparar(sonido.id, blob);
    const token = this.reproductor.disparar(sonido.id, {
      bancoId,
      ganancia: sonido.gananciaEfectiva,
      tasa: sonido.tasaReproduccion,
      loop: sonido.modo.esLoop(),
      modo: sonido.modo,
    });

    const aAtenuar = sonidosAAtenuar({
      bancoNuevoId: bancoId,
      activos: this.reproductor.activos().filter((a) => a.soundId !== sonido.id),
      esBancoCama,
      ducking: tablero.ajustes.ducking,
    });
    if (aAtenuar.length) {
      const duracionMs = sonido.modo.esLoop() ? 0 : Math.round(sonido.duracionMs / sonido.tasaReproduccion);
      this.reproductor.atenuar(aAtenuar, tablero.ajustes.ducking, duracionMs);
    }

    this.bus.publicar(TiposEvento.PAD_DISPARADO, { bancoId, slot, soundId: sonido.id, token });
    return { sonido, token };
  }
}
