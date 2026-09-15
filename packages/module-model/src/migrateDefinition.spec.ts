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
            presentacion: {
              icono: 'balanza',
              acento: 'primario',
              resaltado: true,
              colorDeResaltado: 'error',
              mostrarTitulo: false,
              mostrarIcono: true,
              etiquetasDeDato: { mostrar: true },
              coloresDeSerie: [0, 3],
              // Los ejes, que son la primera clave con HIJOS: se migra el padre y su contenido.
              ejes: {
                mostrarY: false,
                tituloY: 'Casos',
                tituloY2: 'Tasa',
                desdeCero: true,
                minimoY: 10,
                maximoY: 90,
                escala: 'logaritmica',
                // Una que ya estaba en ingles: la migracion no la toca y tiene que seguir ahi.
                gridlines: false,
              },
              leyenda: 'abajo',
              referencias: [{ valor: 100, etiqueta: 'Meta' }],
              condicional: { rules: [] },
              multiplos: { gridColumns: 2 },
            },
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
    expect(instancia['presentation']).toBeDefined();
    expect(instancia).not.toHaveProperty('presentacion');

    // El complemento tiene su propia presentacion, y esta dos niveles mas adentro.
    const adjunta = adjuntaDe(migrado);
    expect(adjunta['presentation']).toEqual({ texto: 'Fuente: el caché' });
    expect(adjunta).not.toHaveProperty('presentacion');
  });

  /**
   * Y las claves de DENTRO de la presentacion, una a una.
   *
   * Esta es la que faltaba, y el hueco importaba. `claves-guardadas.spec.ts` recorre `RENAMES` y
   * comprueba que ninguna clave ya renombrada se vuelva a escribir con su nombre viejo — pero
   * renombrar en el codigo y OLVIDAR la fila de la tabla le pasa por delante sin que se entere:
   * sin fila no hay nada que recorrer. Se probo quitando la fila de `resaltado` y la guarda seguia
   * en verde.
   *
   * Aqui no: el fixture guarda la clave vieja y esta prueba exige leerla con la nueva. Sin su fila
   * en la tabla, el valor no llega y la prueba enrojece, que es lo que le pasaria a un modulo de
   * verdad guardado antes del renombrado.
   */
  it('renombra tambien las claves de dentro de la presentacion', () => {
    const instancia = instanciaDe(migrateDefinition(guardado()));
    const p = instancia['presentation'] as Record<string, unknown>;

    expect(p).toEqual({
      icono: 'balanza',
      acento: 'primario',
      highlight: true,
      highlightColor: 'error',
      showTitle: false,
      showIcon: true,
      datumLabels: { mostrar: true },
      seriesColors: [0, 3],
      axes: {
        showY: false,
        yTitle: 'Casos',
        y2Title: 'Tasa',
        fromZero: true,
        yMin: 10,
        yMax: 90,
        scale: 'logaritmica',
        gridlines: false,
      },
      legend: 'abajo',
      // Lo de DENTRO de la raya sigue en espanol, y a proposito: `valor` y `etiqueta` son de las
      // palabras mas repetidas del codigo y entran en su propia tanda.
      references: [{ valor: 100, etiqueta: 'Meta' }],
      conditional: { rules: [] },
      multiples: { gridColumns: 2 },
    });
  });

  /*
   * El orden de la tabla, que es lo unico de ella que se puede romper sin que nada avise.
   *
   * Las filas se aplican en orden. Si la de `ejes` -> `axes` fuera DESPUES de las siete de dentro,
   * esas siete buscarian en `presentation.axes` cuando lo guardado todavia dice `ejes`, no
   * encontrarian nada —renombrar lo que no esta no falla— y el objeto quedaria migrado con su
   * contenido sin migrar: el eje en ingles y sus siete claves en espanol dentro.
   */
  it('y migra el padre ANTES que sus hijos, o el eje se quedaria a medias', () => {
    const conEjes = (r: (typeof RENAMES)[number]) => r.path.includes('axes');
    const padre = RENAMES.findIndex((r) => r.from === 'ejes');
    const primerHijo = RENAMES.findIndex(conEjes);

    expect(padre).toBeGreaterThanOrEqual(0);
    expect(primerHijo).toBeGreaterThan(padre);
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
