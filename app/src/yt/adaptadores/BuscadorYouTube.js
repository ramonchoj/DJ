/**
 * Adaptador: búsqueda dentro de YouTube con la API oficial (YouTube Data API v3).
 *
 * Necesita una clave de API del usuario (gratuita, se crea en Google Cloud
 * Console). Cuota por defecto: 10 000 unidades/día; cada búsqueda cuesta 100
 * (≈ 100 búsquedas al día) y la consulta de duraciones 1.
 * No se descarga nada: los resultados solo dan el id para el reproductor.
 */
const BASE = 'https://www.googleapis.com/youtube/v3';

export class BuscadorYouTube {
  #clave; #fetch;
  constructor({ clave, fetch: f = globalThis.fetch?.bind(globalThis) } = {}) {
    this.#clave = (clave || '').trim();
    this.#fetch = f;
  }

  get tieneClave() { return this.#clave.length > 0; }

  /** @returns {Promise<Array<{videoId:string, titulo:string, canal:string, miniatura:string, duracionSeg:number}>>} */
  async buscar(consulta, { maximo = 10 } = {}) {
    const q = (consulta || '').trim();
    if (!q) return [];
    if (!this.tieneClave) throw new Error('Falta la clave de API de YouTube. Pégala en el campo "Clave de API" para poder buscar.');
    const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: String(maximo), q, key: this.#clave });
    const datos = await this.#pedir(`${BASE}/search?${p}`);
    const items = (datos.items || []).filter((i) => i.id?.videoId);
    if (!items.length) return [];
    const ids = items.map((i) => i.id.videoId);
    let duraciones = new Map();
    try {
      const d = await this.#pedir(`${BASE}/videos?${new URLSearchParams({ part: 'contentDetails', id: ids.join(','), key: this.#clave })}`);
      duraciones = new Map((d.items || []).map((v) => [v.id, duracionIso8601ASegundos(v.contentDetails?.duration)]));
    } catch { /* sin duraciones no pasa nada */ }
    return items.map((i) => ({
      videoId: i.id.videoId,
      titulo: decodificar(i.snippet?.title || i.id.videoId),
      canal: decodificar(i.snippet?.channelTitle || ''),
      miniatura: i.snippet?.thumbnails?.default?.url || '',
      duracionSeg: duraciones.get(i.id.videoId) || 0,
    }));
  }

  async #pedir(url) {
    let r;
    try { r = await this.#fetch(url); } catch { throw new Error('No se pudo conectar con YouTube. ¿Hay internet?'); }
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const razon = json.error?.errors?.[0]?.reason || '';
      if (r.status === 403 && /quota/i.test(razon)) throw new Error('Se agotó la cuota diaria de búsquedas de YouTube (se renueva a medianoche, hora del Pacífico).');
      if (r.status === 400 || r.status === 403) throw new Error('YouTube rechazó la clave de API. Revisa que sea correcta y que tenga habilitada "YouTube Data API v3".');
      throw new Error(json.error?.message || `YouTube respondió ${r.status}.`);
    }
    return json;
  }
}

/** "PT1H2M3S" → 3723 */
export function duracionIso8601ASegundos(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

function decodificar(t) {
  return String(t).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
