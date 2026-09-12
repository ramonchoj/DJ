/**
 * Utilidades del adaptador de YouTube: carga de la API IFrame oficial y
 * extracción de ids de video a partir de enlaces pegados por el usuario.
 * (No se descarga audio: todo suena dentro de los reproductores de YouTube.)
 */
let promesaApi = null;

export function cargarApiYouTube() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Sin ventana'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (promesaApi) return promesaApi;
  promesaApi = new Promise((resolve, reject) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { promesaApi = null; reject(new Error('No se pudo cargar YouTube. ¿Hay internet? (Esta función necesita conexión.)')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!window.YT?.Player) { promesaApi = null; reject(new Error('YouTube no respondió a tiempo. Revisa la conexión.')); } }, 15000);
  });
  return promesaApi;
}

/** Acepta URLs largas, cortas (youtu.be), shorts, embed, o el id pelón. */
export function extraerVideoId(texto) {
  const t = (texto || '').trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  let u;
  try { u = new URL(t); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return limpiar(u.pathname.slice(1));
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (u.searchParams.get('v')) return limpiar(u.searchParams.get('v'));
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

function limpiar(id) {
  const m = (id || '').match(/^([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Extrae todos los ids de un texto con varios enlaces (uno por línea o separados por espacios). */
export function extraerVideoIds(texto) {
  const ids = [];
  for (const parte of (texto || '').split(/[\s,;]+/)) {
    const id = extraerVideoId(parte);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Tasas de reproducción que YouTube permite; se elige la más cercana al tempo pedido. */
export const TASAS_YOUTUBE = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export function tasaMasCercana(tasa, disponibles = TASAS_YOUTUBE) {
  let mejor = 1; let dist = Infinity;
  for (const r of disponibles) { const d = Math.abs(r - tasa); if (d < dist) { dist = d; mejor = r; } }
  return mejor;
}
