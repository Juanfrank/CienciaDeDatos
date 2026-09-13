import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  ORIGEN_INSTITUCIONAL,
  PARES_DE_CONTRASTE,
  PARES_GRAFICOS,
  categoricaDe,
  defaultTheme,
  esquemaDe,
  paletasDe,
  temaClaro,
  temaOscuro,
  variablesMaterial,
  type ModoDeColor,
} from './index';

/** Sistema de color de Material Design 3 — seccion 4.3 y accesibilidad de 4.9. */

const MODOS: ModoDeColor[] = ['claro', 'oscuro'];

describe('los pares de rol cumplen contraste de TEXTO (4.5:1)', () => {
  for (const modo of MODOS) {
    for (const [frente, fondo] of PARES_DE_CONTRASTE) {
      it(`${modo}: ${frente} sobre ${fondo}`, () => {
        const esquema = esquemaDe(ORIGEN_INSTITUCIONAL, modo);
        const ratio = contrastRatio(esquema[frente], esquema[fondo]);
        expect(ratio).not.toBeNull();
        expect(ratio ?? 0).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('los pares graficos cumplen el umbral de ELEMENTO (3:1)', () => {
  for (const modo of MODOS) {
    for (const [frente, fondo] of PARES_GRAFICOS) {
      it(`${modo}: ${frente} sobre ${fondo}`, () => {
        const esquema = esquemaDe(ORIGEN_INSTITUCIONAL, modo);
        expect(contrastRatio(esquema[frente], esquema[fondo]) ?? 0).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('la paleta categorica se lee sobre la superficie', () => {
  for (const modo of MODOS) {
    it(`${modo}: las ocho series alcanzan 3:1 sobre la superficie`, () => {
      const esquema = esquemaDe(ORIGEN_INSTITUCIONAL, modo);
      const series = categoricaDe(ORIGEN_INSTITUCIONAL, modo);

      expect(series).toHaveLength(8);
      for (const color of series) {
        // Una barra es un elemento grafico: 3:1. Si no lo alcanza, la serie se pierde contra el
        // fondo y el grafico deja de tener ocho categorias distinguibles.
        expect(contrastRatio(color, esquema.surface) ?? 0, color).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${modo}: no hay dos series iguales`, () => {
      expect(new Set(categoricaDe(ORIGEN_INSTITUCIONAL, modo)).size).toBe(8);
    });
  }
});

describe('el rojo institucional, que era el problema del tema anterior', () => {
  it('sigue siendo el origen del acento: la marca no se retoca', () => {
    // El tema anterior documentaba que #EF3340 da 4.02:1 sobre blanco y elegia a mano un
    // hermano mas oscuro para el texto. Aqui el rojo entra tal cual como origen de la paleta.
    const paletas = paletasDe(ORIGEN_INSTITUCIONAL);
    const tono40 = paletas.tertiary.tone(40);
    expect(tono40).toBeTypeOf('number');
  });

  it('y el texto que va encima lo resuelve el sistema, no una nota al pie', () => {
    const claro = esquemaDe(ORIGEN_INSTITUCIONAL, 'claro');
    expect(contrastRatio(claro.onTertiary, claro.tertiary) ?? 0).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(claro.onTertiaryContainer, claro.tertiaryContainer) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('variables CSS', () => {
  it('usa los nombres de la especificacion, para que se reconozcan sin leer el codigo', () => {
    const vars = variablesMaterial(temaClaro);

    expect(vars['--md-sys-color-primary']).toBe(temaClaro.color.primary);
    expect(vars['--md-sys-color-surface-container-high']).toBe(temaClaro.color.surfaceContainerHigh);
    expect(vars['--md-sys-typescale-body-medium-size']).toBe('0.875rem');
    expect(vars['--md-sys-shape-corner-medium']).toBe('12px');
    expect(vars['--md-sys-state-hover-opacity']).toBe('0.08');
  });

  it('emite los dos modos con las mismas claves y distintos valores', () => {
    const claras = variablesMaterial(temaClaro);
    const oscuras = variablesMaterial(temaOscuro);

    // Mismas claves: encender el modo oscuro es redefinir valores, nunca anadir variables que
    // en el otro modo no existirian.
    expect(Object.keys(oscuras).sort()).toEqual(Object.keys(claras).sort());
    expect(oscuras['--md-sys-color-surface']).not.toBe(claras['--md-sys-color-surface']);
  });
});

describe('el tema de exportacion sale del MISMO sistema', () => {
  it('los colores de los archivos son los de la pantalla', () => {
    // Un PDF que circula por correo con otra marca es el caso que esto evita.
    expect(defaultTheme.color.brand[500]).toBe(temaClaro.color.primary);
    expect(defaultTheme.color.text).toBe(temaClaro.color.onSurface);
    expect(defaultTheme.color.categorical).toEqual(temaClaro.categorical);
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
