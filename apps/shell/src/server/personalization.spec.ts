import { beforeEach, describe, expect, it } from 'vitest';
import type { GridItem, ModuleDefinition } from '@app/module-model';
import { applyPersonalization } from '@app/module-model';
import {
  PersonalizationInvalidError,
  personalizationDiscard,
  savePersonalization,
  readPersonalization,
} from './personalization';

/** Personalizacion por usuario — seccion 4.6. */

const item = (id: string): GridItem => ({
  id,
  position: { x: 0, y: 0, w: 3, h: 2 },
  instance: {
    instanceId: id,
    objectId: 'tarjeta-kpi',
    version: '1.0.0',
    title: `Objeto ${id}`,
    binding: { datasetId: 'd', dimensions: [], measures: ['M'] },
  },
});

const modulo: ModuleDefinition = {
  moduleId: 'mod-prueba',
  slug: 'prueba',
  name: 'Prueba',
  status: 'publicado',
  version: 1,
  createdAt: '',
  updatedAt: '',
  pages: [
    { pageId: 'p', slug: 'general', name: 'General', items: [item('uno'), item('dos'), item('tres')] },
  ],
};

beforeEach(async () => {
  await personalizationDiscard('u-ana', modulo.moduleId);
  await personalizationDiscard('u-beto', modulo.moduleId);
});

describe('guardar y leer', () => {
  it('lo guardado se lee, y solo lo ve quien lo guardo', async () => {
    await savePersonalization({ userId: 'u-ana', module: modulo, hiddenItemIds: ['dos'] });

    expect((await readPersonalization('u-ana', modulo.moduleId))?.hiddenItemIds).toEqual(['dos']);
    // La de otra persona no existe: la personalizacion es por usuario, no del modulo.
    expect(await readPersonalization('u-beto', modulo.moduleId)).toBeUndefined();
  });

  it('descartarla devuelve a la vista institucional', async () => {
    await savePersonalization({ userId: 'u-ana', module: modulo, hiddenItemIds: ['dos'] });
    await personalizationDiscard('u-ana', modulo.moduleId);

    expect(await readPersonalization('u-ana', modulo.moduleId)).toBeUndefined();
    // Y la definicion institucional nunca se toco: sigue con sus tres objetos.
    expect(modulo.pages[0]?.items).toHaveLength(3);
  });
});

describe('lo que una personalizacion NO puede hacer (4.6)', () => {
  it('no puede nombrar un objeto que el modulo no tiene', async () => {
    await expect(
      savePersonalization({ userId: 'u-ana', module: modulo, hiddenItemIds: ['inventado'] }),
    ).rejects.toBeInstanceOf(PersonalizationInvalidError);
  });

  it('no puede ocultarlo todo: una pantalla vacia parece una averia', async () => {
    await expect(
      savePersonalization({
        userId: 'u-ana',
        module: modulo,
        hiddenItemIds: ['uno', 'dos', 'tres'],
      }),
    ).rejects.toBeInstanceOf(PersonalizationInvalidError);
  });

  it('no puede tocar la logica de calculo, aunque lo intente por el cuerpo crudo', async () => {
    // El tipo no admite esto; lo que llega por la red, si. De ahi la comprobacion en ejecucion.
    const fallo = await savePersonalization({
      userId: 'u-ana',
      module: modulo,
      hiddenItemIds: [],
      crudo: { ocultos: [], measures: ['OtraMedida'] },
    }).catch((e: unknown) => e);

    expect((fallo as Error).message).toContain('4.6');
  });

  it('tampoco cambiando el dataset', async () => {
    const fallo = await savePersonalization({
      userId: 'u-ana',
      module: modulo,
      hiddenItemIds: [],
      crudo: { ocultos: [], datasetId: 'otro-dataset' },
    }).catch((e: unknown) => e);

    expect((fallo as Error).message).toContain('4.6');
  });
});

describe('colocar los objetos en la propia vista (2.2)', () => {
  /*
   * El modelo admitia `positionOverrides` desde el principio y `applyPersonalization` los
   * aplicaba; lo que faltaba era el gesto, y con el, lo que el servidor tiene que comprobar.
   */
  const enFila: ModuleDefinition = {
    ...modulo,
    pages: [
      {
        pageId: 'p',
        slug: 'general',
        name: 'General',
        items: [
          { ...item('uno'), position: { x: 0, y: 0, w: 4, h: 2 } },
          { ...item('dos'), position: { x: 4, y: 0, w: 4, h: 2 } },
        ],
      },
    ],
  };

  it('guarda la posicion y la vista la aplica', async () => {
    const guardada = await savePersonalization({
      userId: 'u-ana',
      module: enFila,
      positionOverrides: { dos: { x: 0, y: 2, w: 8, h: 3 } },
    });

    const { module: view, isPersonalized } = applyPersonalization(enFila, guardada);
    expect(isPersonalized).toBe(true);
    expect(view.pages[0]?.items[1]?.position).toEqual({ x: 0, y: 2, w: 8, h: 3 });
    // Y el binding sigue intacto: colocar es presentacion, no calculo.
    expect(view.pages[0]?.items[1]?.instance.binding.measures).toEqual(['M']);
  });

  /*
   * El caso que obliga a validar la disposicion ENTERA y no cada posicion suelta: puesta encima de
   * «uno», la posicion de «dos» es perfectamente valida por si misma.
   */
  it('no deja poner un objeto encima de otro', async () => {
    await expect(
      savePersonalization({
        userId: 'u-ana',
        module: enFila,
        positionOverrides: { dos: { x: 0, y: 0, w: 4, h: 2 } },
      }),
    ).rejects.toBeInstanceOf(PersonalizationInvalidError);
  });

  it('tampoco fuera de la rejilla', async () => {
    await expect(
      savePersonalization({
        userId: 'u-ana',
        module: enFila,
        positionOverrides: { dos: { x: 10, y: 0, w: 6, h: 2 } },
      }),
    ).rejects.toBeInstanceOf(PersonalizationInvalidError);
  });

  /*
   * Lo que ya estaba roto no es de quien personaliza. El modulo de arriba tiene sus tres objetos
   * en la misma celda, asi que la disposicion institucional ya se solapa: si eso bloqueara, nadie
   * podria ocultar nada en un modulo mal publicado —y ocultar es justo lo que lo arregla—.
   */
  it('lo que ya estaba mal en el modulo no impide personalizar', async () => {
    await expect(
      savePersonalization({ userId: 'u-ana', module: modulo, hiddenItemIds: ['dos'] }),
    ).resolves.toBeDefined();
  });

  it('ocultar no borra la colocacion, ni colocar los ocultos', async () => {
    /*
     * Son dos gestos en dos pantallas, y ninguna conoce lo de la otra: la que coloca no puede
     * enumerar los objetos ocultos porque ya no los ve. Guardando el registro entero cada vez,
     * cada gesto habria borrado el anterior sin que nadie lo pidiera.
     */
    await savePersonalization({ userId: 'u-ana', module: enFila, hiddenItemIds: ['uno'] });
    await savePersonalization({
      userId: 'u-ana',
      module: enFila,
      positionOverrides: { dos: { x: 0, y: 0, w: 4, h: 2 } },
    });

    const guardada = await readPersonalization('u-ana', enFila.moduleId);
    expect(guardada?.hiddenItemIds).toEqual(['uno']);
    expect(guardada?.positionOverrides['dos']).toEqual({ x: 0, y: 0, w: 4, h: 2 });
  });
});

describe('aplicada sobre la definicion', () => {
  it('oculta lo elegido y marca la vista como personalizada', async () => {
    const guardada = await savePersonalization({
      userId: 'u-ana',
      module: modulo,
      hiddenItemIds: ['dos'],
    });

    const { module: view, isPersonalized } = applyPersonalization(modulo, guardada);

    expect(isPersonalized).toBe(true);
    expect(view.pages[0]?.items.map((i) => i.id)).toEqual(['uno', 'tres']);
    // El binding llega intacto: la personalizacion no puede tocar lo que mide un indicador.
    expect(view.pages[0]?.items[0]?.instance.binding.measures).toEqual(['M']);
  });

  it('sin personalizacion, la vista es la institucional y se anuncia como tal', () => {
    const { module: view, isPersonalized } = applyPersonalization(modulo, undefined);
    expect(isPersonalized).toBe(false);
    expect(view.pages[0]?.items).toHaveLength(3);
  });

  it('una personalizacion guardada que no oculta nada NO marca la vista como personalizada', async () => {
    const guardada = await savePersonalization({
      userId: 'u-ana',
      module: modulo,
      hiddenItemIds: [],
    });

    // Importa: si marcara, todo el que abriera el dialogo y guardara sin cambiar nada acabaria
    // con sus exportaciones rotuladas "vista personalizada" sin haber personalizado nada.
    expect(applyPersonalization(modulo, guardada).isPersonalized).toBe(false);
  });
});
