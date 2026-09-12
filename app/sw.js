/* Cabina — service worker de caché offline.
 * Estrategia: cache-first para el app shell (HTML/JS) y los audios de
 * fábrica; lo que no esté en caché se pide a la red y se guarda.
 * No hay manifest: la app NO es instalable, solo abre sin señal.
 * Al cambiar VERSION se descarta el caché anterior en la activación.
 */
const VERSION = 'cabina-v2.0.0';
const SHELL = [
  './',
  './index.html',
  './src/main.js',
  './src/aplicacion/ConsolaAPI.js',
  './src/aplicacion/puertos/secundarios.js',
  './src/aplicacion/casosDeUso/AgregarSonido.js',
  './src/aplicacion/casosDeUso/DetenerTodo.js',
  './src/aplicacion/casosDeUso/DispararPad.js',
  './src/aplicacion/casosDeUso/EditarTablero.js',
  './src/aplicacion/casosDeUso/ExportarImportarTablero.js',
  './src/aplicacion/casosDeUso/GrabarSonido.js',
  './src/aplicacion/casosDeUso/PadAleatorio.js',
  './src/dominio/Banco.js',
  './src/dominio/Sonido.js',
  './src/dominio/Tablero.js',
  './src/dominio/errores.js',
  './src/dominio/eventos.js',
  './src/dominio/servicios/ReglasDeDucking.js',
  './src/dominio/servicios/ReglasDeSolapamiento.js',
  './src/dominio/servicios/SelectorAleatorio.js',
  './src/dominio/valores/Ajustes.js',
  './src/dominio/valores/Ganancia.js',
  './src/dominio/valores/ModoDisparo.js',
  './src/dominio/valores/TeclaRapida.js',
  './src/adaptadores/almacenamiento/RepositorioIndexedDB.js',
  './src/adaptadores/audio/AnalizadorOffline.js',
  './src/adaptadores/audio/GrabadoraMediaRecorder.js',
  './src/adaptadores/audio/ReproductorWebAudio.js',
  './src/adaptadores/audio/SonidosDeFabrica.js',
  './src/adaptadores/empaquetado/EmpaquetadorJSON.js',
  './src/adaptadores/reloj/RelojSistema.js',
  './src/adaptadores/teclado/AdaptadorTeclado.js',
  './src/adaptadores/ui/UITactil.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fuentes externas: red normal
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => {
      const desdeRed = fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copia));
        }
        return resp;
      }).catch(() => enCache);
      // Audios: cache-first (no cambian). Código: red primero con caché de respaldo,
      // para que las actualizaciones lleguen sin esperar a un nuevo VERSION.
      const esAudio = /\.(mp3|wav|ogg|m4a)$/i.test(url.pathname);
      return esAudio && enCache ? enCache : desdeRed;
    }),
  );
});
