import { Pista } from '../dominio/Pista.js';
import { Deck } from '../dominio/Deck.js';
import { Mezclador } from '../dominio/Mezclador.js';
import { Cola } from '../dominio/Cola.js';
import { decidirTransicion, tempoParaIgualar, puntosDeMezcla } from '../dominio/servicios/ReglasDeAutomix.js';
import { Ganancia } from '../../dominio/valores/Ganancia.js';
import { ErrorValidacion, ErrorNoEncontrado, ErrorConflicto } from '../../dominio/errores.js';
import { BusEventos } from '../../dominio/eventos.js';

export const EventosDJ = Object.freeze({
  BIBLIOTECA_CAMBIADA: 'DJ_BIBLIOTECA_CAMBIADA',
  DECK_CAMBIADO: 'DJ_DECK_CAMBIADO',
  MEZCLADOR_CAMBIADO: 'DJ_MEZCLADOR_CAMBIADO',
  COLA_CAMBIADA: 'DJ_COLA_CAMBIADA',
  TRANSICION: 'DJ_TRANSICION',
  AUTOMIX_CAMBIADO: 'DJ_AUTOMIX_CAMBIADO',
});

const FADE_POR_DEFECTO_SEG = 8;

/**
 * Puerto primario del módulo DJ: biblioteca, dos decks, mezclador, cola y
 * automix. Mantiene el estado en memoria y persiste lo necesario.
 */
export class DJAPI {
  #bus = new BusEventos();
  #pistas = new Map();
  #decks = { A: new Deck({ id: 'A' }), B: new Deck({ id: 'B' }) };
  #mezclador = new Mezclador();
  #cola = new Cola();
  #deckActivo = 'A';
  #automix = false;
  #fadeSeg = FADE_POR_DEFECTO_SEG;
  #beatmatch = true;
  #loadSecurity = true;
  #transicion = null; // { desde, hacia, inicioMs, duracionMs }
  #historial = [];

  constructor({ motor, repositorio, analizador, importador = null, reloj, grabadorSesion = null }) {
    this.motor = motor;
    this.grabadorSesion = grabadorSesion;
    this.repositorio = repositorio;
    this.analizador = analizador;
    this.importador = importador;
    this.reloj = reloj;
    motor.alTerminar?.((deckId) => this.#pistaTermino(deckId));
  }

  // ------------------------------------------------------------ ciclo de vida
  async iniciar() {
    const pistas = await this.repositorio.cargarPistas();
    for (const p of pistas) this.#pistas.set(p.id, p);
    const estado = await this.repositorio.cargarEstado();
    if (estado) {
      this.#cola = new Cola((estado.cola || []).filter((id) => this.#pistas.has(id)));
      this.#mezclador = new Mezclador(estado.mezclador || {});
      this.#fadeSeg = estado.fadeSeg ?? FADE_POR_DEFECTO_SEG;
      this.#beatmatch = estado.beatmatch ?? true;
      this.#historial = estado.historial || [];
    }
    this.#aplicarMezclador();
    return this.estado();
  }

  estado() {
    return {
      pistas: [...this.#pistas.values()],
      decks: { A: this.#decks.A, B: this.#decks.B },
      mezclador: this.#mezclador,
      cola: this.#cola,
      deckActivo: this.#deckActivo,
      automix: this.#automix,
      fadeSeg: this.#fadeSeg,
      beatmatch: this.#beatmatch,
      transicion: this.#transicion,
      historial: this.#historial,
    };
  }

  suscribir(tipo, cb) { return this.#bus.suscribir(tipo, cb); }

  async #persistirEstado() {
    await this.repositorio.guardarEstado({
      cola: this.#cola.toJSON(), mezclador: this.#mezclador.toJSON(), fadeSeg: this.#fadeSeg,
      beatmatch: this.#beatmatch, historial: this.#historial.slice(-200),
    });
  }

  // ------------------------------------------------------------ biblioteca
  pista(id) {
    const p = this.#pistas.get(id);
    if (!p) throw new ErrorNoEncontrado(`No existe la pista ${id}`);
    return p;
  }

  buscar(texto) {
    return [...this.#pistas.values()].filter((p) => p.coincideCon(texto)).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }

  /** Importa un archivo de audio: analiza (duración, ganancia, BPM) y lo guarda. */
  async importarArchivo(blob, nombreArchivo) {
    const { artista, titulo } = Pista.desdeNombreArchivo(nombreArchivo);
    const duplicada = [...this.#pistas.values()].find((p) => p.archivo === nombreArchivo);
    if (duplicada) return duplicada;
    const a = await this.analizador.analizar(blob);
    const pista = new Pista({
      titulo, artista, archivo: nombreArchivo, duracionSeg: a.duracionSeg, bpm: a.bpm,
      ganancia: Ganancia.desdeMedicion(a.picoDb), origenAnalisis: a.bpm ? 'propio' : 'ninguno',
    });
    await this.repositorio.guardarAudio(pista.id, blob);
    await this.repositorio.guardarPista(pista);
    this.#pistas.set(pista.id, pista);
    this.#bus.publicar(EventosDJ.BIBLIOTECA_CAMBIADA, { pista });
    return pista;
  }

  /** Aplica a la biblioteca los análisis de un database.xml de VirtualDJ (por nombre de archivo). */
  async importarAnalisisVirtualDJ(textoXml) {
    if (!this.importador) throw new ErrorValidacion('No hay importador de análisis configurado');
    const mapa = await this.importador.importar(textoXml);
    let aplicados = 0;
    for (const p of this.#pistas.values()) {
      const datos = mapa.get(p.archivo) || mapa.get(p.archivo.toLowerCase());
      if (!datos) continue;
      const nueva = p.conAnalisis({ ...datos, origenAnalisis: 'virtualdj' });
      await this.repositorio.guardarPista(nueva);
      this.#pistas.set(nueva.id, nueva);
      aplicados += 1;
    }
    if (aplicados) this.#bus.publicar(EventosDJ.BIBLIOTECA_CAMBIADA, {});
    return { aplicados, disponibles: mapa.size };
  }

  async editarPista(id, cambios) {
    const nueva = this.pista(id).con(cambios);
    await this.repositorio.guardarPista(nueva);
    this.#pistas.set(id, nueva);
    for (const d of ['A', 'B']) if (this.#decks[d].pista?.id === id) this.#decks[d] = this.#decks[d].con({ pista: nueva });
    this.#bus.publicar(EventosDJ.BIBLIOTECA_CAMBIADA, { pista: nueva });
    return nueva;
  }

  async eliminarPista(id) {
    for (const d of ['A', 'B']) if (this.#decks[d].pista?.id === id) await this.descargar(d);
    this.#cola = this.#cola.quitar(id);
    await this.repositorio.eliminarPista(id);
    this.#pistas.delete(id);
    this.#bus.publicar(EventosDJ.BIBLIOTECA_CAMBIADA, {});
    await this.#persistirEstado();
  }

  // ------------------------------------------------------------ decks
  deck(id) { return this.#decks[id]; }
  otroDeck(id) { return id === 'A' ? 'B' : 'A'; }

  async cargar(deckId, pistaId, { forzar = false } = {}) {
    const deck = this.#decks[deckId];
    if (deck.sonando && this.#loadSecurity && !forzar) {
      throw new ErrorConflicto(`El deck ${deckId} está sonando. Pausa primero o usa el otro deck.`);
    }
    const pista = this.pista(pistaId);
    const blob = await this.repositorio.leerAudio(pistaId);
    if (!blob) throw new ErrorNoEncontrado('No se encontró el audio de la pista');
    const { duracionSeg } = await this.motor.cargar(deckId, blob);
    const pistaConDuracion = duracionSeg && Math.abs(duracionSeg - pista.duracionSeg) > 1 ? pista.con({ duracionSeg }) : pista;
    this.motor.fijarGananciaPista(deckId, pistaConDuracion.ganancia.valor);
    this.motor.fijarEq(deckId, deck.eq);
    this.motor.fijarVolumen(deckId, deck.volumen);
    this.motor.fijarTasa(deckId, deck.tasa);
    this.motor.fijarLoop(deckId, null);
    this.#decks[deckId] = deck.conPista(pistaConDuracion, this.reloj.ahora());
    // saltar al inicio real si se conoce
    const pm = puntosDeMezcla(pistaConDuracion, { fadeSeg: this.#fadeSeg });
    if (pm.inicioReal > 0) this.motor.saltar(deckId, pm.inicioReal);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
    return this.#decks[deckId];
  }

  async descargar(deckId) {
    this.motor.pausar(deckId);
    this.motor.descargar(deckId);
    this.#decks[deckId] = this.#decks[deckId].vacio();
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  reproducir(deckId) {
    const deck = this.#decks[deckId];
    if (!deck.pista) throw new ErrorValidacion(`El deck ${deckId} no tiene pista`);
    this.motor.reproducir(deckId);
    this.#decks[deckId] = deck.reproduciendo(true);
    if (!this.#decks[this.otroDeck(deckId)].sonando) this.#deckActivo = deckId;
    this.#registrarTocada(deck.pista);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  pausar(deckId) {
    this.motor.pausar(deckId);
    this.#decks[deckId] = this.#decks[deckId].reproduciendo(false);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  alternar(deckId) { return this.#decks[deckId].sonando ? this.pausar(deckId) : this.reproducir(deckId); }

  posicion(deckId) { return this.motor.posicion(deckId); }

  saltar(deckId, seg) {
    const deck = this.#decks[deckId];
    if (!deck.pista) return;
    this.motor.saltar(deckId, Math.max(0, Math.min(deck.pista.duracionSeg, seg)));
  }

  fijarTempo(deckId, tempo) {
    this.#decks[deckId] = this.#decks[deckId].conTempo(tempo);
    this.motor.fijarTasa(deckId, this.#decks[deckId].tasa);
    if (this.#decks[deckId].loopBeats) this.#aplicarLoop(deckId);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  /** Iguala el tempo de este deck al BPM efectivo del otro (sync). */
  sincronizar(deckId) {
    const otro = this.#decks[this.otroDeck(deckId)];
    const propio = this.#decks[deckId];
    const t = tempoParaIgualar(otro.bpmEfectivo, propio.pista?.bpm);
    this.fijarTempo(deckId, t);
    return t;
  }

  /** Hot cue: si existe salta a él; si no, lo fija en la posición actual. */
  async cue(deckId, num) {
    const deck = this.#decks[deckId];
    if (!deck.pista) return null;
    const existente = deck.pista.cue(num);
    if (existente) { this.motor.saltar(deckId, existente.seg); return existente; }
    const seg = this.motor.posicion(deckId);
    await this.editarPista(deck.pista.id, { cues: [...deck.pista.cues, { num, seg }] });
    return { num, seg };
  }

  async borrarCue(deckId, num) {
    const deck = this.#decks[deckId];
    if (!deck.pista) return;
    await this.editarPista(deck.pista.id, { cues: deck.pista.sinCue(num).cues });
  }

  /** Loop de N beats desde la posición actual (0 = quitar). */
  loop(deckId, beats) {
    const deck = this.#decks[deckId];
    if (!deck.pista) return;
    const nuevo = deck.loopBeats === beats ? 0 : beats;
    this.#decks[deckId] = deck.conLoop(nuevo);
    this.#aplicarLoop(deckId);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  #aplicarLoop(deckId) {
    const deck = this.#decks[deckId];
    if (!deck.loopBeats) { this.motor.fijarLoop(deckId, null); return; }
    const inicio = this.motor.posicion(deckId);
    const largo = deck.segundosDeLoop() || 2; // sin BPM: loop de 2 s
    this.motor.fijarLoop(deckId, { inicioSeg: inicio, finSeg: inicio + largo });
  }

  fijarEq(deckId, banda, db) {
    this.#decks[deckId] = this.#decks[deckId].conEq(banda, db);
    this.motor.fijarEq(deckId, this.#decks[deckId].eq);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  fijarVolumen(deckId, v) {
    this.#decks[deckId] = this.#decks[deckId].conVolumen(v);
    this.motor.fijarVolumen(deckId, this.#decks[deckId].volumen);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  // ------------------------------------------------------------ mezclador
  #aplicarMezclador(rampaSeg = 0) {
    const [a, b] = this.#mezclador.ganancias();
    this.motor.fijarCrossfader(a, b, rampaSeg);
    this.motor.fijarMaestro(this.#mezclador.maestro);
  }

  async fijarCrossfader(x) {
    this.#mezclador = this.#mezclador.con({ crossfader: x });
    this.#aplicarMezclador();
    this.#bus.publicar(EventosDJ.MEZCLADOR_CAMBIADO, {});
    await this.#persistirEstado();
  }

  async fijarMaestro(v) {
    this.#mezclador = this.#mezclador.con({ maestro: v });
    this.#aplicarMezclador();
    this.#bus.publicar(EventosDJ.MEZCLADOR_CAMBIADO, {});
    await this.#persistirEstado();
  }

  /** Talkover / ducking desde la consola de pads. */
  atenuar(factor, ms) { this.motor.atenuar(factor, ms); }

  // ------------------------------------------------------------ grabación de la sesión
  grabacionSesionSoportada() { return Boolean(this.grabadorSesion?.soportado()); }
  grabandoSesion() { return Boolean(this.grabadorSesion?.grabando()); }
  duracionGrabacionSeg() { return this.grabadorSesion?.duracionSeg() || 0; }
  async iniciarGrabacionSesion() {
    if (!this.grabacionSesionSoportada()) throw new ErrorValidacion('Este navegador no permite grabar la sesión');
    if (this.grabandoSesion()) return;
    await this.grabadorSesion.iniciar();
    this.#bus.publicar(EventosDJ.AUTOMIX_CAMBIADO, {});
  }
  async detenerGrabacionSesion() {
    if (!this.grabandoSesion()) throw new ErrorValidacion('No hay una grabación en curso');
    const blob = await this.grabadorSesion.detener();
    this.#bus.publicar(EventosDJ.AUTOMIX_CAMBIADO, {});
    return blob;
  }

  // ------------------------------------------------------------ cola y automix
  async encolar(pistaId, opciones) { this.pista(pistaId); this.#cola = this.#cola.agregar(pistaId, opciones); this.#bus.publicar(EventosDJ.COLA_CAMBIADA, {}); await this.#persistirEstado(); }
  async desencolar(pistaId) { this.#cola = this.#cola.quitar(pistaId); this.#bus.publicar(EventosDJ.COLA_CAMBIADA, {}); await this.#persistirEstado(); }
  async moverEnCola(pistaId, pos) { this.#cola = this.#cola.mover(pistaId, pos); this.#bus.publicar(EventosDJ.COLA_CAMBIADA, {}); await this.#persistirEstado(); }
  async vaciarCola() { this.#cola = this.#cola.vaciar(); this.#bus.publicar(EventosDJ.COLA_CAMBIADA, {}); await this.#persistirEstado(); }

  async fijarFade(seg) { this.#fadeSeg = Math.max(1, Math.min(30, seg)); this.#bus.publicar(EventosDJ.AUTOMIX_CAMBIADO, {}); await this.#persistirEstado(); }
  async fijarBeatmatch(activo) { this.#beatmatch = Boolean(activo); this.#bus.publicar(EventosDJ.AUTOMIX_CAMBIADO, {}); await this.#persistirEstado(); }

  async activarAutomix(activo = true) {
    this.#automix = Boolean(activo);
    this.#bus.publicar(EventosDJ.AUTOMIX_CAMBIADO, {});
    // Si nada suena y hay cola, arranca de inmediato.
    if (this.#automix && !this.#decks.A.sonando && !this.#decks.B.sonando && !this.#cola.vacia) {
      await this.#arrancarSiguienteEn(this.#deckActivo);
      this.reproducir(this.#deckActivo);
      this.#mezclador = this.#mezclador.con({ crossfader: this.#deckActivo === 'A' ? -1 : 1 });
      this.#aplicarMezclador();
    }
  }

  async #arrancarSiguienteEn(deckId) {
    const siguiente = this.#cola.siguiente;
    if (!siguiente) return null;
    await this.cargar(deckId, siguiente, { forzar: true });
    this.#cola = this.#cola.sacarSiguiente();
    this.#bus.publicar(EventosDJ.COLA_CAMBIADA, {});
    return siguiente;
  }

  /** "Mezclar ya": arranca la siguiente de la cola en el otro deck y hace el crossfade. */
  async mezclarYa(duracionSeg = this.#fadeSeg) {
    if (this.#transicion || this.#cola.vacia) return false;
    const desde = this.#deckActivo;
    const hacia = this.otroDeck(desde);
    await this.#arrancarSiguienteEn(hacia);
    if (this.#beatmatch) this.sincronizar(hacia);
    this.reproducir(hacia);
    const ahora = this.reloj.ahora();
    this.#transicion = { desde, hacia, inicioMs: ahora, duracionMs: duracionSeg * 1000 };
    this.#mezclador = this.#mezclador.con({ crossfader: hacia === 'A' ? -1 : 1 });
    this.#aplicarMezclador(duracionSeg);
    this.#bus.publicar(EventosDJ.TRANSICION, { desde, hacia, duracionSeg });
    await this.#persistirEstado();
    return true;
  }

  /**
   * Latido del automix: llamar periódicamente (p. ej. cada 250 ms).
   * Arranca la transición cuando la pista activa llega a su punto de mezcla
   * y la cierra cuando termina el fade.
   */
  async tick() {
    const ahora = this.reloj.ahora();
    if (this.#transicion) {
      if (ahora - this.#transicion.inicioMs >= this.#transicion.duracionMs) {
        const { desde, hacia } = this.#transicion;
        this.pausar(desde);
        this.motor.descargar(desde);
        this.#decks[desde] = this.#decks[desde].vacio();
        this.#deckActivo = hacia;
        this.#transicion = null;
        this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId: desde });
        this.#bus.publicar(EventosDJ.TRANSICION, { fin: true });
      }
      return;
    }
    if (!this.#automix) return;
    const deck = this.#decks[this.#deckActivo];
    if (!deck.sonando || !deck.pista) return;
    const pos = this.motor.posicion(this.#deckActivo);
    const { arrancar, duracionFadeSeg } = decidirTransicion(deck.pista, pos, { fadeSeg: this.#fadeSeg });
    if (arrancar && !this.#cola.vacia) await this.mezclarYa(duracionFadeSeg);
  }

  #pistaTermino(deckId) {
    if (!this.#decks[deckId].sonando) return;
    this.#decks[deckId] = this.#decks[deckId].reproduciendo(false);
    this.#bus.publicar(EventosDJ.DECK_CAMBIADO, { deckId });
  }

  #registrarTocada(pista) {
    const ultimo = this.#historial[this.#historial.length - 1];
    if (ultimo && ultimo.pistaId === pista.id && this.reloj.ahora() - ultimo.en < 60000) return;
    this.#historial.push({ pistaId: pista.id, en: this.reloj.ahora() });
    const marcada = pista.marcadaComoTocada(this.reloj.ahora());
    this.#pistas.set(pista.id, marcada);
    this.repositorio.guardarPista(marcada).catch(() => {});
    this.#persistirEstado().catch(() => {});
  }
}
