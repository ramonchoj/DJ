# Reingeniería Cabina v2 (2026-09-12)

Revisión de la consola construida (v1) contra la lista de features de [ANALISIS_COMPETENCIA_SOUNDBOARD.md](ANALISIS_COMPETENCIA_SOUNDBOARD.md) y [LENGUAJE_Y_FEATURES_RADIO.md](LENGUAJE_Y_FEATURES_RADIO.md), y plan de la v2. Objetivo: el mismo sistema, 100% web, con todos los puntos de la lista, para usarlo como base de pruebas y de los siguientes sistemas.

## 1. Qué tenía la v1 y qué le faltaba

| # | Feature de la lista | v1 | v2 |
|---|---|---|---|
| 1 | Subir audios propios | Sí | Sí |
| 2 | Botones grandes con nombre/color, en grilla | Sí | Sí + emoji opcional + indicador de "sonando" con barra de progreso |
| 3 | Solapar sonidos | Sí | Sí |
| 4 | Botón de pánico | Sí | Sí |
| 5 | Funciona sin conexión | Solo mientras la pestaña siga abierta (IndexedDB) | **Service worker** que cachea la app y los audios de fábrica: abre sin señal aunque se haya cerrado el navegador. Sigue sin ser PWA instalable (no hay manifest) |
| 6 | Normalización automática de volumen | Sí | Sí |
| 7 | Categorías / pestañas | Bancos apilados en una sola columna larga | **Pestañas por banco** + vista "Todo" |
| 8 | Buscador | No | **Sí**, filtra pads en vivo por nombre en todos los bancos |
| 9 | Reordenar / arrastrar botones | No (solo por API) | **Sí**: arrastrar y soltar en escritorio; en el diálogo de edición "mover a" para táctil; bancos con ↑/↓ |
| 10 | Volumen individual por botón | Solo la ganancia automática, no editable | **Sí**, control en el diálogo del sonido (se multiplica con la normalización) |
| 11 | Cero fricción (abrir link y ya) | Sí | Sí |
| 12 | Cambio de tono (pitch) en vivo | No | **Sí**, −12 a +12 semitonos por sonido |
| 13 | Grabadora rápida con el micrófono | No | **Sí**, botón 🎙 en cada banco, graba y lo deja como pad |
| 14 | Exportar / importar respaldo | Sí | Sí |
| 15 | Modo "uno a la vez" vs libre | No | **Sí**, interruptor global en ajustes |
| R6 | Cama musical con loop | Los modos LOOP/EXCLUSIVO existían, sin apoyo en la UI | **Bancos marcados como "cama"**: sus sonidos se atenúan solos (*ducking*) cuando suena un golpe encima, como en radio, y vuelven a subir al terminar |
| R8 | Pad ruleta | Sí (por banco) | Sí |
| — | Editar / borrar sonidos | Con ventanas `prompt()`, borrar roto | **Diálogo propio** con nombre, emoji, color, modo, tecla, volumen, tono, banco/slot, borrar con confirmación |
| — | Renombrar / borrar / reordenar bancos | Solo crear | Sí, todo desde la UI |
| — | Medidor de nivel (VU) | No | Sí, en la barra superior |

## 2. Cambios de arquitectura (sigue hexagonal)

**Dominio**
- `Sonido`: + `volumen` (0–1.5, editable, distinto de la `ganancia` automática), + `tono` (semitonos), + `emoji`.
- `Banco`: + `esCama` (marca de cama musical). Método `conSonidoEn` sin cambios.
- `Tablero`: + `ajustes` (objeto de valor `Ajustes`: `unoALaVez`, `ducking`), + `conBancosReordenados(ids)`, + `buscar(texto)`.
- Nuevo servicio de dominio `ReglasDeDucking`: qué sonidos activos deben atenuarse cuando entra uno nuevo (activos en bancos cama, si el nuevo no es de cama).

**Aplicación**
- `DispararPad`: aplica `volumen × ganancia`, `tasa = 2^(tono/12)`, modo uno-a-la-vez (corta todo lo que no sea cama), ducking (pide al reproductor atenuar las camas mientras dura el golpe).
- Nuevo caso de uso `GrabarSonido` (puerto `Grabadora`): iniciar → detener → `AgregarSonido`.
- `EditarTablero`: + `reordenarBancos`, + `marcarCama`, + `editarAjustes`.
- Puerto `Reproductor`: + `atenuar(soundIds, factor, ms)`, + `nivel()` (para el VU), `disparar` acepta `tasa`.
- Puerto nuevo `Grabadora`: `soportada()`, `iniciar()`, `detener() → Blob`.

**Adaptadores**
- `ReproductorWebAudio`: `playbackRate`, rampas de ganancia para atenuar, `AnalyserNode` en el master para el nivel.
- `GrabadoraMediaRecorder`: `getUserMedia` + `MediaRecorder`.
- `UITactil` reescrita: pestañas, buscador, diálogo `<dialog>`, arrastrar/soltar, indicador de sonando, VU, ajustes.
- `sw.js`: service worker cache-first del *app shell* y los audios de fábrica.
- Migración: los tableros v1 guardados en IndexedDB se cargan tal cual (los campos nuevos tienen valores por defecto).

## 3. Pruebas
Las 50 pruebas de la v1 siguen; se agregan pruebas de dominio (volumen, tono, ajustes, búsqueda, reordenar bancos, reglas de ducking) y de aplicación (tasa por tono, uno-a-la-vez, ducking, grabar sonido). Todo con `node --test`, sin navegador.

## 4. Publicación
- Repo: `app/` en https://github.com/ramonchoj/DJ (v2.0.0).
- Artifact de pruebas: https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523
- `cabina.softmotion.mx` se queda en v1 hasta que se apruebe la v2 tras las pruebas.
