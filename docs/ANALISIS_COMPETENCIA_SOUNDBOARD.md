# Análisis de la competencia — Apps de soundboard / consola de locutor

Investigación de mercado (2026-09-12) sobre apps y herramientas de "soundboard" (tableros de sonido) existentes, para definir qué features llevar a la consola de locutor propia.

## Apps analizadas

### 1. Discord Soundboard (nativo)
- Tablero integrado por servidor, con 24 slots (servidores normales) o 48 (servidores con boost).
- Límite de clip: 5.2 segundos y 512 KB por sonido; solo MP3/OGG.
- Subir sonidos propios es exclusivo de usuarios Nitro; los gratuitos solo pueden reproducir los que otros ya subieron.
- Sin atajos de teclado globales: hay que tener la ventana de Discord visible para tocar un botón (mala UX para gaming/streaming).
- **Aprendizaje**: los límites de duración/tamaño frustran a los usuarios — para nuestra consola de fiesta no tiene sentido limitar tanto.

### 2. Voicemod Soundboard (PC/Mac, gratis con límites)
- Librería comunitaria de 800,000+ sonidos + subida de audios propios.
- Asignación de sonido a tecla rápida (hotkey) para dispararlo en vivo.
- Reproduce el sonido mezclado con el micrófono en un solo canal de salida (streams, llamadas, juegos), latencia menor a 10ms.
- Setup mínimo: se instala como "micrófono virtual" y ya queda listo.
- **Aprendizaje**: la mezcla en tiempo real con baja latencia y el hotkey por sonido son el corazón de la experiencia "profesional".

### 3. Soundpad (Windows, pago único ~$4.99, con demo limitada a 10 sonidos)
- Hotkey individual por sonido + lista de sonidos tipo "deck".
- Grabador y editor de audio integrado, normalización de volumen (todos los sonidos al mismo nivel percibido).
- Soporta AAC, FLAC, MP3, OGG, Opus, WAV, WMA.
- Función "Auto Keys" tipo push-to-talk.
- **Aprendizaje**: la normalización de volumen es clave — sin ella, unos sonidos salen muy fuertes y otros casi inaudibles, algo muy molesto en una fiesta real.

### 4. MyInstants (web, sin instalación, gratis)
- 100% en navegador, sin descargar nada, reproducción instantánea sin buffering.
- Sonidos organizados por categorías y etiquetas (juegos, películas, "molestos", graciosos, etc.).
- Buscador de sonidos.
- Favoritos guardados en cuenta de usuario (requiere registro).
- Los usuarios pueden subir y compartir sus propios sonidos con la comunidad.
- **Aprendizaje**: la barrera de entrada más baja posible (cero instalación, un clic) es lo que la hizo masiva. Aplica directo a nuestra idea de "app web".

### 5. Big Button Box (iOS/Android, app de pago/freemium)
- Grid de botones grandes y coloridos, +100 sonidos incluidos de fábrica.
- Reordenar botones (drag & drop) o aleatorizar el orden.
- "Pitch shift": cambiar el tono del sonido al reproducirlo (efecto de voz aguda/grave).
- Tres modos de reproducción: menú de lista, botones grandes a pantalla completa, uno a la vez.
- Graba tu sesión de uso ("performance") y la comparte.
- **Aprendizaje**: variar el pitch en vivo agrega un factor de diversión extra sin necesitar sonidos nuevos.

### 6. SoundBoard (App Store) / Meme Soundboard / Sound Buttons (apps móviles genéricas)
- Permiten cargar audios propios y organizarlos en botones personalizables.
- Pensadas para presentaciones, streams, conferencias y sesiones en vivo.
- Bancos de sonidos predefinidos: aplausos, sirenas, risas, alarmas, bocinas.
- Mezclar/combinar varios botones sonando a la vez.

## Tabla comparativa de features

| Feature | Discord | Voicemod | Soundpad | MyInstants | Big Button Box | Apps genéricas móviles |
|---|---|---|---|---|---|---|
| Subir audio propio | Solo Nitro | Sí | Sí | Sí (con cuenta) | No (banco fijo) | Sí |
| Hotkey por sonido | No | Sí | Sí | No | No | Rara vez |
| Solapar sonidos | Limitado | Sí | Sí | Sí | Sí | Sí |
| Categorías/etiquetas | No | Parcial | No | Sí | No | A veces |
| Normalización de volumen | No | No indicado | Sí | No aplica | No | No |
| Cambio de tono (pitch) | No | Sí (voz) | No | No | Sí | No |
| Funciona sin instalar | No | No | No | Sí (web) | No | No |
| Funciona sin internet | No (requiere Discord) | No (requiere app) | Sí (una vez instalado) | No (requiere red) | Sí (una vez instalada) | Sí (una vez instalada) |
| Reordenar botones | No | No | No | No | Sí (drag&drop) | A veces |
| Buscador de sonidos | No | Sí (librería) | No | Sí | No | A veces |
| Grabar la sesión de uso | No | No | Sí (el sonido) | No | Sí | No |
| Gratis sin límites | No | Con límites | No (pago) | Sí | No (freemium) | Con anuncios |

## Listado consolidado de features candidatas para nuestra consola

**Imprescindibles (lo que todo soundboard serio tiene):**
1. Subir audios propios desde el celular, sin depender de un banco fijo.
2. Botones grandes, con nombre y color, organizados en grilla.
3. Poder solapar sonidos (que no se corten entre sí al tocar varios).
4. Botón de "detener todo" (pánico).
5. Funcionar sin conexión después de la primera carga (nuestro caso ya lo resuelve al guardar todo localmente).

**Muy recomendables (diferenciadores reales, poco comunes juntos):**
6. **Normalización de volumen automática** al subir un sonido (evita que uno truene y otro casi no se oiga) — nadie lo hace bien excepto Soundpad, que es de pago y de escritorio.
7. **Categorías o pestañas** (ej. "risas", "aplausos", "efectos", "cumbia/salsa stingers") — inspirado en MyInstants.
8. **Buscador** de sonidos por nombre, útil cuando la lista crece.
9. **Reordenar/arrastrar botones** — inspirado en Big Button Box.
10. **Control de volumen individual por botón**, además del general.
11. **Vista "cero-fricción"**: abrir el link y ya, sin instalar nada — inspirado en MyInstants, y es justo lo que ya definimos (sin PWA instalable).

**Opcionales / a evaluar según qué tanto se quiera parecer a un "locutor de radio" real:**
12. Cambio de tono (pitch) en vivo, tipo Big Button Box, para dar efecto cómico.
13. Grabadora rápida: grabar un sonido nuevo directo con el micrófono del celular (por ejemplo, grabar la voz del anfitrión diciendo el nombre de alguien) en vez de solo subir archivos.
14. Exportar/importar el tablero completo como respaldo (ya que decidimos no usar PWA instalable, esto cubre el riesgo de perder datos si se borra caché del navegador).
15. Modo "un sonido a la vez" vs "modo libre" (solapado), configurable, para fiestas donde no se quiere ruido encimado.

## Fuentes consultadas
- Discord Soundboard (guía y límites): VoxBooster blog, soporte oficial de Discord.
- Voicemod Soundboard: voicemod.net, centro de ayuda de Voicemod.
- Soundpad: soundpad.net, reseñas de terceros.
- MyInstants: sitio oficial y apps derivadas en tiendas.
- Big Button Box: App Store (MWM), reseñas de terceros.
- Apps genéricas: Google Play y App Store (búsquedas "soundboard", "meme soundboard", "sound buttons").

## Estado
Completado. Pendiente decidir con el usuario cuáles de la lista "muy recomendables" y "opcionales" entran a la primera versión.