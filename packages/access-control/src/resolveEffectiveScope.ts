import {
  type AccessScope,
  UNRESTRICTED_SCOPE,
  applyLayer,
  deniesEverything,
} from './AccessScope';
import { type NavNode, findModulePath } from './NavigationTree';
import type { GovernedUser, Team } from './Team';

/**
 * Resolucion del ambito efectivo — algoritmo obligatorio de la seccion 4.10.4.
 *
 * Funcion PURA, testeable de forma aislada: no consulta base de datos, no lee sesion, no
 * tiene efectos. Todo lo que necesita llega por parametro. Esa pureza es deliberada — es la
 * pieza de la que depende que dos equipos distintos vean datos distintos y correctos, y
 * tiene que poder probarse exhaustivamente sin levantar infraestructura.
 *
 * Precedencia, de mas general a mas especifico. Cada capa solo puede RESTRINGIR, nunca
 * ampliar, salvo excepcion marcada explicitamente:
 *
 *   1. scope = activeTeam.defaultScope
 *   2. ruta = ancestros del modulo en la ORGANIZACION GENERAL, de la raiz al modulo
 *   3. por cada carpeta de la ruta, si tiene scope: scope = intersect(scope, carpeta.scope)
 *   4. si activeTeam.moduleScopeOverrides[moduleId]: scope = intersect(scope, override)
 *   5. si user.personalScope (general o por modulo): scope = intersect(scope, personal)
 *   6. devolver scope
 *
 * Nota critica: esta resolucion SIEMPRE camina la organizacion general (4.1.1), nunca un
 * paquete visual (4.1.3). El ambito de un modulo depende exclusivamente de donde vive
 * realmente en el arbol general, no de en que carpeta visual aparezca mostrado.
 */

/** Paso de la resolucion, para la vista "quien ve que" del panel de administracion (4.10.8). */
export interface ScopeResolutionStep {
  layer:
    | 'ambito-general-del-equipo'
    | 'carpeta'
    | 'override-por-modulo-del-equipo'
    | 'ambito-personal'
    | 'ambito-personal-por-modulo';
  /** Nombre legible del origen: para carpetas, el nombre de la carpeta. */
  source: string;
  /** true si esta capa sustituyo el ambito en vez de restringirlo (excepcion de ampliacion). */
  expanded: boolean;
  /** Ambito acumulado DESPUES de aplicar esta capa. */
  result: AccessScope;
}

export interface EffectiveScopeResolution {
  scope: AccessScope;
  /** Traza legible de como se llego al ambito, para auditar antes de publicar (4.10.8). */
  steps: ScopeResolutionStep[];
  /** true si alguna capa aplico una excepcion de ampliacion marcada. */
  usedAuthorizedExpansion: boolean;
  /** true si el resultado no permite ver ninguna fila. */
  deniesEverything: boolean;
  /** false si el modulo no existe en la organizacion general: no debe mostrarse. */
  moduleExistsInGeneralTree: boolean;
}

export interface ResolveEffectiveScopeInput {
  user: GovernedUser;
  activeTeam: Team;
  moduleId: string;
  /** La ORGANIZACION GENERAL. Nunca el arbol de un paquete visual. */
  generalTree: NavNode[];
}

export function resolveEffectiveScope(input: ResolveEffectiveScopeInput): EffectiveScopeResolution {
  const { user, activeTeam, moduleId, generalTree } = input;
  const steps: ScopeResolutionStep[] = [];
  let usedAuthorizedExpansion = false;

  const push = (
    layer: ScopeResolutionStep['layer'],
    source: string,
    previous: AccessScope,
    layerScope: AccessScope,
  ): AccessScope => {
    const result = applyLayer(previous, layerScope);
    const expanded = layerScope.authorizedExpansion !== undefined;
    if (expanded) usedAuthorizedExpansion = true;
    steps.push({ layer, source, expanded, result });
    return result;
  };

  // 1. Ambito general del equipo activo.
  let scope: AccessScope = activeTeam.defaultScope ?? UNRESTRICTED_SCOPE;
  steps.push({
    layer: 'ambito-general-del-equipo',
    source: activeTeam.name,
    expanded: false,
    result: scope,
  });

  // 2. Ruta de ancestros en la organizacion general.
  const path = findModulePath(generalTree, moduleId);

  if (path === null) {
    // El modulo no existe en el arbol general. No hay ambito que heredar y no debe mostrarse.
    // Se devuelve un ambito que no permite nada, en vez de lanzar: el resultado vacio viaja
    // por el camino normal y no revela nada sobre lo que existe fuera del alcance.
    return {
      scope: { restrictions: [{ dimension: { table: '', field: '' }, allowedValues: [] }] },
      steps,
      usedAuthorizedExpansion: false,
      deniesEverything: true,
      moduleExistsInGeneralTree: false,
    };
  }

  // 3. Cada carpeta de la ruta, en orden de raiz a modulo.
  for (const folder of path) {
    if (folder.scope) scope = push('carpeta', folder.name, scope, folder.scope);
  }

  // 4. Override por modulo del equipo.
  const moduleOverride = activeTeam.moduleScopeOverrides?.[moduleId];
  if (moduleOverride) {
    scope = push('override-por-modulo-del-equipo', `${activeTeam.name} / ${moduleId}`, scope, moduleOverride);
  }

  // 5. Ambito personal del usuario: primero el general, luego el especifico por modulo.
  if (user.personalScope) {
    scope = push('ambito-personal', user.userId, scope, user.personalScope);
  }
  const personalModuleOverride = user.personalModuleScopeOverrides?.[moduleId];
  if (personalModuleOverride) {
    scope = push('ambito-personal-por-modulo', `${user.userId} / ${moduleId}`, scope, personalModuleOverride);
  }

  return {
    scope,
    steps,
    usedAuthorizedExpansion,
    deniesEverything: deniesEverything(scope),
    moduleExistsInGeneralTree: true,
  };
}
