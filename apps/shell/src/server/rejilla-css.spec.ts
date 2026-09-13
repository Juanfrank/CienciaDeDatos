import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLUMNS_BY_BREAKPOINT } from '@app/module-model';

/** Las columnas de la hoja de estilos y las del modelo dicen lo mismo. */

const css = readFileSync(join(process.cwd(), 'apps/shell/app/globals.css'), 'utf8');

describe('la rejilla del modulo reparte las columnas de cada tamano', () => {
  it('en movil, una sola columna', () => {
    expect(COLUMNS_BY_BREAKPOINT.movil).toBe(1);
    // Una columna no se escribe `repeat(1, ...)`: `1fr` dice lo mismo y se lee mejor.
    expect(css).toMatch(/@media \(max-width: 639px\) \{[^}]*\.rejilla \{ grid-template-columns: 1fr; \}/s);
  });

  it('en tableta, las que diga el modelo', () => {
    const n = COLUMNS_BY_BREAKPOINT.tableta;
    expect(css).toContain(`.rejilla { grid-template-columns: repeat(${n}, minmax(0, 1fr)); }`);
  });

  it('y el numero de escritorio sale de una variable, no de una cifra escrita', () => {
    // En escritorio no hay media query: la rejilla lee `--rejilla-columnas`, que emite el
    // componente desde `GRID_COLUMNS`. Ahi no hay dos copias que mantener.
    expect(css).toContain('repeat(var(--rejilla-columnas), minmax(0, 1fr))');
  });
});
