import {
  type GovernedUser,
  type ManagedTree,
  type NavNode,
  type Team,
  buildNavigationView,
  resolveEffectiveScope,
} from '@app/access-control';
import { CachedDatasetReader } from '@app/caching';
import { CacheMetrics } from '@app/observability';
import { ObjectRegistry, catalogoInicial } from '@app/ui-components';
import { cacheL1, cacheL2 } from './almacenCompartido';
import { gobierno } from './gobierno';

/** Contexto de servidor del shell. */

/*
 * El conector activo lo resuelve ahora `configuracion.ts` contra App Configuration (2.2).
 */
export { conectorActivo } from './configuracion';

export const objectRegistry = new ObjectRegistry(catalogoInicial);

// El store y su directorio viven en `almacenCompartido`, que no depende de nadie: ponerlos
// aqui creaba un ciclo de importacion con el gobierno.
export { CACHE_DIR, cacheL2 } from './almacenCompartido';

/** Metricas del camino de lectura (8.3). */
export const metricasDeCache = new CacheMetrics();

export const datasetReader = new CachedDatasetReader({
  l1: cacheL1,
  l2: cacheL2,
  onRead: (evento) =>
    metricasDeCache.registrar({
      datasetId: evento.datasetId,
      status: evento.status,
      ...(evento.servedFrom ? { servedFrom: evento.servedFrom } : {}),
      stale: evento.stale,
      ...(evento.ageMs !== undefined ? { ageMs: evento.ageMs } : {}),
    }),
});

/** Organizacion general vigente (4.1.1). */
export async function getGeneralTree(): Promise<NavNode[]> {
  return (await gobierno.getTree()).nodes;
}

export async function getManagedTree(): Promise<ManagedTree> {
  return gobierno.getTree();
}

export async function listTeams(): Promise<Team[]> {
  return gobierno.listTeams();
}

export async function findTeam(teamId: string): Promise<Team | undefined> {
  return gobierno.getTeam(teamId);
}

export async function listUsers(): Promise<GovernedUser[]> {
  return gobierno.listUsers();
}

export async function findUser(userId: string): Promise<GovernedUser | undefined> {
  return gobierno.getUser(userId);
}

/** Equipos a los que pertenece una persona, para el selector de espacio de trabajo (4.10.2). */
export async function teamsOf(userId: string): Promise<Team[]> {
  return (await gobierno.listTeams()).filter((t) => t.members.some((m) => m.userId === userId));
}

export async function roleOf(userId: string, teamId: string): Promise<string> {
  const equipo = await gobierno.getTeam(teamId);
  return equipo?.members.find((m) => m.userId === userId)?.role ?? 'visor';
}

/** Vista de navegacion de una persona con un equipo activo dado. */
export async function navigationFor(teamId: string) {
  const team = await gobierno.getTeam(teamId);
  if (!team) return { tree: [], fromPackage: false, dangling: [] };

  const pkg = team.assignedPackageId ? await gobierno.getPackage(team.assignedPackageId) : undefined;
  return buildNavigationView({
    generalTree: await getGeneralTree(),
    team,
    ...(pkg ? { pkg } : {}),
  });
}

/** Ambito efectivo para un modulo, con el equipo ACTIVO (nunca la union de todos). */
export async function scopeFor(userId: string, teamId: string, moduleId: string) {
  const user = (await gobierno.getUser(userId)) ?? { userId };
  const team = await gobierno.getTeam(teamId);
  if (!team) return null;
  return resolveEffectiveScope({
    user,
    activeTeam: team,
    moduleId,
    generalTree: await getGeneralTree(),
  });
}
