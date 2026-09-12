import { Empaquetador } from '../../aplicacion/puertos/secundarios.js';
import { Tablero } from '../../dominio/Tablero.js';
import { Sonido } from '../../dominio/Sonido.js';

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onloadend = () => resolve(lector.result.split(',')[1]);
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });
}

function base64ABlob(base64, tipo) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo || 'application/octet-stream' });
}

/**
 * Adaptador secundario: empaqueta el tablero completo (metadatos + audios en
 * base64) en un único archivo JSON descargable ("respaldo.cabina.json").
 * Se eligió JSON plano en vez de ZIP para no depender de librerías externas.
 */
export class EmpaquetadorJSON extends Empaquetador {
  async empaquetar(tablero, audiosPorId) {
    const audios = {};
    for (const [id, blob] of Object.entries(audiosPorId)) {
      if (!blob) continue;
      audios[id] = { tipo: blob.type || 'audio/mpeg', datos: await blobABase64(blob) };
    }
    const paquete = { formato: 'cabina-respaldo', version: 1, tablero: tablero.toJSON(), audios };
    return new Blob([JSON.stringify(paquete)], { type: 'application/json' });
  }

  async desempaquetar(blob) {
    const texto = await blob.text();
    const paquete = JSON.parse(texto);
    if (paquete.formato !== 'cabina-respaldo') {
      throw new Error('El archivo no es un respaldo válido de Cabina');
    }
    const tablero = Tablero.desdeJSON(paquete.tablero, Sonido);
    const audiosPorId = {};
    for (const [id, { tipo, datos }] of Object.entries(paquete.audios || {})) {
      audiosPorId[id] = base64ABlob(datos, tipo);
    }
    return { tablero, audiosPorId };
  }
}
