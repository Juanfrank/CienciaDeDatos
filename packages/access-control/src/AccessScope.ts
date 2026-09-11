import type { FieldRef, QueryRequest, QueryResult } from '@app/data-contracts';

/**
 * Ambito de acceso (RLS de negocio) — seccion 4.10.3.
 *
 * Representa "que subconjunto de datos puede ver este equipo o usuario", con independencia
 * de que modulos tenga visibles. No es texto libre ni una consulta: es una coleccion de
 * restricciones por dimension, para que sea auditable, validable contra el esquema real
 * (IDataConnector.getSchema()) y traducible de forma determinista a un filtro de consulta
 * o a un predicado de seguridad en el origen.
 */

export interface ScopeRestriction {
  /** Debe existir en el esquema real. Nunca texto libre sin validar. */
  dimension: FieldRef;
  allowedValues: string[];
}

/**
 * Excepcion de ampliacion (4.10.4).
 *
 * Marca explicita que autoriza a una capa a SUSTITUIR el ambito heredado en vez de
 * restringirlo. Exige justificacion de texto obligatoria y genera una entrada de auditoria
 * distinta de las restricciones normales. Su numero deberia tender a cero: un numero
 * creciente es señal de gobierno de RLS deteriorandose (seccion 7).
 */
export interface AuthorizedExpansion {
  justification: string;
  /** userId del Administrador que la autorizo. */
  authorizedBy: string;
  authorizedAt: string;
}

export interface AccessScope {
  restrictions: ScopeRestriction[];
  /**
   * Presente solo en configuraciones marcadas explicitamente como excepcion. Sin esta
   * marca, una capa SOLO puede restringir; es el valor por defecto y no es negociable:
   * cualquier combinacion de reglas debe resultar "mas restrictiva o igual", nunca "mas
   * permisiva" por accidente.
   */
  authorizedExpansion?: AuthorizedExpansion;
}

/** Ambito sin restricciones: ve todo lo que las capas superiores permitan. */
export const UNRESTRICTED_SCOPE: AccessScope = { restrictions: [] };

export const dimensionKey = (ref: FieldRef): string => `${ref.table}.${ref.field}`;

/**
 * Ambito que no permite ver nada.
 *
 * Una dimension restringida al conjunto vacio no deja pasar ninguna fila. Se representa
 * asi, y no con un `null` o una excepcion, para que la ausencia de acceso viaje por el
 * mismo camino que cualquier otro ambito y termine en un resultado vacio — nunca en un
 * error que revele que existe algo fuera del alcance de quien pregunta (4.11).
 */
export function deniesEverything(scope: AccessScope): boolean {
  return scope.restrictions.some((r) => r.allowedValues.length === 0);
}

function restrictionFor(scope: AccessScope, key: string): ScopeRestriction | undefined {
  return scope.restrictions.find((r) => dimensionKey(r.dimension) === key);
}

/**
 * Interseccion de dos ambitos. El documento exige esta operacion (4.10.4) pero no define su
 * semantica; se fija aqui y se documenta porque de ella depende que el sistema falle del
 * lado seguro:
 *
 *  - Dimension presente en AMBOS ambitos -> interseccion de sus valores permitidos.
 *  - Dimension presente en SOLO UNO -> se incorpora tal cual. La ausencia de restriccion
 *    significa "sin restringir", asi que añadirla siempre restringe, nunca amplia.
 *  - Interseccion vacia en cualquier dimension -> el ambito resultante no permite nada.
 *
 * La propiedad que garantiza: `intersect(a, b)` nunca permite mas que `a` ni mas que `b`.
 */
export function intersect(a: AccessScope, b: AccessScope): AccessScope {
  const claves = new Set([
    ...a.restrictions.map((r) => dimensionKey(r.dimension)),
    ...b.restrictions.map((r) => dimensionKey(r.dimension)),
  ]);

  const restrictions: ScopeRestriction[] = [];
  for (const clave of claves) {
    const ra = restrictionFor(a, clave);
    const rb = restrictionFor(b, clave);

    if (ra && rb) {
      const permitidos = new Set(rb.allowedValues);
      restrictions.push({
        dimension: ra.dimension,
        allowedValues: ra.allowedValues.filter((v) => permitidos.has(v)),
      });
    } else {
      const unica = ra ?? rb;
      if (unica) restrictions.push({ dimension: unica.dimension, allowedValues: [...unica.allowedValues] });
    }
  }

  return { restrictions };
}

/**
 * Determina si aplicar `next` como SUSTITUCION de `current` concederia algo que `current`
 * no permite.
 *
 * Lo usa el panel de administracion (4.10.8) para exigir la marca de excepcion ANTES de
 * guardar una configuracion que amplia, en vez de descubrirlo despues en una auditoria.
 */
export function wouldExpand(current: AccessScope, next: AccessScope): boolean {
  for (const actual of current.restrictions) {
    const clave = dimensionKey(actual.dimension);
    const siguiente = restrictionFor(next, clave);

    // `current` restringe esta dimension y `next` no la menciona: sin restriccion
    // significa "todos los valores", asi que sustituir ampliaria.
    if (!siguiente) return true;

    const permitidos = new Set(actual.allowedValues);
    if (siguiente.allowedValues.some((v) => !permitidos.has(v))) return true;
  }
  return false;
}

/**
 * Aplica una capa de configuracion sobre el ambito acumulado.
 *
 * Es el paso que se repite en cada nivel de 4.10.4: restringe por defecto, y solo sustituye
 * cuando la capa lleva una excepcion de ampliacion marcada explicitamente.
 */
export function applyLayer(current: AccessScope, layer: AccessScope): AccessScope {
  if (layer.authorizedExpansion) {
    return { restrictions: layer.restrictions.map((r) => ({ ...r, allowedValues: [...r.allowedValues] })) };
  }
  return intersect(current, layer);
}

/**
 * Traduce el ambito resuelto a filtros concretos de QueryRequest.
 *
 * La aplicacion los añade a TODA consulta, de forma previa e independiente de si la fuente
 * activa aplica ademas su propio RLS nativo (4.10.5). Nunca se confia exclusivamente en que
 * la fuente aplique la restriccion por su cuenta.
 */
export function scopeToFilters(scope: AccessScope): Record<string, string[]> {
  const filtros: Record<string, string[]> = {};
  for (const r of scope.restrictions) filtros[dimensionKey(r.dimension)] = [...r.allowedValues];
  return filtros;
}

/**
 * Interseca los filtros que llegan por la interfaz o por parametros de URL con el ambito
 * resuelto de quien abre la peticion (4.11).
 *
 * Un parametro puede RESTRINGIR dentro de lo permitido, nunca ampliarlo. Si pide un valor
 * fuera del ambito, se aplica silenciosamente solo la parte permitida: el resultado se
 * reduce, pero no se revela que existen otros valores.
 */
export function intersectRequestedFilters(
  scope: AccessScope,
  requested: Record<string, string | string[]>,
): Record<string, string[]> {
  const efectivos = scopeToFilters(scope);

  for (const [clave, valor] of Object.entries(requested)) {
    const pedidos = Array.isArray(valor) ? valor.map(String) : [String(valor)];
    const permitidos = efectivos[clave];
    efectivos[clave] = permitidos ? pedidos.filter((v) => permitidos.includes(v)) : pedidos;
  }

  return efectivos;
}

/** Aplica el ambito sobre un QueryResult ya leido del cache, antes de devolverlo al cliente. */
export function filterResultByScope(result: QueryResult, scope: AccessScope): QueryResult {
  if (scope.restrictions.length === 0) return result;

  const activas = scope.restrictions
    .map((r) => ({
      index: result.columns.findIndex((c) => c.name === dimensionKey(r.dimension)),
      allowed: new Set(r.allowedValues),
    }))
    // Una restriccion sobre una dimension que el dataset no expone como columna no puede
    // evaluarse fila a fila. Se ignora aqui SOLO porque el registro de datasets (6.6) exige
    // que un dataset compartido entre ambitos incluya como columna toda dimension por la que
    // alguien pueda quedar restringido; `assertScopeIsEnforceable` lo comprueba.
    .filter((r) => r.index >= 0);

  if (activas.length === 0) return result;

  return {
    ...result,
    rows: result.rows.filter((row) => activas.every((r) => r.allowed.has(String(row[r.index])))),
  };
}

/**
 * Comprueba que un dataset puede hacer cumplir un ambito al momento de la lectura.
 *
 * Si el ambito restringe por una dimension que el dataset cacheado no trae como columna, el
 * filtrado no puede aplicarse y servir esas filas seria una fuga de datos con RLS. Falla de
 * forma ruidosa: es preferible no servir el dataset a servirlo sin filtrar.
 */
export function assertScopeIsEnforceable(result: QueryResult, scope: AccessScope): void {
  const columnas = new Set(result.columns.map((c) => c.name));
  const faltantes = scope.restrictions
    .map((r) => dimensionKey(r.dimension))
    .filter((clave) => !columnas.has(clave));

  if (faltantes.length > 0) {
    throw new Error(
      `El dataset cacheado no expone la(s) dimension(es) ${faltantes.join(', ')}, por las que el ` +
        `ambito de acceso restringe. No puede servirse sin filtrar: revisa la definicion del ` +
        `dataset en el registro (6.6) para que incluya esas columnas.`,
    );
  }
}

/** Adapta el ambito a la forma de QueryContext.securityContext que espera el conector. */
export function scopeToSecurityContext(scope: AccessScope): Record<string, string | string[]> {
  return scopeToFilters(scope);
}

/** Filtros del ambito, listos para incrustarse en un QueryRequest. */
export function withScopeFilters(req: QueryRequest, scope: AccessScope): QueryRequest {
  return { ...req, filters: { ...(req.filters ?? {}), ...scopeToFilters(scope) } };
}
