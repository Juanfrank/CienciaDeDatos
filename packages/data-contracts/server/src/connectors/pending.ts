/** Error que emiten los conectores todavia no implementados. */
export class ConnectorNotImplementedError extends Error {
  constructor(
    readonly connector: string,
    readonly phase: string,
  ) {
    super(
      `${connector} todavia no esta implementado. Se implementa en: ${phase}. ` +
        `Mientras tanto, la seleccion de conector activo debe apuntar a 'mock' ` +
        `(Azure App Configuration, seccion 2.2).`,
    );
    this.name = 'ConnectorNotImplementedError';
  }
}
