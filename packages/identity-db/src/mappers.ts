import type {
  AccessScope,
  AppRole,
  GovernedUser,
  ModulePackage,
  NavNode,
  Team,
} from '@app/access-control';
import { APP_ROLES } from '@app/access-control';
import type {
  AccessScopeRow,
  ModulePackageRow,
  NavNodeRow,
  PackageNodeRow,
  ScopeExpansionRow,
  ScopeRestrictionRow,
  TeamGrantedNodeRow,
  TeamMembershipRow,
  TeamModuleScopeRow,
  TeamRow,
  UserRow,
  UserScopeRow,
} from './rows';

/** Mapeadores entre las filas del almacen y los tipos de dominio. */

export function parseAllowedValues(serialized: string): string[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Una fila corrupta no puede convertirse en "sin restriccion": eso ampliaria el acceso
    // en silencio. Se trata como restriccion vacia, que no permite nada.
    return [];
  }
}

export const serializeAllowedValues = (values: string[]): string => JSON.stringify(values);

export function toAccessScope(
  row: AccessScopeRow,
  restrictions: ScopeRestrictionRow[],
  expansion?: ScopeExpansionRow | null,
): AccessScope {
  const scope: AccessScope = {
    restrictions: restrictions
      .filter((r) => r.scopeId === row.id)
      .map((r) => ({
        dimension: { table: r.dimTable, field: r.dimField },
        allowedValues: parseAllowedValues(r.allowedValues),
      })),
  };

  // Una excepcion revocada deja de ampliar: vuelve a comportarse como una restriccion normal.
  if (expansion && !expansion.revokedAt) {
    scope.authorizedExpansion = {
      justification: expansion.justification,
      authorizedBy: expansion.authorizedBy,
      authorizedAt: expansion.authorizedAt.toISOString(),
    };
  }

  return scope;
}

export interface ScopeLookup {
  get(scopeId: string): AccessScope | undefined;
}

/** Reconstruye la organizacion general desde la lista de adyacencia. */
export function buildNavTree(rows: NavNodeRow[], scopes: ScopeLookup): NavNode[] {
  const vigentes = rows.filter((r) => r.deletedAt === null);
  const id = new Map(vigentes.map((r) => [r.id, r]));
  const hijosDe = new Map<string | null, NavNodeRow[]>();

  for (const row of vigentes) {
    // Si el padre declarado no esta vigente, el nodo es huerfano: se descarta del arbol.
    const currentParent = row.parentId === null || id.has(row.parentId);
    if (!currentParent) continue;
    const clave = row.parentId;
    const lista = hijosDe.get(clave) ?? [];
    lista.push(row);
    hijosDe.set(clave, lista);
  }

  const ordenar = (lista: NavNodeRow[]): NavNodeRow[] =>
    [...lista].sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name));

  const build = (parentId: string | null): NavNode[] =>
    ordenar(hijosDe.get(parentId) ?? []).map((row): NavNode => {
      if (row.type === 'module') {
        return {
          id: row.id,
          type: 'module',
          moduleRef: {
            moduleId: row.moduleId ?? row.id,
            slug: row.slug ?? row.id,
            name: row.name,
            ...(row.icon ? { icon: row.icon } : {}),
          },
        };
      }
      const scope = row.scopeId ? scopes.get(row.scopeId) : undefined;
      return {
        id: row.id,
        type: 'folder',
        name: row.name,
        ...(row.icon ? { icon: row.icon } : {}),
        children: build(row.id),
        ...(scope ? { scope } : {}),
      };
    });

  return build(null);
}

/** Un rol desconocido en la base no se degrada a colaborador: se trata como el minimo (4.10.1). */
export function toAppRole(value: string): AppRole {
  return (APP_ROLES as readonly string[]).includes(value) ? (value as AppRole) : 'visor';
}

export function toTeam(
  row: TeamRow,
  grantedNodes: TeamGrantedNodeRow[],
  members: TeamMembershipRow[],
  moduleScopes: TeamModuleScopeRow[],
  scopes: ScopeLookup,
): Team {
  const overrides: Record<string, AccessScope> = {};
  for (const ms of moduleScopes.filter((m) => m.teamId === row.id)) {
    const scope = scopes.get(ms.scopeId);
    if (scope) overrides[ms.moduleId] = scope;
  }

  return {
    id: row.id,
    name: row.name,
    grantedNodes: grantedNodes.filter((g) => g.teamId === row.id).map((g) => g.nodeId),
    members: members
      .filter((m) => m.teamId === row.id)
      .map((m) => ({ userId: m.userId, role: toAppRole(m.role) })),
    defaultScope: (row.defaultScopeId ? scopes.get(row.defaultScopeId) : undefined) ?? {
      restrictions: [],
    },
    moduleScopeOverrides: overrides,
    ...(row.assignedPackageId ? { assignedPackageId: row.assignedPackageId } : {}),
  };
}

export function toGovernedUser(row: UserRow, userScopes: UserScopeRow[], scopes: ScopeLookup): GovernedUser {
  const mios = userScopes.filter((s) => s.userId === row.id);
  const general = mios.find((s) => s.moduleId === '');
  const module: Record<string, AccessScope> = {};
  for (const s of mios.filter((x) => x.moduleId !== '')) {
    const scope = scopes.get(s.scopeId);
    if (scope) module[s.moduleId] = scope;
  }

  const personalScope = general ? scopes.get(general.scopeId) : undefined;

  return {
    userId: row.id,
    ...(personalScope ? { personalScope } : {}),
    ...(Object.keys(module).length > 0 ? { personalModuleScopeOverrides: module } : {}),
    ...(row.combineTeamsByUnion ? { combineTeamsByUnion: true } : {}),
  };
}

/** Reconstruye el arbol de presentacion de un paquete. */
export function buildPackageTree(pkg: ModulePackageRow, rows: PackageNodeRow[]): ModulePackage {
  const mios = rows.filter((r) => r.packageId === pkg.id);
  const hijosDe = new Map<string | null, PackageNodeRow[]>();
  for (const row of mios) {
    const lista = hijosDe.get(row.parentId) ?? [];
    lista.push(row);
    hijosDe.set(row.parentId, lista);
  }

  const build = (parentId: string | null): NavNode[] =>
    [...(hijosDe.get(parentId) ?? [])]
      .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
      .map((row): NavNode =>
        row.type === 'module'
          ? {
              id: row.id,
              type: 'module',
              moduleRef: {
                moduleId: row.moduleId ?? row.id,
                slug: row.moduleId ?? row.id,
                name: row.name,
                ...(row.icon ? { icon: row.icon } : {}),
              },
            }
          : {
              id: row.id,
              type: 'folder',
              name: row.name,
              ...(row.icon ? { icon: row.icon } : {}),
              children: build(row.id),
            },
      );

  return { id: pkg.id, name: pkg.name, visualTree: build(null) };
}

/** Indice de ambitos, para que los mapeadores no hagan consultas por su cuenta. */
export function buildScopeLookup(
  scopeRows: AccessScopeRow[],
  restrictions: ScopeRestrictionRow[],
  expansions: ScopeExpansionRow[],
): ScopeLookup {
  const porExpansion = new Map(expansions.map((e) => [e.id, e]));
  const map = new Map<string, AccessScope>(
    scopeRows.map((row) => [
      row.id,
      toAccessScope(row, restrictions, row.expansionId ? porExpansion.get(row.expansionId) : null),
    ]),
  );
  return { get: (id) => map.get(id) };
}
