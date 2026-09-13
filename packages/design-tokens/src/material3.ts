import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

/** Sistema de color de Material Design 3 — seccion 4.3. */

/** Los seis roles de paleta de MD3. */
export interface PaletasTonales {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
}

export interface ThemeSource {
  /** Color institucional principal. De el salen primary, secondary y los neutros. */
  primario: string;
  /** Gris institucional. De el salen las superficies y los bordes. */
  neutro: string;
  /** Segundo color de marca. Ocupa el rol `tertiary` Y el rol `error`. */
  acento: string;
}

/** Croma de las paletas derivadas. */
const CROMA = { secondary: 18, neutral: 8, neutralVariant: 16 } as const;

export function palettesFor(source: ThemeSource): PaletasTonales {
  const primario = Hct.fromInt(argbFromHex(source.primario));
  const acento = Hct.fromInt(argbFromHex(source.acento));
  // El matiz de los neutros sale del GRIS de la norma, no del primario. Ver `neutro`.
  const neutro = Hct.fromInt(argbFromHex(source.neutro));

  return {
    primary: TonalPalette.fromInt(argbFromHex(source.primario)),
    secondary: TonalPalette.fromHueAndChroma(primario.hue, CROMA.secondary),
    tertiary: TonalPalette.fromInt(argbFromHex(source.acento)),
    neutral: TonalPalette.fromHueAndChroma(neutro.hue, CROMA.neutral),
    neutralVariant: TonalPalette.fromHueAndChroma(neutro.hue, CROMA.neutralVariant),
    // El rojo institucional tambien para el error. Ver la nota de `acento`.
    error: TonalPalette.fromHueAndChroma(acento.hue, Math.max(acento.chroma, 48)),
  };
}

/** Roles de color de MD3. Son los nombres de la especificacion, sin traducir. */
export interface MaterialScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  /** Los cinco niveles de superficie que sustituyen a las sombras para separar planos. */
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceDim: string;
  surfaceBright: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  shadow: string;
  scrim: string;
}

export type ColorMode = 'light' | 'dark';

/** Tonos de cada rol. La tabla de la especificacion, tal cual. */
const TONOS: Record<keyof MaterialScheme, { paleta: keyof PaletasTonales; light: number; dark: number }> = {
  primary: { paleta: 'primary', light: 40, dark: 80 },
  onPrimary: { paleta: 'primary', light: 100, dark: 20 },
  primaryContainer: { paleta: 'primary', light: 90, dark: 30 },
  onPrimaryContainer: { paleta: 'primary', light: 10, dark: 90 },

  secondary: { paleta: 'secondary', light: 40, dark: 80 },
  onSecondary: { paleta: 'secondary', light: 100, dark: 20 },
  secondaryContainer: { paleta: 'secondary', light: 90, dark: 30 },
  onSecondaryContainer: { paleta: 'secondary', light: 10, dark: 90 },

  tertiary: { paleta: 'tertiary', light: 40, dark: 80 },
  onTertiary: { paleta: 'tertiary', light: 100, dark: 20 },
  tertiaryContainer: { paleta: 'tertiary', light: 90, dark: 30 },
  onTertiaryContainer: { paleta: 'tertiary', light: 10, dark: 90 },

  error: { paleta: 'error', light: 40, dark: 80 },
  onError: { paleta: 'error', light: 100, dark: 20 },
  errorContainer: { paleta: 'error', light: 90, dark: 30 },
  onErrorContainer: { paleta: 'error', light: 10, dark: 90 },

  background: { paleta: 'neutral', light: 98, dark: 6 },
  onBackground: { paleta: 'neutral', light: 10, dark: 90 },
  surface: { paleta: 'neutral', light: 98, dark: 6 },
  onSurface: { paleta: 'neutral', light: 10, dark: 90 },
  surfaceVariant: { paleta: 'neutralVariant', light: 90, dark: 30 },
  onSurfaceVariant: { paleta: 'neutralVariant', light: 30, dark: 80 },

  surfaceContainerLowest: { paleta: 'neutral', light: 100, dark: 4 },
  surfaceContainerLow: { paleta: 'neutral', light: 96, dark: 10 },
  surfaceContainer: { paleta: 'neutral', light: 94, dark: 12 },
  surfaceContainerHigh: { paleta: 'neutral', light: 92, dark: 17 },
  surfaceContainerHighest: { paleta: 'neutral', light: 90, dark: 22 },
  surfaceDim: { paleta: 'neutral', light: 87, dark: 6 },
  surfaceBright: { paleta: 'neutral', light: 98, dark: 24 },

  outline: { paleta: 'neutralVariant', light: 50, dark: 60 },
  outlineVariant: { paleta: 'neutralVariant', light: 80, dark: 30 },

  inverseSurface: { paleta: 'neutral', light: 20, dark: 90 },
  inverseOnSurface: { paleta: 'neutral', light: 95, dark: 20 },
  inversePrimary: { paleta: 'primary', light: 80, dark: 40 },

  shadow: { paleta: 'neutral', light: 0, dark: 0 },
  scrim: { paleta: 'neutral', light: 0, dark: 0 },
};

export function schemeFor(source: ThemeSource, mode: ColorMode): MaterialScheme {
  const palettes = palettesFor(source);
  const scheme = {} as MaterialScheme;

  for (const [role, { paleta, light, dark }] of Object.entries(TONOS) as [
    keyof MaterialScheme,
    (typeof TONOS)[keyof MaterialScheme],
  ][]) {
    scheme[role] = hexFromArgb(palettes[paleta].tone(mode === 'light' ? light : dark));
  }

  return scheme;
}

/** Pares de roles que DEBEN cumplir contraste de texto. */
export const CONTRAST_PAIRS: readonly [keyof MaterialScheme, keyof MaterialScheme][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
  ['onBackground', 'background'],
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surfaceVariant'],
  ['onSurface', 'surfaceContainerLowest'],
  ['onSurface', 'surfaceContainerLow'],
  ['onSurface', 'surfaceContainer'],
  ['onSurface', 'surfaceContainerHigh'],
  ['onSurface', 'surfaceContainerHighest'],
  ['onSurface', 'surfaceDim'],
  ['onSurface', 'surfaceBright'],
  ['inverseOnSurface', 'inverseSurface'],
];

/** Pares que solo tienen que cumplir el umbral de ELEMENTO GRAFICO (3:1). */
export const CHART_PAIRS: readonly [keyof MaterialScheme, keyof MaterialScheme][] = [
  ['outline', 'surface'],
  ['primary', 'surface'],
  ['error', 'surface'],
];
