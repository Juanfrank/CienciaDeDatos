import { describe, expect, it } from 'vitest';
import { findContrastFailures, institutionalContrastChecks } from './contrast';
import { asThemeTokens } from './institutionalTheme';
import { type ColorMode } from './material3';
import { TINTE_NEUTRO } from './material3Tokens';
import {
  BUILT_IN_THEMES,
  GRAPHIC_LINE_THEME,
  INSTITUTIONAL_THEME,
  themeVersion,
} from './themeDefinition';

/**
 * El tema de la linea grafica — seccion 4.3.
 *
 * Es un tema y nada mas: color, letra y sombra. Lo que se comprueba aqui es que trae lo que su
 * linea grafica dice, que sigue cumpliendo la promesa de contraste de 4.9 en sus DOS modos, y
 * —sobre todo— que no ha cambiado nada del tema institucional al entrar.
 */

const MODOS: ColorMode[] = ['light', 'dark'];

describe('la linea grafica como tema', () => {
  for (const modo of MODOS) {
    it(`${modo}: ninguna combinacion queda por debajo de AA`, () => {
      const fallos = findContrastFailures(
        institutionalContrastChecks(asThemeTokens(themeVersion(GRAPHIC_LINE_THEME, modo))),
      );

      // Con su razon: si algun dia falla, el mensaje dice QUE combinacion y CUANTO le falta.
      expect(fallos.map((f) => `${f.label}: ${f.ratio?.toFixed(2)} < ${f.required}`)).toEqual([]);
    });
  }

  it('escribe en Poppins, y la institucional sigue en Montserrat', () => {
    expect(themeVersion(GRAPHIC_LINE_THEME, 'light').font.sans).toContain('--font-poppins');
    expect(themeVersion(INSTITUTIONAL_THEME, 'light').font.sans).toContain('--font-montserrat');
  });

  it('las cifras siguen en la monoespaciada: eso no lo elige un tema', () => {
    // Lo que importa de la mono es que todos los digitos midan igual, no la marca.
    expect(themeVersion(GRAPHIC_LINE_THEME, 'light').font.mono).toBe(
      themeVersion(INSTITUTIONAL_THEME, 'light').font.mono,
    );
  });

  /*
   * «Una sola sombra de marca, siempre con tinte navy — nunca gris ni negro neutro», dice la guia.
   */
  it('la sombra lleva el tinte de su propio primario, no negro', () => {
    const sombra = themeVersion(GRAPHIC_LINE_THEME, 'light').elevation[2];

    expect(sombra).not.toContain(`rgba(${TINTE_NEUTRO}`);
    // Un azul profundo: el primario en su tono 30, no el azul de accion a plena luz.
    expect(sombra).toMatch(/rgba\(\d+,\d+,\d+,/);
  });

  it('el tema institucional conserva su sombra neutra', () => {
    // Anadir un tema no puede repintar el que ya estaba servido.
    expect(themeVersion(INSTITUTIONAL_THEME, 'light').elevation[2]).toContain(
      `rgba(${TINTE_NEUTRO}`,
    );
  });

  /*
   * El caso que obliga a que `error` se pueda decir aparte.
   *
   * El acento de este tema es morado, y el error sale del acento salvo que se diga otra cosa. Sin
   * el rojo declarado, un mensaje de error saldria morado — y un error que no se lee como un error
   * es lo unico que un color tiene que evitar aqui.
   */
  it('el error es ROJO aunque el acento sea morado', () => {
    const { error, tertiary } = themeVersion(GRAPHIC_LINE_THEME, 'light').color;

    expect(rojizo(error)).toBe(true);
    expect(rojizo(tertiary)).toBe(false);
  });

  it('el tema institucional sigue sacando su error del acento', () => {
    // Su acento YA es el rojo de la norma, asi que no tiene que declarar nada.
    expect(INSTITUTIONAL_THEME.source.error).toBeUndefined();
    expect(rojizo(themeVersion(INSTITUTIONAL_THEME, 'light').color.error)).toBe(true);
  });

  it('los dos temas vienen de fabrica, y el institucional es el primero', () => {
    // El orden importa: es el que se lee en la lista, y el de fabrica original va delante.
    expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual(['institucional', 'linea-grafica']);
    expect(BUILT_IN_THEMES.every((t) => t.builtIn)).toBe(true);
  });
});

/** Si un color cae en el arco rojo del circulo cromatico. */
function rojizo(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  return r > g && r > b;
}
