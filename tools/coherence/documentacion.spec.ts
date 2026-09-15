import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- herramienta en JavaScript, sin tipos.
import { segmentarJsx } from '../rename/segmentos.mjs';

/**
 * Lo que la documentacion y el texto en pantalla dicen, contra lo que el repositorio es.
 *
 * Tres contratos que nadie ata y que el renombrado al ingles rompio a la vez: una ruta citada en
 * un `.md` que ya no existe, una carpeta de codigo sin su `AGENTS.md`, y una palabra inglesa
 * dentro de una frase que una persona lee en pantalla. Ninguno rompe la compilacion; los tres
 * hacen que la documentacion mienta.
 */

/**
 * Una ruta citada en un `.md` tiene que existir.
 *
 * Las especificaciones para agentes son indices: dicen que archivo resuelve que. Cuando el
 * codigo se mueve —y el renombrado al ingles movio ciento y pico archivos— el indice apunta a
 * donde ya no hay nada, y quien lo lea buscara `datos.ts` en una carpeta donde ahora esta
 * `data.ts`. No rompe nada al compilar: solo hace que la documentacion mienta.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (pattern: string) =>
  execSync(`git -C ${raiz} ls-files ${pattern}`).toString().trim().split('\n').filter(Boolean);

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
 * patron con comodin, un marcador de posicion entre angulos, los dos modismos que llevan barra y
 * una extension suelta: `.md` nombra una clase de archivo, no un archivo.
 */
const NO_ES_RUTA = [
  /^https?:/,
  /^\.\w+$/,
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
          const exists =
            versionados.has(limpia) ||
            carpetas.has(limpia) ||
            versionados.has(`${dir}/${limpia}`) ||
            carpetas.has(`${dir}/${limpia}`) ||
            versionados.has(resolve(dir, limpia).slice(raiz.length + 1)) ||
            (!limpia.includes('/') && nombres.has(limpia));
          if (!exists) rotas.push(`${md}:${i + 1}: ${cita}`);
        }
      });
    }
    expect(rotas.sort()).toEqual([]);
  });
});

/**
 * Cada carpeta con codigo declara sus reglas en un `AGENTS.md`.
 *
 * La convencion solo sirve si no se puede olvidar: un paquete nuevo sin especificacion deja a
 * quien llegue despues —persona o agente— adivinando que puede importar y que no.
 */


const CARPETAS = [
  '.',
  'apps',
  'apps/shell',
  'apps/shell/app',
  'apps/shell/e2e',
  'apps/shell/src/server',
  'apps/shell/src/components',
  'apps/shell/src/components/editor',
  'apps/cache-populator',
  'apps/modules',
  'packages',
  'packages/data-contracts',
  'tools',
  'tools/rename',
  'tools/coherence',
  'infra',
];

describe('cada carpeta declara sus reglas', () => {
  for (const carpeta of CARPETAS) {
    it(`${carpeta}/AGENTS.md existe y dice que NO hacer`, () => {
      const path = join(raiz, carpeta, 'AGENTS.md');
      expect(existsSync(path), path).toBe(true);

      const content = readFileSync(path, 'utf8');
      expect(content.length, path).toBeGreaterThan(400);
      // La mitad util de una especificacion es la lista de lo prohibido: sin ella se lee como
      // una descripcion y no como un contrato.
      expect(content, path).toMatch(/Que NO hacer/);
    });
  }

  it('todo paquete de `packages` tiene el suyo', () => {
    const paquetes = readdirSync(join(raiz, 'packages'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'data-contracts')
      .map((e) => e.name);

    const sinEspecificacion = paquetes.filter(
      (p) => !existsSync(join(raiz, 'packages', p, 'AGENTS.md')),
    );

    expect(sinEspecificacion).toEqual([]);
  });

  it('la especificacion general enumera los cuatro principios y como correr en local', () => {
    const general = readFileSync(join(raiz, 'AGENTS.md'), 'utf8');
    for (const cacheKey of ['principio', 'npm run verify', 'Limites de dependencia']) {
      expect(general.toLowerCase(), cacheKey).toContain(cacheKey.toLowerCase());
    }
  });

  /*
   * Todo `npm run X` de un `.md` tiene que ser un script que exista.
   *
   * Esta comprobacion pedia antes UN nombre concreto —`npm run poblar`— y por eso el renombrado
   * al ingles la dejo pasar: el script paso a llamarse `populate` y la guia siguio diciendo
   * `poblar`, que es la PRIMERA orden que ejecuta quien clona el repositorio. Un guardia que
   * comprueba un nombre escrito a mano envejece igual que la documentacion que vigila; este lee
   * los nombres de `package.json`, asi que renombrar un script y no tocar la guia falla aqui.
   */
  it('cada `npm run` citado en un .md existe en package.json', () => {
    const scripts = new Set(
      Object.keys(
        (JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as {
          scripts: Record<string, string>;
        }).scripts,
      ),
    );

    const rotos: string[] = [];
    for (const doc of listar("'*.md'")) {
      const texto = readFileSync(join(raiz, doc), 'utf8');
      for (const [, nombre] of texto.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) {
        if (nombre !== undefined && !scripts.has(nombre)) rotos.push(`${doc}: npm run ${nombre}`);
      }
    }

    expect(rotos).toEqual([]);
  });
});

/**
 * La aplicacion habla espanol. Ninguna palabra inglesa se cuela en lo que se lee en pantalla.
 *
 * El renombrado al ingles toca identificadores, y el texto de un JSX no lo es: para el escaner,
 * `<h1>Editor de modulos</h1>` esta en zona de codigo, asi que `modulos` paso a `modules` y la
 * cabecera del editor quedo escrita medio en ingles. No rompe la compilacion ni ninguna otra
 * prueba —la aplicacion funciona igual—, y por eso llego a cincuenta y cuatro sitios antes de
 * que alguien lo viera.
 *
 * Se compara contra el glosario: si una palabra del texto visible es la TRADUCCION de una palabra
 * espanola, y no es a la vez espanola ni un prestamo que el producto ya usa, es que el renombrado
 * llego donde no debia.
 */

const GLOSARIO = JSON.parse(readFileSync(`${raiz}/tools/rename/glosario.json`, 'utf8'));

/** Palabras inglesas que el producto usa en espanol y no son un error. */
const PRESTAMOS = new Set([
  'total', 'color', 'panel', 'grid', 'slug', 'email', 'web', 'tooltip', 'online', 'chart', 'test',
  'general', 'normal', 'local', 'final', 'error', 'material', 'digital', 'regional', 'base',
  'area', 'banner', 'simple', 'plural', 'html', 'css', 'login', 'hover', 'scroll', 'drill',
]);

const espanolas = new Set(Object.keys(GLOSARIO).filter((k) => !k.startsWith('_')));
const traducciones = new Set(
  Object.entries(GLOSARIO)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string')
    .map(([, v]) => (v as string).toLowerCase())
    .filter((v) => v.length >= 3 && !espanolas.has(v) && !PRESTAMOS.has(v)),
);

const tsx = execSync(`git -C ${raiz} ls-files '*.tsx'`).toString().trim().split('\n').filter(Boolean);

describe('texto visible', () => {
  it('hay archivos que revisar', () => {
    expect(tsx.length).toBeGreaterThan(20);
  });

  it('ninguna palabra del texto de un JSX es una traduccion del glosario', () => {
    const intrusas: string[] = [];
    for (const ruta of tsx) {
      const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
      for (const s of segmentarJsx(fuente) as { tipo: string; texto: string }[]) {
        if (s.tipo !== 'prosa') continue;
        for (const palabra of s.texto.match(/[A-Za-zÀ-ÿ]{3,}/g) ?? []) {
          if (traducciones.has(palabra.toLowerCase())) intrusas.push(`${ruta}: ${palabra}`);
        }
      }
    }
    expect([...new Set(intrusas)].sort()).toEqual([]);
  });
});
