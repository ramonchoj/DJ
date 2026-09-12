export class ErrorDominio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDominio';
  }
}

export class ErrorValidacion extends ErrorDominio {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorValidacion';
  }
}

export class ErrorNoEncontrado extends ErrorDominio {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorNoEncontrado';
  }
}

export class ErrorConflicto extends ErrorDominio {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorConflicto';
  }
}
