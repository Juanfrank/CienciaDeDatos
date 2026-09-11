import { CLAVE_GOBIERNO, escribir, leer } from './almacenCompartido';
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
 * Se define como PUERTO, y es ASINCRONO. Lo era todo menos eso hasta ahora, y ese era el error:
 * un puerto sincrono NO LO PUEDE IMPLEMENTAR una base de datos, asi que el adaptador de Azure SQL
 * que este archivo prometia era imposible de escribir sin cambiar antes la firma y con ella todos
 * los sitios que la usan. Hacerlo ahora es pagar esa deuda en el momento en que aparece el
 * segundo motivo para hacerlo: el estado tiene que dejar de ser del proceso (seccion 9).
 */
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
export interface InstantaneaDeGobierno {
  tree: ManagedTree;
  teams: Team[];
  users: GovernedUser[];
  packages: ModulePackage[];
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

/**
 * Adaptador sobre el almacen compartido.
 *
 * Guarda UNA instantanea completa. Es lo correcto para el tamano real de este dato —un arbol de
 * carpetas, unos equipos y unos usuarios— y para lo poco que se escribe: solo el Administrador,
 * y solo cuando cambia la configuracion. Partirlo por entidad complicaria las lecturas, que son
 * casi todas, para optimizar unas escrituras que casi nunca ocurren.
 *
 * Limite conocido: dos escrituras simultaneas del panel pueden pisarse, porque `ICacheStore` no
 * ofrece lectura-modificacion-escritura atomica. En la base de identidad lo resuelve una
 * transaccion; aqui se acota a que el panel lo usa un Administrador cada vez, y queda escrito
 * para que nadie lo confunda con un almacen transaccional.
 */
export class StoreGovernanceRepository implements GovernanceStore {
  private async instantanea(): Promise<InstantaneaDeGobierno> {
    const guardada = await leer<InstantaneaDeGobierno>(CLAVE_GOBIERNO);
    // Sin nada guardado todavia se devuelve el estado sembrado SIN persistirlo. Escribir al
    // leer metia una escritura en el camino de lectura —el mas concurrido— y, con varias
    // peticiones a la vez, varias escrituras simultaneas de la misma clave. El seed es
    // determinista, asi que todas las instancias ven lo mismo hasta que alguien escriba.
    return guardada ?? estadoInicial();
  }

  private async guardar(cambio: (actual: InstantaneaDeGobierno) => InstantaneaDeGobierno): Promise<void> {
    await escribir(CLAVE_GOBIERNO, cambio(await this.instantanea()));
  }

  async getTree(): Promise<ManagedTree> {
    return (await this.instantanea()).tree;
  }
  async setTree(tree: ManagedTree): Promise<void> {
    await this.guardar((actual) => ({ ...actual, tree: clonar(tree) }));
  }

  async listTeams(): Promise<Team[]> {
    return (await this.instantanea()).teams;
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
    const existe = (await this.getTeam(teamId)) !== undefined;
    if (existe) {
      await this.guardar((actual) => ({
        ...actual,
        teams: actual.teams.filter((t) => t.id !== teamId),
      }));
    }
    return existe;
  }

  async listPackages(): Promise<ModulePackage[]> {
    return (await this.instantanea()).packages;
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
    const existe = (await this.getPackage(packageId)) !== undefined;
    if (!existe) return false;

    await this.guardar((actual) => ({
      ...actual,
      packages: actual.packages.filter((p) => p.id !== packageId),
      // Un paquete borrado deja a sus equipos sin paquete asignado: vuelven a ver la
      // organizacion general tal cual (4.1.3). No se les quita acceso.
      teams: actual.teams.map((equipo) => {
        if (equipo.assignedPackageId !== packageId) return equipo;
        const sinPaquete = { ...equipo };
        delete sinPaquete.assignedPackageId;
        return sinPaquete;
      }),
    }));
    return true;
  }

  async listUsers(): Promise<GovernedUser[]> {
    return (await this.instantanea()).users;
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
    await escribir(CLAVE_GOBIERNO, estadoInicial());
  }
}

/**
 * Almacen de gobierno en uso.
 *
 * Ya no se cuelga de globalThis: el estado vive en el almacen compartido, asi que sobrevive por
 * si solo a la recarga en caliente Y lo ven todas las instancias.
 */
export const gobierno = new StoreGovernanceRepository();
