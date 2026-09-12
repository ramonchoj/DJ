import { TiposEvento } from '../../dominio/eventos.js';
import { ModoDisparo } from '../../dominio/valores/ModoDisparo.js';

const ETIQUETA_MODO = { UN_TIRO: '1', LOOP: '∞', MANTENER: '⏸', EXCLUSIVO: '◎' };
const NOMBRE_MODO = {
  UN_TIRO: 'Un tiro (suena completo)',
  LOOP: 'Loop (repite hasta volver a tocar)',
  MANTENER: 'Mantener (suena mientras presionas)',
  EXCLUSIVO: 'Exclusivo (corta otras camas del banco)',
};
const PALETA = ['#e63946', '#f1a208', '#2a9d8f', '#457b9d', '#8338ec', '#ff006e', '#3a86ff', '#06d6a0', '#fb5607', '#ffbe0b', '#8ac926', '#6a4c93'];
const CLAVE_PESTANA = 'cabina.pestana';

/**
 * Adaptador primario: dibuja el tablero y traduce toques/gestos a llamadas
 * de la fachada ConsolaAPI. No contiene lógica de negocio: solo lee
 * `consola.estado()` y llama métodos.
 */
export class UITactil {
  #raiz;
  #consola;
  #pestana = 'todo';
  #busqueda = '';
  #arrastrando = null; // soundId en arrastre (escritorio)
  #padsPorSonido = new Map();
  #animacion = null;

  constructor(raiz, consola) {
    this.#raiz = raiz;
    this.#consola = consola;
    try { this.#pestana = localStorage.getItem(CLAVE_PESTANA) || 'todo'; } catch { /* sin storage */ }
    for (const tipo of [TiposEvento.TABLERO_CAMBIADO, TiposEvento.SONIDO_AGREGADO, TiposEvento.SONIDO_ELIMINADO, TiposEvento.BANCO_CREADO, TiposEvento.BANCO_ELIMINADO]) {
      consola.suscribir(tipo, () => this.render());
    }
    this.#iniciarAnimacion();
  }

  // ------------------------------------------------------------ render raíz
  render() {
    const tablero = this.#consola.estado();
    if (this.#pestana !== 'todo' && !tablero.bancos.some((b) => b.id === this.#pestana)) this.#pestana = 'todo';
    this.#raiz.innerHTML = '';
    this.#padsPorSonido = new Map();
    this.#raiz.appendChild(this.#barraSuperior(tablero));
    this.#raiz.appendChild(this.#pestanas(tablero));

    const contenido = document.createElement('div');
    contenido.className = 'bancos';
    if (this.#busqueda.trim()) {
      contenido.appendChild(this.#resultadosBusqueda(tablero));
    } else {
      const visibles = this.#pestana === 'todo' ? tablero.bancos : tablero.bancos.filter((b) => b.id === this.#pestana);
      for (const banco of visibles) contenido.appendChild(this.#renderBanco(banco, tablero));
      if (this.#pestana === 'todo') contenido.appendChild(this.#botonNuevoBanco());
    }
    this.#raiz.appendChild(contenido);
  }

  #barraSuperior(tablero) {
    const barra = el('div', 'barra-superior');

    const panico = el('button', 'boton-panico', '⏹ Detener todo');
    panico.onclick = () => this.#consola.detenerTodo();
    barra.appendChild(panico);

    const vu = el('div', 'vu', '');
    vu.title = 'Nivel de salida';
    vu.innerHTML = '<div class="vu-barra"></div>';
    barra.appendChild(vu);

    const volLabel = el('label', 'control-volumen', 'Volumen');
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.01';
    vol.value = String(tablero.volumenMaestro);
    vol.id = 'volumen-maestro';
    vol.oninput = () => this.#consola.fijarVolumenMaestro(Number(vol.value));
    volLabel.appendChild(vol);
    barra.appendChild(volLabel);

    const buscar = document.createElement('input');
    buscar.type = 'search'; buscar.placeholder = 'Buscar sonido…'; buscar.className = 'buscador'; buscar.id = 'buscador';
    buscar.value = this.#busqueda;
    buscar.oninput = () => { this.#busqueda = buscar.value; this.render(); document.getElementById('buscador')?.focus(); };
    barra.appendChild(buscar);

    const ajustes = el('button', 'boton-secundario', '⚙ Ajustes');
    ajustes.onclick = () => this.#dialogoAjustes(tablero);
    barra.appendChild(ajustes);

    const exportar = el('button', 'boton-secundario', '⬇ Respaldo');
    exportar.onclick = () => this.#exportar();
    barra.appendChild(exportar);

    const importarInput = document.createElement('input');
    importarInput.type = 'file'; importarInput.accept = 'application/json,.json'; importarInput.hidden = true;
    importarInput.onchange = () => { if (importarInput.files[0]) this.#consola.importarTablero(importarInput.files[0], { reemplazar: false }).catch((e) => this.#error(e)); };
    const importar = el('button', 'boton-secundario', '⬆ Restaurar');
    importar.onclick = () => importarInput.click();
    barra.appendChild(importar);
    barra.appendChild(importarInput);
    return barra;
  }

  #pestanas(tablero) {
    const nav = el('nav', 'pestanas');
    const crear = (id, texto, color) => {
      const b = el('button', 'pestana' + (this.#pestana === id ? ' pestana--activa' : ''), texto);
      if (color) b.style.setProperty('--color-pestana', color);
      b.onclick = () => { this.#pestana = id; try { localStorage.setItem(CLAVE_PESTANA, id); } catch { /* */ } this.render(); };
      return b;
    };
    nav.appendChild(crear('todo', 'Todo'));
    for (const banco of tablero.bancos) nav.appendChild(crear(banco.id, (banco.esCama ? '♫ ' : '') + banco.nombre, banco.color));
    return nav;
  }

  #resultadosBusqueda(tablero) {
    const seccion = el('section', 'banco banco--busqueda');
    const resultados = tablero.buscar(this.#busqueda);
    seccion.appendChild(el('h2', '', resultados.length ? `${resultados.length} resultado(s) para "${this.#busqueda}"` : `Nada coincide con "${this.#busqueda}"`));
    const grilla = el('div', 'grilla');
    for (const { banco, slot } of resultados) grilla.appendChild(this.#renderPad(banco, slot));
    seccion.appendChild(grilla);
    return seccion;
  }

  // ------------------------------------------------------------ bancos
  #renderBanco(banco, tablero) {
    const seccion = el('section', 'banco' + (banco.esCama ? ' banco--cama' : ''));
    seccion.style.setProperty('--color-banco', banco.color);
    seccion.dataset.bancoId = banco.id;

    const titulo = el('div', 'banco-titulo');
    titulo.appendChild(el('h2', '', (banco.esCama ? '♫ ' : '') + banco.nombre));
    if (banco.esCama) titulo.appendChild(el('span', 'insignia', 'cama musical'));

    const acciones = el('div', 'banco-acciones');
    const ruleta = el('button', 'boton-icono', '🎲'); ruleta.title = 'Sonido aleatorio de este banco';
    ruleta.onclick = () => this.#consola.padAleatorio(banco.id).catch((e) => this.#error(e));
    acciones.appendChild(ruleta);
    if (this.#consola.grabacionSoportada()) {
      const grabar = el('button', 'boton-icono', '🎙'); grabar.title = 'Grabar con el micrófono';
      grabar.onclick = () => this.#dialogoGrabar(banco);
      acciones.appendChild(grabar);
    }
    const agregar = el('button', 'boton-secundario', '+ Sonido');
    agregar.onclick = () => this.#subirArchivo(banco);
    acciones.appendChild(agregar);
    const menu = el('button', 'boton-icono', '⋯'); menu.title = 'Editar categoría';
    menu.onclick = () => this.#dialogoBanco(banco, tablero);
    acciones.appendChild(menu);
    titulo.appendChild(acciones);
    seccion.appendChild(titulo);

    const grilla = el('div', 'grilla');
    const maxSlot = Math.max(7, ...Object.keys(banco.slots).map(Number), -1);
    for (let slot = 0; slot <= maxSlot + 1; slot++) grilla.appendChild(this.#renderPad(banco, slot));
    seccion.appendChild(grilla);
    return seccion;
  }

  #renderPad(banco, slot) {
    const sonido = banco.sonidoEn(slot);
    const pad = document.createElement('button');
    pad.className = sonido ? 'pad' : 'pad pad-vacio';
    pad.dataset.bancoId = banco.id;
    pad.dataset.slot = String(slot);

    // destino de arrastre (escritorio)
    pad.addEventListener('dragover', (ev) => { if (this.#arrastrando) { ev.preventDefault(); pad.classList.add('pad--destino'); } });
    pad.addEventListener('dragleave', () => pad.classList.remove('pad--destino'));
    pad.addEventListener('drop', (ev) => {
      ev.preventDefault(); pad.classList.remove('pad--destino');
      const id = this.#arrastrando; this.#arrastrando = null;
      if (id) this.#consola.moverSonido(id, banco.id, slot).catch((e) => this.#error(e));
    });

    if (!sonido) {
      pad.textContent = '+';
      pad.title = 'Agregar sonido aquí';
      pad.onclick = () => this.#subirArchivo(banco, slot);
      return pad;
    }

    pad.style.background = sonido.color;
    pad.innerHTML = `
      ${sonido.emoji ? `<span class="pad-emoji">${escaparHTML(sonido.emoji)}</span>` : ''}
      <span class="pad-nombre">${escaparHTML(sonido.nombre)}</span>
      <span class="pad-modo" title="${NOMBRE_MODO[sonido.modo.valor]}">${ETIQUETA_MODO[sonido.modo.valor] || ''}</span>
      ${sonido.teclaRapida ? `<span class="pad-tecla">${sonido.teclaRapida.valor}</span>` : ''}
      ${sonido.tono ? `<span class="pad-tono">${sonido.tono > 0 ? '+' : ''}${sonido.tono}</span>` : ''}
      <span class="pad-progreso"></span>
    `;
    pad.draggable = true;
    pad.addEventListener('dragstart', (ev) => { this.#arrastrando = sonido.id; ev.dataTransfer.effectAllowed = 'move'; pad.classList.add('pad--arrastrando'); });
    pad.addEventListener('dragend', () => { this.#arrastrando = null; pad.classList.remove('pad--arrastrando'); });

    const disparar = (presionado) => this.#consola.dispararPad(banco.id, slot, { presionado }).catch((e) => this.#error(e));
    pad.addEventListener('pointerdown', (ev) => { if (ev.button === 0) { ev.preventDefault(); disparar(true); } });
    pad.addEventListener('pointerup', () => disparar(false));
    pad.addEventListener('pointercancel', () => disparar(false));
    pad.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.#dialogoSonido(sonido, banco); });
    let temporizador = null;
    pad.addEventListener('touchstart', () => { temporizador = setTimeout(() => this.#dialogoSonido(sonido, banco), 600); }, { passive: true });
    pad.addEventListener('touchend', () => clearTimeout(temporizador));
    pad.addEventListener('touchmove', () => clearTimeout(temporizador));

    const lista = this.#padsPorSonido.get(sonido.id) || [];
    lista.push(pad);
    this.#padsPorSonido.set(sonido.id, lista);
    return pad;
  }

  #botonNuevoBanco() {
    const boton = el('button', 'boton-nuevo-banco', '+ Nueva categoría');
    boton.onclick = () => this.#dialogoBanco(null, this.#consola.estado());
    return boton;
  }

  // ------------------------------------------------------------ animación (sonando + VU)
  #iniciarAnimacion() {
    let ultimo = 0;
    const paso = (t) => {
      this.#animacion = requestAnimationFrame(paso);
      if (t - ultimo < 80) return;
      ultimo = t;
      const activos = this.#consola.activos();
      const sonando = new Map();
      for (const a of activos) {
        const prev = sonando.get(a.soundId);
        if (!prev || a.progreso > prev) sonando.set(a.soundId, a.progreso ?? 0);
      }
      for (const [soundId, pads] of this.#padsPorSonido) {
        const p = sonando.get(soundId);
        for (const pad of pads) {
          pad.classList.toggle('pad--sonando', p !== undefined);
          pad.style.setProperty('--progreso', p === undefined ? '0' : String(Math.max(0.02, p)));
        }
      }
      const vu = this.#raiz.querySelector('.vu-barra');
      if (vu) vu.style.width = `${Math.round(Math.min(1, this.#consola.nivel() * 1.4) * 100)}%`;
    };
    this.#animacion = requestAnimationFrame(paso);
  }

  // ------------------------------------------------------------ diálogos
  #dialogo(titulo, cuerpoHTML, { onGuardar, onEliminar, textoGuardar = 'Guardar' } = {}) {
    document.querySelector('dialog.dlg')?.remove();
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `
      <form method="dialog" class="dlg-form">
        <h3>${escaparHTML(titulo)}</h3>
        <div class="dlg-cuerpo">${cuerpoHTML}</div>
        <div class="dlg-acciones">
          ${onEliminar ? '<button type="button" class="boton-peligro" data-accion="eliminar">Eliminar</button>' : ''}
          <span class="espacio"></span>
          <button type="button" class="boton-secundario" data-accion="cancelar">Cancelar</button>
          ${onGuardar ? `<button type="submit" class="boton-primario" data-accion="guardar">${escaparHTML(textoGuardar)}</button>` : ''}
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-accion="cancelar"]').onclick = () => dlg.close();
    if (onEliminar) dlg.querySelector('[data-accion="eliminar"]').onclick = async () => {
      if (confirm('¿Eliminar? Esta acción no se puede deshacer.')) { try { await onEliminar(); dlg.close(); } catch (e) { this.#error(e); } }
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      try { await onGuardar?.(new FormData(form), form); dlg.close(); } catch (e) { this.#error(e); }
    };
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    return dlg;
  }

  #dialogoSonido(sonido, banco) {
    const tablero = this.#consola.estado();
    const opcionesBanco = tablero.bancos.map((b) => `<option value="${b.id}" ${b.id === banco.id ? 'selected' : ''}>${escaparHTML(b.nombre)}</option>`).join('');
    const opcionesModo = ModoDisparo.valores().map((m) => `<option value="${m}" ${sonido.modo.valor === m ? 'selected' : ''}>${NOMBRE_MODO[m]}</option>`).join('');
    const paleta = PALETA.map((c) => `<label class="muestra" style="--c:${c}"><input type="radio" name="color" value="${c}" ${sonido.color === c ? 'checked' : ''}></label>`).join('');
    const slotActual = banco.slotDe(sonido.id);
    this.#dialogo(`Editar "${sonido.nombre}"`, `
      <div class="fila"><label for="f-nombre">Nombre</label><input id="f-nombre" name="nombre" value="${escaparHTML(sonido.nombre)}" maxlength="60" required></div>
      <div class="fila"><label for="f-emoji">Emoji</label><input id="f-emoji" name="emoji" value="${escaparHTML(sonido.emoji)}" maxlength="4" placeholder="📯"></div>
      <div class="fila"><label>Color</label><div class="paleta">${paleta}</div></div>
      <div class="fila"><label for="f-modo">Modo</label><select id="f-modo" name="modo">${opcionesModo}</select></div>
      <div class="fila"><label for="f-tecla">Tecla</label><input id="f-tecla" name="tecla" value="${sonido.teclaRapida?.valor || ''}" maxlength="1" placeholder="—" style="width:4em;text-transform:uppercase"></div>
      <div class="fila"><label for="f-volumen">Volumen <output>${Math.round(sonido.volumen * 100)}%</output></label><input id="f-volumen" name="volumen" type="range" min="0" max="1.5" step="0.05" value="${sonido.volumen}" oninput="this.previousElementSibling.querySelector('output').value=Math.round(this.value*100)+'%'"></div>
      <div class="fila"><label for="f-tono">Tono <output>${sonido.tono > 0 ? '+' : ''}${sonido.tono} st</output></label><input id="f-tono" name="tono" type="range" min="-12" max="12" step="1" value="${sonido.tono}" oninput="this.previousElementSibling.querySelector('output').value=(this.value>0?'+':'')+this.value+' st'"></div>
      <div class="fila fila--doble"><label for="f-banco">Mover a</label><select id="f-banco" name="banco">${opcionesBanco}</select><input id="f-slot" name="slot" type="number" min="0" max="63" value="${slotActual}" title="Posición"></div>
      <p class="ayuda">Probar: toca el pad y ajusta. Los cambios se guardan al pulsar Guardar.</p>
    `, {
      onGuardar: async (datos) => {
        const cambios = {
          nombre: datos.get('nombre'),
          emoji: datos.get('emoji'),
          color: datos.get('color') || sonido.color,
          modo: datos.get('modo'),
          teclaRapida: (datos.get('tecla') || '').trim() || null,
          volumen: Number(datos.get('volumen')),
          tono: Number(datos.get('tono')),
        };
        await this.#consola.editarSonido(sonido.id, cambios);
        const bancoDestino = datos.get('banco');
        const slotDestino = Number(datos.get('slot'));
        if (bancoDestino !== banco.id || slotDestino !== slotActual) {
          await this.#consola.moverSonido(sonido.id, bancoDestino, slotDestino);
        }
      },
      onEliminar: () => this.#consola.eliminarSonido(sonido.id),
    });
  }

  #dialogoBanco(banco, tablero) {
    const esNuevo = !banco;
    const color = banco?.color || PALETA[tablero.bancos.length % PALETA.length];
    const paleta = PALETA.map((c) => `<label class="muestra" style="--c:${c}"><input type="radio" name="color" value="${c}" ${color === c ? 'checked' : ''}></label>`).join('');
    const orden = tablero.bancos.map((b) => b.id);
    const idx = banco ? orden.indexOf(banco.id) : -1;
    this.#dialogo(esNuevo ? 'Nueva categoría' : `Categoría "${banco.nombre}"`, `
      <div class="fila"><label for="b-nombre">Nombre</label><input id="b-nombre" name="nombre" value="${escaparHTML(banco?.nombre || '')}" maxlength="40" placeholder="Jingles, Camas, Mis sonidos…" required></div>
      <div class="fila"><label>Color</label><div class="paleta">${paleta}</div></div>
      <div class="fila"><label for="b-cama"><input id="b-cama" name="esCama" type="checkbox" ${banco?.esCama ? 'checked' : ''}> Cama musical</label><span class="ayuda">Sus sonidos bajan solos cuando suena un golpe encima y no los corta el modo "uno a la vez".</span></div>
      ${esNuevo ? '' : `<div class="fila"><label>Orden</label><div class="orden"><button type="button" class="boton-secundario" data-mover="-1" ${idx <= 0 ? 'disabled' : ''}>↑ Subir</button><button type="button" class="boton-secundario" data-mover="1" ${idx >= orden.length - 1 ? 'disabled' : ''}>↓ Bajar</button></div></div>`}
    `, {
      textoGuardar: esNuevo ? 'Crear' : 'Guardar',
      onGuardar: async (datos) => {
        const cambios = { nombre: datos.get('nombre').trim(), color: datos.get('color') || color, esCama: datos.get('esCama') === 'on' };
        if (esNuevo) await this.#consola.crearBanco(cambios.nombre, cambios.color, { esCama: cambios.esCama });
        else await this.#consola.editarBanco(banco.id, cambios);
      },
      onEliminar: esNuevo ? null : () => this.#consola.eliminarBanco(banco.id),
    });
    if (!esNuevo) {
      document.querySelectorAll('dialog.dlg [data-mover]').forEach((btn) => {
        btn.onclick = async () => {
          const delta = Number(btn.dataset.mover);
          const nuevo = [...orden];
          const j = idx + delta;
          [nuevo[idx], nuevo[j]] = [nuevo[j], nuevo[idx]];
          await this.#consola.reordenarBancos(nuevo);
          document.querySelector('dialog.dlg')?.close();
        };
      });
    }
  }

  #dialogoAjustes(tablero) {
    const a = tablero.ajustes;
    this.#dialogo('Ajustes', `
      <div class="fila"><label for="a-uno"><input id="a-uno" name="unoALaVez" type="checkbox" ${a.unoALaVez ? 'checked' : ''}> Un sonido a la vez</label><span class="ayuda">Al tocar un pad se corta lo que estaba sonando (las camas musicales siguen).</span></div>
      <div class="fila"><label for="a-duck">Camas bajan al <output>${Math.round(a.ducking * 100)}%</output></label><input id="a-duck" name="ducking" type="range" min="0" max="1" step="0.05" value="${a.ducking}" oninput="this.previousElementSibling.querySelector('output').value=Math.round(this.value*100)+'%'"><span class="ayuda">Cuánto se atenúa la cama musical mientras suena un golpe encima (100% = no bajar).</span></div>
      <div class="fila"><label>Atajos</label><span class="ayuda">Esc = detener todo · letra = tecla rápida del pad · clic derecho o mantener presionado = editar · arrastrar = reordenar.</span></div>
    `, {
      onGuardar: (datos) => this.#consola.editarAjustes({ unoALaVez: datos.get('unoALaVez') === 'on', ducking: Number(datos.get('ducking')) }),
    });
  }

  async #dialogoGrabar(banco) {
    try { await this.#consola.iniciarGrabacion(); } catch (e) { this.#error(e); return; }
    const inicio = Date.now();
    const dlg = this.#dialogo('Grabando…', `
      <p class="grabando"><span class="punto-rojo"></span> <span class="cronometro">0.0 s</span></p>
      <div class="fila"><label for="g-nombre">Nombre del pad</label><input id="g-nombre" name="nombre" placeholder="Ej. Felicidades Ana" maxlength="60"></div>
      <p class="ayuda">Habla cerca del micrófono. Al pulsar "Detener y guardar" queda como un pad nuevo en "${escaparHTML(banco.nombre)}".</p>
    `, {
      textoGuardar: 'Detener y guardar',
      onGuardar: async (datos) => { await this.#consola.detenerGrabacion({ bancoId: banco.id, nombre: datos.get('nombre')?.trim() }); },
    });
    const crono = dlg.querySelector('.cronometro');
    const timer = setInterval(() => { if (!dlg.open) { clearInterval(timer); return; } crono.textContent = `${((Date.now() - inicio) / 1000).toFixed(1)} s`; }, 100);
    dlg.addEventListener('close', () => { clearInterval(timer); if (this.#consola.grabando()) this.#consola.cancelarGrabacion(); });
  }

  // ------------------------------------------------------------ utilidades
  #subirArchivo(banco, slot) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'audio/*'; input.multiple = slot === undefined;
    input.onchange = async () => {
      let s = slot;
      for (const archivo of input.files) {
        const nombre = archivo.name.replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 40);
        try {
          await this.#consola.agregarSonido({ bancoId: banco.id, slot: s, nombre, blob: archivo });
          s = undefined; // los siguientes van al primer slot libre
        } catch (e) { this.#error(e); }
      }
    };
    input.click();
  }

  async #exportar() {
    try {
      const blob = await this.#consola.exportarTablero();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `cabina-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { this.#error(e); }
  }

  #error(e) {
    console.error(e);
    const barra = el('div', 'error-flotante', e?.message || String(e));
    document.body.appendChild(barra);
    setTimeout(() => barra.remove(), 3500);
  }
}

function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}
