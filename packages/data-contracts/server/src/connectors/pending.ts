/**
 * Error que emiten los conectores todavia no implementados.
 *
 * Existe para que la ausencia de una implementacion sea RUIDOSA y trazable, en vez de
 * devolver datos vacios que se confundan con "no hay resultados". Se registra en
 * Application Insights igual que cualquier fallo de fuente (6.4).
 */
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
