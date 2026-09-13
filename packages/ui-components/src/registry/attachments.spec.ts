import { describe, expect, it } from 'vitest';
import { ObjectRegistry } from './ObjectRegistry';
import { attachmentOf, validateAttachments } from './attachments';
import { catalogoInicial } from './catalog';
import type { ObjectInstance } from './types';

/**
 * Un complemento no es un objeto independiente. Estas pruebas fijan los dos errores simetricos
 * que eso deja abiertos, y que tienen que detectarse al GUARDAR y no al dibujar (4.2).
 */

const registro = new ObjectRegistry(catalogoInicial);
const search = (objectId: string) => registro.get(objectId);

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };

const objectInstance = (parcial: Partial<ObjectInstance> = {}): ObjectInstance => ({
  instanceId: 'i1',
  objectId: 'barras',
  version: '1.0.0',
  binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CasosPendientes'] },
  ...parcial,
});

describe('validateAttachments', () => {
  it('acepta un objeto con sus dos complementos bien configurados', () => {
    const problems = validateAttachments(
      objectInstance({
        attachments: [
          { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Que es esto.' },
          { instanceId: 'a2', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'subobjeto' },
        ],
      }),
      search,
    );

    expect(problems).toEqual([]);
  });

  it('rechaza colocar un complemento como objeto independiente de la rejilla', () => {
    const problems = validateAttachments(
      objectInstance({ objectId: 'tooltip-explicativo', attachments: [] }),
      search,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.problem).toMatch(/no puede colocarse como objeto independiente/);
  });

  it('rechaza adjuntar un objeto que no es complemento', () => {
    const problems = validateAttachments(
      objectInstance({
        attachments: [
          // Un grafico de barras adjunto a otro grafico no es un complemento: es otro objeto.
          { instanceId: 'a1', objectId: 'barras', version: '1.0.0' } as never,
        ],
      }),
      search,
    );

    expect(problems[0]?.problem).toMatch(/no es un complemento/);
  });

  it('rechaza un complemento que no existe en el repositorio', () => {
    const problems = validateAttachments(
      objectInstance({
        attachments: [{ instanceId: 'a1', objectId: 'tooltip-inventado', version: '1.0.0' } as never],
      }),
      search,
    );

    expect(problems[0]?.kind).toBe('campo-inexistente');
  });

  it('rechaza dos complementos del mismo tipo en un mismo objeto', () => {
    const problems = validateAttachments(
      objectInstance({
        attachments: [
          { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Uno.' },
          { instanceId: 'a2', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Dos.' },
        ],
      }),
      search,
    );

    expect(problems[0]?.problem).toMatch(/Solo se admite uno de cada tipo/);
  });

  it('rechaza el alcance de subobjeto cuando el anfitrion no mapea ninguna dimension', () => {
    // Una tarjeta KPI no tiene categorias: no hay subobjeto por el que desglosar, y ofrecerlo
    // daria un emergente que siempre muestra lo mismo que el alcance de objeto.
    const problems = validateAttachments(
      objectInstance({
        objectId: 'tarjeta-kpi',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
        attachments: [{ instanceId: 'a1', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'subobjeto' }],
      }),
      search,
    );

    expect(problems[0]?.problem).toMatch(/no hay subobjeto por el que desglosar/);
  });

  it('acepta el alcance de objeto en una tarjeta sin dimensiones', () => {
    const problems = validateAttachments(
      objectInstance({
        objectId: 'tarjeta-kpi',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
        attachments: [{ instanceId: 'a1', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'objeto' }],
      }),
      search,
    );

    expect(problems).toEqual([]);
  });
});

describe('attachmentOf', () => {
  it('devuelve el complemento del tipo pedido, ya estrechado', () => {
    const objeto = objectInstance({
      attachments: [
        { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Explicacion.' },
      ],
    });

    expect(attachmentOf(objeto, 'tooltip-explicativo')?.text).toBe('Explicacion.');
    expect(attachmentOf(objeto, 'tabla-de-datos')).toBeUndefined();
  });

  it('un objeto sin complementos no obliga a comprobar el array antes', () => {
    expect(attachmentOf(objectInstance(), 'tooltip-explicativo')).toBeUndefined();
  });
});
