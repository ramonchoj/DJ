# Cabina — consola de sonidos para fiestas

App web tipo soundboard/consola de locutor. Arquitectura hexagonal en JavaScript puro (sin frameworks, sin build), pensada para abrirse en el celular durante una fiesta y seguir funcionando sin señal después de la primera carga.

**Publicada en**: https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523

Documentación de diseño completa: [../notas/ARQUITECTURA_HEXAGONAL.md](../docs/ARQUITECTURA_HEXAGONAL.md).

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
npm test   # 48 pruebas de dominio + aplicación con node --test, sin navegador
npm run dev  # sirve la carpeta en http://localhost:8080
```

## Publicar una actualización

El contenido servible vive en `artifact_body.html` (sin `<!doctype>`/`<html>`/`<head>`/`<body>`, los envuelve el hosting) + todo `src/**/*.js`. `index.html` es la versión de documento completo para desarrollo local.
