import { BuscadorYouTube } from './BuscadorYouTube.js';

const CLAVE_LS = 'cabina.ytApiKey';

function el(tag, clase, texto) { const n = document.createElement(tag); if (clase) n.className = clase; if (texto != null) n.textContent = texto; return n; }
function fmt(s) { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/**
 * Adaptador primario: cajita de búsqueda dentro de YouTube. Cada resultado
 * tiene "Agregar", que manda el video por el mismo camino que un enlace
 * pegado (biblioteca + colocación automática en deck A / B / cola).
 * Sin clave de API muestra cómo conseguirla y un enlace para buscar en la
 * página de YouTube y pegar el enlace.
 */
export class UIBuscadorYouTube {
  #raiz; #alAgregar; #buscador; #resultados; #estado;

  constructor(raiz, { alAgregar }) {
    this.#raiz = raiz; this.#alAgregar = alAgregar;
    this.#buscador = new BuscadorYouTube({ clave: leerClave() });
    this.render();
  }

  render() {
    const r = this.#raiz; r.innerHTML = '';
    const form = el('form', 'yt-buscar');
    const campo = el('input'); campo.type = 'search'; campo.id = 'yt-busqueda'; campo.placeholder = 'Buscar en YouTube: canción, artista…'; campo.autocomplete = 'off'; campo.setAttribute('aria-label', 'Buscar en YouTube');
    const btn = el('button', 'boton-secundario', '🔍 Buscar'); btn.type = 'submit';
    form.appendChild(campo); form.appendChild(btn);
    const abrir = el('a', 'yt-abrir', 'Abrir en YouTube ↗'); abrir.target = '_blank'; abrir.rel = 'noopener'; abrir.href = 'https://www.youtube.com/results';
    abrir.title = 'Buscar en la página de YouTube y pegar el enlace arriba';
    campo.addEventListener('input', () => { abrir.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(campo.value)}`; });
    form.appendChild(abrir);
    r.appendChild(form);
    this.#estado = el('p', 'ayuda yt-buscar-estado'); r.appendChild(this.#estado);
    this.#resultados = el('div', 'yt-resultados'); r.appendChild(this.#resultados);
    r.appendChild(this.#clave());
    form.addEventListener('submit', (ev) => { ev.preventDefault(); this.#buscar(campo.value); });
  }

  #clave() {
    const det = document.createElement('details'); det.className = 'yt-clave';
    det.open = !this.#buscador.tieneClave;
    const sum = el('summary', '', this.#buscador.tieneClave ? 'Clave de API de YouTube: guardada ✓' : 'Para buscar aquí dentro hace falta una clave de API de YouTube (gratis)');
    det.appendChild(sum);
    const ayuda = el('p', 'ayuda');
    ayuda.innerHTML = 'Google la da gratis (100 búsquedas al día): en <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a> habilita "YouTube Data API v3", luego en Credenciales crea una "Clave de API" y pégala aquí. Se guarda solo en este dispositivo. Mientras tanto, usa "Abrir en YouTube ↗" y pega el enlace.';
    det.appendChild(ayuda);
    const f = el('form', 'yt-clave-form');
    const campo = el('input'); campo.type = 'password'; campo.id = 'yt-api-key'; campo.placeholder = 'Clave de API (AIza…)'; campo.value = leerClave(); campo.autocomplete = 'off';
    const guardar = el('button', 'boton-secundario', 'Guardar'); guardar.type = 'submit';
    f.appendChild(campo); f.appendChild(guardar);
    f.addEventListener('submit', (ev) => { ev.preventDefault(); guardarClave(campo.value); this.#buscador = new BuscadorYouTube({ clave: campo.value }); this.render(); });
    det.appendChild(f);
    return det;
  }

  async #buscar(q) {
    this.#resultados.innerHTML = '';
    if (!q.trim()) return;
    this.#estado.textContent = 'Buscando…';
    try {
      const lista = await this.#buscador.buscar(q);
      this.#estado.textContent = lista.length ? '' : 'Sin resultados.';
      for (const v of lista) this.#resultados.appendChild(this.#fila(v));
    } catch (e) { this.#estado.textContent = e.message; }
  }

  #fila(v) {
    const fila = el('div', 'dj-pista yt-resultado');
    if (v.miniatura) { const img = document.createElement('img'); img.src = v.miniatura; img.alt = ''; img.loading = 'lazy'; img.className = 'yt-mini'; fila.appendChild(img); }
    const txt = el('div', 'dj-pista-texto');
    txt.appendChild(el('div', 'dj-pista-titulo', v.titulo));
    txt.appendChild(el('div', 'dj-pista-sub', [v.canal, v.duracionSeg ? fmt(v.duracionSeg) : null].filter(Boolean).join(' · ')));
    fila.appendChild(txt);
    const acc = el('div', 'dj-pista-acciones');
    const add = el('button', 'boton-icono', '+ Agregar'); add.title = 'Agregar: va al deck A, al B o a la cola';
    add.onclick = () => { add.disabled = true; add.textContent = 'Agregado ✓'; this.#alAgregar(v.videoId); };
    acc.appendChild(add);
    fila.appendChild(acc);
    return fila;
  }
}

function leerClave() { try { return localStorage.getItem(CLAVE_LS) || ''; } catch { return ''; } }
function guardarClave(v) { try { if (v.trim()) localStorage.setItem(CLAVE_LS, v.trim()); else localStorage.removeItem(CLAVE_LS); } catch { /* */ } }
