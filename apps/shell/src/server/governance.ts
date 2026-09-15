import { GOVERNANCE_KEY, mutar, leer } from './almacenCompartido';
import { markInstalled } from './installation';
import type {
  GovernedUser,
  ManagedTree,
  ModulePackage,
  NavNode,
  Team,
} from '@app/access-control';
import { BUILT_IN_THEMES, INSTITUTIONAL_THEME, type ThemeDefinition } from '@app/design-tokens';
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

  listThemes(): Promise<ThemeDefinition[]>;
  getTheme(themeId: string): Promise<ThemeDefinition | undefined>;
  upsertTheme(theme: ThemeDefinition): Promise<void>;
  deleteTheme(themeId: string): Promise<boolean>;
  /** Cual se sirve. Es uno solo: el color de la institucion no se reparte por equipos. */
  getActiveTheme(): Promise<string>;
  setActiveTheme(themeId: string): Promise<void>;
}

/** Instantanea completa del gobierno, tal como viaja al almacen compartido. */
export interface GovernanceSnapshot {
  tree: ManagedTree;
  teams: Team[];
  users: GovernedUser[];
  packages: ModulePackage[];
  /*
   * Opcionales a proposito: una instantanea guardada ANTES de que existieran los temas se sigue
   * leyendo, y cae al tema de fabrica. Hacerlos obligatorios habria dejado la aplicacion sin color
   * al desplegar sobre lo que ya estaba escrito, que es el peor momento para descubrirlo.
   */
  themes?: ThemeDefinition[];
  activeThemeId?: string;
}

/** Estado inicial, reconstruido desde el seed con los mapeadores reales. */
export function initialStatus(): GovernanceSnapshot {
  const lookup = buildScopeLookup(seedScopes, seedRestrictions, []);
  const nodes: NavNode[] = buildNavTree(seedNavNodes, lookup);

  return {
    tree: { nodes, trash: [] },
    teams: seedTeams.map((row) =>
      toTeam(row, seedGrantedNodes, seedMemberships, seedModuleScopes, lookup),
    ),
    users: seedUsers.map((row) => toGovernedUser(row, seedUserScopes, lookup)),
    packages: [],
    themes: [...BUILT_IN_THEMES],
    activeThemeId: INSTITUTIONAL_THEME.id,
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
    // Bajo turno: el gobierno entero es UN valor, asi que dos cambios simultaneos de cosas
    // distintas —un equipo y una carpeta— se pisan igual que dos del mismo campo. El que
    // escribiera segundo devolveria el arbol al estado anterior sin que nadie lo notara.
    await mutar<GovernanceSnapshot>(GOVERNANCE_KEY, (guardada) =>
      change(guardada ?? initialStatus()),
    );
    // A partir de aqui este despliegue ya no depende de la semilla, y encontrar el gobierno
    // ausente pasa a significar que se perdio. Ver `installation.ts`.
    await markInstalled(GOVERNANCE_KEY);
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

  /*
   * El tema de fabrica SIEMPRE esta en la lista, se haya guardado o no.
   *
   * Es lo que hace que borrar el ultimo tema no deje la aplicacion sin color, y lo que permite
   * leer una instantanea escrita antes de que los temas existieran sin tratarla como un caso
   * aparte en cada sitio que lea un tema.
   */
  async listThemes(): Promise<ThemeDefinition[]> {
    const guardados = (await this.snapshot()).themes ?? [];
    /*
     * Los de fabrica se anteponen SIEMPRE, y desde el codigo, no desde lo guardado.
     *
     * Es lo que hace que borrar el ultimo tema no deje la aplicacion sin color, y ademas lo que
     * permite anadir uno de fabrica sin migrar los almacenes que ya existen: una instantanea
     * escrita antes de que existiera lo trae igual, con su definicion de hoy y no con una copia
     * congelada del dia que se guardo.
     */
    const deFabrica = new Set(BUILT_IN_THEMES.map((t) => t.id));
    const propios = guardados.filter((t) => !deFabrica.has(t.id));
    return [...BUILT_IN_THEMES, ...propios];
  }
  async getTheme(themeId: string): Promise<ThemeDefinition | undefined> {
    return (await this.listThemes()).find((t) => t.id === themeId);
  }
  async upsertTheme(theme: ThemeDefinition): Promise<void> {
    await this.guardar((actual) => ({
      ...actual,
      themes: [...(actual.themes ?? []).filter((t) => t.id !== theme.id), clonar(theme)],
    }));
  }
  async deleteTheme(themeId: string): Promise<boolean> {
    const existe = (await this.getTheme(themeId)) !== undefined;
    if (!existe || BUILT_IN_THEMES.some((t) => t.id === themeId)) return false;

    await this.guardar((actual) => ({
      ...actual,
      themes: (actual.themes ?? []).filter((t) => t.id !== themeId),
      // Si el que se borra era el que se servia, la aplicacion vuelve al de fabrica en vez de
      // quedarse apuntando a uno que ya no existe.
      activeThemeId:
        actual.activeThemeId === themeId ? INSTITUTIONAL_THEME.id : actual.activeThemeId,
    }));
    return true;
  }

  async getActiveTheme(): Promise<string> {
    const snapshot = await this.snapshot();
    const pedido = snapshot.activeThemeId;
    // Uno que ya no existe cae al de fabrica: sin esto, borrar un tema activo desde otra
    // instancia dejaria esta dibujando sin variables de color.
    const existe =
      (snapshot.themes ?? []).some((t) => t.id === pedido) ||
      BUILT_IN_THEMES.some((t) => t.id === pedido);
    return pedido && existe ? pedido : INSTITUTIONAL_THEME.id;
  }
  async setActiveTheme(themeId: string): Promise<void> {
    await this.guardar((actual) => ({ ...actual, activeThemeId: themeId }));
  }

  /** Solo para pruebas: devuelve el almacen a su estado sembrado. */
  async reset(): Promise<void> {
    // Tambien bajo turno: si no, un reset lanzado a la vez que una escritura puede quedar
    // debajo de ella y dejar el almacen a medio sembrar.
    await mutar<GovernanceSnapshot>(GOVERNANCE_KEY, () => initialStatus());
  }
}

/** Almacen de gobierno en uso. */
export const governance = new StoreGovernanceRepository();
