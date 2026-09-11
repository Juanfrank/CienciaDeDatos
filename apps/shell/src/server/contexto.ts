import { join } from 'node:path';
import {
  type GovernedUser,
  type ManagedTree,
  type NavNode,
  type Team,
  buildNavigationView,
  resolveEffectiveScope,
} from '@app/access-control';
import { CachedDatasetReader, FileCacheStore, InMemoryCacheStore } from '@app/caching';
import { ObjectRegistry, catalogoInicial } from '@app/ui-components';
import { gobierno } from './gobierno';

/**
 * Contexto de servidor del shell.
 *
 * Es la unica pieza que conoce de donde sale cada cosa. Cablea los adaptadores de DESARROLLO:
 * gobierno en el almacen escribible de `gobierno.ts`, sesion en memoria, y un cache en disco
 * compartido con el job. Los adaptadores de Azure implementan los mismos puertos y se sustituyen
 * aqui, sin tocar nada mas.
 *
 * Lo que NO hay aqui, y es deliberado: ninguna referencia a `@app/data-contracts-server`. El
 * shell no puede instanciar un conector —la regla de limites lo prohibe— porque el camino de
 * lectura de una solicitud de usuario se sirve exclusivamente desde el cache (6.3).
 *
 * Todo lo relativo al gobierno se expone como FUNCION, no como constante: el panel de
 * administracion escribe, y una constante calculada al cargar el modulo devolveria para siempre
 * la configuracion que habia en ese instante.
 */

/** Directorio del cache L2, compartido con el job de poblacion. */
export const CACHE_DIR = process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');

/** Conector configurado como activo. En produccion lo resuelve Azure App Configuration (2.2). */
export const CONNECTOR_KIND = process.env['DATA_CONNECTOR'] ?? 'mock';

export const objectRegistry = new ObjectRegistry(catalogoInicial);

/**
 * L1 por proceso con TTL corto, L2 en disco.
 *
 * L2 es un archivo y no memoria porque el job de poblacion corre en OTRO proceso: con un L2 en
 * memoria el shell nunca veria lo que el job escribe.
 */
const l1 = new InMemoryCacheStore({ ttlMs: 5_000 });
const l2 = new FileCacheStore({ directory: CACHE_DIR });

export const cacheL2 = l2;
export const datasetReader = new CachedDatasetReader({ l1, l2 });

/** Organizacion general vigente (4.1.1). */
export function getGeneralTree(): NavNode[] {
  return gobierno.getTree().nodes;
}

export function getManagedTree(): ManagedTree {
  return gobierno.getTree();
}

export function listTeams(): Team[] {
  return gobierno.listTeams();
}

export function findTeam(teamId: string): Team | undefined {
  return gobierno.getTeam(teamId);
}

export function listUsers(): GovernedUser[] {
  return gobierno.listUsers();
}

export function findUser(userId: string): GovernedUser | undefined {
  return gobierno.getUser(userId);
}

/** Equipos a los que pertenece una persona, para el selector de espacio de trabajo (4.10.2). */
export function teamsOf(userId: string): Team[] {
  return gobierno.listTeams().filter((t) => t.members.some((m) => m.userId === userId));
}

export function roleOf(userId: string, teamId: string): string {
  return gobierno.getTeam(teamId)?.members.find((m) => m.userId === userId)?.role ?? 'visor';
}

/**
 * Vista de navegacion de una persona con un equipo activo dado.
 *
 * Si el equipo tiene paquete asignado, se pasa al constructor: el paquete reagrupa, pero la
 * validacion contra grantedNodes ocurre dentro y lo no concedido no se muestra (4.10.6).
 */
export function navigationFor(teamId: string) {
  const team = gobierno.getTeam(teamId);
  if (!team) return { tree: [], fromPackage: false, dangling: [] };

  const pkg = team.assignedPackageId ? gobierno.getPackage(team.assignedPackageId) : undefined;
  return buildNavigationView({
    generalTree: getGeneralTree(),
    team,
    ...(pkg ? { pkg } : {}),
  });
}

/** Ambito efectivo para un modulo, con el equipo ACTIVO (nunca la union de todos). */
export function scopeFor(userId: string, teamId: string, moduleId: string) {
  const user = gobierno.getUser(userId) ?? { userId };
  const team = gobierno.getTeam(teamId);
  if (!team) return null;
  return resolveEffectiveScope({ user, activeTeam: team, moduleId, generalTree: getGeneralTree() });
}
