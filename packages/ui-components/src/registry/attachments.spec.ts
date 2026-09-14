import { describe, expect, it } from 'vitest';
import { ObjectRegistry } from './ObjectRegistry';
import {
  ATTACHMENT_BY_DEFAULT,
  ATTACHMENT_IDS,
  attachmentOf,
  validateAttachments,
} from './attachments';
import { initialCatalog } from './catalog';
import type { ObjectInstance } from './types';

/**
 * Un complemento no es un objeto independiente. Estas pruebas fijan los dos errores simetricos
 * que eso deja abiertos, y que tienen que detectarse al GUARDAR y no al dibujar (4.2).
 */

const registro = new ObjectRegistry(initialCatalog);
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

describe('la configuracion propia de cada complemento', () => {
  const con = (attachment: unknown, parcial: Partial<ObjectInstance> = {}) =>
    validateAttachments(
      objectInstance({ ...parcial, attachments: [attachment as never] }),
      search,
    );

  describe('filtro de visualizacion', () => {
    it('acepta un campo que el objeto YA mapea, sea dimension o medida', () => {
      expect(
        con({
          instanceId: 'a1',
          objectId: 'filtro-de-visualizacion',
          version: '1.0.0',
          fieldName: 'DimTribunal.Distrito',
        }),
      ).toEqual([]);
      expect(
        con({
          instanceId: 'a1',
          objectId: 'filtro-de-visualizacion',
          version: '1.0.0',
          fieldName: 'CasosPendientes',
        }),
      ).toEqual([]);
    });

    it('rechaza un campo que el objeto no mapea', () => {
      /*
       * Es la regla que separa este complemento de un segmentador.
       *
       * Acotar por algo que el objeto no ensena deja un filtro cuyo efecto no se ve: se mueve un
       * control y la visual cambia sin que nada explique por que.
       */
      const problems = con({
        instanceId: 'a1',
        objectId: 'filtro-de-visualizacion',
        version: '1.0.0',
        fieldName: 'DimTiempo.Trimestre',
      });

      expect(problems).toHaveLength(1);
      expect(problems[0]?.problem).toMatch(/no esta mapeado en este objeto/);
    });

    it('rechaza el complemento en un objeto que no mapea nada', () => {
      const problems = con(
        {
          instanceId: 'a1',
          objectId: 'filtro-de-visualizacion',
          version: '1.0.0',
          fieldName: 'lo-que-sea',
        },
        {
          objectId: 'cuadro-de-texto',
          binding: { datasetId: 'casos', dimensions: [], measures: [] },
        },
      );

      expect(problems[0]?.problem).toMatch(/no mapea ninguno/);
    });
  });

  describe('pie de pagina', () => {
    it('acepta una referencia a una medida mapeada', () => {
      expect(
        con({
          instanceId: 'a1',
          objectId: 'pie-de-pagina',
          version: '1.0.0',
          texto: 'Total: {{1}} casos.',
        }),
      ).toEqual([]);
    });

    it('rechaza una referencia a una posicion que no existe', () => {
      // El objeto mapea UNA medida: `{{2}}` no apunta a nada. Sin esto, el pie se dibuja con la
      // llave literal dentro y parece un error de quien lo lee, no de quien lo configuro.
      const problems = con({
        instanceId: 'a1',
        objectId: 'pie-de-pagina',
        version: '1.0.0',
        texto: 'Total: {{2}}.',
      });

      expect(problems).toHaveLength(1);
      expect(problems[0]?.problem).toMatch(/esa posicion no existe/);
    });

    it('rechaza un pie vacio', () => {
      const problems = con({
        instanceId: 'a1',
        objectId: 'pie-de-pagina',
        version: '1.0.0',
        texto: '   ',
      });

      expect(problems[0]?.problem).toMatch(/no tiene texto/);
    });
  });

  describe('paginado', () => {
    it('acepta un tamano de pagina entero y positivo sobre un objeto con categorias', () => {
      expect(
        con({
          instanceId: 'a1',
          objectId: 'paginado',
          version: '1.0.0',
          porPagina: 10,
          selector: true,
          coletilla: 'abajo',
        }),
      ).toEqual([]);
    });

    it('rechaza un tamano de pagina que no es un entero de uno o mas', () => {
      for (const porPagina of [0, -5, 2.5]) {
        const problems = con({
          instanceId: 'a1',
          objectId: 'paginado',
          version: '1.0.0',
          porPagina,
        });
        expect(problems[0]?.problem, String(porPagina)).toMatch(/entero de 1 o mas/);
      }
    });

    it('rechaza paginar un objeto sin dimensiones: una cifra sola no se pagina', () => {
      const problems = con(
        { instanceId: 'a1', objectId: 'paginado', version: '1.0.0', porPagina: 5 },
        {
          objectId: 'tarjeta-kpi',
          binding: { datasetId: 'casos', dimensions: [], measures: ['CasosPendientes'] },
        },
      );

      expect(problems[0]?.problem).toMatch(/no hay nada que partir/);
    });
  });
});

describe('ATTACHMENT_BY_DEFAULT', () => {
  it('cubre TODOS los complementos del modelo', () => {
    // El `Record` es exhaustivo por tipo, asi que esto no puede fallar sin que antes falle el
    // compilador. Se comprueba igual porque es la lista de la que come el editor: si alguna vez
    // se rellenara a mano, un tipo nuevo se quedaria sin forma de adjuntarse.
    expect(ATTACHMENT_IDS).toHaveLength(Object.keys(ATTACHMENT_BY_DEFAULT).length);
    expect(ATTACHMENT_IDS).toContain('paginado');
  });

  it('cada complemento NACE valido sobre un objeto normal', () => {
    /*
     * Lo que se fija es que adjuntar no rompa el modulo.
     *
     * Un complemento que nace invalido obliga a quien pulsa el boton a arreglar algo que todavia
     * no ha configurado, y mientras tanto el modulo no se puede publicar por haber hecho clic.
     */
    const host = objectInstance();
    for (const objectId of ATTACHMENT_IDS) {
      const nacido = ATTACHMENT_BY_DEFAULT[objectId]({
        instanceId: `${objectId}-i1`,
        version: '1.0.0',
        host,
      });
      const problems = validateAttachments({ ...host, attachments: [nacido] }, search);
      expect(problems, objectId).toEqual([]);
    }
  });
});
