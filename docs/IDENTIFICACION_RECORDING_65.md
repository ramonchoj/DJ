# Identificación de Recording_65.m4a — resultado final (2026-09-12)

## Objetivo
Identificar qué canciones de la biblioteca (`deemix Music/`, 1,592 archivos) están mezcladas dentro de `Recording_65.m4a`, una grabación de 58.4 minutos hecha con un celular Motorola g100 el 2026-08-23.

## Métodos probados

### Intento 1 — correlación cruzada de croma (descartado)
Script `identify_mix.py`. Comparaba la grabación contra cada canción usando croma (chroma CQT) y una ventana deslizante. Descartado porque todos los puntajes salían muy parecidos entre sí (0.67-0.89) sin importar la canción: el método no discriminaba coincidencias reales de casuales.

### Intento 2 — huella acústica tipo Shazam (completado, sin resultado positivo)
Script `fingerprint_mix.py`. Construye un "mapa de constelación" de picos espectrales por canción, genera hashes (f1, f2, Δt) entre pares de picos cercanos, y busca coincidencias de esos hashes en la grabación, acumulando en qué desfase temporal coinciden. Una coincidencia real se reconoce porque muchos hashes coinciden en el mismo desfase (pico marcado en el histograma), a diferencia de coincidencias al azar que se reparten en desfases distintos.

**Ejecución**: ~1h54min (6,868 segundos). Base de datos: 6,211,994 hashes únicos de 1,592 canciones. Grabación: 64,589 picos, 322,864 hashes.

**Resultado**: la mejor coincidencia encontrada tiene 10 hashes coincidentes en el mismo desfase (de 322,864 posibles), con razón de confianza 0.00. Esto es estadísticamente indistinguible del ruido esperado por azar dado el volumen de comparaciones (6.2 millones de hashes en la base × 322,864 en la grabación). Una coincidencia real típicamente produce cientos o miles de hashes alineados en el mismo punto — no se observó nada así para ninguna de las 1,592 canciones.

## Conclusión
**No se pudo identificar ninguna canción de la biblioteca dentro de la grabación con este método.**

Explicación más probable: `Recording_65.m4a` es una grabación ambiental (micrófono del celular captando el sonido del salón/parlante), no una captura limpia de la señal de audio. El ruido de fondo, la reverberación del espacio, la distancia al parlante y la compresión/limitaciones del micrófono del teléfono degradan la señal lo suficiente como para que la técnica de huellas por picos espectrales (que depende de detectar picos de energía precisos y estables) no pueda enganchar con los archivos originales — aunque esas canciones sí hayan sonado durante la grabación.

## Alternativas si se quiere seguir intentando
1. **Escuchar manualmente** la grabación (o fragmentos) e identificar canciones de oído — el método más confiable para audio degradado.
2. **Reconocimiento por servicio externo tipo Shazam/AudD** sobre fragmentos de 10-15s de la grabación, que usan modelos más robustos a ruido que una implementación casera.
3. **Aislar voces/instrumentos** (stems) antes de la huella, para reducir el ruido ambiental — VirtualDJ ya tiene este motor instalado (ver `VIRTUALDJ_ARQUITECTURA_BINARIO.md`), aunque en esta máquina sería lento por el hardware de GPU disponible.
4. **Reducir la ventana de análisis**: enfocar el análisis solo en los tramos de la grabación con menos ruido de fondo (ej. cuando se habla menos encima de la música).

## Archivos generados
- `fingerprint_mix.py` (scratchpad de la sesión): script de huella acústica.
- `fingerprint_results.json` (scratchpad de la sesión): top 100 resultados completos, incluidos los de baja confianza.
- `rec65.wav` (scratchpad): la grabación convertida a WAV para procesamiento.

## Estado
Cerrado sin identificación positiva. Pendiente de decisión del usuario sobre si probar alguna alternativa de la lista anterior.
