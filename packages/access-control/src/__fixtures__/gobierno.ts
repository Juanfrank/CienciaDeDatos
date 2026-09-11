import type { AccessScope } from '../AccessScope';
import type { ModulePackage } from '../ModulePackage';
import type { NavNode } from '../NavigationTree';
import type { GovernedUser, Team } from '../Team';

/**
 * Fixtures del modelo de gobierno: organizacion general, equipos, ambitos y paquetes.
 *
 * Reproducen el escenario que exige el entregable de la Fase de cimiento (seccion 8.1):
 * "al menos dos equipos de prueba con ambitos distintos". Los usan las pruebas de
 * resolucion de ambito, de navegacion y de aislamiento de cache.
 */

export const DIM_DISTRITO = { table: 'DimTribunal', field: 'Distrito' } as const;
export const DIM_MATERIA = { table: 'DimTribunal', field: 'Materia' } as const;

export const scope = (dimension: { table: string; field: string }, ...allowedValues: string[]): AccessScope => ({
  restrictions: [{ dimension, allowedValues }],
});

/** Ambito que sustituye en vez de restringir. Requiere justificacion: no hay forma de omitirla. */
export const expandingScope = (
  justification: string,
  dimension: { table: string; field: string },
  ...allowedValues: string[]
): AccessScope => ({
  restrictions: [{ dimension, allowedValues }],
  authorizedExpansion: {
    justification,
    authorizedBy: 'admin-1',
    authorizedAt: '2026-01-15T10:00:00.000Z',
  },
});

const modulo = (moduleId: string, slug: string, name: string): NavNode => ({
  id: `nodo-${moduleId}`,
  type: 'module',
  moduleRef: { moduleId, slug, name },
});

/**
 * Organizacion general de prueba, con tres niveles de anidamiento:
 *
 *   Institucional
 *     Regional                  [Distrito in Norte, Este, Sur]
 *       Distrito Norte          [Distrito in Norte]
 *         casos-pendientes-norte
 *         audiencias-norte
 *       Distrito Este           [Distrito in Este]
 *         casos-pendientes-este
 *     estadisticas-nacionales   (sin restriccion de carpeta)
 */
export const arbolGeneral: NavNode[] = [
  {
    id: 'carpeta-institucional',
    type: 'folder',
    name: 'Institucional',
    children: [
      {
        id: 'carpeta-regional',
        type: 'folder',
        name: 'Regional',
        scope: scope(DIM_DISTRITO, 'Distrito Norte', 'Distrito Este', 'Distrito Sur'),
        children: [
          {
            id: 'carpeta-norte',
            type: 'folder',
            name: 'Distrito Norte',
            scope: scope(DIM_DISTRITO, 'Distrito Norte'),
            children: [
              modulo('casos-pendientes-norte', 'casos-pendientes-norte', 'Casos pendientes Norte'),
              modulo('audiencias-norte', 'audiencias-norte', 'Audiencias Norte'),
            ],
          },
          {
            id: 'carpeta-este',
            type: 'folder',
            name: 'Distrito Este',
            scope: scope(DIM_DISTRITO, 'Distrito Este'),
            children: [modulo('casos-pendientes-este', 'casos-pendientes-este', 'Casos pendientes Este')],
          },
        ],
      },
      modulo('estadisticas-nacionales', 'estadisticas-nacionales', 'Estadisticas nacionales'),
    ],
  },
];

/** Equipo con acceso a toda la carpeta Regional y restringido por materia. */
export const equipoNorte: Team = {
  id: 'equipo-norte',
  name: 'Equipo Distrito Norte',
  grantedNodes: ['carpeta-regional'],
  members: [
    { userId: 'ana', role: 'colaborador' },
    { userId: 'admin-1', role: 'administrador' },
  ],
  defaultScope: scope(DIM_MATERIA, 'Penal', 'Civil'),
  moduleScopeOverrides: {},
};

/** Equipo con acceso solo a la carpeta del Distrito Este, sin restriccion propia de materia. */
export const equipoEste: Team = {
  id: 'equipo-este',
  name: 'Equipo Distrito Este',
  grantedNodes: ['carpeta-este'],
  members: [{ userId: 'beto', role: 'visor' }],
  defaultScope: { restrictions: [] },
  moduleScopeOverrides: {},
};

export const usuarioAna: GovernedUser = { userId: 'ana' };
export const usuarioBeto: GovernedUser = { userId: 'beto' };

/**
 * Paquete visual que reagrupa los mismos modulos bajo otra carpeta y en otro orden, e
 * incluye ademas un modulo que el equipo NO tiene concedido: sirve para comprobar que un
 * paquete no puede colar accesos.
 */
export const paqueteReagrupado: ModulePackage = {
  id: 'paquete-operativo',
  name: 'Vista operativa',
  visualTree: [
    {
      id: 'visual-dia-a-dia',
      type: 'folder',
      name: 'Dia a dia',
      children: [
        modulo('audiencias-norte', 'audiencias-norte', 'Audiencias'),
        modulo('casos-pendientes-norte', 'casos-pendientes-norte', 'Pendientes'),
        // No concedido a equipoNorte: vive fuera de carpeta-regional.
        modulo('estadisticas-nacionales', 'estadisticas-nacionales', 'Nacionales'),
      ],
    },
  ],
};
