import { ConsolaAPI } from './aplicacion/ConsolaAPI.js';
import { ReproductorWebAudio } from './adaptadores/audio/ReproductorWebAudio.js';
import { AnalizadorOffline } from './adaptadores/audio/AnalizadorOffline.js';
import { GrabadoraMediaRecorder } from './adaptadores/audio/GrabadoraMediaRecorder.js';
import { RepositorioIndexedDB } from './adaptadores/almacenamiento/RepositorioIndexedDB.js';
import { EmpaquetadorJSON } from './adaptadores/empaquetado/EmpaquetadorJSON.js';
import { RelojSistema } from './adaptadores/reloj/RelojSistema.js';
import { UITactil } from './adaptadores/ui/UITactil.js';
import { AdaptadorTeclado } from './adaptadores/teclado/AdaptadorTeclado.js';
import { catalogoDeFabrica, audioBufferAWav } from './adaptadores/audio/SonidosDeFabrica.js';

export const VERSION_APP = '2.0.0';

const BANCOS_FABRICA = {
  Golpes: { color: '#e63946' },
  Efectos: { color: '#2a9d8f' },
  Clásicos: { color: '#ffbe0b' },
  Reacciones: { color: '#6a4c93' },
  Camas: { color: '#457b9d', esCama: true }, // vacío de fábrica: aquí van tus loops de fondo
};

async function instalarSonidosDeFabrica(consola) {
  const catalogo = catalogoDeFabrica();
  let tablero = consola.estado();
  for (const [nombreBanco, def] of Object.entries(BANCOS_FABRICA)) {
    if (!tablero.bancoPorNombre(nombreBanco)) {
      tablero = await consola.crearBanco(nombreBanco, def.color, { esCama: Boolean(def.esCama) });
    }
  }
  for (const [nombreBanco, sonidos] of Object.entries(catalogo)) {
    const banco = tablero.bancoPorNombre(nombreBanco);
    if (!banco) continue;
    let slot = 0;
    for (const def of sonidos) {
      const yaExiste = banco.listaSonidos().some((s) => s.nombre === def.nombre);
      if (yaExiste) { slot++; continue; }
      let blob;
      if (def.archivo) {
        const respuesta = await fetch(def.archivo);
        blob = await respuesta.blob();
      } else {
        const buffer = await def.generar();
        blob = audioBufferAWav(buffer);
      }
      tablero = await consola.agregarSonido({
        bancoId: banco.id, slot, nombre: def.nombre, blob,
        modo: def.modo, color: def.color, emoji: def.emoji, teclaRapida: def.tecla, origen: 'FABRICA',
      });
      slot++;
    }
  }
  return tablero;
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Solo en http(s) del mismo origen; en hosts que no lo permitan simplemente no se registra.
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin offline extendido, la app sigue funcionando */ });
}

async function iniciar() {
  const repositorio = new RepositorioIndexedDB();
  const reproductor = new ReproductorWebAudio();
  const analizador = new AnalizadorOffline();
  const empaquetador = new EmpaquetadorJSON();
  const reloj = new RelojSistema();
  const grabadora = new GrabadoraMediaRecorder();

  const consola = new ConsolaAPI({ repositorio, reproductor, analizador, empaquetador, reloj, grabadora });
  window.__cabina = consola; // acceso desde la consola del navegador, útil para depurar

  const estadoInicial = await consola.iniciar();

  const raiz = document.getElementById('app');
  const ui = new UITactil(raiz, consola);
  new AdaptadorTeclado(consola);

  // La instalación de fábrica corre siempre y es idempotente: los tableros
  // que ya existían reciben los bancos/sonidos nuevos de cada versión.
  const primeraVez = estadoInicial.bancos.length === 0;
  const cargando = document.getElementById('cargando');
  if (primeraVez && cargando) cargando.hidden = false;
  await instalarSonidosDeFabrica(consola);
  if (cargando) cargando.hidden = true;

  ui.render();
  registrarServiceWorker();

  const reanudar = () => { reproductor.reanudar(); };
  window.addEventListener('pointerdown', reanudar, { once: true });
  window.addEventListener('keydown', reanudar, { once: true });
}

iniciar().catch((e) => {
  console.error(e);
  const raiz = document.getElementById('app');
  if (raiz) raiz.innerHTML = `<p style="color:#ff6b6b;padding:24px">Error al iniciar: ${e.message}</p>`;
});
