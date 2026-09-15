import { hexFromArgb } from '@material/material-color-utilities';
import {
  type MaterialScheme,
  type ColorMode,
  type ThemeSource,
  schemeFor,
  palettesFor,
} from './material3';

/** El resto del sistema de Material Design 3: tipografia, forma, elevacion y capas de estado. */

/** Escala tipografica de MD3: cinco familias de rol, tres tamanos cada una. */
export interface TypographicStyle {
  size: string;
  lineHeight: string;
  weight: number;
  tracking: string;
}

export type TypographicRole =
  | 'display-large' | 'display-medium' | 'display-small'
  | 'headline-large' | 'headline-medium' | 'headline-small'
  | 'title-large' | 'title-medium' | 'title-small'
  | 'body-large' | 'body-medium' | 'body-small'
  | 'label-large' | 'label-medium' | 'label-small';

export const TYPOGRAPHY: Record<TypographicRole, TypographicStyle> = {
  'display-large': { size: '3.5625rem', lineHeight: '4rem', weight: 400, tracking: '-0.015625rem' },
  'display-medium': { size: '2.8125rem', lineHeight: '3.25rem', weight: 400, tracking: '0' },
  'display-small': { size: '2.25rem', lineHeight: '2.75rem', weight: 400, tracking: '0' },

  'headline-large': { size: '2rem', lineHeight: '2.5rem', weight: 400, tracking: '0' },
  'headline-medium': { size: '1.75rem', lineHeight: '2.25rem', weight: 400, tracking: '0' },
  'headline-small': { size: '1.5rem', lineHeight: '2rem', weight: 400, tracking: '0' },

  'title-large': { size: '1.375rem', lineHeight: '1.75rem', weight: 400, tracking: '0' },
  'title-medium': { size: '1rem', lineHeight: '1.5rem', weight: 500, tracking: '0.009375rem' },
  'title-small': { size: '0.875rem', lineHeight: '1.25rem', weight: 500, tracking: '0.00625rem' },

  'body-large': { size: '1rem', lineHeight: '1.5rem', weight: 400, tracking: '0.03125rem' },
  'body-medium': { size: '0.875rem', lineHeight: '1.25rem', weight: 400, tracking: '0.015625rem' },
  'body-small': { size: '0.75rem', lineHeight: '1rem', weight: 400, tracking: '0.025rem' },

  'label-large': { size: '0.875rem', lineHeight: '1.25rem', weight: 500, tracking: '0.00625rem' },
  'label-medium': { size: '0.75rem', lineHeight: '1rem', weight: 500, tracking: '0.03125rem' },
  'label-small': { size: '0.6875rem', lineHeight: '1rem', weight: 500, tracking: '0.03125rem' },
};

/** Escala de forma. `full` es una pastilla; el valor grande deja que el borde lo resuelva. */
export const SHAPE = {
  none: '0',
  'extra-small': '4px',
  small: '8px',
  medium: '12px',
  large: '16px',
  'extra-large': '28px',
  full: '9999px',
} as const;

/** Elevacion: seis niveles, cada uno con su sombra. */
export const ELEVATION = {
  0: 'none',
  1: '0 1px 2px 0 rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15)',
  2: '0 1px 2px 0 rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15)',
  3: '0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px 0 rgba(0,0,0,.30)',
  4: '0 6px 10px 4px rgba(0,0,0,.15), 0 2px 3px 0 rgba(0,0,0,.30)',
  5: '0 8px 12px 6px rgba(0,0,0,.15), 0 4px 4px 0 rgba(0,0,0,.30)',
} as const;

/** Opacidad de las capas de estado. */
export const STATUS = { hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16, disabled: 0.38 } as const;

/** Duraciones y curvas de movimiento. */
export const MOVIMIENTO = {
  'duration-short': '150ms',
  'duration-medium': '250ms',
  'duration-long': '400ms',
  'easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-decelerate': 'cubic-bezier(0, 0, 0, 1)',
} as const;

/** Paleta categorica para series de datos, derivada de las paletas tonales. */
/** Tonos de la paleta categorica, por modo. */
const TONOS_CATEGORICOS: Record<ColorMode, [keyof ReturnType<typeof palettesFor>, number][]> = {
  light: [
    ['primary', 40], ['tertiary', 40], ['secondary', 40],
    ['primary', 25], ['tertiary', 25], ['secondary', 25],
    ['primary', 55], ['tertiary', 55],
  ],
  dark: [
    ['primary', 80], ['tertiary', 80], ['secondary', 80],
    ['primary', 65], ['tertiary', 65], ['secondary', 65],
    ['primary', 90], ['tertiary', 90],
  ],
};

/** Paleta categorica para series de datos, derivada de las paletas tonales. */
export function categoricalFor(source: ThemeSource, mode: ColorMode): string[] {
  const p = palettesFor(source);
  return TONOS_CATEGORICOS[mode].map(([family, tono]) => hexFromArgb(p[family].tone(tono)));
}

export interface MaterialTheme {
  mode: ColorMode;
  color: MaterialScheme;
  categorical: string[];
  typography: Record<TypographicRole, TypographicStyle>;
  shape: typeof SHAPE;
  elevation: typeof ELEVATION;
  state: typeof STATUS;
  motion: typeof MOVIMIENTO;
  font: { sans: string; mono: string; serif: string };
}

export function materialTheme(
  source: ThemeSource,
  mode: ColorMode,
  fonts: { sans: string; mono: string; serif: string },
): MaterialTheme {
  return {
    mode,
    color: schemeFor(source, mode),
    categorical: categoricalFor(source, mode),
    typography: TYPOGRAPHY,
    shape: SHAPE,
    elevation: ELEVATION,
    state: STATUS,
    motion: MOVIMIENTO,
    font: fonts,
  };
}

/** Variables CSS con los nombres de MD3 (`--md-sys-*`). */
export function materialVariables(theme: MaterialTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const guion = (role: string) => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  for (const [role, valor] of Object.entries(theme.color)) {
    vars[`--md-sys-color-${guion(role)}`] = valor;
  }
  theme.categorical.forEach((color, i) => {
    vars[`--md-sys-color-categorical-${i}`] = color;
  });

  for (const [role, style] of Object.entries(theme.typography)) {
    vars[`--md-sys-typescale-${role}-size`] = style.size;
    vars[`--md-sys-typescale-${role}-line-height`] = style.lineHeight;
    vars[`--md-sys-typescale-${role}-weight`] = String(style.weight);
    vars[`--md-sys-typescale-${role}-tracking`] = style.tracking;
    /*
     * Y el rol COMPLETO, valido como abreviatura `font:`.
     */
    vars[`--md-sys-typescale-${role}`] =
      `${style.weight} ${style.size}/${style.lineHeight} ${theme.font.sans}`;
  }

  for (const [nombre, valor] of Object.entries(theme.shape)) {
    vars[`--md-sys-shape-corner-${nombre}`] = valor;
  }
  for (const [nivel, sombra] of Object.entries(theme.elevation)) {
    vars[`--md-sys-elevation-${nivel}`] = sombra;
  }
  for (const [nombre, valor] of Object.entries(theme.state)) {
    vars[`--md-sys-state-${nombre}-opacity`] = String(valor);
  }
  for (const [nombre, valor] of Object.entries(theme.motion)) {
    vars[`--md-sys-motion-${nombre}`] = valor;
  }

  vars['--md-ref-typeface-plain'] = theme.font.sans;
  vars['--md-ref-typeface-mono'] = theme.font.mono;
  // `brand` es el nombre que le da Material a la tipografia de display frente a la de lectura.
  vars['--md-ref-typeface-brand'] = theme.font.serif;

  return vars;
}
