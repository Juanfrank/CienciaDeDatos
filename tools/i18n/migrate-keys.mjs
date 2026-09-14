#!/usr/bin/env node
/**
 * Migracion de las claves del catalogo de `@app/i18n` al ingles.
 *
 * Las claves son identificadores —los lee el compilador, no una persona— y la regla del
 * repositorio es que los identificadores van en ingles. Los VALORES del catalogo `es` siguen en
 * espanol, que es el idioma de la aplicacion: lo que se traduce aqui es el nombre de la ranura,
 * no el texto que se lee en pantalla.
 *
 * Se conserva en el arbol como registro de la correspondencia: es la unica forma de saber, el dia
 * que aparezca una clave vieja en una rama antigua o en un volcado, a que corresponde ahora.
 *
 *   node tools/i18n/migrate-keys.mjs [--check]
 *
 * Sin argumentos reescribe catalogos y usos. Con `--check` solo informa de lo que cambiaria.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** Traduccion segmento a segmento. Una clave es una ruta de segmentos separados por punto. */
const SEGMENTS = {
  30: '30',
  45: '45',
  acceso: 'signIn',
  accion: 'action',
  acciones: 'actions',
  acento: 'accent',
  admin: 'admin',
  agregacion: 'aggregation',
  alcance: 'extent',
  ambito: 'scope',
  ambitoHeredado: 'scopeInherited',
  ambitoPropio: 'scopeOwn',
  ampliar: 'expand',
  anadir: 'add',
  apilado: 'stacked',
  app: 'app',
  ascendente: 'ascending',
  automaticas: 'automatic',
  autor: 'author',
  ayuda: 'help',
  borrador: 'draft',
  buscar: 'search',
  buscarAjuste: 'searchSetting',
  buscarObjeto: 'searchObject',
  cadena: 'string',
  campos: 'fields',
  cancelar: 'cancel',
  cargando: 'loading',
  categoria: 'category',
  categorias: 'categories',
  categoricos: 'categorical',
  cerrar: 'close',
  claro: 'light',
  clave: 'password',
  codigo: 'code',
  color: 'color',
  columna: 'column',
  columnas: 'columns',
  compara: 'comparedTo',
  comparacion: 'comparison',
  complementos: 'addons',
  completa: 'complete',
  conector: 'connector',
  conexion: 'connection',
  contenedores: 'containers',
  contenido: 'content',
  contrasteFalla: 'contrastFails',
  contrasteOk: 'contrastPasses',
  control: 'control',
  correo: 'mail',
  crearBorrador: 'createDraft',
  credencialesInvalidas: 'invalidCredentials',
  dataset: 'dataset',
  datos: 'data',
  datosDe: 'dataOf',
  decimales: 'decimals',
  derecha: 'right',
  desc: 'desc',
  descendente: 'descending',
  desde: 'from',
  desplazamiento: 'scroll',
  detalle: 'detail',
  diferencia: 'difference',
  direccion: 'direction',
  donde: 'where',
  duracion: 'duration',
  editor: 'editor',
  eje: 'axis',
  ejemplo: 'example',
  elementos: 'elements',
  emblema: 'emblem',
  enCache: 'inCache',
  enUso: 'inUse',
  encolada: 'queued',
  enlace: 'link',
  entrar: 'submit',
  enviar: 'submitForApproval',
  equipos: 'teams',
  escala: 'scale',
  esperando: 'awaiting',
  esquema: 'schema',
  esquemaFecha: 'schemaDate',
  estado: 'status',
  estilo: 'style',
  etapas: 'stages',
  etiqueta: 'label',
  etiquetas: 'labels',
  evolucion: 'trend',
  exportacion: 'export',
  exportar: 'export',
  fallida: 'failed',
  fallo: 'failure',
  familia: 'family',
  filas: 'rows',
  filtrarPor: 'filterBy',
  forma: 'shape',
  formato: 'format',
  geometrias: 'geometries',
  girar: 'rotate',
  grafico: 'chart',
  grosor: 'weight',
  guardado: 'saved',
  guardando: 'saving',
  guardar: 'save',
  hasta: 'to',
  historial: 'history',
  horizontales: 'horizontal',
  hueco: 'hole',
  huerfano: 'orphan',
  icono: 'icon',
  iconos: 'icons',
  imagenes: 'images',
  institucion: 'institution',
  interlineado: 'lineHeight',
  interna: 'inner',
  internas: 'inner',
  intro: 'intro',
  latido: 'heartbeat',
  leyenda: 'legend',
  linea: 'line',
  lineas: 'lines',
  lista: 'list',
  mapeeMedida: 'mapAMeasure',
  maximo: 'max',
  medida: 'measure',
  medidas: 'measures',
  minimo: 'min',
  modulo: 'module',
  modulos: 'modules',
  no: 'no',
  noEncontrado: 'notFound',
  nombre: 'name',
  obj: 'obj',
  objetivo: 'target',
  objeto: 'object',
  objetos: 'objects',
  omitidos: 'omitted',
  opacidad: 'opacity',
  orden: 'sort',
  orientacion: 'orientation',
  origen: 'source',
  origenes: 'sources',
  oscuro: 'dark',
  otros: 'other',
  paginas: 'pages',
  panel: 'panel',
  parrafo: 'paragraph',
  pendiente: 'pending',
  persona: 'person',
  pestana: 'tab',
  pie: 'footer',
  poblado: 'populated',
  por: 'by',
  porDefecto: 'default',
  porciones: 'slices',
  posicion: 'position',
  pres: 'pres',
  proporcion: 'proportion',
  publicado: 'published',
  publicar: 'publish',
  queVe: 'whatTheySee',
  quitar: 'remove',
  quitarDelModulo: 'removeFromModule',
  recursos: 'resources',
  reemplazo: 'replacement',
  reintentar: 'retry',
  rejilla: 'grid',
  relacion: 'relation',
  relleno: 'fill',
  resaltado: 'highlight',
  respondio: 'answered',
  restringido: 'restricted',
  resultado: 'result',
  retirada: 'deprecated',
  revisadaPor: 'reviewedBy',
  rol: 'role',
  roto: 'broken',
  rotoDetalle: 'brokenDetail',
  rotulos: 'tickLabels',
  salir: 'signOut',
  selectores: 'pickers',
  serie: 'series',
  si: 'yes',
  simbolo: 'symbol',
  sinAcciones: 'noActions',
  sinCentro: 'noHole',
  sinCompleta: 'noCompleteRun',
  sinDataset: 'noDataset',
  sinDetalle: 'noDetail',
  sinDimension: 'noDimension',
  sinEsquema: 'noSchema',
  sinGeometrias: 'noGeometries',
  sinLatido: 'noHeartbeat',
  sinMedida: 'noMeasure',
  sinObjetos: 'noObjects',
  sinPermiso: 'noPermission',
  sinResultados: 'noResults',
  sinTitulo: 'noTitle',
  sinUso: 'unused',
  slug: 'slug',
  subtitulo: 'subtitle',
  tabla: 'table',
  tamano: 'size',
  temas: 'themes',
  texto: 'text',
  textoDentro: 'textInside',
  tipografia: 'typography',
  titulo: 'title',
  token: 'token',
  tokens: 'tokens',
  total: 'total',
  trazado: 'stroke',
  ubicacion: 'location',
  ultimaPoblacion: 'lastPopulation',
  unidad: 'unit',
  usuarios: 'users',
  vacia: 'empty',
  valor: 'value',
  valores: 'values',
  verAjustes: 'seeSettings',
  verObjetos: 'seeObjects',
  verTodo: 'seeAll',
  version: 'version',
  verticales: 'vertical',
  vigentes: 'current',
  visualizaciones: 'visualizations',
  withoutData: 'withoutData',
};

/**
 * Claves cuyo segmento significa otra cosa aqui.
 *
 * `clave` es la contrasena al entrar y el campo que identifica la fila en un esquema. El mismo
 * segmento, dos conceptos: la traduccion por segmentos no puede saberlo y se dice a mano.
 */
const OVERRIDES = {
  'admin.origenes.clave': 'admin.sources.key',
};

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const ES = `${raiz}/packages/i18n/src/catalog/es.ts`;

/** Las claves del catalogo de referencia, en el orden en que estan escritas. */
function catalogKeys() {
  return [...readFileSync(ES, 'utf8').matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]);
}

export function translateKey(key) {
  if (OVERRIDES[key]) return OVERRIDES[key];
  return key
    .split('.')
    .map((segmento) => {
      const traducido = SEGMENTS[segmento];
      if (!traducido) throw new Error(`sin traduccion para el segmento '${segmento}' (${key})`);
      return traducido;
    })
    .join('.');
}

const claves = catalogKeys();
const mapa = new Map(claves.map((k) => [k, translateKey(k)]));

// Dos claves distintas que aterricen en la misma dejarian una sin catalogo y sin aviso.
const destinos = new Map();
for (const [vieja, nueva] of mapa) {
  if (destinos.has(nueva)) throw new Error(`colision: '${vieja}' y '${destinos.get(nueva)}' -> '${nueva}'`);
  destinos.set(nueva, vieja);
}

const cambian = [...mapa].filter(([vieja, nueva]) => vieja !== nueva);
console.log(`${claves.length} claves, ${cambian.length} cambian`);

if (process.argv.includes('--check')) {
  for (const [vieja, nueva] of cambian) console.log(`  ${vieja} -> ${nueva}`);
  process.exit(0);
}

/*
 * Se reemplaza de la clave mas larga a la mas corta y SIEMPRE entre comillas.
 * `pres.formato` es prefijo de `pres.formato.cadena`: sustituir primero la corta dejaria la larga
 * a medio traducir, y sin las comillas se tocaria cualquier texto que contuviera la clave.
 */
const ordenadas = [...cambian].sort((a, b) => b[0].length - a[0].length);
const archivos = execSync(
  `git -C ${raiz} ls-files '*.ts' '*.tsx' '*.mts' '*.mjs' '*.md'`,
).toString().trim().split('\n').filter(Boolean);

let tocados = 0;
for (const relativa of archivos) {
  if (relativa === 'tools/i18n/migrate-keys.mjs') continue;
  const ruta = `${raiz}/${relativa}`;
  const antes = readFileSync(ruta, 'utf8');
  let despues = antes;
  for (const [vieja, nueva] of ordenadas) {
    for (const comilla of ["'", '"', '`']) {
      despues = despues.split(`${comilla}${vieja}${comilla}`).join(`${comilla}${nueva}${comilla}`);
    }
  }
  if (despues !== antes) {
    writeFileSync(ruta, despues);
    tocados += 1;
  }
}
console.log(`${tocados} archivos reescritos`);
