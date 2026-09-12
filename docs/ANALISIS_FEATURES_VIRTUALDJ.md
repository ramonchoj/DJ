# Análisis completo de features de VirtualDJ 2023 (2026-09-12)

Fuente: inventario del binario instalado (`virtualdj.exe` build 7831: 206 verbos VDJScript identificados antes, ampliado ahora a familias completas; 208 lecturas `get_*`), `settings.xml` (17 secciones, 411 claves), `database.xml`, sampler y skins (ver [VIRTUALDJ_ARQUITECTURA.md](VIRTUALDJ_ARQUITECTURA.md) y [VIRTUALDJ_ARQUITECTURA_BINARIO.md](VIRTUALDJ_ARQUITECTURA_BINARIO.md)). Cada área lleva una nota de **qué nos sirve** para nuestro caso: DJ de fiestas con celular/laptop, sin señal, con consola de locutor integrada.

Leyenda de relevancia: ★★★ imprescindible para nosotros · ★★ útil · ★ no aplica.

## 1. Decks (reproducción) ★★★
Verbos: `play`, `play_pause`, `play_stutter`, `play_sync`, `play_onbeat`, `pause`, `stop`, `seek`, `goto_start`, `goto_first_beat`, `goto_bar`, `goto_mixpoint`, `song_pos`, `songpos_remain`, `songpos_warning`, `deck_select`, `deck1..4_disabled`, `masterdeck_auto`.
- 2 a 4 decks; carga de pista, play/pausa/stop con 3 modos de botón (`playMode`, `cueMode`, `stop_3button`), "play sync on beat".
- Posición con aviso de fin de canción (`endOfSongWarning`, `songpos_warning`).
- `keepPlayingPastEnd`, `keepPlayStatusOnLoadSong`, `resetPitchOnLoad`, `resetEqOnLoad`, `resetKeyOnLoad`.
**Para nosotros**: 2 decks bastan. Posición, tiempo restante y aviso de fin son clave para saber cuándo mezclar.

## 2. Tempo, pitch y sync ★★★
Verbos: `pitch`, `pitch_slider`, `pitch_bend`, `pitch_reset`, `pitch_zero`, `pitch_range` (±6/8/12/16/25/33/50/100%), `pitch_lock` (keylock/master tempo), `pitch_relative`, `sync`, `sync_hint`, `beat_tap`, `set_bpm`, `bpm`, `master_tempo`, `tempo`. Ajustes: `autoBPMMatch=smart`, `autoPitchLock`, `pitchRange=12`, `autoPitchRange`, `pitchResetSpeed`.
- Motor Elastique v3 (zplane) para cambiar tempo sin cambiar tono (keylock).
- Sync de BPM y de fase de beat entre decks.
**Para nosotros**: tempo ±12% y sync por BPM sí. Keylock de calidad profesional no existe en navegador sin librerías pesadas; se acepta que al subir tempo suba el tono (como un tocadiscos).

## 3. Cues y hot cues ★★★
Verbos (32): `cue`, `cue_button`, `cue_3button`, `cue_cup`, `hot_cue 1..8`, `hot_cue_stutter`, `cue_color`, `cue_display`, `cue_countdown/countup/counter`, `set_cue`, `goto_cue`, `quantize_setcue`, `updateHotCueOnCueCombo`, `autoSortCues`, `cueDisplay=name`. Guardados en `database.xml` como `<Poi Type="cue" Num=…>`.
**Para nosotros**: 4 hot cues por pista (intro, drop, coro, salida) es lo que se usa en fiesta.

## 4. Loops y beat jump ★★
Verbos (30): `loop`, `loop_in/out`, `loop_half/double`, `loop_roll`, `loop_back`, `loop_move`, `loop_exit`, `loop_adjust`, `loop_save/load/delete/color`, `loopDefault=4`, `loopRollDefault=0.25`, `smartLoop`, `quantizeLoop`, `loopAutoMove`, `beatjump 1/2/4/8`, `beat_juggle`, `slicer`, `beatmasher`.
**Para nosotros**: loop automático de 4/8 beats alineado al grid, para estirar un coro. Slicer/masher no.

## 5. Mezclador, EQ y filtro ★★★
Verbos: `crossfader`, `crossfader_curve` (Full/…), `crossfader_hamster`, `crossfader_disable`, `volume`, `gain`, `gain_relative`, `master_volume`, `master_balance`, `eq_low/mid/high`, `eq_kill_*`, `eq_low_freq/eq_mid_freq/eq_high_freq` (200 / 1700 / 6500 Hz en la config), `eq_mode ModernEQ`, `eq_crossfader_*` (EQ ligado al crossfader), `filter`, `filter_resonance`, `filter_type`, `autoGain`, `gainSliderIncludesAutoGain`, `zeroDB`.
**Para nosotros**: crossfader con curva, EQ de 3 bandas con "kill", ganancia automática por pista (ya la tenemos en Cabina), filtro simple.

## 6. Automix ★★★
Verbos: `automix`, `automix_skip`, `automix_add_next`, `automix_dualdeck`, `automix_editor`, `automix_editor_movetrack`, `get_automix`, `get_automix_position`, `get_automix_song`. Ajustes: `automixMode=smart` (usa los puntos `realStart/realEnd/fadeStart/fadeEnd/cutStart/cutEnd/tempoStart/tempoEnd` que calcula por pista), `fadeLength=4 s`, `autoMixBeatMatchOnFade`, `automixSkipLength`, `automixRepeat`, `automixAutoRemovePlayed`, `automixMaxLength`, `automixDoubleClick=mix now`.
**Para nosotros**: es el corazón de una fiesta sin DJ dedicado: cola de canciones que se mezclan solas con crossfade en el punto correcto, con "mezclar ya" y "saltar".

## 7. Biblioteca y browser ★★★
Verbos (17 + búsqueda + sidelist): `browser_*`, `search`, `search_folder`, `sidelist_add/load/clear`, `playlist`, `folder`, `rating`, `set_browsed_file_bpm`, `cover`. Ajustes (80): formatos soportados (`mp3, wav, m4a, aac, flac, ogg, opus, vdj*, mp4, mkv, webm…`), carpetas raíz (iTunes, Serato, Traktor, Rekordbox), filtros por consulta (`bpmdiff<=4 and keydiff=0`, `group by genre`), columnas, `browserDaysSongsAreNew=7`, `tracklistFormat`, `historyDelay=45 s`, `writeHistory`, `favoriteTags` (hit, crowd pleaser, early night, late night, wedding, birthday, kids…).
- Base `database.xml`: BPM, key, ganancia, beatgrid, cues, play count, first/last play; `History/*.m3u`.
**Para nosotros**: importar carpetas/archivos, buscar, cola (sidelist), historial de lo tocado, etiquetas tipo "early night/late night". **Y reutilizar los 207 análisis ya hechos por VirtualDJ** (BPM/key/cues) sin re-analizar.

## 8. Sampler y pads ★★★
Verbos (39 sampler + 32 pad): `sampler_play/stop/play_stop/play_stutter`, `sampler_loop`, `sampler_mode`, `sampler_bank`, `sampler_volume/_master`, `sampler_color`, `sampler_rec/start_rec/stop_rec/abort_rec` (grabar del deck o del mic), `sampler_group_*` (grupos con mute/volumen), `sampler_velocity`, `sampler_rapidfire`, `sampler_load_to_deck`, `sampler_output`; páginas de pads: hot cues, loops, slicer, sampler, stems, key cue, remix points, scratch; `pad_color`, `pad_menu`, `pad_page`.
**Para nosotros**: ya cubierto y superado por Cabina v2 (bancos, modos, ducking, grabadora, tono).

## 9. Efectos ★★
Verbos (40): `effect`, `effect_activate`, `effect_select`, `effect_beats` (efectos sincronizados a beats), `effect_slider`, `effect_bank_load/save`, `effect_clone`, `effect_colorfx`, `mixFx`; nativos: Echo, Flanger, Reverb, Wahwah, Filter, Boom, Slicer, Distortion, Cut, Stems; `padfx`.
**Para nosotros**: echo/filtro "sweep" para transiciones; el resto es decorativo.

## 10. Stems (separación IA) ★
`stem_pad`, `stem_volume`, `stems_bleed`, `stems_split`, `stemsRealtimeSeparation`, `stemsGPU`; modelos de 410 MB con DirectML/CUDA.
**Para nosotros**: no viable en navegador ni en este hardware. Fuera de alcance, sin pérdida real para fiestas.

## 11. Micrófono y talkover ★★★
`mic`, `mic_volume`, `mic2_volume`, `mic_eq_low/mid/high`, `mic_talkover` (baja la música cuando hablas), `mic_rec`, `microphoneToMaster`, `boothMicrophone`.
**Para nosotros**: el talkover es exactamente el *ducking* que ya hicimos para las camas; aplicarlo también a los decks cuando suena un pad o se habla.

## 12. Grabación y transmisión ★★
`record`, `record_cut`, `record_vu`, `recordFormat mp3`, `recordQuality`, `recordAutoStart`, `recordWaitForSound`, `recordAutoSplit`, `recordWriteCueFile`; `broadcast` (Icecast/Shoutcast, directo, video a YouTube/Twitch/Facebook).
**Para nosotros**: grabar la sesión (mezcla + pads) a un archivo es útil como recuerdo/evidencia; transmisión no.

## 13. Video y karaoke ★
27 + 6 verbos: video crossfader, transiciones, FX, logo, karaoke con CDG/zip, `karaokeBackgroundMusic=automix`, `karaokeDualDeck`.
**Para nosotros**: karaoke podría ser una fase futura (letras); video no.

## 14. Controladoras, timecode y MIDI ★
24 + 12 claves: mapeos de +300 controladoras (14 MB embebidos), `controllerTakeoverMode`, jog/scratch, `timecode` (vinilos DVS), `midiclock`, `os2l`, DMX.
**Para nosotros**: teclado y pantalla táctil. MIDI web queda como adaptador futuro (Web MIDI API).

## 15. Skins, interfaz y visualización ★★
46 claves: formas de onda (`shapes`, colores por frecuencia, `waveGrayOnKill`), overview, `beatCounterRange=16`, `rhythmZoom`, VU meter, reloj, tema; skins XML declarativos.
**Para nosotros**: forma de onda por deck con playhead y puntos de cue, contador de beats/bar, tema claro/oscuro.

## 16. Streaming, cuenta y licencia ★
Tidal/Deezer/SoundCloud/Beatport/Beatsource (`netsearch://`), DRM online, ediciones Home/Pro/Business, `askthedj` (peticiones del público por web), `cloud lists`, `genius dj`.
**Para nosotros**: sin señal en la fiesta, el streaming no sirve; *askthedj* (peticiones del público) es una idea buena para una fase futura con red local.

## 17. Sistema y opciones ★
`crashGuard`, `loadSecurity` (no cargar una pista en el deck que suena), `autoUpdate`, idiomas (12), `VDJScriptGlobalVariables`, `eventscheduler`, `stopwatch`.
**Para nosotros**: `loadSecurity` sí (evitar cargar encima del deck que está sonando).

## Síntesis: qué significa "mejor que VirtualDJ para nosotros"
VirtualDJ es más grande en todo lo que no necesitamos (stems, video, 300 controladoras, DVS, streaming con DRM). Nuestro sistema gana donde importa para una fiesta real:

| Criterio | VirtualDJ | Cabina DJ |
|---|---|---|
| Correr en el celular sin instalar nada | No (PC/Mac; la app móvil es otra) | Sí, un link |
| Funcionar sin señal | Solo música local; la licencia y Tidal piden red | Sí, todo local (service worker + IndexedDB) |
| Consola de locutor integrada con ducking automático sobre la música | Sampler + talkover, separados | Un solo tablero: pads y decks con ducking unificado |
| Automix con cola | Sí (excelente) | Sí, con los mismos puntos de mezcla; si la pista fue analizada por VirtualDJ se reusan sus datos |
| Reusar análisis previos | Solo los suyos | Importa `database.xml` de VirtualDJ y toma BPM/key/cues de sus 207 pistas |
| Licencia | Cuenta online, límites sin pagar | Ninguna |
| Aprender a usarlo | Horas | Minutos |
| Keylock, stems, video, DVS | Sí | No (a propósito) |
