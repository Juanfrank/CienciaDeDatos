import { PRESENTACION_MINIMA, type ClaveDePresentacion } from '../presentacion/contrato';
import type { RanuraDeCampos } from '../presentacion/pozos';
import type { ObjectCertification, VisualObjectDefinition } from './types';

/**
 * Catalogo de objetos prediseñados — seccion 4.2.
 *
 * "Panel de objetos prediseñados (barras, lineas, tarjeta/KPI, tabla, matriz, mapa,
 * segmentador) que se enlazan UNICAMENTE contra IDataConnector, nunca contra una fuente ad hoc."
 *
 * En esta arquitectura "enlazarse contra IDataConnector" significa, en la practica, enlazarse
 * contra un datasetId del registro de datasets: el objeto recibe filas ya leidas del cache y ya
 * filtradas por el ambito de quien mira. Ningun objeto conoce la fuente, ni la consulta, ni el
 * conector activo.
 */

const certificacionInicial: ObjectCertification = {
  testsPassed: true,
  reviewedBy: 'equipo-plataforma',
  reviewedAt: '2026-09-11',
};

/**
 * Lo que admite cualquier objeto, mas lo que anada el suyo.
 *
 * Se compone asi y no se escribe a mano en cada entrada para que el minimo no se pueda olvidar
 * por descuido al anadir un objeto: para dejarlo fuera hay que quitarlo explicitamente, y
 * entonces la prueba del catalogo falla y dice por que.
 */
const presenta = (...propias: ClaveDePresentacion[]): ClaveDePresentacion[] => [
  ...PRESENTACION_MINIMA,
  ...propias,
];

const v1 = (
  changelog: string,
  dataContract: VisualObjectDefinition['versions'][number]['dataContract'],
  presentation: ClaveDePresentacion[] = PRESENTACION_MINIMA,
) => ({
  version: '1.0.0',
  publishedAt: '2026-09-11',
  changelog,
  certification: certificacionInicial,
  dataContract,
  presentation,
});

/**
 * Los pozos de un grafico de barras, parametrizados por cuantas medidas admite la version.
 *
 * Se factoriza porque 1.0.0 y 1.1.0 comparten las dimensiones y solo cambian en el cupo del eje
 * Y: escribirlos dos veces invita a que alguien arregle uno y se olvide del otro.
 */
const POZOS_DE_BARRAS = (medidas: number): RanuraDeCampos[] => [
  {
    id: 'eje-x',
    etiqueta: 'Eje X',
    tipo: 'dimension',
    max: 1,
    // Obligatorio: un grafico de barras sin eje de categorias no se puede dibujar. El contrato
    // global dice «entre 1 y 2 dimensiones» y se cumple igual con la dimension en la serie, que es
    // justo el caso que no vale.
    min: 1,
    ayuda: 'La dimension que reparte las barras.',
  },
  {
    id: 'serie',
    etiqueta: 'Serie',
    tipo: 'dimension',
    max: 1,
    ayuda: 'Opcional. Agrupa las barras de cada categoria.',
  },
  {
    id: 'eje-y',
    etiqueta: 'Eje Y',
    tipo: 'medida',
    max: medidas,
    min: 1,
    ayuda: medidas > 1 ? 'Una serie por medida.' : 'La cifra que mide el alto de la barra.',
  },
];

export const catalogoInicial: VisualObjectDefinition[] = [
  {
    objectId: 'tarjeta-kpi',
    name: 'Tarjeta KPI',
    description: 'Un unico valor destacado, con su etiqueta y una variacion opcional.',
    category: 'indicador',
    versions: [
      v1(
        'Version inicial: valor agregado, etiqueta y variacion respecto del periodo anterior.',
        {
          dimensions: { min: 0, max: 1 },
          measures: { min: 1, max: 2 },
          notes: 'La primera medida es el valor; la segunda, opcional, es la comparacion.',
          pozos: [
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'La cifra grande de la tarjeta.',
            },
            {
              id: 'comparacion',
              etiqueta: 'Comparacion',
              tipo: 'medida',
              max: 1,
              ayuda: 'Opcional. La variacion se calcula contra esta.',
            },
            {
              id: 'detalle',
              etiqueta: 'Detalle',
              tipo: 'dimension',
              max: 1,
              ayuda: 'Opcional. Desglosa la cifra en la tabla de datos adjunta.',
            },
          ],
        },
        // Una tarjeta es una cifra: el formato es lo que mas cambia de una a otra —casos enteros,
        // porcentajes con un decimal, importes compactos—. No tiene leyenda ni etiquetas de dato,
        // porque no tiene series ni puntos.
        presenta('formato'),
      ),
    ],
  },
  {
    objectId: 'tabla',
    name: 'Tabla',
    description: 'Filas y columnas con las dimensiones y medidas mapeadas.',
    category: 'tabla',
    versions: [
      v1(
        'Version inicial: columnas ordenables y formato numerico por medida.',
        {
          dimensions: { min: 0, max: 8 },
          measures: { min: 0, max: 12 },
          pozos: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 8 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 12 },
          ],
        },
        presenta('formato'),
      ),
    ],
  },
  {
    objectId: 'barras',
    name: 'Grafico de barras',
    description: 'Comparacion de una o varias medidas entre las categorias de una dimension.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: barras verticales, una serie.',
        {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 1 },
          notes: 'La segunda dimension, si existe, agrupa las barras por serie.',
          pozos: POZOS_DE_BARRAS(1),
        },
        presenta('formato', 'leyenda', 'etiquetasDeDato'),
      ),
      /*
       * 1.1.0 — varias medidas, como ya admitia `lineas`.
       *
       * El constructor de opciones recorria `vm.series` desde el primer dia, y la leyenda y la
       * paleta de ocho colores estaban escritas y probadas; lo que no existia era un objeto que
       * pudiera declarar dos medidas, asi que ese camino no se ejecutaba nunca contra datos
       * reales. Comparar lo que entra con lo que sale es la pregunta basica del dominio y solo se
       * podia responder con una tabla.
       *
       * Va como version NUEVA y no como correccion de 1.0.0 porque 4.5 no admite otra cosa: un
       * objeto compartido publicado no se modifica. Las instancias fijadas a 1.0.0 siguen viendo
       * el contrato de 1.0.0 — ampliar el maximo no las romperia, pero la regla no es "cambia
       * solo si rompe", es que la version es lo que hace reproducible un modulo ya desplegado.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-12',
        changelog:
          'Admite hasta cuatro medidas: una serie por medida, con leyenda y un patron por serie.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La segunda dimension, si existe, agrupa las barras por serie.',
          pozos: POZOS_DE_BARRAS(4),
        },
        presentation: presenta('formato', 'leyenda', 'etiquetasDeDato'),
      },
    ],
  },
  {
    objectId: 'lineas',
    name: 'Grafico de lineas',
    description: 'Evolucion de una o varias medidas a lo largo de una dimension ordenada.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: una linea por medida sobre el eje de la primera dimension.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 4 },
          pozos: [
            {
              id: 'eje-x',
              etiqueta: 'Eje X',
              tipo: 'dimension',
              max: 1,
              min: 1,
              ayuda: 'La dimension ordenada sobre la que avanza la linea.',
            },
            {
              id: 'eje-y',
              etiqueta: 'Eje Y',
              tipo: 'medida',
              max: 4,
              min: 1,
              ayuda: 'Una linea por medida.',
            },
          ],
        },
        presenta('formato', 'leyenda', 'etiquetasDeDato'),
      ),
    ],
  },
  {
    objectId: 'matriz',
    name: 'Matriz',
    description: 'Cruce jerarquico de dimensiones, con subtotales por nivel.',
    category: 'tabla',
    versions: [
      v1(
        'Version inicial: dimension de filas por dimension de columnas, con totales.',
        {
          dimensions: { min: 2, max: 2 },
          measures: { min: 1, max: 1 },
          notes: 'La primera dimension va en filas; la segunda, en columnas.',
          pozos: [
            { id: 'filas', etiqueta: 'Filas', tipo: 'dimension', max: 1, min: 1 },
            { id: 'columnas', etiqueta: 'Columnas', tipo: 'dimension', max: 1, min: 1 },
            { id: 'valores', etiqueta: 'Valores', tipo: 'medida', max: 1, min: 1 },
          ],
        },
        presenta('formato'),
      ),
      /*
       * 1.1.0 — jerarquia.
       *
       * 1.0.0 cruzaba UNA dimension con UNA dimension, y sobre un cruce plano no hay nada que
       * expandir: no tiene niveles. Pero la matriz es justo el objeto donde la jerarquia importa
       * —distrito y dentro materia, ano y dentro trimestre—, asi que el limite de uno no
       * simplificaba nada: impedia usarla para lo que sirve.
       *
       * Version nueva y no correccion de 1.0.0, como manda 4.5: las instancias fijadas a 1.0.0
       * siguen viendo su contrato. Ampliar un maximo no las romperia, pero la regla no es «cambia
       * solo si rompe»; es que la version es lo que hace reproducible un modulo ya desplegado.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-12',
        changelog:
          'Jerarquia en filas y columnas (hasta tres y dos niveles), varias medidas, subtotales ' +
          'por nivel, colapsar y expandir, y orden por cualquier encabezado.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 5 },
          measures: { min: 1, max: 4 },
          notes:
            'Las dimensiones de fila anidan en el orden en que se mapean, y las de columna igual. ' +
            'Cada nivel trae su subtotal, calculado sobre las filas de origen.',
          pozos: [
            { id: 'filas', etiqueta: 'Filas', tipo: 'dimension', max: 3, min: 1 },
            {
              id: 'columnas',
              etiqueta: 'Columnas',
              tipo: 'dimension',
              max: 2,
              ayuda: 'Opcional. Sin ninguna, la matriz es una tabla agrupada por sus filas.',
            },
            { id: 'valores', etiqueta: 'Valores', tipo: 'medida', max: 4, min: 1 },
          ],
        },
        presentation: presenta('formato'),
      },
    ],
  },
  {
    objectId: 'panel-de-filtros',
    name: 'Panel de filtros',
    description:
      'Agrupa de 1 a 10 dimensiones en un solo objeto, cada una con su propio tipo de selector. ' +
      'Las dimensiones de fecha admiten calendario o rango desde/hasta.',
    category: 'filtro',
    versions: [
      v1(
        'Version inicial: pastillas, lista, desplegable, busqueda, calendario y rango de fechas.',
        {
          dimensions: { min: 1, max: 10 },
          measures: { min: 0, max: 0 },
          notes:
            'Cada dimension lleva un selector. Sin configurar, se usa el que corresponde a su ' +
            'tipo. La seleccion vive en la query string (4.11), no en estado local.',
          pozos: [
            {
              id: 'filtros',
              etiqueta: 'Campos a filtrar',
              tipo: 'dimension',
              max: 10,
              min: 1,
              ayuda: 'El tipo de selector de cada uno se elige en Formato.',
            },
          ],
        },
      ),
    ],
  },
  {
    objectId: 'segmentador',
    name: 'Segmentador',
    description: 'Filtro interactivo sobre los valores de una dimension.',
    category: 'filtro',
    versions: [
      v1('Version inicial: seleccion multiple sobre una dimension, reflejada en la URL.', {
        dimensions: { min: 1, max: 1 },
        measures: { min: 0, max: 0 },
        notes: 'Su seleccion se refleja en la query string (4.11), no en estado local.',
        pozos: [{ id: 'campo', etiqueta: 'Campo', tipo: 'dimension', max: 1, min: 1 }],
      }),
    ],
  },
  {
    objectId: 'tooltip-explicativo',
    name: 'Tooltip explicativo',
    description:
      'Icono que, al posarse o al enfocarlo, explica que representa el objeto entero. No es el ' +
      'tooltip de eje ni el de un punto de datos.',
    category: 'complemento',
    attachable: true,
    versions: [
      v1('Version inicial: icono con explicacion del contenido visual del objeto anfitrion.', {
        // Un complemento no se enlaza contra el dataset: lee el del objeto al que se adjunta.
        // Por eso su contrato de datos es vacio, y no "una dimension cualquiera".
        dimensions: { min: 0, max: 0 },
        measures: { min: 0, max: 0 },
        notes: 'No se enlaza contra ningun dataset: acompaña al objeto anfitrion.',
      }),
    ],
  },
  {
    objectId: 'tabla-de-datos',
    name: 'Tabla de datos',
    description:
      'Emergente con los datos de origen del objeto. Con alcance de objeto muestra todas sus ' +
      'filas; con alcance de subobjeto, solo las que hay detras de la categoria elegida.',
    category: 'complemento',
    attachable: true,
    versions: [
      v1('Version inicial: alcance de objeto y de subobjeto sobre el dataset del anfitrion.', {
        dimensions: { min: 0, max: 0 },
        measures: { min: 0, max: 0 },
        notes: 'Lee el dataset del objeto anfitrion, ya filtrado por el ambito de quien mira.',
      }),
    ],
  },
  {
    objectId: 'mapa',
    name: 'Mapa',
    description: 'Distribucion geografica de una medida por division territorial.',
    category: 'mapa',
    versions: [
      // Declarado sin implementacion de render: necesita la cartografia oficial de las
      // divisiones territoriales, que todavia no se ha acordado con la institucion. Se declara
      // en el catalogo para que el editor lo muestre como no disponible, en vez de omitirlo y
      // dar la impresion de que no estaba previsto.
      v1('Version inicial: contrato declarado. Render pendiente de la cartografia oficial.', {
        dimensions: { min: 1, max: 1 },
        measures: { min: 1, max: 1 },
        notes: 'La dimension debe ser una division territorial reconocida por la cartografia.',
      }),
    ],
  },
];
