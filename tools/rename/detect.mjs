import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { palabras, traducir } from "./renombrar.mjs";

/**
 * Encuentra los identificadores que siguen escritos en espanol.
 *
 * Se apoya en `.claude/depgraph.json` para saber que declara cada archivo y quien lo importa: un
 * nombre exportado que otros paquetes usan no se renombra igual que una variable local, y el mapa
 * es lo que distingue una cosa de la otra sin abrir los 351 archivos.
 *
 *   node tools/rename/detect.mjs [prefijo]   # informe por carpeta
 *   node tools/rename/detect.mjs --json      # una linea por hallazgo
 */

const root = execSync("git rev-parse --show-toplevel").toString().trim();
const glossary = JSON.parse(
  readFileSync(`${root}/tools/rename/glosario.json`, "utf8"),
);

/**
 * Palabras iguales en los dos idiomas y con el MISMO significado.
 *
 * `lateral`, `circular` o `selector` se escriben igual en ingles y quieren decir lo mismo, asi que
 * un identificador que las use ya se lee en ingles: no hay nada que renombrar. Estaban en el
 * glosario porque la herramienta de renombrado necesita saber traducirlas cuando aparecen dentro
 * de una palabra compuesta, no porque sean un error por si solas.
 */
export const SHARED = new Set([
  "anterior",
  "circular",
  "dispersion",
  "insignia",
  "lateral",
  "meta",
  "radio",
  "selector",
  "serie",
  "vista",
  "visible",
  "visibles",
  "vertical",
  "verticales",
  "horizontal",
  "normal",
  "total",
  "base",
  "color",
  "colores",
  "error",
  "panel",
  "paneles",
  "general",
  "local",
  "final",
  "material",
  "digital",
  "regional",
  "principal",
  "central",
  "natural",
  "legal",
  "social",
  "formal",
  "ideal",
  "personal",
  "plural",
  "singular",
  "simple",
  "version",
  "region",
  "dimension",
  "admin",
  "actor",
  "editor",
  "grid",
  "slug",
  "email",
  "web",
  "online",
  "test",
  "cron",
  "cookie",
  "props",
  "input",
  "login",
  "layout",
  "azure",
  "scope",
  "demo",
  "reset",
  "dataset",
  "item",
  "items",
  "variable",
  "shell",
  "url",
  "app",
  "hash",
  "mime",
  "ref",
  "echarts",
  "jsx",
  "binding",
  "ranking",
  "dims",
  "pepper",
  "resolver",
  "configuration",
  "blob",
  "token",
  "prisma",
]);

/**
 * Falsos amigos: se escriben igual en los dos idiomas y significan OTRA cosa.
 *
 * `alto` es la altura y en ingles es una voz; `cola` es una fila de espera y en ingles un refresco;
 * `peso` es el peso y en ingles una moneda. Se separan en su propia lista porque no valen como
 * excusa para dejarlos: un nombre que se lee en ingles con el significado equivocado engana mas
 * que uno que se lee en espanol.
 */
export const FALSE_FRIENDS = new Set([
  "alto",
  "cola",
  "con",
  "para",
  "peso",
  "sin",
  "sobre",
  "solo",
]);

/**
 * Vocabulario del dominio y datos sembrados: se escriben en espanol y se quedan.
 *
 * `Distrito` y `Materia` son columnas reales de `DimTribunal`, y `casos-pendientes` es el slug de
 * un modulo publicado. Traducirlos no seria renombrar codigo: seria romper el contrato con la
 * fuente de datos y cambiar una URL que ya esta en un marcador de alguien.
 */
export const DOMAIN = new Set([
  "ana",
  "beto",
  "admin",
  "norte",
  "este",
  "sur",
  "oeste",
  "distrito",
  "materia",
  "tribunal",
  "casos",
  "pendientes",
  "audiencias",
  "sentencias",
  "penal",
  "civil",
  "poderjudicial",
  "judicial",
  "demostracion",
]);

/** Espanol -> ingles, solo las entradas planas que de verdad traducen a otra palabra. */
const TRANSLATIONS = new Map(
  Object.entries(glossary).filter(
    ([word, english]) =>
      typeof english === "string" &&
      !word.startsWith("_") &&
      word !== english &&
      word.length >= 3,
  ),
);

const WORDS = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g;
const DECLARATIONS =
  /\b(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)|\b([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;

/**
 * Las PROPIEDADES tambien son identificadores.
 *
 * `definicion?.dimensiones ?? { min: 0, max: 0 }` no declara nada: son la firma de una interfaz y
 * la clave de un objeto. Se escapaban enteras del recuento —167 nombres distintos en 478 sitios—
 * porque solo se miraban las declaraciones, y son lo que mas se lee al usar una libreria desde
 * fuera.
 */
const PROPERTIES = /^\s{2,}([a-z][A-Za-z0-9_$]*)\??\s*:/gm;

/** Las palabras espanolas de un identificador, separadas de los falsos amigos. */
export function classify(name) {
  const spanish = [];
  const falseFriends = [];
  for (const word of palabras(name)) {
    const lower = word.toLowerCase();
    if (SHARED.has(lower) || DOMAIN.has(lower)) continue;
    if (FALSE_FRIENDS.has(lower)) falseFriends.push(lower);
    else if (TRANSLATIONS.has(lower)) spanish.push(lower);
  }
  return { spanish, falseFriends };
}

/**
 * Las palabras que el glosario no conoce.
 *
 * `traducir` devuelve `null` en cuanto una palabra le falta, que es lo correcto —media traduccion
 * es peor que ninguna—, pero deja sin decir CUAL falta. Esto lo dice, y es la lista de trabajo
 * para ampliar el glosario.
 */
export function unknownWords(name) {
  return palabras(name)
    .map((word) => word.toLowerCase())
    .filter(
      (word) =>
        !TRANSLATIONS.has(word) &&
        !SHARED.has(word) &&
        !DOMAIN.has(word) &&
        !/^\d+$/.test(word),
    );
}

/**
 * Lo que `depgraph` sabe de cada archivo: que define, que importa y quien lo nombra.
 *
 * El mapa es una lista de entradas con `path`, `defines`, `exports`, `references` e
 * `import_edges`, cada arista con el archivo al que resuelve. De ahi salen las dos preguntas que
 * deciden como se renombra un nombre: cuantos archivos lo importan y cuantos lo mencionan.
 */
function loadGraph() {
  const empty = {
    byPath: new Map(),
    importers: new Map(),
    mentions: new Map(),
  };
  let graph;
  try {
    graph = JSON.parse(readFileSync(`${root}/.claude/depgraph.json`, "utf8"));
  } catch {
    return empty;
  }
  const byPath = new Map();
  const importers = new Map();
  const mentions = new Map();
  for (const entry of graph.files ?? []) {
    byPath.set(entry.path, entry);
    for (const edge of entry.import_edges ?? []) {
      if (!edge.resolved) continue;
      if (!importers.has(edge.resolved))
        importers.set(edge.resolved, new Set());
      importers.get(edge.resolved).add(entry.path);
    }
    for (const name of entry.references ?? []) {
      if (!mentions.has(name)) mentions.set(name, new Set());
      mentions.get(name).add(entry.path);
    }
  }
  return { byPath, importers, mentions };
}

export function findAll(prefix = "") {
  const { byPath, importers, mentions } = loadGraph();
  const sources = execSync(
    `git -C ${root} ls-files '*.ts' '*.tsx' '*.mts' '*.mjs'`,
  )
    .toString()
    .trim()
    .split("\n")
    .filter((path) => path && path.startsWith(prefix));

  const findings = [];
  for (const path of sources) {
    const source = readFileSync(`${root}/${path}`, "utf8");
    const exported = new Set(
      [
        ...source.matchAll(
          /\bexport\s+(?:default\s+)?(?:async\s+)?(?:const|let|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
        ),
      ].map((match) => match[1]),
    );
    const seen = new Set();
    for (const match of [...source.matchAll(DECLARATIONS), ...source.matchAll(PROPERTIES)]) {
      const name = match[1] ?? match[2];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const { spanish, falseFriends } = classify(name);
      if (spanish.length === 0 && falseFriends.length === 0) continue;
      findings.push({
        path,
        name,
        proposal: traducir(name),
        unknown: unknownWords(name),
        words: spanish,
        falseFriends,
        exported: exported.has(name),
        importers: (importers.get(path) ?? new Set()).size,
        mentions: [...(mentions.get(name) ?? new Set())],
        mapped: byPath.has(path),
      });
    }
  }
  return findings;
}

if (process.argv[1]?.endsWith("detect.mjs")) {
  const asJson = process.argv.includes("--json");
  const prefix =
    process.argv.slice(2).find((argument) => !argument.startsWith("--")) ?? "";
  const findings = findAll(prefix);

  if (asJson) {
    for (const finding of findings) console.log(JSON.stringify(finding));
    process.exit(0);
  }

  const byFolder = new Map();
  for (const finding of findings) {
    const folder = finding.path.split("/").slice(0, 2).join("/");
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(finding);
  }

  const pad = (value, width) => String(value).padStart(width);
  console.log(
    "carpeta                          total  exportados  falsos amigos",
  );
  for (const [folder, list] of [...byFolder].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    const spanish = list.filter((f) => f.words.length > 0);
    console.log(
      `${folder.padEnd(32)}${pad(spanish.length, 5)}${pad(spanish.filter((f) => f.exported).length, 12)}${pad(list.filter((f) => f.falseFriends.length > 0).length, 15)}`,
    );
  }
  const spanish = findings.filter((f) => f.words.length > 0);
  console.log(
    `\n${spanish.length} identificadores en espanol, ${spanish.filter((f) => f.exported).length} exportados.`,
  );
  console.log(
    `${findings.filter((f) => f.falseFriends.length > 0).length} con un falso amigo (${[...FALSE_FRIENDS].join(", ")}).`,
  );
}
