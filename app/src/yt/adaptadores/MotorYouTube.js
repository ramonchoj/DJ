import { MotorDJ } from '../../dj/aplicacion/puertos.js';
import { cargarApiYouTube, tasaMasCercana } from './youtube.js';

/**
 * Adaptador: dos decks sobre reproductores oficiales de YouTube (IFrame API).
 *
 * Lo que sí hay: cargar por id, play/pausa/seek, posición/duración, volumen
 * por deck, crossfader (curvas de volumen con rampa), ducking/talkover
 * (volumen), tasa de reproducción (solo los pasos que permite YouTube),
 * loop (por temporizador + seekTo), fin de pista.
 * Lo que no hay (el audio no sale de YouTube, no pasa por Web Audio): EQ,
 * forma de onda, medidor de nivel, BPM automático.
 *
 * Los reproductores viven en contenedores fijos (se ven, como pide YouTube)
 * que no se re-renderizan con la interfaz.
 */
export class MotorYouTube extends MotorDJ {
  #contenedores; #players = {}; #estado = {}; #cbTerminar = null; #listo = null;
  #cross = { A: 1, B: 1 }; #duck = 1; #rampas = {}; #loops = {};

  constructor({ contenedorA, contenedorB }) {
    super();
    this.#contenedores = { A: contenedorA, B: contenedorB };
    for (const id of ['A', 'B']) this.#estado[id] = { videoId: null, duracion: 0, volumen: 1, ganancia: 1, tasa: 1, sonando: false, tasasDisponibles: null, precargando: false };
  }

  async preparar() {
    if (this.#listo) return this.#listo;
    this.#listo = (async () => {
      const YT = await cargarApiYouTube();
      await Promise.all(['A', 'B'].map((id) => new Promise((resolve) => {
        this.#players[id] = new YT.Player(this.#contenedores[id], {
          width: '100%', height: '100%',
          playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: () => { this.#players[id].setVolume(this.#volumenFinal(id)); resolve(); },
            onStateChange: (ev) => this.#alCambiarEstado(id, ev.data),
          },
        });
      })));
      return true;
    })();
    return this.#listo;
  }

  #alCambiarEstado(id, estado) {
    const e = this.#estado[id];
    const YT = window.YT;
    if (estado === YT.PlayerState.PLAYING) { if (!e.precargando) e.sonando = true; if (!e.duracion) e.duracion = this.#players[id].getDuration() || 0; }
    if (estado === YT.PlayerState.PAUSED) e.sonando = false;
    if (estado === YT.PlayerState.ENDED) { e.sonando = false; this.#cbTerminar?.(id); }
  }

  #volumenFinal(id) {
    const e = this.#estado[id];
    if (e.precargando) return 0;
    return Math.round(Math.max(0, Math.min(1, e.volumen * e.ganancia * this.#cross[id] * this.#duck)) * 100);
  }

  #aplicarVolumen(id) {
    const p = this.#players[id];
    if (p?.setVolume) p.setVolume(this.#volumenFinal(id));
  }

  // "blob" aquí es { videoId, duracionSeg? } (lo entrega RepositorioYouTube)
  async cargar(id, blob) {
    await this.preparar();
    const e = this.#estado[id];
    e.videoId = blob.videoId; e.duracion = blob.duracionSeg || 0; e.sonando = false;
    this.fijarLoop(id, null);
    const p = this.#players[id];
    await new Promise((resolve) => {
      let hecho = false;
      const listo = () => { if (hecho) return; hecho = true; resolve(); };
      const cb = (ev) => { if (ev.data === window.YT.PlayerState.CUED) { p.removeEventListener('onStateChange', cb); listo(); } };
      p.addEventListener('onStateChange', cb);
      p.cueVideoById({ videoId: blob.videoId });
      setTimeout(listo, 4000);
    });
    const dur = p.getDuration?.() || e.duracion;
    if (dur) e.duracion = dur;
    e.tasasDisponibles = p.getAvailablePlaybackRates?.() || null;
    this.#aplicarVolumen(id);
    return { duracionSeg: e.duracion, titulo: p.getVideoData?.()?.title || '' };
  }

  descargar(id) {
    const e = this.#estado[id];
    this.fijarLoop(id, null);
    try { this.#players[id]?.stopVideo(); } catch { /* */ }
    e.videoId = null; e.duracion = 0; e.sonando = false;
  }

  reproducir(id, desdeSeg) {
    const p = this.#players[id]; if (!p || !this.#estado[id].videoId) return;
    this.#cancelarPrecarga(id);
    if (desdeSeg != null) p.seekTo(desdeSeg, true);
    p.playVideo();
    this.#estado[id].sonando = true;
  }

  pausar(id) { const p = this.#players[id]; if (!p) return; this.#cancelarPrecarga(id); p.pauseVideo(); this.#estado[id].sonando = false; }

  /**
   * Precarga para internet lento. YouTube solo llena el buffer mientras
   * reproduce, así que se toca en silencio (volumen 0 + mute) hasta tener
   * `segundos` cargados (o todo el video), y se regresa al punto de partida en
   * pausa. Si el usuario da play o pausa mientras tanto, la precarga se
   * cancela sin estorbar.
   */
  async precargar(id, { segundos = 90, maxMs = 180000 } = {}) {
    const p = this.#players[id]; const e = this.#estado[id];
    if (!p || !e.videoId || e.sonando || e.precargando) return this.precarga(id);
    const dur = this.duracion(id) || 0;
    const objetivo = dur ? Math.min(1, segundos / dur) : 1;
    if ((p.getVideoLoadedFraction?.() || 0) >= objetivo - 0.005) return this.precarga(id);
    const inicio = this.posicion(id);
    e.precargando = true; this.#aplicarVolumen(id); p.mute?.(); p.playVideo();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        const f = p.getVideoLoadedFraction?.() || 0;
        if (!e.precargando || f >= objetivo - 0.005 || performance.now() - t0 > maxMs) { clearInterval(iv); resolve(); }
      }, 300);
    });
    if (e.precargando) { p.pauseVideo(); p.seekTo(inicio, true); e.precargando = false; e.sonando = false; p.unMute?.(); this.#aplicarVolumen(id); }
    return this.precarga(id);
  }

  precarga(id) {
    const f = Math.max(0, Math.min(1, this.#players[id]?.getVideoLoadedFraction?.() || 0));
    return { fraccion: f, segundos: Math.round(f * this.duracion(id)) };
  }

  #cancelarPrecarga(id) {
    const e = this.#estado[id]; if (!e.precargando) return;
    e.precargando = false; this.#players[id]?.unMute?.(); this.#aplicarVolumen(id);
  }
  saltar(id, seg) { this.#players[id]?.seekTo(Math.max(0, seg), true); }
  posicion(id) { return this.#players[id]?.getCurrentTime?.() || 0; }
  duracion(id) { return this.#estado[id].duracion || this.#players[id]?.getDuration?.() || 0; }

  fijarTasa(id, tasa) {
    const e = this.#estado[id];
    e.tasa = tasaMasCercana(tasa, e.tasasDisponibles || undefined);
    this.#players[id]?.setPlaybackRate?.(e.tasa);
  }

  fijarLoop(id, loop) {
    clearInterval(this.#loops[id]);
    this.#loops[id] = null;
    if (!loop) return;
    this.#loops[id] = setInterval(() => {
      const pos = this.posicion(id);
      if (this.#estado[id].sonando && pos >= loop.finSeg) this.#players[id].seekTo(loop.inicioSeg, true);
    }, 100);
  }

  fijarEq() { /* no disponible en YouTube */ }
  fijarGananciaPista(id, g) { this.#estado[id].ganancia = g; this.#aplicarVolumen(id); }
  fijarVolumen(id, v) { this.#estado[id].volumen = v; this.#aplicarVolumen(id); }

  fijarCrossfader(a, b, rampaSeg = 0) {
    this.#rampa('cross', { A: a, B: b }, rampaSeg);
  }

  fijarMaestro() { /* el volumen maestro es el del dispositivo */ }

  atenuar(factor, ms) {
    this.#rampaDuck(factor, 0.08);
    clearTimeout(this.#rampas.duckVuelta);
    if (ms > 0) this.#rampas.duckVuelta = setTimeout(() => this.#rampaDuck(1, 0.3), ms);
  }

  restaurar() { clearTimeout(this.#rampas.duckVuelta); this.#rampaDuck(1, 0.3); }

  #rampaDuck(objetivo, seg) {
    const inicio = this.#duck; const t0 = performance.now();
    clearInterval(this.#rampas.duck);
    this.#rampas.duck = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (seg * 1000));
      this.#duck = inicio + (objetivo - inicio) * k;
      this.#aplicarVolumen('A'); this.#aplicarVolumen('B');
      if (k >= 1) clearInterval(this.#rampas.duck);
    }, 50);
  }

  #rampa(clave, objetivo, seg) {
    clearInterval(this.#rampas[clave]);
    const inicio = { ...this.#cross };
    if (!seg) { this.#cross = { ...objetivo }; this.#aplicarVolumen('A'); this.#aplicarVolumen('B'); return; }
    const t0 = performance.now();
    this.#rampas[clave] = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (seg * 1000));
      for (const id of ['A', 'B']) this.#cross[id] = inicio[id] + (objetivo[id] - inicio[id]) * k;
      this.#aplicarVolumen('A'); this.#aplicarVolumen('B');
      if (k >= 1) clearInterval(this.#rampas[clave]);
    }, 50);
  }

  formaDeOnda() { return new Float32Array(0); }
  nivel(id) { const e = this.#estado[id]; return e.sonando && !e.precargando ? 0.35 * this.#cross[id] * this.#duck : 0; }
  alTerminar(cb) { this.#cbTerminar = cb; }
}
