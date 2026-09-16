import type { ModuleDefinition } from '@app/module-model';
import { modules } from './moduleStore';

/** Definiciones de modulo de arranque. */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };
const TRIMESTRE = { table: 'DimTiempo', field: 'Trimestre' };
const DATASET = 'casos-por-distrito-trimestre';

/*
 * El dataset de grano ATOMICO: una fila por caso, con sus dias de resolucion.
 *
 * Los objetos que reparten observaciones lo necesitan. Sobre el preagregado repartirian grupos y
 * dibujarian la forma de los grupos, que no es la de los casos.
 */
const ATOMIC = 'casos-detalle';
const CASO = { table: 'FactCasos', field: 'CasoId' };

/** El enlace de un objeto que no lee datos. */
const WITHOUT_DATA = { datasetId: '', dimensions: [], measures: [] };

export const demoModules: ModuleDefinition[] = [
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
               */
              presentation: {
                icono: 'expediente',
                acento: 'primario',
                highlight: true,
                subtitulo: 'Al cierre del trimestre',
                formato: { unit: 'casos' },
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
              presentation: {
                icono: 'balanza',
                acento: 'terciario',
                highlight: true,
                subtitulo: 'Frente al periodo anterior',
              },
            },
          },
          /*
           * Panel de filtros en vez de dos segmentadores.
           */
          {
            id: 'filtros',
            // Cuatro filas, no dos: con la forma de acotar, los botones de «Todos» y los valores,
            // dos filas dejaban el panel desplazandose por dentro desde el primer campo.
            position: { x: 6, y: 0, w: 6, h: 4 },
            instance: {
              instanceId: 'filtros',
              objectId: 'panel-de-filtros',
              version: '1.0.0',
              title: 'Filtros',
              binding: { datasetId: DATASET, dimensions: [MATERIA, DISTRITO], measures: [] },
              presentation: { icono: 'filtro', acento: 'secundario' },
              settings: {
                objectId: 'panel-de-filtros',
                pickers: [
                  {
                    fieldName: 'DimTribunal.Materia',
                    tipo: 'pastillas',
                    etiqueta: 'Materia',
                    // AVANZADO: este campo ofrece las cinco formas de acotar. El nivel lo decide
                    // quien configura el objeto, no quien lo mira — «Distrito», aqui al lado, se
                    // queda en basico y ensena solo su lista.
                    nivel: 'avanzado',
                    // Con cuantos expedientes hay detras de cada materia: sin el recuento, elegir
                    // una y encontrarla vacia es la unica forma de saber que no habia nada.
                    recuento: true,
                    orden: 'frecuencia',
                    // «Todos» y «Ninguno» van donde se eligen varios valores. En un desplegable,
                    // que solo sostiene uno, serian dos botones que no pueden hacer lo que dicen.
                    todos: true,
                  },
                  {
                    fieldName: 'DimTribunal.Distrito',
                    tipo: 'desplegable',
                    etiqueta: 'Distrito',
                    orden: 'alfabetico',
                  },
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
              /*
               * El salto de 4.4, declarado en la semilla para que exista uno que mirar.
               *
               * Son DOS y a proposito, porque lo que enseñan juntos es la regla entera: el
               * contexto se interseca con el ambito de quien LLEGA. «Audiencias» cuelga del nodo
               * Norte y se le ofrece a quien tiene ese equipo; «Estadisticas» vive fuera de lo
               * concedido y a esa misma persona no se le ofrece, aunque el salto este configurado
               * igual de bien. Quien lo configura declara el destino; quien alcanza que es otra
               * pregunta, y la responde el camino de lectura cuando alguien abre el modulo.
               */
              drillThrough: [
                { moduleSlug: 'audiencias', label: 'Ver las audiencias de este distrito' },
                { moduleSlug: 'estadisticas' },
              ],
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
                /*
                 * El aviso de agregacion, ahora COMO PIE y no estampado por el grafico.
                 *
                 * Antes lo escribia el objeto de barras por su cuenta: no se podia cambiar, no se
                 * podia quitar, ocupaba la ranura de este mismo complemento y los demas objetos
                 * agregaban igual y se callaban. Aqui es una marca del pie —`{{agregado}}`— que
                 * solo se sustituye si el objeto agrego de verdad, y que quien configure el modulo
                 * puede mover, acompanar o quitar.
                 */
                {
                  instanceId: 'pie-barras-distrito',
                  objectId: 'pie-de-pagina',
                  version: '1.0.0',
                  texto: '{{agregado}}',
                },
              ],
            },
          },
          {
            id: 'matriz-distrito-materia',
            position: { x: 6, y: 4, w: 6, h: 4 },
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
                 */
                slots: {
                  filas: ['DimTribunal.Materia', 'DimTiempo.Trimestre'],
                  columnas: ['DimTribunal.Distrito'],
                  valores: ['CasosPendientes'],
                },
              },
            },
          },
          /*
           * El unico objeto del seed con MAS DE UNA medida mapeada, y esta aqui a proposito.
           */
          /*
           * El segmentador se queda, al lado del panel, y sobre la MISMA dimension.
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
              presentation: { icono: 'filtro', acento: 'neutro' },
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
   */
  {
    moduleId: 'composicion',
    slug: 'composicion',
    name: 'Composicion',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    /*
     * Doce paginas y, hasta ahora, ninguna forma de llegar a once de ellas.
     *
     * Existian en el modelo y solo se alcanzaban escribiendo la URL a mano. Es exactamente el caso
     * que el navegador de pagina viene a cerrar, y por eso este modulo lleva el tipo que mas
     * trabaja: panel a la izquierda, fijo en la rejilla, con su seccion de filtros debajo.
     */
    navigator: {
      tipo: 'panel-izquierdo',
      comportamiento: 'grilla',
      filtros: {
        etiqueta: 'Filtros de busqueda',
        datasetId: DATASET,
        pickers: [
          { fieldName: 'DimTiempo.Trimestre', tipo: 'desplegable', etiqueta: 'Trimestre' },
          { fieldName: 'DimTribunal.Materia', tipo: 'pastillas', etiqueta: 'Materia' },
        ],
      },
    },
    pages: [
      {
        pageId: 'p-elementos',
        slug: 'elementos',
        name: 'Elementos',
        icon: 'titulo',
        items: [
          {
            id: 'el-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'el-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo de seccion',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Texto, formas y separadores',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
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
              binding: WITHOUT_DATA,
              presentation: { icono: 'content', acento: 'terciario' },
              settings: {
                objectId: 'cuadro-de-texto',
                textBox: {
                  parrafos: [
                    { content: 'Como leer este modulo', nivel: 1 },
                    {
                      content:
                        'Las cifras salen del dataset cacheado y estan filtradas por el ambito de quien mira.',
                    },
                    { content: 'Los elementos de esta pagina no leen datos: componen.', vineta: true },
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
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'forma',
                forma: {
                  forma: 'rectangulo',
                  relleno: 'primario',
                  opacidad: 12,
                  radio: 12,
                  content: 'Rectangulo',
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
              binding: WITHOUT_DATA,
              settings: {
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
              binding: WITHOUT_DATA,
              settings: {
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
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'linea-divisoria',
                lineDivider: { orientation: 'horizontal', style: 'discontinua', thickness: 2, color: 'atenuado' },
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
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Conexiones',
                  textPosition: 'centro',
                  line: 'ambos',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'atenuado' },
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
              presentation: { icono: 'expediente', etiqueta: { content: 'en el periodo', cellPosition: 'debajo' } },
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
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'conexion',
                conexion: {
                  desde: 'flujo-origen',
                  hasta: 'flujo-destino',
                  dash: 'angulo',
                  finalEnd: 'flecha',
                  content: 'se resuelven',
                  estiloDeLinea: { style: 'solida', thickness: 2, color: 'primario' },
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
              presentation: { icono: 'balanza', acento: 'secundario', etiqueta: { content: 'en el periodo', cellPosition: 'debajo' } },
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
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'linea-divisoria',
                lineDivider: { orientation: 'vertical', style: 'solida', thickness: 2, color: 'primario' },
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
              binding: WITHOUT_DATA,
              settings: {
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
        icon: 'barras',
        items: [
          {
            id: 'g-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'g-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Lo mismo, sin personalizar y personalizado',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
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
              presentation: { subtitulo: 'Sin tocar nada' },
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
              presentation: {
                subtitulo: 'Leyenda a la derecha, cifras, ordenado por valor y escala logaritmica',
                legend: 'derecha',
                datumLabels: true,
                /*
                 * Escala LOGARITMICA, y con su minimo puesto.
                 *
                 * Es para lo que sirve: comparar magnitudes muy distintas en el mismo grafico sin
                 * que la pequena quede pegada al eje. El minimo va en uno porque el logaritmo de
                 * cero no existe, y la validacion lo exige en vez de dejar una escala que miente.
                 */
                axes: {
                  gridlines: false,
                  yTitle: 'Casos',
                  scale: 'logaritmica',
                  fromZero: false,
                  yMin: 1,
                },
                orden: { por: 'valor', direction: 'desc' },
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
              presentation: {
                subtitulo: 'Leyenda arriba, cifra sobre cada punto y barra de zoom',
                legend: 'arriba',
                datumLabels: true,
                // La barra de zoom: deja acercarse a un tramo del eje sin perder de vista donde
                // esta dentro del total. Empieza mostrandolo todo.
                axes: { yTitle: 'Casos', zoom: true },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-familia',
        slug: 'familia',
        name: 'Barras y area',
        icon: 'area',
        items: [
          {
            id: 'f-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'f-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'La misma medida en seis formas',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
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
              presentation: { subtitulo: 'El total y de que se compone', legend: 'abajo', apilado: 'apilado' },
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
              presentation: { subtitulo: 'La composicion, no la magnitud', legend: 'abajo', apilado: 'porcentaje' },
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
              presentation: { subtitulo: 'Los nombres largos caben enteros', legend: 'abajo', datumLabels: true },
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
              presentation: { subtitulo: 'Reparto por materia', legend: 'abajo', apilado: 'porcentaje' },
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
              presentation: { subtitulo: 'Volumen a lo largo del tiempo', legend: 'abajo' },
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
              presentation: { subtitulo: 'De que se compone el total', legend: 'abajo', apilado: 'apilado' },
            },
          },
        ],
      },
      {
        pageId: 'p-proporcion',
        slug: 'proporcion',
        name: 'Proporcion y meta',
        icon: 'dona',
        items: [
          {
            id: 'pr-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'pr-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'La parte y la meta',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'pr-pastel',
            position: { x: 0, y: 1, w: 4, h: 4 },
            instance: {
              instanceId: 'pr-pastel',
              objectId: 'pastel',
              version: '1.0.0',
              title: 'Reparto por materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'Cuanto pesa cada materia',
                legend: 'abajo',
                circular: { labels: 'porcentaje' },
              },
            },
          },
          {
            id: 'pr-dona',
            position: { x: 4, y: 1, w: 4, h: 4 },
            instance: {
              instanceId: 'pr-dona',
              objectId: 'dona',
              version: '1.0.0',
              title: 'Lo mismo, con el total',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'El hueco deja sitio a la cifra',
                legend: 'abajo',
                circular: { totalEnElCentro: true, labels: 'porcentaje' },
              },
            },
          },
          {
            id: 'pr-dona-distrito',
            position: { x: 8, y: 1, w: 4, h: 4 },
            instance: {
              instanceId: 'pr-dona-distrito',
              objectId: 'dona',
              version: '1.0.0',
              title: 'Pendientes por trimestre',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'Etiquetas con nombre y parte',
                legend: 'oculta',
                circular: { radioInterior: 40, labels: 'categoria-porcentaje' },
              },
            },
          },
          {
            id: 'pr-medidor',
            position: { x: 0, y: 5, w: 4, h: 4 },
            instance: {
              instanceId: 'pr-medidor',
              objectId: 'medidor',
              version: '1.0.0',
              title: 'Resueltos frente a ingresados',
              binding: {
                datasetId: DATASET,
                dimensions: [],
                measures: ['CasosResueltos', 'CasosIngresados'],
              },
              presentation: { subtitulo: 'El objetivo sale del dataset' },
            },
          },
          {
            id: 'pr-medidor-meta',
            position: { x: 4, y: 5, w: 4, h: 4 },
            instance: {
              instanceId: 'pr-medidor-meta',
              objectId: 'medidor',
              version: '1.0.0',
              title: 'Pendientes contra el tope',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'Escala fija: dos capturas se pueden comparar',
                medidor: { minimo: 0, maximo: 3000, objetivo: 2000 },
              },
            },
          },
          {
            id: 'pr-medidor-sin-meta',
            position: { x: 8, y: 5, w: 4, h: 4 },
            instance: {
              instanceId: 'pr-medidor-sin-meta',
              objectId: 'medidor',
              version: '1.0.0',
              title: 'Ingresados, sin meta',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosIngresados'] },
              presentation: { subtitulo: 'Sin objetivo no hay marca; la escala se deduce' },
            },
          },
        ],
      },
      {
        pageId: 'p-relacion',
        slug: 'relacion',
        name: 'Dos medidas a la vez',
        icon: 'dispersion',
        items: [
          {
            id: 'rel-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'rel-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Cuando una escala no alcanza',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'rel-combinado',
            position: { x: 0, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'rel-combinado',
              objectId: 'combinado',
              version: '1.0.0',
              title: 'Ingresados y resueltos, con pendientes',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
                // Las ranuras se declaran: es lo que guarda el editor al arrastrar cada medida a
                // su pozo. Sin ellas el reparto por omision es correcto pero no es EL que este
                // ejemplo quiere ensenar.
                slots: {
                  'eje-x': ['DimTiempo.Trimestre'],
                  columnas: ['CasosIngresados', 'CasosResueltos'],
                  lineas: ['CasosPendientes'],
                },
              },
              presentation: {
                subtitulo: 'Una sola escala: la comparacion es directa',
                legend: 'abajo',
                axes: { yTitle: 'Casos' },
              },
            },
          },
          {
            id: 'rel-combinado-2ejes',
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'rel-combinado-2ejes',
              objectId: 'combinado',
              version: '1.0.0',
              title: 'Lo mismo, con eje secundario',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
                slots: {
                  'eje-x': ['DimTiempo.Trimestre'],
                  columnas: ['CasosIngresados', 'CasosResueltos'],
                  lineas: ['CasosPendientes'],
                },
              },
              presentation: {
                subtitulo: 'La linea se mide en la escala de la derecha',
                legend: 'abajo',
                combinado: { axisSecondary: true },
                axes: { yTitle: 'Casos', y2Title: 'Pendientes', fromZero: false },
              },
            },
          },
          {
            id: 'rel-dispersion',
            position: { x: 0, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'rel-dispersion',
              objectId: 'dispersion',
              version: '1.0.0',
              title: 'Ingresados frente a resueltos',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentation: {
                subtitulo: 'Un punto por trimestre',
                datumLabels: true,
                axes: { xTitle: 'Ingresados', yTitle: 'Resueltos', fromZero: false },
              },
            },
          },
          {
            id: 'rel-burbujas',
            position: { x: 6, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'rel-burbujas',
              objectId: 'dispersion',
              version: '1.0.0',
              title: 'Y con los pendientes como tamano',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentation: {
                subtitulo: 'Una tercera medida sin un tercer eje',
                datumLabels: true,
                axes: { xTitle: 'Ingresados', yTitle: 'Resueltos', fromZero: false },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-flujo',
        slug: 'flujo',
        name: 'Flujo y composicion',
        icon: 'embudo',
        items: [
          {
            id: 'flu-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'flu-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'De donde sale y en que se reparte',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'flu-embudo',
            position: { x: 0, y: 1, w: 4, h: 4 },
            instance: {
              instanceId: 'flu-embudo',
              objectId: 'embudo',
              version: '1.0.0',
              title: 'Carga por trimestre',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosIngresados'] },
              presentation: {
                subtitulo: 'Ordenado de mayor a menor: el embudo clasico',
                legend: 'oculta',
                orden: { por: 'valor', direction: 'desc' },
              },
            },
          },
          {
            id: 'flu-embudo-anterior',
            position: { x: 4, y: 1, w: 4, h: 4 },
            instance: {
              instanceId: 'flu-embudo-anterior',
              objectId: 'embudo',
              version: '1.0.0',
              title: 'Sin ordenar: el proceso tal cual',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosIngresados'] },
              presentation: {
                // Una etapa mayor que la anterior ensancha el embudo en vez de estrecharlo. No es
                // un fallo de dibujo: es la anomalia, y esconderla ordenando seria la version
                // bonita de no contarla.
                subtitulo: 'Una etapa que crece se ve, no se disimula',
                legend: 'oculta',
                embudo: { compare: 'anterior' },
              },
            },
          },
          {
            id: 'flu-arbol',
            position: { x: 8, y: 1, w: 4, h: 4 },
            instance: {
              instanceId: 'flu-arbol',
              objectId: 'mapa-de-arbol',
              version: '1.0.0',
              title: 'Pendientes por materia y trimestre',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA, TRIMESTRE],
                measures: ['CasosPendientes'],
              },
              presentation: {
                subtitulo: 'Dos niveles: la materia agrupa y el trimestre reparte',
                datumLabels: true,
              },
            },
          },
          {
            id: 'flu-cascada',
            position: { x: 0, y: 5, w: 8, h: 4 },
            instance: {
              instanceId: 'flu-cascada',
              objectId: 'cascada',
              version: '1.0.0',
              title: 'De que se compone el pendiente',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'Cada barra empieza donde acabo la anterior',
                axes: { yTitle: 'Casos' },
              },
            },
          },
          {
            id: 'flu-arbol-plano',
            position: { x: 8, y: 5, w: 4, h: 4 },
            instance: {
              instanceId: 'flu-arbol-plano',
              objectId: 'mapa-de-arbol',
              version: '1.0.0',
              title: 'Un solo nivel',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosIngresados'] },
              presentation: { subtitulo: 'Sin jerarquia, el area es la medida', datumLabels: true },
            },
          },
        ],
      },
      {
        pageId: 'p-distribucion',
        slug: 'distribucion',
        name: 'Como se reparten',
        icon: 'histograma',
        items: [
          {
            id: 'dis-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'dis-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'No cuanto tarda de media: cuanto tarda cada uno',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'dis-histograma',
            position: { x: 0, y: 1, w: 6, h: 5 },
            instance: {
              instanceId: 'dis-histograma',
              objectId: 'histograma',
              version: '1.0.0',
              title: 'Dias hasta la resolucion',
              binding: {
                datasetId: ATOMIC,
                dimensions: [CASO],
                measures: ['DiasResolucion'],
              },
              presentation: {
                subtitulo: 'Un promedio esconde la cola; la forma no',
                axes: { xTitle: 'Dias', yTitle: 'Casos' },
                references: [
                  // El plazo, sobre el eje de los DIAS. Es lo que separa «tarda mucho de media»
                  // de «cuantos se pasan del plazo», que es la pregunta que se hace de verdad.
                  { valor: 180, etiqueta: 'Plazo', style: 'discontinua', color: 'error' },
                ],
              },
            },
          },
          {
            id: 'dis-caja',
            position: { x: 0, y: 6, w: 12, h: 5 },
            instance: {
              instanceId: 'dis-caja',
              objectId: 'diagrama-de-caja',
              version: '1.0.0',
              title: 'Dias hasta la resolucion, por materia',
              binding: {
                datasetId: ATOMIC,
                dimensions: [MATERIA, CASO],
                measures: ['DiasResolucion'],
              },
              presentation: {
                subtitulo: 'La misma forma, materia a materia: donde esta la mediana y que se sale',
                axes: { yTitle: 'Dias' },
                boxplot: { mean: true },
                references: [
                  { valor: 180, etiqueta: 'Plazo', style: 'discontinua', color: 'error' },
                ],
              },
            },
          },
          {
            id: 'dis-acumulado',
            position: { x: 6, y: 1, w: 6, h: 5 },
            instance: {
              instanceId: 'dis-acumulado',
              objectId: 'histograma',
              version: '1.0.0',
              title: 'Que parte se resuelve antes de N dias',
              binding: {
                datasetId: ATOMIC,
                dimensions: [CASO],
                measures: ['DiasResolucion'],
              },
              presentation: {
                subtitulo: 'El mismo dato leido como plazo, no como forma',
                histogram: { bins: 12, cumulative: true, relative: true },
                axes: { xTitle: 'Dias', yTitle: 'Acumulado' },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-referencia',
        slug: 'referencia',
        name: 'Metas y escalas',
        icon: 'medidor',
        items: [
          {
            id: 'ref-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'ref-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Una cifra contra algo',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'ref-meta',
            position: { x: 0, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'ref-meta',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Resueltos por trimestre, contra la meta',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosResueltos'] },
              presentation: {
                subtitulo: 'La raya es lo que convierte la cifra en respuesta',
                legend: 'oculta',
                datumLabels: true,
                axes: { yTitle: 'Casos' },
                references: [
                  { valor: 900, etiqueta: 'Meta trimestral', color: 'error', style: 'discontinua' },
                ],
              },
            },
          },
          {
            id: 'ref-banda',
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'ref-banda',
              objectId: 'lineas',
              version: '1.1.0',
              title: 'Con tres referencias y escala fija',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentation: {
                subtitulo: 'Minimo y maximo a mano: comparable con el de al lado',
                legend: 'abajo',
                // Los mismos limites en los dos objetos: dos graficos de la misma medida con
                // escalas distintas se leen como si dijeran cosas distintas.
                axes: { yTitle: 'Casos', yMin: 0, yMax: 2400 },
                references: [
                  { valor: 600, etiqueta: 'Minimo', color: 'atenuado', style: 'punteada' },
                  { valor: 1200, etiqueta: 'Meta', color: 'error' },
                  { valor: 1800, etiqueta: 'Tope', color: 'primario', style: 'solida' },
                ],
              },
            },
          },
          {
            id: 'ref-colores',
            position: { x: 0, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'ref-colores',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Colores elegidos por serie',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentation: {
                subtitulo: 'Del tema, no libres: se elige cual de los ocho le toca a cada una',
                legend: 'abajo',
                seriesColors: [3, 2, 1],
              },
            },
          },
          {
            id: 'ref-misma-escala',
            position: { x: 6, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'ref-misma-escala',
              objectId: 'barras',
              version: '1.2.0',
              title: 'La misma medida, la misma escala',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosResueltos'] },
              presentation: {
                subtitulo: 'Por materia, con el mismo 0-2400 que el de al lado',
                legend: 'oculta',
                datumLabels: true,
                axes: { yTitle: 'Casos', yMin: 0, yMax: 2400 },
                references: [{ valor: 1200, etiqueta: 'Meta', color: 'error' }],
              },
            },
          },
        ],
      },
      {
        pageId: 'p-detalle',
        slug: 'detalle',
        name: 'Etiquetas y tooltip',
        icon: 'informacion',
        items: [
          {
            id: 'det-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'det-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Que se rotula y que se lee al senalar',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'det-extremos',
            position: { x: 0, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'det-extremos',
              objectId: 'lineas',
              version: '1.1.0',
              title: 'Solo el maximo y el minimo',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentation: {
                subtitulo: 'La tercera opcion entre «todas» y «ninguna»',
                legend: 'abajo',
                datumLabels: { mostrar: true, onlyEnds: true },
                axes: { yTitle: 'Casos' },
              },
            },
          },
          {
            id: 'det-todas',
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'det-todas',
              objectId: 'lineas',
              version: '1.1.0',
              title: 'Lo mismo, con todas',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentation: {
                subtitulo: 'Con cuatro categorias cabe; con veinte, no',
                legend: 'abajo',
                datumLabels: { mostrar: true, cellPosition: 'encima' },
                axes: { yTitle: 'Casos' },
              },
            },
          },
          {
            id: 'det-rotado',
            position: { x: 0, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'det-rotado',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Rotulos girados',
              binding: {
                datasetId: DATASET,
                dimensions: [DISTRITO, MATERIA],
                measures: ['CasosPendientes'],
              },
              presentation: {
                subtitulo: 'En horizontal, los que no caben se esconden sin avisar',
                legend: 'oculta',
                axes: { yTitle: 'Casos', rotateX: 45 },
              },
            },
          },
          {
            id: 'det-tooltip',
            position: { x: 6, y: 5, w: 6, h: 4 },
            instance: {
              instanceId: 'det-tooltip',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Apilado con total en el tooltip',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
              presentation: {
                subtitulo: 'Senale una columna: la suma ya no hay que hacerla de cabeza',
                legend: 'abajo',
                apilado: 'apilado',
                tooltip: { total: true, sortValue: true },
                axes: { yTitle: 'Casos' },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-multiplos',
        slug: 'multiplos',
        name: 'Pequenos multiplos',
        icon: 'combinado',
        items: [
          {
            id: 'mul-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'mul-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'El mismo grafico, una vez por cada valor',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'mul-columnas',
            position: { x: 0, y: 1, w: 6, h: 5 },
            instance: {
              instanceId: 'mul-columnas',
              objectId: 'barras',
              version: '1.3.0',
              title: 'Casos por trimestre, por materia',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA, TRIMESTRE],
                measures: ['CasosIngresados'],
                slots: {
                  multiplo: ['DimTribunal.Materia'],
                  'eje-x': ['DimTiempo.Trimestre'],
                  serie: [],
                  'eje-y': ['CasosIngresados'],
                },
              },
              presentation: {
                subtitulo: 'Misma escala: los paneles se pueden comparar',
                legend: 'oculta',
                axes: { gridlines: true },
              },
            },
          },
          {
            id: 'mul-lineas',
            position: { x: 6, y: 1, w: 6, h: 5 },
            instance: {
              instanceId: 'mul-lineas',
              objectId: 'lineas',
              version: '1.2.0',
              title: 'Lo mismo, como linea',
              binding: {
                datasetId: DATASET,
                dimensions: [MATERIA, TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
                slots: {
                  multiplo: ['DimTribunal.Materia'],
                  'eje-x': ['DimTiempo.Trimestre'],
                  'eje-y': ['CasosIngresados', 'CasosResueltos'],
                },
              },
              presentation: {
                subtitulo: 'Dos medidas por panel, en una sola configuracion',
                legend: 'abajo',
                multiples: { gridColumns: 1 },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-condicional',
        slug: 'condicional',
        name: 'Color por valor',
        icon: 'indicador',
        items: [
          {
            id: 'con-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'con-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Cuando el color lo decide el dato',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          {
            id: 'con-kpi',
            position: { x: 0, y: 1, w: 3, h: 2 },
            instance: {
              instanceId: 'con-kpi',
              objectId: 'tarjeta-kpi',
              version: '1.2.0',
              title: 'Pendientes',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'Roja por encima de 2.000',
                etiqueta: { content: 'Al cierre del trimestre', cellPosition: 'debajo' },
                conditional: { rules: [{ comparator: 'mayor', valor: 2000, color: 'error' }] },
              },
            },
          },
          {
            id: 'con-kpi-ok',
            position: { x: 3, y: 1, w: 3, h: 2 },
            instance: {
              instanceId: 'con-kpi-ok',
              objectId: 'tarjeta-kpi',
              version: '1.2.0',
              title: 'Resueltos',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosResueltos'] },
              presentation: {
                subtitulo: 'La misma regla, y esta no salta',
                etiqueta: { content: 'Al cierre del trimestre', cellPosition: 'debajo' },
                conditional: { rules: [{ comparator: 'menor', valor: 1000, color: 'error' }] },
              },
            },
          },
          {
            id: 'con-tabla',
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'con-tabla',
              objectId: 'tabla',
              version: '1.2.0',
              title: 'Por trimestre, con umbrales',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosResueltos', 'CasosPendientes'],
              },
              presentation: {
                subtitulo: 'Tres reglas, evaluadas en orden',
                conditional: {
                  rules: [
                    { medida: 'CasosPendientes', comparator: 'mayor', valor: 600, color: 'error' },
                    { medida: 'CasosPendientes', comparator: 'menor', valor: 400, color: 'terciario' },
                    { medida: 'CasosResueltos', comparator: 'mayor', valor: 900, color: 'primario' },
                  ],
                },
              },
            },
          },
          {
            id: 'con-barras',
            position: { x: 0, y: 3, w: 6, h: 4 },
            instance: {
              instanceId: 'con-barras',
              objectId: 'barras',
              version: '1.4.0',
              title: 'Pendientes por trimestre',
              binding: { datasetId: DATASET, dimensions: [TRIMESTRE], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'La barra que se pasa del umbral se pinta sola',
                legend: 'oculta',
                datumLabels: { mostrar: true },
                axes: { yTitle: 'Casos' },
                references: [{ valor: 600, etiqueta: 'Umbral', color: 'error' }],
                conditional: { rules: [{ comparator: 'mayor', valor: 600, color: 'error' }] },
              },
            },
          },
          {
            /*
             * Las barras horizontales con la MISMA regla que las columnas.
             */
            id: 'con-barras-h',
            position: { x: 0, y: 7, w: 6, h: 4 },
            instance: {
              instanceId: 'con-barras-h',
              objectId: 'barras-horizontales',
              version: '1.1.0',
              title: 'Pendientes por distrito',
              binding: { datasetId: DATASET, dimensions: [DISTRITO], measures: ['CasosPendientes'] },
              presentation: {
                subtitulo: 'La misma regla, en horizontal',
                legend: 'oculta',
                datumLabels: { mostrar: true },
                conditional: { rules: [{ comparator: 'mayor', valor: 600, color: 'error' }] },
              },
            },
          },
          {
            /*
             * Y la matriz, que es donde el color por valor mas se nota.
             */
            id: 'con-matriz',
            position: { x: 6, y: 7, w: 6, h: 4 },
            instance: {
              instanceId: 'con-matriz',
              objectId: 'matriz',
              version: '1.2.0',
              title: 'Distrito por trimestre',
              binding: {
                datasetId: DATASET,
                dimensions: [DISTRITO, TRIMESTRE],
                measures: ['CasosPendientes'],
                slots: {
                  filas: ['DimTribunal.Distrito'],
                  columnas: ['DimTiempo.Trimestre'],
                  valores: ['CasosPendientes'],
                },
              },
              presentation: {
                subtitulo: 'El color tambien llega a los subtotales',
                conditional: { rules: [{ comparator: 'mayor', valor: 300, color: 'error' }] },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-contenedores',
        slug: 'contenedores',
        name: 'Contenedores',
        icon: 'contenedor',
        items: [
          /*
           * El expandible va el PRIMERO, y con un chiclet de una fila.
           *
           * Es donde se usa: un panel que se abre encima de lo que filtra y empuja la pagina hacia
           * abajo. Ponerlo al final lo dejaria abriendose sobre nada y no se veria lo unico que lo
           * distingue del ampliable — que no tapa, desplaza.
           */
          {
            id: 'cont-expandible',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'cont-expandible',
              objectId: 'contenedor-expandible',
              version: '1.0.0',
              title: 'Contenedor expandible',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'contenedor-expandible',
                expandableInPlace: { gridColumns: 12, filasAlExpandir: 2, rotulo: 'Filtros' },
                panels: [
                  {
                    panelId: 'p1',
                    nombre: 'Contenido',
                    items: [
                      {
                        id: 'ce-filtro-distrito',
                        position: { x: 0, y: 0, w: 4, h: 2 },
                        instance: {
                          instanceId: 'ce-filtro-distrito',
                          objectId: 'segmentador',
                          version: '1.0.0',
                          title: 'Distrito',
                          binding: {
                            datasetId: DATASET,
                            dimensions: [DISTRITO],
                            measures: [],
                          },
                        },
                      },
                      {
                        id: 'ce-filtro-materia',
                        position: { x: 4, y: 0, w: 4, h: 2 },
                        instance: {
                          instanceId: 'ce-filtro-materia',
                          objectId: 'segmentador',
                          version: '1.0.0',
                          title: 'Materia',
                          binding: {
                            datasetId: DATASET,
                            dimensions: [MATERIA],
                            measures: [],
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
            id: 'cont-simple',
            position: { x: 0, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'cont-simple',
              objectId: 'contenedor-simple',
              version: '1.0.0',
              title: 'Contenedor simple',
              binding: WITHOUT_DATA,
              presentation: { icono: 'contenedor', subtitulo: 'Rejilla propia de seis columnas' },
              settings: {
                objectId: 'contenedor-simple',
                simple: { gridColumns: 6 },
                panels: [
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
                          binding: WITHOUT_DATA,
                          settings: {
                            objectId: 'cuadro-de-texto',
                            textBox: { parrafos: [{ content: 'Un elemento y una visual, juntos.' }] },
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
            position: { x: 6, y: 1, w: 6, h: 4 },
            instance: {
              instanceId: 'cont-desplazable',
              objectId: 'contenedor-desplazable',
              version: '1.0.0',
              title: 'Contenedor desplazable',
              binding: WITHOUT_DATA,
              presentation: { icono: 'contenedor', subtitulo: 'Se desplaza solo en vertical' },
              settings: {
                objectId: 'contenedor-desplazable',
                scrollable: { axis: 'y', gridColumns: 4 },
                panels: [
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
            position: { x: 0, y: 5, w: 12, h: 5 },
            instance: {
              instanceId: 'cont-pestanas',
              objectId: 'contenedor-con-pestanas',
              version: '1.0.0',
              title: 'Contenedor con pestanas',
              binding: WITHOUT_DATA,
              presentation: { icono: 'tabs', subtitulo: 'Cada pestana con su propia disposicion' },
              settings: {
                objectId: 'contenedor-con-pestanas',
                tabs: { gridColumns: 8, initialTab: 'p1' },
                panels: [
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
            position: { x: 0, y: 10, w: 12, h: 4 },
            instance: {
              instanceId: 'cont-ampliable',
              objectId: 'contenedor-ampliable',
              version: '1.0.0',
              title: 'Contenedor ampliable',
              binding: WITHOUT_DATA,
              presentation: { icono: 'expandir', subtitulo: 'La ventana tiene su propia rejilla' },
              settings: {
                objectId: 'contenedor-ampliable',
                expandable: { gridColumns: 6, expandedColumns: 12, textoDeAmpliar: 'Ampliar' },
                panels: [
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
      {
        pageId: 'p-complementos',
        slug: 'complementos',
        name: 'Complementos',
        icon: 'paginado',
        items: [
          {
            id: 'comp-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'comp-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: WITHOUT_DATA,
              settings: {
                objectId: 'titulo-de-seccion',
                sectionTitle: {
                  content: 'Lo que se le cuelga a un objeto',
                  textPosition: 'izquierda',
                  line: 'derecha',
                  estiloDeLinea: { style: 'solida', thickness: 1, color: 'primario' },
                },
              },
            },
          },
          /*
           * Una tabla con las tres cosas a la vez, que es como se usan de verdad.
           *
           * El paginado existe porque el alto de un objeto no depende de su contenido: ocho
           * combinaciones dentro de una caja de cuatro filas se desplazan, y desplazarse no dice
           * cuanto falta. El filtro acota esta tabla y solo esta —la de al lado no se mueve—, y el
           * pie cuenta el total de lo que se esta mirando.
           */
          {
            id: 'comp-tabla',
            position: { x: 0, y: 1, w: 8, h: 5 },
            instance: {
              instanceId: 'comp-tabla',
              objectId: 'tabla',
              version: '1.1.0',
              title: 'Pendientes por trimestre',
              /*
               * Por TRIMESTRE, no por distrito.
               *
               * El distrito lo recorta el ambito de quien mira —un equipo de un solo distrito ve
               * una fila— y una pagina de ejemplo que se queda en una fila no ensena para que
               * sirve el paginado. El trimestre lo ve todo el mundo entero.
               */
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosPendientes'],
              },
              presentation: { subtitulo: 'Paginada, acotable y con su total al pie' },
              attachments: [
                {
                  instanceId: 'comp-tabla-paginado',
                  objectId: 'paginado',
                  version: '1.0.0',
                  porPagina: 2,
                  selector: true,
                  coletilla: 'abajo',
                },
                {
                  instanceId: 'comp-tabla-filtro',
                  objectId: 'filtro-de-visualizacion',
                  version: '1.0.0',
                  fieldName: 'DimTiempo.Trimestre',
                  tipo: 'pastillas',
                },
                {
                  instanceId: 'comp-tabla-pie',
                  objectId: 'pie-de-pagina',
                  version: '1.0.0',
                  // El total es el de la SELECCION, no el de la pagina que se ve: un total que cambiara al
                  // pasar de pagina no es un total, y contradiria a la coletilla de al lado.
                  texto: 'Total de la seleccion: {{1}} casos pendientes.',
                },
              ],
            },
          },
          /*
           * La de al lado, SIN complementos y con los mismos datos.
           *
           * Es la comparacion que hace visible lo que el filtro de visualizacion es: al acotar la
           * primera, esta se queda como estaba. Sin una segunda tabla delante, un filtro que solo
           * mueve su objeto y uno que mueve la pagina entera se ven exactamente igual.
           */
          {
            id: 'comp-espejo',
            position: { x: 8, y: 1, w: 4, h: 5 },
            instance: {
              instanceId: 'comp-espejo',
              objectId: 'barras',
              version: '1.2.0',
              title: 'Los mismos datos, sin complementos',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosPendientes'],
              },
              presentation: {
                subtitulo: 'No se mueve cuando se acota la tabla',
                legend: 'oculta',
                axes: { yTitle: 'Casos' },
              },
            },
          },
          {
            id: 'comp-pie',
            position: { x: 0, y: 6, w: 12, h: 4 },
            instance: {
              instanceId: 'comp-pie',
              objectId: 'lineas',
              version: '1.1.0',
              title: 'Ingresados y resueltos por trimestre',
              binding: {
                datasetId: DATASET,
                dimensions: [TRIMESTRE],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
              presentation: {
                subtitulo: 'El pie referencia las medidas por su orden de mapeo',
                legend: 'abajo',
                axes: { yTitle: 'Casos' },
              },
              attachments: [
                {
                  instanceId: 'comp-pie-nota',
                  objectId: 'pie-de-pagina',
                  version: '1.0.0',
                  // {{1}} es CasosIngresados y {{2}} CasosResueltos: por POSICION de mapeo, no por
                  // nombre. Renombrar la medida en el esquema no deja el pie escribiendo una
                  // columna que ya no existe.
                  texto: 'En el periodo: {{1}} ingresados y {{2}} resueltos.',
                },
              ],
            },
          },
        ],
      },
    ],
  },
];

/** Busqueda por slug, contra el ALMACEN y no contra la semilla. */
export async function findModuleBySlug(slug: string): Promise<ModuleDefinition | undefined> {
  return modules.bySlug(slug);
}

export async function findModuleById(moduleId: string): Promise<ModuleDefinition | undefined> {
  return modules.get(moduleId);
}
