import { describe, expect, it } from 'vitest';
import { RENAMES, migrateDefinition } from './migrateDefinition';

/**
 * La migracion de claves guardadas — apartado 2.11.
 *
 * El fixture es una definicion en la forma VIEJA, con la estructura que el almacen escribe de
 * verdad: paginas, objetos, instancias y complementos anidados. Comprobarla contra un objeto
 * plano inventado no diria nada, porque lo que la migracion tiene que acertar es la RUTA.
 */

/** Un modulo tal y como estaba guardado antes del renombrado. */
const guardado = () => ({
  moduleId: 'mod-antiguo',
  slug: 'antiguo',
  name: 'Antiguo',
  status: 'publicado',
  version: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  pages: [
    {
      pageId: 'pag-1',
      slug: 'general',
      name: 'General',
      items: [
        {
          id: 'kpi',
          position: { x: 0, y: 0, w: 3, h: 2 },
          instance: {
            instanceId: 'kpi',
            objectId: 'tarjeta-kpi',
            version: '1.0.0',
            binding: { datasetId: 'd', dimensions: [], measures: ['M'] },
            presentacion: { icono: 'balanza', acento: 'primario' },
            attachments: [
              {
                instance: {
                  instanceId: 'pie',
                  objectId: 'pie-de-pagina',
                  version: '1.0.0',
                  binding: { datasetId: 'd', dimensions: [], measures: [] },
                  presentacion: { texto: 'Fuente: el caché' },
                },
              },
            ],
          },
        },
      ],
    },
  ],
});

/** El primer objeto del modulo, con su tipo aflojado: esto es JSON, no una definicion tipada. */
const instanciaDe = (m: ReturnType<typeof guardado>): Record<string, unknown> =>
  (m.pages[0]?.items[0]?.instance ?? {}) as unknown as Record<string, unknown>;

const adjuntaDe = (m: ReturnType<typeof guardado>): Record<string, unknown> =>
  (m.pages[0]?.items[0]?.instance.attachments?.[0]?.instance ?? {}) as unknown as Record<
    string,
    unknown
  >;

describe('migrar las claves de una definicion guardada', () => {
  it('renombra la presentacion de un objeto y la de su complemento', () => {
    const migrado = migrateDefinition(guardado());

    const instancia = instanciaDe(migrado);
    expect(instancia['presentation']).toEqual({ icono: 'balanza', acento: 'primario' });
    expect(instancia).not.toHaveProperty('presentacion');

    // El complemento tiene su propia presentacion, y esta dos niveles mas adentro.
    const adjunta = adjuntaDe(migrado);
    expect(adjunta['presentation']).toEqual({ texto: 'Fuente: el caché' });
    expect(adjunta).not.toHaveProperty('presentacion');
  });

  /*
   * Sin esto, la migracion no se podria dejar puesta: habria que ejecutarla una vez y acordarse de
   * quitarla, y el dia que alguien restaurara una copia de seguridad vieja no estaria.
   */
  it('es idempotente: lo ya migrado pasa sin cambiar', () => {
    const una = migrateDefinition(guardado());
    const dos = migrateDefinition(JSON.parse(JSON.stringify(una)) as ReturnType<typeof guardado>);

    expect(JSON.stringify(dos)).toBe(JSON.stringify(una));
  });

  /*
   * Puede llegar con las DOS: guardada por una version nueva, leida por una vieja que no la
   * conocia, y vuelta a guardar. La que vale es la nueva, que es la que escribio el codigo mas
   * reciente; la vieja se descarta en vez de pisarla.
   */
  it('con las dos claves puestas, gana la nueva', () => {
    const mezclado = guardado() as unknown as Record<string, unknown>;
    const instancia = instanciaDe(mezclado as ReturnType<typeof guardado>);
    instancia['presentation'] = { icono: 'reloj' };

    migrateDefinition(mezclado);

    expect(instancia['presentation']).toEqual({ icono: 'reloj' });
    expect(instancia).not.toHaveProperty('presentacion');
  });

  it('no toca lo que la ruta no alcanza', () => {
    /*
     * `presentacion` suelta en la raiz no es la de una instancia. La tabla declara la ruta a
     * proposito: el mismo nombre en dos sitios suele querer decir dos cosas, y renombrarlos a la
     * vez porque se llaman igual es el error que una migracion tiene que no cometer.
     */
    const ajeno = { presentacion: 'algo', pages: [] } as Record<string, unknown>;
    migrateDefinition(ajeno);

    expect(ajeno['presentacion']).toBe('algo');
  });

  it('cada renombrado declara de donde a donde, sin repetir destino en la misma ruta', () => {
    const vistos = new Set<string>();
    for (const r of RENAMES) {
      const clave = `${r.path.join('/')}::${r.to}`;
      // Dos origenes al mismo destino en la misma ruta serian dos claves pisandose.
      expect(vistos.has(clave)).toBe(false);
      vistos.add(clave);
      expect(r.from).not.toBe(r.to);
    }
  });
});
