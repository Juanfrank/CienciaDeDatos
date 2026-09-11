import { beforeEach, describe, expect, it } from 'vitest';
import { gobiernoFixtures, dimensionKey, resolveEffectiveScope } from '@app/access-control';
import {
  AdminError,
  ExpansionSinJustificarError,
  assertAdmin,
  cambiarMembresia,
  dimensionesAmpliadas,
  ejecutarOperacionDeArbol,
  esAdministrador,
  guardarAmbito,
  guardarEquipo,
  previsualizarMovimiento,
  quienVeQue,
  rolMasAltoDe,
} from './admin';
import { contarAmpliaciones, limpiarAuditoria, listarAuditoria } from './auditoria';
import { gobierno } from './gobierno';

const { DIM_DISTRITO, DIM_MATERIA, scope } = gobiernoFixtures;

const admin = { userId: 'u-admin', role: 'administrador' as const };
const visor = { userId: 'u-beto', role: 'visor' as const };
const colaborador = { userId: 'u-ana', role: 'colaborador' as const };

const sesion = (userId: string) => ({ sessionId: 's', userId, activeTeamId: 'equipo-norte' });

/** Equipo del almacen, o fallo explicito. Evita aserciones non-null en cada prueba. */
const equipoDe = (id: string) => {
  const equipo = gobierno.getTeam(id);
  if (!equipo) throw new Error(`fixture inesperado: falta el equipo ${id}`);
  return equipo;
};

beforeEach(() => {
  gobierno.reset();
  limpiarAuditoria();
});

describe('almacen de gobierno', () => {
  it('siembra desde seedData', () => {
    expect(gobierno.listTeams().map((t) => t.id).sort()).toEqual(['equipo-este', 'equipo-norte']);
    expect(gobierno.getTree().nodes.length).toBeGreaterThan(0);
  });

  it('las escrituras se reflejan en lecturas posteriores', () => {
    const equipo = gobierno.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    gobierno.upsertTeam({ ...equipo, name: 'Renombrado' });
    expect(gobierno.getTeam('equipo-norte')?.name).toBe('Renombrado');
  });

  it('devuelve copias: quien lee no puede mutar el almacen por accidente', () => {
    const equipo = gobierno.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    equipo.name = 'Mutado por fuera';
    expect(gobierno.getTeam('equipo-norte')?.name).not.toBe('Mutado por fuera');
  });
});

describe('assertAdmin: la comprobacion vive en el backend (criterio de la seccion 9)', () => {
  it('un Visor recibe 403, no un boton oculto', () => {
    expect(() => assertAdmin(sesion('u-beto'))).toThrow(AdminError);
    try {
      assertAdmin(sesion('u-beto'));
    } catch (error) {
      expect((error as AdminError).status).toBe(403);
    }
  });

  it('un Colaborador tampoco entra: crear borradores no es administrar', () => {
    expect(() => assertAdmin(sesion('u-ana'))).toThrow(AdminError);
  });

  it('un Administrador entra', () => {
    expect(assertAdmin(sesion('u-admin'))).toEqual({ userId: 'u-admin', role: 'administrador' });
  });

  it('el rol se toma del mas alto entre sus equipos: administrar no es por equipo', () => {
    expect(rolMasAltoDe('u-admin')).toBe('administrador');
    expect(rolMasAltoDe('u-ana')).toBe('colaborador');
    expect(rolMasAltoDe('u-beto')).toBe('visor');
    expect(esAdministrador('u-beto')).toBe(false);
  });
});

describe('la puerta de ampliacion de ambito (4.10.4)', () => {
  const ambitoDelEquipo = () => gobierno.getTeam('equipo-norte')?.defaultScope;

  it('restringir mas no exige justificacion', () => {
    const guardado = guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    expect(guardado.authorizedExpansion).toBeUndefined();
    expect(ambitoDelEquipo()?.restrictions[0]?.allowedValues).toEqual(['Penal']);
  });

  it('AMPLIAR sin justificacion se RECHAZA, y dice que dimension se amplia', () => {
    // El equipo Norte esta restringido a Penal y Civil. Anadir Laboral amplia.
    try {
      guardarAmbito({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      });
      expect.unreachable('se esperaba ExpansionSinJustificarError');
    } catch (error) {
      expect(error).toBeInstanceOf(ExpansionSinJustificarError);
      expect((error as AdminError).status).toBe(422);
      expect((error as ExpansionSinJustificarError).dimensiones[0]).toContain('Laboral');
    }
  });

  it('quitar la restriccion de una dimension tambien es ampliar', () => {
    expect(() =>
      guardarAmbito({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: { restrictions: [] },
      }),
    ).toThrow(ExpansionSinJustificarError);
  });

  it('con justificacion se guarda, marcada como excepcion y con su autor', () => {
    const guardado = guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      justificacion: 'Auditoria laboral trimestral aprobada por el Consejo',
    });
    expect(guardado.authorizedExpansion?.justification).toMatch(/Auditoria laboral/);
    expect(guardado.authorizedExpansion?.authorizedBy).toBe('u-admin');
  });

  it('un rechazo NO deja rastro en el almacen ni en la auditoria', () => {
    const antes = JSON.stringify(ambitoDelEquipo());
    expect(() =>
      guardarAmbito({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      }),
    ).toThrow();
    expect(JSON.stringify(ambitoDelEquipo())).toBe(antes);
    expect(listarAuditoria()).toHaveLength(0);
  });

  it('un Colaborador no puede configurar ambitos', () => {
    expect(() =>
      guardarAmbito({
        actor: colaborador,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal'),
      }),
    ).toThrow(/no puede 'configurar-ambitos'/);
  });

  it('dimensionesAmpliadas nombra exactamente que se amplia', () => {
    expect(
      dimensionesAmpliadas(scope(DIM_DISTRITO, 'Norte'), scope(DIM_DISTRITO, 'Norte', 'Este')),
    ).toEqual(['DimTribunal.Distrito (+Este)']);
    expect(dimensionesAmpliadas(scope(DIM_DISTRITO, 'Norte'), { restrictions: [] })).toEqual([
      'DimTribunal.Distrito (deja de estar restringida)',
    ]);
  });
});

describe('la puerta de auditoria (seccion 7)', () => {
  it('una ampliacion queda DESTACADA, separada del resto de cambios', () => {
    guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal', 'Civil'),
      justificacion: 'Se reincorpora materia civil por resolucion',
    });

    expect(listarAuditoria()).toHaveLength(2);
    const ampliaciones = listarAuditoria({ soloAmpliaciones: true });
    expect(ampliaciones).toHaveLength(1);
    expect(ampliaciones[0]?.justification).toMatch(/resolucion/);
    expect(contarAmpliaciones()).toBe(1);
  });

  it('guarda el estado anterior y el nuevo: no es sobrescritura silenciosa (4.10.7)', () => {
    guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    const evento = listarAuditoria()[0];
    expect(evento?.before).toBeDefined();
    expect(evento?.after).toBeDefined();
  });

  it('el registro se puede filtrar por tipo de entidad y por autor', () => {
    const equipo = gobierno.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    guardarEquipo(admin, { ...equipo, name: 'Norte renombrado' });
    guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });

    expect(listarAuditoria({ entityType: 'team' })).toHaveLength(1);
    expect(listarAuditoria({ entityType: 'scope' })).toHaveLength(1);
    expect(listarAuditoria({ actorId: 'otro' })).toHaveLength(0);
  });
});

describe('editar el ambito de una carpeta cambia lo que contiene', () => {
  it('el ambito efectivo de un modulo cambia de inmediato', () => {
    const antes = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: equipoDe('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: gobierno.getTree().nodes,
    });
    const distritoAntes = antes.scope.restrictions.find(
      (r) => dimensionKey(r.dimension) === dimensionKey(DIM_DISTRITO),
    );
    expect(distritoAntes?.allowedValues).toEqual(['Distrito Norte']);

    // Se restringe aun mas la carpeta que lo contiene: de Norte a nada.
    guardarAmbito({
      actor: admin,
      destino: { tipo: 'carpeta', nodeId: 'nodo-norte' },
      scope: scope(DIM_DISTRITO),
    });

    const despues = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: equipoDe('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: gobierno.getTree().nodes,
    });
    expect(despues.deniesEverything).toBe(true);
  });
});

describe('previsualizar un movimiento antes de confirmarlo (4.1.2)', () => {
  it('avisa de que el ambito cambia y de que modulos arrastra', () => {
    const previo = previsualizarMovimiento('nodo-m-audiencias', 'nodo-este');
    expect(previo.moduleIds).toEqual(['audiencias']);
    expect(previo.cambiaElAmbito).toBe(true);
    expect(previo.scopeAntes?.restrictions[0]?.allowedValues).toEqual(['Distrito Norte']);
    expect(previo.scopeDespues?.restrictions[0]?.allowedValues).toEqual(['Distrito Este']);
  });

  it('mover dentro de la misma carpeta no cambia el ambito', () => {
    expect(previsualizarMovimiento('nodo-m-audiencias', 'nodo-norte').cambiaElAmbito).toBe(false);
  });
});

describe('operaciones de arbol desde el panel', () => {
  it('un movimiento se persiste y queda auditado como tal', () => {
    ejecutarOperacionDeArbol(admin, {
      type: 'mover',
      nodeId: 'nodo-m-audiencias',
      newParentId: 'nodo-este',
    });

    const movimientos = listarAuditoria({ soloMovimientos: true });
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]?.entityId).toBe('nodo-m-audiencias');

    // Y el arbol persistido refleja el cambio.
    const resuelto = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: equipoDe('equipo-norte'),
      moduleId: 'audiencias',
      generalTree: gobierno.getTree().nodes,
    });
    const distrito = resuelto.scope.restrictions.find(
      (r) => dimensionKey(r.dimension) === dimensionKey(DIM_DISTRITO),
    );
    expect(distrito?.allowedValues).toEqual(['Distrito Este']);
  });

  it('un Visor no puede operar sobre el arbol', () => {
    expect(() =>
      ejecutarOperacionDeArbol(visor, { type: 'renombrar', nodeId: 'nodo-norte', name: 'X' }),
    ).toThrow(AdminError);
  });
});

describe('membresia (4.10.2)', () => {
  it('anade y quita personas de un equipo, con auditoria', () => {
    const conBeto = cambiarMembresia(admin, 'equipo-norte', 'u-beto', 'visor');
    expect(conBeto.members.some((m) => m.userId === 'u-beto')).toBe(true);

    const sinBeto = cambiarMembresia(admin, 'equipo-norte', 'u-beto', null);
    expect(sinBeto.members.some((m) => m.userId === 'u-beto')).toBe(false);
    expect(listarAuditoria({ entityType: 'membership' })).toHaveLength(2);
  });

  it('un Colaborador no puede gestionar roles', () => {
    expect(() => cambiarMembresia(colaborador, 'equipo-norte', 'u-beto', 'visor')).toThrow(
      /no puede 'gestionar-usuarios-y-roles'/,
    );
  });
});

describe('quien ve que (4.10.8)', () => {
  it('muestra el ambito resuelto y NOMBRA la carpeta que lo origino', () => {
    const r = quienVeQue('u-ana', 'equipo-norte', 'casos-pendientes');
    expect(r.tieneAcceso).toBe(true);
    expect(r.pasos.map((p) => p.origen)).toEqual([
      'Equipo Distrito Norte',
      'Regional',
      'Distrito Norte',
    ]);
    expect(r.pasos.map((p) => p.capa)).toEqual([
      'ambito-general-del-equipo',
      'carpeta',
      'carpeta',
    ]);
  });

  it('distingue "no tiene acceso" de "tiene acceso pero no ve filas"', () => {
    const sinConceder = quienVeQue('u-ana', 'equipo-norte', 'estadisticas');
    expect(sinConceder.existeEnElArbol).toBe(true);
    expect(sinConceder.tieneAcceso).toBe(false);
  });

  it('señala cuando el ambito resuelto proviene de una ampliacion', () => {
    guardarAmbito({
      actor: admin,
      destino: { tipo: 'carpeta', nodeId: 'nodo-norte' },
      scope: scope(DIM_DISTRITO, 'Distrito Norte', 'Distrito Este'),
      justificacion: 'Supervision conjunta Norte-Este durante el trimestre',
    });
    expect(quienVeQue('u-ana', 'equipo-norte', 'casos-pendientes').usoAmpliacion).toBe(true);
  });
});
