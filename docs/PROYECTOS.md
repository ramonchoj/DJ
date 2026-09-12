# Proyectos - Música Fiestas (DJ)

Reglas de trabajo:
- Todo hallazgo relevante (análisis de audio, decisiones, resultados) se guarda en los MD de esta carpeta `notas/`, no solo en el chat.

## 1. Mix automático (en curso)
Objetivo: script que ordene canciones de `deemix Music/`, detecte BPM, recorte silencios y las una con crossfade en un mp3 largo.
Estado: pendiente de iniciar tras completar la identificación de Recording_65.

## 2. Identificación de Recording_65.m4a (en curso)
Objetivo: `Recording_65.m4a` (grabación de ~58 minutos, hecha con un Motorola g100, 2026-08-23) se busca identificar qué canciones de la biblioteca completa (`deemix Music/`, 1592 archivos) fueron mezcladas en ella.

Intento 1 (descartado): huella por croma (chroma CQT) + correlación cruzada — script `identify_mix.py`. Se descartó porque todos los puntajes salían parecidos entre sí (0.67-0.86) sin importar la canción: el método no discriminaba matches reales.

Intento 2 (en curso): huella acústica tipo Shazam — script `fingerprint_mix.py`. Genera un "mapa de constelación" de picos espectrales por canción, arma hashes (f1, f2, Δt) entre pares de picos, y busca esos mismos hashes en la grabación. Un match real se identifica porque muchos hashes coinciden en el mismo desfase temporal (pico agudo en el histograma de offsets), a diferencia de coincidencias al azar que se reparten en muchos offsets distintos.
Estado: **completado, sin identificación positiva**. Ver [IDENTIFICACION_RECORDING_65.md](IDENTIFICACION_RECORDING_65.md) para el resultado detallado y las alternativas propuestas. Tardó ~1h54min; la mejor coincidencia (10 hashes de 322,864 posibles) es estadísticamente ruido, no una coincidencia real — probablemente porque es una grabación ambiental de celular, no una captura limpia de la mezcla.

## 3. Análisis de la competencia (soundboard) — completado
Ver [ANALISIS_COMPETENCIA_SOUNDBOARD.md](ANALISIS_COMPETENCIA_SOUNDBOARD.md): revisión de Discord Soundboard, Voicemod, Soundpad, MyInstants, Big Button Box y apps genéricas móviles, con tabla comparativa y listado priorizado de features candidatas (imprescindibles, muy recomendables, opcionales).

## 3b. Lenguaje de radio y priorización de features — completado
Ver [LENGUAJE_Y_FEATURES_RADIO.md](LENGUAJE_Y_FEATURES_RADIO.md): vocabulario real de cabina de radio (jingle, cortinilla/sweeper, golpe/stinger, cama musical/music bed, cart pad, tecla rápida) para usar como categorías reales en la app; lista de los sonidos "clásicos" más usados (aplausos, air horn, rimshot, redoble, scratch stop, sirena, campana correcto/incorrecto); y features re-priorizados en 3 niveles (innegociables, los que más enganchan, pulido).

## 4. Consola de locutor / soundboard (nueva petición)
Decisión del usuario: será una **aplicación web** (no Android nativa), con sonidos graciosos, de fiesta, efectos, botones para dispararlos.
Requisitos clave:
- Debe funcionar **sin señal de celular** (modo offline) en el lugar de la fiesta.
- Debe poder **guardarse en caché** para uso sin conexión (PWA con Service Worker + Cache API / IndexedDB para los archivos de audio).
- Salida de audio por el propio celular, transmitida por Bluetooth a un parlante.
Plan técnico:
- PWA instalable (manifest.json + service worker) que cachee el HTML/JS/CSS y los audios subidos por el usuario (IndexedDB para los blobs).
- Grid de botones configurable, cada uno disparando un audio con Web Audio API (baja latencia, permite solapar sonidos).
- Subida de audios propios desde el celular (input file) y persistencia local.
Estado: pendiente de construir, arranca después de reportar la identificación del mix.

## 5. Prueba de mezcla: Caballo Dorado x Que Pasa (2026-09-12) — completado
Petición: mezclar "Payaso de Rodeo" con "Caballo Dorado" como prueba de capacidades.
Hallazgos:
- "Payaso de Rodeo" NO está en la biblioteca (buscado por payaso/rodeo/caballo/dorado en todas las carpetas). Nota: es una canción del grupo Caballo Dorado.
- Existe una carpeta no revisada antes: `Mexcla para fiestas/` con 7 mp3 a 320 kbps (Bee Gees, Caballo Dorado mashup, KC & The Sunshine Band, Night Fever, Que Pasa, Tarzan Boy, Grease) y el instalador de VirtualDJ 2023.
- El único archivo de Caballo Dorado ya es un mashup: "Caballo dorado vs botella tras botella no rompas mas, soy una serpiente troleada".
Se hizo la prueba con la pareja de tempo más cercana en esa carpeta.

BPM y tono detectados (librosa, ventana 30s-150s):
| Canción | BPM | Tono |
|---|---|---|
| Caballo dorado (mashup) | 123.0 | F |
| Que Pasa | 136.0 | F# |
| Bee Gees - Stayin' Alive | 103.4 | F |
| KC & The Sunshine Band | 107.7 | G |
| Night Fever | 107.7 | C# |
| Tarzan Boy | 107.7 | C |
| You're The One That I Want | 107.7 | E |

Método (script `mix_two.py`, scratchpad): Que Pasa se estira con atempo 0.9048 (136→123 BPM) para sincronizar tempo; corte de A en el beat más cercano a 24 s antes de su final (261.1 s); B arranca en su primer beat (0.77 s ya estirado); ambas normalizadas a -14 LUFS (loudnorm); crossfade triangular de 16 s (acrossfade). Salida 44.1 kHz, 320 kbps.
Resultado: `Mezclas generadas/Caballo Dorado x Que Pasa (123 bpm, crossfade 16s).mp3` — 8:40 min, 20.8 MB. Empalme en 4:21-4:37.
Pendiente: cuando el usuario ponga "Payaso de Rodeo" en alguna carpeta, repetir la mezcla con esa canción.

## 6. Repositorio de documentación (2026-09-12)
Toda la documentación de `notas/` se espeja en GitHub: https://github.com/ramonchoj/DJ (carpeta `docs/`, clon local en `C:\Users\HP\DJ`). El audio se queda en Drive; el repo solo guarda documentos.

## 7. Arquitectura interna del binario de VirtualDJ (2026-09-12) — completado
Ver [VIRTUALDJ_ARQUITECTURA_BINARIO.md](VIRTUALDJ_ARQUITECTURA_BINARIO.md): análisis PE del exe (C++ nativo x64, MSVC 2022, UI propia sobre Direct3D/Direct2D), capas internas (ASIO/WASAPI, Elastique v3, ffmpeg estático, FFTW, DirectML/CUDA para stems con 410 MB de modelos embebidos), skins XML + VDJScript (~200 verbos, 38 de sampler), SDK de plugins, MSI WiX de 29 archivos, y formato `.vdjsample` = cabecera de 112 bytes + Ogg estándar (reutilizable en la consola web).

## 8. Propuesta de arquitectura de nuestra app "Cabina" (2026-09-12) — superada por el punto 9
Ver [ARQUITECTURA_NUESTRA_APP.md](ARQUITECTURA_NUESTRA_APP.md): qué copiamos de VirtualDJ y qué no, alcance por versiones (V1 consola de locutor, V2 deck de playlist con automix, V3 dos decks), estructura hexagonal con archivos concretos (domain / application / adapters), flujo de uso offline, decisiones técnicas y plan de construcción en 6 pasos. Pendiente: decidir aspecto visual, sonidos de fábrica, categorías iniciales y nombre.

## 9. Arquitectura hexagonal propia (2026-09-12) — completada e implementada, ver punto 10
Ver [ARQUITECTURA_HEXAGONAL.md](ARQUITECTURA_HEXAGONAL.md): diseño desde cero (sin heredar de VirtualDJ) con regla de dependencias, mapa del hexágono (mermaid), dominio (Tablero/Banco/Sonido, valores ModoDisparo/Ganancia/TeclaRapida, eventos, servicios), puertos primarios (ConsolaAPI) y secundarios (RepositorioTablero, Reproductor, AnalizadorAudio, Empaquetador, Reloj), adaptadores, raíz de composición, carpetas, estrategia de pruebas, offline y evolución a mezclador.

## 10. Cabina — app construida y publicada (2026-09-12) — completado
Se construyó el sistema completo siguiendo [ARQUITECTURA_HEXAGONAL.md](ARQUITECTURA_HEXAGONAL.md), código en el repo bajo `app/`.

**Publicada en**: https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523

Qué incluye:
- Dominio puro (Tablero, Banco, Sonido, ModoDisparo, Ganancia, TeclaRapida, eventos, servicios) sin ninguna dependencia externa.
- 6 casos de uso (DispararPad, DetenerTodo, AgregarSonido, EditarTablero, PadAleatorio, ExportarImportarTablero) sobre puertos abstractos.
- Adaptadores: Web Audio (con fades y solapamiento real), IndexedDB (persistencia), analizador de volumen (normalización automática al subir un sonido), UI táctil, teclado, empaquetado JSON para respaldo/restauración, y un sintetizador que genera los 10 sonidos de fábrica (aplausos, air horn, sirena, redoble, "chiste malo"/rimshot, campana correcto/incorrecto, "algo salió mal"/scratch stop, explosión, risas) directamente en el navegador con Web Audio, sin descargar ningún archivo — usa el catálogo definido en [LENGUAJE_Y_FEATURES_RADIO.md](LENGUAJE_Y_FEATURES_RADIO.md).

Pruebas:
- 48/48 pruebas automáticas (`node --test`) sobre dominio y aplicación, con dobles en memoria, sin navegador.
- Verificación en navegador real: renderizado correcto confirmado por captura de pantalla y por inspección del árbol de accesibilidad, cero errores de consola y cero peticiones fallidas en todas las corridas.
- Un bug real encontrado y corregido durante las pruebas: el overlay de "cargando" no se ocultaba porque una regla CSS con `display:flex` tenía más especificidad que el estilo por defecto del atributo `[hidden]`; se corrigió agregando `#cargando[hidden] { display: none; }`.
- Nota sobre el proceso de prueba: el arnés de automatización de navegador mostró inconsistencia intermitente al reutilizar la misma URL entre corridas (relacionado con caché/bfcache del perfil de pruebas), no relacionada con el código de la app; se confirmó reproduciendo la inicialización manualmente en el navegador (éxito consistente) y usando URLs únicas por corrida (éxito consistente).

Diseño: tema oscuro por defecto con espejo claro vía `prefers-color-scheme`, tipografía Barlow Semi Condensed (títulos/etiquetas, estética de consola de transmisión) + Work Sans (cuerpo), colores distintos por pad de la paleta ya usada en el dominio.

Código en `app/` del repo: `src/` (dominio, aplicación, adaptadores), `test/` (48 pruebas), `index.html` (documento completo para desarrollo local), `artifact_body.html` (contenido publicado), `README.md`.

Pendiente (siguiente sesión, si se pide): probar en un celular real conectado a un parlante Bluetooth; agregar más categorías/sonidos propios; considerar V2 (deck de música con playlist).

## 11. Mejora de sonidos: grabaciones reales en vez de síntesis (2026-09-12) — completado
Se reemplazaron 5 de los 10 sonidos sintetizados por grabaciones reales extraídas de los `.vdjsample` de VirtualDJ (cabecera de 112 bytes + Ogg Vorbis, ver [VIRTUALDJ_ARQUITECTURA_BINARIO.md](VIRTUALDJ_ARQUITECTURA_BINARIO.md) sección 5), convertidas a mp3 para compatibilidad con Safari/iOS: Air Horn, Sirena, Aplausos, Explosión, Risas.
Se agregaron 4 sonidos de regalo del mismo origen en un banco nuevo "Clásicos": Saxo, Shots, Hands Up, This This This.
Los 5 sonidos sin equivalente real en VirtualDJ (Redoble, Chiste malo, Correcto, Incorrecto, Algo salió mal) siguen sintetizados por Web Audio.
`catalogoDeFabrica()` ahora soporta entradas con `archivo` (se descarga como parte de la carga inicial, igual que las tipografías) además de `generar` (síntesis).
Verificado: 48/48 pruebas en verde, captura de pantalla con las 3 categorías y 14 pads, cabeceras MP3 válidas en los 9 archivos servidos.
Republicado: https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523 (versión 2).

## 12. Despliegue de Cabina en hosting propio (2026-09-12) — completado
Cabina quedó publicada en dos lugares:
- Artifact (privado, de trabajo): https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523
- **Dominio propio**: https://cabina.softmotion.mx/

Despliegue: servidor de hosting compartido GoDaddy/cPanel (`p3plzcpnl506144.prod.phx3.secureserver.net`), cuenta `k313aoe6wjqm`. Se generó un par de llaves SSH dedicado (`~/.ssh/cabina_softmotion`), autorizado por el usuario en cPanel → Administrador de claves SSH. El host real no se pudo usar vía el dominio público (`softmotion.mx` está detrás de Cloudflare, sin puerto SSH expuesto); se encontró en `~/.ssh/known_hosts` de una conexión previa a otro proyecto (Psymeter) en el mismo servidor.

Subida: como `rsync` no está instalado en la máquina local (Windows/Git Bash), se empaquetó `app/` (sin `test/`, `package.json`, `README.md`) en un `.tar.gz`, se subió por `scp` y se extrajo por SSH directo en `~/cabina.softmotion.mx/` (el document root que GoDaddy ya había creado para el subdominio). 42 archivos, 2.5 MB.

Verificado: los 4 endpoints clave devuelven 200 (index.html, src/main.js, un mp3 de assets, la raíz). Cargado en navegador real sobre el dominio: los 14 pads de fábrica (Golpes, Efectos, Clásicos) renderizan con nombres, teclas y colores correctos.

Para futuras actualizaciones: repetir el mismo empaquetado+scp+extracción, o instalar rsync localmente para sincronizar solo lo que cambió.

## 13. Cabina v2 — reingeniería completa (2026-09-12) — completado, en pruebas
Ver [REINGENIERIA_CABINA_V2.md](REINGENIERIA_CABINA_V2.md). Se revisó la v1 contra la lista de 15 features de los análisis: cubría 8. La v2 implementa los 7 restantes (pestañas, buscador, arrastrar/soltar, volumen por pad, tono en vivo, grabadora con micrófono, modo uno-a-la-vez) más camas musicales con ducking, diálogos propios, VU, service worker offline y migración automática de tableros v1. 78/78 pruebas (`node --test`). Verificado en navegador: 5 bancos (incluida "Camas" ♫ vacía para loops propios), disparo, búsqueda, pestañas, SW activo, micrófono soportado.
Publicado en el repo (`app/`, v2.0.0) y en el Artifact de pruebas. `cabina.softmotion.mx` sigue en v1 hasta aprobar la v2.

## 14. Análisis completo de features de VirtualDJ + Cabina v3 con módulo DJ (2026-09-12) — completado, en pruebas
Ver [ANALISIS_FEATURES_VIRTUALDJ.md](ANALISIS_FEATURES_VIRTUALDJ.md): 17 áreas de features (decks, tempo/sync, cues, loops, mezclador/EQ, automix, biblioteca, sampler/pads, efectos, stems, micrófono, grabación/transmisión, video/karaoke, controladoras, skins, streaming/licencia, sistema) con relevancia para nosotros y una tabla de "qué significa mejor que VirtualDJ para nosotros".
Construido: módulo DJ dentro de Cabina (v3.0.0), hexagonal: dominio (Pista, Deck, Mezclador, Cola, ReglasDeAutomix con puntos de mezcla/beatmatch/Camelot), aplicación (DJAPI: biblioteca, decks, cues, loops, EQ, crossfader, cola, automix con tick, talkover), adaptadores (MotorWebAudio 2 decks + EQ + crossfader + ducking, AnalizadorBpm, RepositorioBibliotecaIndexedDB, ImportadorVirtualDJ, UIDJ). Selector Pads/DJ/Ambos. 105/105 pruebas.
Verificado con música real en el navegador: BPM propio 134.0 / 107.6 vs VirtualDJ 134.0 / 107.3; importación de database.xml aplica análisis a 2 de 40 pistas presentes; decks, loop, EQ, cola, "mezclar ya" y transición correctos. Corregida la semántica de los POI automix de VirtualDJ (fadeEnd = inicio del fade de salida).
Fuera de alcance a propósito: keylock (Elastique), stems IA, video, DVS, streaming con DRM.

## 15. Cabina v3 desplegada + grabación de sesión (2026-09-12) — completado
- **Desplegada en https://cabina.softmotion.mx/** (73 archivos, 4.8 MB) y en el Artifact de pruebas. Selector Pads / DJ / Ambos arriba a la izquierda.
- Nuevo: **Grabar sesión** (puerto `GrabadorSesion`, adaptador `GrabadorSesionWebAudio` con MediaRecorder sobre un nodo de salida compartido por pads y decks). Botón ⏺ en la barra de automix; al detener descarga `cabina-sesion-<fecha>.webm` (m4a en Safari). Verificado en navegador: 3.2 s → 58 KB webm/opus. 106/106 pruebas.
- Hallazgo: `AudioContext.resume()` sin gesto del usuario puede no resolver nunca; nunca se espera con `await`, se reanuda solo con el primer toque en la página.
- Recordatorio Cloudflare: los .js quedan en caché de borde 4 h; tras cada despliegue purgar en dash.cloudflare.com → softmotion.mx → Caching → Purge Everything, o abrir con `?v=<algo>`.

## 16. Sonidos nuevos: banco "Calle" + remates (2026-09-12) — completado
Pedido: automóvil, moto, avión, pregón "se compran colchones…", wah-wah de chiste malo, remate de chiste y campana del camión de la basura.
- De Mixkit (licencia libre): Automóvil (1538), Moto (2732), Avión jet (1577), Wah wah trombón triste (471), Remate tambor+xilófono (568).
- **Campana del camión de la basura**: Mixkit no tiene campana de mano; se sintetizó (parciales inarmónicos de campana, 6 repiques) → `assets/mixkit/campana-basura-sintetizada.mp3`.
- **"Fierro viejo"**: el pregón original es la voz de una persona real y no está en bancos libres; se generó con la voz **Microsoft Sabina (es-MX)** de Windows (System.Speech) → `assets/voces/fierro-viejo.mp3`. De regalo, "Tamales" con la misma voz. Documentado en `assets/voces/LICENCIA.md`.
- Catálogo: banco nuevo **Calle** (teclas 1-5 y 8) y Golpes suma Wah wah (6) y Remate (7). Los tableros existentes reciben los nuevos pads solos (instalación de fábrica idempotente). 106/106 pruebas. Verificado en navegador.

## 17. Despliegue versionado (2026-09-12) — completado
Síntoma reportado: "no sirve el botón DJ" en cabina.softmotion.mx. Causa: Cloudflare cachea .js/.css 4 h ignorando el Cache-Control del origen; el index.html nuevo llegaba con el main.js viejo (sin el selector de modo).
Solución definitiva: `tools/deploy.sh` despliega cada versión en `r/<versión>/` (URLs nuevas → caché frío), el index.html (que Cloudflare no cachea) carga `r/<versión>/src/main.js` y un **import map** redirige todos los imports de módulos a esa carpeta; el service worker se registra como `sw.js?v=<versión>`; los audios siguen en `assets/` (inmutables). Conserva las últimas 3 versiones en el servidor. Ya no hace falta purgar Cloudflare tras un despliegue.
Uso: `bash tools/deploy.sh` (toma la versión de app/package.json). Versión actual desplegada: 3.0.1.

## 18. Pie con versión y hora de publicación (2026-09-12) — completado
Pie discreto al final de la página (11 px, mayúsculas espaciadas, 45 % de opacidad, sube al pasar el cursor): `v<versión> · <día mes año> · <HH:MM> CDMX`. La versión sale de package.json y la hora la estampa `tools/deploy.sh` en el momento de publicar (zona America/Mexico_City); el `<time>` lleva la fecha ISO en `datetime`. Para el Artifact la hora se estampa al preparar la copia. Versión desplegada: 3.0.2.

## 19. Modo YouTube (2026-09-12) — completado, en producción (v3.1.0)
Pedido: una versión en línea donde la música se elija directamente de YouTube y se mezclen dos canciones de YouTube. Hecho con el reproductor oficial embebido (YouTube IFrame Player API): dos reproductores visibles (deck A y B) + uno de vista previa para leer título/duración. Se reutilizan `DJAPI` y `UIDJ` completos; solo cambian los adaptadores (`src/yt/adaptadores/`): `MotorYouTube` (implementa el puerto `MotorDJ`: cargar por id, play/pausa/seek, volumen, crossfader con rampa por temporizador, ducking, loop, tasa en pasos de YouTube, fin de pista), `AnalizadorYouTube`, y el repositorio IndexedDB con nombre `cabina-yt`. Pegado de enlaces (largos, cortos, shorts, embed o id) con "+ Enlaces de YouTube".
Verificado con un video real en el navegador: título y duración leídos, carga en deck A, reproducción (con clic real, por la política de autoplay), crossfader, interfaz. 110/110 pruebas (4 nuevas: extracción de ids, tasas, DJAPI con analizador de YouTube).
Límites: sin EQ/forma de onda/VU/BPM automático (el audio no sale de YouTube); tempo solo 0.25…2 en pasos; requiere internet; no funciona dentro del Artifact de Claude (CSP bloquea el script de YouTube), sí en cabina.softmotion.mx. Cumple los términos de YouTube: reproductores visibles, sin descarga.

## 20. Audios reales del usuario: colchones y campana de la basura (2026-09-12) — completado (v3.1.1)
El usuario entregó dos mp3 propios (pregón "se compran colchones", 22 s, y campana del camión de la basura, 7.3 s). Se integraron en `assets/usuario/` como pads "Se compran colchones" (tecla 4) y "Campana de la basura" (tecla 5) del banco Calle, sustituyendo a los sintetizados. Se agregó al instalador de fábrica la opción `reemplazaA`: borra el pad de fábrica anterior (solo si sigue siendo de fábrica, si el usuario lo editó se respeta) antes de agregar el nuevo, así los tableros ya instalados migran solos sin duplicar. Se eliminaron los archivos sintetizados que ya no se usan. Verificado en un tablero existente: 0 pads viejos, nuevos en sus slots, normalización aplicada (campana ×1.44). 110/110 pruebas. Desplegado en producción.

## 21. Banco "Animales" para concursos (2026-09-12) — completado (v3.2.0)
16 sonidos de animales de Mixkit (licencia libre): perro, gato, vaca, gallo, gallina, caballo, león, mono, cerdo, lobo, burro, oveja, cabra, búho, abeja, grillo (0.9–11.8 s). Sin teclas rápidas (las 26 letras y los dígitos 1–8 ya están asignados). Para el concurso "adivina el animal": el botón 🎲 del banco dispara uno al azar sin repetir el anterior. Verificado en navegador (16 pads, ruleta con resultados distintos). 110/110 pruebas. Desplegado en producción.

## 22. Fanfarrias y "Queremos pastel" (2026-09-12) — completado (v3.3.0)
El usuario entregó dos mp3 propios. Procesados con ffmpeg (recorte de silencios, loudnorm −14 LUFS / TP −1 dBFS, 44.1 kHz 128 kbps):
- `assets/usuario/fanfarrias.mp3` (26 s) sustituye al pad "Fanfarria" de Mixkit (banco Golpes, tecla V) mediante `reemplazaA`; se borró `fanfare-722.mp3`.
- `assets/usuario/queremos-pastel.mp3` (75 s, fade final de 1 s) es el pad nuevo "Queremos pastel" 🎂 (banco Reacciones, tecla 9). Por su duración conviene cortarlo con "Detener todo" cuando el pastel ya salió.
110/110 pruebas. Desplegado en producción y en el Artifact.

## 23. Precarga (buffer) en modo YouTube para internet lento (2026-09-12) — v3.4.0
**Hallazgo:** el IFrame Player de YouTube no tiene API de "prefetch"; solo llena el buffer mientras reproduce y `getVideoLoadedFraction()` dice cuánto hay. `setPlaybackQuality` ya no hace nada (YouTube elige la calidad por tamaño del reproductor).
**Solución:** puerto `MotorDJ.precargar(deck, {segundos})` / `precarga(deck)` (opcional, por defecto 0). `MotorYouTube.precargar` toca el video en silencio (volumen 0 + mute, sin marcar "sonando", VU en 0) hasta tener N segundos en buffer o todo el video, y regresa en pausa al punto de partida; si el usuario da play/pausa mientras tanto, se cancela sin estorbar (`#cancelarPrecarga`). `DJAPI` recibe `precargaAutomaticaSeg` (main.js: 90 s al cargar en el deck) y expone `precargar`/`precarga`; nunca precarga un deck que está sonando.
**UI:** barra de progreso con capa tenue = buffer (`--b`), texto "⏬ 45s en buffer" / "⏬ completo", botón ⏬ en cada deck (pide 120 s más).
**Uso con internet lento:** pega los enlaces con "+ Enlaces de YouTube", carga cada video en su deck con ▶A / ▶B y espera a que la barra tenue avance antes de la fiesta; con ⏬ se llena más. Nota: YouTube limita cuánto guarda por adelantado (varios minutos, no siempre el video completo).
**Pruebas:** 112/112 (2 nuevas en test/dj/youtube.test.js). La API de YouTube no carga en los navegadores automatizados de esta máquina (patchright ni agent-browser), así que la verificación en vivo queda pendiente del usuario.
