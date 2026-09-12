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
import { MotorYouTube } from './yt/adaptadores/MotorYouTube.js';
import { AnalizadorYouTube } from './yt/adaptadores/AnalizadorYouTube.js';
import { extraerVideoIds } from './yt/adaptadores/youtube.js';

export const VERSION_APP = '3.4.1';
const CLAVE_MODO = 'cabina.modo';

const BANCOS_FABRICA = {
  Golpes: { color: '#e63946' },
  Efectos: { color: '#2a9d8f' },
  Clásicos: { color: '#ffbe0b' },
  Reacciones: { color: '#6a4c93' },
  Calle: { color: '#f4a261' },
  Animales: { color: '#8ac926' },
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
      // Un sonido de fábrica puede reemplazar a otro anterior (p. ej. una
      // grabación real que sustituye a uno sintetizado): se borra el viejo
      // solo si sigue siendo de fábrica (si el usuario lo editó, se respeta).
      for (const viejo of def.reemplazaA || []) {
        const s = tablero.bancoPorNombre(nombreBanco)?.listaSonidos().find((x) => x.nombre === viejo && x.origen === 'FABRICA');
        if (s) tablero = await consola.eliminarSonido(s.id);
      }
      const bancoActual = tablero.bancoPorNombre(nombreBanco);
      const yaExiste = bancoActual.listaSonidos().some((s) => s.nombre === def.nombre);
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
        bancoId: bancoActual.id, slot: bancoActual.sonidoEn(slot) ? bancoActual.primerSlotLibre() : slot, nombre: def.nombre, blob,
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

/** Selector Pads / DJ / YouTube / Ambos (recordado por dispositivo). */
function instalarSelectorDeModo({ alEntrarYouTube }) {
  const botones = [...document.querySelectorAll('.modos .modo')];
  const pads = document.getElementById('app');
  const dj = document.getElementById('dj');
  const yt = document.getElementById('yt');
  let modo = 'pads';
  try { modo = localStorage.getItem(CLAVE_MODO) || 'pads'; } catch { /* */ }
  const aplicar = (m) => {
    modo = m;
    pads.hidden = m === 'dj';
    dj.hidden = m !== 'dj' && m !== 'ambos';
    yt.hidden = m !== 'youtube';
    if (m === 'youtube') alEntrarYouTube();
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

  // --- modo YouTube (se crea al entrar por primera vez; necesita internet) ---
  let djYt = null;
  const iniciarYouTube = async () => {
    if (djYt) return;
    const cont = document.getElementById('yt');
    cont.innerHTML = `
      <form class="yt-agregar" id="yt-agregar">
        <input id="yt-enlace" type="url" inputmode="url" autocomplete="off" placeholder="Pega aquí un enlace de YouTube y toca Agregar" aria-label="Enlace de YouTube">
        <button type="submit" class="boton-primario">+ Agregar</button>
        <span id="yt-estado" class="ayuda" aria-live="polite">Conectando con YouTube…</span>
      </form>
      <div class="yt-players">
        <div class="yt-player"><div class="yt-etiqueta">Deck A</div><div id="yt-player-a"></div></div>
        <div class="yt-player yt-player--previa"><div class="yt-etiqueta">Vista previa</div><div id="yt-player-previa"></div></div>
        <div class="yt-player"><div class="yt-etiqueta">Deck B</div><div id="yt-player-b"></div></div>
      </div>
      <p class="ayuda yt-nota">Los videos suenan en sus propios reproductores de YouTube (se necesita internet). Sin EQ ni forma de onda: el audio no sale de YouTube. Tempo solo en los pasos que permite YouTube. Al cargar un video en un deck se precargan ~90 s en silencio (barra tenue = buffer); con ⏬ se piden 2 min más.</p>
      <div id="yt-ui"></div>`;
    try {
      const motorYt = new MotorYouTube({ contenedorA: document.getElementById('yt-player-a'), contenedorB: document.getElementById('yt-player-b') });
      const estadoYt = document.getElementById('yt-estado');
      // No se bloquea la interfaz: la biblioteca y el campo de enlace sirven aunque los
      // reproductores tarden (internet lento). Cargar/analizar esperan solos a que estén.
      motorYt.preparar().then(() => { estadoYt.textContent = ''; }).catch((e) => { estadoYt.textContent = e.message; });
      djYt = new DJAPI({
        motor: motorYt,
        repositorio: new RepositorioBibliotecaIndexedDB({ nombre: 'cabina-yt' }),
        analizador: new AnalizadorYouTube({ contenedor: document.getElementById('yt-player-previa') }),
        importador: null,
        reloj: { ahora: () => Date.now() },
        precargaAutomaticaSeg: 90, // internet lento: llenar buffer al cargar en el deck
      });
      window.__djYt = djYt;
      await djYt.iniciar();
      await djYt.fijarBeatmatch(false);
      const uiYt = new UIDJ(document.getElementById('yt-ui'), djYt, { fuente: 'youtube', extraerIds: extraerVideoIds });
      uiYt.render();
      const formYt = document.getElementById('yt-agregar'); const campoYt = document.getElementById('yt-enlace');
      formYt.addEventListener('submit', (ev) => { ev.preventDefault(); const t = campoYt.value; campoYt.value = ''; uiYt.importarEnlaces(t); });
      consola.suscribir(TiposEvento.PAD_DISPARADO, ({ bancoId, soundId }) => {
        const t = consola.estado();
        try {
          if (t.bancoPorId(bancoId).esCama || t.ajustes.ducking >= 1) return;
          const s = t.buscarSonido(soundId)?.sonido;
          djYt.atenuar(t.ajustes.ducking, s && !s.modo.esLoop() ? Math.round(s.duracionMs / s.tasaReproduccion) : 0);
        } catch { /* */ }
      });
      consola.suscribir(TiposEvento.REPRODUCCION_DETENIDA, ({ todo }) => { if (todo) motorYt.restaurar(); });
    } catch (e) {
      console.error(e);
      cont.innerHTML = `<p class="ayuda" style="padding:24px">${e.message || 'No se pudo iniciar YouTube.'}</p>`;
    }
  };
  instalarSelectorDeModo({ alEntrarYouTube: iniciarYouTube });

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
