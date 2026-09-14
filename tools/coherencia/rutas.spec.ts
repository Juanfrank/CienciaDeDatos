import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Toda URL de `/admin` o `/api` que el codigo pide tiene que existir como ruta.
 *
 * La URL vive en una cadena y la ruta es una CARPETA: nada las ata. El renombrado al ingles
 * tradujo la URL del panel de «quien ve que» dentro del componente y de las pruebas, y dejo la
 * carpeta como estaba. La pagina pasaba a ser un 404 — y la prueba de
 * accesibilidad seguia en verde, porque un 404 tambien es accesible.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const app = join(raiz, 'apps/shell/app');

/** Las rutas estaticas que el enrutador sirve de verdad, sin los grupos entre parentesis. */
function rutas(dir: string, prefijo = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => {
      // `(modulos)` agrupa sin aparecer en la URL; `[slug]` es dinamico y aqui no se comprueba.
      const segmento = /^\(.*\)$/.test(e.name) ? prefijo : `${prefijo}/${e.name}`;
      return [segmento, ...rutas(join(dir, e.name), segmento)];
    });
}

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === '.next' || e.name === 'node_modules' ? [] : fuentes(ruta);
    return /\.tsx?$/.test(e.name) ? [ruta] : [];
  });
}

describe('rutas', () => {
  const servidas = new Set(rutas(app).filter(Boolean));

  it('el enrutador declara las rutas que se esperan', () => {
    expect(servidas.has('/admin/quien-ve-que')).toBe(true);
    expect(existsSync(join(app, 'api/admin/quien-ve-que/route.ts'))).toBe(true);
  });

  it('ninguna URL de /admin o /api apunta a una ruta que no existe', () => {
    const rotas: string[] = [];
    for (const archivo of fuentes(join(raiz, 'apps/shell'))) {
      const contenido = readFileSync(archivo, 'utf8');
      for (const m of contenido.matchAll(/['"`](\/(?:api\/)?admin\/[a-z][\w/-]*)/g)) {
        const url = m[1] as string;
        if (!servidas.has(url)) rotas.push(`${archivo.slice(raiz.length + 1)}: ${url}`);
      }
    }
    expect([...new Set(rotas)].sort()).toEqual([]);
  });
});
