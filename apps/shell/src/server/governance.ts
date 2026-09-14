import { GOVERNANCE_KEY, write, leer } from './almacenCompartido';
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

/** Almacen de gobierno — secciones 4.10.7 y 4.10.8. */
export interface GovernanceStore {
  getTree(): Promise<ManagedTree>;
  setTree(tree: ManagedTree): Promise<void>;

  listTeams(): Promise<Team[]>;
  getTeam(teamId: string): Promise<Team | undefined>;
  upsertTeam(team: Team): Promise<void>;
  deleteTeam(teamId: string): Promise<boolean>;

  listPackages(): Promise<ModulePackage[]>;
  getPackage(packageId: string): Promise<ModulePackage | undefined>;
  upsertPackage(pkg: ModulePackage): Promise<void>;
  deletePackage(packageId: string): Promise<boolean>;

  listUsers(): Promise<GovernedUser[]>;
  getUser(userId: string): Promise<GovernedUser | undefined>;
  upsertUser(user: GovernedUser): Promise<void>;
}

/** Instantanea completa del gobierno, tal como viaja al almacen compartido. */
export interface GovernanceSnapshot {
  tree: ManagedTree;
  teams: Team[];
  users: GovernedUser[];
  packages: ModulePackage[];
}

/** Estado inicial, reconstruido desde el seed con los mapeadores reales. */
export function initialStatus(): {
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

/** Adaptador sobre el almacen compartido. */
export class StoreGovernanceRepository implements GovernanceStore {
  private async snapshot(): Promise<GovernanceSnapshot> {
    const guardada = await leer<GovernanceSnapshot>(GOVERNANCE_KEY);
    // Sin nada guardado todavia se devuelve el estado sembrado SIN persistirlo. Escribir al
    // leer metia una escritura en el camino de lectura —el mas concurrido— y, con varias
    // peticiones a la vez, varias escrituras simultaneas de la misma clave. El seed es
    // determinista, asi que todas las instancias ven lo mismo hasta que alguien escriba.
    return guardada ?? initialStatus();
  }

  private async guardar(change: (actual: GovernanceSnapshot) => GovernanceSnapshot): Promise<void> {
    await write(GOVERNANCE_KEY, change(await this.snapshot()));
  }

  async getTree(): Promise<ManagedTree> {
    return (await this.snapshot()).tree;
  }
  async setTree(tree: ManagedTree): Promise<void> {
    await this.guardar((actual) => ({ ...actual, tree: clonar(tree) }));
  }

  async listTeams(): Promise<Team[]> {
    return (await this.snapshot()).teams;
  }
  async getTeam(teamId: string): Promise<Team | undefined> {
    return (await this.listTeams()).find((t) => t.id === teamId);
  }
  async upsertTeam(team: Team): Promise<void> {
    await this.guardar((actual) => ({
      ...actual,
      teams: [...actual.teams.filter((t) => t.id !== team.id), clonar(team)],
    }));
  }
  async deleteTeam(teamId: string): Promise<boolean> {
    const exists = (await this.getTeam(teamId)) !== undefined;
    if (exists) {
      await this.guardar((actual) => ({
        ...actual,
        teams: actual.teams.filter((t) => t.id !== teamId),
      }));
    }
    return exists;
  }

  async listPackages(): Promise<ModulePackage[]> {
    return (await this.snapshot()).packages;
  }
  async getPackage(packageId: string): Promise<ModulePackage | undefined> {
    return (await this.listPackages()).find((p) => p.id === packageId);
  }
  async upsertPackage(pkg: ModulePackage): Promise<void> {
    await this.guardar((actual) => ({
      ...actual,
      packages: [...actual.packages.filter((p) => p.id !== pkg.id), clonar(pkg)],
    }));
  }
  async deletePackage(packageId: string): Promise<boolean> {
    const exists = (await this.getPackage(packageId)) !== undefined;
    if (!exists) return false;

    await this.guardar((actual) => ({
      ...actual,
      packages: actual.packages.filter((p) => p.id !== packageId),
      // Un paquete borrado deja a sus equipos sin paquete asignado: vuelven a ver la
      // organizacion general tal cual (4.1.3). No se les quita acceso.
      teams: actual.teams.map((equipo) => {
        if (equipo.assignedPackageId !== packageId) return equipo;
        const withoutPackage = { ...equipo };
        delete withoutPackage.assignedPackageId;
        return withoutPackage;
      }),
    }));
    return true;
  }

  async listUsers(): Promise<GovernedUser[]> {
    return (await this.snapshot()).users;
  }
  async getUser(userId: string): Promise<GovernedUser | undefined> {
    return (await this.listUsers()).find((u) => u.userId === userId);
  }
  async upsertUser(user: GovernedUser): Promise<void> {
    await this.guardar((actual) => ({
      ...actual,
      users: [...actual.users.filter((u) => u.userId !== user.userId), clonar(user)],
    }));
  }

  /** Solo para pruebas: devuelve el almacen a su estado sembrado. */
  async reset(): Promise<void> {
    await write(GOVERNANCE_KEY, initialStatus());
  }
}

/** Almacen de gobierno en uso. */
export const governance = new StoreGovernanceRepository();
