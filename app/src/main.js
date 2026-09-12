import { ConsolaAPI } from './aplicacion/ConsolaAPI.js';
import { ReproductorWebAudio } from './adaptadores/audio/ReproductorWebAudio.js';
import { AnalizadorOffline } from './adaptadores/audio/AnalizadorOffline.js';
import { RepositorioIndexedDB } from './adaptadores/almacenamiento/RepositorioIndexedDB.js';
import { EmpaquetadorJSON } from './adaptadores/empaquetado/EmpaquetadorJSON.js';
import { RelojSistema } from './adaptadores/reloj/RelojSistema.js';
import { UITactil } from './adaptadores/ui/UITactil.js';
import { AdaptadorTeclado } from './adaptadores/teclado/AdaptadorTeclado.js';
import { catalogoDeFabrica, audioBufferAWav } from './adaptadores/audio/SonidosDeFabrica.js';

const COLOR_BANCO = { Golpes: '#e63946', Efectos: '#2a9d8f', Clásicos: '#ffbe0b', Reacciones: '#6a4c93' };

async function instalarSonidosDeFabrica(consola) {
  const catalogo = catalogoDeFabrica();
  let tablero = consola.estado();
  for (const [nombreBanco, sonidos] of Object.entries(catalogo)) {
    if (!tablero.bancoPorNombre(nombreBanco)) {
      tablero = await consola.crearBanco(nombreBanco, COLOR_BANCO[nombreBanco] || '#3a86ff');
    }
    const banco = tablero.bancoPorNombre(nombreBanco);
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
        bancoId: banco.id,
        slot,
        nombre: def.nombre,
        blob,
        modo: def.modo,
        color: def.color,
        teclaRapida: def.tecla,
        origen: 'FABRICA',
      });
      slot++;
    }
  }
  return tablero;
}

async function iniciar() {
  const repositorio = new RepositorioIndexedDB();
  const reproductor = new ReproductorWebAudio();
  const analizador = new AnalizadorOffline();
  const empaquetador = new EmpaquetadorJSON();
  const reloj = new RelojSistema();

  const consola = new ConsolaAPI({ repositorio, reproductor, analizador, empaquetador, reloj });
  window.__cabina = consola; // acceso desde la consola del navegador, útil para depurar

  const estadoInicial = await consola.iniciar();

  const raiz = document.getElementById('app');
  const ui = new UITactil(raiz, consola);
  new AdaptadorTeclado(consola);

  // Siempre se revisa el catálogo de fábrica (no solo la primera vez): así,
  // si una actualización agrega un banco o sonido nuevo, los tableros que
  // ya existían en IndexedDB también lo reciben. instalarSonidosDeFabrica
  // es idempotente: no toca lo que el usuario ya tiene, solo agrega lo que
  // falta. El spinner solo se muestra si de verdad no había nada todavía,
  // para no parpadear en cada carga cuando ya está todo instalado.
  const primeraVez = estadoInicial.bancos.length === 0;
  const cargando = document.getElementById('cargando');
  if (primeraVez && cargando) cargando.hidden = false;
  await instalarSonidosDeFabrica(consola);
  if (cargando) cargando.hidden = true;

  ui.render();

  // La política de autoplay del navegador exige un gesto del usuario antes
  // de que el AudioContext pueda sonar: lo reanudamos al primer toque.
  const reanudar = () => { reproductor.reanudar(); window.removeEventListener('pointerdown', reanudar); };
  window.addEventListener('pointerdown', reanudar, { once: true });
}

iniciar().catch((e) => {
  console.error(e);
  const raiz = document.getElementById('app');
  if (raiz) raiz.innerHTML = `<p style="color:#ff6b6b;padding:24px">Error al iniciar: ${e.message}</p>`;
});
