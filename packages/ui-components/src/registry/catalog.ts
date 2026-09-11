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

const v1 = (changelog: string, dataContract: VisualObjectDefinition['versions'][number]['dataContract']) => ({
  version: '1.0.0',
  publishedAt: '2026-09-11',
  changelog,
  certification: certificacionInicial,
  dataContract,
});

export const catalogoInicial: VisualObjectDefinition[] = [
  {
    objectId: 'tarjeta-kpi',
    name: 'Tarjeta KPI',
    description: 'Un unico valor destacado, con su etiqueta y una variacion opcional.',
    category: 'indicador',
    versions: [
      v1('Version inicial: valor agregado, etiqueta y variacion respecto del periodo anterior.', {
        dimensions: { min: 0, max: 1 },
        measures: { min: 1, max: 2 },
        notes: 'La primera medida es el valor; la segunda, opcional, es la comparacion.',
      }),
    ],
  },
  {
    objectId: 'tabla',
    name: 'Tabla',
    description: 'Filas y columnas con las dimensiones y medidas mapeadas.',
    category: 'tabla',
    versions: [
      v1('Version inicial: columnas ordenables y formato numerico por medida.', {
        dimensions: { min: 0, max: 6 },
        measures: { min: 0, max: 10 },
      }),
    ],
  },
  {
    objectId: 'barras',
    name: 'Grafico de barras',
    description: 'Comparacion de una medida entre las categorias de una dimension.',
    category: 'grafico',
    versions: [
      v1('Version inicial: barras verticales, una serie.', {
        dimensions: { min: 1, max: 2 },
        measures: { min: 1, max: 1 },
        notes: 'La segunda dimension, si existe, agrupa las barras por serie.',
      }),
    ],
  },
  {
    objectId: 'lineas',
    name: 'Grafico de lineas',
    description: 'Evolucion de una o varias medidas a lo largo de una dimension ordenada.',
    category: 'grafico',
    versions: [
      v1('Version inicial: una linea por medida sobre el eje de la primera dimension.', {
        dimensions: { min: 1, max: 1 },
        measures: { min: 1, max: 4 },
      }),
    ],
  },
  {
    objectId: 'matriz',
    name: 'Matriz',
    description: 'Cruce de dos dimensiones con una medida en las celdas.',
    category: 'tabla',
    versions: [
      v1('Version inicial: dimension de filas por dimension de columnas, con totales.', {
        dimensions: { min: 2, max: 2 },
        measures: { min: 1, max: 1 },
        notes: 'La primera dimension va en filas; la segunda, en columnas.',
      }),
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
