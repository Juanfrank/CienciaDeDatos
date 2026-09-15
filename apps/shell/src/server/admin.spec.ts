import { beforeEach, describe, expect, it } from 'vitest';
import {
  PermissionError,
  dimensionKey,
  gobiernoFixtures,
  resolveEffectiveScope,
} from '@app/access-control';
import {
  AdminError,
  ExpansionWithoutJustifyError,
  assertAdmin,
  membershipChange,
  expandedDimensions,
  treeOperationRun,
  isAdministrator,
  saveScope,
  saveTeam,
  previsualizarMovimiento,
  seesWhoWhere,
  roleMoreHeightOf,
  LastAdministratorError,
  administradores,
  accesoDeQuienesAdministran,
  deleteTeam,
} from './admin';
import { borrar } from './almacenCompartido';
import { credentialsStore, mailUser } from './identity';
import { expansionsCount, clearAudit, auditList } from './audit';
import { governance } from './governance';
import type { ShellSession } from './session';

const { DIM_DISTRITO, DIM_MATERIA, scope } = gobiernoFixtures;

const admin = { userId: 'u-admin', role: 'administrador' as const };
const visor = { userId: 'u-beto', role: 'visor' as const };
const colaborador = { userId: 'u-ana', role: 'colaborador' as const };

const sesion = (userId: string): ShellSession => ({
  sessionId: 's',
  userId,
  activeTeamId: 'equipo-norte',
  authProvider: 'local',
});

/** Equipo del almacen, o fallo explicito. Evita aserciones non-null en cada prueba. */
const teamOf = async (id: string) => {
  const equipo = await governance.getTeam(id);
  if (!equipo) throw new Error(`fixture inesperado: falta el equipo ${id}`);
  return equipo;
};

beforeEach(async () => {
  await governance.reset();
  await clearAudit();
});

describe('almacen de gobierno', () => {
  it('siembra desde seedData', async () => {
    expect((await governance.listTeams()).map((t) => t.id).sort()).toEqual(['equipo-este', 'equipo-norte']);
    expect((await governance.getTree()).nodes.length).toBeGreaterThan(0);
  });

  it('las escrituras se reflejan en lecturas posteriores', async () => {
    const equipo = await governance.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    await governance.upsertTeam({ ...equipo, name: 'Renombrado' });
    expect((await governance.getTeam('equipo-norte'))?.name).toBe('Renombrado');
  });

  it('devuelve copias: quien lee no puede mutar el almacen por accidente', async () => {
    const equipo = await governance.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    equipo.name = 'Mutado por fuera';
    expect((await governance.getTeam('equipo-norte'))?.name).not.toBe('Mutado por fuera');
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
    expect(await roleMoreHeightOf('u-admin')).toBe('administrador');
    expect(await roleMoreHeightOf('u-ana')).toBe('colaborador');
    expect(await roleMoreHeightOf('u-beto')).toBe('visor');
    expect(await isAdministrator('u-beto')).toBe(false);
  });
});

describe('la puerta de ampliacion de ambito (4.10.4)', () => {
  const teamScope = async () => (await governance.getTeam('equipo-norte'))?.defaultScope;

  it('restringir mas no exige justificacion', async () => {
    const guardado = await saveScope({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    expect(guardado.authorizedExpansion).toBeUndefined();
    expect((await teamScope())?.restrictions[0]?.allowedValues).toEqual(['Penal']);
  });

  it('AMPLIAR sin justificacion se RECHAZA, y dice que dimension se amplia', async () => {
    // El equipo Norte esta restringido a Penal y Civil. Anadir Laboral amplia.
    try {
      await saveScope({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      });
      expect.unreachable('se esperaba ExpansionWithoutJustifyError');
    } catch (error) {
      expect(error).toBeInstanceOf(ExpansionWithoutJustifyError);
      expect((error as AdminError).status).toBe(422);
      expect((error as ExpansionWithoutJustifyError).dimensiones[0]).toContain('Laboral');
    }
  });

  it('quitar la restriccion de una dimension tambien es ampliar', async () => {
    await expect(
      saveScope({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: { restrictions: [] },
      }),
    ).rejects.toThrow(ExpansionWithoutJustifyError);
  });

  it('con justificacion se guarda, marcada como excepcion y con su autor', async () => {
    const guardado = await saveScope({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      justificacion: 'Auditoria laboral trimestral aprobada por el Consejo',
    });
    expect(guardado.authorizedExpansion?.justification).toMatch(/Auditoria laboral/);
    expect(guardado.authorizedExpansion?.authorizedBy).toBe('u-admin');
  });

  it('un rechazo NO deja rastro en el almacen ni en la auditoria', async () => {
    const before = JSON.stringify(teamScope());
    await expect(
      saveScope({
        actor: admin,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal', 'Civil', 'Laboral'),
      }),
    ).rejects.toThrow();
    expect(JSON.stringify(teamScope())).toBe(before);
    expect(await auditList()).toHaveLength(0);
  });

  it('un Colaborador no puede configurar ambitos', async () => {
    await expect(
      saveScope({
        actor: colaborador,
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: scope(DIM_MATERIA, 'Penal'),
      }),
    ).rejects.toThrow(/no puede 'configurar-ambitos'/);
  });

  it('expandedDimensions nombra exactamente que se amplia', async () => {
    expect(
      expandedDimensions(scope(DIM_DISTRITO, 'Norte'), scope(DIM_DISTRITO, 'Norte', 'Este')),
    ).toEqual(['DimTribunal.Distrito (+Este)']);
    expect(expandedDimensions(scope(DIM_DISTRITO, 'Norte'), { restrictions: [] })).toEqual([
      'DimTribunal.Distrito (deja de estar restringida)',
    ]);
  });
});

describe('la puerta de auditoria (seccion 7)', () => {
  it('una ampliacion queda DESTACADA, separada del resto de cambios', async () => {
    await saveScope({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    await saveScope({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal', 'Civil'),
      justificacion: 'Se reincorpora materia civil por resolucion',
    });

    expect(await auditList()).toHaveLength(2);
    const ampliaciones = await auditList({ onlyExpansions: true });
    expect(ampliaciones).toHaveLength(1);
    expect(ampliaciones[0]?.justification).toMatch(/resolucion/);
    expect(await expansionsCount()).toBe(1);
  });

  it('guarda el estado anterior y el nuevo: no es sobrescritura silenciosa (4.10.7)', async () => {
    await saveScope({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });
    const evento = (await auditList())[0];
    expect(evento?.before).toBeDefined();
    expect(evento?.after).toBeDefined();
  });

  it('el registro se puede filtrar por tipo de entidad y por autor', async () => {
    const equipo = await governance.getTeam('equipo-norte');
    if (!equipo) throw new Error('fixture inesperado');
    await saveTeam(admin, { ...equipo, name: 'Norte renombrado' });
    await saveScope({
      actor: admin,
      destino: { tipo: 'equipo', teamId: 'equipo-norte' },
      scope: scope(DIM_MATERIA, 'Penal'),
    });

    expect(await auditList({ entityType: 'team' })).toHaveLength(1);
    expect(await auditList({ entityType: 'scope' })).toHaveLength(1);
    expect(await auditList({ actorId: 'otro' })).toHaveLength(0);
  });
});

describe('editar el ambito de una carpeta cambia lo que contiene', () => {
  it('el ambito efectivo de un modulo cambia de inmediato', async () => {
    const before = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: await teamOf('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: (await governance.getTree()).nodes,
    });
    const beforeDistrito = before.scope.restrictions.find(
      (r) => dimensionKey(r.dimension) === dimensionKey(DIM_DISTRITO),
    );
    expect(beforeDistrito?.allowedValues).toEqual(['Distrito Norte']);

    // Se restringe aun mas la carpeta que lo contiene: de Norte a nada.
    await saveScope({
      actor: admin,
      destino: { tipo: 'carpeta', nodeId: 'nodo-norte' },
      scope: scope(DIM_DISTRITO),
    });

    const after = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: await teamOf('equipo-norte'),
      moduleId: 'casos-pendientes',
      generalTree: (await governance.getTree()).nodes,
    });
    expect(after.deniesEverything).toBe(true);
  });
});

describe('previsualizar un movimiento antes de confirmarlo (4.1.2)', () => {
  it('avisa de que el ambito cambia y de que modulos arrastra', async () => {
    const previo = await previsualizarMovimiento('nodo-m-audiencias', 'nodo-este');
    expect(previo.moduleIds).toEqual(['audiencias']);
    expect(previo.cambiaElAmbito).toBe(true);
    expect(previo.beforeScope?.restrictions[0]?.allowedValues).toEqual(['Distrito Norte']);
    expect(previo.afterScope?.restrictions[0]?.allowedValues).toEqual(['Distrito Este']);
  });

  it('mover dentro de la misma carpeta no cambia el ambito', async () => {
    expect((await previsualizarMovimiento('nodo-m-audiencias', 'nodo-norte')).cambiaElAmbito).toBe(false);
  });
});

describe('operaciones de arbol desde el panel', () => {
  it('un movimiento se persiste y queda auditado como tal', async () => {
    await treeOperationRun(admin, {
      type: 'mover',
      nodeId: 'nodo-m-audiencias',
      newParentId: 'nodo-este',
    });

    const moves = await auditList({ onlyMoves: true });
    expect(moves).toHaveLength(1);
    expect(moves[0]?.entityId).toBe('nodo-m-audiencias');

    // Y el arbol persistido refleja el cambio.
    const resuelto = resolveEffectiveScope({
      user: { userId: 'u-ana' },
      activeTeam: await teamOf('equipo-norte'),
      moduleId: 'audiencias',
      generalTree: (await governance.getTree()).nodes,
    });
    const distrito = resuelto.scope.restrictions.find(
      (r) => dimensionKey(r.dimension) === dimensionKey(DIM_DISTRITO),
    );
    expect(distrito?.allowedValues).toEqual(['Distrito Este']);
  });

  it('un Visor no puede operar sobre el arbol', async () => {
    await expect(
      treeOperationRun(visor, { type: 'renombrar', nodeId: 'nodo-norte', name: 'X' }),
    ).rejects.toThrow(AdminError);
  });
});

describe('membresia (4.10.2)', () => {
  it('anade y quita personas de un equipo, con auditoria', async () => {
    const conBeto = await membershipChange(admin, 'equipo-norte', 'u-beto', 'visor');
    expect(conBeto.members.some((m) => m.userId === 'u-beto')).toBe(true);

    const sinBeto = await membershipChange(admin, 'equipo-norte', 'u-beto', null);
    expect(sinBeto.members.some((m) => m.userId === 'u-beto')).toBe(false);
    expect(await auditList({ entityType: 'membership' })).toHaveLength(2);
  });

  it('un Colaborador no puede gestionar roles', async () => {
    await expect(membershipChange(colaborador, 'equipo-norte', 'u-beto', 'visor')).rejects.toThrow(
      /no puede 'gestionar-usuarios-y-roles'/,
    );
  });
});

describe('quien ve que (4.10.8)', () => {
  it('muestra el ambito resuelto y NOMBRA la carpeta que lo origino', async () => {
    const r = await seesWhoWhere('u-ana', 'equipo-norte', 'casos-pendientes');
    expect(r.tieneAcceso).toBe(true);
    expect(r.pasos.map((p) => p.source)).toEqual([
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
    const withoutGrant = await seesWhoWhere('u-ana', 'equipo-norte', 'estadisticas');
    expect(withoutGrant.treeTheExists).toBe(true);
    expect(withoutGrant.tieneAcceso).toBe(false);
  });

  it('señala cuando el ambito resuelto proviene de una ampliacion', async () => {
    await saveScope({
      actor: admin,
      destino: { tipo: 'carpeta', nodeId: 'nodo-norte' },
      scope: scope(DIM_DISTRITO, 'Distrito Norte', 'Distrito Este'),
      justificacion: 'Supervision conjunta Norte-Este durante el trimestre',
    });
    expect((await seesWhoWhere('u-ana', 'equipo-norte', 'casos-pendientes')).usoAmpliacion).toBe(true);
  });
});

describe('la institucion no se puede quedar sin Administrador (4.10.1)', () => {
  /**
   * El seed declara un unico Administrador —u-admin, en equipo-norte—, asi que cada una de estas
   * pruebas parte del caso peor, que es el que importa. `gobierno.reset()` en el beforeEach lo
   * devuelve a su sitio.
   */
  it('un Administrador no puede retirarse el rol a si mismo', async () => {
    await expect(
      membershipChange(admin, 'equipo-norte', 'u-admin', null),
    ).rejects.toBeInstanceOf(LastAdministratorError);

    // Y sigue administrando: la escritura no llego a ocurrir.
    expect(await isAdministrator('u-admin')).toBe(true);
  });

  it('tampoco degradarse a Colaborador', async () => {
    await expect(
      membershipChange(admin, 'equipo-norte', 'u-admin', 'colaborador'),
    ).rejects.toBeInstanceOf(LastAdministratorError);
  });

  it('el error es 409 y no 403: el permiso lo tiene, el problema es el resultado', async () => {
    const fallo = await membershipChange(admin, 'equipo-norte', 'u-admin', null).catch(
      (e: unknown) => e,
    );

    expect((fallo as LastAdministratorError).status).toBe(409);
    // El mensaje nombra a quien administra, para que se sepa a quien hay que nombrar antes.
    expect((fallo as LastAdministratorError).message).toContain('u-admin');
  });

  it('guardar el equipo entero con la membresia reescrita tampoco cuela', async () => {
    const equipo = await teamOf('equipo-norte');

    // Este es el camino que se salta por completo la palabra "rol": se manda el equipo con una
    // lista de miembros distinta, y el Administrador simplemente no esta en ella.
    await expect(
      saveTeam(admin, {
        ...equipo,
        members: equipo.members.filter((m) => m.userId !== 'u-admin'),
      }),
    ).rejects.toBeInstanceOf(LastAdministratorError);

    expect(await isAdministrator('u-admin')).toBe(true);
  });

  it('borrar el equipo donde estaba el ultimo Administrador tampoco', async () => {
    await expect(deleteTeam(admin, 'equipo-norte')).rejects.toBeInstanceOf(
      LastAdministratorError,
    );
    expect((await governance.getTeam('equipo-norte'))).toBeDefined();
  });

  it('con otro Administrador nombrado antes, el cambio pasa', async () => {
    await membershipChange(admin, 'equipo-este', 'u-ana', 'administrador');

    // Ahora si: u-admin puede retirarse, porque Ana administra.
    await membershipChange(admin, 'equipo-norte', 'u-admin', 'colaborador');

    expect(await isAdministrator('u-admin')).toBe(false);
    expect(await isAdministrator('u-ana')).toBe(true);
  });

  it('quienes administran se pueden consultar, para poder verlo antes de tocar nada', async () => {
    expect(await administradores()).toEqual(['u-admin']);
    await membershipChange(admin, 'equipo-este', 'u-ana', 'administrador');
    expect(await administradores()).toEqual(['u-admin', 'u-ana']);
  });
});

describe('quien administra, ¿puede ademas ENTRAR? (2.8)', () => {
  /*
   * `wouldLeaveNoAdministrator` comprueba el gobierno: que alguien conserva el rol. Lo que aqui se
   * comprueba es la otra mitad —que esa persona pueda iniciar sesion—, que es lo que esa invariante
   * NO mira y lo que hace que la institucion se quede sin acceso sin que ningun cambio se rechace.
   */
  const CLAVE = (userId: string) => `auth:credencial:${mailUser(userId).toLowerCase()}`;

  const darCuenta = async (
    userId: string,
    opciones: { bloqueada?: boolean; conSegundoFactor?: boolean } = {},
  ) => {
    await credentialsStore.save({
      userId,
      email: mailUser(userId),
      passwordHash: 'no-se-verifica-aqui',
      passwordHistory: [],
      ...(opciones.conSegundoFactor === false ? {} : { totpSecret: 'ABCDEFGHIJKLMNOPQRST' }),
      ...(opciones.bloqueada ? { lockedUntil: Date.now() + 60_000 } : {}),
      failedAttempts: 0,
      emailVerified: true,
    });
  };

  beforeEach(async () => {
    for (const userId of ['u-admin', 'u-ana', 'u-beto']) await borrar(CLAVE(userId));
  });

  it('sin ninguna cuenta local y sin Azure AD, nadie puede entrar', async () => {
    const acceso = await accesoDeQuienesAdministran();

    expect(acceso.quienes).toEqual([{ userId: 'u-admin', impedimento: 'sin-cuenta' }]);
    expect(acceso.conAccesoPropio).toBe(0);
    expect(acceso.gravedad).toBe('grave');
  });

  it('con cuenta local y segundo factor, puede', async () => {
    await darCuenta('u-admin');

    const acceso = await accesoDeQuienesAdministran();
    expect(acceso.quienes).toEqual([{ userId: 'u-admin' }]);
    expect(acceso.conAccesoPropio).toBe(1);
    expect(acceso.gravedad).toBe('ok');
  });

  /*
   * El caso entero del apartado: el gobierno dice que u-admin administra —y por eso ningun cambio
   * de configuracion se rechaza— mientras su cuenta esta bloqueada y no puede entrar.
   */
  it('la cuenta bloqueada satisface el gobierno y no deja entrar igual', async () => {
    await darCuenta('u-admin', { bloqueada: true });

    expect(await administradores()).toEqual(['u-admin']);

    const acceso = await accesoDeQuienesAdministran();
    expect(acceso.quienes).toEqual([{ userId: 'u-admin', impedimento: 'bloqueada' }]);
    expect(acceso.gravedad).toBe('grave');
  });

  // Una cuenta local sin TOTP no es utilizable: 4.7.2 lo exige y el inicio de sesion lo pide.
  it('la cuenta sin segundo factor tampoco cuenta', async () => {
    await darCuenta('u-admin', { conSegundoFactor: false });

    const acceso = await accesoDeQuienesAdministran();
    expect(acceso.quienes).toEqual([{ userId: 'u-admin', impedimento: 'sin-segundo-factor' }]);
    expect(acceso.gravedad).toBe('grave');
  });

  it('basta con que UNO de los que administran pueda entrar', async () => {
    await membershipChange(admin, 'equipo-este', 'u-ana', 'administrador');
    await darCuenta('u-ana');

    const acceso = await accesoDeQuienesAdministran();
    expect(acceso.quienes).toEqual([
      { userId: 'u-admin', impedimento: 'sin-cuenta' },
      { userId: 'u-ana' },
    ]);
    expect(acceso.conAccesoPropio).toBe(1);
    expect(acceso.gravedad).toBe('ok');
  });
});

describe('borrar un equipo deja rastro', () => {
  it('emite un evento de auditoria, que antes no emitia', async () => {
    // Se nombra un segundo Administrador para poder borrar el equipo del primero.
    await membershipChange(admin, 'equipo-este', 'u-ana', 'administrador');
    await deleteTeam(admin, 'equipo-norte');

    const evento = (await auditList()).find(
      (e) => e.entityType === 'team' && e.entityId === 'equipo-norte' && e.action === 'delete',
    );

    // El handler llamaba directamente al almacen: un equipo podia desaparecer sin que quedara
    // constancia de quien lo borro ni de que contenia.
    expect(evento).toBeDefined();
    expect(evento?.actorId).toBe('u-admin');
    expect(evento?.before).toMatchObject({ id: 'equipo-norte' });
  });

  it('borrar uno que no existe es 404, no un exito silencioso', async () => {
    const fallo = await deleteTeam(admin, 'equipo-inventado').catch((e: unknown) => e);
    expect((fallo as AdminError).status).toBe(404);
  });

  it('un Visor no puede borrar equipos', async () => {
    // `PermissionError`, igual que el resto de operaciones de equipo: el envoltorio de los
    // handlers lo traduce a 403. Es la diferencia con el ultimo Administrador, que es 409.
    await expect(deleteTeam(visor, 'equipo-este')).rejects.toBeInstanceOf(PermissionError);
  });
});
