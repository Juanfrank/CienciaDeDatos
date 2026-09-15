import { describe, expect, it } from 'vitest';
import { contrastRatio, findContrastFailures, institutionalContrastChecks } from './contrast';
import { asThemeTokens } from './institutionalTheme';
import { CONTRAST_PAIRS, type ColorMode } from './material3';
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
 * Es un tema y nada mas: color, letra, escala, radios y sombra. Lo que se comprueba aqui es que
 * trae lo que su linea grafica dice, que sigue cumpliendo la promesa de contraste de 4.9 en sus
 * DOS modos, y —sobre todo— que lo que cambia del tema institucional al entrar es exactamente lo
 * que se quiso cambiar y nada mas.
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

    it(`${modo}: tambien los pares de rol de MD3, que son los que cubren lo semantico`, () => {
      // La lista de arriba mira la forma aplanada del tema, donde el verde y el ambar no caben.
      const { color } = themeVersion(GRAPHIC_LINE_THEME, modo);
      const flojos = CONTRAST_PAIRS.filter(
        ([frente, fondo]) => (contrastRatio(color[frente], color[fondo]) ?? 0) < 4.5,
      );

      expect(flojos.map(([f, b]) => `${f} sobre ${b}`)).toEqual([]);
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

  /*
   * La escala: lo que la distingue no es que sea mas pequena, es que jerarquiza con el PESO.
   */
  it('los titulos van en negrita, donde Material los deja en 400', () => {
    const linea = themeVersion(GRAPHIC_LINE_THEME, 'light').typography;
    const institucional = themeVersion(INSTITUTIONAL_THEME, 'light').typography;

    expect(linea['headline-large'].weight).toBeGreaterThan(institucional['headline-large'].weight);
    expect(linea['display-large'].weight).toBe(800);
    // Y el cuerpo NO: un texto de lectura en negrita no jerarquiza, grita.
    expect(linea['body-medium'].weight).toBe(400);
  });

  it('la escala esta ordenada: ningun rol mayor mide menos que el que tiene debajo', () => {
    // Sesenta numeros escritos a mano. Lo unico que no puede pasar es que se crucen.
    const t = themeVersion(GRAPHIC_LINE_THEME, 'light').typography;
    const rem = (v: string) => parseFloat(v);

    for (const familia of ['display', 'headline', 'title', 'body', 'label'] as const) {
      expect(rem(t[`${familia}-large`].size)).toBeGreaterThan(rem(t[`${familia}-medium`].size));
      expect(rem(t[`${familia}-medium`].size)).toBeGreaterThan(rem(t[`${familia}-small`].size));
    }
  });

  /*
   * «Tres radios: rounded-lg 8px, rounded-xl 12px y rounded-full», dice la guia.
   */
  it('redondea con tres radios, y el institucional sigue con los siete de Material', () => {
    const linea = themeVersion(GRAPHIC_LINE_THEME, 'light').shape;
    const institucional = themeVersion(INSTITUTIONAL_THEME, 'light').shape;

    expect(new Set(Object.values(linea))).toEqual(new Set(['0', '8px', '12px', '999px']));
    // Lo que se pierde a proposito: en Material, `large` y `extra-large` se distinguen.
    expect(linea.large).toBe(linea['extra-large']);
    expect(institucional.large).not.toBe(institucional['extra-large']);
  });

  it('la sombra tiene la forma difusa de la guia: halo ancho y opacidad baja', () => {
    // La de tarjeta, tal cual: `0 1px 2px rgba(...,.05), 0 12px 32px rgba(...,.08)`.
    expect(themeVersion(GRAPHIC_LINE_THEME, 'light').elevation[2]).toContain('12px 32px');
    expect(themeVersion(INSTITUTIONAL_THEME, 'light').elevation[2]).not.toContain('32px');
  });

  it('en oscuro la sombra pierde el tinte de marca', () => {
    // Sobre una superficie casi negra, un azul profundo no se lee como sombra sino como halo.
    expect(themeVersion(GRAPHIC_LINE_THEME, 'dark').elevation[2]).toContain(`rgba(${TINTE_NEUTRO}`);
  });

  /*
   * Lo semantico. El caso que lo obliga es el institucional, no este: alli el exito se pintaba
   * con `secondary` —un AZUL— y la advertencia con el acento, que es el rojo de la norma.
   */
  it('el exito es VERDE y la advertencia AMBAR, en los dos temas', () => {
    for (const tema of BUILT_IN_THEMES) {
      const { success, warning } = themeVersion(tema, 'light').color;

      expect(`${tema.id}: ${success}`).toBe(`${tema.id}: ${verde(success) ? success : 'no verde'}`);
      expect(`${tema.id}: ${warning}`).toBe(`${tema.id}: ${ambar(warning) ? warning : 'no ambar'}`);
    }
  });

  it('el exito ya no es el azul secundario del tema', () => {
    // La regresion exacta que habia: `success` salia de `secondary`, y `secondary` sale del azul.
    const { success, secondary } = themeVersion(INSTITUTIONAL_THEME, 'light').color;
    expect(success).not.toBe(secondary);
  });

  it('un tema que no dice sus semanticos sigue teniendo verde y ambar', () => {
    // Que sean opcionales no puede significar que falten: lo normal es no contestarlos.
    const callado = { ...GRAPHIC_LINE_THEME, source: { ...GRAPHIC_LINE_THEME.source } };
    delete callado.source.exito;
    delete callado.source.advertencia;

    const { success, warning } = themeVersion(callado, 'light').color;
    expect(verde(success)).toBe(true);
    expect(ambar(warning)).toBe(true);
  });

  it('los dos temas de fabrica declaran sus cinco ejes de estilo', () => {
    /*
     * No es celo: un tema de fabrica es la referencia que se copia. Lo que no diga, quien lo copie
     * tampoco lo dira, y la aplicacion se pinta con un valor que nadie escribio en ninguna parte.
     */
    for (const tema of BUILT_IN_THEMES) {
      expect({
        id: tema.id,
        ejes: [
          tema.typeface,
          tema.typeScale,
          tema.cornerRadius,
          tema.shadowShape,
          tema.shadowTint,
        ].filter((v) => v === undefined).length,
      }).toEqual({ id: tema.id, ejes: 0 });
    }
  });

  it('los dos temas vienen de fabrica, y el institucional es el primero', () => {
    // El orden importa: es el que se lee en la lista, y el de fabrica original va delante.
    expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual(['institucional', 'linea-grafica']);
    expect(BUILT_IN_THEMES.every((t) => t.builtIn)).toBe(true);
  });
});

/** Componentes de un hexadecimal de seis digitos. */
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Si un color cae en el arco rojo del circulo cromatico. */
function rojizo(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return r > g && r > b;
}

/** Verde: el canal verde domina a los otros dos. */
function verde(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return g > r && g > b;
}

/** Ambar: rojo por delante, verde en medio y azul muy por detras — el arco del naranja. */
function ambar(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return r > g && g > b;
}
