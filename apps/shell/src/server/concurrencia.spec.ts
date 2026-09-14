import { beforeEach, describe, expect, it } from 'vitest';
import type { ModuleDefinition } from '@app/module-model';
import type { Team } from '@app/access-control';
import { changeRecord, auditList, clearAudit } from './audit';
import { modules } from './moduleStore';
import { saveBookmark, bookmarksList, deleteBookmark } from './bookmarks';
import { governance } from './governance';
import { proposeResource, decideProposal, listProposals } from './catalogo';
import type { Actor } from '@app/access-control';
import { sessions, loginAudit, loginAuditList } from './identity';

/**
 * Lo que pasa cuando dos peticiones llegan a la vez.
 *
 * El almacen escribe de forma atomica, asi que nunca se lee un JSON a medias. Lo que eso NO
 * impide es la actualizacion perdida: dos peticiones leen el mismo valor, cada una le anade lo
 * suyo y la segunda en escribir borra lo de la primera. No hay error ni excepcion; sencillamente
 * falta una fila, y no se echa en falta hasta que alguien la busca.
 *
 * Cada caso lanza las operaciones SIN esperar a la anterior. Esperandolas una a una pasarian
 * igual con la carrera puesta, y serian pruebas verdaderas por el motivo equivocado.
 */

const modulo = (id: string): ModuleDefinition => ({
  moduleId: id,
  slug: id,
  name: id,
  status: 'borrador',
  version: 1,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
  pages: [{ pageId: 'p1', slug: 'p1', name: 'P1', items: [] }],
});

describe('dos peticiones a la vez', () => {
  beforeEach(async () => {
    await clearAudit();
  });

  it('el registro de auditoria conserva los DIEZ eventos', async () => {
    // Es el que mas duele perder: §4.10.4 obliga a justificar una ampliacion de ambito y §7 a
    // dejarla anotada. Una ampliacion que se guarda pero no se registra deja el sistema
    // diciendo que audita y sin la fila que importa.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        changeRecord({
          actorId: `admin-${i}`,
          entityType: 'team',
          entityId: `equipo-${i}`,
          action: 'update',
        }),
      ),
    );

    const registrados = await auditList({});
    expect(registrados).toHaveLength(10);
    expect(new Set(registrados.map((e) => e.entityId)).size).toBe(10);
  });

  it('dos ediciones de modulos DISTINTOS no se pisan', async () => {
    // Los modulos son un solo valor en el almacen, asi que dos personas editando modulos
    // distintos chocan igual que dos editando el mismo. Con el autoguardado del editor esto no
    // es hipotetico, y lo que se pierde no es un campo: es el modulo entero.
    await Promise.all([modules.save(modulo('uno')), modules.save(modulo('dos'))]);

    expect(await modules.get('uno')).toBeDefined();
    expect(await modules.get('dos')).toBeDefined();
  });

  it('el historial de publicaciones no pierde versiones ni las repite', async () => {
    // El historial es de SOLO ANADIR: es el registro de lo que estuvo publicado, y responde
    // «que veia la gente entonces». Una version que no llega a escribirse no se recupera.
    await Promise.all(
      [1, 2, 3, 4, 5].map((version) =>
        modules.versionRecord({
          moduleId: 'historiado',
          version,
          publishedAt: '2026-09-14T00:00:00.000Z',
          publishedBy: 'admin',
          definition: { ...modulo('historiado'), version },
        }),
      ),
    );

    const historia = await modules.history('historiado');
    expect(historia.map((v) => v.version).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('un reintento simultaneo de la MISMA version no la duplica', async () => {
    // La comprobacion de «ya esta» tiene que estar dentro del turno: fuera, dos reintentos la
    // pasan los dos y el historial acaba con la misma version dos veces.
    const entrada = {
      moduleId: 'reintento',
      version: 7,
      publishedAt: '2026-09-14T00:00:00.000Z',
      publishedBy: 'admin',
      definition: { ...modulo('reintento'), version: 7 },
    };
    await Promise.all([modules.versionRecord(entrada), modules.versionRecord(entrada)]);

    expect(await modules.history('reintento')).toHaveLength(1);
  });

  it('cinco marcadores guardados a la vez se conservan los cinco', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        saveBookmark({
          id: `m${i}`,
          name: `Marcador ${i}`,
          ownerUserId: 'ana',
          moduleSlug: 'casos-pendientes',
          filters: {},
          createdAt: '2026-09-14T00:00:00.000Z',
        }),
      ),
    );

    expect(await bookmarksList('ana', 'equipo')).toHaveLength(5);
  });

  it('borrar un marcador ajeno sigue devolviendo false', async () => {
    // La comprobacion de propiedad se movio DENTRO del turno; que siga diciendo que no es lo
    // que impide que el cambio de forma se lleve por delante la regla.
    await saveBookmark({
      id: 'suyo',
      name: 'De Ana',
      ownerUserId: 'ana',
      moduleSlug: 'casos-pendientes',
      filters: {},
      createdAt: '2026-09-14T00:00:00.000Z',
    });

    expect(await deleteBookmark('suyo', 'beto')).toBe(false);
    expect(await deleteBookmark('suyo', 'ana')).toBe(true);
    expect(await deleteBookmark('suyo', 'ana')).toBe(false);
  });

  it('dos sesiones abiertas a la vez se revocan las DOS', async () => {
    // «Cerrar sesion en todos los dispositivos» recorre el indice por persona. Si abrir dos
    // sesiones a la vez dejaba una fuera del indice, la revocacion la dejaba abierta: una
    // revocacion que no revoca es peor que no tenerla.
    const principal = {
      userId: 'u-carrera',
      authProvider: 'local' as const,
      userPrincipalName: 'carrera@externo.org',
      displayName: 'Carrera',
      roles: [],
      securityContext: {},
    };

    const [una, otra] = await Promise.all([
      sessions.issue(principal, 'equipo'),
      sessions.issue(principal, 'equipo'),
    ]);

    await sessions.revokeAllFor('u-carrera');

    expect(await sessions.resolve(una.sessionId)).toBeNull();
    expect(await sessions.resolve(otra.sessionId)).toBeNull();
  });

  it('diez intentos de acceso simultaneos quedan los diez en el registro', async () => {
    // Los intentos fallidos llegan en rafaga, que es cuando el registro hace falta. Anotado
    // uno de diez, el rastro de un ataque se lee como un error de dedo.
    const antes = (await loginAuditList()).length;
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        loginAudit.recordLogin({
          timestamp: new Date().toISOString(),
          authProvider: 'local',
          attemptedPrincipal: `intento-${i}@externo.org`,
          outcome: 'fallo',
          reason: 'credenciales-invalidas',
        }),
      ),
    );

    expect((await loginAuditList()).length).toBe(antes + 10);
  });

  it('dos revisores no pueden decidir la MISMA propuesta', async () => {
    // Los dos abren la lista, los dos la ven pendiente y los dos deciden. Sin turno, la
    // decision que queda escrita es la del que llegue el ultimo: la propuesta acaba aprobada
    // por quien no la aprobo, o devuelta con el motivo del otro.
    const actor: Actor = { userId: 'u-admin', role: 'administrador' };
    const propuesta = await proposeResource(actor, {
      objectId: 'barras',
      version: '9.0.0',
      summary: 'Prueba de decision simultanea',
    });

    const decisiones = await Promise.allSettled([
      decideProposal(actor, propuesta.id, 'aprobar'),
      decideProposal(actor, propuesta.id, 'devolver', 'no procede'),
    ]);

    const hechas = decisiones.filter((d) => d.status === 'fulfilled');
    expect(hechas).toHaveLength(1);
    // Y la que fallo lo hizo diciendo por que, no con un error cualquiera.
    const fallida = decisiones.find((d) => d.status === 'rejected');
    expect((fallida as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
  });

  it('la misma propuesta enviada dos veces a la vez se guarda UNA', async () => {
    const actor: Actor = { userId: 'u-admin', role: 'administrador' };
    const envios = await Promise.allSettled([
      proposeResource(actor, { objectId: 'lineas', version: '9.9.9', summary: 'Una' }),
      proposeResource(actor, { objectId: 'lineas', version: '9.9.9', summary: 'Otra' }),
    ]);

    expect(envios.filter((e) => e.status === 'fulfilled')).toHaveLength(1);
    const pendientes = (await listProposals()).filter(
      (p) => p.objectId === 'lineas' && p.version === '9.9.9',
    );
    expect(pendientes).toHaveLength(1);
  });

  it('dos equipos creados a la vez quedan los dos en el gobierno', async () => {
    // El gobierno entero es UN valor: dos cambios de cosas distintas —un equipo y otro equipo—
    // se pisan igual que dos del mismo campo.
    const equipo = (id: string): Team => ({
      id,
      name: id,
      grantedNodes: [],
      members: [],
      defaultScope: { restrictions: [] },
      moduleScopeOverrides: {},
    });

    const antes = (await governance.listTeams()).length;
    await Promise.all([
      governance.upsertTeam(equipo('equipo-a')),
      governance.upsertTeam(equipo('equipo-b')),
    ]);

    const despues = await governance.listTeams();
    expect(despues).toHaveLength(antes + 2);
    expect(despues.map((e) => e.id)).toEqual(expect.arrayContaining(['equipo-a', 'equipo-b']));
  });
});
