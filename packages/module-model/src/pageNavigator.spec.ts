import { describe, expect, it } from 'vitest';
import {
  NAVIGATOR_IS_PANEL,
  NAVIGATOR_KINDS,
  PANEL_BEHAVIORS,
  navigatorByDefault,
  navigatorProblems,
  type PageNavigatorSettings,
} from './pageNavigator';

/** Navegador de pagina — seccion 4.2. */

const paginas = (n: number) => Array.from({ length: n }, (_, i) => ({ pageId: `p${i}` }));

describe('con mas de una pagina, el navegador es OBLIGATORIO', () => {
  it('sin navegador y con dos paginas, no se publica', () => {
    /*
     * Es el caso que motiva el objeto entero.
     *
     * Las paginas existian en el modelo y solo se alcanzaban escribiendo la URL a mano: un modulo
     * de once paginas ensenaba una y escondia diez, y quien lo abria no tenia forma de saber que
     * estaban ahi. El motivo se devuelve escrito porque quien lo lee tiene que poder arreglarlo.
     */
    const problemas = navigatorProblems({ pages: paginas(2) });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/navegador de pagina/);
  });

  it('con UNA pagina no se exige: no hay a donde ir', () => {
    // Un panel lateral de una entrada roba ancho y no lleva a ningun lado.
    expect(navigatorProblems({ pages: paginas(1) })).toEqual([]);
    expect(navigatorProblems({ pages: [] })).toEqual([]);
  });

  it('con navegador elegido, ninguno de los cuatro tipos estorba', () => {
    for (const tipo of NAVIGATOR_KINDS) {
      expect(navigatorProblems({ pages: paginas(3), navigator: navigatorByDefault(tipo) })).toEqual(
        [],
      );
    }
  });

  it('un tipo o un comportamiento inventado se rechaza, diciendo cual', () => {
    // Guardar un tipo que no existe no se descubriria hasta intentar dibujarlo, y entonces la
    // pagina se queda sin navegacion sin que nadie sepa por que.
    expect(
      navigatorProblems({
        pages: paginas(2),
        navigator: { tipo: 'panel-central' as never },
      })[0],
    ).toMatch(/panel-central/);

    expect(
      navigatorProblems({
        pages: paginas(2),
        navigator: { tipo: 'panel-izquierdo', comportamiento: 'flotante' as never },
      })[0],
    ).toMatch(/flotante/);
  });
});

describe('solo los paneles ocupan un lado', () => {
  it('los dos paneles nacen ocupando espacio en la grilla', () => {
    // Es el comportamiento que se espera de un menu lateral permanente, y el unico que no exige
    // que alguien lo despliegue antes de ver a donde puede ir.
    expect(navigatorByDefault('panel-izquierdo').comportamiento).toBe('grilla');
    expect(navigatorByDefault('panel-derecho').comportamiento).toBe('grilla');
  });

  it('las pestanas y el menu no eligen comportamiento, porque no ocupan un lado', () => {
    expect(navigatorByDefault('pestanas-abajo').comportamiento).toBeUndefined();
    expect(navigatorByDefault('menu').comportamiento).toBeUndefined();
    expect(NAVIGATOR_IS_PANEL('pestanas-abajo')).toBe(false);
    expect(NAVIGATOR_IS_PANEL('menu')).toBe(false);
  });

  it('los tres comportamientos siguen siendo tres, y con estos nombres', () => {
    // El CSS los lee de `data-comportamiento`: un nombre que cambie aqui y no alli deja el panel
    // dibujandose con el estilo por defecto y sin que falle nada.
    expect([...PANEL_BEHAVIORS]).toEqual(['grilla', 'drawer', 'overlay']);
  });
});

describe('la seccion de filtros del panel', () => {
  const conFiltros = (navigator: PageNavigatorSettings) =>
    navigatorProblems({ pages: [{ pageId: 'p1' }, { pageId: 'p2' }], navigator });

  it('acepta una seccion completa sobre un panel', () => {
    expect(
      conFiltros({
        tipo: 'panel-izquierdo',
        comportamiento: 'grilla',
        filtros: {
          datasetId: 'casos',
          pickers: [{ fieldName: 'DimTribunal.Distrito', tipo: 'pastillas' }],
        },
      }),
    ).toEqual([]);
  });

  it('rechaza una seccion sin dataset en vez de ignorarla', () => {
    /*
     * El camino de lectura la descarta en silencio cuando le falta el dataset: el panel sale sin
     * filtros y quien los configuro ve un panel normal. Un fallo que no parece un fallo es el que
     * mas tarda en descubrirse, asi que se bloquea la publicacion y se dice por que.
     */
    const problemas = conFiltros({
      tipo: 'panel-izquierdo',
      filtros: { pickers: [{ fieldName: 'DimTribunal.Distrito', tipo: 'pastillas' }] },
    });

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/de que dataset/);
  });

  it('rechaza colgar la seccion de unas pestanas o de un menu', () => {
    for (const tipo of ['pestanas-abajo', 'menu'] as const) {
      const problemas = conFiltros({
        tipo,
        filtros: {
          datasetId: 'casos',
          pickers: [{ fieldName: 'DimTribunal.Distrito', tipo: 'pastillas' }],
        },
      });
      expect(problemas[0], tipo).toMatch(/solo cabe en un panel lateral/);
    }
  });

  it('rechaza dos selectores sobre el mismo campo', () => {
    const problemas = conFiltros({
      tipo: 'panel-izquierdo',
      filtros: {
        datasetId: 'casos',
        pickers: [
          { fieldName: 'DimTribunal.Distrito', tipo: 'pastillas' },
          { fieldName: 'DimTribunal.Distrito', tipo: 'lista' },
        ],
      },
    });

    expect(problemas[0]).toMatch(/mas de un selector/);
  });
});
