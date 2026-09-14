import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveEffectiveScope, dimensionKey } from '@app/access-control';
import {
  buildNavTree,
  buildPackageTree,
  buildScopeLookup,
  parseAllowedValues,
  serializeAllowedValues,
  toAppRole,
  toGovernedUser,
  toTeam,
} from './mappers';
import type { NavNodeRow, ScopeExpansionRow } from './rows';

const scale = buildScopeLookup(
  [
    { id: 'sc-regional', expansionId: null },
    { id: 'sc-norte', expansionId: null },
    { id: 'sc-materia', expansionId: null },
  ],
  [
    {
      scopeId: 'sc-regional',
      dimTable: 'DimTribunal',
      dimField: 'Distrito',
      allowedValues: serializeAllowedValues(['Distrito Norte', 'Distrito Este']),
    },
    {
      scopeId: 'sc-norte',
      dimTable: 'DimTribunal',
      dimField: 'Distrito',
      allowedValues: serializeAllowedValues(['Distrito Norte']),
    },
    {
      scopeId: 'sc-materia',
      dimTable: 'DimTribunal',
      dimField: 'Materia',
      allowedValues: serializeAllowedValues(['Penal']),
    },
  ],
  [],
);

const dataRows: NavNodeRow[] = [
  { id: 'raiz', type: 'folder', name: 'Institucional', icon: null, parentId: null, orderIndex: 0, moduleId: null, slug: null, deletedAt: null, scopeId: null },
  { id: 'regional', type: 'folder', name: 'Regional', icon: null, parentId: 'raiz', orderIndex: 0, moduleId: null, slug: null, deletedAt: null, scopeId: 'sc-regional' },
  { id: 'norte', type: 'folder', name: 'Norte', icon: null, parentId: 'regional', orderIndex: 1, moduleId: null, slug: null, deletedAt: null, scopeId: 'sc-norte' },
  { id: 'este', type: 'folder', name: 'Este', icon: null, parentId: 'regional', orderIndex: 0, moduleId: null, slug: null, deletedAt: null, scopeId: null },
  { id: 'm-casos', type: 'module', name: 'Casos', icon: 'chart', parentId: 'norte', orderIndex: 0, moduleId: 'casos', slug: 'casos', deletedAt: null, scopeId: null },
];

describe('buildNavTree — reconstruccion desde lista de adyacencia', () => {
  it('reconstruye la jerarquia completa a cualquier profundidad', () => {
    const arbol = buildNavTree(dataRows, scale);
    const raiz = arbol[0];
    if (raiz?.type !== 'folder') throw new Error('se esperaba carpeta');
    const regional = raiz.children[0];
    if (regional?.type !== 'folder') throw new Error('se esperaba carpeta');
    expect(regional.name).toBe('Regional');
    expect(regional.children.map((c) => c.id)).toEqual(['este', 'norte']);
  });

  it('respeta orderIndex entre hermanos, no el orden de las filas', () => {
    const arbol = buildNavTree(dataRows, scale);
    const raiz = arbol[0];
    if (raiz?.type !== 'folder') throw new Error('se esperaba carpeta');
    const regional = raiz.children[0];
    if (regional?.type !== 'folder') throw new Error('se esperaba carpeta');
    // 'este' tiene orderIndex 0 y 'norte' 1, aunque en las filas aparezca antes 'norte'.
    expect(regional.children[0]?.id).toBe('este');
  });

  it('adjunta el ambito de la carpeta desde el indice de ambitos', () => {
    const arbol = buildNavTree(dataRows, scale);
    const raiz = arbol[0];
    if (raiz?.type !== 'folder') throw new Error('se esperaba carpeta');
    const regional = raiz.children[0];
    if (regional?.type !== 'folder') throw new Error('se esperaba carpeta');
    expect(regional.scope?.restrictions[0]?.allowedValues).toEqual(['Distrito Norte', 'Distrito Este']);
  });

  it('mapea las hojas de modulo con su slug e icono', () => {
    const arbol = buildNavTree(dataRows, scale);
    const raiz = arbol[0];
    if (raiz?.type !== 'folder') throw new Error('se esperaba carpeta');
    const regional = raiz.children[0];
    if (regional?.type !== 'folder') throw new Error('se esperaba carpeta');
    const norte = regional.children[1];
    if (norte?.type !== 'folder') throw new Error('se esperaba carpeta');
    expect(norte.children[0]).toEqual({
      id: 'm-casos',
      type: 'module',
      moduleRef: { moduleId: 'casos', slug: 'casos', name: 'Casos', icon: 'chart' },
    });
  });

  it('excluye del arbol vigente lo que esta en papelera (4.1)', () => {
    const withTrash = dataRows.map((f) =>
      f.id === 'm-casos' ? { ...f, deletedAt: new Date('2026-09-01') } : f,
    );
    const arbol = buildNavTree(withTrash, scale);
    expect(JSON.stringify(arbol)).not.toContain('m-casos');
  });

  it('un nodo cuyo ancestro esta en papelera NO se cuelga de la raiz', () => {
    // Colgarlo en la raiz lo sacaria de una carpeta restrictiva y ampliaria su ambito.
    const withTrash = dataRows.map((f) =>
      f.id === 'norte' ? { ...f, deletedAt: new Date('2026-09-01') } : f,
    );
    const arbol = buildNavTree(withTrash, scale);
    expect(JSON.stringify(arbol)).not.toContain('m-casos');
  });

  it('el arbol reconstruido resuelve el mismo ambito que el dominio espera', () => {
    const arbol = buildNavTree(dataRows, scale);
    const equipo = toTeam(
      { id: 't1', name: 'Equipo', defaultScopeId: 'sc-materia', assignedPackageId: null },
      [{ teamId: 't1', nodeId: 'regional' }],
      [{ teamId: 't1', userId: 'u1', role: 'colaborador' }],
      [],
      scale,
    );

    const r = resolveEffectiveScope({
      user: { userId: 'u1' },
      activeTeam: equipo,
      moduleId: 'casos',
      generalTree: arbol,
    });

    const dimension = Object.fromEntries(
      r.scope.restrictions.map((x) => [dimensionKey(x.dimension), x.allowedValues]),
    );
    // Regional permite Norte y Este; la carpeta Norte lo restringe a Norte.
    expect(dimension['DimTribunal.Distrito']).toEqual(['Distrito Norte']);
    expect(dimension['DimTribunal.Materia']).toEqual(['Penal']);
  });
});

describe('toAccessScope', () => {
  it('una excepcion de ampliacion vigente se refleja en el ambito', () => {
    const expansion: ScopeExpansionRow = {
      id: 'ex-1',
      justification: 'Auditoria nacional aprobada',
      authorizedBy: 'admin-1',
      authorizedAt: new Date('2026-01-15T10:00:00.000Z'),
      revokedAt: null,
    };
    const lookup = buildScopeLookup(
      [{ id: 'sc', expansionId: 'ex-1' }],
      [{ scopeId: 'sc', dimTable: 'DimTribunal', dimField: 'Distrito', allowedValues: '["Norte"]' }],
      [expansion],
    );
    expect(lookup.get('sc')?.authorizedExpansion?.justification).toBe('Auditoria nacional aprobada');
  });

  it('una excepcion REVOCADA deja de ampliar y vuelve a restringir', () => {
    const expansion: ScopeExpansionRow = {
      id: 'ex-1',
      justification: 'Ya no aplica',
      authorizedBy: 'admin-1',
      authorizedAt: new Date('2026-01-15T10:00:00.000Z'),
      revokedAt: new Date('2026-03-01T10:00:00.000Z'),
    };
    const lookup = buildScopeLookup(
      [{ id: 'sc', expansionId: 'ex-1' }],
      [{ scopeId: 'sc', dimTable: 'DimTribunal', dimField: 'Distrito', allowedValues: '["Norte"]' }],
      [expansion],
    );
    expect(lookup.get('sc')?.authorizedExpansion).toBeUndefined();
  });

  it('una fila corrupta se trata como restriccion vacia, no como ausencia de restriccion', () => {
    // Degradar a "sin restriccion" ampliaria el acceso en silencio.
    expect(parseAllowedValues('{no es json')).toEqual([]);
    expect(parseAllowedValues('')).toEqual([]);
  });

  it('serializa y deserializa sin perdida', () => {
    const valores = ['Distrito Norte', 'Distrito Este'];
    expect(parseAllowedValues(serializeAllowedValues(valores))).toEqual(valores);
  });
});

describe('toAppRole', () => {
  it('mapea los tres roles fijos', () => {
    expect(toAppRole('administrador')).toBe('administrador');
    expect(toAppRole('colaborador')).toBe('colaborador');
    expect(toAppRole('visor')).toBe('visor');
  });

  it('un rol desconocido cae al minimo privilegio, no al intermedio', () => {
    expect(toAppRole('superadmin')).toBe('visor');
    expect(toAppRole('')).toBe('visor');
  });
});

describe('toGovernedUser', () => {
  it('separa el ambito personal general de los overrides por modulo', () => {
    const user = toGovernedUser(
      { id: 'u1', combineTeamsByUnion: false },
      [
        { userId: 'u1', moduleId: '', scopeId: 'sc-materia' },
        { userId: 'u1', moduleId: 'casos', scopeId: 'sc-norte' },
      ],
      scale,
    );
    expect(user.personalScope?.restrictions[0]?.dimension.field).toBe('Materia');
    expect(user.personalModuleScopeOverrides?.['casos']?.restrictions[0]?.allowedValues).toEqual([
      'Distrito Norte',
    ]);
  });

  it('la combinacion por union solo aparece si esta explicitamente activada', () => {
    expect(toGovernedUser({ id: 'u1', combineTeamsByUnion: false }, [], scale).combineTeamsByUnion)
      .toBeUndefined();
    expect(toGovernedUser({ id: 'u1', combineTeamsByUnion: true }, [], scale).combineTeamsByUnion)
      .toBe(true);
  });
});

describe('buildPackageTree', () => {
  it('reconstruye el arbol de presentacion sin ambito alguno', () => {
    const pkg = buildPackageTree(
      { id: 'p1', name: 'Vista operativa' },
      [
        { id: 'v1', packageId: 'p1', type: 'folder', name: 'Dia a dia', icon: null, parentId: null, orderIndex: 0, moduleId: null },
        { id: 'v2', packageId: 'p1', type: 'module', name: 'Casos', icon: null, parentId: 'v1', orderIndex: 0, moduleId: 'casos' },
      ],
    );
    // Un paquete es estrictamente presentacional: si mapeara ambitos podria influir en el acceso.
    expect(JSON.stringify(pkg)).not.toContain('scope');
    expect(pkg.visualTree[0]?.type).toBe('folder');
  });

  it('ignora los nodos de otros paquetes', () => {
    const pkg = buildPackageTree(
      { id: 'p1', name: 'P1' },
      [
        { id: 'a', packageId: 'p1', type: 'module', name: 'A', icon: null, parentId: null, orderIndex: 0, moduleId: 'a' },
        { id: 'b', packageId: 'p2', type: 'module', name: 'B', icon: null, parentId: null, orderIndex: 0, moduleId: 'b' },
      ],
    );
    expect(pkg.visualTree).toHaveLength(1);
  });
});

describe('coherencia entre schema.prisma y las formas de fila', () => {
  const schema = readFileSync(
    new URL('../prisma/schema.prisma', import.meta.url),
    'utf8',
  );

  it('todo modelo del esquema que los mapeadores consumen tiene su forma de fila declarada', () => {
    // Los tipos de fila se escriben a mano (ver rows.ts): esta prueba es la red que detecta
    // que el esquema cambio y las formas no se actualizaron.
    const modelosEsperados = [
      'User', 'LocalCredential', 'AppSession', 'NavNode', 'AccessScope', 'ScopeRestriction',
      'ScopeExpansionException', 'Team', 'TeamGrantedNode', 'TeamMembership', 'TeamModuleScope',
      'UserScope', 'ModulePackage', 'PackageNode', 'LoginAuditEvent', 'ConfigAuditEvent',
    ];
    for (const modelo of modelosEsperados) {
      expect(schema).toContain(`model ${modelo} {`);
    }
  });

  it('los campos de NavNodeRow existen en el modelo NavNode', () => {
    const block = schema.split('model NavNode {')[1]?.split('}')[0] ?? '';
    for (const fieldName of ['type', 'name', 'icon', 'parentId', 'orderIndex', 'moduleId', 'slug', 'deletedAt', 'scopeId']) {
      expect(block).toContain(fieldName);
    }
  });

  it('el almacen de identidad no referencia el Data Warehouse', () => {
    // 4.7.2: base dedicada y de alcance minimo, nunca mezclada con las tablas del DW.
    expect(schema).not.toMatch(/model\s+(Fact|Dim)\w+/);
  });
});
