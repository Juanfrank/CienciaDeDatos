import type { ModuleDefinition } from '@app/module-model';
import { modulos } from './almacenModulos';

/** Definiciones de modulo de arranque. */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };
const TRIMESTRE = { table: 'DimTiempo', field: 'Trimestre' };
const DATASET = 'casos-por-distrito-trimestre';

/** El enlace de un objeto que no lee datos. */
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
        pageId: 'p-proporcion',
        slug: 'proporcion',
        name: 'Proporcion y meta',
        items: [
          {
            id: 'pr-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'pr-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'La parte y la meta',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
              presentacion: {
                subtitulo: 'Cuanto pesa cada materia',
                leyenda: 'abajo',
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
              presentacion: {
                subtitulo: 'El hueco deja sitio a la cifra',
                leyenda: 'abajo',
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
              presentacion: {
                subtitulo: 'Etiquetas con nombre y parte',
                leyenda: 'oculta',
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
              presentacion: { subtitulo: 'El objetivo sale del dataset' },
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
              presentacion: {
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
              presentacion: { subtitulo: 'Sin objetivo no hay marca; la escala se deduce' },
            },
          },
        ],
      },
      {
        pageId: 'p-relacion',
        slug: 'relacion',
        name: 'Dos medidas a la vez',
        items: [
          {
            id: 'rel-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'rel-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Cuando una escala no alcanza',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
                ranuras: {
                  'eje-x': ['DimTiempo.Trimestre'],
                  columnas: ['CasosIngresados', 'CasosResueltos'],
                  lineas: ['CasosPendientes'],
                },
              },
              presentacion: {
                subtitulo: 'Una sola escala: la comparacion es directa',
                leyenda: 'abajo',
                ejes: { tituloY: 'Casos' },
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
                ranuras: {
                  'eje-x': ['DimTiempo.Trimestre'],
                  columnas: ['CasosIngresados', 'CasosResueltos'],
                  lineas: ['CasosPendientes'],
                },
              },
              presentacion: {
                subtitulo: 'La linea se mide en la escala de la derecha',
                leyenda: 'abajo',
                combinado: { ejeSecundario: true },
                ejes: { tituloY: 'Casos', tituloY2: 'Pendientes', desdeCero: false },
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
              presentacion: {
                subtitulo: 'Un punto por trimestre',
                etiquetasDeDato: true,
                ejes: { tituloX: 'Ingresados', tituloY: 'Resueltos', desdeCero: false },
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
              presentacion: {
                subtitulo: 'Una tercera medida sin un tercer eje',
                etiquetasDeDato: true,
                ejes: { tituloX: 'Ingresados', tituloY: 'Resueltos', desdeCero: false },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-flujo',
        slug: 'flujo',
        name: 'Flujo y composicion',
        items: [
          {
            id: 'flu-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'flu-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'De donde sale y en que se reparte',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
              presentacion: {
                subtitulo: 'Ordenado de mayor a menor: el embudo clasico',
                leyenda: 'oculta',
                orden: { por: 'valor', direccion: 'desc' },
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
              presentacion: {
                // Una etapa mayor que la anterior ensancha el embudo en vez de estrecharlo. No es
                // un fallo de dibujo: es la anomalia, y esconderla ordenando seria la version
                // bonita de no contarla.
                subtitulo: 'Una etapa que crece se ve, no se disimula',
                leyenda: 'oculta',
                embudo: { comparar: 'anterior' },
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
              presentacion: {
                subtitulo: 'Dos niveles: la materia agrupa y el trimestre reparte',
                etiquetasDeDato: true,
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
              presentacion: {
                subtitulo: 'Cada barra empieza donde acabo la anterior',
                ejes: { tituloY: 'Casos' },
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
              presentacion: { subtitulo: 'Sin jerarquia, el area es la medida', etiquetasDeDato: true },
            },
          },
        ],
      },
      {
        pageId: 'p-referencia',
        slug: 'referencia',
        name: 'Metas y escalas',
        items: [
          {
            id: 'ref-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'ref-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Una cifra contra algo',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
              presentacion: {
                subtitulo: 'La raya es lo que convierte la cifra en respuesta',
                leyenda: 'oculta',
                etiquetasDeDato: true,
                ejes: { tituloY: 'Casos' },
                referencias: [
                  { valor: 900, etiqueta: 'Meta trimestral', color: 'error', estilo: 'discontinua' },
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
              presentacion: {
                subtitulo: 'Minimo y maximo a mano: comparable con el de al lado',
                leyenda: 'abajo',
                // Los mismos limites en los dos objetos: dos graficos de la misma medida con
                // escalas distintas se leen como si dijeran cosas distintas.
                ejes: { tituloY: 'Casos', minimoY: 0, maximoY: 2400 },
                referencias: [
                  { valor: 600, etiqueta: 'Minimo', color: 'atenuado', estilo: 'punteada' },
                  { valor: 1200, etiqueta: 'Meta', color: 'error' },
                  { valor: 1800, etiqueta: 'Tope', color: 'primario', estilo: 'solida' },
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
              presentacion: {
                subtitulo: 'Del tema, no libres: se elige cual de los ocho le toca a cada una',
                leyenda: 'abajo',
                coloresDeSerie: [3, 2, 1],
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
              presentacion: {
                subtitulo: 'Por materia, con el mismo 0-2400 que el de al lado',
                leyenda: 'oculta',
                etiquetasDeDato: true,
                ejes: { tituloY: 'Casos', minimoY: 0, maximoY: 2400 },
                referencias: [{ valor: 1200, etiqueta: 'Meta', color: 'error' }],
              },
            },
          },
        ],
      },
      {
        pageId: 'p-detalle',
        slug: 'detalle',
        name: 'Etiquetas y tooltip',
        items: [
          {
            id: 'det-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'det-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Que se rotula y que se lee al senalar',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
              presentacion: {
                subtitulo: 'La tercera opcion entre «todas» y «ninguna»',
                leyenda: 'abajo',
                etiquetasDeDato: { mostrar: true, soloExtremos: true },
                ejes: { tituloY: 'Casos' },
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
              presentacion: {
                subtitulo: 'Con cuatro categorias cabe; con veinte, no',
                leyenda: 'abajo',
                etiquetasDeDato: { mostrar: true, posicion: 'encima' },
                ejes: { tituloY: 'Casos' },
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
              presentacion: {
                subtitulo: 'En horizontal, los que no caben se esconden sin avisar',
                leyenda: 'oculta',
                ejes: { tituloY: 'Casos', rotarX: 45 },
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
              presentacion: {
                subtitulo: 'Senale una columna: la suma ya no hay que hacerla de cabeza',
                leyenda: 'abajo',
                apilado: 'apilado',
                tooltip: { total: true, ordenarPorValor: true },
                ejes: { tituloY: 'Casos' },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-multiplos',
        slug: 'multiplos',
        name: 'Pequenos multiplos',
        items: [
          {
            id: 'mul-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'mul-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'El mismo grafico, una vez por cada valor',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
                ranuras: {
                  multiplo: ['DimTribunal.Materia'],
                  'eje-x': ['DimTiempo.Trimestre'],
                  serie: [],
                  'eje-y': ['CasosIngresados'],
                },
              },
              presentacion: {
                subtitulo: 'Misma escala: los paneles se pueden comparar',
                leyenda: 'oculta',
                ejes: { cuadricula: true },
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
                ranuras: {
                  multiplo: ['DimTribunal.Materia'],
                  'eje-x': ['DimTiempo.Trimestre'],
                  'eje-y': ['CasosIngresados', 'CasosResueltos'],
                },
              },
              presentacion: {
                subtitulo: 'Dos medidas por panel, en una sola configuracion',
                leyenda: 'abajo',
                multiplos: { columnas: 1 },
              },
            },
          },
        ],
      },
      {
        pageId: 'p-condicional',
        slug: 'condicional',
        name: 'Color por valor',
        items: [
          {
            id: 'con-titulo',
            position: { x: 0, y: 0, w: 12, h: 1 },
            instance: {
              instanceId: 'con-titulo',
              objectId: 'titulo-de-seccion',
              version: '1.0.0',
              title: 'Titulo',
              binding: SIN_DATOS,
              configuracion: {
                objectId: 'titulo-de-seccion',
                tituloDeSeccion: {
                  texto: 'Cuando el color lo decide el dato',
                  posicionDelTexto: 'izquierda',
                  linea: 'derecha',
                  estiloDeLinea: { estilo: 'solida', grosor: 1, color: 'primario' },
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
              presentacion: {
                subtitulo: 'Roja por encima de 2.000',
                etiqueta: { texto: 'Al cierre del trimestre', posicion: 'debajo' },
                condicional: { reglas: [{ comparador: 'mayor', valor: 2000, color: 'error' }] },
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
              presentacion: {
                subtitulo: 'La misma regla, y esta no salta',
                etiqueta: { texto: 'Al cierre del trimestre', posicion: 'debajo' },
                condicional: { reglas: [{ comparador: 'menor', valor: 1000, color: 'error' }] },
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
              presentacion: {
                subtitulo: 'Tres reglas, evaluadas en orden',
                condicional: {
                  reglas: [
                    { medida: 'CasosPendientes', comparador: 'mayor', valor: 600, color: 'error' },
                    { medida: 'CasosPendientes', comparador: 'menor', valor: 400, color: 'terciario' },
                    { medida: 'CasosResueltos', comparador: 'mayor', valor: 900, color: 'primario' },
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
              presentacion: {
                subtitulo: 'La barra que se pasa del umbral se pinta sola',
                leyenda: 'oculta',
                etiquetasDeDato: { mostrar: true },
                ejes: { tituloY: 'Casos' },
                referencias: [{ valor: 600, etiqueta: 'Umbral', color: 'error' }],
                condicional: { reglas: [{ comparador: 'mayor', valor: 600, color: 'error' }] },
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
              presentacion: {
                subtitulo: 'La misma regla, en horizontal',
                leyenda: 'oculta',
                etiquetasDeDato: { mostrar: true },
                condicional: { reglas: [{ comparador: 'mayor', valor: 600, color: 'error' }] },
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
                ranuras: {
                  filas: ['DimTribunal.Distrito'],
                  columnas: ['DimTiempo.Trimestre'],
                  valores: ['CasosPendientes'],
                },
              },
              presentacion: {
                subtitulo: 'El color tambien llega a los subtotales',
                condicional: { reglas: [{ comparador: 'mayor', valor: 300, color: 'error' }] },
              },
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

/** Busqueda por slug, contra el ALMACEN y no contra la semilla. */
export async function findModuleBySlug(slug: string): Promise<ModuleDefinition | undefined> {
  return modulos.bySlug(slug);
}

export async function findModuleById(moduleId: string): Promise<ModuleDefinition | undefined> {
  return modulos.get(moduleId);
}
