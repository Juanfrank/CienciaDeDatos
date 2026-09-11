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
const equipoDe = async (id: string) => {
  const equipo = await gobierno.getTeam(id);
  if (!equipo) throw new Error(`fixture inesperado: falta el equipo ${id}`);
  return equipo;
};

beforeEach(async () => {
  await gobierno.reset();
  await limpiarAuditoria();
});

describe('almacen de gobierno', () => {
  it('siembra desde seedData', async () => {
    expect((await gobierno.listTeams()).map((t) => t.id).sort()).toEqual(['equipo-este', 'equipo-norte']);
    expect((await gobierno.getTree()).nodes.length).toBeGreaterThan(0);
  });

  it('las escrituras se reflejan en lecturas posteriores', async () => {
    const equipo = await gobierno.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    await gobierno.upsertTeam({ ...equipo, name: 'Renombrado' });
    expect((await gobierno.getTeam('equipo-norte'))?.name).toBe('Renombrado');
  });

  it('devuelve copias: quien lee no puede mutar el almacen por accidente', async () => {
    const equipo = await gobierno.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    equipo.name = 'Mutado por fuera';
    expect((await gobierno.getTeam('equipo-norte'))?.name).not.toBe('Mutado por fuera');
  });
});

describe('assertAdmin: la comprobacion vive en el backend (criterio de la seccion 9)', () => {
  it('un Visor recibe 403, no un boton oculto', async () => {
    await expect(assertAdmin(sesion('u-beto'))).rejects.toThrow(AdminError);
    try {
      await assertAdmin(sesion('u-beto'));
    } catch (error) {
      expect((error as AdminError).status).toBe(403);
    }
  });

  it('un Colaborador tampoco entra: crear borradores no es administrar', async () => {
    await expect(assertAdmin(sesion('u-ana'))).rejects.toThrow(AdminError);
  });

  it('un Administrador entra', async () => {
    expect(await assertAdmin(sesion('u-admin'))).toEqual({ userId: 'u-admin', role: 'administrador' });
  });

  it('el rol se toma del mas alto entre sus equipos: administrar no es por equipo', async () => {
    expect(await rolMasAltoDe('u-admin')).toBe('administrador');
    expect(await rolMasAltoDe('u-ana')).toBe('colaborador');
    expect(await rolMasAltoDe('u-beto')).toBe('visor');
    expect(await esAdministrador('u-beto')).toBe(false);
  });
});

describe('la puerta de ampliacion de ambito (4.10.4)', () => {
  const ambitoDelEquipo = async () => (await gobierno.getTeam('equipo-norte'))?.defaultScope;

  it('restringir mas no exige justificacion', async () => {
    const guardado = await guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    expect(guardado.authorizedExpansion).toBeUndefined();
    expect((await ambitoDelEquipo())?.restrictions[0]?.allowedValues).toEqual(['Penal']);
  });

  it('AMPLIAR sin justificacion se RECHAZA, y dice que dimension se amplia', async () => {
    // El equipo Norte esta restringido a Penal y Civil. Anadir Laboral amplia.
    try {
      await guardarAmbito({
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

  it('quitar la restriccion de una dimension tambien es ampliar', async () => {
    await expect(
      guardarAmbito({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: { restrictions: [] },
      }),
    ).rejects.toThrow(ExpansionSinJustificarError);
  });

  it('con justificacion se guarda, marcada como excepcion y con su autor', async () => {
    const guardado = await guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      justificacion: 'Auditoria laboral trimestral aprobada por el Consejo',
    });
    expect(guardado.authorizedExpansion?.justification).toMatch(/Auditoria laboral/);
    expect(guardado.authorizedExpansion?.authorizedBy).toBe('u-admin');
  });

  it('un rechazo NO deja rastro en el almacen ni en la auditoria', async () => {
    const antes = JSON.stringify(ambitoDelEquipo());
    await expect(
      guardarAmbito({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      }),
    ).rejects.toThrow();
    expect(JSON.stringify(ambitoDelEquipo())).toBe(antes);
    expect(await listarAuditoria()).toHaveLength(0);
  });

  it('un Colaborador no puede configurar ambitos', async () => {
    await expect(
      guardarAmbito({
        actor: colaborador,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal'),
      }),
    ).rejects.toThrow(/no puede 'configurar-ambitos'/);
  });

  it('dimensionesAmpliadas nombra exactamente que se amplia', async () => {
    expect(
      dimensionesAmpliadas(scope(DIM_DISTRITO, 'Norte'), scope(DIM_DISTRITO, 'Norte', 'Este')),
    ).toEqual(['DimTribunal.Distrito (+Este)']);
    expect(dimensionesAmpliadas(scope(DIM_DISTRITO, 'Norte'), { restrictions: [] })).toEqual([
      'DimTribunal.Distrito (deja de estar restringida)',
    ]);
  });
});

describe('la puerta de auditoria (seccion 7)', () => {
  it('una ampliacion queda DESTACADA, separada del resto de cambios', async () => {
    await guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    await guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal', 'Civil'),
      justificacion: 'Se reincorpora materia civil por resolucion',
    });

    expect(await listarAuditoria()).toHaveLength(2);
    const ampliaciones = await listarAuditoria({ soloAmpliaciones: true });
    expect(ampliaciones).toHaveLength(1);
    expect(ampliaciones[0]?.justification).toMatch(/resolucion/);
    expect(await contarAmpliaciones()).toBe(1);
  });

  it('guarda el estado anterior y el nuevo: no es sobrescritura silenciosa (4.10.7)', async () => {
    await guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    const evento = (await listarAuditoria())[0];
    expect(evento?.before).toBeDefined();
    expect(evento?.after).toBeDefined();
  });

  it('el registro se puede filtrar por tipo de entidad y por autor', async () => {
    const equipo = await gobierno.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    await guardarEquipo(admin, { ...equipo, name: 'Norte renombrado' });
    await guardarAmbito({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });

    expect(await listarAuditoria({ entityType: 'team' })).toHaveLength(1);
    expect(await listarAuditoria({ entityType: 'scope' })).toHaveLength(1);
    expect(await listarAuditoria({ actorId: 'otro' })).toHaveLength(0);
  });
});

describe('editar el ambito de una carpeta cambia lo que contiene', () => {
  it('el ambito efectivo de un modulo cambia de inmediato', async () => {
    const antes = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: await equipoDe('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: (await gobierno.getTree()).nodes,
    });
    const distritoAntes = antes.scope.restrictions.find(
      (r) => dimensionKey(r.dimension) === dimensionKey(DIM_DISTRITO),
    );
    expect(distritoAntes?.allowedValues).toEqual(['Distrito Norte']);

    // Se restringe aun mas la carpeta que lo contiene: de Norte a nada.
    await guardarAmbito({
      actor: admin,
      destino: { tipo: 'carpeta', nodeId: 'nodo-norte' },
      scope: scope(DIM_DISTRITO),
    });

    const despues = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: await equipoDe('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: (await gobierno.getTree()).nodes,
    });
    expect(despues.deniesEverything).toBe(true);
  });
});

describe('previsualizar un movimiento antes de confirmarlo (4.1.2)', () => {
  it('avisa de que el ambito cambia y de que modulos arrastra', async () => {
    const previo = await previsualizarMovimiento('nodo-m-audiencias', 'nodo-este');
    expect(previo.moduleIds).toEqual(['audiencias']);
    expect(previo.cambiaElAmbito).toBe(true);
    expect(previo.scopeAntes?.restrictions[0]?.allowedValues).toEqual(['Distrito Norte']);
    expect(previo.scopeDespues?.restrictions[0]?.allowedValues).toEqual(['Distrito Este']);
  });

  it('mover dentro de la misma carpeta no cambia el ambito', async () => {
    expect((await previsualizarMovimiento('nodo-m-audiencias', 'nodo-norte')).cambiaElAmbito).toBe(false);
  });
});

describe('operaciones de arbol desde el panel', () => {
  it('un movimiento se persiste y queda auditado como tal', async () => {
    await ejecutarOperacionDeArbol(admin, {
      type: 'mover',
      nodeId: 'nodo-m-audiencias',
      newParentId: 'nodo-este',
    });

    const movimientos = await listarAuditoria({ soloMovimientos: true });
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]?.entityId).toBe('nodo-m-audiencias');

    // Y el arbol persistido refleja el cambio.
    const resuelto = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: await equipoDe('equipo-norte'),
      moduleId: 'audiencias',
      generalTree: (await gobierno.getTree()).nodes,
    });
    const distrito = resuelto.scope.restrictions.find(
      (r) => dimensionKey(r.dimension) === dimensionKey(DIM_DISTRITO),
    );
    expect(distrito?.allowedValues).toEqual(['Distrito Este']);
  });

  it('un Visor no puede operar sobre el arbol', async () => {
    await expect(
      ejecutarOperacionDeArbol(visor, { type: 'renombrar', nodeId: 'nodo-norte', name: 'X' }),
    ).rejects.toThrow(AdminError);
  });
});

describe('membresia (4.10.2)', () => {
  it('anade y quita personas de un equipo, con auditoria', async () => {
    const conBeto = await cambiarMembresia(admin, 'equipo-norte', 'u-beto', 'visor');
    expect(conBeto.members.some((m) => m.userId === 'u-beto')).toBe(true);

    const sinBeto = await cambiarMembresia(admin, 'equipo-norte', 'u-beto', null);
    expect(sinBeto.members.some((m) => m.userId === 'u-beto')).toBe(false);
    expect(await listarAuditoria({ entityType: 'membership' })).toHaveLength(2);
  });

  it('un Colaborador no puede gestionar roles', async () => {
    await expect(cambiarMembresia(colaborador, 'equipo-norte', 'u-beto', 'visor')).rejects.toThrow(
      /no puede 'gestionar-usuarios-y-roles'/,
    );
  });
});

describe('quien ve que (4.10.8)', () => {
  it('muestra el ambito resuelto y NOMBRA la carpeta que lo origino', async () => {
    const r = await quienVeQue('u-ana', 'equipo-norte', 'casos-pendientes');
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

  it('distingue "no tiene acceso" de "tiene acceso pero no ve filas"', async () => {
    const sinConceder = await quienVeQue('u-ana', 'equipo-norte', 'estadisticas');
    expect(sinConceder.existeEnElArbol).toBe(true);
    expect(sinConceder.tieneAcceso).toBe(false);
  });

  it('señala cuando el ambito resuelto proviene de una ampliacion', async () => {
    await guardarAmbito({
      actor: admin,
      destino: { tipo: 'carpeta', nodeId: 'nodo-norte' },
      scope: scope(DIM_DISTRITO, 'Distrito Norte', 'Distrito Este'),
      justificacion: 'Supervision conjunta Norte-Este durante el trimestre',
    });
    expect((await quienVeQue('u-ana', 'equipo-norte', 'casos-pendientes')).usoAmpliacion).toBe(true);
  });
});
