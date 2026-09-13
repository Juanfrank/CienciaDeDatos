import { describe, expect, it } from 'vitest';
import {
  DIM_DISTRITO,
  DIM_MATERIA,
  generalTree,
  equipoEste,
  equipoNorte,
  expandingScope,
  scope,
  usuarioAna,
  usuarioBeto,
} from './__fixtures__/gobierno';
import { dimensionKey, scopeToFilters } from './AccessScope';
import type { NavNode } from './NavigationTree';
import { resolveEffectiveScope } from './resolveEffectiveScope';
import type { Team } from './Team';

const valoresDe = (resultado: { scope: { restrictions: { dimension: { table: string; field: string }; allowedValues: string[] }[] } }, dim: { table: string; field: string }) =>
  resultado.scope.restrictions.find((r) => dimensionKey(r.dimension) === dimensionKey(dim))?.allowedValues;

describe('resolveEffectiveScope (4.10.4)', () => {
  describe('herencia por carpetas anidadas', () => {
    it('hereda el ambito a traves de tres niveles de carpetas', () => {
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });

      // Regional permite Norte/Este/Sur; Distrito Norte lo restringe a Norte.
      // La interseccion de ambas capas deja solo Norte.
      expect(valoresDe(r, DIM_DISTRITO)).toEqual(['Distrito Norte']);
      // Y el ambito general del equipo sigue vigente sobre la otra dimension.
      expect(valoresDe(r, DIM_MATERIA)).toEqual(['Penal', 'Civil']);
    });

    it('la capa mas profunda solo puede restringir, nunca ampliar', () => {
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'casos-pendientes-este',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_DISTRITO)).toEqual(['Distrito Este']);
      expect(r.usedAuthorizedExpansion).toBe(false);
    });

    it('un modulo sin carpeta restrictiva solo hereda el ambito del equipo', () => {
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'estadisticas-nacionales',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_DISTRITO)).toBeUndefined();
      expect(valoresDe(r, DIM_MATERIA)).toEqual(['Penal', 'Civil']);
    });

    it('expone la traza de como se resolvio, con la carpeta que origino cada capa (4.10.8)', () => {
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      expect(r.steps.map((s) => [s.layer, s.source])).toEqual([
        ['ambito-general-del-equipo', 'Equipo Distrito Norte'],
        ['carpeta', 'Regional'],
        ['carpeta', 'Distrito Norte'],
      ]);
    });
  });

  describe('overrides por modulo y ambito personal', () => {
    it('un override por modulo del equipo restringe sobre lo heredado', () => {
      const equipo: Team = {
        ...equipoNorte,
        moduleScopeOverrides: { 'casos-pendientes-norte': scope(DIM_MATERIA, 'Penal') },
      };
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipo,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_MATERIA)).toEqual(['Penal']);
    });

    it('un override por modulo NO amplia lo que la carpeta restringio', () => {
      const equipo: Team = {
        ...equipoNorte,
        // Pide Norte y Este, pero la carpeta ya habia restringido a Norte.
        moduleScopeOverrides: {
          'casos-pendientes-norte': scope(DIM_DISTRITO, 'Distrito Norte', 'Distrito Este'),
        },
      };
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipo,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_DISTRITO)).toEqual(['Distrito Norte']);
    });

    it('el ambito personal restringe aun mas, que es su caso de uso tipico', () => {
      const r = resolveEffectiveScope({
        user: { userId: 'ana', personalScope: scope(DIM_MATERIA, 'Civil') },
        activeTeam: equipoNorte,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_MATERIA)).toEqual(['Civil']);
    });

    it('el ambito personal por modulo se aplica despues del personal general', () => {
      const r = resolveEffectiveScope({
        user: {
          userId: 'ana',
          personalScope: scope(DIM_MATERIA, 'Penal', 'Civil'),
          personalModuleScopeOverrides: { 'casos-pendientes-norte': scope(DIM_MATERIA, 'Penal') },
        },
        activeTeam: equipoNorte,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_MATERIA)).toEqual(['Penal']);
      expect(r.steps.at(-1)?.layer).toBe('ambito-personal-por-modulo');
    });
  });

  describe('ninguna combinacion amplia sin excepcion marcada', () => {
    it('ninguna capa amplia el acceso respecto del ambito mas general', () => {
      const equipo: Team = {
        ...equipoNorte,
        moduleScopeOverrides: {
          'casos-pendientes-norte': scope(DIM_DISTRITO, 'Distrito Sur', 'Distrito Nacional'),
        },
      };
      const r = resolveEffectiveScope({
        user: { userId: 'ana', personalScope: scope(DIM_DISTRITO, 'Distrito Nacional') },
        activeTeam: equipo,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      // Todas piden distritos que la carpeta no permite: el resultado es acceso a nada,
      // no a lo que cada capa pedia por su cuenta.
      expect(valoresDe(r, DIM_DISTRITO)).toEqual([]);
      expect(r.deniesEverything).toBe(true);
      expect(r.usedAuthorizedExpansion).toBe(false);
    });

    it('una excepcion marcada explicitamente si sustituye, y queda señalada', () => {
      const equipo: Team = {
        ...equipoNorte,
        moduleScopeOverrides: {
          'casos-pendientes-norte': expandingScope(
            'Auditoria nacional trimestral aprobada por el Consejo',
            DIM_DISTRITO,
            'Distrito Norte',
            'Distrito Este',
          ),
        },
      };
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipo,
        moduleId: 'casos-pendientes-norte',
        generalTree: generalTree,
      });
      expect(valoresDe(r, DIM_DISTRITO)).toEqual(['Distrito Norte', 'Distrito Este']);
      expect(r.usedAuthorizedExpansion).toBe(true);
      expect(r.steps.find((s) => s.expanded)).toBeDefined();
    });
  });

  describe('equipos distintos, datos distintos', () => {
    it('dos equipos con ambitos distintos resuelven ambitos distintos para el mismo modulo', () => {
      const norte = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'casos-pendientes-este',
        generalTree: generalTree,
      });
      const este = resolveEffectiveScope({
        user: usuarioBeto,
        activeTeam: equipoEste,
        moduleId: 'casos-pendientes-este',
        generalTree: generalTree,
      });

      // Ambos ven el Distrito Este por la carpeta, pero solo el equipo Norte arrastra
      // ademas la restriccion de materia de su ambito general.
      expect(scopeToFilters(norte.scope)).toEqual({
        'DimTribunal.Materia': ['Penal', 'Civil'],
        'DimTribunal.Distrito': ['Distrito Este'],
      });
      expect(scopeToFilters(este.scope)).toEqual({ 'DimTribunal.Distrito': ['Distrito Este'] });
    });
  });

  describe('mover un modulo cambia su ambito de inmediato (4.1.2)', () => {
    it('el mismo modulo en otra carpeta resuelve otro ambito', () => {
      const before = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'audiencias-norte',
        generalTree: generalTree,
      });
      expect(valoresDe(before, DIM_DISTRITO)).toEqual(['Distrito Norte']);

      // Se mueve 'audiencias-norte' de la carpeta Norte a la carpeta Este.
      const movido: NavNode[] = JSON.parse(JSON.stringify(generalTree));
      const institucional = movido[0];
      if (institucional?.type !== 'folder') throw new Error('fixture inesperado');
      const regional = institucional.children[0];
      if (regional?.type !== 'folder') throw new Error('fixture inesperado');
      const [norte, este] = regional.children;
      if (norte?.type !== 'folder' || este?.type !== 'folder') throw new Error('fixture inesperado');
      const audiencias = norte.children.find(
        (n) => n.type === 'module' && n.moduleRef.moduleId === 'audiencias-norte',
      );
      if (!audiencias) throw new Error('fixture inesperado');
      norte.children = norte.children.filter((n) => n !== audiencias);
      este.children = [...este.children, audiencias];

      const after = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'audiencias-norte',
        generalTree: movido,
      });
      expect(valoresDe(after, DIM_DISTRITO)).toEqual(['Distrito Este']);
    });
  });

  describe('modulo ausente del arbol general', () => {
    it('no revela nada y no permite ver nada', () => {
      const r = resolveEffectiveScope({
        user: usuarioAna,
        activeTeam: equipoNorte,
        moduleId: 'modulo-que-no-existe',
        generalTree: generalTree,
      });
      expect(r.moduleExistsInGeneralTree).toBe(false);
      expect(r.deniesEverything).toBe(true);
    });
  });

  it('es una funcion pura: no muta el arbol, el equipo ni el usuario', () => {
    const arbolAntes = JSON.stringify(generalTree);
    const equipoAntes = JSON.stringify(equipoNorte);
    resolveEffectiveScope({
      user: usuarioAna,
      activeTeam: equipoNorte,
      moduleId: 'casos-pendientes-norte',
      generalTree: generalTree,
    });
    expect(JSON.stringify(generalTree)).toBe(arbolAntes);
    expect(JSON.stringify(equipoNorte)).toBe(equipoAntes);
  });
});
