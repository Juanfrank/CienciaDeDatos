/** Normalizacion de filtros que llegan en el cuerpo de una peticion. */

/**
 * Se construye con `Object.fromEntries` y no asignando `salida[clave]`.
 *
 * No es estilo. Asignar una clave que venga de fuera con `objeto[clave] = valor` trata
 * `__proto__` como lo que su nombre dice: en vez de guardar un filtro llamado asi, cambia el
 * PROTOTIPO del objeto y el filtro desaparece sin dejar rastro —ni error, ni clave, ni valor—.
 * `fromEntries` define la propiedad, asi que la clave se guarda como cualquier otra y el objeto
 * sigue siendo un objeto corriente.
 *
 * Nadie llama a una dimension `__proto__`, y por eso mismo si aparece es porque alguien la
 * escribio a mano.
 */
export function filtersNormalize(valor: unknown): Record<string, string[]> {
  if (typeof valor !== 'object' || valor === null) return {};

  const pares: [string, string[]][] = [];
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === 'string') pares.push([clave, [v]]);
    else if (Array.isArray(v)) {
      pares.push([clave, v.filter((x): x is string => typeof x === 'string')]);
    }
  }
  return Object.fromEntries(pares);
}

/** Lo mismo para una query string: un valor repetido es una lista, uno solo es una cadena. */
export function filtersOfQuery(params: URLSearchParams): Record<string, string | string[]> {
  return Object.fromEntries(
    [...new Set(params.keys())].map((clave) => {
      const valores = params.getAll(clave);
      return [clave, valores.length > 1 ? valores : (valores[0] ?? '')];
    }),
  );
}
