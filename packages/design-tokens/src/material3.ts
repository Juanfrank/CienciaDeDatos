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

export interface OrigenDelTema {
  /** Color institucional principal. De el salen primary, secondary y los neutros. */
  primario: string;
  /** Gris institucional. De el salen las superficies y los bordes. */
  neutro: string;
  /** Segundo color de marca. Ocupa el rol `tertiary` Y el rol `error`. */
  acento: string;
}

/** Croma de las paletas derivadas. */
const CROMA = { secondary: 18, neutral: 8, neutralVariant: 16 } as const;

export function paletasDe(origen: OrigenDelTema): PaletasTonales {
  const primario = Hct.fromInt(argbFromHex(origen.primario));
  const acento = Hct.fromInt(argbFromHex(origen.acento));
  // El matiz de los neutros sale del GRIS de la norma, no del primario. Ver `neutro`.
  const neutro = Hct.fromInt(argbFromHex(origen.neutro));

  return {
    primary: TonalPalette.fromInt(argbFromHex(origen.primario)),
    secondary: TonalPalette.fromHueAndChroma(primario.hue, CROMA.secondary),
    tertiary: TonalPalette.fromInt(argbFromHex(origen.acento)),
    neutral: TonalPalette.fromHueAndChroma(neutro.hue, CROMA.neutral),
    neutralVariant: TonalPalette.fromHueAndChroma(neutro.hue, CROMA.neutralVariant),
    // El rojo institucional tambien para el error. Ver la nota de `acento`.
    error: TonalPalette.fromHueAndChroma(acento.hue, Math.max(acento.chroma, 48)),
  };
}

/** Roles de color de MD3. Son los nombres de la especificacion, sin traducir. */
export interface EsquemaMaterial {
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

export type ModoDeColor = 'claro' | 'oscuro';

/** Tonos de cada rol. La tabla de la especificacion, tal cual. */
const TONOS: Record<keyof EsquemaMaterial, { paleta: keyof PaletasTonales; claro: number; oscuro: number }> = {
  primary: { paleta: 'primary', claro: 40, oscuro: 80 },
  onPrimary: { paleta: 'primary', claro: 100, oscuro: 20 },
  primaryContainer: { paleta: 'primary', claro: 90, oscuro: 30 },
  onPrimaryContainer: { paleta: 'primary', claro: 10, oscuro: 90 },

  secondary: { paleta: 'secondary', claro: 40, oscuro: 80 },
  onSecondary: { paleta: 'secondary', claro: 100, oscuro: 20 },
  secondaryContainer: { paleta: 'secondary', claro: 90, oscuro: 30 },
  onSecondaryContainer: { paleta: 'secondary', claro: 10, oscuro: 90 },

  tertiary: { paleta: 'tertiary', claro: 40, oscuro: 80 },
  onTertiary: { paleta: 'tertiary', claro: 100, oscuro: 20 },
  tertiaryContainer: { paleta: 'tertiary', claro: 90, oscuro: 30 },
  onTertiaryContainer: { paleta: 'tertiary', claro: 10, oscuro: 90 },

  error: { paleta: 'error', claro: 40, oscuro: 80 },
  onError: { paleta: 'error', claro: 100, oscuro: 20 },
  errorContainer: { paleta: 'error', claro: 90, oscuro: 30 },
  onErrorContainer: { paleta: 'error', claro: 10, oscuro: 90 },

  background: { paleta: 'neutral', claro: 98, oscuro: 6 },
  onBackground: { paleta: 'neutral', claro: 10, oscuro: 90 },
  surface: { paleta: 'neutral', claro: 98, oscuro: 6 },
  onSurface: { paleta: 'neutral', claro: 10, oscuro: 90 },
  surfaceVariant: { paleta: 'neutralVariant', claro: 90, oscuro: 30 },
  onSurfaceVariant: { paleta: 'neutralVariant', claro: 30, oscuro: 80 },

  surfaceContainerLowest: { paleta: 'neutral', claro: 100, oscuro: 4 },
  surfaceContainerLow: { paleta: 'neutral', claro: 96, oscuro: 10 },
  surfaceContainer: { paleta: 'neutral', claro: 94, oscuro: 12 },
  surfaceContainerHigh: { paleta: 'neutral', claro: 92, oscuro: 17 },
  surfaceContainerHighest: { paleta: 'neutral', claro: 90, oscuro: 22 },
  surfaceDim: { paleta: 'neutral', claro: 87, oscuro: 6 },
  surfaceBright: { paleta: 'neutral', claro: 98, oscuro: 24 },

  outline: { paleta: 'neutralVariant', claro: 50, oscuro: 60 },
  outlineVariant: { paleta: 'neutralVariant', claro: 80, oscuro: 30 },

  inverseSurface: { paleta: 'neutral', claro: 20, oscuro: 90 },
  inverseOnSurface: { paleta: 'neutral', claro: 95, oscuro: 20 },
  inversePrimary: { paleta: 'primary', claro: 80, oscuro: 40 },

  shadow: { paleta: 'neutral', claro: 0, oscuro: 0 },
  scrim: { paleta: 'neutral', claro: 0, oscuro: 0 },
};

export function esquemaDe(origen: OrigenDelTema, modo: ModoDeColor): EsquemaMaterial {
  const paletas = paletasDe(origen);
  const esquema = {} as EsquemaMaterial;

  for (const [rol, { paleta, claro, oscuro }] of Object.entries(TONOS) as [
    keyof EsquemaMaterial,
    (typeof TONOS)[keyof EsquemaMaterial],
  ][]) {
    esquema[rol] = hexFromArgb(paletas[paleta].tone(modo === 'claro' ? claro : oscuro));
  }

  return esquema;
}

/** Pares de roles que DEBEN cumplir contraste de texto. */
export const PARES_DE_CONTRASTE: readonly [keyof EsquemaMaterial, keyof EsquemaMaterial][] = [
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
export const PARES_GRAFICOS: readonly [keyof EsquemaMaterial, keyof EsquemaMaterial][] = [
  ['outline', 'surface'],
  ['primary', 'surface'],
  ['error', 'surface'],
];
