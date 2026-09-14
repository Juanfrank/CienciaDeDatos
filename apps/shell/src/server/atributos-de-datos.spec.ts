import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cada `[data-x]` del CSS tiene que corresponder con un `data-x` que algun componente escriba.
 *
 * Es un contrato entre dos idiomas: el atributo lo pone el TSX y lo lee el CSS, y nada los ata.
 * Un renombrado que toque el TSX y no el selector no rompe la compilacion ni ninguna prueba de
 * unidad; la regla simplemente deja de aplicarse y el estilo desaparece en silencio. Paso con
 * `data-tema`, con `data-eje` y con otros tres, y solo lo vio una prueba de navegador que medía
 * el `overflow` resultante.
 */

const raiz = join(__dirname, '../../../..');

function archivos(dir: string, extensiones: string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '.next' ? [] : archivos(ruta, extensiones);
    return extensiones.some((x) => e.name.endsWith(x)) ? [ruta] : [];
  });
}

function coincidencias(rutas: string[], re: RegExp): Set<string> {
  const nombres = new Set<string>();
  for (const ruta of rutas) {
    for (const m of readFileSync(ruta, 'utf8').matchAll(re)) nombres.add(m[1] as string);
  }
  return nombres;
}

describe('atributos de datos', () => {
  const fuentes = archivos(join(raiz, 'apps'), ['.tsx', '.ts']);
  // `data-x=` en JSX y `dataset.x` cuando se escribe desde un efecto.
  const puestos = new Set([
    ...coincidencias(fuentes, /\bdata-([a-z][\w-]*)\s*=/g),
    ...coincidencias(fuentes, /\bdataset\.([a-zA-Z][\w]*)/g),
  ]);
  const usados = coincidencias(archivos(join(raiz, 'apps/shell/app'), ['.css']), /\[data-([a-z][\w-]*)/g);

  it('ningun selector espera un atributo que ya no se escribe', () => {
    expect([...usados].filter((a) => !puestos.has(a)).sort()).toEqual([]);
  });

  it('ningun atributo de la interfaz se queda a medio camino de ser `data-`', () => {
    // `data-pestana` se convirtio en `tab-data`, que el navegador no reconoce como atributo de
    // datos: el selector lo encontraba solo porque los dos lados llevaban el mismo error.
    const aMedias = new Set<string>();
    for (const ruta of fuentes) {
      for (const m of readFileSync(ruta, 'utf8').matchAll(/\s([a-z][\w-]*-data)\s*=\s*\{/g)) {
        aMedias.add(m[1] as string);
      }
    }
    expect([...aMedias].sort()).toEqual([]);
  });

  it('ningun atributo de datos lleva mayusculas', () => {
    // El navegador pasa a minusculas el nombre del atributo, asi que `data-textPosition` llega al
    // DOM como `data-textposition` y el selector que lo busca tal cual no encuentra nada.
    expect([...puestos].filter((a) => a.includes('-') && a !== a.toLowerCase())).toEqual([]);
  });
});
