import { MIN_PRESENTATION, type PresentationKey } from '../presentation/contract';
import type { FieldSlot } from '../presentation/wells';
import type { ObjectCertification, VisualObjectDefinition } from './types';

/** Catalogo de objetos prediseñados — seccion 4.2. */

const initialCertification: ObjectCertification = {
  testsPassed: true,
  reviewedBy: 'equipo-plataforma',
  reviewedAt: '2026-09-11',
};

/** Lo que admite cualquier objeto, mas lo que anada el suyo. */
const presenta = (...propias: PresentationKey[]): PresentationKey[] => [
  ...MIN_PRESENTATION,
  ...propias,
];

/** El contrato de un objeto que NO consume datos. */
const WITHOUT_DATA = (notes: string): VisualObjectDefinition['versions'][number]['dataContract'] => ({
  dimensions: { min: 0, max: 0 },
  measures: { min: 0, max: 0 },
  notes,
  wells: [],
});

const v1 = (
  changelog: string,
  dataContract: VisualObjectDefinition['versions'][number]['dataContract'],
  presentation: PresentationKey[] = MIN_PRESENTATION,
) => ({
  version: '1.0.0',
  publishedAt: '2026-09-11',
  changelog,
  certification: initialCertification,
  dataContract,
  presentation,
});

/** Los pozos de un grafico de barras, parametrizados por cuantas medidas admite la version. */
const BAR_WELLS = (medidas: number): FieldSlot[] => [
  {
    id: 'eje-x',
    etiqueta: 'Eje X',
    tipo: 'dimension',
    max: 1,
    // Obligatorio: un grafico de barras sin eje de categorias no se puede dibujar. El contrato
    // global dice «entre 1 y 2 dimensiones» y se cumple igual con la dimension en la serie, que es
    // justo el caso que no vale.
    min: 1,
    help: 'La dimension que reparte las barras.',
  },
  {
    id: 'serie',
    etiqueta: 'Serie',
    tipo: 'dimension',
    max: 1,
    help: 'Opcional. Agrupa las barras de cada categoria.',
  },
  {
    id: 'eje-y',
    etiqueta: 'Eje Y',
    tipo: 'medida',
    max: medidas,
    min: 1,
    help: medidas > 1 ? 'Una serie por medida.' : 'La cifra que mide el alto de la barra.',
  },
];

/** El contrato de datos de la tarjeta KPI, compartido por sus dos versiones. */
/** Lo que admite presentar una tabla o una matriz. El color por valor es aqui donde mas se usa. */
const TABLE_PRESENTATION = presenta('formato', 'formatos', 'conditional');

const KPI_CONTRACT: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 0, max: 1 },
  measures: { min: 1, max: 2 },
  notes: 'La primera medida es el valor; la segunda, opcional, es la comparacion.',
  wells: [
    { id: 'valor', etiqueta: 'Valor', tipo: 'medida', max: 1, min: 1, help: 'La cifra grande de la tarjeta.' },
    {
      id: 'comparacion',
      etiqueta: 'Comparacion',
      tipo: 'medida',
      max: 1,
      help: 'Opcional. La variacion se calcula contra esta.',
    },
    {
      id: 'detalle',
      etiqueta: 'Detalle',
      tipo: 'dimension',
      max: 1,
      help: 'Opcional. Desglosa la cifra en la tabla de datos adjunta.',
    },
  ],
};

/*
 * Lo que un grafico deja personalizar, en un solo sitio.
 */
const LINE_WELLS: FieldSlot[] = [
  {
    id: 'eje-x',
    etiqueta: 'Eje X',
    tipo: 'dimension',
    max: 1,
    min: 1,
    help: 'La dimension ordenada sobre la que avanza la linea.',
  },
  { id: 'eje-y', etiqueta: 'Eje Y', tipo: 'medida', max: 4, min: 1, help: 'Una linea por medida.' },
];

/** El pozo que reparte los pequenos multiplos. */
const MULTIPLE_WELL: FieldSlot = {
  id: 'multiplo',
  etiqueta: 'Multiplos',
  tipo: 'dimension',
  max: 1,
  help: 'Opcional. Repite el grafico una vez por cada valor de esta dimension.',
};

/** Lo que admite presentar un grafico que puede repetirse en paneles. */
const CHART_PRESENTATION = presenta(
  'formato',
  'formatos',
  'legend',
  'datumLabels',
  'axes',
  'orden',
  'apilado',
  'references',
  'seriesColors',
  'tooltip',
  'multiples',
);

/** CONGELADA. Lo que admite presentar una version YA PUBLICADA no vuelve a crecer. */
const CONDITIONAL_PRESENTATION_CHART = presenta(
  'formato',
  'formatos',
  'legend',
  'datumLabels',
  'axes',
  'orden',
  'apilado',
  'references',
  'seriesColors',
  'tooltip',
  'multiples',
  'conditional',
);

/** El contrato de un combinado, compartido por sus versiones. */
const CONTRACT_COMBO: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 1, max: 1 },
  measures: { min: 2, max: 6 },
  notes:
    'Las medidas del pozo Columnas se dibujan como barras; las del pozo Lineas, como ' +
    'linea. Con eje secundario, la linea se mide en la escala de la derecha.',
  wells: [
    {
      id: 'eje-x',
      etiqueta: 'Eje X',
      tipo: 'dimension',
      max: 1,
      min: 1,
      help: 'La dimension que reparte las columnas.',
    },
    {
      id: 'columnas',
      etiqueta: 'Columnas',
      tipo: 'medida',
      max: 3,
      min: 1,
      help: 'Las medidas que se dibujan como barras.',
    },
    {
      id: 'lineas',
      etiqueta: 'Lineas',
      tipo: 'medida',
      max: 3,
      min: 1,
      help: 'Las medidas que se dibujan como linea.',
    },
  ],
};

/** Lo que admite presentar un combinado en su version inicial. */
const COMBINED_PRESENTATION = presenta(
  'formato',
  'formatos',
  'legend',
  'datumLabels',
  'axes',
  'orden',
  'combinado',
  'references',
  'seriesColors',
  'tooltip',
);

/** El contrato de la matriz jerarquica, compartido por 1.1.0 y 1.2.0. */
const MATRIX_CONTRACT: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 1, max: 5 },
  measures: { min: 1, max: 4 },
  notes:
    'Las dimensiones de fila anidan en el orden en que se mapean, y las de columna igual. ' +
    'Cada nivel trae su subtotal, calculado sobre las filas de origen.',
  wells: [
    { id: 'filas', etiqueta: 'Filas', tipo: 'dimension', max: 3, min: 1 },
    {
      id: 'columnas',
      etiqueta: 'Columnas',
      tipo: 'dimension',
      max: 2,
      help: 'Opcional. Sin ninguna, la matriz es una tabla agrupada por sus filas.',
    },
    { id: 'valores', etiqueta: 'Valores', tipo: 'medida', max: 4, min: 1 },
  ],
};

/**
 * El contrato de las barras horizontales, compartido por sus versiones.
 *
 * Mismo motivo: 1.0.0 y 1.1.0 piden los mismos campos y solo cambian en el formato condicional.
 */
const H_BAR_CONTRACT: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 1, max: 2 },
  measures: { min: 1, max: 4 },
  notes: 'Cada medida es una serie. La segunda dimension, si existe, agrupa las barras.',
  wells: BAR_WELLS(4),
};

/** Lo que un circular admite presentar. */
const PIE_PRESENTATION = presenta('formato', 'formatos', 'legend', 'circular');

/** El contrato de un circular, compartido por el pastel y la dona. */
const PIE_CONTRACT: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 1, max: 1 },
  measures: { min: 1, max: 1 },
  notes: 'Las porciones suman el total de la medida. Un valor nulo no se dibuja: no es cero.',
  wells: [
    {
      id: 'categoria',
      etiqueta: 'Categoria',
      tipo: 'dimension',
      max: 1,
      min: 1,
      help: 'La dimension que reparte las porciones.',
    },
    {
      id: 'valor',
      etiqueta: 'Valor',
      tipo: 'medida',
      max: 1,
      min: 1,
      help: 'El tamano de cada porcion.',
    },
  ],
};

export const initialCatalog: VisualObjectDefinition[] = [
  {
    objectId: 'tarjeta-kpi',
    family: 'value',
    icono: 'indicador',
    name: 'Tarjeta KPI',
    description: 'Un unico valor destacado, con su etiqueta y una variacion opcional.',
    category: 'indicador',
    versions: [
      v1(
        'Version inicial: valor agregado, etiqueta y variacion respecto del periodo anterior.',
        KPI_CONTRACT,
        // Una tarjeta es una cifra: el formato es lo que mas cambia de una a otra —casos enteros,
        // porcentajes con un decimal, importes compactos—. No tiene leyenda ni etiquetas de dato,
        // porque no tiene series ni puntos.
        presenta('formato', 'formatos'),
      ),
      /*
       * 1.1.0 — la etiqueta que acompana al valor.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog: 'Admite la etiqueta que acompana al valor, encima o debajo.',
        certification: initialCertification,
        dataContract: KPI_CONTRACT,
        presentation: presenta('formato', 'formatos', 'etiqueta'),
      },
      /*
       * 1.2.0 — formato condicional.
       */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: la cifra cambia de color segun su valor.',
        certification: initialCertification,
        dataContract: KPI_CONTRACT,
        presentation: presenta('formato', 'formatos', 'etiqueta', 'conditional'),
      },
    ],
  },
  {
    objectId: 'tabla',
    family: 'detail',
    icono: 'tabla',
    name: 'Tabla',
    description: 'Filas y columnas con las dimensiones y medidas mapeadas.',
    category: 'tabla',
    versions: [
      v1(
        'Version inicial: formato numerico por medida.',
        {
          dimensions: { min: 0, max: 6 },
          measures: { min: 0, max: 10 },
          wells: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 6 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 10 },
          ],
        },
        presenta('formato', 'formatos'),
      ),
      /*
       * 1.1.0 — orden por encabezado, mas columnas, y estilo de texto.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-12',
        changelog:
          'Orden ascendente y descendente pulsando el encabezado, filas alternas, y hasta ocho ' +
          'dimensiones y doce medidas.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 0, max: 8 },
          measures: { min: 0, max: 12 },
          wells: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 8 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 12 },
          ],
        },
        presentation: presenta('formato', 'formatos'),
      },
      /* 1.2.0 — formato condicional. En una tabla es donde mas se usa: la celda que se sale. */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: el color de una cifra puede depender de su valor.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 0, max: 8 },
          measures: { min: 0, max: 12 },
          wells: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 8 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 12 },
          ],
        },
        presentation: TABLE_PRESENTATION,
      },
      /*
       * 1.3.0 — la ayuda de mapeo, que era lo unico que a la tabla le faltaba.
       */
      {
        version: '1.3.0',
        publishedAt: '2026-09-13',
        changelog: 'Ayuda de mapeo en el editor: que va en cada pozo y que pasa si se deja vacio.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 0, max: 8 },
          measures: { min: 0, max: 12 },
          notes:
            'Cada dimension es una columna de detalle y cada medida una columna de cifra. Sin ' +
            'ninguna dimension la tabla devuelve una sola fila con los totales.',
          wells: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 8 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 12 },
          ],
        },
        presentation: TABLE_PRESENTATION,
      },
    ],
  },
  {
    objectId: 'barras',
    family: 'comparison',
    icono: 'barras',
    /*
     * «Columnas», no «barras». El identificador se queda en `barras` porque ES el contrato (4.5):
     * las instancias lo fijan, y renombrarlo romperia todo modulo publicado. El nombre visible no
     * forma parte de ese contrato y por eso si se corrige.
     */
    name: 'Grafico de columnas',
    description: 'Columnas verticales. Compara una o varias medidas entre las categorias de una dimension.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: barras verticales, una serie.',
        {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 1 },
          notes: 'La segunda dimension, si existe, agrupa las barras por serie.',
          wells: BAR_WELLS(1),
        },
        presenta('formato', 'formatos', 'legend', 'datumLabels'),
      ),
      /*
       * 1.1.0 — varias medidas, como ya admitia `lineas`.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-12',
        changelog:
          'Admite hasta cuatro medidas: una serie por medida, con leyenda y un patron por serie.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La segunda dimension, si existe, agrupa las barras por serie.',
          wells: BAR_WELLS(4),
        },
        presentation: presenta('formato', 'formatos', 'legend', 'datumLabels'),
      },
      /*
       * 1.2.0 — la personalizacion que se configuraba y no llegaba al grafico.
       */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog:
          'Leyenda con posicion, etiquetas de dato formateadas, ejes configurables y orden del eje.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La segunda dimension, si existe, agrupa las columnas por serie.',
          wells: BAR_WELLS(4),
        },
        presentation: CHART_PRESENTATION,
      },
      /*
       * 1.3.0 — pequenos multiplos.
       */
      {
        version: '1.3.0',
        publishedAt: '2026-09-13',
        changelog: 'Pequenos multiplos: el grafico se repite por cada valor de una dimension.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 3 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La dimension de multiplos, si existe, reparte el objeto en ' +
            'un panel por valor; la de serie agrupa las columnas dentro de cada panel.',
          wells: [...BAR_WELLS(4), MULTIPLE_WELL],
        },
        presentation: CHART_PRESENTATION,
      },
      /*
       * 1.4.0 — formato condicional.
       */
      {
        version: '1.4.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: el color de cada barra puede depender de su valor.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 3 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La dimension de multiplos, si existe, reparte el objeto en ' +
            'un panel por valor; la de serie agrupa las columnas dentro de cada panel.',
          wells: [...BAR_WELLS(4), MULTIPLE_WELL],
        },
        presentation: CONDITIONAL_PRESENTATION_CHART,
      },
    ],
  },
  {
    /*
     * El «grafico de barras» de verdad: horizontales.
     */
    objectId: 'barras-horizontales',
    family: 'comparison',
    icono: 'barras-horizontales',
    name: 'Grafico de barras',
    description: 'Barras horizontales. Para categorias con nombres largos o muchas categorias.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: barras horizontales, hasta cuatro medidas, con apilado y 100 %.',
        H_BAR_CONTRACT,
        CHART_PRESENTATION,
      ),
      /*
       * 1.1.0 — formato condicional, que las columnas tienen desde su 1.4.0.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: el color de una barra puede depender de su valor.',
        certification: initialCertification,
        dataContract: H_BAR_CONTRACT,
        presentation: CONDITIONAL_PRESENTATION_CHART,
      },
    ],
  },
  {
    /*
     * Pastel y dona son DOS entradas del catalogo y UN solo dibujo.
     */
    objectId: 'pastel',
    family: 'proportion',
    icono: 'pastel',
    name: 'Grafico circular (pastel)',
    description: 'La parte que representa cada categoria sobre el total.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: porciones ordenadas, etiquetas de detalle y tooltip con cifra y parte.',
        PIE_CONTRACT,
        PIE_PRESENTATION,
      ),
    ],
  },
  {
    objectId: 'dona',
    family: 'proportion',
    icono: 'dona',
    name: 'Grafico de anillos (dona)',
    description: 'Lo mismo que el circular, con el total en el centro.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: anillo con hueco del 55 % y total en el centro.',
        PIE_CONTRACT,
        PIE_PRESENTATION,
      ),
    ],
  },
  {
    objectId: 'medidor',
    family: 'value',
    icono: 'medidor',
    name: 'Medidor (tacometro)',
    description: 'Una cifra contra su meta, sobre una escala fija.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: aguja, marca de objetivo y escala fija o deducida.',
        {
          dimensions: { min: 0, max: 0 },
          measures: { min: 1, max: 2 },
          notes:
            'La primera medida es el valor; la segunda, opcional, es el objetivo. Sin dimensiones: ' +
            'un medidor dibuja UNA cifra, y repartirla por categorias es otro objeto.',
          wells: [
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'La cifra que mueve la aguja.',
            },
            {
              id: 'objetivo',
              etiqueta: 'Objetivo',
              tipo: 'medida',
              max: 1,
              help: 'Opcional. Si no se mapea, se puede fijar a mano en Formato.',
            },
          ],
        },
        presenta('formato', 'formatos', 'medidor'),
      ),
    ],
  },
  {
    /*
     * Combinado — la pregunta que hoy obliga a poner dos objetos juntos.
     */
    objectId: 'combinado',
    family: 'relation',
    icono: 'combinado',
    name: 'Grafico combinado de columnas y lineas',
    description: 'Dos grupos de medidas en el mismo eje, con eje secundario opcional.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: columnas y lineas por pozo, con eje secundario opcional.',
        CONTRACT_COMBO,
        COMBINED_PRESENTATION,
      ),
      /*
       * 1.1.0 — apilado, que el constructor ya honraba.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog: 'Las columnas se pueden apilar, tambien al 100 %.',
        certification: initialCertification,
        dataContract: CONTRACT_COMBO,
        presentation: [...COMBINED_PRESENTATION, 'apilado'],
      },
    ],
  },
  {
    /*
     * Dispersion — el unico objeto donde la dimension NO reparte el eje.
     */
    objectId: 'dispersion',
    family: 'relation',
    icono: 'dispersion',
    name: 'Grafico de dispersion',
    description: 'Dos medidas enfrentadas, un punto por categoria. La tercera da el tamano.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: eje X y eje Y como medidas, con tamano opcional.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 2, max: 3 },
          notes: 'Cada valor de la dimension es un punto. La tercera medida, si esta, es el tamano.',
          wells: [
            {
              id: 'punto',
              etiqueta: 'Punto',
              tipo: 'dimension',
              max: 1,
              min: 1,
              help: 'Cada valor de esta dimension es un punto del grafico.',
            },
            {
              id: 'eje-x',
              etiqueta: 'Eje X',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'La medida horizontal.',
            },
            {
              id: 'eje-y',
              etiqueta: 'Eje Y',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'La medida vertical.',
            },
            {
              id: 'tamano',
              etiqueta: 'Tamano',
              tipo: 'medida',
              max: 1,
              help: 'Opcional. Reparte el diametro del punto entre un minimo y un maximo.',
            },
          ],
        },
        presenta('formato', 'formatos', 'datumLabels', 'axes', 'references'),
      ),
    ],
  },
  {
    /*
     * Embudo — etapas de un proceso, en SU orden.
     */
    objectId: 'embudo',
    family: 'proportion',
    icono: 'embudo',
    name: 'Grafico de embudo',
    description: 'La caida entre etapas de un proceso, en el orden en que ocurren.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: etapas sin reordenar, con la caida contra la primera o la anterior.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 1 },
          notes: 'El orden de las etapas es el del dataset: ordenar por tamano destruiria el proceso.',
          wells: [
            {
              id: 'etapa',
              etiqueta: 'Etapa',
              tipo: 'dimension',
              max: 1,
              min: 1,
              help: 'La dimension que ordena las etapas.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'La cifra de cada etapa.',
            },
          ],
        },
        presenta('formato', 'formatos', 'legend', 'orden', 'embudo'),
      ),
    ],
  },
  {
    /*
     * Cascada — de que se compone una diferencia.
     */
    objectId: 'cascada',
    family: 'proportion',
    icono: 'cascada',
    name: 'Grafico de cascada',
    description: 'Como cada categoria suma o resta hasta el total.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: contribuciones encadenadas, con signo en la etiqueta y total opcional.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 1 },
          notes: 'Los valores se encadenan: cada barra empieza donde acabo la anterior.',
          wells: [
            {
              id: 'categoria',
              etiqueta: 'Categoria',
              tipo: 'dimension',
              max: 1,
              min: 1,
              help: 'Lo que aporta cada barra.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'Cuanto suma o resta. Negativo baja.',
            },
          ],
        },
        presenta('formato', 'formatos', 'axes', 'orden', 'cascada', 'references'),
      ),
    ],
  },
  {
    /*
     * Mapa de arbol — la composicion cuando hay demasiadas partes para un circular.
     */
    objectId: 'mapa-de-arbol',
    family: 'proportion',
    icono: 'arbol',
    name: 'Mapa de arbol',
    description: 'Composicion con muchas categorias, y con jerarquia si hay dos dimensiones.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: uno o dos niveles, con el area proporcional a la medida.',
        {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 1 },
          notes: 'Con dos dimensiones, la primera agrupa y la segunda reparte dentro de cada grupo.',
          wells: [
            {
              id: 'grupo',
              etiqueta: 'Grupo',
              tipo: 'dimension',
              max: 1,
              min: 1,
              help: 'El primer nivel: cada valor es un bloque.',
            },
            {
              id: 'detalle',
              etiqueta: 'Detalle',
              tipo: 'dimension',
              max: 1,
              help: 'Opcional. El segundo nivel, dentro de cada bloque.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'El area de cada rectangulo.',
            },
          ],
        },
        presenta('formato', 'formatos', 'datumLabels'),
      ),
    ],
  },
  {
    objectId: 'area',
    family: 'trend',
    icono: 'area',
    name: 'Grafico de area',
    description: 'Una linea con el volumen debajo. Apilada, ensena de que se compone un total.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: area simple, apilada y al 100 %.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 4 },
          notes: 'Apilada responde a «de que se compone ese total», que con lineas hay que sumar.',
          wells: LINE_WELLS,
        },
        CHART_PRESENTATION,
      ),
    ],
  },
  {
    objectId: 'lineas',
    family: 'trend',
    icono: 'lineas',
    name: 'Grafico de lineas',
    description: 'Evolucion de una o varias medidas a lo largo de una dimension ordenada.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: una linea por medida sobre el eje de la primera dimension.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 4 },
          wells: LINE_WELLS,
        },
        presenta('formato', 'formatos', 'legend', 'datumLabels'),
      ),
      /* 1.1.0 — la misma personalizacion que columnas, por el mismo motivo. */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog:
          'Leyenda con posicion, etiquetas de dato formateadas, ejes configurables y orden del eje.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 4 },
          wells: LINE_WELLS,
        },
        presentation: CHART_PRESENTATION,
      },
      /* 1.2.0 — pequenos multiplos, por lo mismo que en columnas. */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog: 'Pequenos multiplos: una linea por panel, con escala comun.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes: 'La dimension de multiplos reparte el objeto en un panel por valor.',
          wells: [...LINE_WELLS, MULTIPLE_WELL],
        },
        presentation: CHART_PRESENTATION,
      },
    ],
  },
  {
    objectId: 'matriz',
    family: 'detail',
    icono: 'tabla',
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
          wells: [
            { id: 'filas', etiqueta: 'Filas', tipo: 'dimension', max: 1, min: 1 },
            { id: 'columnas', etiqueta: 'Columnas', tipo: 'dimension', max: 1, min: 1 },
            { id: 'valores', etiqueta: 'Valores', tipo: 'medida', max: 1, min: 1 },
          ],
        },
        presenta('formato', 'formatos'),
      ),
      /*
       * 1.1.0 — jerarquia.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-12',
        changelog:
          'Jerarquia en filas y columnas (hasta tres y dos niveles), varias medidas, subtotales ' +
          'por nivel, colapsar y expandir, y orden por cualquier encabezado.',
        certification: initialCertification,
        dataContract: MATRIX_CONTRACT,
        presentation: presenta('formato', 'formatos'),
      },
      /*
       * 1.2.0 — formato condicional, que la tabla tiene desde su 1.2.0.
       */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: el color de una cifra puede depender de su valor.',
        certification: initialCertification,
        dataContract: MATRIX_CONTRACT,
        presentation: TABLE_PRESENTATION,
      },
    ],
  },
  {
    objectId: 'panel-de-filtros',
    family: 'control',
    icono: 'filtro',
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
          wells: [
            {
              id: 'filtros',
              etiqueta: 'Campos a filtrar',
              tipo: 'dimension',
              max: 10,
              min: 1,
              help: 'El tipo de selector de cada uno se elige en Formato.',
            },
          ],
        },
      ),
    ],
  },
  {
    objectId: 'navegador-de-pagina',
    family: 'control',
    icono: 'arbol',
    name: 'Navegador de pagina',
    description:
      'Como se pasa de una pagina de un modulo a otra: panel a la izquierda, a la derecha, ' +
      'pestanas debajo o un menu. Obligatorio en cuanto el modulo tiene mas de una pagina.',
    category: 'navegacion',
    versions: [
      v1(
        'Version inicial: cuatro tipos, tres comportamientos de panel y seccion de filtros.',
        {
          // Cero y cero: el navegador no lee datos POR SI MISMO. Su seccion de filtros si, y por
          // eso la seccion lleva su propio dataset en la configuracion en vez de forzar al
          // navegador entero a declarar un mapeo que casi nunca usa.
          dimensions: { min: 0, max: 0 },
          measures: { min: 0, max: 0 },
          notes:
            'No se coloca en el lienzo: se elige en la configuracion del modulo y se dibuja ' +
            'alrededor de la pagina que se abra. Los dos paneles admiten una seccion de filtros ' +
            'con los mismos selectores que el panel de filtros.',
          wells: [],
        },
      ),
    ],
  },
  {
    objectId: 'segmentador',
    family: 'control',
    icono: 'filtro',
    name: 'Segmentador',
    description: 'Filtro interactivo sobre los valores de una dimension.',
    category: 'filtro',
    versions: [
      v1('Version inicial: seleccion multiple sobre una dimension, reflejada en la URL.', {
        dimensions: { min: 1, max: 1 },
        measures: { min: 0, max: 0 },
        notes: 'Su seleccion se refleja en la query string (4.11), no en estado local.',
        wells: [{ id: 'campo', etiqueta: 'Campo', tipo: 'dimension', max: 1, min: 1 }],
      }),
    ],
  },
  {
    objectId: 'tooltip-explicativo',
    icono: 'informacion',
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
    icono: 'datos',
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
    objectId: 'filtro-de-visualizacion',
    icono: 'filtro',
    name: 'Filtro de visualizacion',
    description:
      'Acota SOLO este objeto, por uno de los campos que el mismo mapea. No mueve la pagina: ' +
      'para eso estan el segmentador y el panel de filtros.',
    category: 'complemento',
    attachable: true,
    versions: [
      v1('Version inicial: seleccion sobre un campo mapeado por el anfitrion, reflejada en la URL.', {
        dimensions: { min: 0, max: 0 },
        measures: { min: 0, max: 0 },
        notes:
          'El campo base se elige entre los que el anfitrion ya mapea. Uno cualquiera del ' +
          'dataset lo convertiria en un filtro general disfrazado de complemento.',
      }),
    ],
  },
  {
    objectId: 'pie-de-pagina',
    icono: 'pie-de-pagina',
    name: 'Pie de pagina',
    description:
      'Nota al pie del objeto, fija o con cifras dentro. Las cifras se referencian por su orden ' +
      'de mapeo: {{1}} es la primera medida mapeada.',
    category: 'complemento',
    attachable: true,
    versions: [
      v1('Version inicial: texto con referencias {{n}} a las medidas mapeadas por el anfitrion.', {
        dimensions: { min: 0, max: 0 },
        measures: { min: 0, max: 0 },
        notes: 'Las cifras se resuelven sobre lo que el objeto tiene delante, ya filtrado.',
      }),
    ],
  },
  {
    objectId: 'paginado',
    icono: 'paginado',
    name: 'Paginado',
    description:
      'Parte lo que el objeto ensena en paginas del tamano elegido, con selector y con la ' +
      'coletilla de «Registros del N al N. Total N».',
    category: 'complemento',
    attachable: true,
    versions: [
      v1('Version inicial: registros por pagina, selector de pagina y coletilla con su posicion.', {
        dimensions: { min: 0, max: 0 },
        measures: { min: 0, max: 0 },
        notes:
          'Pagina por combinacion distinta de las dimensiones mapeadas: un registro en una ' +
          'tabla, una categoria en un grafico.',
      }),
    ],
  },
  {
    objectId: 'mapa',
    family: 'location',
    icono: 'lugar',
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
      /*
       * 1.1.0 — pozos con nombre, que era el unico objeto de datos que no los declaraba.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog: 'Pozos con nombre: Territorio y Valor. El render sigue pendiente.',
        certification: initialCertification,
        dataContract: {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 1 },
          notes: 'La dimension debe ser una division territorial reconocida por la cartografia.',
          wells: [
            {
              id: 'territorio',
              etiqueta: 'Territorio',
              tipo: 'dimension',
              max: 1,
              min: 1,
              help: 'La division territorial que colorea el mapa.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              help: 'La cifra que decide la intensidad del color.',
            },
          ],
        },
        presentation: presenta('formato', 'formatos'),
      },
    ],
  },
  /* ── Elementos: no se enlazan a ningun dataset ───────────────────────────────────────── */

  {
    objectId: 'cuadro-de-texto',
    icono: 'content',
    name: 'Cuadro de texto',
    description: 'Texto con formato: notas, aclaraciones, contexto. No consume datos.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: parrafos con negrita, cursiva, subrayado, alineacion y color.',
        WITHOUT_DATA('Escribe texto. El enlace a un dataset llegara como intercalado de medidas.'),
      ),
    ],
  },
  {
    objectId: 'titulo-de-seccion',
    icono: 'titulo',
    name: 'Titulo de seccion',
    description: 'Encabeza un grupo de objetos, con lineas que se adaptan al ancho disponible.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: lineas configurables a izquierda, derecha, ambos lados, arriba o abajo.',
        WITHOUT_DATA('Ocupa el ancho que se le de. Las lineas se reparten lo que sobra del texto.'),
      ),
    ],
  },
  {
    objectId: 'linea-divisoria',
    icono: 'line',
    name: 'Linea divisoria',
    description: 'Una linea horizontal o vertical, para separar bloques.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: horizontal o vertical, con estilo, grosor y color.',
        WITHOUT_DATA('Va en el hueco entre celdas: una fila de alto uno, o una columna de ancho uno.'),
      ),
    ],
  },
  {
    objectId: 'forma',
    icono: 'forma',
    name: 'Forma',
    description: 'Rectangulo, cuadrado, triangulo, circulo, rombo o flecha.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: seis formas con relleno, trazo, opacidad, radio y texto interior.',
        WITHOUT_DATA('El relleno y el trazo son roles del tema, no colores sueltos (4.3).'),
      ),
    ],
  },
  {
    objectId: 'conexion',
    icono: 'conexion',
    name: 'Conexion',
    description: 'Conector tipo diagrama de flujo entre dos objetos del modulo.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: recto, en angulo o curvo, con extremos y rotulo.',
        WITHOUT_DATA('Guarda los ids de los dos objetos, no coordenadas: sigue pegado al moverlos.'),
      ),
    ],
  },

  /* ── Contenedores: agrupan otros objetos ─────────────────────────────────────────────── */

  {
    objectId: 'contenedor-simple',
    icono: 'contenedor',
    name: 'Contenedor simple',
    description: 'Agrupa elementos y visualizaciones en su propia rejilla.',
    category: 'contenedor',
    versions: [
      v1('Version inicial: rejilla interna propia, con titulo, subtitulo e icono opcionales.',
        WITHOUT_DATA('Los hijos se posicionan contra la rejilla del contenedor, no la del modulo.')),
    ],
  },
  {
    objectId: 'contenedor-desplazable',
    icono: 'contenedor',
    name: 'Contenedor desplazable',
    description: 'Como el simple, pero su contenido se desplaza por UN eje: X o Y, nunca los dos.',
    category: 'contenedor',
    versions: [
      v1('Version inicial: desplazamiento por un solo eje, configurable.',
        WITHOUT_DATA('Dos barras a la vez convierten buscar contenido en un plano en vez de una linea.')),
    ],
  },
  {
    objectId: 'contenedor-ampliable',
    icono: 'expandir',
    name: 'Contenedor ampliable',
    description: 'Ensena parte de su contenido y se amplia a una ventana con su propia rejilla.',
    category: 'contenedor',
    versions: [
      v1('Version inicial: vista reducida en la rejilla y ventana ampliada independiente.',
        WITHOUT_DATA('La rejilla de la ventana no es la de la tarjeta: caben otras cosas y de otra forma.')),
    ],
  },
  {
    objectId: 'contenedor-expandible',
    icono: 'chevron-abajo',
    name: 'Contenedor expandible',
    description:
      'Un chiclet de una fila que al pulsarlo se abre en su sitio y empuja hacia abajo lo que tiene debajo.',
    category: 'contenedor',
    versions: [
      v1(
        'Version inicial: chiclet de una fila, rejilla interna propia y N filas configurables al abrir.',
        WITHOUT_DATA(
          'No tapa nada: crece dentro de la rejilla del modulo y lo de abajo se desplaza. Es lo que lo distingue del ampliable, que abre una ventana encima.',
        ),
      ),
    ],
  },
  {
    objectId: 'contenedor-con-pestanas',
    icono: 'tabs',
    name: 'Contenedor con pestanas',
    description: 'Varias pestanas, cada una con su propio contenido y su propia disposicion.',
    category: 'contenedor',
    versions: [
      v1('Version inicial: pestanas con disposicion independiente y tamano fijo del contenedor.',
        WITHOUT_DATA('Cambiar de pestana no altera la posicion, las dimensiones ni el espacio ocupado.')),
    ],
  },
];
