import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  asThemeTokens,
  lightTheme,
  darkTheme,
  toCssVariables,
  materialVariables,
  type ColorMode,
} from '@app/design-tokens';
import { colorModeIs } from './theme';

/** El modo de color de la aplicacion — seccion 4.3. */
describe('que modo se pide', () => {
  it('acepta los dos modos que existen', () => {
    expect(colorModeIs('light')).toBe(true);
    expect(colorModeIs('dark')).toBe(true);
  });

  it('cualquier otra cosa no es un modo, y por tanto cae en light', () => {
    // Una cookie es texto que manda el cliente: mal escrita, con otra caja, vacia o manipulada
    // tiene que dejar la aplicacion en un estado dibujable, no a medio tema.
    for (const valor of ['obscuro', 'Dark', 'LIGHT', '', undefined, 'null']) {
      expect(colorModeIs(valor), String(valor)).toBe(false);
    }
  });
});

/** Toda variable CSS que la hoja de estilo LEE tiene que existir en los dos modos. */
describe('el tema cubre todas las variables que la hoja de estilo usa', () => {
  const css = readFileSync(join(process.cwd(), 'apps/shell/app/globals.css'), 'utf8');
  const usadas = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1] as string));
  const definidasEnCss = new Set(
    [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1] as string),
  );

  /** Las que rellena un componente al dibujar, no el tema. */
  const DE_COMPONENTE = [
    '--rejilla-columnas',
    '--multiplos-columnas',
    '--color-de-resaltado',
    '--col-movil',
    '--fila-movil',
    '--col-tableta',
    '--fila-tableta',
    '--col-escritorio',
    '--fila-escritorio',
  ];

  const emittedIn = (mode: ColorMode): Set<string> => {
    const theme = mode === 'light' ? lightTheme : darkTheme;
    return new Set([
      ...Object.keys(materialVariables(theme)),
      ...Object.keys(toCssVariables(asThemeTokens(theme))),
    ]);
  };

  for (const mode of ['light', 'dark'] as ColorMode[]) {
    it(`${mode}: ninguna variable leida se queda sin valor`, () => {
      const emitted = emittedIn(mode);
      const orphans = [...usadas].filter(
        (v) => !definidasEnCss.has(v) && !emitted.has(v) && !DE_COMPONENTE.includes(v),
      );

      expect(orphans.sort()).toEqual([]);
    });
  }

  it('la abreviatura `font:` de cada rol tipografico es un valor valido', () => {
    // No basta con que la variable exista: `font` exige grosor, tamano/interlineado y familia en
    // ese orden. Una variable presente pero mal formada vuelve a descartar la declaracion entera.
    const vars = materialVariables(darkTheme);
    for (const role of ['title-large', 'title-medium', 'label-large', 'body-small']) {
      expect(vars[`--md-sys-typescale-${role}`]).toMatch(/^\d{3} [\d.]+rem\/[\d.]+rem .+sans-serif$/);
    }
  });

  it('los componentes que usan la hoja de estilo declaran las variables que ella espera', () => {
    // La otra mitad de la lista de arriba: si alguien renombra `--rejilla-columnas` en el TSX y
    // no en el CSS, la rejilla se queda sin columnas.
    const tsx = ['components/Grid.tsx', 'components/objects.tsx', 'components/editor/Canvas.tsx']
      .map((f) => readFileSync(join(process.cwd(), 'apps/shell/src', f), 'utf8'))
      .join('\n');

    for (const nombre of ['--rejilla-columnas', '--multiplos-columnas', '--color-de-resaltado']) {
      expect(tsx, nombre).toContain(`'${nombre}'`);
    }
  });
});
