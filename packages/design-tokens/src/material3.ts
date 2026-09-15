import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

/** Sistema de color de Material Design 3 — seccion 4.3. */

/**
 * Los roles de paleta: los seis de MD3 y los dos semanticos que la especificacion no trae.
 *
 * Material solo define `error`. Un tablero necesita ademas decir «esto va bien» y «esto necesita
 * atencion», y hasta ahora los decia con `secondary` y `tertiary` —es decir, con AZUL y con el
 * color de acento—. Un incremento positivo pintado de azul no dice nada, y un aviso pintado del
 * mismo color que los adornos de la marca tampoco.
 */
export interface TonalPalettes {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
  success: TonalPalette;
  warning: TonalPalette;
}

export interface ThemeSource {
  /** Color institucional principal. De el salen primary, secondary y los neutros. */
  primario: string;
  /** Gris institucional. De el salen las superficies y los bordes. */
  neutro: string;
  /** Segundo color de marca. Ocupa el rol `tertiary`, y el rol `error` si no se dice otra cosa. */
  acento: string;
  /**
   * El rojo del error, cuando el acento NO sirve para eso.
   *
   * Ausente, el error sale del acento: es lo correcto para el tema institucional, cuyo acento ya
   * es el rojo de la norma. Pero atarlos siempre hace que un tema con acento morado tenga los
   * errores en morado, y entonces un error deja de leerse como un error —que es la unica cosa que
   * un color tiene que hacer aqui—. Un tema que elige otro acento dice tambien cual es su rojo.
   */
  error?: string;
  /** El verde del exito. Ausente: el de `SEMANTICA_POR_DEFECTO`. */
  exito?: string;
  /** El ambar de la advertencia. Ausente: el de `SEMANTICA_POR_DEFECTO`. */
  advertencia?: string;
}

/**
 * El verde y el ambar de respaldo, para un tema que no diga los suyos.
 *
 * No se derivan de la marca A PROPOSITO, y es la diferencia con los otros roles. El primario, el
 * acento y los neutros son decisiones de marca: cada institucion tiene los suyos y cambiarlos es
 * justo lo que un tema sirve para hacer. «Bien» y «cuidado» no lo son —son convenciones que el
 * lector trae puestas antes de abrir la pantalla—, y derivarlos de la marca produce el verde que
 * no es verde y el ambar que es rosa, que ya no significan nada.
 *
 * Que sean elegibles es por lo contrario: un tema PUEDE afinarlos para que convivan con su paleta,
 * y estos dos ya vienen afinados para hacerlo sin dejar de leerse.
 */
export const SEMANTICA_POR_DEFECTO = { exito: '#128a5e', advertencia: '#d97706' } as const;

/** Croma de las paletas derivadas. `semantico` es el minimo para que un rol se lea como su color. */
const CROMA = { secondary: 18, neutral: 8, neutralVariant: 16, semantico: 48 } as const;

export function palettesFor(source: ThemeSource): TonalPalettes {
  const primario = Hct.fromInt(argbFromHex(source.primario));
  const acento = Hct.fromInt(argbFromHex(source.acento));
  // El matiz de los neutros sale del GRIS de la norma, no del primario. Ver `neutro`.
  const neutro = Hct.fromInt(argbFromHex(source.neutro));

  /**
   * Un rol semantico, con croma suficiente.
   *
   * El minimo importa: un verde desvaido derivado de un origen casi gris sale de la paleta tonal
   * como otro gris, y entonces «va bien» y «esto es un dato mas» se pintan igual.
   */
  const semantico = (hct: Hct) =>
    TonalPalette.fromHueAndChroma(hct.hue, Math.max(hct.chroma, CROMA.semantico));
  const declarado = (hex: string) => Hct.fromInt(argbFromHex(hex));

  return {
    primary: TonalPalette.fromInt(argbFromHex(source.primario)),
    secondary: TonalPalette.fromHueAndChroma(primario.hue, CROMA.secondary),
    tertiary: TonalPalette.fromInt(argbFromHex(source.acento)),
    neutral: TonalPalette.fromHueAndChroma(neutro.hue, CROMA.neutral),
    neutralVariant: TonalPalette.fromHueAndChroma(neutro.hue, CROMA.neutralVariant),
    // El rojo del tema, o el acento. Ver la nota de `error` en `ThemeSource`.
    error: semantico(source.error ? declarado(source.error) : acento),
    success: semantico(declarado(source.exito ?? SEMANTICA_POR_DEFECTO.exito)),
    warning: semantico(declarado(source.advertencia ?? SEMANTICA_POR_DEFECTO.advertencia)),
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
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;
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
const TONOS: Record<keyof MaterialScheme, { palette: keyof TonalPalettes; light: number; dark: number }> = {
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

  // Los dos semanticos usan los MISMOS tonos que el error: son roles de la misma clase, y con
  // otra tabla un aviso y un fallo pesarian distinto en la pantalla sin que nadie lo decidiera.
  success: { palette: 'success', light: 40, dark: 80 },
  onSuccess: { palette: 'success', light: 100, dark: 20 },
  successContainer: { palette: 'success', light: 90, dark: 30 },
  onSuccessContainer: { palette: 'success', light: 10, dark: 90 },

  warning: { palette: 'warning', light: 40, dark: 80 },
  onWarning: { palette: 'warning', light: 100, dark: 20 },
  warningContainer: { palette: 'warning', light: 90, dark: 30 },
  onWarningContainer: { palette: 'warning', light: 10, dark: 90 },

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

/**
 * Que tono le toca a un rol, cuando un tema quiere otro distinto del de la especificacion.
 *
 * La PALETA no se puede cambiar por aqui a proposito: mover `outlineVariant` dos tonos mas arriba
 * lo aclara y sigue siendo el mismo color de la familia; sacarlo de otra paleta lo convierte en
 * otro color, y entonces no es un ajuste de estilo, es otro sistema de color.
 */
export type RoleTones = Partial<Record<keyof MaterialScheme, { light: number; dark: number }>>;

export function schemeFor(
  source: ThemeSource,
  mode: ColorMode,
  ajustes: RoleTones = {},
): MaterialScheme {
  const palettes = palettesFor(source);
  const scheme = {} as MaterialScheme;

  for (const [role, { palette, light, dark }] of Object.entries(TONOS) as [
    keyof MaterialScheme,
    (typeof TONOS)[keyof MaterialScheme],
  ][]) {
    const tono = ajustes[role] ?? { light, dark };
    scheme[role] = hexFromArgb(palettes[palette].tone(mode === 'light' ? tono.light : tono.dark));
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
  ['onSuccess', 'success'],
  ['onSuccessContainer', 'successContainer'],
  ['onWarning', 'warning'],
  ['onWarningContainer', 'warningContainer'],
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
