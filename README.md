# DJ — Música para fiestas

Documentación del proyecto de DJ para fiestas: análisis de la biblioteca musical, mezclas automáticas, identificación de grabaciones y diseño de una consola de locutor (soundboard) web.

La biblioteca de audio vive en Google Drive (`G:\Mi unidad\Musica fiestas`); este repo guarda solo la documentación y los hallazgos.

## Documentos

| Documento | Contenido |
|---|---|
| [docs/PROYECTOS.md](docs/PROYECTOS.md) | Índice de proyectos, estado de cada uno y hallazgos (mix automático, identificación de Recording_65, prueba de mezcla Caballo Dorado x Que Pasa) |
| [docs/ANALISIS_COMPETENCIA_SOUNDBOARD.md](docs/ANALISIS_COMPETENCIA_SOUNDBOARD.md) | Comparativa de apps de soundboard (Discord, Voicemod, Soundpad, MyInstants, Big Button Box) y listado priorizado de features |
| [docs/LENGUAJE_Y_FEATURES_RADIO.md](docs/LENGUAJE_Y_FEATURES_RADIO.md) | Vocabulario real de cabina de radio, sonidos más usados y features priorizados por diversión y uso |
| [docs/RANKINGS_GLOBALES.md](docs/RANKINGS_GLOBALES.md) | Top 50 global de Spotify y líderes de charts Latin, Tropical y Rock (septiembre 2026) |
| [docs/VIRTUALDJ_ARQUITECTURA.md](docs/VIRTUALDJ_ARQUITECTURA.md) | Inventario de la instalación de VirtualDJ: estructura de datos (database.xml, settings, sampler, historial) y qué reutilizar |
| [docs/VIRTUALDJ_ARQUITECTURA_BINARIO.md](docs/VIRTUALDJ_ARQUITECTURA_BINARIO.md) | Arquitectura interna del ejecutable: PE, motor de audio (ASIO/WASAPI, Elastique, ffmpeg), stems con DirectML/CUDA, skins XML + VDJScript, plugins, MSI y formato .vdjsample |
| [docs/ARQUITECTURA_NUESTRA_APP.md](docs/ARQUITECTURA_NUESTRA_APP.md) | Propuesta de arquitectura de nuestra app "Cabina": alcance por versiones, hexagonal con archivos concretos, flujo offline y plan de construcción |
| [docs/ARQUITECTURA_HEXAGONAL.md](docs/ARQUITECTURA_HEXAGONAL.md) | Arquitectura hexagonal propia de la app: dominio, puertos primarios y secundarios, adaptadores, composición, pruebas y evolución |
| [app/](app/) | Código fuente de Cabina: la consola de sonidos construida, con 48 pruebas automáticas. [Ver publicada](https://claude.ai/code/artifact/b1fb97b7-03a1-4c2b-adf3-06a4d05dd523) |
| [docs/IDENTIFICACION_RECORDING_65.md](docs/IDENTIFICACION_RECORDING_65.md) | Resultado final del intento de identificar canciones dentro de Recording_65.m4a por huella acústica: sin coincidencias reales, con explicación y alternativas |
| [docs/REINGENIERIA_CABINA_V2.md](docs/REINGENIERIA_CABINA_V2.md) | Revisión de la v1 contra la lista de features y plan/implementación de la v2 |
| [docs/ANALISIS_FEATURES_VIRTUALDJ.md](docs/ANALISIS_FEATURES_VIRTUALDJ.md) | Análisis completo de features de VirtualDJ (17 áreas) y qué significa "mejor para nosotros"; base del módulo DJ de Cabina v3 |

## Regla de trabajo

Todo hallazgo se documenta en los MD de `docs/` y se sube a este repo.
