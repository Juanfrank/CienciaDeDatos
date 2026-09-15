import type { ThemeTokens } from './tokens';
import { type ColorMode, type ThemeSource } from './material3';
import { type MaterialTheme, materialTheme } from './material3Tokens';

/** El tema de la institucion, expresado en Material Design 3. */
export const INSTITUTIONAL_SOURCE: ThemeSource = {
  primario: '#0050dd',
  acento: '#ef3340',
  // El gris de la norma de marca, el mismo que rotula la institucion en la portada de un informe.
  neutro: '#5b6b87',
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

export const lightTheme: MaterialTheme = materialTheme(INSTITUTIONAL_SOURCE, 'light', FONTS);

/** El esquema oscuro existe y esta verificado, y NO esta aplicado. */
export const darkTheme: MaterialTheme = materialTheme(INSTITUTIONAL_SOURCE, 'dark', FONTS);

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
      success: c.secondary,
      warning: c.tertiary,
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
