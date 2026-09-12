/**
 * Servicio de dominio: decide qué reproducciones activas deben cortarse
 * cuando se dispara un nuevo sonido.
 *
 * - UN_TIRO / LOOP / MANTENER: nunca cortan nada, se solapan libremente.
 * - EXCLUSIVO: corta cualquier otro sonido EXCLUSIVO que esté sonando en el
 *   MISMO banco (pensado para camas musicales: solo una a la vez).
 *
 * `activos` es un arreglo de { soundId, bancoId, modo } que representa lo
 * que el reproductor tiene sonando ahora mismo.
 */
export function sonidosACortar(sonidoNuevo, bancoId, activos) {
  if (!sonidoNuevo.modo.esExclusivo()) return [];
  return activos
    .filter((a) => a.bancoId === bancoId && a.modo.esExclusivo() && a.soundId !== sonidoNuevo.id)
    .map((a) => a.soundId);
}
