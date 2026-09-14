import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Una ruta citada en un `.md` tiene que existir.
 *
 * Las especificaciones para agentes son indices: dicen que archivo resuelve que. Cuando el
 * codigo se mueve —y el renombrado al ingles movio ciento y pico archivos— el indice apunta a
 * donde ya no hay nada, y quien lo lea buscara `datos.ts` en una carpeta donde ahora esta
 * `data.ts`. No rompe nada al compilar: solo hace que la documentacion mienta.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const versionados = new Set(listar(''));
const nombres = new Set([...versionados].map((f) => f.split('/').pop() as string));
const carpetas = new Set<string>();
for (const archivo of versionados) {
  const partes = archivo.split('/');
  for (let i = 1; i < partes.length; i += 1) carpetas.add(partes.slice(0, i).join('/'));
}

/** Lo entrecomillado que PARECE una ruta: lleva barra o extension conocida. */
const EXTENSION = /\.(tsx?|mts|mjs|json|css|md|bicep|prisma|ya?ml|sh|sql)$/;

/**
 * Lo que se cita entre comillas y no es una ruta de este repositorio.
 *
 * Un paquete de npm (`@app/i18n`, `next/dynamic`), una URL de la aplicacion (`/admin`), un
 * patron con comodin, un marcador de posicion entre angulos y los dos modismos que llevan barra.
 */
const NO_ES_RUTA = [
  /^https?:/,
  /^@/,
  /^\//,
  /[*<>]/,
  /^(nx|npx|node|bash|git)\s/,
  /^\$/,
  /^(try\/catch|and\/or|y\/o)$/,
  /^next\/\w+$/,
  /^node:\w+$/,
];

/**
 * Citas que son deliberadamente historicas o genericas, con el motivo por el que se quedan.
 *
 * Las ADR son un registro fechado: reescribir el nombre de un archivo dentro de una decision ya
 * tomada falsearia lo que se decidio y cuando. El resto son patrones, no referencias.
 */
const DELIBERADAS = new Map<string, string>([
  ['docs/adr/', 'registro fechado de una decision: se lee como estaba el codigo entonces'],
  ['tools/rename/AGENTS.md', 'la tabla de peligros cita los nombres VIEJOS a proposito'],
  ['packages/AGENTS.md', 'src/index.ts y <archivo>.spec.ts son patrones, no rutas'],
  ['packages/data-contracts/README.md', 'sql-queries/registry.json esta declarado como pendiente'],
]);

describe('referencias de los markdown', () => {
  const mds = listar("'*.md'");

  it('hay markdown que revisar', () => {
    expect(mds.length).toBeGreaterThan(20);
  });

  it('toda ruta citada existe', () => {
    const rotas: string[] = [];
    for (const md of mds) {
      if ([...DELIBERADAS.keys()].some((p) => md.startsWith(p))) continue;
      const dir = dirname(md);
      const lineas = readFileSync(`${raiz}/${md}`, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        for (const m of linea.matchAll(/`([^`\s]+?)`/g)) {
          const cita = m[1] as string;
          if (!cita.includes('/') && !EXTENSION.test(cita)) continue;
          if (NO_ES_RUTA.some((re) => re.test(cita))) continue;
          const limpia = cita.replace(/[#:].*$/, '').replace(/\/$/, '');
          if (limpia === '' || limpia === '.') continue;
          // Desde la raiz, relativa al propio `.md`, o solo el nombre del archivo.
          const existe =
            versionados.has(limpia) ||
            carpetas.has(limpia) ||
            versionados.has(`${dir}/${limpia}`) ||
            carpetas.has(`${dir}/${limpia}`) ||
            versionados.has(resolve(dir, limpia).slice(raiz.length + 1)) ||
            (!limpia.includes('/') && nombres.has(limpia));
          if (!existe) rotas.push(`${md}:${i + 1}: ${cita}`);
        }
      });
    }
    expect(rotas.sort()).toEqual([]);
  });
});
