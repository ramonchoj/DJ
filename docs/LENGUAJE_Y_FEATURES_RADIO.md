# Lenguaje de radio y features priorizados por diversión/uso

Complemento a [ANALISIS_COMPETENCIA_SOUNDBOARD.md](ANALISIS_COMPETENCIA_SOUNDBOARD.md): esta vez el foco es cómo trabajan de verdad los locutores de radio con su consola ("cart machine" / soundboard), su vocabulario, y qué features son las más divertidas y más usadas en la práctica.

## 1. Vocabulario real de radio (para nombrar bien las cosas en la app)

En cabina de radio, el "tablero de sonidos" no se llama soundboard a secas: cada tipo de clip tiene su propio nombre y función. Vale la pena usar estos términos (traducidos) como las **categorías** de la app, en vez de inventar categorías genéricas:

| Término en inglés | Qué es | Equivalente / nombre sugerido en español |
|---|---|---|
| **Cart** / Cart Wall | Viene de los antiguos "cartuchos" de cinta; hoy es cualquier clip corto listo para disparar con un botón | "Cartucho" o simplemente "sonido" |
| **Jingle** | Pieza musical producida, a veces cantada, con el nombre del locutor o la frase de la estación/fiesta | "Jingle" (ya se usa igual en español) |
| **Sweeper** (también liner, bumper, stinger, ID, ident, promo, shotgun) | Clip corto (≤20s) que anuncia algo o hace transición entre canciones | "Cortinilla" / "Transición" |
| **Stinger** | Golpe sonoro muy corto (1-2s) que remarca un momento (ej. el "dun-dun" dramático, o el platillo tras un chiste) | "Golpe" o "remate" |
| **Music bed** | Música de fondo en loop, de bajo volumen, para hablar encima | "Cama musical" |
| **Cart Pad** | Un botón que dispara varios clips en secuencia (cada click, el siguiente) | "Pad de secuencia" |
| **Hot key / Hot Jingle Player** | Asignar una tecla del teclado (A-Z) a un sonido, para dispararlo sin tocar la pantalla | "Tecla rápida" |

**Aplicación directa**: en vez de una sola grilla plana, conviene tener pestañas/categorías con estos nombres reales: *Jingles*, *Cortinillas*, *Golpes/Remates*, *Camas musicales*, *Efectos graciosos*. Esto no es solo estética — cada categoría implica un comportamiento distinto (loop sí/no, volumen relativo, se puede solapar con música o no), que conviene reflejar en el diseño.

## 2. Los sonidos que de verdad más se usan (los "clásicos")

De la investigación en sitios de efectos para radio/streaming, estos son los que aparecen una y otra vez como los más populares — son un buen punto de partida para pre-cargar la consola:

- **Aplausos** (applause) y **abucheo** (booo)
- **Bocina de aire / claxon de triunfo** (air horn) — para anunciar algo en grande
- **Rimshot / "ba-dum-tss"** — el golpe clásico después de un chiste malo
- **Risa enlatada** (laugh track)
- **Redoble de tambor** (drum roll) — antes de un anuncio o resultado
- **Frenado de disco de vinil / "scratch stop"** — para cortar la música de golpe con efecto cómico
- **Tape stop** (la música se "derrite"/ralentiza de golpe) — para interrupciones cómicas
- **Sirena** y **alarma**
- **Campana/timbre** ("ding" de correcto, "buzzer" de incorrecto) — muy usado en juegos de fiesta, trivias, retos

Esto confirma que **no hace falta un banco gigante de sonidos**: con 15-20 bien elegidos (los de la lista de arriba) ya se cubre el 80% del uso real en una fiesta o transmisión en vivo. El resto es lo que el usuario suba de su propia cosecha (bromas locales, nombres de invitados, frases del anfitrión).

## 3. Features re-priorizados por "diversión" y "frecuencia de uso real"

Cruzando lo anterior con el análisis de competencia previo, esta es la priorización final sugerida:

### Nivel 1 — Lo que se usa en CADA sesión (innegociable)
1. Botones grandes con nombre/color/ícono, agrupados por categoría tipo radio (jingles, cortinillas, golpes, efectos, camas).
2. Solapar sonidos libremente (un golpe de tambor mientras sigue la música de fondo).
3. Botón de pánico ("detener todo") — imprescindible cuando algo se sale de control.
4. Volumen general + volumen individual por botón (para que el aplauso no truene más que la sirena).
5. Subir sonidos propios desde el celular al toque.

### Nivel 2 — Lo que más "engancha" y hace que se sienta divertido de usar
6. **Music bed / cama musical con loop**: poder dejar una base sonando en bucle de fondo mientras el anfitrión habla encima — es lo que separa una consola "amateur" de una que se siente profesional.
7. **Golpes/stingers dedicados** a eventos: "chiste malo" (rimshot), "algo salió mal" (record scratch), "gran anuncio" (air horn + redoble). Preconfigurar estos 3-5 como categoría fija de fábrica.
8. **Cart Pad tipo "ruleta"**: un botón que cada vez que se toca dispara un sonido random de una lista (por ejemplo 5 variantes de risas o de "wow") — le da variedad sin que el usuario tenga que pensar cuál tocar.
9. Cambio de tono (pitch) en vivo sobre cualquier sonido — es el feature que la gente más comparte en redes cuando prueba un soundboard, por lo cómico del resultado.

### Nivel 3 — Pulido, no crítico pero suma profesionalismo
10. Normalización automática de volumen al subir un sonido.
11. Buscador de sonidos (útil cuando ya hay muchos).
12. Reordenar botones arrastrando.
13. Tecla rápida (teclado físico) por botón, para quien conecte el celular/tablet a un teclado externo en el evento.
14. Exportar/importar el tablero como respaldo.

## 4. Conclusión para el diseño de la app

- Usar **el vocabulario real de radio** (Jingle, Cortinilla, Golpe, Cama musical) como categorías, no términos genéricos tipo "Categoría 1".
- Pre-cargar la consola con los **10-15 sonidos clásicos** de la sección 2 el día que se construya (aplausos, air horn, rimshot, redoble, scratch stop, sirena, campana correcto/incorrecto), para que se sienta "lista para usar" desde el primer momento, y el usuario solo agregue lo suyo encima.
- Priorizar cama musical en loop + golpes dedicados + botón "ruleta" como los tres features que más "se sienten" divertidos en uso real, por encima de cosas como pitch shift (que es vistoso pero secundario) o exportar/importar (necesario pero invisible).

## Fuentes consultadas
- Radio.co: glosario de radio y guía de efectos de sonido para programas de radio.
- Live365 / RadioKing / CloudRadio: guías de "radio imaging" (jingles, sweepers, stingers, IDs).
- MusicRadioCreative: definición de sweeper y software de automatización/jingles de radio.
- MixCityInc (Kueit), CartLayer: software real de cart wall / soundboard para radio en vivo.
- Motionarray, SoundBible, Mixkit, ZapSplat, Filmora: listados de efectos de sonido más usados (aplausos, air horn, rimshot, laugh track, tape stop).

## Estado
Completado. Pendiente: decidir junto con el usuario cuáles sonidos de fábrica se incluyen y confirmar la lista de categorías antes de empezar a construir.
