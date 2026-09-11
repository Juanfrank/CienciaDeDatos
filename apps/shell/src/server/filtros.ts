/**
 * Normalizacion de filtros que llegan en el cuerpo de una peticion.
 *
 * Vive aqui y no en cada Route Handler porque la usan tres —exportar, alertas y suscripciones—
 * y las tres guardan lo mismo: la vista que se quiere reproducir despues. Con una copia por
 * endpoint, el dia que se admita una forma nueva de filtro dos de los tres dejarian de
 * entenderla, y el sintoma seria un archivo o una alerta con menos filtros de los pedidos.
 *
 * Acepta `{campo: "v"}` y `{campo: ["v1","v2"]}`, y descarta cualquier otra cosa. Descartar y
 * no fallar es deliberado: el ambito se aplica igualmente al leer, asi que un filtro mal
 * formado no puede ampliar nada — solo se ignora.
 */
export function normalizarFiltros(valor: unknown): Record<string, string[]> {
  if (typeof valor !== 'object' || valor === null) return {};

  const salida: Record<string, string[]> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === 'string') salida[clave] = [v];
    else if (Array.isArray(v)) salida[clave] = v.filter((x): x is string => typeof x === 'string');
  }
  return salida;
}
