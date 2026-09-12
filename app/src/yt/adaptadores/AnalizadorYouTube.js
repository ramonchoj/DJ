import { AnalizadorPista } from '../../dj/aplicacion/puertos.js';
import { cargarApiYouTube } from './youtube.js';

/**
 * Adaptador: "analiza" un video de YouTube = obtiene título y duración con
 * un reproductor de vista previa (visible, pequeño). No hay BPM automático
 * (el audio no sale de YouTube); el usuario puede escribir el BPM en la
 * pista si quiere usar sync.
 */
export class AnalizadorYouTube extends AnalizadorPista {
  #contenedor; #player = null; #listo = null;

  constructor({ contenedor }) { super(); this.#contenedor = contenedor; }

  async #preparar() {
    if (this.#listo) return this.#listo;
    this.#listo = (async () => {
      const YT = await cargarApiYouTube();
      await new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('La vista previa de YouTube no respondió. Revisa la conexión y vuelve a intentar.')), 30000);
        this.#player = new YT.Player(this.#contenedor, {
          width: '100%', height: '100%',
          playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
          events: { onReady: () => resolve() },
        });
      });
    })().catch((e) => { this.#listo = null; try { this.#player?.destroy?.(); } catch { /* */ } this.#player = null; throw e; });
    return this.#listo;
  }

  async analizar(blob) {
    await this.#preparar();
    const p = this.#player;
    const datos = await new Promise((resolve, reject) => {
      let hecho = false;
      const fin = (v) => { if (hecho) return; hecho = true; p.removeEventListener('onStateChange', cb); p.removeEventListener('onError', err); resolve(v); };
      const cb = (ev) => { if (ev.data === window.YT.PlayerState.CUED) setTimeout(() => fin({ duracion: p.getDuration() || 0, titulo: p.getVideoData()?.title || '' }), 150); };
      const err = () => { if (hecho) return; hecho = true; p.removeEventListener('onStateChange', cb); reject(new Error('YouTube no pudo cargar ese video (privado, eliminado o no permite reproducción embebida).')); };
      p.addEventListener('onStateChange', cb);
      p.addEventListener('onError', err);
      p.cueVideoById({ videoId: blob.videoId });
      setTimeout(() => fin({ duracion: p.getDuration?.() || 0, titulo: p.getVideoData?.()?.title || '' }), 6000);
    });
    if (!datos.duracion && !datos.titulo) throw new Error('No se pudo leer el video. Revisa el enlace.');
    return { duracionSeg: datos.duracion, picoDb: -3, bpm: null, titulo: datos.titulo };
  }
}
