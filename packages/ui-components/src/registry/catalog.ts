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

export const catalogoInicial: VisualObjectDefinition[] = [
  {
    objectId: 'tarjeta-kpi',
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
    ],
  },
  {
    objectId: 'tabla',
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
        presenta('formato', 'formatos', 'leyenda', 'etiquetasDeDato'),
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
  /* ── Elementos: no se enlazan a ningun dataset ───────────────────────────────────────── */

  {
    objectId: 'cuadro-de-texto',
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
    name: 'Contenedor con pestanas',
    description: 'Varias pestanas, cada una con su propio contenido y su propia disposicion.',
    category: 'contenedor',
    versions: [
      v1('Version inicial: pestanas con disposicion independiente y tamano fijo del contenedor.',
        SIN_DATOS('Cambiar de pestana no altera la posicion, las dimensiones ni el espacio ocupado.')),
    ],
  },
];
