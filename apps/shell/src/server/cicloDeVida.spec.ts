import { beforeEach, describe, expect, it } from 'vitest';
import type { GridItem, ModuleDefinition } from '@app/module-model';
import { KEY_HISTORY, KEY_MODULES, modules } from './moduleStore';
import { borrar } from './almacenCompartido';
import { clearAudit, auditList } from './audit';
import { settingsRestart } from './settings';
import {
  type ModuleActor,
  CicloDeVidaError,
  deleteModule,
  createDraft,
  createRevision,
  revertDraft,
  sendApproval,
  saveDraft,
  visibleModules,
  slugServableModule,
  visibleModuleSlug,
  statusPrune,
  publicar,
  bumpObjectInModule,
  historialDe,
  restaurarVersion,
  seeCan,
} from './cicloDeVida';

/** Ciclo de vida de un modulo — seccion 4.1. */

const admin: ModuleActor = { userId: 'u-admin', role: 'administrador' };
const colaborador: ModuleActor = { userId: 'u-ana', role: 'colaborador' };
const collaboratorOther: ModuleActor = { userId: 'u-otro', role: 'colaborador' };
const visor: ModuleActor = { userId: 'u-beto', role: 'visor' };

/** Un objeto valido, para que el modulo no quede bloqueado por estar vacio de contenido. */
const validItem = (): GridItem => ({
  id: 'kpi-prueba',
  position: { x: 0, y: 0, w: 3, h: 2 },
  instance: {
    instanceId: 'kpi-prueba',
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

async function readyDraft(actor: ModuleActor, slug: string): Promise<ModuleDefinition> {
  const creado = await createDraft({ actor, name: `Modulo ${slug}`, slug });
  const pagina = creado.pages[0];
  if (!pagina) throw new Error('fixture inesperado');
  return saveDraft({
    actor,
    moduleId: creado.moduleId,
    cambios: { pages: [{ ...pagina, items: [validItem()] }] },
  });
}

beforeEach(async () => {
  // Se parte de la semilla en cada prueba: el almacen es compartido y persiste entre ficheros.
  await borrar(KEY_MODULES);
  await borrar(KEY_HISTORY);
  await clearAudit();
});

describe('crear un borrador', () => {
  it('un Colaborador puede, y nace como borrador suyo', async () => {
    const modulo = await createDraft({ actor: colaborador, name: 'Mi analisis', slug: 'mi-analisis' });

    expect(modulo.status).toBe('borrador');
    expect(modulo.ownerUserId).toBe('u-ana');
    // Una pagina vacia, no cero paginas: cero paginas no se puede abrir.
    expect(modulo.pages).toHaveLength(1);
    expect(modulo.pages[0]?.items).toEqual([]);
  });

  it('un Visor no puede: crear modulos no esta en su fila de la matriz (4.10.1)', async () => {
    await expect(
      createDraft({ actor: visor, name: 'Intento', slug: 'intento' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('el slug tiene que servir como URL, porque lo es (4.11)', async () => {
    await expect(
      createDraft({ actor: colaborador, name: 'Con espacios', slug: 'Con Espacios' }),
    ).rejects.toBeInstanceOf(CicloDeVidaError);
  });

  it('no se puede repetir un slug ya usado', async () => {
    await createDraft({ actor: colaborador, name: 'Primero', slug: 'repetido' });
    await expect(
      createDraft({ actor: admin, name: 'Segundo', slug: 'repetido' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('un borrador es de quien lo escribe', () => {
  it('otro Colaborador no lo puede editar, aunque tenga el permiso general', async () => {
    const modulo = await readyDraft(colaborador, 'borrador-ajeno');

    await expect(
      saveDraft({
        actor: collaboratorOther,
        moduleId: modulo.moduleId,
        cambios: { name: 'Reescrito por otro' },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ni lo ve: un borrador ajeno no se resuelve por slug', async () => {
    await readyDraft(colaborador, 'invisible');

    expect(await visibleModuleSlug('invisible', collaboratorOther)).toBeUndefined();
    expect(await visibleModuleSlug('invisible', visor)).toBeUndefined();
    expect(await visibleModuleSlug('invisible', colaborador)).toBeDefined();
  });

  it('un Administrador tampoco: no ve el borrador ajeno, luego no lo edita', async () => {
    const modulo = await readyDraft(colaborador, 'ni-el-admin');

    expect(await visibleModuleSlug('ni-el-admin', admin)).toBeUndefined();
    await expect(
      saveDraft({ actor: admin, moduleId: modulo.moduleId, cambios: { name: 'Corregido' } }),
    ).rejects.toMatchObject({ status: 403 });

    // Lo que si puede es borrar uno abandonado, que no exige leerlo.
    await expect(deleteModule({ actor: admin, moduleId: modulo.moduleId })).resolves.toBeUndefined();
  });
});

describe('borrador -> pendiente-de-aprobacion -> publicado', () => {
  it('el flujo completo lo recorren dos personas distintas: propone una, publica otra', async () => {
    const modulo = await readyDraft(colaborador, 'flujo-completo');

    const enviado = await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });
    expect(enviado.status).toBe('pendiente-de-aprobacion');

    const publicado = await publicar({ actor: admin, moduleId: modulo.moduleId });
    expect(publicado.status).toBe('publicado');
    // Sube de version: se publica una version nueva, no se muta la anterior (principio 8).
    expect(publicado.version).toBe(modulo.version + 1);
    // Y deja de pertenecer a una persona: pertenece a la institucion (4.1).
    expect(publicado.ownerUserId).toBeUndefined();
  });

  it('un Colaborador NO puede publicar lo que el mismo propuso', async () => {
    const modulo = await readyDraft(colaborador, 'autopublicacion');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });

    await expect(publicar({ actor: colaborador, moduleId: modulo.moduleId })).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it('no se puede saltar la aprobacion: de borrador a publicado directamente, no', async () => {
    const modulo = await readyDraft(colaborador, 'sin-escalas');

    await expect(publicar({ actor: admin, moduleId: modulo.moduleId })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('mientras espera aprobacion, lo ve su autor y quien tiene que aprobarlo, nadie mas', async () => {
    const modulo = await readyDraft(colaborador, 'en-revision');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });

    expect(await visibleModuleSlug('en-revision', colaborador)).toBeDefined();
    expect(await visibleModuleSlug('en-revision', admin)).toBeDefined();
    expect(await visibleModuleSlug('en-revision', visor)).toBeUndefined();
    expect(await visibleModuleSlug('en-revision', collaboratorOther)).toBeUndefined();
  });
});

describe('la puerta de publicacion: findPublishBlockers, por fin invocado', () => {
  it('un modulo con una medida inexistente no se puede proponer', async () => {
    const creado = await createDraft({ actor: colaborador, name: 'Roto', slug: 'roto' });
    const pagina = creado.pages[0];
    if (!pagina) throw new Error('fixture inesperado');

    const roto = validItem();
    roto.instance.binding.measures = ['MedidaQueNoExiste'];
    await saveDraft({
      actor: colaborador,
      moduleId: creado.moduleId,
      cambios: { pages: [{ ...pagina, items: [roto] }] },
    });

    // 422: la peticion se entiende y es coherente; lo que falla es el contenido del modulo.
    const fallo = await sendApproval({
      actor: colaborador,
      moduleId: creado.moduleId,
    }).catch((e: unknown) => e);

    expect(fallo).toMatchObject({ status: 422 });
    expect((fallo as CicloDeVidaError).detail).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'object-broken' })]),
    );
  });

  it('tampoco se publica algo que se rompio DESPUES de proponerse', async () => {
    const modulo = await readyDraft(colaborador, 'roto-despues');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });

    // Se rompe por debajo, escribiendo en el almacen como lo haria otra instancia.
    const pendiente = await modules.get(modulo.moduleId);
    if (!pendiente?.pages[0]?.items[0]) throw new Error('fixture inesperado');
    pendiente.pages[0].items[0].instance.binding.measures = ['NoExiste'];
    await modules.save(pendiente);

    await expect(publicar({ actor: admin, moduleId: modulo.moduleId })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('retirar y rechazar', () => {
  it('devolver a borrador exige un motivo: sin el, nadie sabe que arreglar', async () => {
    const modulo = await readyDraft(colaborador, 'rechazo-sin-motivo');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });

    await expect(
      revertDraft({ actor: admin, moduleId: modulo.moduleId }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('un Administrador retira lo publicado, y deja de verse', async () => {
    const modulo = await readyDraft(colaborador, 'retirable');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    expect(await visibleModuleSlug('retirable', visor)).toBeDefined();

    await revertDraft({
      actor: admin,
      moduleId: modulo.moduleId,
      motivo: 'La medida esta mal calculada para el trimestre en curso.',
    });

    expect(await visibleModuleSlug('retirable', visor)).toBeUndefined();
  });

  it('un Colaborador NO retira lo publicado: afecta a todos los equipos que lo ven', async () => {
    const modulo = await readyDraft(colaborador, 'no-retirable-por-colaborador');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    await expect(
      revertDraft({ actor: colaborador, moduleId: modulo.moduleId, motivo: 'me arrepiento' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('un publicado no se edita en el sitio: primero se retira', async () => {
    const modulo = await readyDraft(colaborador, 'publicado-inmutable');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    await expect(
      saveDraft({ actor: admin, moduleId: modulo.moduleId, cambios: { name: 'Otro nombre' } }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('un publicado tampoco se borra de golpe', async () => {
    const modulo = await readyDraft(colaborador, 'publicado-no-borrable');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    await expect(deleteModule({ actor: admin, moduleId: modulo.moduleId })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('el arbol de navegacion se poda por estado', () => {
  it('un modulo retirado deja de aparecer, y su carpeta vacia con el', async () => {
    const modulo = await readyDraft(colaborador, 'podable');

    const arbol = [
      {
        id: 'carpeta',
        type: 'folder' as const,
        name: 'Carpeta',
        children: [
          {
            id: 'hoja',
            type: 'module' as const,
            moduleRef: { moduleId: modulo.moduleId, slug: modulo.slug, name: modulo.name },
          },
        ],
      },
    ];

    // Es borrador de Ana: ella lo ve en su arbol, un Visor no, y la carpeta que se queda vacia
    // tampoco aparece — una carpeta que no lleva a ningun sitio es peor que no estar.
    expect(await statusPrune(arbol, colaborador)).toHaveLength(1);
    expect(await statusPrune(arbol, visor)).toEqual([]);
  });

  it('un nodo que referencia un modulo inexistente se deja pasar, para que se vea el aviso', async () => {
    const arbol = [
      {
        id: 'hoja-fantasma',
        type: 'module' as const,
        moduleRef: { moduleId: 'no-existe', slug: 'no-existe', name: 'Fantasma' },
      },
    ];
    // De eso avisa `dangling` al Administrador. Ocultarlo aqui taparia el sintoma.
    expect(await statusPrune(arbol, visor)).toHaveLength(1);
  });
});

describe('cada transicion queda en la auditoria', () => {
  it('crear, proponer, publicar y retirar dejan su fila, con quien y por que', async () => {
    const modulo = await readyDraft(colaborador, 'auditado');
    await sendApproval({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });
    await revertDraft({
      actor: admin,
      moduleId: modulo.moduleId,
      motivo: 'Se retira mientras se revisa el calculo.',
    });

    // `auditList` devuelve lo mas reciente primero; aqui interesa el orden del recorrido.
    const dataRows = (await auditList())
      .filter((e) => e.entityId === modulo.moduleId)
      .reverse();
    expect(dataRows.map((f) => f.action)).toEqual(['create', 'update', 'submit', 'publish', 'withdraw']);

    const publication = dataRows.find((f) => f.action === 'publish');
    expect(publication?.actorId).toBe('u-admin');

    // La retirada lleva motivo: es lo que explica a los equipos que lo usaban por que desaparecio.
    expect(dataRows.find((f) => f.action === 'withdraw')?.justification).toContain('calculo');
  });
});

describe('la lista del editor no es el catalogo institucional', () => {
  it('cada persona ve lo publicado, lo suyo, y quien administra ademas lo que espera aprobacion', async () => {
    await readyDraft(colaborador, 'de-ana');
    await readyDraft(collaboratorOther, 'de-otro');
    const propuesto = await readyDraft(colaborador, 'propuesto');
    await sendApproval({ actor: colaborador, moduleId: propuesto.moduleId });

    const slugsDe = async (actor: ModuleActor) =>
      (await visibleModules(actor)).map((m) => m.slug).sort();

    expect(await slugsDe(colaborador)).toContain('de-ana');
    expect(await slugsDe(colaborador)).not.toContain('de-otro');
    expect(await slugsDe(admin)).toContain('propuesto');
    expect(await slugsDe(visor)).not.toContain('propuesto');
  });

  it('seeCan es la unica regla, y no depende de la interfaz', () => {
    const base = { moduleId: 'm', slug: 's', name: 'n', version: 1, pages: [], createdAt: '', updatedAt: '' };
    const borrador: ModuleDefinition = { ...base, status: 'borrador', ownerUserId: 'u-ana' };

    expect(seeCan(borrador, colaborador)).toBe(true);
    expect(seeCan(borrador, admin)).toBe(false);
    expect(seeCan({ ...base, status: 'publicado' }, visor)).toBe(true);
  });
});

describe('banderas por modulo (3.4)', () => {
  /** Un modulo publicado, recorriendo el ciclo completo: borrador, aprobacion, publicado. */
  const publicado = async (slug: string): Promise<ModuleDefinition> => {
    const borrador = await readyDraft(colaborador, slug);
    await sendApproval({ actor: colaborador, moduleId: borrador.moduleId });
    return publicar({ actor: admin, moduleId: borrador.moduleId });
  };

  /*
   * La bandera se prueba contra la MISMA puerta que usa la aplicacion, no simulando el resolutor.
   * `EnvironmentSettings` lee `MODULOS_APAGADOS`, asi que apagar aqui es exactamente lo que
   * hace Azure en produccion: poner la bandera en false.
   */
  const withDisabled = async (disabled: string, prueba: () => Promise<void>) => {
    const before = process.env['MODULOS_APAGADOS'];
    process.env['MODULOS_APAGADOS'] = disabled;
    // El resolutor cachea 30 s: sin reiniciarlo, la prueba leeria la foto de la prueba anterior.
    settingsRestart();
    try {
      await prueba();
    } finally {
      if (before === undefined) delete process.env['MODULOS_APAGADOS'];
      else process.env['MODULOS_APAGADOS'] = before;
      settingsRestart();
    }
  };

  it('un modulo apagado no se SIRVE, aunque su ciclo de vida lo permita', async () => {
    await publicado('apagable');

    expect(await slugServableModule('apagable', visor)).toBeDefined();

    await withDisabled('apagable', async () => {
      expect(await slugServableModule('apagable', visor)).toBeUndefined();
      // Y no es que haya dejado de existir: sigue publicado. Es el interruptor, no el ciclo.
      expect(await visibleModuleSlug('apagable', visor)).toBeDefined();
    });
  });

  it('un modulo apagado SIGUE abriendose en el editor', async () => {
    await publicado('arreglable');
    await withDisabled('arreglable', async () => {
      // Apagar es lo que se hace cuando un modulo da cifras malas. Si el interruptor cerrara
      // tambien la puerta de arreglarlo, habria que reencenderlo en produccion para tocarlo.
      expect(await visibleModuleSlug('arreglable', admin)).toBeDefined();
      expect(await slugServableModule('arreglable', admin)).toBeUndefined();
    });
  });

  it('desaparece del arbol de navegacion', async () => {
    const modulo = await publicado('en-arbol');
    const arbol = [
      {
        id: 'hoja',
        type: 'module' as const,
        moduleRef: { moduleId: modulo.moduleId, slug: modulo.slug, name: modulo.name },
      },
    ];

    expect(await statusPrune(arbol, visor)).toHaveLength(1);
    await withDisabled('en-arbol', async () => {
      // Ocultar el enlace no basta —la ruta tambien lo rechaza— pero dejarlo visible seria
      // ofrecer un modulo que al pulsarlo da 404, que parece una averia.
      expect(await statusPrune(arbol, visor)).toEqual([]);
    });
  });

  it('apagar uno no afecta a los demas', async () => {
    await publicado('vivo');
    await publicado('muerto');
    await withDisabled('muerto', async () => {
      // Es el requisito de 3.4 en una linea: el interruptor es POR MODULO.
      expect(await slugServableModule('vivo', visor)).toBeDefined();
      expect(await slugServableModule('muerto', visor)).toBeUndefined();
    });
  });
});

/**
 * El historial de versiones publicadas — seccion 4.5 y principio 8.
 *
 * El modelo decia versionar desde el primer dia: el comentario de `version` dice literalmente que
 * un objeto publicado nunca se modifica y que se publica una version nueva. Lo que hacia el
 * codigo era `modules.save(...)` con `version: modulo.version + 1`, es decir SOBRESCRIBIR con un
 * contador al lado. Nada guardaba lo anterior, asi que la pregunta «¿que veia la gente el mes
 * pasado?» no tenia respuesta, y volver atras significaba reconstruir el modulo a mano.
 */
/** Un segundo objeto con identidad y sitio propios: repetir `validItem()` choca consigo mismo. */
const secondItem = (): GridItem => {
  const base = validItem();
  return {
    ...base,
    id: 'kpi-dos',
    position: { x: 3, y: 0, w: 3, h: 2 },
    instance: { ...base.instance, instanceId: 'kpi-dos', title: 'Resueltos' },
  };
};

describe('historial de versiones publicadas', () => {
  async function publicado(slug: string): Promise<ModuleDefinition> {
    const borrador = await readyDraft(colaborador, slug);
    await sendApproval({ actor: colaborador, moduleId: borrador.moduleId });
    return publicar({ actor: admin, moduleId: borrador.moduleId });
  }

  it('publicar guarda una foto, y la siguiente publicacion no la pisa', async () => {
    const primera = await publicado('historial-uno');

    await revertDraft({ actor: admin, moduleId: primera.moduleId, motivo: 'falta una medida' });
    const pagina = primera.pages[0];
    if (!pagina) throw new Error('fixture inesperado');
    await saveDraft({
      actor: admin,
      moduleId: primera.moduleId,
      cambios: { pages: [{ ...pagina, items: [validItem(), secondItem()] }] },
    });
    await sendApproval({ actor: admin, moduleId: primera.moduleId });
    const segunda = await publicar({ actor: admin, moduleId: primera.moduleId });

    const historial = await historialDe(admin, primera.moduleId);
    expect(historial.map((v) => v.version)).toEqual([segunda.version, primera.version]);
    // Y la foto vieja conserva SU contenido, no el de ahora: es lo que no hacia el contador.
    const vieja = historial[1];
    expect(vieja?.definition.pages[0]?.items).toHaveLength(1);
    expect(historial[0]?.definition.pages[0]?.items).toHaveLength(2);
  });

  it('el historial dice quien publico cada version', async () => {
    const modulo = await publicado('historial-quien');
    const historial = await historialDe(admin, modulo.moduleId);
    expect(historial[0]?.publishedBy).toBe('u-admin');
  });

  it('solo lo ve quien administra', async () => {
    const modulo = await publicado('historial-permiso');
    await expect(historialDe(colaborador, modulo.moduleId)).rejects.toMatchObject({ status: 403 });
    await expect(historialDe(visor, modulo.moduleId)).rejects.toMatchObject({ status: 403 });
  });

  it('un modulo sin publicar no tiene historial, y eso no es un error', async () => {
    const borrador = await readyDraft(colaborador, 'historial-vacio');
    expect(await historialDe(admin, borrador.moduleId)).toEqual([]);
  });
});

describe('volver a una version anterior', () => {
  /*
   * Devuelve la segunda publicacion y el numero de la PRIMERA.
   *
   * No se escribe `1` a mano: un borrador nace con `version: 1` y publicar la sube, asi que la
   * primera version publicada es la 2. Fijar el numero en la prueba la ataria a esa aritmetica.
   */
  async function conDosVersiones(): Promise<{ segunda: ModuleDefinition; primera: number }> {
    const borrador = await readyDraft(colaborador, 'vuelta-atras');
    await sendApproval({ actor: colaborador, moduleId: borrador.moduleId });
    const primera = await publicar({ actor: admin, moduleId: borrador.moduleId });

    await revertDraft({ actor: admin, moduleId: primera.moduleId, motivo: 'anadir un objeto' });
    const pagina = primera.pages[0];
    if (!pagina) throw new Error('fixture inesperado');
    await saveDraft({
      actor: admin,
      moduleId: primera.moduleId,
      cambios: { pages: [{ ...pagina, items: [validItem(), secondItem()] }] },
    });
    await sendApproval({ actor: admin, moduleId: primera.moduleId });
    return { segunda: await publicar({ actor: admin, moduleId: primera.moduleId }), primera: primera.version };
  }

  /*
   * Lo que NO hace es reactivar la version vieja. 4.5 dice que un objeto publicado no se toca;
   * si volver atras «devolviera» la v1 al presente, el historial dejaria de explicar lo que la
   * gente vio y cuando, que es su unica razon de existir.
   */
  it('publica una version NUEVA con el contenido de la vieja, y lo deja dicho', async () => {
    const { segunda, primera } = await conDosVersiones();
    const restaurado = await restaurarVersion({
      actor: admin,
      moduleId: segunda.moduleId,
      version: primera,
    });

    expect(restaurado.version).toBe(segunda.version + 1);
    expect(restaurado.status).toBe('publicado');
    expect(restaurado.pages[0]?.items).toHaveLength(1);

    const historial = await historialDe(admin, segunda.moduleId);
    expect(historial[0]?.restoredFrom).toBe(primera);
    // Las dos anteriores siguen ahi, intactas.
    expect(historial).toHaveLength(3);
    expect(historial[2]?.definition.pages[0]?.items).toHaveLength(1);
  });

  it('queda en la auditoria, con la version de la que salio', async () => {
    const { segunda, primera } = await conDosVersiones();
    await restaurarVersion({ actor: admin, moduleId: segunda.moduleId, version: primera });

    const eventos = await auditList();
    const vuelta = eventos.find(
      (e) => e.entityId === segunda.moduleId && (e.after as { restauradoDe?: number }).restauradoDe === primera,
    );
    expect(vuelta?.action).toBe('publish');
    expect(vuelta?.actorId).toBe('u-admin');
  });

  it('un Colaborador no puede: publicar sigue siendo del Administrador', async () => {
    const { segunda, primera } = await conDosVersiones();
    await expect(
      restaurarVersion({ actor: colaborador, moduleId: segunda.moduleId, version: primera }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('una version que no existe se rechaza, no se inventa', async () => {
    const { segunda } = await conDosVersiones();
    await expect(
      restaurarVersion({ actor: admin, moduleId: segunda.moduleId, version: 99 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  /*
   * Es la razon de que la comprobacion vaya ANTES de guardar.
   *
   * Una version vieja puede haber dejado de ser publicable sin que nadie la toque: basta con que
   * el esquema retire un campo que uno de sus objetos mapea. Si se guardara primero, el modulo
   * VIVO quedaria reemplazado por una definicion vieja y ademas rota — peor que no haber
   * restaurado, y sin nada en pantalla que lo explicara.
   */
  it('una version que hoy no se puede publicar no llega a tocar lo que esta vivo', async () => {
    const { segunda, primera } = await conDosVersiones();

    // Se rompe la foto vieja en el historial, como haria un campo retirado del esquema.
    const historial = await modules.history(segunda.moduleId);
    const vieja = historial.find((v) => v.version === primera);
    if (!vieja) throw new Error('fixture inesperado');
    const primeraPagina = vieja.definition.pages[0];
    const item = primeraPagina?.items[0];
    if (!primeraPagina || !item) throw new Error('fixture inesperado');
    await borrar(KEY_HISTORY);
    await modules.versionRecord({
      ...vieja,
      definition: {
        ...vieja.definition,
        pages: [
          {
            ...primeraPagina,
            items: [
              {
                ...item,
                instance: {
                  ...item.instance,
                  binding: { ...item.instance.binding, datasetId: 'dataset-que-no-existe' },
                },
              },
            ],
          },
        ],
      },
    });

    await expect(
      restaurarVersion({ actor: admin, moduleId: segunda.moduleId, version: primera }),
    ).rejects.toMatchObject({ status: 422 });

    // Lo que estaba publicado sigue publicado, con su version y su contenido.
    const vivo = await modules.get(segunda.moduleId);
    expect(vivo?.version).toBe(segunda.version);
    expect(vivo?.status).toBe('publicado');
    expect(vivo?.pages[0]?.items).toHaveLength(2);
  });

  it('restaurar la que ya esta publicada no hace nada', async () => {
    const { segunda } = await conDosVersiones();
    await expect(
      restaurarVersion({ actor: admin, moduleId: segunda.moduleId, version: segunda.version }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

/**
 * Subir un objeto de version dentro de un modulo — seccion 4.5.
 *
 * Se prueba contra el catalogo REAL y no contra un objeto inventado, porque lo que importa es que
 * la regla se cumpla con las versiones que existen: `tarjeta-kpi` va por 1.2.0, y cada version
 * anadio una clave —1.1.0 anadio `etiqueta`, 1.2.0 anadio `condicional`—. Es exactamente la forma
 * del caso que preocupa: alguien configuro cosas hace meses y hay que subirle la version sin
 * tocarselas.
 */
describe('subir un objeto de version dentro de un modulo', () => {
  /** Un borrador con un KPI anclado a 1.0.0 y con presentacion configurada a mano. */
  async function conKpiViejo(slug: string): Promise<ModuleDefinition> {
    const creado = await createDraft({ actor: admin, name: `Modulo ${slug}`, slug });
    const pagina = creado.pages[0];
    if (!pagina) throw new Error('fixture inesperado');
    return saveDraft({
      actor: admin,
      moduleId: creado.moduleId,
      cambios: {
        pages: [
          {
            ...pagina,
            items: [
              {
                ...validItem(),
                instance: {
                  ...validItem().instance,
                  version: '1.0.0',
                  presentacion: { acento: 'secundario', subtitulo: 'Al cierre del trimestre' },
                },
              },
            ],
          },
        ],
      },
    });
  }

  it('conserva lo configurado y deja lo nuevo en su defecto', async () => {
    const modulo = await conKpiViejo('subir-kpi');
    const r = await bumpObjectInModule({
      actor: admin,
      moduleId: modulo.moduleId,
      objectId: 'tarjeta-kpi',
      hasta: '1.2.0',
    });

    expect(r.instancias).toBe(1);
    const item = r.module.pages[0]?.items[0];
    expect(item?.instance.version).toBe('1.2.0');
    // Lo que alguien eligio a mano sigue ahi, con el mismo valor.
    expect(item?.instance.presentacion).toEqual({
      acento: 'secundario',
      subtitulo: 'Al cierre del trimestre',
    });
    expect(r.preserved).toEqual(['acento', 'subtitulo']);
    // `etiqueta` y `condicional` son las que anadieron 1.1.0 y 1.2.0: quedan sin escribir.
    expect(r.nuevas).toContain('etiqueta');
    expect(r.nuevas).toContain('condicional');
    expect(r.retiradas).toEqual([]);
  });

  it('un borrador se guarda, no se publica: todavia no lo ve nadie', async () => {
    const modulo = await conKpiViejo('subir-borrador');
    const r = await bumpObjectInModule({
      actor: admin,
      moduleId: modulo.moduleId,
      objectId: 'tarjeta-kpi',
      hasta: '1.2.0',
    });
    expect(r.module.status).toBe('borrador');
    expect(r.module.version).toBe(modulo.version);
  });

  /*
   * Un modulo publicado no se modifica: se publica otra version. Es el mismo principio 8 que
   * ordena el historial, y subir una version de objeto no es una excepcion a el.
   */
  it('un modulo publicado sube publicando una version NUEVA', async () => {
    const modulo = await conKpiViejo('subir-publicado');
    await sendApproval({ actor: admin, moduleId: modulo.moduleId });
    const publicado = await publicar({ actor: admin, moduleId: modulo.moduleId });

    const r = await bumpObjectInModule({
      actor: admin,
      moduleId: modulo.moduleId,
      objectId: 'tarjeta-kpi',
      hasta: '1.2.0',
    });

    expect(r.module.status).toBe('publicado');
    expect(r.module.version).toBe(publicado.version + 1);
    // Y queda en el historial, como cualquier otra publicacion.
    const historial = await historialDe(admin, modulo.moduleId);
    expect(historial[0]?.version).toBe(r.module.version);
  });

  it('subir a la version que ya tiene no hace nada, y lo dice', async () => {
    const modulo = await conKpiViejo('subir-igual');
    await bumpObjectInModule({
      actor: admin,
      moduleId: modulo.moduleId,
      objectId: 'tarjeta-kpi',
      hasta: '1.2.0',
    });
    await expect(
      bumpObjectInModule({
        actor: admin,
        moduleId: modulo.moduleId,
        objectId: 'tarjeta-kpi',
        hasta: '1.2.0',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('un Visor no puede subir nada', async () => {
    const modulo = await conKpiViejo('subir-visor');
    await expect(
      bumpObjectInModule({
        actor: visor,
        moduleId: modulo.moduleId,
        objectId: 'tarjeta-kpi',
        hasta: '1.2.0',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('un objeto que el catalogo no tiene se rechaza', async () => {
    const modulo = await conKpiViejo('subir-inventado');
    await expect(
      bumpObjectInModule({
        actor: admin,
        moduleId: modulo.moduleId,
        objectId: 'objeto-inventado',
        hasta: '1.2.0',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});


describe('editar lo publicado abre una REVISION, no lo despublica (4.1)', () => {
  /** Un modulo publicado, con su version y su foto en el historial. */
  const publicado = async (slug: string): Promise<ModuleDefinition> => {
    const borrador = await readyDraft(colaborador, slug);
    await sendApproval({ actor: colaborador, moduleId: borrador.moduleId });
    return publicar({ actor: admin, moduleId: borrador.moduleId });
  };

  it('el original sigue publicado mientras la revision se edita', async () => {
    /*
     * Es la razon entera de que exista la revision.
     *
     * Antes la unica forma de tocar algo publicado era `revertDraft`, que lo devolvia a borrador:
     * corregir una palabra retiraba el tablero de la navegacion de toda la institucion hasta que
     * alguien aprobara el cambio.
     */
    const original = await publicado('revision-vive');
    const revision = await createRevision({ actor: colaborador, moduleId: original.moduleId });

    expect(revision.moduleId).not.toBe(original.moduleId);
    expect(revision.status).toBe('borrador');
    expect(revision.revisionOf).toBe(original.moduleId);

    const vigente = await modules.get(original.moduleId);
    expect(vigente?.status).toBe('publicado');
    expect(vigente?.version).toBe(original.version);
  });

  it('publicarla escribe SOBRE el original: mismo moduleId y mismo slug', async () => {
    /*
     * Del `moduleId` cuelgan el nodo del arbol, lo concedido a cada equipo y a cada persona y la
     * personalizacion de quien lo haya tocado; del slug, las direcciones que alguien tenga
     * guardadas. Publicar la revision como un modulo nuevo dejaria todo eso apuntando a la version
     * vieja, que ademas seguiria publicada: dos modulos iguales, y el concedido seria el viejo.
     */
    const original = await publicado('revision-encima');
    const revision = await createRevision({ actor: admin, moduleId: original.moduleId });
    await saveDraft({
      actor: admin,
      moduleId: revision.moduleId,
      cambios: { name: 'Nombre cambiado' },
    });
    await sendApproval({ actor: admin, moduleId: revision.moduleId });
    const resultado = await publicar({ actor: admin, moduleId: revision.moduleId });

    expect(resultado.moduleId).toBe(original.moduleId);
    expect(resultado.slug).toBe(original.slug);
    expect(resultado.name).toBe('Nombre cambiado');
    expect(resultado.version).toBe(original.version + 1);
    expect(resultado.revisionOf).toBeUndefined();

    // Y la copia desaparece: dejarla viva serian dos modulos con el mismo contenido, uno de
    // ellos con un slug `-revision` que nadie pidio.
    expect(await modules.get(revision.moduleId)).toBeUndefined();
    expect((await modules.list()).filter((m) => m.slug.endsWith('-revision'))).toHaveLength(0);
  });

  it('solo cabe UNA revision viva por modulo', async () => {
    // Dos serian dos personas editando lo mismo sin saberlo, y la segunda en publicar se llevaria
    // por delante el trabajo de la primera sin que nadie viera el choque.
    const original = await publicado('revision-unica');
    await createRevision({ actor: colaborador, moduleId: original.moduleId });
    await expect(
      createRevision({ actor: admin, moduleId: original.moduleId }),
    ).rejects.toBeInstanceOf(CicloDeVidaError);
  });

  it('un borrador no se revisa: se edita y ya', async () => {
    const borrador = await readyDraft(colaborador, 'revision-de-borrador');
    await expect(
      createRevision({ actor: colaborador, moduleId: borrador.moduleId }),
    ).rejects.toBeInstanceOf(CicloDeVidaError);
  });
});
