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
import { segmentar, unir } from './segmentos.mjs';

const GLOSARIO = JSON.parse(readFileSync('tools/rename/glosario.json', 'utf8'));
const ENLACES = new Set(['de', 'del', 'en', 'por', 'con', 'a', 'y', 'que', 'para', 'un', 'una']);
const VERBOS = new Set(GLOSARIO['_verbos']);
const ADJETIVOS = new Set(GLOSARIO['_adjetivos']);
const SINGULAR = GLOSARIO['_singular'];

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
    const propuesto = identificador
      .split('__')
      .map((t) => traducir(t) ?? t)
      .join('__');
    return propuesto === identificador ? null : propuesto;
  }

  const partes = palabras(identificador);
  if (partes.length === 0) return null;

  const hayComplemento = partes.some((p) => ENLACES.has(p) && p !== 'y');
  const utiles = partes.filter((p) => !ENLACES.has(p));
  if (utiles.length === 0) return null;

  const traducidas = utiles.map((p) => GLOSARIO[p] ?? (/^\d+$/.test(p) ? p : null));
  if (traducidas.includes(null)) return null;

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
  } else {
    ordenadas = traducidas;
  }

  const planas = ordenadas.flatMap((p) => palabras(p));
  const atributivas = planas.map((p, i) => (i < planas.length - 1 ? (SINGULAR[p] ?? p) : p));
  const propuesto = recomponer(atributivas, estilo(identificador));
  return propuesto === identificador ? null : propuesto;
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
  const codigo = segmentar(fuente)
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
    return nombres;
  }
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
  const enCadena = { ...interfaz, ...compuestos, ...valores, ...rutas };
  const enMarcado = { ...interfaz, ...compuestos, ...valores };

  const codigoCompleto = { ...identificadores, ...valores };
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
        segmentar(antes).map((s) => {
          const re = s.tipo === 'codigo' ? reCodigo : s.tipo === 'cadena' ? reCadena : reComentario;
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
  const { tocados, sustituciones } = aplicar(plan);
  const movidos = moverArchivos(plan.archivos ?? {});
  console.log(`${sustituciones} sustituciones en ${tocados} archivos; ${movidos} archivos movidos`);
} else if (orden === '--traducir') {
  console.log(traducir(argumento) ?? '(sin traduccion)');
} else {
  console.log('uso: --traducir <id> | --proponer <ruta> | --aplicar <plan.json>');
}
