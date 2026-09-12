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
import { TiposEvento } from './dominio/eventos.js';
import { DJAPI } from './dj/aplicacion/DJAPI.js';
import { MotorWebAudio } from './dj/adaptadores/MotorWebAudio.js';
import { AnalizadorBpm } from './dj/adaptadores/AnalizadorBpm.js';
import { RepositorioBibliotecaIndexedDB } from './dj/adaptadores/RepositorioBibliotecaIndexedDB.js';
import { ImportadorVirtualDJ } from './dj/adaptadores/ImportadorVirtualDJ.js';
import { UIDJ } from './dj/adaptadores/UIDJ.js';
import { GrabadorSesionWebAudio } from './dj/adaptadores/GrabadorSesionWebAudio.js';

export const VERSION_APP = '3.0.1';
const CLAVE_MODO = 'cabina.modo';

const BANCOS_FABRICA = {
  Golpes: { color: '#e63946' },
  Efectos: { color: '#2a9d8f' },
  Clásicos: { color: '#ffbe0b' },
  Reacciones: { color: '#6a4c93' },
  Calle: { color: '#f4a261' },
  Camas: { color: '#457b9d', esCama: true },
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
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin offline extendido, la app sigue funcionando */ });
}

/** Selector Pads / DJ / Ambos (recordado por dispositivo). */
function instalarSelectorDeModo() {
  const botones = [...document.querySelectorAll('.modos .modo')];
  const pads = document.getElementById('app');
  const dj = document.getElementById('dj');
  let modo = 'pads';
  try { modo = localStorage.getItem(CLAVE_MODO) || 'pads'; } catch { /* */ }
  const aplicar = (m) => {
    modo = m;
    pads.hidden = m === 'dj';
    dj.hidden = m === 'pads';
    document.body.dataset.modo = m;
    for (const b of botones) b.classList.toggle('modo--activo', b.dataset.modo === m);
    try { localStorage.setItem(CLAVE_MODO, m); } catch { /* */ }
  };
  for (const b of botones) b.onclick = () => aplicar(b.dataset.modo);
  aplicar(modo);
}

async function iniciar() {
  // Un solo AudioContext para pads y decks: misma salida, mismo permiso de autoplay.
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const contexto = new Ctx();
  // Nodo final por el que pasa TODO (pads + decks): es lo que se graba en "grabar sesión".
  const salida = contexto.createGain();
  salida.connect(contexto.destination);

  // --- consola de pads ---
  const repositorio = new RepositorioIndexedDB();
  const reproductor = new ReproductorWebAudio({ contexto, salida });
  const analizador = new AnalizadorOffline();
  const empaquetador = new EmpaquetadorJSON();
  const reloj = new RelojSistema();
  const grabadora = new GrabadoraMediaRecorder();
  const consola = new ConsolaAPI({ repositorio, reproductor, analizador, empaquetador, reloj, grabadora });

  // --- módulo DJ ---
  const motor = new MotorWebAudio({ contexto, salida });
  const dj = new DJAPI({
    motor,
    repositorio: new RepositorioBibliotecaIndexedDB(),
    analizador: new AnalizadorBpm({ contexto }),
    importador: new ImportadorVirtualDJ(),
    reloj: { ahora: () => Date.now() },
    grabadorSesion: new GrabadorSesionWebAudio({ contexto, fuente: salida }),
  });

  window.__cabina = consola;
  window.__dj = dj;

  const estadoInicial = await consola.iniciar();
  await dj.iniciar();

  const ui = new UITactil(document.getElementById('app'), consola);
  new AdaptadorTeclado(consola);
  const uiDj = new UIDJ(document.getElementById('dj'), dj);
  instalarSelectorDeModo();

  // Talkover: cuando suena un pad que no es cama, la música de los decks baja
  // (mismo factor de ducking de los ajustes) mientras dura el pad.
  consola.suscribir(TiposEvento.PAD_DISPARADO, ({ bancoId, soundId }) => {
    const t = consola.estado();
    try {
      if (t.bancoPorId(bancoId).esCama || t.ajustes.ducking >= 1) return;
      const s = t.buscarSonido(soundId)?.sonido;
      const ms = s && !s.modo.esLoop() ? Math.round(s.duracionMs / s.tasaReproduccion) : 0;
      dj.atenuar(t.ajustes.ducking, ms);
    } catch { /* */ }
  });
  consola.suscribir(TiposEvento.REPRODUCCION_DETENIDA, ({ todo }) => { if (todo) motor.restaurar(); });

  const primeraVez = estadoInicial.bancos.length === 0;
  const cargando = document.getElementById('cargando');
  if (primeraVez && cargando) cargando.hidden = false;
  await instalarSonidosDeFabrica(consola);
  if (cargando) cargando.hidden = true;

  ui.render();
  uiDj.render();
  registrarServiceWorker();

  const reanudar = () => { if (contexto.state === 'suspended') contexto.resume(); };
  window.addEventListener('pointerdown', reanudar);
  window.addEventListener('keydown', reanudar);
}

iniciar().catch((e) => {
  console.error(e);
  const raiz = document.getElementById('app');
  if (raiz) raiz.innerHTML = `<p style="color:#ff6b6b;padding:24px">Error al iniciar: ${e.message}</p>`;
});
