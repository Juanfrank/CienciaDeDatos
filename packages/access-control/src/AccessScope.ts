import type { FieldRef, QueryRequest, QueryResult } from '@app/data-contracts';

/** Ambito de acceso (RLS de negocio) — seccion 4.10.3. */

export interface ScopeRestriction {
  /** Debe existir en el esquema real. Nunca texto libre sin validar. */
  dimension: FieldRef;
  allowedValues: string[];
}

/** Excepcion de ampliacion (4.10.4). */
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

/** Ambito que no permite ver nada. */
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
 */
export function intersect(a: AccessScope, b: AccessScope): AccessScope {
  const keys = new Set([
    ...a.restrictions.map((r) => dimensionKey(r.dimension)),
    ...b.restrictions.map((r) => dimensionKey(r.dimension)),
  ]);

  const restrictions: ScopeRestriction[] = [];
  for (const clave of keys) {
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

/** Aplica una capa de configuracion sobre el ambito acumulado. */
export function applyLayer(current: AccessScope, layer: AccessScope): AccessScope {
  if (layer.authorizedExpansion) {
    return { restrictions: layer.restrictions.map((r) => ({ ...r, allowedValues: [...r.allowedValues] })) };
  }
  return intersect(current, layer);
}

/** Traduce el ambito resuelto a filtros concretos de QueryRequest. */
export function scopeToFilters(scope: AccessScope): Record<string, string[]> {
  const filtros: Record<string, string[]> = {};
  for (const r of scope.restrictions) filtros[dimensionKey(r.dimension)] = [...r.allowedValues];
  return filtros;
}

/**
 * Interseca los filtros que llegan por la interfaz o por parametros de URL con el ambito
 * resuelto de quien abre la peticion (4.11).
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

/** Comprueba que un dataset puede hacer cumplir un ambito al momento de la lectura. */
export function assertScopeIsEnforceable(result: QueryResult, scope: AccessScope): void {
  const gridColumns = new Set(result.columns.map((c) => c.name));
  const faltantes = scope.restrictions
    .map((r) => dimensionKey(r.dimension))
    .filter((clave) => !gridColumns.has(clave));

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
