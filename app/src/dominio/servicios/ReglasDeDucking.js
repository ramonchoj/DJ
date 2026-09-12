/**
 * Servicio de dominio: "ducking" de radio. Cuando entra un golpe o efecto
 * encima de una cama musical, la cama baja de volumen mientras dura el
 * golpe y vuelve a subir al terminar.
 *
 * Devuelve los soundIds activos que deben atenuarse:
 *  - solo sonidos que estén sonando en bancos marcados como cama,
 *  - solo si el sonido nuevo NO es de un banco cama (una cama no atenúa a otra),
 *  - solo si el factor de ducking es menor que 1.
 *
 * `activos`: [{ soundId, bancoId }] del reproductor.
 * `esBancoCama(bancoId)`: consulta al tablero.
 */
export function sonidosAAtenuar({ bancoNuevoId, activos, esBancoCama, ducking }) {
  if (ducking >= 1) return [];
  if (esBancoCama(bancoNuevoId)) return [];
  const ids = new Set();
  for (const a of activos) {
    if (esBancoCama(a.bancoId)) ids.add(a.soundId);
  }
  return [...ids];
}

/**
 * Modo "uno a la vez": qué activos cortar antes de disparar un nuevo sonido.
 * Se corta todo lo que no sea cama (las camas siguen de fondo).
 */
export function sonidosACortarUnoALaVez({ activos, esBancoCama, soundIdNuevo }) {
  const ids = new Set();
  for (const a of activos) {
    if (a.soundId === soundIdNuevo) continue;
    if (!esBancoCama(a.bancoId)) ids.add(a.soundId);
  }
  return [...ids];
}
