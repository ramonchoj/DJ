# Cabina v3 — consola de locutor + DJ para fiestas

App web tipo soundboard/consola de locutor. Arquitectura hexagonal en JavaScript puro (sin frameworks, sin build), pensada para abrirse en el celular durante una fiesta y seguir funcionando sin señal después de la primera carga.

**Publicada en**: https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523

Documentación de diseño completa: [../notas/ARQUITECTURA_HEXAGONAL.md](../docs/ARQUITECTURA_HEXAGONAL.md).

## Novedades v3: módulo DJ (ver docs/ANALISIS_FEATURES_VIRTUALDJ.md)

Un sistema de DJ pensado para lo que VirtualDJ no resuelve en una fiesta real: corre en el celular sin instalar nada, funciona sin señal, y la consola de pads y la música viven en un solo tablero con *talkover* automático.

- **Biblioteca** propia (mp3/m4a/wav…) guardada en el dispositivo, con análisis en el navegador: duración, ganancia automática y **BPM** (autocorrelación de onsets; en pruebas dio 134.0 y 107.6 donde VirtualDJ tiene 134.0 y 107.3).
- **Importa el `database.xml` de VirtualDJ**: BPM, tono, hot cues y puntos de mezcla de las canciones que VirtualDJ ya analizó, sin re-analizar.
- **Dos decks** con forma de onda, play/pausa, 4 hot cues, loops de 4/8 beats alineados al BPM, tempo ±12 %, **SYNC** (iguala BPM, acepta doble/mitad), EQ de 3 bandas con *kill* (200/1700/6500 Hz, como VirtualDJ), volumen, y bloqueo para no cargar encima del deck que suena.
- **Mezclador** con crossfader (curva "full") y maestro, medidores por deck.
- **Automix con cola**: mezcla sola en el punto de salida (el de VirtualDJ si existe, si no `duración − fade`), con beatmatch opcional y "Mezclar ya".
- **Talkover**: cuando suena un pad de la consola, la música baja al factor de ducking y vuelve sola.
- **Grabar sesión**: graba todo lo que suena (pads + decks) a un archivo webm/opus (m4a en Safari), como el record de VirtualDJ.
- Selector **Pads / DJ / Ambos** arriba; todo dentro de la misma arquitectura hexagonal (`src/dj/{dominio,aplicacion,adaptadores}`), 27 pruebas propias.

## Novedades v2 (reingeniería completa, ver docs/REINGENIERIA_CABINA_V2.md)

- Pestañas por categoría + vista "Todo", buscador en vivo, diálogos propios (sin `prompt()`).
- Volumen y **tono (−12..+12 semitonos)** por sonido, emoji por pad, arrastrar y soltar para reordenar, mover entre bancos.
- **Camas musicales**: bancos marcados ♫ cuyos loops bajan solos (ducking) cuando suena un golpe encima y suben al terminar.
- Modo **"un sonido a la vez"** configurable; **grabadora rápida** con el micrófono (🎙 en cada banco).
- Indicador de "sonando" con barra de progreso en cada pad, medidor de nivel (VU) en la barra superior.
- **Service worker**: abre sin señal aunque se haya cerrado el navegador (sigue sin ser PWA instalable).
- Los tableros v1 guardados se migran solos.

## Qué hace

- Pads de sonido organizados en bancos/categorías (Golpes, Efectos), con 10 sonidos de fábrica **sintetizados en el propio navegador** (aplausos, air horn, sirena, redoble, rimshot, campana correcto/incorrecto, frenado de disco, explosión, risas) — no descarga ningún archivo de audio externo.
- Subir sonidos propios desde el celular (input file), con normalización automática de volumen.
- Cuatro modos de disparo: un tiro, loop, mantener presionado, exclusivo (para camas musicales que se cortan entre sí).
- Botón de pánico (detener todo), volumen general, pad "ruleta" (sonido aleatorio del banco), teclas rápidas.
- Todo se guarda en IndexedDB del navegador: funciona sin internet después de la primera carga.
- Exportar/importar el tablero completo como respaldo (JSON con audios en base64).

## Arquitectura

```
src/
├── dominio/        Tablero, Banco, Sonido + valores (ModoDisparo, Ganancia, TeclaRapida) — sin dependencias
├── aplicacion/      ConsolaAPI (fachada) + casos de uso, puertos secundarios
├── adaptadores/     Web Audio, IndexedDB, UI táctil, teclado, empaquetado JSON, síntesis de sonidos de fábrica
└── main.js          raíz de composición
```

Ver el análisis completo en `docs/ARQUITECTURA_HEXAGONAL.md` del repo.

## Desarrollo

```bash
npm test   # 106 pruebas de dominio + aplicación con node --test, sin navegador
npm run dev  # sirve la carpeta en http://localhost:8080
```

## Publicar una actualización

El contenido servible vive en `artifact_body.html` (sin `<!doctype>`/`<html>`/`<head>`/`<body>`, los envuelve el hosting) + todo `src/**/*.js`. `index.html` es la versión de documento completo para desarrollo local.
