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
const buscar = (objectId: string) => registro.get(objectId);

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };

const instancia = (parcial: Partial<ObjectInstance> = {}): ObjectInstance => ({
  instanceId: 'i1',
  objectId: 'barras',
  version: '1.0.0',
  binding: { datasetId: 'casos', dimensions: [DISTRITO], measures: ['CasosPendientes'] },
  ...parcial,
});

describe('validateAttachments', () => {
  it('acepta un objeto con sus dos complementos bien configurados', () => {
    const problemas = validateAttachments(
      instancia({
        attachments: [
          { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Que es esto.' },
          { instanceId: 'a2', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'subobjeto' },
        ],
      }),
      buscar,
    );

    expect(problemas).toEqual([]);
  });

  it('rechaza colocar un complemento como objeto independiente de la rejilla', () => {
    const problemas = validateAttachments(
      instancia({ objectId: 'tooltip-explicativo', attachments: [] }),
      buscar,
    );

    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.problem).toMatch(/no puede colocarse como objeto independiente/);
  });

  it('rechaza adjuntar un objeto que no es complemento', () => {
    const problemas = validateAttachments(
      instancia({
        attachments: [
          // Un grafico de barras adjunto a otro grafico no es un complemento: es otro objeto.
          { instanceId: 'a1', objectId: 'barras', version: '1.0.0' } as never,
        ],
      }),
      buscar,
    );

    expect(problemas[0]?.problem).toMatch(/no es un complemento/);
  });

  it('rechaza un complemento que no existe en el repositorio', () => {
    const problemas = validateAttachments(
      instancia({
        attachments: [{ instanceId: 'a1', objectId: 'tooltip-inventado', version: '1.0.0' } as never],
      }),
      buscar,
    );

    expect(problemas[0]?.kind).toBe('campo-inexistente');
  });

  it('rechaza dos complementos del mismo tipo en un mismo objeto', () => {
    const problemas = validateAttachments(
      instancia({
        attachments: [
          { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Uno.' },
          { instanceId: 'a2', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Dos.' },
        ],
      }),
      buscar,
    );

    expect(problemas[0]?.problem).toMatch(/Solo se admite uno de cada tipo/);
  });

  it('rechaza el alcance de subobjeto cuando el anfitrion no mapea ninguna dimension', () => {
    // Una tarjeta KPI no tiene categorias: no hay subobjeto por el que desglosar, y ofrecerlo
    // daria un emergente que siempre muestra lo mismo que el alcance de objeto.
    const problemas = validateAttachments(
      instancia({
        objectId: 'tarjeta-kpi',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
        attachments: [{ instanceId: 'a1', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'subobjeto' }],
      }),
      buscar,
    );

    expect(problemas[0]?.problem).toMatch(/no hay subobjeto por el que desglosar/);
  });

  it('acepta el alcance de objeto en una tarjeta sin dimensiones', () => {
    const problemas = validateAttachments(
      instancia({
        objectId: 'tarjeta-kpi',
        binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
        attachments: [{ instanceId: 'a1', objectId: 'tabla-de-datos', version: '1.0.0', scope: 'objeto' }],
      }),
      buscar,
    );

    expect(problemas).toEqual([]);
  });
});

describe('attachmentOf', () => {
  it('devuelve el complemento del tipo pedido, ya estrechado', () => {
    const objeto = instancia({
      attachments: [
        { instanceId: 'a1', objectId: 'tooltip-explicativo', version: '1.0.0', text: 'Explicacion.' },
      ],
    });

    expect(attachmentOf(objeto, 'tooltip-explicativo')?.text).toBe('Explicacion.');
    expect(attachmentOf(objeto, 'tabla-de-datos')).toBeUndefined();
  });

  it('un objeto sin complementos no obliga a comprobar el array antes', () => {
    expect(attachmentOf(instancia(), 'tooltip-explicativo')).toBeUndefined();
  });
});
