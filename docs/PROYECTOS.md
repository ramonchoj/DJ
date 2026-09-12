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
