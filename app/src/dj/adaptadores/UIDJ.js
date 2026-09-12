import { EventosDJ } from '../aplicacion/DJAPI.js';

const fmt = (seg) => {
  if (!Number.isFinite(seg) || seg < 0) seg = 0;
  const m = Math.floor(seg / 60); const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Adaptador primario del módulo DJ: biblioteca, cola, dos decks, mezclador
 * y automix. Solo lee `dj.estado()` y llama métodos de la fachada.
 */
export class UIDJ {
  #raiz; #dj; #busqueda = ''; #animacion = null; #ultimoTick = 0;
  #canvas = {}; #arrastrandoPista = null;

  constructor(raiz, dj) {
    this.#raiz = raiz;
    this.#dj = dj;
    for (const t of Object.values(EventosDJ)) dj.suscribir(t, () => this.render());
    this.#iniciarAnimacion();
  }

  render() {
    const e = this.#dj.estado();
    this.#raiz.innerHTML = '';
    this.#raiz.appendChild(this.#decksYMezclador(e));
    this.#raiz.appendChild(this.#automix(e));
    const abajo = el('div', 'dj-abajo');
    abajo.appendChild(this.#biblioteca(e));
    abajo.appendChild(this.#cola(e));
    this.#raiz.appendChild(abajo);
  }

  // ------------------------------------------------------------ decks
  #decksYMezclador(e) {
    const fila = el('div', 'dj-decks');
    fila.appendChild(this.#deck(e, 'A'));
    fila.appendChild(this.#mezclador(e));
    fila.appendChild(this.#deck(e, 'B'));
    return fila;
  }

  #deck(e, id) {
    const d = e.decks[id];
    const sec = el('section', `deck deck--${id}` + (d.sonando ? ' deck--sonando' : '') + (e.deckActivo === id ? ' deck--activo' : ''));
    sec.dataset.deck = id;
    sec.addEventListener('dragover', (ev) => { if (this.#arrastrandoPista) { ev.preventDefault(); sec.classList.add('deck--destino'); } });
    sec.addEventListener('dragleave', () => sec.classList.remove('deck--destino'));
    sec.addEventListener('drop', (ev) => { ev.preventDefault(); sec.classList.remove('deck--destino'); const id2 = this.#arrastrandoPista; this.#arrastrandoPista = null; if (id2) this.#dj.cargar(id, id2).catch((x) => this.#error(x)); });

    const cab = el('div', 'deck-cab');
    cab.appendChild(el('span', 'deck-letra', id));
    const info = el('div', 'deck-info');
    info.appendChild(el('div', 'deck-titulo', d.pista ? d.pista.titulo : 'Vacío — arrastra una canción o usa ▶A/▶B'));
    info.appendChild(el('div', 'deck-artista', d.pista ? d.pista.artista : ''));
    cab.appendChild(info);
    const bpm = el('div', 'deck-bpm', d.pista?.bpm ? `${d.bpmEfectivo} BPM` : '— BPM');
    if (d.pista?.tono) bpm.appendChild(el('span', 'deck-tono', d.pista.tono));
    cab.appendChild(bpm);
    sec.appendChild(cab);

    const onda = document.createElement('canvas');
    onda.className = 'deck-onda'; onda.width = 600; onda.height = 70;
    onda.addEventListener('pointerdown', (ev) => {
      if (!d.pista) return;
      const r = onda.getBoundingClientRect();
      this.#dj.saltar(id, ((ev.clientX - r.left) / r.width) * d.pista.duracionSeg);
    });
    this.#canvas[id] = onda;
    sec.appendChild(onda);

    const tiempos = el('div', 'deck-tiempos');
    tiempos.appendChild(el('span', 'deck-pos', '0:00'));
    tiempos.appendChild(el('span', 'deck-rest', d.pista ? `-${fmt(d.pista.duracionSeg)}` : ''));
    sec.appendChild(tiempos);

    const transporte = el('div', 'deck-transporte');
    const play = el('button', 'boton-deck boton-deck--play', d.sonando ? '⏸' : '▶');
    play.title = 'Play / pausa'; play.disabled = !d.pista;
    play.onclick = () => { try { this.#dj.alternar(id); } catch (x) { this.#error(x); } };
    transporte.appendChild(play);
    const cueBtns = el('div', 'deck-cues');
    for (let n = 1; n <= 4; n++) {
      const c = d.pista?.cue(n);
      const b = el('button', 'boton-deck boton-cue' + (c ? ' boton-cue--set' : ''), String(n));
      b.title = c ? `Cue ${n} en ${fmt(c.seg)} (clic derecho: borrar)` : `Fijar cue ${n} aquí`; b.disabled = !d.pista;
      b.onclick = () => this.#dj.cue(id, n).catch((x) => this.#error(x));
      b.oncontextmenu = (ev) => { ev.preventDefault(); this.#dj.borrarCue(id, n).catch((x) => this.#error(x)); };
      cueBtns.appendChild(b);
    }
    transporte.appendChild(cueBtns);
    const loops = el('div', 'deck-loops');
    for (const beats of [4, 8]) {
      const b = el('button', 'boton-deck' + (d.loopBeats === beats ? ' boton-deck--activo' : ''), `↻${beats}`);
      b.title = `Loop de ${beats} beats`; b.disabled = !d.pista;
      b.onclick = () => this.#dj.loop(id, beats);
      loops.appendChild(b);
    }
    transporte.appendChild(loops);
    const sync = el('button', 'boton-deck', 'SYNC'); sync.title = 'Igualar BPM al otro deck'; sync.disabled = !d.pista || !e.decks[id === 'A' ? 'B' : 'A'].pista;
    sync.onclick = () => this.#dj.sincronizar(id);
    transporte.appendChild(sync);
    const eject = el('button', 'boton-deck', '⏏'); eject.title = 'Descargar'; eject.disabled = !d.pista;
    eject.onclick = () => this.#dj.descargar(id).catch((x) => this.#error(x));
    transporte.appendChild(eject);
    sec.appendChild(transporte);

    const controles = el('div', 'deck-controles');
    controles.appendChild(this.#slider('Tempo', `${d.tempo >= 0 ? '+' : ''}${(d.tempo * 100).toFixed(1)}%`, -0.12, 0.12, 0.001, d.tempo, (v) => this.#dj.fijarTempo(id, v), { doble: () => this.#dj.fijarTempo(id, 0) }));
    for (const [banda, etiqueta] of [['alta', 'Agudos'], ['media', 'Medios'], ['baja', 'Graves']]) {
      controles.appendChild(this.#slider(etiqueta, `${d.eq[banda] > 0 ? '+' : ''}${d.eq[banda]} dB`, -40, 12, 1, d.eq[banda], (v) => this.#dj.fijarEq(id, banda, v), { doble: () => this.#dj.fijarEq(id, banda, 0), kill: () => this.#dj.fijarEq(id, banda, d.eq[banda] <= -40 ? 0 : -40) }));
    }
    controles.appendChild(this.#slider('Vol', `${Math.round(d.volumen * 100)}%`, 0, 1, 0.01, d.volumen, (v) => this.#dj.fijarVolumen(id, v)));
    sec.appendChild(controles);
    return sec;
  }

  #slider(etiqueta, valorTexto, min, max, paso, valor, onInput, { doble = null, kill = null } = {}) {
    const w = el('label', 'dj-slider');
    const cab = el('span', 'dj-slider-cab');
    cab.appendChild(el('span', '', etiqueta));
    const out = el('output', '', valorTexto);
    cab.appendChild(out);
    if (kill) { const k = el('button', 'boton-kill', 'kill'); k.type = 'button'; k.onclick = kill; cab.appendChild(k); }
    w.appendChild(cab);
    const input = document.createElement('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(paso); input.value = String(valor);
    input.oninput = () => onInput(Number(input.value));
    if (doble) input.ondblclick = () => doble();
    w.appendChild(input);
    return w;
  }

  #mezclador(e) {
    const m = e.mezclador;
    const sec = el('section', 'dj-mezclador');
    sec.appendChild(el('h3', '', 'Mezclador'));
    const vu = el('div', 'dj-vus');
    for (const id of ['A', 'B']) { const v = el('div', `dj-vu dj-vu--${id}`); v.innerHTML = '<div class="dj-vu-barra"></div>'; vu.appendChild(v); }
    sec.appendChild(vu);
    const cross = el('label', 'dj-cross');
    cross.appendChild(el('span', '', 'A'));
    const input = document.createElement('input');
    input.type = 'range'; input.min = '-1'; input.max = '1'; input.step = '0.01'; input.value = String(m.crossfader); input.id = 'dj-crossfader';
    input.oninput = () => this.#dj.fijarCrossfader(Number(input.value));
    input.ondblclick = () => this.#dj.fijarCrossfader(0);
    cross.appendChild(input);
    cross.appendChild(el('span', '', 'B'));
    sec.appendChild(cross);
    sec.appendChild(this.#slider('Maestro', `${Math.round(m.maestro * 100)}%`, 0, 1, 0.01, m.maestro, (v) => this.#dj.fijarMaestro(v)));
    return sec;
  }

  // ------------------------------------------------------------ automix
  #automix(e) {
    const bar = el('section', 'dj-automix' + (e.automix ? ' dj-automix--on' : ''));
    const toggle = el('button', 'boton-primario', e.automix ? '⏹ Automix activo' : '▶ Activar automix');
    toggle.onclick = () => this.#dj.activarAutomix(!e.automix).catch((x) => this.#error(x));
    bar.appendChild(toggle);
    const ya = el('button', 'boton-secundario', '⏭ Mezclar ya');
    ya.disabled = e.cola.vacia || Boolean(e.transicion);
    ya.onclick = () => this.#dj.mezclarYa().catch((x) => this.#error(x));
    bar.appendChild(ya);
    const fade = el('label', 'dj-inline', 'Fade');
    const f = document.createElement('input'); f.type = 'number'; f.min = '1'; f.max = '30'; f.value = String(e.fadeSeg); f.style.width = '4em';
    f.onchange = () => this.#dj.fijarFade(Number(f.value));
    fade.appendChild(f); fade.appendChild(el('span', '', 's'));
    bar.appendChild(fade);
    const bm = el('label', 'dj-inline');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = e.beatmatch;
    cb.onchange = () => this.#dj.fijarBeatmatch(cb.checked);
    bm.appendChild(cb); bm.appendChild(el('span', '', 'Igualar BPM al mezclar'));
    bar.appendChild(bm);
    if (this.#dj.grabacionSesionSoportada()) {
      const grabando = this.#dj.grabandoSesion();
      const rec = el('button', 'boton-secundario' + (grabando ? ' boton-rec--on' : ''), grabando ? '⏹ Guardar grabación' : '⏺ Grabar sesión');
      rec.title = 'Graba todo lo que suena (pads + decks) a un archivo de audio';
      rec.onclick = async () => {
        try {
          if (!grabando) { await this.#dj.iniciarGrabacionSesion(); return; }
          const blob = await this.#dj.detenerGrabacionSesion();
          const tipo = blob.type || '';
          const ext = tipo.includes('mp4') ? 'm4a' : (tipo.includes('ogg') ? 'ogg' : 'webm');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `cabina-sesion-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.${ext}`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (x) { this.#error(x); }
      };
      bar.appendChild(rec);
      if (grabando) bar.appendChild(el('span', 'dj-rec-tiempo', '0:00'));
    }
    const estado = el('span', 'dj-estado', e.transicion ? `Mezclando ${e.transicion.desde} → ${e.transicion.hacia}…` : (e.automix ? `Siguiente: ${e.cola.siguiente ? this.#dj.pista(e.cola.siguiente).nombreCompleto : '(cola vacía)'}` : ''));
    bar.appendChild(estado);
    return bar;
  }

  // ------------------------------------------------------------ biblioteca y cola
  #biblioteca(e) {
    const sec = el('section', 'dj-biblioteca');
    const cab = el('div', 'dj-cab');
    cab.appendChild(el('h3', '', `Biblioteca (${e.pistas.length})`));
    const importar = el('button', 'boton-secundario', '+ Canciones');
    importar.onclick = () => this.#importarArchivos();
    cab.appendChild(importar);
    const vdj = el('button', 'boton-secundario', '⬆ VirtualDJ database.xml'); vdj.title = 'Importa BPM, tono, cues y puntos de mezcla ya analizados por VirtualDJ';
    vdj.onclick = () => this.#importarVirtualDJ();
    cab.appendChild(vdj);
    sec.appendChild(cab);
    const buscar = document.createElement('input');
    buscar.type = 'search'; buscar.placeholder = 'Buscar canción, artista o etiqueta…'; buscar.className = 'buscador'; buscar.id = 'dj-buscador'; buscar.value = this.#busqueda;
    buscar.oninput = () => { this.#busqueda = buscar.value; this.render(); document.getElementById('dj-buscador')?.focus(); };
    sec.appendChild(buscar);
    const lista = el('div', 'dj-lista');
    const pistas = this.#dj.buscar(this.#busqueda);
    if (!pistas.length) lista.appendChild(el('p', 'ayuda', e.pistas.length ? 'Nada coincide.' : 'Agrega canciones con "+ Canciones" (mp3, m4a, wav…). Se analizan (BPM, volumen) y quedan guardadas en este dispositivo.'));
    for (const p of pistas) {
      const fila = el('div', 'dj-pista');
      fila.draggable = true;
      fila.addEventListener('dragstart', () => { this.#arrastrandoPista = p.id; });
      fila.addEventListener('dragend', () => { this.#arrastrandoPista = null; });
      const txt = el('div', 'dj-pista-texto');
      txt.appendChild(el('div', 'dj-pista-titulo', p.titulo));
      txt.appendChild(el('div', 'dj-pista-sub', [p.artista, p.bpm ? `${p.bpm} BPM` : null, p.tono, fmt(p.duracionSeg), p.origenAnalisis === 'virtualdj' ? 'VDJ' : null, p.vecesTocada ? `×${p.vecesTocada}` : null].filter(Boolean).join(' · ')));
      fila.appendChild(txt);
      const acc = el('div', 'dj-pista-acciones');
      for (const id of ['A', 'B']) {
        const b = el('button', 'boton-icono', `▶${id}`); b.title = `Cargar en deck ${id}`;
        b.onclick = () => this.#dj.cargar(id, p.id).catch((x) => this.#error(x));
        acc.appendChild(b);
      }
      const enc = el('button', 'boton-icono', '+'); enc.title = 'Agregar a la cola';
      enc.onclick = () => this.#dj.encolar(p.id).catch((x) => this.#error(x));
      acc.appendChild(enc);
      const del = el('button', 'boton-icono', '🗑'); del.title = 'Eliminar de la biblioteca';
      del.onclick = () => { if (confirm(`¿Eliminar "${p.nombreCompleto}" de la biblioteca?`)) this.#dj.eliminarPista(p.id).catch((x) => this.#error(x)); };
      acc.appendChild(del);
      fila.appendChild(acc);
      lista.appendChild(fila);
    }
    sec.appendChild(lista);
    return sec;
  }

  #cola(e) {
    const sec = el('section', 'dj-cola');
    const cab = el('div', 'dj-cab');
    cab.appendChild(el('h3', '', `Cola (${e.cola.ids.length})`));
    const vaciar = el('button', 'boton-secundario', 'Vaciar'); vaciar.disabled = e.cola.vacia;
    vaciar.onclick = () => this.#dj.vaciarCola();
    cab.appendChild(vaciar);
    sec.appendChild(cab);
    const lista = el('div', 'dj-lista');
    if (e.cola.vacia) lista.appendChild(el('p', 'ayuda', 'Las canciones en cola se mezclan solas cuando el automix está activo, en este orden.'));
    e.cola.ids.forEach((id, i) => {
      let p; try { p = this.#dj.pista(id); } catch { return; }
      const fila = el('div', 'dj-pista');
      fila.appendChild(el('span', 'dj-num', String(i + 1)));
      const txt = el('div', 'dj-pista-texto');
      txt.appendChild(el('div', 'dj-pista-titulo', p.titulo));
      txt.appendChild(el('div', 'dj-pista-sub', [p.artista, p.bpm ? `${p.bpm} BPM` : null].filter(Boolean).join(' · ')));
      fila.appendChild(txt);
      const acc = el('div', 'dj-pista-acciones');
      const up = el('button', 'boton-icono', '↑'); up.disabled = i === 0; up.onclick = () => this.#dj.moverEnCola(id, i - 1);
      const dn = el('button', 'boton-icono', '↓'); dn.disabled = i === e.cola.ids.length - 1; dn.onclick = () => this.#dj.moverEnCola(id, i + 1);
      const rm = el('button', 'boton-icono', '✕'); rm.onclick = () => this.#dj.desencolar(id);
      acc.append(up, dn, rm);
      fila.appendChild(acc);
      lista.appendChild(fila);
    });
    sec.appendChild(lista);
    return sec;
  }

  // ------------------------------------------------------------ animación
  #iniciarAnimacion() {
    const paso = (t) => {
      this.#animacion = requestAnimationFrame(paso);
      if (t - this.#ultimoTick > 250) { this.#ultimoTick = t; this.#dj.tick().catch((x) => console.error(x)); }
      const e = this.#dj.estado();
      for (const id of ['A', 'B']) {
        const d = e.decks[id];
        const sec = this.#raiz.querySelector(`.deck--${id}`);
        if (!sec) continue;
        const pos = this.#dj.posicion(id);
        sec.querySelector('.deck-pos').textContent = fmt(pos);
        sec.querySelector('.deck-rest').textContent = d.pista ? `-${fmt(d.pista.duracionSeg - pos)}` : '';
        this.#dibujarOnda(id, d, pos);
        const rec = this.#raiz.querySelector('.dj-rec-tiempo');
        if (rec) rec.textContent = fmt(this.#dj.duracionGrabacionSeg());
        const vu = this.#raiz.querySelector(`.dj-vu--${id} .dj-vu-barra`);
        if (vu) vu.style.height = `${Math.round(Math.min(1, this.#dj.motor.nivel(id) * 1.4) * 100)}%`;
      }
    };
    this.#animacion = requestAnimationFrame(paso);
  }

  #dibujarOnda(id, d, pos) {
    const c = this.#canvas[id];
    if (!c || !c.isConnected) return;
    const g = c.getContext('2d');
    const W = c.width; const H = c.height;
    const estilo = getComputedStyle(c);
    g.fillStyle = estilo.getPropertyValue('--onda-fondo') || '#1d1f27';
    g.fillRect(0, 0, W, H);
    if (!d.pista) return;
    const picos = this.#dj.motor.formaDeOnda(id, 300);
    const dur = d.pista.duracionSeg || 1;
    const xPos = (pos / dur) * W;
    g.fillStyle = estilo.getPropertyValue('--onda-color') || '#3a86ff';
    const w = W / picos.length;
    for (let i = 0; i < picos.length; i++) {
      const h = Math.max(2, picos[i] * (H - 6));
      g.globalAlpha = i * w < xPos ? 0.45 : 1;
      g.fillRect(i * w, (H - h) / 2, Math.max(1, w - 1), h);
    }
    g.globalAlpha = 1;
    for (const cue of d.pista.cues) {
      g.fillStyle = '#ffbe0b';
      const x = (cue.seg / dur) * W;
      g.fillRect(x - 1, 0, 2, H);
      g.fillText(String(cue.num), x + 3, 10);
    }
    if (d.loopBeats) { g.fillStyle = 'rgba(6,214,160,0.25)'; g.fillRect(xPos, 0, (d.segundosDeLoop() / dur) * W, H); }
    g.fillStyle = '#e63946';
    g.fillRect(xPos - 1, 0, 2, H);
  }

  // ------------------------------------------------------------ importación
  #importarArchivos() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'audio/*'; input.multiple = true;
    input.onchange = async () => {
      const archivos = [...input.files];
      let n = 0;
      const aviso = this.#aviso(`Analizando 0/${archivos.length}…`);
      for (const f of archivos) {
        try { await this.#dj.importarArchivo(f, f.name); } catch (x) { this.#error(x); }
        n += 1; aviso.textContent = `Analizando ${n}/${archivos.length}…`;
      }
      aviso.remove();
    };
    input.click();
  }

  #importarVirtualDJ() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xml,application/xml,text/xml';
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      try {
        const r = await this.#dj.importarAnalisisVirtualDJ(await f.text());
        this.#aviso(`VirtualDJ: ${r.aplicados} canciones actualizadas (${r.disponibles} en el archivo)`, 4000);
      } catch (x) { this.#error(x); }
    };
    input.click();
  }

  #aviso(texto, ms = 0) {
    const n = el('div', 'aviso-flotante', texto);
    document.body.appendChild(n);
    if (ms) setTimeout(() => n.remove(), ms);
    return n;
  }

  #error(e) {
    console.error(e);
    const n = el('div', 'error-flotante', e?.message || String(e));
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3500);
  }
}

function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto !== undefined) n.textContent = texto;
  return n;
}
