/**
 * Servicio de dominio: elige un sonido al azar de un banco, evitando (si es
 * posible) repetir el último elegido — es la lógica del "pad ruleta".
 */
export function elegirSonidoAleatorio(banco, ultimoSoundId = null) {
  const sonidos = banco.listaSonidos();
  if (sonidos.length === 0) return null;
  if (sonidos.length === 1) return sonidos[0];
  const candidatos = ultimoSoundId
    ? sonidos.filter((s) => s.id !== ultimoSoundId)
    : sonidos;
  const lista = candidatos.length ? candidatos : sonidos;
  const idx = Math.floor(Math.random() * lista.length);
  return lista[idx];
}
