import type {
  GovernedUser,
  ManagedTree,
  ModulePackage,
  NavNode,
  Team,
} from '@app/access-control';
import {
  buildNavTree,
  buildScopeLookup,
  seedGrantedNodes,
  seedMemberships,
  seedModuleScopes,
  seedNavNodes,
  seedRestrictions,
  seedScopes,
  seedTeams,
  seedUserScopes,
  seedUsers,
  toGovernedUser,
  toTeam,
} from '@app/identity-db';

/**
 * Almacen de gobierno — secciones 4.10.7 y 4.10.8.
 *
 * El panel de administracion ESCRIBE configuracion (arbol, equipos, ambitos, paquetes), asi que
 * el gobierno ya no puede ser un puñado de constantes derivadas del seed.
 *
 * Se define como PUERTO. La implementacion en memoria de abajo es la de desarrollo; el adaptador
 * sobre Azure SQL implementa esta misma interfaz y entra sin tocar ni una linea del panel. El
 * esquema Prisma ya esta validado y los mapeadores fila -> dominio ya existen: lo unico que falta
 * cuando haya base es otra implementacion de esto.
 */
export interface GovernanceStore {
  getTree(): ManagedTree;
  setTree(tree: ManagedTree): void;

  listTeams(): Team[];
  getTeam(teamId: string): Team | undefined;
  upsertTeam(team: Team): void;
  deleteTeam(teamId: string): boolean;

  listPackages(): ModulePackage[];
  getPackage(packageId: string): ModulePackage | undefined;
  upsertPackage(pkg: ModulePackage): void;
  deletePackage(packageId: string): boolean;

  listUsers(): GovernedUser[];
  getUser(userId: string): GovernedUser | undefined;
  upsertUser(user: GovernedUser): void;
}

/** Estado inicial, reconstruido desde el seed con los mapeadores reales. */
export function estadoInicial(): {
  tree: ManagedTree;
  teams: Team[];
  users: GovernedUser[];
  packages: ModulePackage[];
} {
  const lookup = buildScopeLookup(seedScopes, seedRestrictions, []);
  const nodes: NavNode[] = buildNavTree(seedNavNodes, lookup);

  return {
    tree: { nodes, trash: [] },
    teams: seedTeams.map((row) =>
      toTeam(row, seedGrantedNodes, seedMemberships, seedModuleScopes, lookup),
    ),
    users: seedUsers.map((row) => toGovernedUser(row, seedUserScopes, lookup)),
    packages: [],
  };
}

/** Copia profunda. Evita que quien lee pueda mutar el estado del almacen por accidente. */
const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

export class InMemoryGovernanceStore implements GovernanceStore {
  private tree: ManagedTree;
  private readonly teams = new Map<string, Team>();
  private readonly users = new Map<string, GovernedUser>();
  private readonly packages = new Map<string, ModulePackage>();

  constructor() {
    const inicial = estadoInicial();
    this.tree = inicial.tree;
    for (const t of inicial.teams) this.teams.set(t.id, t);
    for (const u of inicial.users) this.users.set(u.userId, u);
    for (const p of inicial.packages) this.packages.set(p.id, p);
  }

  getTree(): ManagedTree {
    return clonar(this.tree);
  }
  setTree(tree: ManagedTree): void {
    this.tree = clonar(tree);
  }

  listTeams(): Team[] {
    return [...this.teams.values()].map(clonar);
  }
  getTeam(teamId: string): Team | undefined {
    const t = this.teams.get(teamId);
    return t ? clonar(t) : undefined;
  }
  upsertTeam(team: Team): void {
    this.teams.set(team.id, clonar(team));
  }
  deleteTeam(teamId: string): boolean {
    return this.teams.delete(teamId);
  }

  listPackages(): ModulePackage[] {
    return [...this.packages.values()].map(clonar);
  }
  getPackage(packageId: string): ModulePackage | undefined {
    const p = this.packages.get(packageId);
    return p ? clonar(p) : undefined;
  }
  upsertPackage(pkg: ModulePackage): void {
    this.packages.set(pkg.id, clonar(pkg));
  }
  deletePackage(packageId: string): boolean {
    // Un paquete borrado deja a sus equipos sin paquete asignado: vuelven a ver la organizacion
    // general tal cual, que es el comportamiento por defecto de 4.1.3. No se les quita acceso.
    for (const equipo of this.teams.values()) {
      if (equipo.assignedPackageId === packageId) {
        const sinPaquete = { ...equipo };
        delete sinPaquete.assignedPackageId;
        this.teams.set(equipo.id, sinPaquete);
      }
    }
    return this.packages.delete(packageId);
  }

  listUsers(): GovernedUser[] {
    return [...this.users.values()].map(clonar);
  }
  getUser(userId: string): GovernedUser | undefined {
    const u = this.users.get(userId);
    return u ? clonar(u) : undefined;
  }
  upsertUser(user: GovernedUser): void {
    this.users.set(user.userId, clonar(user));
  }

  /** Solo para pruebas: devuelve el almacen a su estado sembrado. */
  reset(): void {
    const inicial = estadoInicial();
    this.tree = inicial.tree;
    this.teams.clear();
    this.users.clear();
    this.packages.clear();
    for (const t of inicial.teams) this.teams.set(t.id, t);
    for (const u of inicial.users) this.users.set(u.userId, u);
  }
}

/**
 * Instancia del proceso.
 *
 * Colgada de globalThis para sobrevivir a la recarga en caliente del servidor de desarrollo: un
 * modulo recargado perderia toda la configuracion que el Administrador acabara de hacer.
 */
export const gobierno: InMemoryGovernanceStore = ((
  globalThis as Record<string, unknown>
)['__gobierno'] ??= new InMemoryGovernanceStore()) as InMemoryGovernanceStore;
