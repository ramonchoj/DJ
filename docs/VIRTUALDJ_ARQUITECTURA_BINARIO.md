# VirtualDJ — Arquitectura interna del binario (2026-09-12)

Análisis estático de `C:\Program Files\VirtualDJ\virtualdj.exe` (build 7831, 29-nov-2023) y del instalador MSI. Complementa a [VIRTUALDJ_ARQUITECTURA.md](VIRTUALDJ_ARQUITECTURA.md), que cubre la capa de datos del usuario. Método: cabeceras PE con `pefile`, extracción de recursos, búsqueda de cadenas, lectura de tablas del MSI con la API de Windows Installer. No se ejecutó ni se desensambló el programa.

## 1. Resumen en una frase

VirtualDJ es un único ejecutable C++ nativo de 64 bits, sin frameworks de UI de terceros, que lleva embebidos como recursos su interfaz (skins XML), sus modelos de IA para separar stems (410 MB), sus DLLs auxiliares y sus definiciones de controladoras; todo lo que el usuario cambia vive fuera, en texto plano.

## 2. El ejecutable (PE)

| Dato | Valor |
|---|---|
| Arquitectura | x64 (Machine 0x8664), GUI, ASLR + NX + High-Entropy VA |
| Compilador | MSVC linker 14.38 (Visual Studio 2022), ruta de build `C:/code/atomix/...` |
| Tamaño | 541 MB en disco, 551 MB en memoria |
| Código (.text) | 53.5 MB — grande porque estáticamente enlaza ffmpeg, OpenSSL, libcurl, zlib, SQLite, FFTW, Elastique y las rutinas CUDA |
| Datos (.rdata + .data) | 22 MB |
| Recursos (.rsrc) | **474.5 MB (88% del archivo)**, 419 recursos RCDATA |
| Secciones especiales | `.nv_fatb` / `.nvFatBi`: kernels CUDA compilados ("fatbin") para GPU NVIDIA |
| Actualizador | `Cache/update64_8800.ready` es un exe completo nuevo; VDJ se reemplaza a sí mismo al arrancar |

### DLLs del sistema que importa (nada de terceros)
Gráficos: `d3d11`, `d3d12`, `dxgi`, `d2d1`, `DWrite` (Direct3D 11/12 + Direct2D + DirectWrite: la UI se dibuja con GPU, no con controles Windows). Audio/MIDI: `WINMM` (MIDI in/out), `AVRT` (prioridad de hilo de audio pro). Hardware: `HID`, `SETUPAPI` (controladoras USB HID). Red: `WS2_32`, `WININET`, `CRYPT32`, `Secur32`, `bcrypt`. Sistema: `KERNEL32`, `USER32`, `GDI32`, `SHELL32`, `ole32`, `ADVAPI32`.

**No aparecen** Qt, wxWidgets, JUCE, .NET, Electron ni Chromium. La interfaz es un motor propio.

## 3. Capas internas (deducidas de cadenas y símbolos)

```
┌─────────────────────────────────────────────────────────────┐
│  Skins XML (Performance / Pro / Starter / Vertical /         │  ← UI declarativa, 2 MB
│  Essentials) + shaders HLSL .cso (formas de onda, scratch)   │
├─────────────────────────────────────────────────────────────┤
│  VDJScript: ~200 verbos (play, hot_cue, loop_roll,           │  ← lenguaje de acciones
│  sampler_pad, automix_skip, stem_pad, var_*, param_*)        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Motor audio  │ Decodif.     │ Stems / IA   │ Controladoras  │
│ ASIO, WASAPI,│ ffmpeg       │ DirectML.dll │ MIDI (WINMM),  │
│ MME; clases  │ (2022-09-15) │ (GPU genérica│ HID; 14 MB de  │
│ CSoundCard*  │ mp3/aac/flac │ ) o CUDA +   │ definiciones   │
│ Elastique v3 │ opus/vorbis/ │ cuDNN+cuFFT  │ embebidas      │
│ (zplane) para│ wav/aiff +   │ (NVIDIA);    │ (CONTROLLERS   │
│ keylock/tempo│ video mp4/   │ modelos en   │ .DAT + Traktor │
│ FFTW 3.3     │ mkv/webm     │ IMG0-5       │ .DATA)         │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  Red: libcurl 8.3 + OpenSSL. Endpoints live.virtualdj.com    │
│  (drm8, getbpm, getkey, oauth, update, askthedj, genius…)    │
│  Fuentes online: Tidal, SoundCloud, Beatport, iDJPool, VJPro │
├─────────────────────────────────────────────────────────────┤
│  Persistencia: database.xml, settings.xml, .m3u, SQLite      │
│  (Cache/cache.db: formas de onda precalculadas)              │
└─────────────────────────────────────────────────────────────┘
```

### Motor de audio
- Backends: **ASIO** (`CSoundCardAsio`, `asio://`), **WASAPI** (`CSoundCardWASAPI`, `wasapi://`, `wasapiin://`) y MME. La config actual usa "default" (WASAPI compartido).
- Time-stretch / keylock: **Elastique v3 de zplane** (`CElastiqueV3`, `CElastiqueEffV3Core`), licencia comercial, calidad profesional. Esto explica por qué su masterTempo suena mejor que un `atempo` de ffmpeg.
- FFT: **FFTW 3.3** (`Cache/fft` guarda su "wisdom" de planes).
- Decodificación: **ffmpeg 2022-09-15** enlazado estáticamente (libavformat/libavcodec), con demuxers de mp3, aac, flac, opus, vorbis, wav, aiff, mp4, mkv, webm.
- Formatos propios: `.vdjsample`, `.vdjcache`/`.vdjcachev`/`.vdjcachet` (audio/video pre-decodificado), `.vdjstems`, `.vdjedit`, `.vdjfolder`, `.vdjshader`.

### Separación de stems (IA)
- Dos rutas de ejecución: **DirectML** (`DIRECTML.DLL` y `DIRECTML190.DLL` embebidas, 22 MB; corre en cualquier GPU DirectX 12) y **CUDA** para NVIDIA (kernels en `.nv_fatb`, más `cud101.dll` = cuDNN 400 MB y `cuf101.dll` = cuFFT 130 MB que se extraen a `Drivers/`). Símbolos `_cudaKernelFFT`, `_cudaKernelSpectrum`, `_cudaKernelIFFTMerged` indican que la red trabaja sobre espectrogramas.
- Modelos: recursos `IMG0..IMG3` (39 MB cada uno, entropía 7.4, contenido = float32 sin comprimir) y `IMG4` (191 MB) + `IMG5` (62 MB) con entropía 8.0 y el mismo encabezado de 8 bytes: **cifrados**. Interpretación: IMG0-3 son los modelos ligeros (vocal / instru / kick / hihat, "Stems 1.0") e IMG4-5 el modelo grande "Stems 2.0". Cadenas `onnx`, `.pb`, `HiddenInitTensor`, `DML_OPERATOR_*` confirman un runtime de inferencia embebido, no un archivo .onnx externo.
- `ML1151.DLL` (16 MB) es otro runtime auxiliar. `VCOMP.DLL` = OpenMP.
- En esta máquina la GPU es una GeForce GT 730 (muy antigua): los stems irán por CUDA lento o por DirectML; el `resetStemsOnLoad=Pads` de settings muestra que se usan los pads de stems.

### Interfaz (skins)
- `SKIN.ZIP` (2.5 MB): 5 layouts XML (Performance, Pro, Starter, Vertical, Essentials) + 8 PNG con todos los gráficos en un atlas (`gfx-pro.png`). El Performance.xml tiene 428 KB con ~480 `<button>`, ~220 `<slider>`, ~560 `<panel>`, `<define>` para colores y `<visual>` para formas de onda.
- Cada control lleva una acción VDJScript en texto (`<button action="play_pause">`), y condiciones (`condition="var_equal '@$4decks' 0"`). Es la misma sintaxis que usan mapeos de controladoras y pads.
- Shaders `.cso` (DXBC compilado) para dibujar ondas (`SKINRHYTHM`, `SKINSCRATCHWAVE`, `SKINGEOMETRIC`) y transiciones de video (`VT_WARPSPEED`, `VT_JUMBLE`, `VT_SPLODGE`).
- 12 idiomas en `LANGUAGES.ZIP` (incluye Spanish.xml). `REMOTESKIN.ZIP` es la UI para la app móvil VDJ Remote (puerto 4243).

### Pads y sampler (lo que copia nuestra consola de locutor)
`PADS_SAMPLER.XML` define una página de 16 pads donde cada pad es puro VDJScript:
```xml
<pad1 name="`get_sample_name 1 "auto"`" color="sampler_color 1 "auto"">sampler_pad 1 "auto"</pad1>
```
Es decir: nombre dinámico, color dinámico, y una acción por pad. Hay 38 verbos `sampler_*` (play, stop, play_stop, play_stutter, loop, mode, volume, color, bank, select, rec/start_rec/stop_rec, group_mute/group_volume, velocity, rapidfire, load_to_deck, output). Otras páginas: hot cues, saved loops, slicer, stems, key-cue, remix points, scratch. **Este es exactamente el modelo "categoría = banco, botón = pad con acción" que definimos para la app web.**

### Plugins
- Interfaces C++ exportadas: `IVdjPlugin8`, `IVdjPluginDsp8`, `IVdjPluginPositionDsp8`, `IVdjPluginVideoFx8`, `IVdjPluginVideoTransition8`, `IVdjPluginStartStop8`, `IVdjPluginOnlineSource`. Se cargan por `DllGetClassObject` (estilo COM). Efectos internos: `CInternalPluginAFX_EQ10`, `AFX_Scratch`, `VFX_ScreenGrab`, `VIS_Camera`.
- En esta instalación solo hay presets `.ini` de efectos nativos y shaders de Shadertoy; ningún plugin externo.

### Licencia / DRM
Todo se valida contra `live.virtualdj.com/live/drm8.php` con OpenSSL; `logcu.php` registra el uso de "Content Unlimited" (Tidal). El instalador NO trae número de serie: la licencia es por cuenta online (`stayLoggedIn=yes`). Las cadenas "Home edition / Pro Infinity / Business" muestran las ediciones.

## 4. El instalador MSI (WiX)

| Dato | Valor |
|---|---|
| Producto | VirtualDJ 2023, versión 8.5.7831.0, Atomix Productions, idioma 1033 |
| Requisito | Windows 10 64-bit (VersionNT64 >= 603) |
| Archivos | **Solo 29**: `virtualdj.exe`, 24 `.vdjsample`, 4 XML de bancos de sampler, el manifest |
| Destinos | `ProgramFiles64\VirtualDJ` (RUNFOLDER) y `LocalAppData\VirtualDJ` (HOMEFOLDER) con subcarpetas Sampler/{Audio,Instruments,Video,Recordings}, Playlists, History, Mappers, Cache/Covers, Skins/iPhone |
| Registro | `HKCU\Software\VirtualDJ\{RunFolder64, HomeFolder}`, cancela AutoPlay para virtualdj.exe, fuerza IE11 (`FEATURE_BROWSER_EMULATION=9000`) para sus vistas web internas |
| Acciones | `installcleaner` (limpia HOMEFOLDER de versiones viejas), lanza la app al terminar |

Conclusión: el MSI es un envoltorio mínimo. El 99.9% del producto es el exe. Los drivers CUDA (532 MB en `Drivers/`) no vienen en el MSI: el exe los descarga o extrae la primera vez que se usan stems.

## 5. Formato `.vdjsample` (para reutilizar los sonidos)

```
offset 0x00  "VDJ\0"          magic
offset 0x04  0x0320           versión (3.2)
offset 0x08  0x70             tamaño de cabecera (112 bytes)
offset 0x0C  uint32           tamaño del payload de audio
offset 0x20  float32 x2       ganancia / parámetros (0.65, 0.62 en Air Horn)
offset 0x30  double x3        BPM o duración en beats (6.58… repetido)
offset 0x70  "OggS"           payload = archivo Ogg (Vorbis/Opus) estándar
```
**El audio es un Ogg normal a partir del byte 0x70.** Basta cortar la cabecera para obtener un `.ogg` reproducible en cualquier navegador. Esto resuelve cómo llevar los 24 samples de fábrica (air horn, sirena, aplausos, risa, explosión, saxo, hands up, kicks, hihats, synths, 3-2-1, scratch) a la consola web sin abrir VirtualDJ.

## 6. `Cache/cache.db` (SQLite)

Una sola tabla `waveforms(id, filepath, filename, filesize, type, version, valuesPerSecond, waveform BLOB)` con 132 filas: formas de onda precalculadas (~1.4-1.5 valores/segundo, 4 bytes por valor: 3 bandas de color + pico) para dibujar el overview de cada canción sin re-decodificar. Reutilizable: leerla nos daría la envolvente de energía de esas 132 pistas gratis.

## 7. Qué nos llevamos a los proyectos

1. **Sampler = modelo de referencia validado**: bancos en XML + pads con nombre/color/acción. Nuestra consola web replica esa estructura (`Board` → bancos → `Sound`), y podemos importar los `.vdjsample` de fábrica quitando 112 bytes de cabecera.
2. **VDJ hace mejor el time-stretch** (Elastique) que ffmpeg `atempo`. Para mezclas que se vayan a publicar, conviene generar el mix como playlist `.m3u` con `#EXTVDJ` y dejar que VirtualDJ (automix con `autoMixBeatMatchOnFade`) haga la transición, o aceptar la calidad de ffmpeg para pruebas.
3. **Los análisis de VDJ (BPM, key, autogain, beatgrid, waveform) están en XML y SQLite abiertos**: son insumo directo para el ordenador de mezclas y evitan re-analizar.
4. **Todo es scriptable** por VDJScript (~200 verbos): un mapeo de teclado o de controladora puede disparar `sampler_pad N`, `automix_skip`, etc. Si algún día queremos que la consola web controle VirtualDJ en vivo, la vía es VDJ Remote (puerto 4243) o OS2L.
5. **La máquina es el cuello de botella para stems** (GT 730). No planificar nada que dependa de separación de voces en tiempo real en este equipo.

## 8. Dónde vive la licencia y cómo funciona (2026-09-12)

**No hay archivo de licencia ni número de serie en el disco.** Revisado: registro (`HKCU\Software\VirtualDJ` y `HKLM\SOFTWARE\VirtualDJ` solo guardan `RunFolder64` y `HomeFolder`), la carpeta de datos (solo `database.xml` y `settings.xml`), y no existen `.lic`, `.key` ni `.drm`. El MSI tampoco instala nada de licencia.

**La licencia es la cuenta de usuario en virtualdj.com**, y se comprueba en línea cada vez que arranca:
1. `settings.xml` guarda la sesión: `internetLogin` (vacío en esta máquina = no hay cuenta iniciada), `stayLoggedIn=yes`, `dontLogin=no`, `autoRefreshDRM=yes`.
2. Al iniciar, el exe llama a `live.virtualdj.com/live/oauth.php` (login) y a `drm8.php` (validación de derechos) sobre HTTPS con OpenSSL embebido; `subs.php` consulta suscripciones, `getkey.php`/`addkey.php` registran claves de producto compradas, `managecl.php` gestiona "Content Unlimited" (Tidal, etc.) y `logcu.php` registra el consumo de ese contenido.
3. La respuesta define la edición: cadenas `License: LE (full trial period)`, `PRO trial - %i days left`, `PRO trial - expired`, `License: PRO Infinity`, `VirtualDJ PRO Business`, `Monthly subscription`, `subscription active/blocked/ended on %s`.
4. Identificación de equipo: usa `GetVolumeInformationW` (serial del volumen) y UUIDs, no hay un archivo de "hardware id" persistente.

**Qué limita cada edición (según los textos del propio programa):**
- Sin licencia (Home/LE): la app completa funciona con teclado y ratón; aparece publicidad (`buy any license to remove the ads`); **controladoras y timecodes solo 10 minutos seguidos** (`Without a license, you can use a controller only for 10mn at a time`); no se pueden usar mapeos personalizados (`Custom definitions require a Pro license`); algunos plugins piden Pro.
- Controladoras "Limited Edition" (vienen con licencia incluida para ese hardware): funcionan sin límite solo con esa controladora (`CONTROLLER LICENSE`, `ANALOG MIXER LICENSE`).
- PRO Infinity (pago único) / PRO Business (mensual): sin límites; Business añade streaming de catálogos.
- El contenido de Tidal/SoundCloud/Beatport exige suscripción aparte al proveedor (`TIDAL HiFi Plus subscription required`) y no se exporta (`Songs from a music subscription can not be exported`); el caché en línea caduca (`Online content cache expired`).

**Estado en esta máquina:** no hay cuenta iniciada en settings (`internetLogin` vacío), por lo que corre como Home/LE gratuita. Sí hay tokens de Tidal guardados (sesión de streaming), que son independientes de la licencia de VDJ. Para uso en fiestas con solo teclado/ratón y música local no hace falta licencia; haría falta si se conecta una controladora más de 10 minutos.
