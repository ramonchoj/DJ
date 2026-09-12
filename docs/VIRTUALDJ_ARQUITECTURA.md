# VirtualDJ — Inventario y arquitectura (2026-09-12)

Revisión de la instalación de VirtualDJ en esta máquina y del instalador guardado en Drive. Objetivo: entender qué tiene, cómo guarda sus datos y qué se puede reutilizar para los proyectos de mezcla y de consola de locutor.

## 1. Qué hay instalado

| Elemento | Detalle |
|---|---|
| Instalador en Drive | `Mexcla para fiestas/install_virtualdj_2023_b7831_pc.msi` (471 MB, build 7831, dic-2023) |
| Programa instalado | `C:\Program Files\VirtualDJ\` — un solo ejecutable `virtualdj.exe` (541 MB) + un manifest XML. No hay DLLs ni carpetas: todo va empaquetado dentro del exe |
| Versión reportada | 8.5 (VirtualDJ 2023). Hay una actualización descargada pendiente de aplicar: `Cache/update64_8800.ready` (build 8800) |
| Datos de usuario | `C:\Users\HP\AppData\Local\VirtualDJ\` (~600 MB, de los cuales 532 MB son drivers) |
| Licencia / uso | Sesión con Tidal activa (streaming). Skin "Default:Pro". Sin controladora MIDI configurada (mapeos vacíos) |

## 2. Arquitectura de datos (carpeta AppData\Local\VirtualDJ)

VirtualDJ separa el programa (inmutable, un exe) del estado del usuario (todo en texto plano XML/M3U, fácil de leer y de generar desde scripts).

```
VirtualDJ/
├── database.xml        Biblioteca: 364 canciones con BPM, tono, cues, puntos de automix, volumen
├── settings.xml        Toda la configuración (audio, automix, sampler, browser, video, karaoke, streaming)
├── History/            Un .m3u por día de sesión + tracklist.txt legible
├── Playlists/          default.m3u (Karol G desde Tidal), karaoke.m3u, sidelist.m3u
├── Folders/Filters/    Carpetas virtuales por consulta: "bpmdiff<=4 and keydiff=0", "group by genre", etc.
├── Sampler/            Bancos de samples (XML) + audio en formato propietario .vdjsample
├── Plugins64/          Solo presets .ini de efectos nativos (Echo, Flanger, Reverb, Stems, Slicer...) + shaders
├── Cache/              cache.db (SQLite), carátulas (Covers/), caché de Tidal, changelog
├── Drivers/            cud101.dll, cuf101.dll (532 MB)
├── Devices/            controllers.dat
├── VideoSkins/         "for Live"
└── Pads/ Mappers/ Skins/ Languages/   vacíos (todo viene por defecto dentro del exe)
```

### database.xml — formato
Un `<Song FilePath=... FileSize=...>` por pista, con hijos:
- `<Tags>`: Author, Title, Album, Year, Remix, Flag
- `<Infos>`: SongLength, FirstSeen, FirstPlay, LastPlay, PlayCount, Bitrate, Cover
- `<Scan>`: **Bpm** (guardado como *segundos por beat*: 0.4878 = 123 BPM), AltBpm, **Key** (ej. "A#m"), **Volume** (ganancia de autogain, ej. 1.25)
- `<Poi>` (points of interest): `beatgrid` (fase del primer beat), `automix` con puntos realStart/realEnd/fadeStart/fadeEnd/cutStart/cutEnd/tempoStart/tempoEnd, `cue` (hot cues del usuario, Num=1..8), `remix`
- `<Link NetSearch="td...">` para pistas de Tidal, `<Comment>`

Conteo actual: 364 pistas, 207 con BPM, 94 con tono, 752 POIs (603 automix, 97 beatgrid, 49 remix, solo **3 hot cues** puestos a mano).

### Fuentes de las pistas en la base
- **Tidal (netsearch://td...)**: la mayoría, y 81 de las reproducciones del historial. Es la fuente principal de uso real.
- `C:\Users\HP\Music\Mexcla para fiestas\` y `C:\Users\HP\Music\deemix Music\` — **las mismas carpetas que hoy están en Drive (`G:\Mi unidad\Musica fiestas`), pero VirtualDJ las conoce por la ruta vieja en C:\Users\HP\Music**. Si esa ruta ya no existe, esas entradas aparecen como "archivo no encontrado" hasta que se reapunte la base.
- `D:\TODO UN POCO 2025\` (reggaetón, bandas) — un disco externo que no está conectado ahora.

### Sampler — directamente relevante para la consola de locutor
Bancos definidos en XML muy simple, una grilla de col/row:
- **AUDIO FX**: Air Horn, Siren, Explosion, Applause, Laugh
- **FAMOUS**: Saxo, This This This, Shots Shots, Hands Up
- **INSTRUMENTS**: 12 samples (kicks, hihats, synths)
- **VIDEO & SCRATCH**: 321, Ahhh-Scratch

Formato `.vdjsample`: cabecera propietaria (magic `VDJ\0`, versión 0x0320, cabecera de 0x70 bytes, luego el audio). No es un WAV/MP3 directo, así que para reutilizar esos sonidos en la app web habría que exportarlos desde VirtualDJ (botón "export" del sampler) o conseguir los originales.
Config del sampler: modo disparo "on/off", loop "locked", salida al master, sale también por audífonos.

**Coincidencia con el análisis de radio**: los 5 sonidos del banco AUDIO FX (air horn, sirena, explosión, aplausos, risa) son exactamente los "clásicos" que identificamos en [LENGUAJE_Y_FEATURES_RADIO.md](LENGUAJE_Y_FEATURES_RADIO.md). Valida la lista de sonidos de fábrica para la consola.

### settings.xml — ajustes relevantes
- Audio: tarjeta por defecto, master en canales 1-2, audífonos en 3-4. Micrófono al master activado.
- Automatización: BPM match "smart", autogain, tono automático, auto-cue "skip silence", loop inteligente, master tempo (keylock) activo, rango de pitch ±12%.
- Automix: modo "smart", fade 4 s, beat-match al hacer fade, skip 4 s. (Mismo enfoque que el script `mix_two.py`: nuestro crossfade de 16 s es más largo que el default de VDJ.)
- Grabación: mp3 calidad media, con micrófono, espera a que haya sonido. `recordFile` vacío: nunca se ha grabado una sesión con VDJ.
- Browser: filtro "Compatible songs" = `bpmdiff<=4 and keydiff=0` (misma regla que usaremos para ordenar mezclas por tempo/tono). Tags favoritos preconfigurados: hit, crowd pleaser, early night, late night, wedding, birthday, kids...
- Video: GPU NVIDIA GeForce GT 730, transición "Satellite", FX "Boom".
- Internet: sesión de Tidal guardada en el archivo (tokens de acceso; **no copiar settings.xml a ningún repo**).

## 3. Historial de uso (qué se ha tocado con VirtualDJ)

| Fecha | Pistas | Qué |
|---|---|---|
| 2023-12-20/21/23 | 3-4 c/u | Primeras pruebas con "Mexcla para fiestas" (Bee Gees, Grease, Tarzan Boy, Caballo Dorado, Que Pasa) y Tidal |
| 2024-09-14 | 2 | Paquita la del Barrio |
| 2024-12-09 | 49 | Sesión larga: muchas versiones de "Si Antes Te Hubiera Conocido", Panteón Rococó, salsa, Xavi, Belanova |
| 2024-12-11/12 | 6 / 4 | Pruebas cortas |
| 2024-12-16 | 27 | Segunda sesión larga (reggaetón desde disco D:, bandas) |
| 2025-11-10 | 3 | Última vez que se abrió |

Total: 9 sesiones, ~100 reproducciones. La grabación `Recording_65.m4a` (2026-08-23) es posterior a la última sesión de VirtualDJ y `recordFile` está vacío, así que **no fue grabada con VirtualDJ**: fue el celular Motorola grabando el ambiente.

## 4. Conclusiones para nuestros proyectos

1. **La base de datos de VirtualDJ ya tiene BPM, tono, autogain y puntos de mezcla de 207 pistas.** Se puede leer con un script (XML plano) y ahorrarnos analizar de nuevo esas canciones para el mix automático. Ojo: BPM viene en segundos/beat (BPM = 60 / valor).
2. **Las rutas están desactualizadas** (C:\Users\HP\Music vs G:\Mi unidad\Musica fiestas). Un script de reemplazo de rutas en database.xml recuperaría la biblioteca local dentro de VirtualDJ.
3. **El sampler de VDJ es el modelo de referencia** para la consola de locutor: bancos = categorías, grilla col/row, modo on/off vs loop, salida a master. Nuestra app web replica esa idea sin depender de VirtualDJ.
4. **Los formatos son abiertos** (XML, M3U): podemos generar playlists .m3u con `#EXTVDJ` desde nuestros scripts y VirtualDJ las lee directo, y viceversa (sus historiales sirven para saber qué se tocó en cada fiesta).
5. Hay una actualización a build 8800 descargada y no aplicada; si se abre VirtualDJ, la va a instalar.
