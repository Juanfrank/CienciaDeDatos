/*
 * Renombrado sistematico de identificadores del espanol al ingles.
 *
 * Tres piezas:
 *
 *   1. El GLOSARIO traduce palabra a palabra y clasifica verbos y adjetivos, porque el orden de
 *      las palabras no se conserva entre los dos idiomas: `temaOscuro` es `darkTheme` y
 *      `partirEnMultiplos` es `splitMultiples`.
 *   2. El proponedor extrae solo lo DECLARADO —variables, funciones, tipos, clases, propiedades,
 *      clases CSS e identificadores de prueba— y no cualquier palabra del archivo. Sin eso, la
 *      palabra `texto` de trescientos comentarios en espanol entraria en el mapa.
 *   3. El aplicador trata cada zona del archivo distinto, con el escaner de `segmentos.mjs`: en
 *      codigo sustituye todo, en comentario solo lo compuesto —que no se confunde con prosa— y
 *      en cadena solo lo que es contrato de interfaz: testids y clases CSS.
 *
 * Uso:
 *   node tools/rename/renombrar.mjs --traducir <identificador>
 *   node tools/rename/renombrar.mjs --proponer <ruta>      > plan.json
 *   node tools/rename/renombrar.mjs --aplicar  <plan.json>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { segmentar, segmentarJsx, unir } from './segmentos.mjs';

const GLOSARIO = JSON.parse(readFileSync('tools/rename/glosario.json', 'utf8'));
const ENLACES = new Set(['de', 'del', 'en', 'por', 'con', 'a', 'y', 'que', 'para', 'un', 'una']);

/** El enlace del final se conserva: distingue el valor (`margen`) de la funcion (`margenDe`). */
const PREPOSICIONES = { de: 'of', del: 'of', para: 'for', en: 'in', por: 'by', que: 'where' };
const VERBOS = new Set(GLOSARIO['_verbos']);
const ADJETIVOS = new Set(GLOSARIO['_adjetivos']);
const SINGULAR = GLOSARIO['_singular'];

/**
 * Palabras que no pueden ser un identificador.
 *
 * `nueva` traduce a `new`, y `const new = …` no es JavaScript. El traductor devuelve `null` en
 * ese caso: el nombre se queda en espanol y se decide a mano, que es mejor que producir un
 * archivo que ni siquiera se analiza.
 */
const RESERVADAS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import',
  'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'await', 'async',
  'implements', 'interface', 'package', 'private', 'protected', 'public', 'arguments', 'eval',
]);

/**
 * Lo que NO se renombra, aunque este en espanol.
 *
 * Son valores que se SERIALIZAN: viven dentro de modulos ya publicados, dentro del cache o
 * dentro del esquema de la fuente. Cambiarlos no es renombrar, es migrar datos, y rompe toda
 * instancia desplegada — que es justo lo que la seccion 4.5 prohibe.
 */
const PROTEGIDOS = new Set([
  'barras', 'barras-horizontales', 'lineas', 'area', 'pastel', 'dona', 'medidor', 'combinado',
  'dispersion', 'embudo', 'cascada', 'mapa-de-arbol', 'tabla', 'matriz', 'tarjeta-kpi', 'mapa',
  'segmentador', 'panel-de-filtros', 'tooltip-explicativo', 'tabla-de-datos', 'cuadro-de-texto',
  'titulo-de-seccion', 'linea-divisoria', 'forma', 'conexion', 'contenedor-simple',
  'contenedor-desplazable', 'contenedor-ampliable', 'contenedor-con-pestanas',
  'icono', 'acento', 'resaltado', 'colorDeResaltado', 'mostrarTitulo', 'mostrarIcono',
  'subtitulo', 'etiqueta', 'textos', 'formato', 'formatos', 'leyenda', 'etiquetasDeDato',
  'ejes', 'orden', 'apilado', 'circular', 'referencias', 'coloresDeSerie',
  'tooltip', 'multiplos', 'condicional',
]);

/*
 * Lo que esta lista NO cubre: los identificadores de RANURA.
 *
 * El id de una ranura es un contrato de cadena aunque se escriba como clave de objeto —el modulo
 * guardado lleva `ranuras: { filas: [...] }` y el catalogo declara `{ id: 'filas' }`—, asi que
 * renombrar solo la clave deja el objeto marcado como roto en pantalla. Protegerlos aqui seria
 * demasiado: `filas` y `columnas` tambien nombran propiedades internas que si deben renombrarse.
 * Lo comprueba `apps/shell/src/server/modulos.spec.ts`, que valida cada instancia guardada contra
 * el contrato de su objeto y falla en segundos nombrando el modulo y el item.
 */

export function palabras(identificador) {
  return identificador
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((p) => p.toLowerCase());
}

export function estilo(identificador) {
  // Una constante puede ser de una sola palabra (`MODOS`) y sigue siendo una constante: mirar
  // solo el guion bajo la convertia en `Modes`, que no es lo que era.
  if (/^[A-Z][A-Z0-9_]*$/.test(identificador)) return 'GRITO';
  if (identificador.includes('__')) return 'bem';
  if (identificador.includes('-')) return 'kebab';
  if (identificador.includes('_')) return 'snake';
  if (/^[A-Z]/.test(identificador)) return 'Pascal';
  return 'camel';
}

function recomponer(partes, estiloDestino) {
  if (partes.length === 0) return '';
  switch (estiloDestino) {
    case 'GRITO':
      return partes.map((p) => p.toUpperCase()).join('_');
    case 'kebab':
      return partes.join('-');
    case 'snake':
      return partes.join('_');
    case 'Pascal':
      return partes.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
    default:
      return partes.map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1))).join('');
  }
}

/**
 * Traduce un identificador, o devuelve `null` si alguna palabra falta en el glosario.
 *
 * Devolver `null` en vez de inventar es deliberado: un nombre traducido a ojo es peor que uno en
 * espanol, porque parece revisado. Lo que no se traduce se anota y se decide a mano.
 */
export function traducir(identificador) {
  if (estilo(identificador) === 'bem') {
    // Cada parte se traduce sola y vuelve en kebab: `editor__buscador` es `editor__search-box`,
    // no `editor__searchBox`, que mezcla dos convenciones en el mismo nombre.
    const propuesto = identificador
      .split('__')
      .map((t) => (traducir(t) ?? t).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())
      .join('__');
    return propuesto === identificador ? null : propuesto;
  }

  let partes = palabras(identificador);
  if (partes.length === 0) return null;

  /*
   * El enlace del final y el `con` del principio se conservan como preposicion inglesa.
   *
   * Sin esto, `margen` y `margenDe` traducen los dos a `margin` y no compilan en el mismo ambito;
   * lo mismo con `extremos`/`extremosDe` y `porciones`/`porcionesDe`. El enlace no es ruido: es
   * la diferencia entre el valor y la funcion que lo calcula.
   */
  let sufijo = '';
  let prefijo = '';
  /*
   * El `use` de un hook de React va SIEMPRE delante: es lo que lo identifica como hook.
   *
   * Tratado como una palabra mas, la inversion del complemento lo manda al final y
   * `useFiltrosDeUrl` sale `urlFiltersUse`, que ni es un hook ni lo parece.
   */
  if (/^use[A-Z]/.test(identificador)) {
    return `use${traducir(identificador.slice(3)) ?? identificador.slice(3)}`;
  }
  const ultimo = partes[partes.length - 1];
  if (partes.length > 1 && PREPOSICIONES[ultimo] !== undefined) {
    sufijo = PREPOSICIONES[ultimo];
    partes = partes.slice(0, -1);
  }
  if (partes.length > 1 && partes[0] === 'con') {
    prefijo = 'with';
    partes = partes.slice(1);
  }
  // `es-activo` es una clase de estado: en ingles se escribe `is-active`, con el verbo delante.
  if (partes.length > 1 && partes[0] === 'es') {
    prefijo = 'is';
    partes = partes.slice(1);
  }
  // `sin-complementos` es `without-addons`: la negacion va delante, igual que el `con`.
  if (partes.length > 1 && partes[0] === 'sin') {
    prefijo = 'without';
    partes = partes.slice(1);
  }

  const hayComplemento = partes.some((p) => ENLACES.has(p) && p !== 'y');
  const utiles = partes.filter((p) => !ENLACES.has(p));
  if (utiles.length === 0) return null;

  const traducidas = utiles.map((p) => GLOSARIO[p] ?? (/^\d+$/.test(p) ? p : null));
  if (traducidas.includes(null)) return null;

  /*
   * Un nombre que YA esta en ingles no se traduce: se deja donde esta.
   *
   * El glosario lleva entradas que se traducen a si mismas —`dataset`, `admin`, `nav`—, porque
   * hacen falta para completar nombres mixtos como `panel-de-datasets`. Sin esta guarda, esas
   * entradas bastan para que `datasetId` entre en el mapa, y la inversion de dos sustantivos lo
   * convierte en `idDataset`: mismo nombre, orden al reves, y 227 sitios apuntando a una
   * propiedad que ya no existe.
   */
  if (utiles.every((p, i) => p === traducidas[i].toLowerCase())) return null;

  let ordenadas;
  if (VERBOS.has(utiles[0])) {
    ordenadas = traducidas;
  } else if (utiles.findIndex((p) => ADJETIVOS.has(p)) > 0) {
    ordenadas = [
      ...traducidas.filter((_, i) => ADJETIVOS.has(utiles[i])),
      ...traducidas.filter((_, i) => !ADJETIVOS.has(utiles[i])),
    ];
  } else if (hayComplemento && traducidas.length > 1) {
    ordenadas = [...traducidas].reverse();
  } else if (ADJETIVOS.has(utiles[0])) {
    // Ya viene delante —`miVista`, `nuevoModulo`—: en ingles va igual, no hay nada que mover.
    ordenadas = traducidas;
  } else if (traducidas.length === 2) {
    /*
     * Dos sustantivos seguidos invierten, aunque no lleve enlace.
     *
     * `tabla-datos` es «tabla DE datos» con el `de` implicito, y en ingles el calificador va
     * delante: `data-table`. Sin esta regla salen `table-data`, `title-module` y `ViewModule`,
     * que se leen al reves. Un adjetivo o un verbo delante ya se han resuelto en las ramas de
     * arriba, asi que aqui solo quedan dos sustantivos.
     */
    ordenadas = [...traducidas].reverse();
  } else {
    ordenadas = traducidas;
  }

  const planas = ordenadas.flatMap((p) => palabras(p));
  const atributivas = planas.map((p, i) => (i < planas.length - 1 ? (SINGULAR[p] ?? p) : p));
  const conAfijos = [...(prefijo ? [prefijo] : []), ...atributivas, ...(sufijo ? [sufijo] : [])];
  const propuesto = recomponer(conAfijos, estilo(identificador));
  if (propuesto === identificador) return null;
  return RESERVADAS.has(propuesto) ? null : propuesto;
}

/* ── Extraccion ──────────────────────────────────────────────────────────────────────────── */

/** Sitios donde un nombre se DECLARA, que es lo unico que se renombra. */
const DECLARACIONES = [
  /\b(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  /\bfunction\s+[\w$]*\s*\(([^)]*)\)/g,
  /\(([^()]*)\)\s*=>/g,
  /\b(?:const|let|var)\s*\{([^}]*)\}/g,
  /^\s{2,}(?:readonly\s+)?([a-z][\w]*)\??\s*:/gm,
];

function declaradosEn(fuente) {
  const nombres = new Set();
  const codigo = segmentarJsx(fuente)
    .filter((s) => s.tipo === 'codigo')
    .map((s) => s.texto)
    .join('\n');

  for (const expresion of DECLARACIONES) {
    for (const m of codigo.matchAll(expresion)) {
      for (const trozo of (m[1] ?? '').split(',')) {
        const limpio = trozo.split(':')[0].split('=')[0].replace(/[.{}[\]]/g, '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(limpio)) nombres.add(limpio);
      }
    }
  }
  return nombres;
}

/** Clases CSS e identificadores de prueba, que viven dentro de cadenas. */
function interfazEn(fuente, esCss) {
  const nombres = new Set();
  if (esCss) {
    for (const m of fuente.matchAll(/\.([a-z][a-z0-9_-]*)/g)) nombres.add(m[1]);
    /*
     * `[data-eje='y']` es la otra mitad de un `data-eje=` que escribe un componente.
     *
     * El atributo lo pone el TSX y lo lee el CSS, y nada los ata: renombrar uno de los dos no
     * rompe la compilacion ni una prueba de unidad, la regla deja de aplicarse y el estilo
     * desaparece en silencio. Entra en el mapa de interfaz, que se sustituye en las dos zonas.
     */
    for (const m of fuente.matchAll(/\[(data-[a-z][\w-]*)/g)) nombres.add(m[1]);
    return nombres;
  }
  for (const m of fuente.matchAll(/\b(data-[a-z][\w-]*)\s*=/g)) nombres.add(m[1]);
  for (const m of fuente.matchAll(/className="([^"]+)"/g)) {
    m[1].split(/\s+/).forEach((c) => c && nombres.add(c));
  }
  for (const m of fuente.matchAll(/(?:data-testid|prueba)\s*[=:]\s*[{"'`]+([a-zA-Z][\w-]*)/g)) {
    nombres.add(m[1]);
  }
  for (const m of fuente.matchAll(/getByTestId\(\s*[`'"]([a-zA-Z][\w-]*)/g)) nombres.add(m[1]);
  return nombres;
}

const rutasDe = (patron) =>
  execSync(`git ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

function proponer(raiz) {
  const todas = rutasDe(`'${raiz}/**'`);
  const candidatos = new Set();
  for (const ruta of todas.filter((r) => /\.(ts|tsx|mts|css)$/.test(r))) {
    const fuente = readFileSync(ruta, 'utf8');
    const esCss = ruta.endsWith('.css');
    if (!esCss) declaradosEn(fuente).forEach((n) => candidatos.add(n));
    interfazEn(fuente, esCss).forEach((n) => candidatos.add(n));
  }

  const identificadores = {};
  const interfaz = {};
  const sinGlosario = new Set();

  for (const token of candidatos) {
    if (PROTEGIDOS.has(token)) continue;
    const partes = palabras(token);
    if (!partes.some((p) => GLOSARIO[p] !== undefined)) continue;
    const propuesto = traducir(token);
    if (!propuesto) {
      partes.filter((p) => GLOSARIO[p] === undefined).forEach((p) => sinGlosario.add(p));
      continue;
    }
    // Un nombre con guion es de interfaz —clase CSS o testid— y vive dentro de cadenas.
    if (token.includes('-') || token.includes('__')) interfaz[token] = propuesto;
    else identificadores[token] = propuesto;
  }

  const archivos = {};
  for (const ruta of todas) {
    const trozos = ruta.split('/');
    const nombre = trozos[trozos.length - 1];
    const [base, ...extension] = nombre.split('.');
    /*
     * Un archivo que se llama como un idioma NO es una palabra en espanol.
     *
     * `catalogo/es.ts` es el catalogo del espanol y `es` es su etiqueta BCP-47; el glosario lo
     * leyo como el verbo y propuso `catalogo/is.ts`. Dos o tres letras no alcanzan para un
     * nombre de archivo en este repositorio, asi que no hay nada que perder por saltarlos.
     */
    if (base.length <= 3) continue;
    const propuesto = traducir(base);
    if (propuesto) {
      archivos[ruta] = [...trozos.slice(0, -1), [propuesto, ...extension].join('.')].join('/');
    }
  }

  /*
   * Un identificador que TAMBIEN es un literal de cadena en algun sitio es ambiguo.
   *
   * `valor` es una variable en veinte archivos y a la vez un miembro de la union
   * `'valor' | 'titulo' | 'etiqueta'`. Renombrar el lado del codigo sin el de la union deja un
   * `Record` con claves que su propio tipo no admite, y eso no se ve hasta el typecheck; peor, si
   * el literal es un valor de negocio —el texto que se compara en una consulta— compila y falla
   * al ejecutar.
   *
   * Se mira solo donde el literal SIGNIFICA algo: uniones de tipos, listas `as const` y el
   * vocabulario de `nl-query`. Un mismo texto dentro de un testid o de una clase CSS no es un
   * conflicto —se renombra en las dos zonas y sigue casando—, y tratarlo como tal dejaria en
   * espanol la mitad del repositorio.
   */
  const literales = new Set();
  for (const ruta of rutasDe("'*.ts' '*.tsx' '*.mts'")) {
    if (ruta.startsWith('tools/rename/')) continue;
    const fuente = readFileSync(ruta, 'utf8');

    // Miembros de una union de literales: `type X = 'a' | 'b'` y `['a', 'b'] as const`.
    for (const m of fuente.matchAll(/'([A-Za-z_$][\w$-]*)'\s*(?=\|)|\|\s*'([A-Za-z_$][\w$-]*)'/g)) {
      literales.add(m[1] ?? m[2]);
    }
    for (const m of fuente.matchAll(/\[([^\]]*)\]\s*as\s+const/g)) {
      for (const l of (m[1] ?? '').matchAll(/'([A-Za-z_$][\w$-]*)'/g)) literales.add(l[1]);
    }
    // El vocabulario con el que se interpreta una pregunta escrita es dato, no codigo.
    if (ruta.startsWith('packages/nl-query/')) {
      for (const trozo of segmentar(fuente)) {
        if (trozo.tipo !== 'cadena') continue;
        for (const l of trozo.texto.matchAll(/([A-Za-z_$][\w$-]*)/g)) literales.add(l[1]);
      }
    }
  }

  const ambiguos = {};
  for (const viejo of Object.keys(identificadores)) {
    if (literales.has(viejo)) {
      ambiguos[viejo] = identificadores[viejo];
      delete identificadores[viejo];
    }
  }

  /*
   * El nombre de destino no puede EXISTIR YA en el repositorio.
   *
   * `porId` traduce a `id`, y en el archivo donde vivia habia un parametro `id`: el renombrado
   * produjo `id.get(id)`, que compila —los dos son cadenas— y esta mal. El typecheck no lo ve y
   * las pruebas tampoco, porque el mapa queda sin usar y el resultado es siempre nulo.
   *
   * Es la peor clase de fallo de este trabajo: silencioso. Por eso se comprueba contra todos los
   * identificadores que ya existen, no solo contra los otros destinos propuestos.
   */
  const existentes = new Set();
  for (const ruta of rutasDe("'*.ts' '*.tsx' '*.mts'")) {
    if (ruta.startsWith('tools/rename/')) continue;
    declaradosEn(readFileSync(ruta, 'utf8')).forEach((n) => existentes.add(n));
  }
  const ocupados = {};
  for (const [viejo, nuevo] of Object.entries(identificadores)) {
    if (existentes.has(nuevo)) {
      ocupados[viejo] = nuevo;
      delete identificadores[viejo];
    }
  }

  /*
   * Dos nombres distintos no pueden acabar en el mismo.
   *
   * `tema` y `temaDe` traducen los dos a `theme`, y en el mismo ambito eso no compila. Se
   * apartan los dos para decidirlos a mano: elegir uno por orden alfabetico seria elegir al azar.
   */
  const porDestino = new Map();
  for (const [viejo, nuevo] of Object.entries(identificadores)) {
    porDestino.set(nuevo, [...(porDestino.get(nuevo) ?? []), viejo]);
  }
  const colisiones = {};
  for (const [nuevo, viejos] of porDestino) {
    if (viejos.length > 1) {
      colisiones[nuevo] = viejos;
      viejos.forEach((v) => delete identificadores[v]);
    }
  }

  return {
    identificadores,
    interfaz,
    archivos,
    colisiones,
    ocupados,
    ambiguos,
    sinGlosario: [...sinGlosario].sort(),
  };
}

/* ── Aplicacion ──────────────────────────────────────────────────────────────────────────── */

function expresionDe(claves) {
  if (claves.length === 0) return null;
  const alternativas = claves
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(`(?<![A-Za-z0-9_$])(${alternativas})(?![A-Za-z0-9_$])`, 'g');
}

const dirDe = (ruta) => ruta.split('/').slice(0, -1).join('/');

/*
 * Un especificador solo se reescribe si HOY no resuelve y con el nombre nuevo si.
 *
 * El mapa de movimientos va por nombre base, y aplicado a cualquier parte de la ruta reescribe
 * lo que no debe: mover `presentacion/iconos.ts` a `presentacion/icons.ts` convirtio
 * `../iconos/Icono` —otra carpeta, en otro paquete, que da la casualidad de llamarse igual— en
 * `../icons/Icono`, que no existe. Comprobar contra el disco quita la ambiguedad entera: si el
 * destino actual sigue ahi, no hay nada que reescribir.
 */
function rutaArreglada(texto, dir, rutas) {
  const m = texto.match(/^(['"`])(\.{1,2}\/(?:.*\/)?)([^/'"`]+)\1$/);
  if (!m) return texto;
  const [, comilla, carpeta, base] = m;
  const destino = rutas[base];
  if (destino === undefined) return texto;

  const resuelve = (b) => SUFIJOS.some((suf) => existsSync(resolve(dir, carpeta + b + suf)));
  if (resuelve(base) || !resuelve(destino)) return texto;
  return `${comilla}${carpeta}${destino}${comilla}`;
}

function aplicar(plan) {
  const { identificadores = {}, interfaz = {}, valores = {}, archivos = {} } = plan;

  /*
   * Un archivo que se mueve arrastra su ruta en cada `import`.
   *
   * La ruta vive dentro de una cadena y su nombre no es un identificador, asi que ningun mapa la
   * alcanza: sin esto, el renombrado deja todos los imports apuntando a un archivo que ya no
   * existe y nada compila.
   */
  const rutas = {};
  for (const [viejo, nuevo] of Object.entries(archivos)) {
    const base = (v) => v.split('/').pop().replace(/\.(tsx?|mts)$/, '');
    if (base(viejo) !== base(nuevo)) rutas[base(viejo)] = base(nuevo);
  }
  // En comentario solo lo compuesto: una palabra suelta es indistinguible de prosa en espanol.
  const compuestos = Object.fromEntries(
    Object.entries(identificadores).filter(([k]) => palabras(k).length > 1),
  );
  /*
   * `valores` son literales de cadena que ademas son contrato interno: los dos modos de color,
   * las categorias de una union discriminada. Se renombran en cadena Y en codigo, porque un
   * `Record<ModoDeColor, …>` los lleva como claves de objeto y la union los lleva como literales:
   * renombrar solo uno de los dos lados no compila.
   */
  const enCadena = { ...interfaz, ...compuestos, ...valores };
  const enMarcado = { ...interfaz, ...compuestos, ...valores };

  /*
   * Los nombres de interfaz entran TAMBIEN en la zona de codigo.
   *
   * `data-eje=` en un TSX es codigo, no cadena, y `[data-eje=` en el CSS es marcado. Los dos
   * llevan el mismo nombre y tienen que moverse juntos. Meterlos aqui no arriesga nada: un
   * nombre con guion no puede ser un identificador de JavaScript, asi que solo casa donde debe.
   */
  const codigoCompleto = { ...identificadores, ...valores, ...interfaz };
  const reCodigo = expresionDe(Object.keys(codigoCompleto));
  const reComentario = expresionDe(Object.keys(compuestos));
  const reCadena = expresionDe(Object.keys(enCadena));
  const reMarcado = expresionDe(Object.keys(enMarcado));

  let tocados = 0;
  let sustituciones = 0;

  for (const ruta of rutasDe("'*.ts' '*.tsx' '*.mts' '*.css' '*.md'")) {
    if (ruta.startsWith('tools/rename/')) continue;
    const antes = readFileSync(ruta, 'utf8');
    let despues;

    if (ruta.endsWith('.css') || ruta.endsWith('.md')) {
      despues = reMarcado
        ? antes.replace(reMarcado, (m) => {
            sustituciones++;
            return enMarcado[m] ?? m;
          })
        : antes;
    } else {
      despues = unir(
        segmentarJsx(antes).map((s) => {
          // La prosa visible de un JSX no se toca: no hay ningun identificador dentro.
          if (s.tipo === 'prosa') return s;
          /*
           * Las rutas de los archivos movidos se sustituyen SOLO en un especificador de modulo.
           *
           * Aplicandolas a toda cadena, mover `cola.ts` a `queue.ts` convertia la palabra `cola`
           * en `queue` dentro del catalogo de mensajes en espanol: «La exportacion esta en
           * queue». Una ruta solo es una ruta si empieza por `./` o `../`.
           */
          if (s.tipo === 'cadena' && /^['"`]\.{1,2}\//.test(s.texto)) {
            const arreglada = rutaArreglada(s.texto, dirDe(ruta), rutas);
            if (arreglada !== s.texto) sustituciones++;
            return { ...s, texto: arreglada };
          }
          const re =
            s.tipo === 'codigo' ? reCodigo : s.tipo === 'cadena' ? reCadena : reComentario;
          const mapa =
            s.tipo === 'codigo' ? codigoCompleto : s.tipo === 'cadena' ? enCadena : compuestos;
          if (!re) return s;
          return {
            ...s,
            texto: s.texto.replace(re, (m) => {
              sustituciones++;
              return mapa[m] ?? m;
            }),
          };
        }),
      );
    }

    if (antes !== despues) {
      writeFileSync(ruta, despues);
      tocados++;
    }
  }
  return { tocados, sustituciones };
}

/*
 * Cada especificador relativo tiene que apuntar a un archivo que existe.
 *
 * El `tsc --noResolve` de mas abajo comprueba que lo escrito se ANALIZA, no que se resuelve: un
 * `import './cola'` cuyo archivo ya se llama `queue.ts` pasa el analisis y revienta al ejecutar.
 * Ocurre siempre que el movimiento y la sustitucion no van en la misma pasada —por ejemplo al
 * repetir el renombrado sobre archivos ya movidos, donde no hay nada que mover y el mapa de
 * rutas sale vacio—, y entonces las pruebas fallan por «Cannot find module» sin decir por que.
 */
const SUFIJOS = ['', '.ts', '.tsx', '.mts', '.d.ts', '.css', '.json', '/index.ts', '/index.tsx'];

const EXTENSIONES_DE_FUENTE = /\.(tsx?|mts|css|md|json|mjs)$/;

function especificadoresRotos() {
  const rotos = [];
  const nombresDeArchivo = new Set(rutasDe("'*'").map((r) => r.split('/').pop()));
  for (const ruta of rutasDe("'*.ts' '*.tsx' '*.mts'")) {
    // Los `.d.ts` ambientales los escribe la herramienta, no nosotros, y apuntan a lo construido:
    // `next-env.d.ts` referencia `.next/types/`, que existe o no segun cuando se mire.
    if (ruta.startsWith('tools/rename/') || ruta.endsWith('.d.ts')) continue;
    const dir = ruta.split('/').slice(0, -1).join('/');
    const fuente = readFileSync(ruta, 'utf8');

    const re = /(?:from|import|require)\s*\(?\s*['"](\.{1,2}\/[^'"]*)['"]/g;
    let m = re.exec(fuente);
    while (m) {
      const destino = resolve(dir, m[1]);
      if (!SUFIJOS.some((s) => existsSync(destino + s))) rotos.push(`${ruta}: ${m[1]}`);
      m = re.exec(fuente);
    }

    /*
     * Una prueba que LEE un archivo fuente lo nombra por su ruta desde la raiz.
     *
     * `theme.spec.ts` abre `components/Rejilla.tsx` para comprobar que la variable CSS que el
     * componente escribe es la que la hoja de estilo lee. Movido el archivo, la cadena se queda
     * apuntando a donde ya no hay nada; es `cadena`, asi que ningun mapa de codigo la alcanza.
     */
    // Con al menos una barra: sin ella, un token como `radius.md` pasaria por un archivo.
    const reRepo = /['"`]([\w.-]+(?:\/[\w.-]+)+\.\w+)['"`]/g;
    let r = reRepo.exec(fuente);
    while (r) {
      // Se compara por el NOMBRE del archivo: la ruta suele componerse con `join(...)` en tiempo
      // de ejecucion, asi que no se puede resolver aqui, pero un nombre que no existe en ningun
      // sitio del repositorio no apunta a nada.
      const base = r[1].split('/').pop();
      if (EXTENSIONES_DE_FUENTE.test(base) && !nombresDeArchivo.has(base)) {
        rotos.push(`${ruta}: ${r[1]}`);
      }
      r = reRepo.exec(fuente);
    }
  }
  return rotos;
}

/*
 * Una cadena en posicion de PROPIEDAD sigue siendo un nombre de propiedad.
 *
 * `obj['clave']`, `'clave' in obj` y el tipo indexado `Tipo['clave']` nombran lo mismo que
 * `obj.clave`, pero viven en una cadena y ningun mapa de codigo las alcanza. Renombrar solo el
 * lado del codigo deja las dos mitades apuntando a sitios distintos: unas veces lo ve el
 * typecheck —`'paneles' in config` cuando la propiedad ya es `panels`— y otras no, porque el
 * objeto es un `Record<string, unknown>` que viene de la red.
 *
 * No se sustituye sola: `body['clave']` es el contrato HTTP y renombrarlo sin tocar al emisor
 * devuelve 400. Se avisa, con el archivo y la linea, y se decide caso por caso.
 */
function accesosPorCadena(claves) {
  if (claves.length === 0) return [];
  const alternativa = claves.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`\\[\\s*['"\`](${alternativa})['"\`]\\s*\\]|['"\`](${alternativa})['"\`]\\s+in\\s`, 'g');
  const avisos = [];
  for (const ruta of rutasDe("'*.ts' '*.tsx' '*.mts'")) {
    if (ruta.startsWith('tools/rename/')) continue;
    const lineas = readFileSync(ruta, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(re)) avisos.push(`${ruta}:${i + 1}: ${m[1] ?? m[2]}`);
    });
  }
  return avisos;
}

function moverArchivos(mapa) {
  let movidos = 0;
  for (const [viejo, nuevo] of Object.entries(mapa)) {
    if (!existsSync(viejo) || viejo === nuevo) continue;
    execSync(`git mv "${viejo}" "${nuevo}"`);
    movidos++;
  }
  return movidos;
}

const [orden, argumento] = process.argv.slice(2);

if (orden === '--proponer') {
  console.log(JSON.stringify(proponer(argumento), null, 2));
} else if (orden === '--aplicar') {
  const plan = JSON.parse(readFileSync(argumento, 'utf8'));
  /*
   * Primero se MUEVE y despues se sustituye.
   *
   * `rutaArreglada` decide mirando el disco: solo reescribe el especificador que hoy no resuelve.
   * Sustituyendo antes de mover, el archivo viejo sigue ahi, el especificador resuelve, no se
   * toca, y el movimiento lo rompe justo despues.
   */
  const movidos = moverArchivos(plan.archivos ?? {});
  const { tocados, sustituciones } = aplicar(plan);
  console.log(`${sustituciones} sustituciones en ${tocados} archivos; ${movidos} archivos movidos`);

  /*
   * Se comprueba que lo escrito SIGUE SIENDO analizable.
   *
   * Un renombrado puede producir un archivo que no es JavaScript —una palabra reservada, un
   * nombre que ya existia en ese ambito— y eso no lo ve el typecheck si nx replica un resultado
   * cacheado. El analizador es barato y falla en el sitio, no tres pasos mas adelante.
   */
  const rotos = execSync(
    "npx tsc --noEmit --allowJs false --skipLibCheck --module esnext --target es2022 " +
      "--moduleResolution bundler --jsx preserve --noResolve $(git ls-files '*.ts' '*.tsx') " +
      "2>&1 | grep -E 'error TS(1[0-9]{3}|2451)' | head -10 || true",
    { shell: '/bin/bash' },
  ).toString().trim();
  if (rotos) {
    console.error('SINTAXIS ROTA tras aplicar:');
    console.error(rotos);
    process.exit(3);
  }

  const sinDestino = especificadoresRotos();
  if (sinDestino.length > 0) {
    console.error('IMPORTS SIN DESTINO tras aplicar:');
    console.error(sinDestino.join('\n'));
    process.exit(4);
  }

  const porCadena = accesosPorCadena([
    ...Object.keys(plan.identificadores ?? {}),
    ...Object.keys(plan.valores ?? {}),
  ]);
  if (porCadena.length > 0) {
    console.error('AVISO - cadenas en posicion de propiedad que siguen en espanol:');
    console.error(porCadena.join('\n'));
  }
} else if (orden === '--traducir') {
  console.log(traducir(argumento) ?? '(sin traduccion)');
} else {
  console.log('uso: --traducir <id> | --proponer <ruta> | --aplicar <plan.json>');
}
