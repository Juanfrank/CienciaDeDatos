import { beforeEach, describe, expect, it } from 'vitest';
import type { GridItem, ModuleDefinition } from '@app/module-model';
import { CLAVE_MODULOS, modulos } from './almacenModulos';
import { borrar } from './almacenCompartido';
import { limpiarAuditoria, listarAuditoria } from './auditoria';
import { reiniciarConfiguracion } from './configuracion';
import {
  type ActorDeModulo,
  CicloDeVidaError,
  borrarModulo,
  crearBorrador,
  devolverABorrador,
  enviarAAprobacion,
  guardarBorrador,
  modulosVisibles,
  moduloServiblePorSlug,
  moduloVisiblePorSlug,
  podarPorEstado,
  publicar,
  puedeVer,
} from './cicloDeVida';

/** Ciclo de vida de un modulo — seccion 4.1. */

const admin: ActorDeModulo = { userId: 'u-admin', role: 'administrador' };
const colaborador: ActorDeModulo = { userId: 'u-ana', role: 'colaborador' };
const otroColaborador: ActorDeModulo = { userId: 'u-otro', role: 'colaborador' };
const visor: ActorDeModulo = { userId: 'u-beto', role: 'visor' };

/** Un objeto valido, para que el modulo no quede bloqueado por estar vacio de contenido. */
const itemValido = (): GridItem => ({
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

async function borradorListo(actor: ActorDeModulo, slug: string): Promise<ModuleDefinition> {
  const creado = await crearBorrador({ actor, name: `Modulo ${slug}`, slug });
  const pagina = creado.pages[0];
  if (!pagina) throw new Error('fixture inesperado');
  return guardarBorrador({
    actor,
    moduleId: creado.moduleId,
    cambios: { pages: [{ ...pagina, items: [itemValido()] }] },
  });
}

beforeEach(async () => {
  // Se parte de la semilla en cada prueba: el almacen es compartido y persiste entre ficheros.
  await borrar(CLAVE_MODULOS);
  await limpiarAuditoria();
});

describe('crear un borrador', () => {
  it('un Colaborador puede, y nace como borrador suyo', async () => {
    const modulo = await crearBorrador({ actor: colaborador, name: 'Mi analisis', slug: 'mi-analisis' });

    expect(modulo.status).toBe('borrador');
    expect(modulo.ownerUserId).toBe('u-ana');
    // Una pagina vacia, no cero paginas: cero paginas no se puede abrir.
    expect(modulo.pages).toHaveLength(1);
    expect(modulo.pages[0]?.items).toEqual([]);
  });

  it('un Visor no puede: crear modulos no esta en su fila de la matriz (4.10.1)', async () => {
    await expect(
      crearBorrador({ actor: visor, name: 'Intento', slug: 'intento' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('el slug tiene que servir como URL, porque lo es (4.11)', async () => {
    await expect(
      crearBorrador({ actor: colaborador, name: 'Con espacios', slug: 'Con Espacios' }),
    ).rejects.toBeInstanceOf(CicloDeVidaError);
  });

  it('no se puede repetir un slug ya usado', async () => {
    await crearBorrador({ actor: colaborador, name: 'Primero', slug: 'repetido' });
    await expect(
      crearBorrador({ actor: admin, name: 'Segundo', slug: 'repetido' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('un borrador es de quien lo escribe', () => {
  it('otro Colaborador no lo puede editar, aunque tenga el permiso general', async () => {
    const modulo = await borradorListo(colaborador, 'borrador-ajeno');

    await expect(
      guardarBorrador({
        actor: otroColaborador,
        moduleId: modulo.moduleId,
        cambios: { name: 'Reescrito por otro' },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ni lo ve: un borrador ajeno no se resuelve por slug', async () => {
    await borradorListo(colaborador, 'invisible');

    expect(await moduloVisiblePorSlug('invisible', otroColaborador)).toBeUndefined();
    expect(await moduloVisiblePorSlug('invisible', visor)).toBeUndefined();
    expect(await moduloVisiblePorSlug('invisible', colaborador)).toBeDefined();
  });

  it('un Administrador tampoco: no ve el borrador ajeno, luego no lo edita', async () => {
    const modulo = await borradorListo(colaborador, 'ni-el-admin');

    expect(await moduloVisiblePorSlug('ni-el-admin', admin)).toBeUndefined();
    await expect(
      guardarBorrador({ actor: admin, moduleId: modulo.moduleId, cambios: { name: 'Corregido' } }),
    ).rejects.toMatchObject({ status: 403 });

    // Lo que si puede es borrar uno abandonado, que no exige leerlo.
    await expect(borrarModulo({ actor: admin, moduleId: modulo.moduleId })).resolves.toBeUndefined();
  });
});

describe('borrador -> pendiente-de-aprobacion -> publicado', () => {
  it('el flujo completo lo recorren dos personas distintas: propone una, publica otra', async () => {
    const modulo = await borradorListo(colaborador, 'flujo-completo');

    const enviado = await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });
    expect(enviado.status).toBe('pendiente-de-aprobacion');

    const publicado = await publicar({ actor: admin, moduleId: modulo.moduleId });
    expect(publicado.status).toBe('publicado');
    // Sube de version: se publica una version nueva, no se muta la anterior (principio 8).
    expect(publicado.version).toBe(modulo.version + 1);
    // Y deja de pertenecer a una persona: pertenece a la institucion (4.1).
    expect(publicado.ownerUserId).toBeUndefined();
  });

  it('un Colaborador NO puede publicar lo que el mismo propuso', async () => {
    const modulo = await borradorListo(colaborador, 'autopublicacion');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });

    await expect(publicar({ actor: colaborador, moduleId: modulo.moduleId })).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it('no se puede saltar la aprobacion: de borrador a publicado directamente, no', async () => {
    const modulo = await borradorListo(colaborador, 'sin-escalas');

    await expect(publicar({ actor: admin, moduleId: modulo.moduleId })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('mientras espera aprobacion, lo ve su autor y quien tiene que aprobarlo, nadie mas', async () => {
    const modulo = await borradorListo(colaborador, 'en-revision');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });

    expect(await moduloVisiblePorSlug('en-revision', colaborador)).toBeDefined();
    expect(await moduloVisiblePorSlug('en-revision', admin)).toBeDefined();
    expect(await moduloVisiblePorSlug('en-revision', visor)).toBeUndefined();
    expect(await moduloVisiblePorSlug('en-revision', otroColaborador)).toBeUndefined();
  });
});

describe('la puerta de publicacion: findPublishBlockers, por fin invocado', () => {
  it('un modulo con una medida inexistente no se puede proponer', async () => {
    const creado = await crearBorrador({ actor: colaborador, name: 'Roto', slug: 'roto' });
    const pagina = creado.pages[0];
    if (!pagina) throw new Error('fixture inesperado');

    const roto = itemValido();
    roto.instance.binding.measures = ['MedidaQueNoExiste'];
    await guardarBorrador({
      actor: colaborador,
      moduleId: creado.moduleId,
      cambios: { pages: [{ ...pagina, items: [roto] }] },
    });

    // 422: la peticion se entiende y es coherente; lo que falla es el contenido del modulo.
    const fallo = await enviarAAprobacion({
      actor: colaborador,
      moduleId: creado.moduleId,
    }).catch((e: unknown) => e);

    expect(fallo).toMatchObject({ status: 422 });
    expect((fallo as CicloDeVidaError).detail).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'objeto-roto' })]),
    );
  });

  it('tampoco se publica algo que se rompio DESPUES de proponerse', async () => {
    const modulo = await borradorListo(colaborador, 'roto-despues');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });

    // Se rompe por debajo, escribiendo en el almacen como lo haria otra instancia.
    const pendiente = await modulos.get(modulo.moduleId);
    if (!pendiente?.pages[0]?.items[0]) throw new Error('fixture inesperado');
    pendiente.pages[0].items[0].instance.binding.measures = ['NoExiste'];
    await modulos.save(pendiente);

    await expect(publicar({ actor: admin, moduleId: modulo.moduleId })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('retirar y rechazar', () => {
  it('devolver a borrador exige un motivo: sin el, nadie sabe que arreglar', async () => {
    const modulo = await borradorListo(colaborador, 'rechazo-sin-motivo');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });

    await expect(
      devolverABorrador({ actor: admin, moduleId: modulo.moduleId }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('un Administrador retira lo publicado, y deja de verse', async () => {
    const modulo = await borradorListo(colaborador, 'retirable');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    expect(await moduloVisiblePorSlug('retirable', visor)).toBeDefined();

    await devolverABorrador({
      actor: admin,
      moduleId: modulo.moduleId,
      motivo: 'La medida esta mal calculada para el trimestre en curso.',
    });

    expect(await moduloVisiblePorSlug('retirable', visor)).toBeUndefined();
  });

  it('un Colaborador NO retira lo publicado: afecta a todos los equipos que lo ven', async () => {
    const modulo = await borradorListo(colaborador, 'no-retirable-por-colaborador');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    await expect(
      devolverABorrador({ actor: colaborador, moduleId: modulo.moduleId, motivo: 'me arrepiento' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('un publicado no se edita en el sitio: primero se retira', async () => {
    const modulo = await borradorListo(colaborador, 'publicado-inmutable');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    await expect(
      guardarBorrador({ actor: admin, moduleId: modulo.moduleId, cambios: { name: 'Otro nombre' } }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('un publicado tampoco se borra de golpe', async () => {
    const modulo = await borradorListo(colaborador, 'publicado-no-borrable');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });

    await expect(borrarModulo({ actor: admin, moduleId: modulo.moduleId })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('el arbol de navegacion se poda por estado', () => {
  it('un modulo retirado deja de aparecer, y su carpeta vacia con el', async () => {
    const modulo = await borradorListo(colaborador, 'podable');

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
    expect(await podarPorEstado(arbol, colaborador)).toHaveLength(1);
    expect(await podarPorEstado(arbol, visor)).toEqual([]);
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
    expect(await podarPorEstado(arbol, visor)).toHaveLength(1);
  });
});

describe('cada transicion queda en la auditoria', () => {
  it('crear, proponer, publicar y retirar dejan su fila, con quien y por que', async () => {
    const modulo = await borradorListo(colaborador, 'auditado');
    await enviarAAprobacion({ actor: colaborador, moduleId: modulo.moduleId });
    await publicar({ actor: admin, moduleId: modulo.moduleId });
    await devolverABorrador({
      actor: admin,
      moduleId: modulo.moduleId,
      motivo: 'Se retira mientras se revisa el calculo.',
    });

    // `listarAuditoria` devuelve lo mas reciente primero; aqui interesa el orden del recorrido.
    const filas = (await listarAuditoria())
      .filter((e) => e.entityId === modulo.moduleId)
      .reverse();
    expect(filas.map((f) => f.action)).toEqual(['create', 'update', 'submit', 'publish', 'withdraw']);

    const publicacion = filas.find((f) => f.action === 'publish');
    expect(publicacion?.actorId).toBe('u-admin');

    // La retirada lleva motivo: es lo que explica a los equipos que lo usaban por que desaparecio.
    expect(filas.find((f) => f.action === 'withdraw')?.justification).toContain('calculo');
  });
});

describe('la lista del editor no es el catalogo institucional', () => {
  it('cada persona ve lo publicado, lo suyo, y quien administra ademas lo que espera aprobacion', async () => {
    await borradorListo(colaborador, 'de-ana');
    await borradorListo(otroColaborador, 'de-otro');
    const propuesto = await borradorListo(colaborador, 'propuesto');
    await enviarAAprobacion({ actor: colaborador, moduleId: propuesto.moduleId });

    const slugsDe = async (actor: ActorDeModulo) =>
      (await modulosVisibles(actor)).map((m) => m.slug).sort();

    expect(await slugsDe(colaborador)).toContain('de-ana');
    expect(await slugsDe(colaborador)).not.toContain('de-otro');
    expect(await slugsDe(admin)).toContain('propuesto');
    expect(await slugsDe(visor)).not.toContain('propuesto');
  });

  it('puedeVer es la unica regla, y no depende de la interfaz', () => {
    const base = { moduleId: 'm', slug: 's', name: 'n', version: 1, pages: [], createdAt: '', updatedAt: '' };
    const borrador: ModuleDefinition = { ...base, status: 'borrador', ownerUserId: 'u-ana' };

    expect(puedeVer(borrador, colaborador)).toBe(true);
    expect(puedeVer(borrador, admin)).toBe(false);
    expect(puedeVer({ ...base, status: 'publicado' }, visor)).toBe(true);
  });
});

describe('banderas por modulo (3.4)', () => {
  /** Un modulo publicado, recorriendo el ciclo completo: borrador, aprobacion, publicado. */
  const publicado = async (slug: string): Promise<ModuleDefinition> => {
    const borrador = await borradorListo(colaborador, slug);
    await enviarAAprobacion({ actor: colaborador, moduleId: borrador.moduleId });
    return publicar({ actor: admin, moduleId: borrador.moduleId });
  };

  /*
   * La bandera se prueba contra la MISMA puerta que usa la aplicacion, no simulando el resolutor.
   * `ConfiguracionDeEntorno` lee `MODULOS_APAGADOS`, asi que apagar aqui es exactamente lo que
   * hace Azure en produccion: poner la bandera en false.
   */
  const conApagados = async (apagados: string, prueba: () => Promise<void>) => {
    const antes = process.env['MODULOS_APAGADOS'];
    process.env['MODULOS_APAGADOS'] = apagados;
    // El resolutor cachea 30 s: sin reiniciarlo, la prueba leeria la foto de la prueba anterior.
    reiniciarConfiguracion();
    try {
      await prueba();
    } finally {
      if (antes === undefined) delete process.env['MODULOS_APAGADOS'];
      else process.env['MODULOS_APAGADOS'] = antes;
      reiniciarConfiguracion();
    }
  };

  it('un modulo apagado no se SIRVE, aunque su ciclo de vida lo permita', async () => {
    await publicado('apagable');

    expect(await moduloServiblePorSlug('apagable', visor)).toBeDefined();

    await conApagados('apagable', async () => {
      expect(await moduloServiblePorSlug('apagable', visor)).toBeUndefined();
      // Y no es que haya dejado de existir: sigue publicado. Es el interruptor, no el ciclo.
      expect(await moduloVisiblePorSlug('apagable', visor)).toBeDefined();
    });
  });

  it('un modulo apagado SIGUE abriendose en el editor', async () => {
    await publicado('arreglable');
    await conApagados('arreglable', async () => {
      // Apagar es lo que se hace cuando un modulo da cifras malas. Si el interruptor cerrara
      // tambien la puerta de arreglarlo, habria que reencenderlo en produccion para tocarlo.
      expect(await moduloVisiblePorSlug('arreglable', admin)).toBeDefined();
      expect(await moduloServiblePorSlug('arreglable', admin)).toBeUndefined();
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

    expect(await podarPorEstado(arbol, visor)).toHaveLength(1);
    await conApagados('en-arbol', async () => {
      // Ocultar el enlace no basta —la ruta tambien lo rechaza— pero dejarlo visible seria
      // ofrecer un modulo que al pulsarlo da 404, que parece una averia.
      expect(await podarPorEstado(arbol, visor)).toEqual([]);
    });
  });

  it('apagar uno no afecta a los demas', async () => {
    await publicado('vivo');
    await publicado('muerto');
    await conApagados('muerto', async () => {
      // Es el requisito de 3.4 en una linea: el interruptor es POR MODULO.
      expect(await moduloServiblePorSlug('vivo', visor)).toBeDefined();
      expect(await moduloServiblePorSlug('muerto', visor)).toBeUndefined();
    });
  });
});
