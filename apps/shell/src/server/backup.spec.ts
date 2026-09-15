import { beforeEach, describe, expect, it } from 'vitest';
import type { GridItem } from '@app/module-model';
import {
  GOVERNANCE_KEY,
  KEY_BOOKMARKS,
  KEY_HISTORY,
  KEY_INSTALLATION,
  KEY_MODULES,
  borrar,
  cacheL2,
  leer,
  write,
} from './almacenCompartido';
import {
  CLASSES,
  UnreadableBackup,
  backupState,
  checksumOf,
  classOf,
  restoreState,
} from './backup';
import { auditList, changeRecord, clearAudit } from './audit';
import {
  createDraft,
  publicar,
  saveDraft,
  sendApproval,
  historialDe,
  type ModuleActor,
} from './cicloDeVida';
import { governance } from './governance';
import { stateStatus } from './installation';
import { modules } from './moduleStore';
import { readPersonalization, savePersonalization } from './personalization';

/**
 * Contingencia contra desastres: que una restauracion DEVUELVA el sistema.
 *
 * Un respaldo que nadie ha restaurado no es un respaldo: es un archivo. Esta prueba lo restaura
 * de verdad — siembra, cambia el estado por los caminos reales, vuelca, BORRA EL ALMACEN ENTERO y
 * vuelve— y comprueba lo que se lee por los lectores publicos, no comparando archivos. Comparar
 * archivos diria que el volcado es fiel a si mismo, que es lo unico que no hace falta demostrar.
 */

const admin: ModuleActor = { userId: 'u-admin', role: 'administrador' };

const validItem = (id = 'kpi-respaldo', x = 0): GridItem => ({
  id,
  position: { x, y: 0, w: 3, h: 2 },
  instance: {
    instanceId: id,
    objectId: 'tarjeta-kpi',
    version: '1.0.0',
    title: 'Pendientes',
    binding: {
      datasetId: 'casos-por-distrito-trimestre',
      dimensions: [],
      measures: ['CasosPendientes'],
    },
  },
});

/** Vacia el almacen como lo vaciaria un disco perdido: sin preguntar y sin dejar nada. */
async function vaciarElAlmacen(): Promise<void> {
  for (const { prefix } of CLASSES) {
    for (const clave of await cacheL2.keysByPrefix(prefix)) await borrar(clave);
  }
}

beforeEach(async () => {
  await borrar(KEY_MODULES);
  await borrar(KEY_HISTORY);
  await borrar(GOVERNANCE_KEY);
  await borrar(KEY_BOOKMARKS);
  await borrar(KEY_INSTALLATION);
  await clearAudit();
});

describe('respaldo y restauracion del estado autoritativo', () => {
  it('devuelve el sistema tal y como estaba', async () => {
    // 1. Cambios por los caminos REALES, no escribiendo claves a mano: lo que se quiere probar es
    //    que vuelve lo que la aplicacion escribe, no lo que la prueba sabe escribir.
    const borrador = await createDraft({ actor: admin, name: 'Modulo del respaldo', slug: 'resp' });
    const pagina = borrador.pages[0];
    if (!pagina) throw new Error('fixture inesperado');
    await saveDraft({
      actor: admin,
      moduleId: borrador.moduleId,
      // Dos objetos: ocultar uno solo es legal, ocultar el unico que hay no lo es.
      cambios: { pages: [{ ...pagina, items: [validItem(), validItem('kpi-segundo', 3)] }] },
    });
    await sendApproval({ actor: admin, moduleId: borrador.moduleId });
    const publicado = await publicar({ actor: admin, moduleId: borrador.moduleId });

    const equipos = await governance.listTeams();
    const primero = equipos[0];
    if (!primero) throw new Error('la semilla deberia traer equipos');
    await governance.upsertTeam({ ...primero, name: 'Equipo renombrado en el respaldo' });

    await changeRecord({
      actorId: 'u-admin',
      entityType: 'team',
      entityId: primero.id,
      action: 'update',
      before: { name: primero.name },
      after: { name: 'Equipo renombrado en el respaldo' },
    });

    await savePersonalization({
      userId: 'u-ana',
      module: publicado,
      hiddenItemIds: ['kpi-respaldo'],
    });

    // 2. Lo que hay ANTES, leido por donde lo lee la aplicacion.
    const antes = {
      modulos: (await modules.list()).map((m) => m.slug).sort(),
      historial: (await historialDe(admin, borrador.moduleId)).length,
      equipo: (await governance.getTeam(primero.id))?.name,
      auditoria: (await auditList()).length,
      personalizacion: (await readPersonalization('u-ana', borrador.moduleId))?.hiddenItemIds,
    };
    expect(antes.equipo).toBe('Equipo renombrado en el respaldo');
    // Que el fixture de verdad guardo algo. Sin esto, comparar `undefined` con `undefined`
    // pasaria siempre y esta prueba diria que la personalizacion vuelve sin haberla guardado.
    expect(antes.personalizacion).toEqual(['kpi-respaldo']);
    expect(antes.historial).toBeGreaterThan(0);
    expect(antes.auditoria).toBeGreaterThan(0);

    const respaldo = await backupState();

    // 3. El desastre.
    await vaciarElAlmacen();
    expect((await governance.getTeam(primero.id))?.name).not.toBe(antes.equipo);

    // 4. La vuelta.
    const informe = await restoreState(respaldo, { apply: true });
    expect(informe.applied).toBe(true);
    expect(informe.written.length).toBeGreaterThan(0);

    // 5. Lo mismo, por los mismos lectores.
    expect((await modules.list()).map((m) => m.slug).sort()).toEqual(antes.modulos);
    expect((await historialDe(admin, borrador.moduleId)).length).toBe(antes.historial);
    expect((await governance.getTeam(primero.id))?.name).toBe(antes.equipo);
    expect((await auditList()).length).toBe(antes.auditoria);
    expect((await readPersonalization('u-ana', borrador.moduleId))?.hiddenItemIds).toEqual(
      antes.personalizacion,
    );
  });

  it('en seco no escribe nada, que es como se mira un respaldo antes de fiarse', async () => {
    await governance.upsertTeam({
      ...((await governance.listTeams())[0] as NonNullable<
        Awaited<ReturnType<typeof governance.getTeam>>
      >),
      name: 'Antes de la prueba en seco',
    });
    const respaldo = await backupState();
    await vaciarElAlmacen();

    const informe = await restoreState(respaldo);

    expect(informe.applied).toBe(false);
    expect(informe.written.length).toBeGreaterThan(0);
    // El almacen sigue vacio: el informe dice lo que HARIA.
    expect(await leer(GOVERNANCE_KEY)).toBeUndefined();
  });

  /*
   * Lo que NO vuelve, que es la mitad del diseno.
   *
   * Copiar el directorio entero y devolverlo se llevaria las sesiones y los tokens de un solo
   * uso, y restaurarlo los resucitaria: sesiones que alguien revoco a proposito y enlaces de
   * restablecimiento ya gastados volverian a valer. La exclusion es una REGLA, no una decision de
   * quien volco, asi que se comprueba contra un archivo manipulado a mano.
   */
  describe('lo que no vuelve', () => {
    it('el respaldo no se lleva sesiones, tokens ni credenciales', async () => {
      await write('auth:sesion:s-1', { userId: 'u-ana' });
      await write('auth:credencial:ana@pj.gob.do', { totpSecret: 'SECRETO' });
      await write('auth:reset:r-1', { usado: false });
      await governance.upsertTeam({
        ...((await governance.listTeams())[0] as NonNullable<
          Awaited<ReturnType<typeof governance.getTeam>>
        >),
        name: 'Con sesiones al lado',
      });

      const respaldo = await backupState();

      expect(Object.keys(respaldo.entries)).toContain(GOVERNANCE_KEY);
      expect(Object.keys(respaldo.entries).filter((k) => k.startsWith('auth:sesion:'))).toEqual([]);
      expect(Object.keys(respaldo.entries).filter((k) => k.startsWith('auth:credencial:'))).toEqual(
        [],
      );
      expect(Object.keys(respaldo.entries).filter((k) => k.startsWith('auth:reset:'))).toEqual([]);
    });

    it('y las rechaza aunque alguien las meta en el archivo a mano', async () => {
      const respaldo = await backupState();
      respaldo.entries['auth:sesion:resucitada'] = {
        value: { userId: 'u-ana' },
        generatedAt: new Date().toISOString(),
      };
      respaldo.entries['auth:reset:gastado'] = {
        value: { usado: true },
        generatedAt: new Date().toISOString(),
      };
      // La suma se recalcula: se quiere probar el rechazo POR CLASE, no que se note la manipulacion.
      const conSuma = await restoreState(
        { ...respaldo, manifest: { ...respaldo.manifest, checksum: checksumOf(respaldo.entries) } },
        { apply: true },
      );

      expect(conSuma.written).not.toContain('auth:sesion:resucitada');
      expect(conSuma.rejected.map((r) => r.key)).toContain('auth:sesion:resucitada');
      expect(conSuma.rejected.map((r) => r.key)).toContain('auth:reset:gastado');
      expect(await leer('auth:sesion:resucitada')).toBeUndefined();
    });

    it('y rechaza la que nadie clasifico, en vez de devolverla por si acaso', async () => {
      const respaldo = await backupState();
      respaldo.entries['inventada:lo-que-sea'] = {
        value: 1,
        generatedAt: new Date().toISOString(),
      };

      const informe = await restoreState(
        { ...respaldo, manifest: { ...respaldo.manifest, checksum: checksumOf(respaldo.entries) } },
        { apply: true },
      );

      expect(informe.rejected.map((r) => r.key)).toContain('inventada:lo-que-sea');
      expect(await leer('inventada:lo-que-sea')).toBeUndefined();
    });
  });

  it('un respaldo alterado no se restaura A MEDIAS: se rechaza entero', async () => {
    // Media restauracion es peor que ninguna, porque deja el gobierno en un estado que nadie
    // tuvo nunca. La comprobacion va ANTES de escribir la primera clave.
    const respaldo = await backupState();
    await vaciarElAlmacen();
    respaldo.entries[GOVERNANCE_KEY] = {
      value: { manipulado: true },
      generatedAt: new Date().toISOString(),
    };

    await expect(restoreState(respaldo, { apply: true })).rejects.toBeInstanceOf(UnreadableBackup);
    expect(await leer(GOVERNANCE_KEY)).toBeUndefined();
  });

  it('un formato que esta version no sabe leer se rechaza en vez de interpretarse', async () => {
    const respaldo = await backupState();
    await expect(
      restoreState({ ...respaldo, manifest: { ...respaldo.manifest, format: 99 as 1 } }),
    ).rejects.toBeInstanceOf(UnreadableBackup);
  });

  /*
   * El prefijo mas LARGO manda.
   *
   * `app:modulos:historial` empieza por `app:modulos`. Sin esta regla, el historial se volcaria
   * dos veces y —peor— heredaria la clase del prefijo corto el dia que las dos difieran.
   */
  it('cada motivo dice algo: una excepcion sin motivo no la puede revisar nadie', () => {
    // La tabla se lee para DECIDIR si una clave vuelve. Un motivo de tres palabras no deja
    // decidir nada, y es lo que convierte una lista razonada en una lista de perdonados.
    const mudos = CLASSES.filter(({ reason }) => reason.trim().length < 20).map((c) => c.prefix);
    expect(mudos).toEqual([]);
  });

  it('una clave que casa con dos prefijos toma el mas especifico', () => {
    expect(classOf('app:modulos:historial')?.prefix).toBe('app:modulos:historial');
    expect(classOf('app:modulos')?.prefix).toBe('app:modulos');
    expect(classOf('auth:sesiones-de:u-ana')?.prefix).toBe('auth:sesiones-de:');
  });
});

/**
 * El centinela: que perder el estado deje de parecer un despliegue nuevo.
 *
 * Es la mitad de la contingencia que ningun respaldo sustituye. Si nadie se entera, nadie
 * restaura, y el gobierno de la institucion se sustituye por los datos de demostracion sin que
 * nada falle.
 */
describe('el estado perdido se distingue del despliegue nuevo', () => {
  it('sin nada guardado todavia, es un despliegue nuevo', async () => {
    expect((await stateStatus()).status).toBe('nueva');
  });

  it('en cuanto alguien guarda gobierno, queda constancia', async () => {
    const equipos = await governance.listTeams();
    await governance.upsertTeam({ ...(equipos[0] as NonNullable<(typeof equipos)[0]>) });

    expect(await leer(KEY_INSTALLATION)).toBeDefined();
    expect((await stateStatus()).status).toBe('en-marcha');
  });

  it('y si despues falta el gobierno, es ESTADO PERDIDO y dice cual falta', async () => {
    const equipos = await governance.listTeams();
    await governance.upsertTeam({ ...(equipos[0] as NonNullable<(typeof equipos)[0]>) });
    await borrar(GOVERNANCE_KEY);

    const estado = await stateStatus();
    expect(estado.status).toBe('estado-perdido');
    expect(estado.missing).toContain(GOVERNANCE_KEY);
  });

  it('el centinela viaja en el respaldo: restaurar no convierte el sistema en uno nuevo', async () => {
    const equipos = await governance.listTeams();
    await governance.upsertTeam({ ...(equipos[0] as NonNullable<(typeof equipos)[0]>) });
    const respaldo = await backupState();

    expect(Object.keys(respaldo.entries)).toContain(KEY_INSTALLATION);
  });
});
