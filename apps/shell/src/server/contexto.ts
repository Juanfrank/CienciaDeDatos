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
import {
  buildNavTree,
  buildScopeLookup,
  toGovernedUser,
  toTeam,
  seedGrantedNodes,
  seedMemberships,
  seedModuleScopes,
  seedNavNodes,
  seedRestrictions,
  seedScopes,
  seedTeams,
  seedUserScopes,
  seedUsers,
} from '@app/identity-db';
import { ObjectRegistry, catalogoInicial } from '@app/ui-components';

/**
 * Contexto de servidor del shell.
 *
 * Es la unica pieza del shell que conoce de donde sale cada cosa. Cablea los adaptadores de
 * DESARROLLO: gobierno leido del seed a traves de los mapeadores reales, sesion en memoria, y
 * un cache en disco compartido con el job. Los adaptadores de Azure (Azure SQL, Blob Storage)
 * implementan los mismos puertos y se sustituyen aqui, sin tocar nada mas.
 *
 * Lo que NO hay aqui, y es deliberado: ninguna referencia a `@app/data-contracts-server`. El
 * shell no puede instanciar un conector —la regla de limites lo prohibe— porque el camino de
 * lectura de una solicitud de usuario se sirve exclusivamente desde el cache (6.3).
 */

/** Directorio del cache L2, compartido con el job de poblacion. */
export const CACHE_DIR = process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');

/** Conector configurado como activo. En produccion lo resuelve Azure App Configuration (2.2). */
export const CONNECTOR_KIND = process.env['DATA_CONNECTOR'] ?? 'mock';

const lookup = buildScopeLookup(seedScopes, seedRestrictions, []);

/** Organizacion general (4.1.1), reconstruida desde el seed con los mapeadores reales. */
export const generalTree: NavNode[] = buildNavTree(seedNavNodes, lookup);

export const managedTree: ManagedTree = { nodes: generalTree, trash: [] };

export const teams: Team[] = seedTeams.map((row) =>
  toTeam(row, seedGrantedNodes, seedMemberships, seedModuleScopes, lookup),
);

export const users: GovernedUser[] = seedUsers.map((row) =>
  toGovernedUser(row, seedUserScopes, lookup),
);

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

export function findTeam(teamId: string): Team | undefined {
  return teams.find((t) => t.id === teamId);
}

export function findUser(userId: string): GovernedUser | undefined {
  return users.find((u) => u.userId === userId);
}

/** Equipos a los que pertenece una persona, para el selector de espacio de trabajo (4.10.2). */
export function teamsOf(userId: string): Team[] {
  return teams.filter((t) => t.members.some((m) => m.userId === userId));
}

export function roleOf(userId: string, teamId: string): string {
  return teams.find((t) => t.id === teamId)?.members.find((m) => m.userId === userId)?.role ?? 'visor';
}

/** Vista de navegacion de una persona con un equipo activo dado. */
export function navigationFor(teamId: string) {
  const team = findTeam(teamId);
  if (!team) return { tree: [], fromPackage: false, dangling: [] };
  return buildNavigationView({ generalTree, team });
}

/** Ambito efectivo para un modulo, con el equipo ACTIVO (nunca la union de todos). */
export function scopeFor(userId: string, teamId: string, moduleId: string) {
  const user = findUser(userId) ?? { userId };
  const team = findTeam(teamId);
  if (!team) return null;
  return resolveEffectiveScope({ user, activeTeam: team, moduleId, generalTree });
}
