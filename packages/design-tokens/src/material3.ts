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
const TONOS: Record<keyof MaterialScheme, { palette: keyof PaletasTonales; light: number; dark: number }> = {
  primary: { palette: 'primary', light: 40, dark: 80 },
  onPrimary: { palette: 'primary', light: 100, dark: 20 },
  primaryContainer: { palette: 'primary', light: 90, dark: 30 },
  onPrimaryContainer: { palette: 'primary', light: 10, dark: 90 },

  secondary: { palette: 'secondary', light: 40, dark: 80 },
  onSecondary: { palette: 'secondary', light: 100, dark: 20 },
  secondaryContainer: { palette: 'secondary', light: 90, dark: 30 },
  onSecondaryContainer: { palette: 'secondary', light: 10, dark: 90 },

  tertiary: { palette: 'tertiary', light: 40, dark: 80 },
  onTertiary: { palette: 'tertiary', light: 100, dark: 20 },
  tertiaryContainer: { palette: 'tertiary', light: 90, dark: 30 },
  onTertiaryContainer: { palette: 'tertiary', light: 10, dark: 90 },

  error: { palette: 'error', light: 40, dark: 80 },
  onError: { palette: 'error', light: 100, dark: 20 },
  errorContainer: { palette: 'error', light: 90, dark: 30 },
  onErrorContainer: { palette: 'error', light: 10, dark: 90 },

  background: { palette: 'neutral', light: 98, dark: 6 },
  onBackground: { palette: 'neutral', light: 10, dark: 90 },
  surface: { palette: 'neutral', light: 98, dark: 6 },
  onSurface: { palette: 'neutral', light: 10, dark: 90 },
  surfaceVariant: { palette: 'neutralVariant', light: 90, dark: 30 },
  onSurfaceVariant: { palette: 'neutralVariant', light: 30, dark: 80 },

  surfaceContainerLowest: { palette: 'neutral', light: 100, dark: 4 },
  surfaceContainerLow: { palette: 'neutral', light: 96, dark: 10 },
  surfaceContainer: { palette: 'neutral', light: 94, dark: 12 },
  surfaceContainerHigh: { palette: 'neutral', light: 92, dark: 17 },
  surfaceContainerHighest: { palette: 'neutral', light: 90, dark: 22 },
  surfaceDim: { palette: 'neutral', light: 87, dark: 6 },
  surfaceBright: { palette: 'neutral', light: 98, dark: 24 },

  outline: { palette: 'neutralVariant', light: 50, dark: 60 },
  outlineVariant: { palette: 'neutralVariant', light: 80, dark: 30 },

  inverseSurface: { palette: 'neutral', light: 20, dark: 90 },
  inverseOnSurface: { palette: 'neutral', light: 95, dark: 20 },
  inversePrimary: { palette: 'primary', light: 80, dark: 40 },

  shadow: { palette: 'neutral', light: 0, dark: 0 },
  scrim: { palette: 'neutral', light: 0, dark: 0 },
};

export function schemeFor(source: ThemeSource, mode: ColorMode): MaterialScheme {
  const palettes = palettesFor(source);
  const scheme = {} as MaterialScheme;

  for (const [role, { palette, light, dark }] of Object.entries(TONOS) as [
    keyof MaterialScheme,
    (typeof TONOS)[keyof MaterialScheme],
  ][]) {
    scheme[role] = hexFromArgb(palettes[palette].tone(mode === 'light' ? light : dark));
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
