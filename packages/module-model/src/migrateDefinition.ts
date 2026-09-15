/**
 * Migracion de las CLAVES de una definicion guardada — apartado 2.11.
 *
 * El renombrado al ingles cubrio declaraciones, archivos, clases CSS e identificadores de prueba.
 * Las propiedades se quedaron fuera, y no son equivalentes a lo anterior por una razon concreta:
 * la definicion de un modulo se guarda como JSON en el almacen, asi que sus claves estan EN DISCO.
 * Renombrar `presentacion` en el tipo sin tocar lo guardado no rompe el compilador —el JSON es
 * `unknown` para el— y deja de leerse la presentacion de todos los modulos que ya existen: los
 * graficos salen con el formato de fabrica y nadie ve un error.
 *
 * De ahi que esto venga PRIMERO y no despues. La tabla es la lista de renombrados ya hechos, cada
 * uno con la ruta donde vive la clave, y se aplica al LEER. Al leer y no en un comando de una vez:
 * un comando hay que acordarse de ejecutarlo en cada entorno, y el que se olvide se descubre
 * cuando alguien abre un modulo y lo ve sin formato.
 *
 * Es idempotente: una definicion ya migrada pasa por aqui sin cambiar, porque lo que se busca es
 * la clave VIEJA y ya no esta. Eso es lo que permite dejarlo puesto para siempre en vez de
 * borrarlo «cuando ya no haga falta», que es una fecha que nadie decide.
 */

/**
 * Donde vive una clave dentro de la definicion.
 *
 * Se declara la RUTA y no se busca la clave por todo el arbol a ciegas: `tipo` aparece en sitios
 * que quieren decir cosas distintas —el tipo del navegador, el tipo de un elemento, el tipo de un
 * filtro—, y renombrarlos todos a la vez porque se llaman igual es exactamente el error que una
 * migracion tiene que no cometer.
 *
 * `[]` recorre un array. `*` recorre las claves de un objeto cuyos nombres no se conocen.
 */
export interface KeyRename {
  /** La ruta del OBJETO que contiene la clave, desde la raiz de la definicion. */
  path: string[];
  from: string;
  to: string;
}

/**
 * Los renombrados aplicados hasta hoy.
 *
 * Se anade al final y no se quita nunca: quitar una fila es dejar de poder leer lo guardado antes
 * de ella, y «ya no queda ninguno con la clave vieja» es una afirmacion sobre el disco de
 * produccion que desde aqui no se puede comprobar.
 */
/**
 * Las DOS filas de una clave que vive dentro de la presentacion.
 *
 * Dos y no una porque hay dos sitios: la instancia de cada objeto del modulo y la de cada
 * complemento adjuntado —un pie de pagina o un tooltip tienen su propia presentacion—. Escribirlas
 * a mano era copiar once lineas por clave, y lo que se copia once veces se copia mal la doceava:
 * la ruta del complemento es larga y basta con que falte un `[]` para que la fila no encuentre
 * nada y no falle nada.
 *
 * `dentro` baja un nivel mas, para las claves que cuelgan de otra —`axes.scale` y sus hermanas—.
 */
function enLaPresentacion(from: string, to: string, ...dentro: string[]): KeyRename[] {
  const item = ['pages', '[]', 'items', '[]', 'instance'];
  const adjunto = [...item, 'attachments', '[]', 'instance'];
  return [
    { path: [...item, 'presentation', ...dentro], from, to },
    { path: [...adjunto, 'presentation', ...dentro], from, to },
  ];
}

export const RENAMES: KeyRename[] = [
  /*
   * `presentacion` -> `presentation`, la mas leida de todas.
   *
   * Vive en la instancia de cada objeto del modulo, y tambien en la de cada complemento
   * adjuntado: un pie de pagina o un tooltip tienen su propia presentacion.
   */
  { path: ['pages', '[]', 'items', '[]', 'instance'], from: 'presentacion', to: 'presentation' },
  {
    path: ['pages', '[]', 'items', '[]', 'instance', 'attachments', '[]', 'instance'],
    from: 'presentacion',
    to: 'presentation',
  },
  /*
   * Segunda tanda: seis claves DENTRO de la presentacion.
   *
   * Las seis del marco comun —lo que se dibuja alrededor de cualquier objeto— mas las dos que
   * eligen como se rotulan los datos. Se hacen juntas porque se leen juntas: quien abre la
   * seccion «Borde» del panel las ve todas en la misma pantalla.
   *
   * Van SEIS y no las veintiseis que quedan, y esa es la leccion de esta tanda. Se intento con
   * catorce y el compilador saco a la luz que cinco de ellas —`apilado`, `combinado`, `medidor`,
   * `embudo`, `cascada`— no son solo claves: son tambien VALORES de una union que se guarda
   * —`ChartKind`, `StackingMode`— y el renombrador, que solo ve identificadores, tocaba las dos
   * cosas a la vez. `subtitulo` es peor todavia: es una clave de presentacion Y el nombre de una
   * ranura de texto dentro de `textos`, dos cosas distintas con el mismo nombre. Renombrar un
   * valor guardado es otra migracion, con su propia ruta y su propio riesgo; aqui solo van claves.
   */
  ...(
    [
      ['resaltado', 'highlight'],
      ['colorDeResaltado', 'highlightColor'],
      ['mostrarTitulo', 'showTitle'],
      ['mostrarIcono', 'showIcon'],
      ['etiquetasDeDato', 'datumLabels'],
      ['coloresDeSerie', 'seriesColors'],
    ] as const
  ).flatMap(([from, to]) => enLaPresentacion(from, to)),
  /*
   * Tercera tanda: los EJES, que son la primera clave con hijos.
   *
   * `ejes` -> `axes` primero, y solo despues las siete de dentro, porque el orden de esta tabla es
   * el orden en que se aplica: una fila que dijera `presentation.ejes` DESPUES de haber renombrado
   * el padre no encontraria nada, y una definicion guardada se quedaria con el eje a medias —el
   * objeto migrado, su contenido no—. Es el unico sitio donde el orden de las filas importa, y por
   * eso se dice aqui en vez de confiarlo a que nadie las reordene.
   */
  ...enLaPresentacion('ejes', 'axes'),
  ...(
    [
      ['mostrarY', 'showY'],
      ['tituloY', 'yTitle'],
      ['tituloY2', 'y2Title'],
      ['desdeCero', 'fromZero'],
      ['minimoY', 'yMin'],
      ['maximoY', 'yMax'],
      ['escala', 'scale'],
    ] as const
  ).flatMap(([from, to]) => enLaPresentacion(from, to, 'axes')),
];

type Json = Record<string, unknown>;

const esObjeto = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Renombra `from` a `to` en cada objeto que la ruta alcance.
 *
 * Si la clave nueva YA esta, la vieja se descarta en vez de pisarla: una definicion a medio migrar
 * —guardada por una version nueva y leida por una vieja, y vuelta a guardar— puede tener las dos,
 * y en ese caso la que vale es la nueva, que es la que escribio el codigo mas reciente.
 */
function renombrarEn(nodo: unknown, ruta: string[], from: string, to: string): void {
  if (ruta.length === 0) {
    if (!esObjeto(nodo) || !(from in nodo)) return;
    if (!(to in nodo)) nodo[to] = nodo[from];
    delete nodo[from];
    return;
  }

  const [paso, ...resto] = ruta;
  if (paso === '[]') {
    if (!Array.isArray(nodo)) return;
    for (const hijo of nodo) renombrarEn(hijo, resto, from, to);
    return;
  }
  if (paso === '*') {
    if (!esObjeto(nodo)) return;
    for (const hijo of Object.values(nodo)) renombrarEn(hijo, resto, from, to);
    return;
  }
  if (!esObjeto(nodo) || paso === undefined) return;
  renombrarEn(nodo[paso], resto, from, to);
}

/**
 * Migra una definicion leida del almacen a la forma que el codigo de hoy espera.
 *
 * Recibe `unknown` a proposito: lo que sale del almacen es JSON y el tipo que le pongamos al leer
 * es una promesa, no una comprobacion. Devuelve el mismo valor, migrado en el sitio, para que
 * quien lo llama no tenga que decidir si clonar.
 */
export function migrateDefinition<T>(definicion: T): T {
  for (const { path, from, to } of RENAMES) {
    renombrarEn(definicion, path, from, to);
  }
  return definicion;
}
