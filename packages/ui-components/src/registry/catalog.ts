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

/**
 * El contrato de un objeto que NO consume datos.
 *
 * Cero dimensiones y cero medidas no es una limitacion que estos objetos tengan: es lo que los
 * DEFINE. Todo el camino de lectura —la validacion de esquema, la lista de datasets del modulo, la
 * consulta al cache— deduce de ahi que no hay nada que leer, en vez de mirar un interruptor aparte
 * que alguien pueda dejar en desacuerdo con el contrato.
 */
const SIN_DATOS = (notes: string): VisualObjectDefinition['versions'][number]['dataContract'] => ({
  dimensions: { min: 0, max: 0 },
  measures: { min: 0, max: 0 },
  notes,
  pozos: [],
});

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

/**
 * El contrato de datos de la tarjeta KPI, compartido por sus dos versiones.
 *
 * Se factoriza porque 1.0.0 y 1.1.0 solo se diferencian en lo que admiten PRESENTAR: escribirlo
 * dos veces invita a que alguien arregle un pozo en una version y se olvide de la otra, y
 * entonces la misma tarjeta pediria campos distintos segun la version que fije la instancia.
 */
/** Lo que admite presentar una tabla o una matriz. El color por valor es aqui donde mas se usa. */
const PRESENTACION_DE_TABLA = presenta('formato', 'formatos', 'condicional');

const CONTRATO_DE_KPI: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 0, max: 1 },
  measures: { min: 1, max: 2 },
  notes: 'La primera medida es el valor; la segunda, opcional, es la comparacion.',
  pozos: [
    { id: 'valor', etiqueta: 'Valor', tipo: 'medida', max: 1, min: 1, ayuda: 'La cifra grande de la tarjeta.' },
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
};

/*
 * Lo que un grafico deja personalizar, en un solo sitio.
 *
 * Se factoriza porque las versiones nuevas de columnas y lineas declaran exactamente lo mismo, y
 * con la lista escrita cuatro veces anadir una clave significaria acordarse de cuatro sitios —
 * que es como `etiqueta` acabo dibujandose en una tarjeta que no la declaraba.
 */
const POZOS_DE_LINEAS: RanuraDeCampos[] = [
  {
    id: 'eje-x',
    etiqueta: 'Eje X',
    tipo: 'dimension',
    max: 1,
    min: 1,
    ayuda: 'La dimension ordenada sobre la que avanza la linea.',
  },
  { id: 'eje-y', etiqueta: 'Eje Y', tipo: 'medida', max: 4, min: 1, ayuda: 'Una linea por medida.' },
];

/**
 * El pozo que reparte los pequenos multiplos.
 *
 * Va el ULTIMO de la lista, que es donde va lo opcional: al anadir un grafico, lo primero que hay
 * que rellenar es el eje, no una opcion avanzada que la mayoria no usa.
 *
 * Que sea el ultimo en el panel no significa que sea la ultima dimension al dibujar: ahi va
 * primero, porque `toCategorical` compone las etiquetas en el orden en que se le pasan y partirlas
 * supone que el primer trozo es el panel. Ese orden lo fija el render con su propio array, no la
 * posicion del pozo.
 *
 * Opcional: sin el, el objeto dibuja UN grafico, que es lo que hacia antes.
 */
const POZO_DE_MULTIPLO: RanuraDeCampos = {
  id: 'multiplo',
  etiqueta: 'Multiplos',
  tipo: 'dimension',
  max: 1,
  ayuda: 'Opcional. Repite el grafico una vez por cada valor de esta dimension.',
};

/** Lo que admite presentar un grafico que puede repetirse en paneles. */
const PRESENTACION_DE_GRAFICO = presenta(
  'formato',
  'formatos',
  'leyenda',
  'etiquetasDeDato',
  'ejes',
  'orden',
  'apilado',
  'referencias',
  'coloresDeSerie',
  'tooltip',
  'multiplos',
);

/**
 * CONGELADA. Lo que admite presentar una version YA PUBLICADA no vuelve a crecer.
 *
 * `PRESENTACION_DE_GRAFICO` esta compartida entre varias versiones, y por eso anadirle una clave
 * ampliaba en silencio lo que admiten versiones ya publicadas — justo lo que 4.5 cierra: la
 * version es lo que hace reproducible un modulo desplegado, y un objeto que hoy admite mas que
 * ayer con el mismo numero de version no lo es.
 *
 * A partir de aqui, una clave de presentacion nueva entra en una version NUEVA, con su lista
 * propia. La regla no es «cambia solo si rompe»: es que la version describe lo que el objeto
 * hacia el dia que se publico.
 */
const PRESENTACION_DE_GRAFICO_CON_CONDICIONAL = presenta(
  'formato',
  'formatos',
  'leyenda',
  'etiquetasDeDato',
  'ejes',
  'orden',
  'apilado',
  'referencias',
  'coloresDeSerie',
  'tooltip',
  'multiplos',
  'condicional',
);

/**
 * Lo que un circular admite presentar.
 *
 * NO lleva `ejes`, `apilado` ni `orden`: no tiene ejes, no apila nada, y su orden lo decide
 * `circular.ordenar` —de mayor a menor o el del modelo— que es una pregunta distinta de «por
 * categoria o por valor». Declararlas para no pensarlo dejaria opciones en el panel que no hacen
 * nada, que es de donde venimos.
 */
const PRESENTACION_CIRCULAR = presenta('formato', 'formatos', 'leyenda', 'circular');

/**
 * El contrato de un circular, compartido por el pastel y la dona.
 *
 * UNA dimension y UNA medida. Es la limitacion que hace que el objeto signifique algo: las
 * porciones tienen que sumar un total, y dos medidas no suman nada en comun. El resto de
 * herramientas lo permite y el resultado es un grafico que no se puede leer.
 */
const CONTRATO_CIRCULAR: VisualObjectDefinition['versions'][number]['dataContract'] = {
  dimensions: { min: 1, max: 1 },
  measures: { min: 1, max: 1 },
  notes: 'Las porciones suman el total de la medida. Un valor nulo no se dibuja: no es cero.',
  pozos: [
    {
      id: 'categoria',
      etiqueta: 'Categoria',
      tipo: 'dimension',
      max: 1,
      min: 1,
      ayuda: 'La dimension que reparte las porciones.',
    },
    {
      id: 'valor',
      etiqueta: 'Valor',
      tipo: 'medida',
      max: 1,
      min: 1,
      ayuda: 'El tamano de cada porcion.',
    },
  ],
};

export const catalogoInicial: VisualObjectDefinition[] = [
  {
    objectId: 'tarjeta-kpi',
    familia: 'valor',
    icono: 'indicador',
    name: 'Tarjeta KPI',
    description: 'Un unico valor destacado, con su etiqueta y una variacion opcional.',
    category: 'indicador',
    versions: [
      v1(
        'Version inicial: valor agregado, etiqueta y variacion respecto del periodo anterior.',
        CONTRATO_DE_KPI,
        // Una tarjeta es una cifra: el formato es lo que mas cambia de una a otra —casos enteros,
        // porcentajes con un decimal, importes compactos—. No tiene leyenda ni etiquetas de dato,
        // porque no tiene series ni puntos.
        presenta('formato', 'formatos'),
      ),
      /*
       * 1.1.0 — la etiqueta que acompana al valor.
       *
       * `etiqueta` se anadio al contrato de presentacion, al panel y al renderizador, pero NO a
       * esta lista: la tarjeta dibujaba una etiqueta que su propia version no declaraba admitir, y
       * la validacion del editor marcaba rota cualquier tarjeta que la usara. No se vio en pantalla
       * porque el camino de LECTURA no comprueba la presentacion —solo el del editor lo hace—, y
       * ninguna prueba abria el editor sobre un modulo con etiquetas.
       *
       * Version nueva y no un retoque de la 1.0.0: publicar no altera lo ya desplegado (4.5).
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog: 'Admite la etiqueta que acompana al valor, encima o debajo.',
        certification: certificacionInicial,
        dataContract: CONTRATO_DE_KPI,
        presentation: presenta('formato', 'formatos', 'etiqueta'),
      },
      /*
       * 1.2.0 — formato condicional.
       *
       * En una tarjeta es donde mas se nota: la cifra ES el objeto, y que cambie de color cuando
       * se pasa del umbral convierte un numero en un aviso.
       */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: la cifra cambia de color segun su valor.',
        certification: certificacionInicial,
        dataContract: CONTRATO_DE_KPI,
        presentation: presenta('formato', 'formatos', 'etiqueta', 'condicional'),
      },
    ],
  },
  {
    objectId: 'tabla',
    familia: 'detalle',
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
          pozos: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 6 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 10 },
          ],
        },
        presenta('formato', 'formatos'),
      ),
      /*
       * 1.1.0 — orden por encabezado, mas columnas, y estilo de texto.
       *
       * El changelog de 1.0.0 decia «columnas ordenables» y la capacidad no existia: un encabezado
       * que no responde ensena que la tabla no se ordena, y quien lo prueba una vez no lo vuelve a
       * intentar. Se corrige el changelog de 1.0.0 —describia algo que no hacia— y la capacidad
       * llega aqui, con su version.
       *
       * Version nueva y no un retoque de 1.0.0, aunque ampliar un maximo no rompa a nadie. La
       * regla de 4.5 no es «cambia solo si rompe»: es que la version es lo que hace reproducible
       * un modulo ya desplegado. La primera vez que escribi esto subi los limites dentro de 1.0.0,
       * que es exactamente lo que 4.5 prohibe.
       */
      {
        version: '1.1.0',
        publishedAt: '2026-09-12',
        changelog:
          'Orden ascendente y descendente pulsando el encabezado, filas alternas, y hasta ocho ' +
          'dimensiones y doce medidas.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 0, max: 8 },
          measures: { min: 0, max: 12 },
          pozos: [
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
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 0, max: 8 },
          measures: { min: 0, max: 12 },
          pozos: [
            { id: 'columnas-dim', etiqueta: 'Columnas de detalle', tipo: 'dimension', max: 8 },
            { id: 'columnas-med', etiqueta: 'Columnas de cifra', tipo: 'medida', max: 12 },
          ],
        },
        presentation: PRESENTACION_DE_TABLA,
      },
    ],
  },
  {
    objectId: 'barras',
    familia: 'comparacion',
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
          pozos: POZOS_DE_BARRAS(1),
        },
        presenta('formato', 'formatos', 'leyenda', 'etiquetasDeDato'),
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
        presentation: presenta('formato', 'formatos', 'leyenda', 'etiquetasDeDato'),
      },
      /*
       * 1.2.0 — la personalizacion que se configuraba y no llegaba al grafico.
       *
       * `leyenda` y `etiquetasDeDato` se podian elegir en el editor desde F5.10 y NO se aplicaban:
       * el panel las guardaba y el constructor de opciones no las leia. Aqui se cablean, y de paso
       * entra lo que faltaba para que un grafico sea configurable de verdad — posicion de la
       * leyenda, titulos y visibilidad de los ejes, cuadricula, empezar en cero, y orden del eje.
       */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog:
          'Leyenda con posicion, etiquetas de dato formateadas, ejes configurables y orden del eje.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La segunda dimension, si existe, agrupa las columnas por serie.',
          pozos: POZOS_DE_BARRAS(4),
        },
        presentation: PRESENTACION_DE_GRAFICO,
      },
      /*
       * 1.3.0 — pequenos multiplos.
       *
       * Es un cambio del CONTRATO DE DATOS —una dimension mas— y por eso es una version nueva y no
       * un ajuste sobre 1.2.0. Una instancia que fija 1.2.0 sigue viendo el objeto que mapeo, sin
       * un pozo que aparece de la nada; es lo que 4.5 pide de un objeto ya publicado.
       */
      {
        version: '1.3.0',
        publishedAt: '2026-09-13',
        changelog: 'Pequenos multiplos: el grafico se repite por cada valor de una dimension.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 3 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La dimension de multiplos, si existe, reparte el objeto en ' +
            'un panel por valor; la de serie agrupa las columnas dentro de cada panel.',
          pozos: [...POZOS_DE_BARRAS(4), POZO_DE_MULTIPLO],
        },
        presentation: PRESENTACION_DE_GRAFICO,
      },
      /*
       * 1.4.0 — formato condicional.
       *
       * El contrato de datos no cambia: es una clave de presentacion mas. Y aun asi es una version
       * nueva, porque lo que una version admite PRESENTAR tambien forma parte de lo que describe.
       * Meterla en 1.3.0 ampliaria en silencio un objeto ya publicado.
       */
      {
        version: '1.4.0',
        publishedAt: '2026-09-13',
        changelog: 'Formato condicional: el color de cada barra puede depender de su valor.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 3 },
          measures: { min: 1, max: 4 },
          notes:
            'Cada medida es una serie. La dimension de multiplos, si existe, reparte el objeto en ' +
            'un panel por valor; la de serie agrupa las columnas dentro de cada panel.',
          pozos: [...POZOS_DE_BARRAS(4), POZO_DE_MULTIPLO],
        },
        presentation: PRESENTACION_DE_GRAFICO_CON_CONDICIONAL,
      },
    ],
  },
  {
    /*
     * El «grafico de barras» de verdad: horizontales.
     *
     * No es el mismo objeto con una opcion porque el caso de uso es distinto, no la estetica: con
     * nombres largos —«Juzgado de Primera Instancia de Santiago»— las columnas obligan a girar los
     * rotulos o a recortarlos, y en horizontal caben enteros. Quien elige este objeto lo elige por
     * eso, y una opcion escondida en el panel de formato no se encuentra.
     */
    objectId: 'barras-horizontales',
    familia: 'comparacion',
    icono: 'barras-horizontales',
    name: 'Grafico de barras',
    description: 'Barras horizontales. Para categorias con nombres largos o muchas categorias.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: barras horizontales, hasta cuatro medidas, con apilado y 100 %.',
        {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes: 'Cada medida es una serie. La segunda dimension, si existe, agrupa las barras.',
          pozos: POZOS_DE_BARRAS(4),
        },
        PRESENTACION_DE_GRAFICO,
      ),
    ],
  },
  {
    /*
     * Pastel y dona son DOS entradas del catalogo y UN solo dibujo.
     *
     * El contrato de datos es identico y el hueco del centro es una propiedad de presentacion, asi
     * que pasar de uno a otro no cuesta la configuracion. Estan los dos por separado porque la
     * paleta es como se encuentran los objetos: quien busca «dona» la busca por su nombre, y
     * esconderla dentro del pastel como una casilla significa que no existe para quien no sepa ya
     * que esta ahi.
     */
    objectId: 'pastel',
    familia: 'proporcion',
    icono: 'pastel',
    name: 'Grafico circular (pastel)',
    description: 'La parte que representa cada categoria sobre el total.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: porciones ordenadas, etiquetas de detalle y tooltip con cifra y parte.',
        CONTRATO_CIRCULAR,
        PRESENTACION_CIRCULAR,
      ),
    ],
  },
  {
    objectId: 'dona',
    familia: 'proporcion',
    icono: 'dona',
    name: 'Grafico de anillos (dona)',
    description: 'Lo mismo que el circular, con el total en el centro.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: anillo con hueco del 55 % y total en el centro.',
        CONTRATO_CIRCULAR,
        PRESENTACION_CIRCULAR,
      ),
    ],
  },
  {
    objectId: 'medidor',
    familia: 'valor',
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
          pozos: [
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'La cifra que mueve la aguja.',
            },
            {
              id: 'objetivo',
              etiqueta: 'Objetivo',
              tipo: 'medida',
              max: 1,
              ayuda: 'Opcional. Si no se mapea, se puede fijar a mano en Formato.',
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
     *
     * Que medida va como columna y cual como linea lo dice el MAPEO, con un pozo para cada una.
     * Una opcion del panel obligaria a preguntar «cual de las cuatro medidas es la linea», que no
     * tiene una respuesta corta; arrastrar un campo de un pozo al otro si.
     */
    objectId: 'combinado',
    familia: 'relacion',
    icono: 'combinado',
    name: 'Grafico combinado de columnas y lineas',
    description: 'Dos grupos de medidas en el mismo eje, con eje secundario opcional.',
    category: 'grafico',
    versions: [
      v1(
        'Version inicial: columnas y lineas por pozo, con eje secundario opcional.',
        {
          dimensions: { min: 1, max: 1 },
          measures: { min: 2, max: 6 },
          notes:
            'Las medidas del pozo Columnas se dibujan como barras; las del pozo Lineas, como ' +
            'linea. Con eje secundario, la linea se mide en la escala de la derecha.',
          pozos: [
            {
              id: 'eje-x',
              etiqueta: 'Eje X',
              tipo: 'dimension',
              max: 1,
              min: 1,
              ayuda: 'La dimension que reparte las columnas.',
            },
            {
              id: 'columnas',
              etiqueta: 'Columnas',
              tipo: 'medida',
              max: 3,
              min: 1,
              ayuda: 'Las medidas que se dibujan como barras.',
            },
            {
              id: 'lineas',
              etiqueta: 'Lineas',
              tipo: 'medida',
              max: 3,
              min: 1,
              ayuda: 'Las medidas que se dibujan como linea.',
            },
          ],
        },
        presenta(
          'formato',
          'formatos',
          'leyenda',
          'etiquetasDeDato',
          'ejes',
          'orden',
          'combinado',
          'referencias',
          'coloresDeSerie',
          'tooltip',
        ),
      ),
    ],
  },
  {
    /*
     * Dispersion — el unico objeto donde la dimension NO reparte el eje.
     *
     * Cada categoria es un punto y los dos ejes son medidas. Es la unica forma de responder «se
     * relacionan estas dos cifras»: en cualquier grafico de barras una de las dos ES la escala,
     * asi que la pregunta no se puede ni plantear.
     */
    objectId: 'dispersion',
    familia: 'relacion',
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
          pozos: [
            {
              id: 'punto',
              etiqueta: 'Punto',
              tipo: 'dimension',
              max: 1,
              min: 1,
              ayuda: 'Cada valor de esta dimension es un punto del grafico.',
            },
            {
              id: 'eje-x',
              etiqueta: 'Eje X',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'La medida horizontal.',
            },
            {
              id: 'eje-y',
              etiqueta: 'Eje Y',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'La medida vertical.',
            },
            {
              id: 'tamano',
              etiqueta: 'Tamano',
              tipo: 'medida',
              max: 1,
              ayuda: 'Opcional. Reparte el diametro del punto entre un minimo y un maximo.',
            },
          ],
        },
        presenta('formato', 'formatos', 'etiquetasDeDato', 'ejes', 'referencias'),
      ),
    ],
  },
  {
    /*
     * Embudo — etapas de un proceso, en SU orden.
     *
     * Se parece a un circular en que reparte un total, y se comporta al reves en lo unico que
     * importa: no reordena. Las etapas de un proceso tienen un orden propio, y que la segunda sea
     * mayor que la primera es una anomalia que hay que poder ver.
     */
    objectId: 'embudo',
    familia: 'proporcion',
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
          pozos: [
            {
              id: 'etapa',
              etiqueta: 'Etapa',
              tipo: 'dimension',
              max: 1,
              min: 1,
              ayuda: 'La dimension que ordena las etapas.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'La cifra de cada etapa.',
            },
          ],
        },
        presenta('formato', 'formatos', 'leyenda', 'orden', 'embudo'),
      ),
    ],
  },
  {
    /*
     * Cascada — de que se compone una diferencia.
     *
     * Cada barra empieza donde acabo la anterior, asi que lo que se ve es la CONTRIBUCION de cada
     * categoria y no su magnitud. Es la unica forma de responder «por que el total subio» sin
     * poner al lado una tabla de diferencias.
     */
    objectId: 'cascada',
    familia: 'proporcion',
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
          pozos: [
            {
              id: 'categoria',
              etiqueta: 'Categoria',
              tipo: 'dimension',
              max: 1,
              min: 1,
              ayuda: 'Lo que aporta cada barra.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'Cuanto suma o resta. Negativo baja.',
            },
          ],
        },
        presenta('formato', 'formatos', 'ejes', 'orden', 'cascada', 'referencias'),
      ),
    ],
  },
  {
    /*
     * Mapa de arbol — la composicion cuando hay demasiadas partes para un circular.
     *
     * Un circular con veinte porciones no se puede leer: las pequenas se vuelven hilos sin sitio
     * para su nombre. Un rectangulo sigue teniendo dos dimensiones donde escribir.
     */
    objectId: 'mapa-de-arbol',
    familia: 'proporcion',
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
          pozos: [
            {
              id: 'grupo',
              etiqueta: 'Grupo',
              tipo: 'dimension',
              max: 1,
              min: 1,
              ayuda: 'El primer nivel: cada valor es un bloque.',
            },
            {
              id: 'detalle',
              etiqueta: 'Detalle',
              tipo: 'dimension',
              max: 1,
              ayuda: 'Opcional. El segundo nivel, dentro de cada bloque.',
            },
            {
              id: 'valor',
              etiqueta: 'Valor',
              tipo: 'medida',
              max: 1,
              min: 1,
              ayuda: 'El area de cada rectangulo.',
            },
          ],
        },
        presenta('formato', 'formatos', 'etiquetasDeDato'),
      ),
    ],
  },
  {
    objectId: 'area',
    familia: 'evolucion',
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
          pozos: POZOS_DE_LINEAS,
        },
        PRESENTACION_DE_GRAFICO,
      ),
    ],
  },
  {
    objectId: 'lineas',
    familia: 'evolucion',
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
          pozos: POZOS_DE_LINEAS,
        },
        presenta('formato', 'formatos', 'leyenda', 'etiquetasDeDato'),
      ),
      /* 1.1.0 — la misma personalizacion que columnas, por el mismo motivo. */
      {
        version: '1.1.0',
        publishedAt: '2026-09-13',
        changelog:
          'Leyenda con posicion, etiquetas de dato formateadas, ejes configurables y orden del eje.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 1 },
          measures: { min: 1, max: 4 },
          pozos: POZOS_DE_LINEAS,
        },
        presentation: PRESENTACION_DE_GRAFICO,
      },
      /* 1.2.0 — pequenos multiplos, por lo mismo que en columnas. */
      {
        version: '1.2.0',
        publishedAt: '2026-09-13',
        changelog: 'Pequenos multiplos: una linea por panel, con escala comun.',
        certification: certificacionInicial,
        dataContract: {
          dimensions: { min: 1, max: 2 },
          measures: { min: 1, max: 4 },
          notes: 'La dimension de multiplos reparte el objeto en un panel por valor.',
          pozos: [...POZOS_DE_LINEAS, POZO_DE_MULTIPLO],
        },
        presentation: PRESENTACION_DE_GRAFICO,
      },
    ],
  },
  {
    objectId: 'matriz',
    familia: 'detalle',
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
          pozos: [
            { id: 'filas', etiqueta: 'Filas', tipo: 'dimension', max: 1, min: 1 },
            { id: 'columnas', etiqueta: 'Columnas', tipo: 'dimension', max: 1, min: 1 },
            { id: 'valores', etiqueta: 'Valores', tipo: 'medida', max: 1, min: 1 },
          ],
        },
        presenta('formato', 'formatos'),
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
        presentation: presenta('formato', 'formatos'),
      },
    ],
  },
  {
    objectId: 'panel-de-filtros',
    familia: 'control',
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
    familia: 'control',
    icono: 'filtro',
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
    objectId: 'mapa',
    familia: 'ubicacion',
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
    ],
  },
  /* ── Elementos: no se enlazan a ningun dataset ───────────────────────────────────────── */

  {
    objectId: 'cuadro-de-texto',
    icono: 'texto',
    name: 'Cuadro de texto',
    description: 'Texto con formato: notas, aclaraciones, contexto. No consume datos.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: parrafos con negrita, cursiva, subrayado, alineacion y color.',
        SIN_DATOS('Escribe texto. El enlace a un dataset llegara como intercalado de medidas.'),
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
        SIN_DATOS('Ocupa el ancho que se le de. Las lineas se reparten lo que sobra del texto.'),
      ),
    ],
  },
  {
    objectId: 'linea-divisoria',
    icono: 'linea',
    name: 'Linea divisoria',
    description: 'Una linea horizontal o vertical, para separar bloques.',
    category: 'elemento',
    versions: [
      v1(
        'Version inicial: horizontal o vertical, con estilo, grosor y color.',
        SIN_DATOS('Va en el hueco entre celdas: una fila de alto uno, o una columna de ancho uno.'),
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
        SIN_DATOS('El relleno y el trazo son roles del tema, no colores sueltos (4.3).'),
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
        SIN_DATOS('Guarda los ids de los dos objetos, no coordenadas: sigue pegado al moverlos.'),
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
        SIN_DATOS('Los hijos se posicionan contra la rejilla del contenedor, no la del modulo.')),
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
        SIN_DATOS('Dos barras a la vez convierten buscar contenido en un plano en vez de una linea.')),
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
        SIN_DATOS('La rejilla de la ventana no es la de la tarjeta: caben otras cosas y de otra forma.')),
    ],
  },
  {
    objectId: 'contenedor-con-pestanas',
    icono: 'pestanas',
    name: 'Contenedor con pestanas',
    description: 'Varias pestanas, cada una con su propio contenido y su propia disposicion.',
    category: 'contenedor',
    versions: [
      v1('Version inicial: pestanas con disposicion independiente y tamano fijo del contenedor.',
        SIN_DATOS('Cambiar de pestana no altera la posicion, las dimensiones ni el espacio ocupado.')),
    ],
  },
];
