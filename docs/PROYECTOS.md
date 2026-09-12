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
Estado: ejecutando en background sobre las 1592 canciones. Puede tardar varias horas por el tamaño de la librería. Resultados en `fingerprint_results.json` (scratchpad de la sesión) al terminar; se resumirán aquí.

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
