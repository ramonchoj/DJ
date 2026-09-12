# Arquitectura de nuestra app — "Cabina" (propuesta 2026-09-12)

Propuesta de diseño para nuestra propia aplicación, tomando lo aprendido de VirtualDJ ([VIRTUALDJ_ARQUITECTURA_BINARIO.md](VIRTUALDJ_ARQUITECTURA_BINARIO.md)) y las decisiones previas: app web, arquitectura hexagonal, funciona sin señal, no es PWA instalable, y arranca como consola de locutor. Nombre de trabajo: **Cabina** (se cambia cuando quieras).

## 1. Qué copiamos de VirtualDJ y qué no

| VirtualDJ | Nosotros | Por qué |
|---|---|---|
| Un exe C++ con motor propio sobre Direct3D | Una app web (HTML + JS) que corre en el navegador del celular | Cero instalación, corre en cualquier teléfono, se abre con un link |
| Programa inmutable + datos del usuario en XML/M3U fuera | Código inmutable + datos del usuario en IndexedDB (y export/import a JSON) | Misma separación: se puede actualizar la app sin tocar los datos |
| Skins XML declarativos + VDJScript (acciones en texto) | Tablero declarativo en JSON + acciones nombradas (`play`, `stop_all`, `toggle_loop`) | Los botones son datos, no código: se editan sin programar |
| Sampler: bancos → pads con nombre/color/acción, modo on-off / loop / stutter | Bancos → pads con nombre/color/acción, modos disparo / loop / mantener | Es el modelo validado por el mercado y por el análisis de radio |
| ASIO/WASAPI + Elastique | Web Audio API (AudioContext, GainNode, AudioBufferSourceNode) | Es lo único disponible en navegador; latencia de ~20-50 ms, suficiente para efectos |
| Stems con IA (410 MB de modelos, GPU) | **No** | Fuera de alcance y del hardware disponible |
| Licencia por cuenta online con DRM | **No** en V1. Si se comparte con más gente: código de acceso simple, sin servidor | El objetivo es uso propio en fiestas, no vender |
| database.xml con BPM/key/cues | Reutilizamos su database.xml como fuente de análisis (lectura), no lo reemplazamos | Ya tiene 207 pistas analizadas |

## 2. Alcance por versiones

- **V1 — Consola de locutor** (lo acordado): pads con sonidos propios y de fábrica, categorías tipo radio, solapar sonidos, botón de pánico, volumen general e individual, cama musical en loop, botón ruleta, funciona sin internet una vez cargada, export/import del tablero.
- **V2 — Deck de música**: un reproductor de playlist (M3U) al lado de los pads, con fade automático entre canciones usando los puntos de automix que VirtualDJ ya calculó. Sigue siendo la misma app.
- **V3 — Dos decks + crossfader**: solo si V2 se queda corto en una fiesta real.

Cada versión suma un adaptador y un par de casos de uso; el dominio no cambia.

## 3. Arquitectura hexagonal (concreta, con archivos)

```
src/
├── domain/                  ← reglas puras, sin navegador
│   ├── Sound.js             entidad: id, nombre, color, categoría, modo (oneshot|loop|hold), ganancia, tecla
│   ├── Bank.js              banco/categoría: nombre, orden, lista de pads (slot → soundId)
│   ├── Board.js             tablero completo: bancos, invariantes (sin slots ni teclas duplicadas)
│   └── errors.js
├── application/             ← casos de uso; solo hablan con puertos
│   ├── ports.js             SoundRepository, AudioPlayer, Clock, Importer/Exporter
│   ├── AddSound.js          recibe archivo → normaliza volumen → guarda blob + entidad
│   ├── TriggerPad.js        resuelve modo (oneshot/loop/hold) y manda al AudioPlayer
│   ├── StopAll.js
│   ├── EditBoard.js         renombrar, recolorear, mover, borrar, asignar tecla
│   ├── RandomPad.js         "ruleta": elige un sonido de una lista y lo dispara
│   └── ExportImportBoard.js JSON con metadatos + audios en base64 (o ZIP)
├── adapters/                ← todo lo que toca el navegador
│   ├── audio/WebAudioPlayer.js      AudioContext, un GainNode maestro, uno por sonido, buffers decodificados en memoria
│   ├── audio/Normalizer.js          mide RMS/pico al importar y calcula la ganancia (equivale al autogain de VDJ)
│   ├── storage/IndexedDbRepository.js  dos stores: `sounds` (metadatos) y `blobs` (audio)
│   ├── storage/LocalDraft.js        último banco abierto, volumen, etc. (localStorage)
│   ├── ui/                          render del tablero, gestos táctiles, teclado, diálogos
│   └── vdj/VdjSampleImporter.js     lee .vdjsample (salta 112 bytes → Ogg) y bancos XML de VirtualDJ
└── main.js                  ← composición: instancia adaptadores y los inyecta en los casos de uso
```

Regla de oro: `domain/` y `application/` no importan nada de `adapters/`. Así se prueban con Node sin navegador, y si mañana cambiamos IndexedDB por archivos o Web Audio por otra cosa, no se toca el núcleo.

## 4. Cómo funciona en uso

1. **Primera vez (con internet)**: abres el link, la app carga y ya trae los sonidos de fábrica (los 24 de VirtualDJ convertidos a Ogg + los clásicos de radio que falten). Subes tus propios audios desde el celular.
2. **En la fiesta (sin señal)**: el navegador ya tiene la app y los audios en IndexedDB. Abres la pestaña y funciona. Conectas el parlante por Bluetooth como siempre; el navegador manda el audio por ahí.
3. **Tocar un pad**: `TriggerPad` → `WebAudioPlayer.play(id)` crea un `AudioBufferSourceNode` desde el buffer ya decodificado (por eso no hay retraso), pasa por el gain del sonido y el gain maestro. Modo *disparo*: suena hasta terminar; *loop*: repite hasta que lo vuelvas a tocar; *mantener*: suena mientras tengas el dedo.
4. **Cama musical**: un pad en modo loop con volumen bajo; hablas encima por el micrófono del parlante o del celular.
5. **Pánico**: `StopAll` corta todos los nodos con un fade de 50 ms para que no truene.
6. **Respaldo**: `ExportBoard` genera un archivo `.cabina.json` (o `.zip`) que guardas en Drive; `ImportBoard` lo restaura en otro celular.

## 5. Decisiones técnicas ya tomadas y sus razones

- **Sin frameworks pesados**: JavaScript moderno con módulos ES, sin React/Vue. La app cabe en un solo archivo HTML + módulos, carga rápido en celular viejo y no hay build.
- **Sin service worker por ahora** (no PWA): el "offline" se logra porque el navegador mantiene la pestaña y los datos en IndexedDB. Riesgo aceptado: si se cierra la pestaña sin señal y el navegador purga el caché, hay que volver a cargar. Mitigación: export/import + mantener la pestaña abierta durante el evento. Si en la práctica falla, agregar service worker es un adaptador más, no un rediseño.
- **Audio decodificado en memoria** al abrir la app (no al tocar): un celular medio aguanta cómodamente 50-100 sonidos cortos.
- **Normalización al importar** (no al reproducir): se calcula una vez, como el autogain de VirtualDJ.
- **Formatos aceptados**: mp3, ogg, wav, m4a (lo que decodifica el navegador) + `.vdjsample` vía importador.

## 6. Qué falta decidir (para empezar a construir)

1. **Aspecto visual**: (a) grilla limpia de botones de colores tipo app móvil, o (b) look de consola de radio (fondo oscuro, VU-meter, perillas). Recomiendo (a) para V1 por legibilidad en fiesta con poca luz y dedos rápidos; el (b) puede ser un "skin" después, igual que en VDJ.
2. **Sonidos de fábrica**: usar los 24 de VirtualDJ + completar con los clásicos de radio (rimshot, redoble, scratch stop, campana correcto/incorrecto) de bancos libres (CC0).
3. **Categorías iniciales**: Jingles · Cortinillas · Golpes · Efectos · Camas (del análisis de radio). ¿Se agrega "Mis sonidos" como banco libre?
4. **Nombre real de la app**.

## 7. Plan de construcción (cuando digas "adelante")

| Paso | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `domain/` + `application/` con pruebas en Node | `node --test` en verde, sin navegador |
| 2 | Adaptador Web Audio + IndexedDB, tablero mínimo con 5 pads de fábrica | Se abre en el celular, suena, se solapa, pánico funciona |
| 3 | Importar audios propios + normalización + editar/borrar/mover | Subir 3 mp3 de distinto volumen y que suenen parejo |
| 4 | Bancos/categorías, cama en loop, ruleta, teclas | Prueba de 10 minutos simulando una fiesta |
| 5 | Export/import + importador de .vdjsample | Restaurar el tablero en otro navegador |
| 6 | Prueba real sin señal (modo avión) con parlante Bluetooth | Checklist en este documento |
