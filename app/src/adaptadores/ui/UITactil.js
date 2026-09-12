import { TiposEvento } from '../../dominio/eventos.js';

const ETIQUETA_MODO = {
  UN_TIRO: '1',
  LOOP: '∞',
  MANTENER: '⏸',
  EXCLUSIVO: '◎',
};

/**
 * Adaptador primario: dibuja el tablero y traduce toques/gestos a llamadas
 * de la fachada ConsolaAPI. No contiene lógica de negocio: solo lee
 * `consola.estado()` y llama métodos.
 */
export class UITactil {
  #raiz;
  #consola;
  #onSubirArchivo;

  constructor(raiz, consola, { onSubirArchivo } = {}) {
    this.#raiz = raiz;
    this.#consola = consola;
    this.#onSubirArchivo = onSubirArchivo;

    for (const tipo of Object.values(TiposEvento)) {
      consola.suscribir(tipo, () => this.render());
    }
  }

  render() {
    const tablero = this.#consola.estado();
    this.#raiz.innerHTML = '';
    this.#raiz.appendChild(this.#barraSuperior(tablero));

    const contenedorBancos = document.createElement('div');
    contenedorBancos.className = 'bancos';
    for (const banco of tablero.bancos) {
      contenedorBancos.appendChild(this.#renderBanco(banco));
    }
    contenedorBancos.appendChild(this.#botonNuevoBanco());
    this.#raiz.appendChild(contenedorBancos);
  }

  #barraSuperior(tablero) {
    const barra = document.createElement('div');
    barra.className = 'barra-superior';

    const panico = document.createElement('button');
    panico.className = 'boton-panico';
    panico.textContent = '⏹ DETENER TODO';
    panico.onclick = () => this.#consola.detenerTodo();
    barra.appendChild(panico);

    const volLabel = document.createElement('label');
    volLabel.className = 'control-volumen';
    volLabel.textContent = 'Volumen';
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0'; vol.max = '1'; vol.step = '0.01';
    vol.value = String(tablero.volumenMaestro);
    vol.oninput = () => this.#consola.fijarVolumenMaestro(Number(vol.value));
    volLabel.appendChild(vol);
    barra.appendChild(volLabel);

    const exportar = document.createElement('button');
    exportar.className = 'boton-secundario';
    exportar.textContent = '⬇ Respaldo';
    exportar.onclick = () => this.#exportar();
    barra.appendChild(exportar);

    const importarInput = document.createElement('input');
    importarInput.type = 'file';
    importarInput.accept = 'application/json,.json';
    importarInput.style.display = 'none';
    importarInput.onchange = () => {
      if (importarInput.files[0]) this.#consola.importarTablero(importarInput.files[0], { reemplazar: false });
    };
    const importar = document.createElement('button');
    importar.className = 'boton-secundario';
    importar.textContent = '⬆ Restaurar';
    importar.onclick = () => importarInput.click();
    barra.appendChild(importar);
    barra.appendChild(importarInput);

    return barra;
  }

  #renderBanco(banco) {
    const seccion = document.createElement('section');
    seccion.className = 'banco';
    seccion.style.setProperty('--color-banco', banco.color);

    const titulo = document.createElement('div');
    titulo.className = 'banco-titulo';
    const h2 = document.createElement('h2');
    h2.textContent = banco.nombre;
    titulo.appendChild(h2);

    const ruleta = document.createElement('button');
    ruleta.className = 'boton-ruleta';
    ruleta.textContent = '🎲';
    ruleta.title = 'Sonido aleatorio de este banco';
    ruleta.onclick = () => this.#consola.padAleatorio(banco.id);
    titulo.appendChild(ruleta);

    const agregar = document.createElement('button');
    agregar.className = 'boton-agregar';
    agregar.textContent = '+ Sonido';
    agregar.onclick = () => this.#subirArchivo(banco);
    titulo.appendChild(agregar);

    seccion.appendChild(titulo);

    const grilla = document.createElement('div');
    grilla.className = 'grilla';
    const maxSlot = Math.max(7, ...Object.keys(banco.slots).map(Number), -1);
    for (let slot = 0; slot <= maxSlot; slot++) {
      grilla.appendChild(this.#renderPad(banco, slot));
    }
    seccion.appendChild(grilla);
    return seccion;
  }

  #renderPad(banco, slot) {
    const sonido = banco.sonidoEn(slot);
    const pad = document.createElement('button');
    pad.className = sonido ? 'pad' : 'pad pad-vacio';
    if (sonido) {
      pad.style.background = sonido.color;
      pad.innerHTML = `
        <span class="pad-nombre">${escaparHTML(sonido.nombre)}</span>
        <span class="pad-modo">${ETIQUETA_MODO[sonido.modo.valor] || ''}</span>
        ${sonido.teclaRapida ? `<span class="pad-tecla">${sonido.teclaRapida.valor}</span>` : ''}
      `;
      const disparar = (presionado) => this.#consola.dispararPad(banco.id, slot, { presionado }).catch((e) => this.#error(e));
      pad.addEventListener('pointerdown', (ev) => { ev.preventDefault(); disparar(true); });
      pad.addEventListener('pointerup', () => disparar(false));
      pad.addEventListener('pointercancel', () => disparar(false));
      pad.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.#editarSonido(sonido); });
    } else {
      pad.textContent = '+';
      pad.onclick = () => this.#subirArchivo(banco, slot);
    }
    return pad;
  }

  #botonNuevoBanco() {
    const boton = document.createElement('button');
    boton.className = 'boton-nuevo-banco';
    boton.textContent = '+ Nueva categoría';
    boton.onclick = async () => {
      const nombre = prompt('Nombre de la nueva categoría (ej. Jingles, Camas, Mis sonidos):');
      if (nombre && nombre.trim()) {
        const color = colorAleatorio();
        try { await this.#consola.crearBanco(nombre.trim(), color); } catch (e) { this.#error(e); }
      }
    };
    return boton;
  }

  #subirArchivo(banco, slot) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const archivo = input.files[0];
      if (!archivo) return;
      const nombre = archivo.name.replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 40);
      try {
        await this.#consola.agregarSonido({ bancoId: banco.id, slot, nombre, blob: archivo });
      } catch (e) { this.#error(e); }
    };
    input.click();
  }

  async #editarSonido(sonido) {
    const nuevoNombre = prompt('Nombre del sonido:', sonido.nombre);
    if (nuevoNombre === null) return;
    const modos = ['UN_TIRO', 'LOOP', 'MANTENER', 'EXCLUSIVO'];
    const modoTexto = prompt(`Modo (${modos.join(' / ')}):`, sonido.modo.valor);
    const tecla = prompt('Tecla rápida (una letra, vacío = ninguna):', sonido.teclaRapida?.valor || '');
    const borrar = confirm('¿Eliminar este sonido? Aceptar = sí, Cancelar = solo editar') && false; // ver botón dedicado abajo
    try {
      const cambios = { nombre: nuevoNombre.trim() || sonido.nombre };
      if (modoTexto && modos.includes(modoTexto.toUpperCase())) cambios.modo = modoTexto.toUpperCase();
      cambios.teclaRapida = tecla && tecla.trim() ? tecla.trim() : null;
      await this.#consola.editarSonido(sonido.id, cambios);
      if (borrar) await this.#consola.eliminarSonido(sonido.id);
    } catch (e) { this.#error(e); }
  }

  async #exportar() {
    const blob = await this.#consola.exportarTablero();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cabina-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  #error(e) {
    console.error(e);
    const barra = document.createElement('div');
    barra.className = 'error-flotante';
    barra.textContent = e.message || String(e);
    document.body.appendChild(barra);
    setTimeout(() => barra.remove(), 3500);
  }
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function colorAleatorio() {
  const paleta = ['#e63946', '#f1a208', '#2a9d8f', '#457b9d', '#8338ec', '#ff006e', '#3a86ff', '#06d6a0', '#fb5607', '#ffbe0b'];
  return paleta[Math.floor(Math.random() * paleta.length)];
}
