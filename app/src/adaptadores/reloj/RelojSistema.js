import { Reloj } from '../../aplicacion/puertos/secundarios.js';

export class RelojSistema extends Reloj {
  ahora() {
    return performance.now();
  }
}
