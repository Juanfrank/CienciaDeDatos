import { beforeEach, describe, expect, it } from 'vitest';
import type { GridItem, ModuleDefinition } from '@app/module-model';
import { applyPersonalization } from '@app/module-model';
import {
  PersonalizacionInvalidaError,
  descartarPersonalizacion,
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
  await descartarPersonalizacion('u-ana', modulo.moduleId);
  await descartarPersonalizacion('u-beto', modulo.moduleId);
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
    await descartarPersonalizacion('u-ana', modulo.moduleId);

    expect(await readPersonalization('u-ana', modulo.moduleId)).toBeUndefined();
    // Y la definicion institucional nunca se toco: sigue con sus tres objetos.
    expect(modulo.pages[0]?.items).toHaveLength(3);
  });
});

describe('lo que una personalizacion NO puede hacer (4.6)', () => {
  it('no puede nombrar un objeto que el modulo no tiene', async () => {
    await expect(
      savePersonalization({ userId: 'u-ana', module: modulo, hiddenItemIds: ['inventado'] }),
    ).rejects.toBeInstanceOf(PersonalizacionInvalidaError);
  });

  it('no puede ocultarlo todo: una pantalla vacia parece una averia', async () => {
    await expect(
      savePersonalization({
        userId: 'u-ana',
        module: modulo,
        hiddenItemIds: ['uno', 'dos', 'tres'],
      }),
    ).rejects.toBeInstanceOf(PersonalizacionInvalidaError);
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
