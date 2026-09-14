/** Normalizacion de filtros que llegan en el cuerpo de una peticion. */
export function filtersNormalize(valor: unknown): Record<string, string[]> {
  if (typeof valor !== 'object' || valor === null) return {};

  const salida: Record<string, string[]> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === 'string') salida[clave] = [v];
    else if (Array.isArray(v)) salida[clave] = v.filter((x): x is string => typeof x === 'string');
  }
  return salida;
}
