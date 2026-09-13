import type { ModuleDefinition } from '@app/module-model';
import { modulos } from './almacenModulos';

/**
 * Definiciones de modulo de arranque.
 *
 * En produccion las produce el editor de modulos (4.2) y viven en la base de gobierno. Aqui se
 * declaran como dato para que el shell tenga algo que renderizar contra el seed, y para que las
 * pruebas de punta a punta tengan modulos reales que abrir.
 *
 * Los `moduleId` coinciden con los del arbol del seed: es lo que permite que la resolucion de
 * ambito (4.10.4) encuentre el modulo en la organizacion general y aplique la herencia de
 * carpetas.
 */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };
const TRIMESTRE = { table: 'DimTiempo', field: 'Trimestre' };
const DATASET = 'casos-por-distrito-trimestre';

/**
 * El enlace de un objeto que no lee datos.
 *
 * El `datasetId` vacio no es un hueco por rellenar: es la declaracion de que este objeto no pide
 * nada al cache. `datasetsConsumedBy` lo filtra, y por eso un modulo lleno de elementos no aparece
 * degradado por un dataset inexistente.
 */
const SIN_DATOS = { datasetId: '', dimensions: [], measures: [] };

export const modulosDemo: ModuleDefinition[] = [
  {
    moduleId: 'casos-pendientes',
    slug: 'casos-pendientes',
    name: 'Casos pendientes',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'kpi-pendientes',
            position: { x: 0, y: 0, w: 3, h: 2 },
            instance: {
              instanceId: 'kpi-pendientes',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Casos pendientes',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
              /*
               * La primera instancia del seed que configura su presentacion.
               *
               * Sirve de ejemplo vivo de lo que se puede hacer desde el editor sin tocar codigo:
               * el mismo objeto `tarjeta-kpi` con otro icono, otro acento y otro rotulo es otra
               * tarjeta, sin publicar ningun objeto nuevo.
               */
              presentacion: {
                icono: 'expediente',
                acento: 'primario',
                resaltado: true,
                subtitulo: 'Al cierre del trimestre',
                formato: { unidad: 'casos' },
              },
              attachments: [
                {
                  instanceId: 'tooltip-kpi-pendientes',
                  objectId: 'tooltip-explicativo',
                  version: '1.0.0',
                  text:
                    'Suma de casos que siguen abiertos al cierre del trimestre, sobre los ' +
                    'distritos y materias que su ambito de acceso permite ver.',
                },
                // Sin dimensiones mapeadas no hay subobjeto por el que desglosar: el alcance
                // tiene que ser de objeto, y la validacion lo rechazaria de otro modo.
                {
                  instanceId: 'datos-kpi-pendientes',
                  objectId: 'tabla-de-datos',
                  version: '1.0.0',
                  scope: 'objeto',
                },
              ],
            },
          },
          {
            id: 'kpi-ingresados',
            position: { x: 3, y: 0, w: 3, h: 2 },
            instance: {
              instanceId: 'kpi-ingresados',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Ingresados vs resueltos',
              binding: {
                datasetId: DATASET,
                dimensions: [],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentacion: {
                icono: 'balanza',
                acento: 'terciario',
                resaltado: true,
                subtitulo: 'Frente al periodo anterior',
              },
            },
          },
          /*
           * Panel de filtros en vez de dos segmentadores.
           *
           * Antes esta celda era un segmentador de una sola dimension, y filtrar tambien por
           * distrito habria pedido otra celda con otro objeto identico salvo por el campo. El
           * panel agrupa las dos y deja elegir COMO se filtra cada una: materia tiene dos valores
           * y cabe en pastillas; distrito crece con el ambito de quien mira y se lleva mejor con
           * un desplegable.
           */
          {
            id: 'filtros',
            position: { x: 6, y: 0, w: 6, h: 2 },
            instance: {
              instanceId: 'filtros',
              objectId: 'panel-de-filtros',
              version: '1.0.0',
              title: 'Filtros',
              binding: { datasetId: DATASET, dimensions: [MATERIA, DISTRITO], measures: [] },
              presentacion: { icono: 'filtro', acento: 'secundario' },
              configuracion: {
                objectId: 'panel-de-filtros',
                selectores: [
                  { campo: 'DimTribunal.Materia', tipo: 'pastillas', etiqueta: 'Materia' },
                  { campo: 'DimTribunal.Distrito', tipo: 'desplegable', etiqueta: 'Distrito' },
                ],
              },
            },
          },
          {
            id: 'barras-distrito',
            position: { x: 0, y: 2, w: 6, h: 4 },
            instance: {
              instanceId: 'barras-distrito',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Pendientes por distrito',
              binding: { datasetId: DATASET, dimensions: [DISTRITO], measures: ['CasosPendientes'] },
              attachments: [
                {
                  instanceId: 'tooltip-barras-distrito',
                  objectId: 'tooltip-explicativo',
                  version: '1.0.0',
                  text:
                    'Cada barra agrega los cuatro trimestres y todas las materias de ese ' +
                    'distrito. Pulse una barra para filtrar el resto del modulo.',
                },
                {
                  instanceId: 'datos-barras-distrito',
                  objectId: 'tabla-de-datos',
                  version: '1.0.0',
                  scope: 'subobjeto',
                },
              ],
            },
          },
          {
            id: 'matriz-distrito-materia',
            position: { x: 6, y: 2, w: 6, h: 4 },
            instance: {
              instanceId: 'matriz-distrito-materia',
              objectId: 'matriz',
              // 1.1.0: distrito y, dentro, materia — cruzados por trimestre.
              //
              // El unico objeto del seed con jerarquia, y esta aqui por el mismo motivo por el que
              // el grafico de barras lleva dos medidas: los niveles, los subtotales y el plegado
              // estaban escritos y no habia ningun objeto que los ejerciera contra datos reales.
              version: '1.1.0',
              title: 'Materia por trimestre',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA, TRIMESTRE, DISTRITO],
                measures: ['CasosPendientes'],
                /*
                 * Materia y, dentro, trimestre. Cruzado por distrito.
                 *
                 * La primera version anidaba distrito y dentro materia, y se veia un solo padre:
                 * el ambito de este modulo restringe a un distrito, asi que la jerarquia quedaba
                 * demostrada sobre un arbol de una rama. Materia tiene varias dentro del mismo
                 * ambito, asi que los niveles y los subtotales se ven de verdad — y el eje de
                 * columnas ensena de paso el efecto del RLS: una sola columna.
                 */
                ranuras: {
                  filas: ['DimTribunal.Materia', 'DimTiempo.Trimestre'],
                  columnas: ['DimTribunal.Distrito'],
                  valores: ['CasosPendientes'],
                },
              },
            },
          },
          /*
           * El unico objeto del seed con MAS DE UNA medida mapeada, y esta aqui a proposito.
           *
           * Toda la galeria mapeaba una sola medida, asi que ningun grafico llegaba a usar la
           * paleta categorica ni la leyenda: el codigo que reparte ocho colores entre series
           * nunca se ejecutaba contra datos reales, y un fallo ahi no se habria visto. Ademas es
           * la comparacion que el modulo pedia —lo que entra frente a lo que sale— y estaba solo
           * en la tabla del final.
           */
          /*
           * El segmentador se queda, al lado del panel, y sobre la MISMA dimension.
           *
           * No es un resto del pasado: los dos escriben el mismo parametro de la URL, asi que
           * elegir «Penal» en cualquiera de ellos mueve al otro sin que ninguno sepa que el otro
           * existe. Es la demostracion de que 4.11 no es una formalidad —el estado vive en la
           * direccion, no en los componentes—, y el sitio donde se notaria si algun dia alguien
           * mete estado local en un filtro.
           */
          {
            id: 'segmentador-materia',
            position: { x: 0, y: 6, w: 4, h: 2 },
            instance: {
              instanceId: 'segmentador-materia',
              objectId: 'segmentador',
              version: '1.0.0',
              title: 'Materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: [] },
              presentacion: { icono: 'filtro', acento: 'neutro' },
            },
          },
          {
            id: 'barras-flujo',
            position: { x: 0, y: 8, w: 12, h: 4 },
            instance: {
              instanceId: 'barras-flujo',
              objectId: 'barras',
              // La unica instancia del seed fijada a una version distinta de 1.0.0, y sirve de
              // prueba viva de 4.5: las demas siguen en 1.0.0 y no se enteran de que existe.
              version: '1.1.0',
              title: 'Ingresados y resueltos por materia',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
            },
          },
          {
            id: 'tabla-detalle',
            position: { x: 0, y: 12, w: 12, h: 4 },
            instance: {
              instanceId: 'tabla-detalle',
              objectId: 'tabla',
              // 1.1.0: ordenable por encabezado. La galeria del seed usa la ultima version de
              // cada objeto a proposito — es lo que hace que las capacidades nuevas se ejerzan
              // contra datos reales en vez de quedarse escritas y sin llamar.
              version: '1.1.0',
              title: 'Detalle',
              binding: {
                datasetId: DATASET,
                dimensions: [DISTRITO, MATERIA, TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    moduleId: 'audiencias',
    slug: 'audiencias',
    name: 'Audiencias',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'roto-demo',
            position: { x: 0, y: 0, w: 6, h: 3 },
            instance: {
              instanceId: 'roto-demo',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Objeto con un campo que ya no existe',
              // Deliberadamente roto: 'CampoRetirado' no esta en el dataset. Sirve para
              // comprobar en vivo lo que exige 4.2 — marcarlo visualmente roto, no fallar en
              // silencio ni omitirlo, y que el resto del modulo siga funcionando.
              binding: {
                datasetId: DATASET,
                dimensions: [{ table: 'DimTribunal', field: 'CampoRetirado' }],
                measures: ['CasosPendientes'],
              },
            },
          },
          {
            id: 'barras-materia',
            position: { x: 6, y: 0, w: 6, h: 3 },
            instance: {
              instanceId: 'barras-materia',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Resueltos por materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosResueltos'] },
            },
          },
        ],
      },
    ],
  },
  {
    moduleId: 'casos-este',
    slug: 'casos-este',
    name: 'Casos pendientes Este',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'kpi-este',
            position: { x: 0, y: 0, w: 4, h: 2 },
            instance: {
              instanceId: 'kpi-este',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Pendientes',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
            },
          },
          {
            id: 'barras-este',
            position: { x: 4, y: 0, w: 8, h: 4 },
            instance: {
              instanceId: 'barras-este',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Por materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosPendientes'] },
            },
          },
        ],
      },
    ],
  },
  {
    moduleId: 'estadisticas',
    slug: 'estadisticas',
    name: 'Estadisticas nacionales',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'kpi-nacional',
            position: { x: 0, y: 0, w: 4, h: 2 },
            instance: {
              instanceId: 'kpi-nacional',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Total nacional',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
            },
          },
        ],
      },
    ],
  },
  /*
   * Modulo de muestra de los objetos que no leen datos.
   *
   * Existe para que cada elemento y cada contenedor tenga un sitio donde verse funcionando, y no
   * solo un tipo de TypeScript y una prueba. Es tambien lo que hace que una regresion en ellos se
   * note: las pruebas de navegador abren este modulo, asi que un contenedor que deje de dibujarse
   * rompe la suite en vez de descubrirse el dia que alguien lo use.
   */
  {
    moduleId: 'composicion',
    slug: 'composicion',
    name: 'Composicion',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-elementos',
        slug: 'elementos',
        name: 'Elementos',
        items: [
          {
            id: 'el-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'el-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo de seccion',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Texto, formas y separadores',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'el-texto',
            position: { x: 0, y: 1, w: 5, h: 3 },
            instance: {
              instanceId: 'el-texto',
              objectId: 'cuadro-de-texto',
              version: '1.0.0',
              title: 'Nota metodologica',
              binding: SIN_DATOS,
              presentacion: { icono: 'texto', acento: 'terciario' },
              configuracion: {
                objectId: 'cuadro-de-texto',
                cuadroDeTexto: {
                  parrafos: [
                    { texto: 'Como leer este modulo', nivel: 1 },
                    {
                      texto:
                        'Las cifras salen del dataset cacheado y estan filtradas por el ambito de quien mira.',
                    },
                    { texto: 'Los elementos de esta pagina no leen datos: componen.', vineta: true },
                  ],
                },
              },
            },
          },
          {
            id: 'el-forma-rect',
            position: { x: 5, y: 1, w: 3, h: 3 },
            instance: {
              instanceId: 'el-forma-rect',
              objectId: 'forma',
              version: '1.0.0',
              title: 'Rectangulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'forma',
                forma: {
                  forma: 'rectangulo',
                  relleno: 'primario',
                  opacidad: 12,
                  radio: 12,
                  texto: 'Rectangulo',
                },
              },
            },
          },
          {
            id: 'el-forma-circulo',
            position: { x: 8, y: 1, w: 2, h: 3 },
            instance: {
              instanceId: 'el-forma-circulo',
              objectId: 'forma',
              version: '1.0.0',
              title: 'Circulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'forma',
                forma: { forma: 'circulo', relleno: 'secundario', opacidad: 25 },
              },
            },
          },
          {
            id: 'el-forma-triangulo',
            position: { x: 10, y: 1, w: 2, h: 3 },
            instance: {
              instanceId: 'el-forma-triangulo',
              objectId: 'forma',
              version: '1.0.0',
              title: 'Triangulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'forma',
                forma: { forma: 'triangulo', relleno: 'terciario', opacidad: 50 },
              },
            },
          },
          {
            id: 'el-linea',
            position: { x: 0, y: 4, w: 12, h: 1 },
            instance: {
              instanceId: 'el-linea',
              objectId: 'linea-divisoria',
              version: '1.0.0',
              title: 'Separador',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'linea-divisoria',
                lineaDivisoria: { orientacion: 'horizontal', estilo: 'discontinua', grosor: 2, color: 'atenuado' },
              },
            },
          },
          {
            id: 'el-titulo-flujo',
            position: { x: 0, y: 5, w: 12, h: 1 },
            instance: {
              instanceId: 'el-titulo-flujo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo centrado',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Conexiones',
                  posicionDelTexto: 'centro',
                  linea: 'ambos',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'atenuado' },
                },
              },
            },
          },
          {
            id: 'flujo-origen',
            position: { x: 0, y: 6, w: 3, h: 2 },
            instance: {
              instanceId: 'flujo-origen',
              objectId: 'tarjeta-kpi',
              version: '1.1.0',
              title: 'Ingresados',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosIngresados'] },
              presentacion: { icono: 'expediente', etiqueta: { texto: 'en el periodo', posicion: 'debajo' } },
            },
          },
          {
            /*
             * El conector ocupa la celda ENTRE los dos, pero no se dibuja dentro de ella: se mide
             * contra la rejilla y se traza de borde a borde. La celda solo dice donde vive el
             * objeto en la disposicion guardada.
             */
            id: 'flujo-conexion',
            position: { x: 3, y: 6, w: 3, h: 2 },
            instance: {
              instanceId: 'flujo-conexion',
              objectId: 'conexion',
              version: '1.0.0',
              title: 'Conexion',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'conexion',
                conexion: {
                  desde: 'flujo-origen',
                  hasta: 'flujo-destino',
                  trazado: 'angulo',
                  extremoFinal: 'flecha',
                  texto: 'se resuelven',
                  estiloDeLinea: { estilo: 'solida', grosor: 2, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'flujo-destino',
            position: { x: 6, y: 6, w: 3, h: 2 },
            instance: {
              instanceId: 'flujo-destino',
              objectId: 'tarjeta-kpi',
              version: '1.1.0',
              title: 'Resueltos',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosResueltos'] },
              presentacion: { icono: 'balanza', acento: 'secundario', etiqueta: { texto: 'en el periodo', posicion: 'debajo' } },
            },
          },
          {
            id: 'el-linea-vertical',
            position: { x: 9, y: 6, w: 1, h: 2 },
            instance: {
              instanceId: 'el-linea-vertical',
              objectId: 'linea-divisoria',
              version: '1.0.0',
              title: 'Separador vertical',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'linea-divisoria',
                lineaDivisoria: { orientacion: 'vertical', estilo: 'solida', grosor: 2, color: 'primario' },
              },
            },
          },
          {
            id: 'el-forma-flecha',
            position: { x: 10, y: 6, w: 2, h: 2 },
            instance: {
              instanceId: 'el-forma-flecha',
              objectId: 'forma',
              version: '1.0.0',
              title: 'Flecha',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'forma',
                forma: { forma: 'flecha', relleno: 'primario', opacidad: 75 },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-graficos',
        slug: 'graficos',
        name: 'Graficos',
        items: [
          {
            id: 'g-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'g-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Lo mismo, sin personalizar y personalizado',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'g-crudo',
            position: { x: 0, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'g-crudo',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Por defecto',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentacion: { subtitulo: 'Sin tocar nada' },
            },
          },
          {
            id: 'g-vestido',
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'g-vestido',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Personalizado',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              /*
               * Todo lo que este bloque configura se podia elegir en el editor y no llegaba al
               * grafico: la leyenda y las etiquetas se guardaban y el constructor de opciones no
               * las leia. Sirve de comprobacion en vivo de que ahora si.
               */
              presentacion: {
                subtitulo: 'Leyenda a la derecha, cifras, sin cuadricula, ordenado por valor',
                leyenda: 'derecha',
                etiquetasDeDato: true,
                ejes: { cuadricula: false, tituloY: 'Casos' },
                orden: { por: 'valor', direccion: 'desc' },
              },
            },
          },
          {
            id: 'g-lineas',
            position: { x: 0, y: 5, w: 12, h: 4 },
            instance: {
              instanceId: 'g-lineas',
              objectId: 'lineas',
              version: '1.1.0',
              title: 'Evolucion por trimestre',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentacion: {
                subtitulo: 'Leyenda arriba y cifra sobre cada punto',
                leyenda: 'arriba',
                etiquetasDeDato: true,
                ejes: { tituloY: 'Casos' },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-familia',
        slug: 'familia',
        name: 'Barras y area',
        items: [
          {
            id: 'f-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'f-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'La misma medida en seis formas',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'f-col-apiladas',
            position: { x: 0, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'f-col-apiladas',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Columnas apiladas',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentacion: { subtitulo: 'El total y de que se compone', leyenda: 'abajo', apilado: 'apilado' },
            },
          },
          {
            id: 'f-col-100',
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'f-col-100',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Columnas al 100 %',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentacion: { subtitulo: 'La composicion, no la magnitud', leyenda: 'abajo', apilado: 'porcentaje' },
            },
          },
          {
            id: 'f-barras',
            position: { x: 0, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'f-barras',
              objectId: 'barras-horizontales',
              version: '1.0.0',
              title: 'Barras horizontales',
              binding: {
                datasetId: DATASET,
                dimensions: [DISTRITO],
                measures: ['CasosPendientes'],
              },
              presentacion: { subtitulo: 'Los nombres largos caben enteros', leyenda: 'abajo', etiquetasDeDato: true },
            },
          },
          {
            id: 'f-barras-100',
            position: { x: 6, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'f-barras-100',
              objectId: 'barras-horizontales',
              version: '1.0.0',
              title: 'Barras al 100 %',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentacion: { subtitulo: 'Reparto por materia', leyenda: 'abajo', apilado: 'porcentaje' },
            },
          },
          {
            id: 'f-area',
            position: { x: 0, y: 9, w: 6, h: 4 },
            instance: {
              instanceId: 'f-area',
              objectId: 'area',
              version: '1.0.0',
              title: 'Area',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentacion: { subtitulo: 'Volumen a lo largo del tiempo', leyenda: 'abajo' },
            },
          },
          {
            id: 'f-area-apilada',
            position: { x: 6, y: 9, w: 6, h: 4 },
            instance: {
              instanceId: 'f-area-apilada',
              objectId: 'area',
              version: '1.0.0',
              title: 'Area apilada',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentacion: { subtitulo: 'De que se compone el total', leyenda: 'abajo', apilado: 'apilado' },
            },
          },
        ],
      },
      {
        pageId: 'p-contenedores',
        slug: 'contenedores',
        name: 'Contenedores',
        items: [
          {
            id: 'cont-simple',
            position: { x: 0, y: 0, w: 6, h: 4 },
            instance: {
              instanceId: 'cont-simple',
              objectId: 'contenedor-simple',
              version: '1.0.0',
              title: 'Contenedor simple',
              binding: SIN_DATOS,
              presentacion: { icono: 'contenedor', subtitulo: 'Rejilla propia de seis columnas' },
              configuracion: {
                objectId: 'contenedor-simple',
                simple: { columnas: 6 },
                paneles: [
                  {
                    panelId: 'p1',
                    nombre: 'Contenido',
                    items: [
                      {
                        id: 'cs-kpi',
                        position: { x: 0, y: 0, w: 3, h: 2 },
                        instance: {
                          instanceId: 'cs-kpi',
                          objectId: 'tarjeta-kpi',
                          version: '1.0.0',
                          title: 'Pendientes',
                          binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
                        },
                      },
                      {
                        id: 'cs-texto',
                        position: { x: 3, y: 0, w: 3, h: 2 },
                        instance: {
                          instanceId: 'cs-texto',
                          objectId: 'cuadro-de-texto',
                          version: '1.0.0',
                          title: 'Nota',
                          binding: SIN_DATOS,
                          configuracion: {
                            objectId: 'cuadro-de-texto',
                            cuadroDeTexto: { parrafos: [{ texto: 'Un elemento y una visual, juntos.' }] },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: 'cont-desplazable',
            position: { x: 6, y: 0, w: 6, h: 4 },
            instance: {
              instanceId: 'cont-desplazable',
              objectId: 'contenedor-desplazable',
              version: '1.0.0',
              title: 'Contenedor desplazable',
              binding: SIN_DATOS,
              presentacion: { icono: 'contenedor', subtitulo: 'Se desplaza solo en vertical' },
              configuracion: {
                objectId: 'contenedor-desplazable',
                desplazable: { eje: 'y', columnas: 4 },
                paneles: [
                  {
                    panelId: 'p1',
                    nombre: 'Contenido',
                    items: [
                      {
                        id: 'cd-tabla',
                        position: { x: 0, y: 0, w: 4, h: 6 },
                        instance: {
                          instanceId: 'cd-tabla',
                          objectId: 'tabla',
                          version: '1.1.0',
                          title: 'Detalle',
                          binding: {
                            datasetId: DATASET,
                            dimensions: [DISTRITO, MATERIA],
                            measures: ['CasosPendientes'],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: 'cont-pestanas',
            position: { x: 0, y: 4, w: 12, h: 5 },
            instance: {
              instanceId: 'cont-pestanas',
              objectId: 'contenedor-con-pestanas',
              version: '1.0.0',
              title: 'Contenedor con pestanas',
              binding: SIN_DATOS,
              presentacion: { icono: 'pestanas', subtitulo: 'Cada pestana con su propia disposicion' },
              configuracion: {
                objectId: 'contenedor-con-pestanas',
                pestanas: { columnas: 8, pestanaInicial: 'p1' },
                paneles: [
                  {
                    panelId: 'p1',
                    nombre: 'Por distrito',
                    items: [
                      {
                        id: 'cp-barras',
                        position: { x: 0, y: 0, w: 8, h: 4 },
                        instance: {
                          instanceId: 'cp-barras',
                          objectId: 'barras',
                          version: '1.1.0',
                          title: 'Pendientes por distrito',
                          binding: {
                            datasetId: DATASET,
                            dimensions: [DISTRITO],
                            measures: ['CasosPendientes'],
                          },
                        },
                      },
                    ],
                  },
                  {
                    panelId: 'p2',
                    nombre: 'Por materia',
                    items: [
                      {
                        id: 'cp-kpi',
                        position: { x: 0, y: 0, w: 2, h: 2 },
                        instance: {
                          instanceId: 'cp-kpi',
                          objectId: 'tarjeta-kpi',
                          version: '1.0.0',
                          title: 'Resueltos',
                          binding: { datasetId: DATASET, dimensions: [], measures: ['CasosResueltos'] },
                        },
                      },
                      {
                        id: 'cp-matriz',
                        position: { x: 2, y: 0, w: 6, h: 4 },
                        instance: {
                          instanceId: 'cp-matriz',
                          objectId: 'matriz',
                          version: '1.1.0',
                          title: 'Materia por trimestre',
                          binding: {
                            datasetId: DATASET,
                            dimensions: [MATERIA, TRIMESTRE],
                            measures: ['CasosPendientes'],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            id: 'cont-ampliable',
            position: { x: 0, y: 9, w: 12, h: 4 },
            instance: {
              instanceId: 'cont-ampliable',
              objectId: 'contenedor-ampliable',
              version: '1.0.0',
              title: 'Contenedor ampliable',
              binding: SIN_DATOS,
              presentacion: { icono: 'expandir', subtitulo: 'La ventana tiene su propia rejilla' },
              configuracion: {
                objectId: 'contenedor-ampliable',
                ampliable: { columnas: 6, columnasAmpliado: 12, textoDeAmpliar: 'Ampliar' },
                paneles: [
                  {
                    panelId: 'p1',
                    nombre: 'Contenido',
                    items: [
                      {
                        id: 'ca-lineas',
                        position: { x: 0, y: 0, w: 6, h: 3 },
                        instance: {
                          instanceId: 'ca-lineas',
                          objectId: 'lineas',
                          version: '1.0.0',
                          title: 'Pendientes por trimestre',
                          binding: {
                            datasetId: DATASET,
                            dimensions: [TRIMESTRE],
                            measures: ['CasosPendientes'],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  },
];

/**
 * Busqueda por slug, contra el ALMACEN y no contra la semilla.
 *
 * Es asincrona desde que existe el editor: los modulos se escriben, asi que ya no se pueden
 * resolver leyendo un array del modulo. La semilla sigue siendo el estado inicial.
 *
 * OJO: esto NO filtra por estado. Devuelve tambien borradores, porque el editor tiene que poder
 * abrirlos. Quien sirva un modulo a una persona debe pasar ademas por `puedeVer` del ciclo de
 * vida; servir un borrador ajeno seria mostrar trabajo en curso de otro como si fuera oficial.
 */
export async function findModuleBySlug(slug: string): Promise<ModuleDefinition | undefined> {
  return modulos.bySlug(slug);
}

export async function findModuleById(moduleId: string): Promise<ModuleDefinition | undefined> {
  return modulos.get(moduleId);
}
