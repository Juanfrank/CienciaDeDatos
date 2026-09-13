import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  comoThemeTokens,
  temaClaro,
  temaOscuro,
  toCssVariables,
  variablesMaterial,
  type ModoDeColor,
} from '@app/design-tokens';
import { esModoDeColor } from './tema';

/**
 * El modo de color de la aplicacion — seccion 4.3.
 *
 * La parte de la cookie se prueba aqui y no en una prueba de navegador porque lo que importa es
 * el caso raro: que la cookie traiga cualquier cosa. `modoDeColor` necesita el contexto de
 * peticion de Next, asi que lo que se comprueba es el predicado que decide.
 */
describe('que modo se pide', () => {
  it('acepta los dos modos que existen', () => {
    expect(esModoDeColor('claro')).toBe(true);
    expect(esModoDeColor('oscuro')).toBe(true);
  });

  it('cualquier otra cosa no es un modo, y por tanto cae en claro', () => {
    // Una cookie es texto que manda el cliente. `dark`, vacia o manipulada tiene que dejar la
    // aplicacion en un estado dibujable, no a medio tema.
    for (const valor of ['dark', 'Oscuro', '', undefined, 'null']) {
      expect(esModoDeColor(valor), String(valor)).toBe(false);
    }
  });
});

/**
 * Toda variable CSS que la hoja de estilo LEE tiene que existir en los dos modos.
 *
 * Es la prueba que encontro lo que ninguna otra podia: trece reglas escribian
 * `font: var(--md-sys-typescale-title-large)` y esa variable no la emitia nadie. `font` con un
 * valor vacio es una declaracion invalida y el navegador la descarta entera, asi que esos rotulos
 * se quedaban con el tamano heredado — sin error, sin aviso y sin diferencia aparente.
 *
 * Se lee el CSS como TEXTO, igual que hace la prueba de la rejilla: una hoja de estilo no puede
 * importar TypeScript, asi que la unica forma de comparar las dos listas es esta.
 */
describe('el tema cubre todas las variables que la hoja de estilo usa', () => {
  const css = readFileSync(join(process.cwd(), 'apps/shell/app/globals.css'), 'utf8');
  const usadas = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1] as string));
  const definidasEnCss = new Set(
    [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1] as string),
  );

  /**
   * Las que rellena un componente al dibujar, no el tema.
   *
   * Se enumeran a mano para que anadir una obligue a pasar por aqui: una variable que nadie
   * define y nadie declara en esta lista es una regla de CSS que no hace nada.
   */
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

  const emitidasEn = (modo: ModoDeColor): Set<string> => {
    const tema = modo === 'claro' ? temaClaro : temaOscuro;
    return new Set([
      ...Object.keys(variablesMaterial(tema)),
      ...Object.keys(toCssVariables(comoThemeTokens(tema))),
    ]);
  };

  for (const modo of ['claro', 'oscuro'] as ModoDeColor[]) {
    it(`${modo}: ninguna variable leida se queda sin valor`, () => {
      const emitidas = emitidasEn(modo);
      const huerfanas = [...usadas].filter(
        (v) => !definidasEnCss.has(v) && !emitidas.has(v) && !DE_COMPONENTE.includes(v),
      );

      expect(huerfanas.sort()).toEqual([]);
    });
  }

  it('la abreviatura `font:` de cada rol tipografico es un valor valido', () => {
    // No basta con que la variable exista: `font` exige grosor, tamano/interlineado y familia en
    // ese orden. Una variable presente pero mal formada vuelve a descartar la declaracion entera.
    const vars = variablesMaterial(temaOscuro);
    for (const rol of ['title-large', 'title-medium', 'label-large', 'body-small']) {
      expect(vars[`--md-sys-typescale-${rol}`]).toMatch(/^\d{3} [\d.]+rem\/[\d.]+rem .+sans-serif$/);
    }
  });

  it('los componentes que usan la hoja de estilo declaran las variables que ella espera', () => {
    // La otra mitad de la lista de arriba: si alguien renombra `--rejilla-columnas` en el TSX y
    // no en el CSS, la rejilla se queda sin columnas.
    const tsx = ['components/Rejilla.tsx', 'components/objetos.tsx', 'components/editor/Lienzo.tsx']
      .map((f) => readFileSync(join(process.cwd(), 'apps/shell/src', f), 'utf8'))
      .join('\n');

    for (const nombre of ['--rejilla-columnas', '--multiplos-columnas', '--color-de-resaltado']) {
      expect(tsx, nombre).toContain(`'${nombre}'`);
    }
  });
});
