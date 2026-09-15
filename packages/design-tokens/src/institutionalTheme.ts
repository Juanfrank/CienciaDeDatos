import type { ThemeTokens } from './tokens';
import { type ColorMode, type ThemeSource, SEMANTICA_POR_DEFECTO } from './material3';
import {
  type MaterialTheme,
  type ThemeStyle,
  SHAPE,
  TINTE_NEUTRO,
  TYPOGRAPHY,
  materialTheme,
} from './material3Tokens';

/**
 * El tema de la institucion, expresado en Material Design 3.
 *
 * Dice sus seis colores, los dos semanticos incluidos. Antes decia tres y los otros salian de
 * donde podian: el exito se pintaba con `secondary` —un AZUL— y la advertencia con el acento, que
 * aqui es el rojo de la norma. Es decir, «va bien» salia azul y «ojo con esto» salia del mismo
 * color que un error. Ninguno de los dos era una decision; eran el hueco que quedaba.
 */
export const INSTITUTIONAL_SOURCE: ThemeSource = {
  primario: '#0050dd',
  acento: '#ef3340',
  // El gris de la norma de marca, el mismo que rotula la institucion en la portada de un informe.
  neutro: '#5b6b87',
  /*
   * Se escriben aunque coincidan con el respaldo, y a proposito.
   *
   * Un tema de fabrica es la referencia que se copia para hacer los demas: lo que no diga no se
   * hereda, se adivina. Con los seis escritos, abrir este archivo contesta de que color es cada
   * cosa sin tener que ir a buscar de donde sale lo que falta.
   */
  exito: SEMANTICA_POR_DEFECTO.exito,
  advertencia: SEMANTICA_POR_DEFECTO.advertencia,
};

/**
 * Montserrat, la tipografia institucional.
 *
 * Se exporta porque la comparten TODOS los temas: el color se elige, la tipografia institucional
 * no. Un tema nuevo cambia la paleta, no la letra con la que la institucion se escribe.
 */
export const FONTS = {
  sans: "var(--font-montserrat), Montserrat, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  /*
   * La serif del cromo institucional: la pantalla de acceso, y nada mas por ahora.
   *
   * Una pila del SISTEMA y no una fuente descargada, porque el principio 1 no admite una peticion
   * a un dominio ajeno y una fuente propia mas serviria un archivo mas antes de que nadie haya
   * entrado. Un nombre de institucion en serif se lee como un membrete; en la misma sans que todo
   * lo demas se lee como un titulo mas de la aplicacion, que es justo lo que no es.
   */
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
};

/**
 * Las tipografias que un tema puede elegir. Conjunto CERRADO, y por dos razones.
 *
 * La primera es que una fuente no es un nombre: es un archivo que hay que servir. El principio 1
 * no admite pedirsela a un dominio ajeno, asi que cada una de estas la carga la aplicacion desde
 * su propio origen y declara su variable. Un nombre libre escrito en una pantalla nombraria una
 * fuente que nadie sirve, y el navegador caeria a la de sistema sin decir nada.
 *
 * La segunda es que el valor entra en una variable CSS. Una cadena libre ahi es una superficie de
 * inyeccion que no hace falta abrir para elegir entre dos letras.
 *
 * `mono` y `serif` no cambian: la primera es para cifras y codigo —donde lo que importa es que
 * todos los digitos midan igual— y la segunda es el membrete de la pantalla de acceso.
 */
export const TYPEFACES = {
  institucional: FONTS,
  poppins: {
    ...FONTS,
    sans: "var(--font-poppins), Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
} as const;

export type TypefaceId = keyof typeof TYPEFACES;

export const TYPEFACE_NAMES: Record<TypefaceId, string> = {
  institucional: 'Montserrat (institucional)',
  poppins: 'Poppins',
};

/**
 * El estilo institucional, escrito entero: Montserrat, la escala de Material, sus siete radios y
 * la sombra neutra de la especificacion.
 *
 * Es lo que la aplicacion ya tenia, pero antes lo tenia por OMISION —eran las constantes globales
 * que compartian todos los temas— y ahora lo tiene por declaracion. La diferencia importa el dia
 * que alguien cambia un valor global: entonces cambiaba en silencio el tema de la institucion, y
 * ahora hay que venir aqui y decirlo.
 */
export const INSTITUTIONAL_STYLE: ThemeStyle = {
  fonts: FONTS,
  typography: TYPOGRAPHY,
  shape: SHAPE,
  shadowShape: 'material',
  shadowTint: TINTE_NEUTRO,
  tones: {},
};

export const lightTheme: MaterialTheme = materialTheme(
  INSTITUTIONAL_SOURCE,
  'light',
  INSTITUTIONAL_STYLE,
);

/** El esquema oscuro existe y esta verificado, y NO esta aplicado. */
export const darkTheme: MaterialTheme = materialTheme(
  INSTITUTIONAL_SOURCE,
  'dark',
  INSTITUTIONAL_STYLE,
);

export const themeForMode = (mode: ColorMode): MaterialTheme =>
  mode === 'light' ? lightTheme : darkTheme;

/** Puente hacia la forma de tema anterior. */
export function asThemeTokens(theme: MaterialTheme): ThemeTokens {
  const c = theme.color;

  return {
    color: {
      brand: {
        50: c.primaryContainer,
        100: c.primaryContainer,
        300: c.inversePrimary,
        500: c.primary,
        700: c.onPrimaryContainer,
        900: c.onPrimaryContainer,
      },
      accent: {
        50: c.tertiaryContainer,
        100: c.tertiaryContainer,
        300: c.tertiary,
        500: c.tertiary,
        700: c.onTertiaryContainer,
        900: c.onTertiaryContainer,
      },
      neutral: {
        50: c.surfaceContainerLow,
        100: c.surfaceContainer,
        300: c.outlineVariant,
        500: c.onSurfaceVariant,
        700: c.onSurfaceVariant,
        900: c.onSurface,
      },
      // Los tres semanticos, cada uno del SUYO. Ver la nota de `TonalPalettes`.
      success: c.success,
      warning: c.warning,
      danger: c.error,
      background: c.background,
      surface: c.surfaceContainerLowest,
      surfaceMuted: c.surfaceContainer,
      text: c.onSurface,
      textMuted: c.onSurfaceVariant,
      textOnBrand: c.onPrimary,
      border: c.outlineVariant,
      categorical: theme.categorical,
    },
    font: {
      sans: theme.font.sans,
      mono: theme.font.mono,
      size: {
        xs: theme.typography['body-small'].size,
        sm: theme.typography['body-medium'].size,
        base: theme.typography['body-large'].size,
        lg: theme.typography['title-large'].size,
        xl: theme.typography['headline-small'].size,
        xxl: theme.typography['headline-medium'].size,
      },
      weight: { regular: 400, medium: 500, bold: 700 },
    },
    space: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
    radius: {
      sm: theme.shape['extra-small'],
      md: theme.shape.medium,
      lg: theme.shape.large,
    },
    shadow: { sm: theme.elevation[1], md: theme.elevation[2] },
  };
}
