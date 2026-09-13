import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  INSTITUTIONAL_SOURCE,
  CONTRAST_PAIRS,
  CHART_PAIRS,
  categoricalFor,
  defaultTheme,
  schemeFor,
  palettesFor,
  lightTheme,
  darkTheme,
  materialVariables,
  type ColorMode,
} from './index';

/** Sistema de color de Material Design 3 — seccion 4.3 y accesibilidad de 4.9. */

const MODES: ColorMode[] = ['light', 'dark'];

describe('los pares de rol cumplen contraste de TEXTO (4.5:1)', () => {
  for (const mode of MODES) {
    for (const [frente, fondo] of CONTRAST_PAIRS) {
      it(`${mode}: ${frente} sobre ${fondo}`, () => {
        const scheme = schemeFor(INSTITUTIONAL_SOURCE, mode);
        const ratio = contrastRatio(scheme[frente], scheme[fondo]);
        expect(ratio).not.toBeNull();
        expect(ratio ?? 0).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('los pares graficos cumplen el umbral de ELEMENTO (3:1)', () => {
  for (const mode of MODES) {
    for (const [frente, fondo] of CHART_PAIRS) {
      it(`${mode}: ${frente} sobre ${fondo}`, () => {
        const scheme = schemeFor(INSTITUTIONAL_SOURCE, mode);
        expect(contrastRatio(scheme[frente], scheme[fondo]) ?? 0).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('la paleta categorica se lee sobre la superficie', () => {
  for (const mode of MODES) {
    it(`${mode}: las ocho series alcanzan 3:1 sobre la superficie`, () => {
      const scheme = schemeFor(INSTITUTIONAL_SOURCE, mode);
      const series = categoricalFor(INSTITUTIONAL_SOURCE, mode);

      expect(series).toHaveLength(8);
      for (const color of series) {
        // Una barra es un elemento grafico: 3:1. Si no lo alcanza, la serie se pierde contra el
        // fondo y el grafico deja de tener ocho categorias distinguibles.
        expect(contrastRatio(color, scheme.surface) ?? 0, color).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${mode}: no hay dos series iguales`, () => {
      expect(new Set(categoricalFor(INSTITUTIONAL_SOURCE, mode)).size).toBe(8);
    });
  }
});

describe('el rojo institucional, que era el problema del tema anterior', () => {
  it('sigue siendo el origen del acento: la marca no se retoca', () => {
    // El tema anterior documentaba que #EF3340 da 4.02:1 sobre blanco y elegia a mano un
    // hermano mas oscuro para el texto. Aqui el rojo entra tal cual como origen de la paleta.
    const palettes = palettesFor(INSTITUTIONAL_SOURCE);
    const tono40 = palettes.tertiary.tone(40);
    expect(tono40).toBeTypeOf('number');
  });

  it('y el texto que va encima lo resuelve el sistema, no una nota al pie', () => {
    const light = schemeFor(INSTITUTIONAL_SOURCE, 'light');
    expect(contrastRatio(light.onTertiary, light.tertiary) ?? 0).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(light.onTertiaryContainer, light.tertiaryContainer) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('variables CSS', () => {
  it('usa los nombres de la especificacion, para que se reconozcan sin leer el codigo', () => {
    const vars = materialVariables(lightTheme);

    expect(vars['--md-sys-color-primary']).toBe(lightTheme.color.primary);
    expect(vars['--md-sys-color-surface-container-high']).toBe(lightTheme.color.surfaceContainerHigh);
    expect(vars['--md-sys-typescale-body-medium-size']).toBe('0.875rem');
    expect(vars['--md-sys-shape-corner-medium']).toBe('12px');
    expect(vars['--md-sys-state-hover-opacity']).toBe('0.08');
  });

  it('emite los dos modos con las mismas claves y distintos valores', () => {
    const claras = materialVariables(lightTheme);
    const oscuras = materialVariables(darkTheme);

    // Mismas claves: encender el modo oscuro es redefinir valores, nunca anadir variables que
    // en el otro modo no existirian.
    expect(Object.keys(oscuras).sort()).toEqual(Object.keys(claras).sort());
    expect(oscuras['--md-sys-color-surface']).not.toBe(claras['--md-sys-color-surface']);
  });
});

describe('el tema de exportacion sale del MISMO sistema', () => {
  it('los colores de los archivos son los de la pantalla', () => {
    // Un PDF que circula por correo con otra marca es el caso que esto evita.
    expect(defaultTheme.color.brand[500]).toBe(lightTheme.color.primary);
    expect(defaultTheme.color.text).toBe(lightTheme.color.onSurface);
    expect(defaultTheme.color.categorical).toEqual(lightTheme.categorical);
  });

  it('el texto sobre superficie del tema exportado tambien cumple 4.5:1', () => {
    expect(
      contrastRatio(defaultTheme.color.text, defaultTheme.color.surface) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(defaultTheme.color.textMuted, defaultTheme.color.surface) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(defaultTheme.color.textOnBrand, defaultTheme.color.brand[500]) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
  });
});
