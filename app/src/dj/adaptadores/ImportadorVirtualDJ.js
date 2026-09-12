import { ImportadorAnalisis } from '../aplicacion/puertos.js';

/**
 * Adaptador: lee el database.xml de VirtualDJ y devuelve, por nombre de
 * archivo, el análisis que ya hizo VirtualDJ:
 *   <Song FilePath="...\Artista - Título.mp3">
 *     <Scan Bpm="0.487" Key="A#m" Volume="1.25"/>   (Bpm = segundos por beat)
 *     <Poi Type="cue" Num="1" Pos="105.5"/>
 *     <Poi Type="automix" Point="realStart|realEnd|fadeStart|fadeEnd" Pos="…"/>
 */
export class ImportadorVirtualDJ extends ImportadorAnalisis {
  async importar(textoXml) {
    const doc = new DOMParser().parseFromString(textoXml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('El archivo no es un database.xml válido de VirtualDJ');
    const mapa = new Map();
    for (const song of doc.querySelectorAll('Song')) {
      const ruta = song.getAttribute('FilePath') || '';
      if (ruta.startsWith('netsearch://')) continue;
      const nombre = ruta.split(/[\\/]/).pop();
      if (!nombre) continue;
      const scan = song.querySelector('Scan');
      const datos = { bpm: null, tono: null, ganancia: null, cues: [], puntosMezcla: null };
      if (scan) {
        const spb = Number(scan.getAttribute('Bpm'));
        if (spb > 0) datos.bpm = Math.round((60 / spb) * 10) / 10;
        datos.tono = scan.getAttribute('Key') || null;
        const vol = Number(scan.getAttribute('Volume'));
        if (vol > 0) datos.ganancia = vol;
      }
      // Semántica de los POI automix de VirtualDJ (verificada con database.xml):
      //   realStart / realEnd : donde de verdad empieza y termina el audio.
      //   fadeStart           : fin del fade de ENTRADA (cerca del inicio, ej. 0.3 s).
      //   fadeEnd             : inicio del fade de SALIDA (cerca del final, ej. 399.8 s).
      // Por tanto la ventana de mezcla es [fadeEnd, realEnd].
      const vdj = {};
      for (const poi of song.querySelectorAll('Poi')) {
        const tipo = poi.getAttribute('Type');
        const pos = Number(poi.getAttribute('Pos'));
        if (tipo === 'cue' && Number.isFinite(pos)) {
          datos.cues.push({ num: Number(poi.getAttribute('Num')) || datos.cues.length + 1, seg: pos, nombre: poi.getAttribute('Name') || '' });
        } else if (tipo === 'automix' && Number.isFinite(pos)) {
          vdj[poi.getAttribute('Point')] = pos;
        }
      }
      if (vdj.fadeEnd != null && vdj.realEnd != null && vdj.realEnd > vdj.fadeEnd) {
        datos.puntosMezcla = {
          inicioReal: vdj.realStart ?? 0,
          finReal: vdj.realEnd,
          inicioFade: vdj.fadeEnd,
          finFade: vdj.realEnd,
        };
      }
      if (datos.bpm || datos.cues.length || datos.puntosMezcla) {
        mapa.set(nombre, datos);
        mapa.set(nombre.toLowerCase(), datos);
      }
    }
    return mapa;
  }
}
