import { describe, expect, it } from 'vitest';
import { buildNavigationView, dimensionKey, resolveEffectiveScope } from '@app/access-control';
import { buildNavTree, buildScopeLookup, toGovernedUser, toTeam } from './mappers';
import {
  seedGrantedNodes,
  seedMemberships,
  seedModuleScopes,
  seedNavNodes,
  seedRestrictions,
  seedScopes,
  seedTeams,
  seedUserScopes,
  seedUsers,
} from './seedData';

/**
 * Verifica el entregable de la seccion 8.1 pasando los datos de arranque por los mapeadores
 * reales: lo que se prueba es la cadena completa fila -> dominio -> ambito efectivo.
 */
const lookup = buildScopeLookup(seedScopes, seedRestrictions, []);
const arbol = buildNavTree(seedNavNodes, lookup);

const equipo = (id: string) => {
  const row = seedTeams.find((t) => t.id === id);
  if (!row) throw new Error(`equipo ${id} ausente del seed`);
  return toTeam(row, seedGrantedNodes, seedMemberships, seedModuleScopes, lookup);
};

const user = (id: string) => {
  const row = seedUsers.find((u) => u.id === id);
  if (!row) throw new Error(`usuario ${id} ausente del seed`);
  return toGovernedUser(row, seedUserScopes, lookup);
};

const filtros = (scope: { restrictions: { dimension: { table: string; field: string }; allowedValues: string[] }[] }) =>
  Object.fromEntries(scope.restrictions.map((r) => [dimensionKey(r.dimension), r.allowedValues]));

describe('datos de arranque: dos equipos con ambitos distintos (8.1)', () => {
  it('el seed define al menos dos equipos', () => {
    expect(seedTeams.length).toBeGreaterThanOrEqual(2);
  });

  it('el arbol de arranque tiene al menos tres niveles de carpetas anidadas', () => {
    const raiz = arbol[0];
    if (raiz?.type !== 'folder') throw new Error('se esperaba carpeta');
    const regional = raiz.children.find((n) => n.type === 'folder');
    if (regional?.type !== 'folder') throw new Error('se esperaba carpeta');
    const norte = regional.children.find((n) => n.type === 'folder');
    expect(norte?.type).toBe('folder');
  });

  it('los dos equipos resuelven ambitos DISTINTOS para el mismo modulo', () => {
    const norte = resolveEffectiveScope({
      user: user('u-ana'),
      activeTeam: equipo('equipo-norte'),
      moduleId: 'casos-este',
      generalTree: arbol,
    });
    const este = resolveEffectiveScope({
      user: user('u-beto'),
      activeTeam: equipo('equipo-este'),
      moduleId: 'casos-este',
      generalTree: arbol,
    });

    expect(filtros(norte.scope)).toEqual({
      'DimTribunal.Materia': ['Penal', 'Civil'],
      'DimTribunal.Distrito': ['Distrito Este'],
    });
    expect(filtros(este.scope)).toEqual({ 'DimTribunal.Distrito': ['Distrito Este'] });
  });

  it('la herencia atraviesa los tres niveles: Regional restringe y Norte restringe mas', () => {
    const r = resolveEffectiveScope({
      user: user('u-ana'),
      activeTeam: equipo('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: arbol,
    });
    expect(filtros(r.scope)['DimTribunal.Distrito']).toEqual(['Distrito Norte']);
  });

  it('los equipos ven conjuntos de modulos distintos', () => {
    const vistaNorte = buildNavigationView({ generalTree: arbol, team: equipo('equipo-norte') });
    const vistaEste = buildNavigationView({ generalTree: arbol, team: equipo('equipo-este') });
    expect(JSON.stringify(vistaNorte.tree)).toContain('audiencias');
    expect(JSON.stringify(vistaEste.tree)).not.toContain('audiencias');
    // 'estadisticas' vive fuera de lo concedido a ambos.
    expect(JSON.stringify(vistaNorte.tree)).not.toContain('estadisticas');
  });

  it('un usuario en dos equipos ve segun el equipo ACTIVO, no la union de ambos (4.10.2)', () => {
    // Ana pertenece a los dos equipos. Con el equipo Este activo pierde el acceso a los
    // modulos del Norte, en vez de acumularlos.
    const comoNorte = buildNavigationView({ generalTree: arbol, team: equipo('equipo-norte') });
    const comoEste = buildNavigationView({ generalTree: arbol, team: equipo('equipo-este') });
    expect(JSON.stringify(comoNorte.tree)).toContain('casos-pendientes');
    expect(JSON.stringify(comoEste.tree)).not.toContain('casos-pendientes');
  });

  it('el seed no contiene ninguna excepcion de ampliacion: el arranque es el caso limpio', () => {
    expect(seedScopes.every((s) => s.expansionId === null)).toBe(true);
  });

  it('los roles del seed son los tres fijos de 4.10.1', () => {
    for (const m of seedMemberships) {
      expect(['administrador', 'colaborador', 'visor']).toContain(m.role);
    }
  });
});
