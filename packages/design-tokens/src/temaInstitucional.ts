import type { ThemeTokens } from './tokens';
import { type ModoDeColor, type OrigenDelTema } from './material3';
import { type TemaMaterial, temaMaterial } from './material3Tokens';

/** El tema de la institucion, expresado en Material Design 3. */
export const ORIGEN_INSTITUCIONAL: OrigenDelTema = {
  primario: '#0050dd',
  acento: '#ef3340',
  // El gris de la norma de marca, el mismo que rotula la institucion en la portada de un informe.
  neutro: '#5b6b87',
};

/** Montserrat, la tipografia institucional. */
const FUENTES = {
  sans: "var(--font-montserrat), Montserrat, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const temaClaro: TemaMaterial = temaMaterial(ORIGEN_INSTITUCIONAL, 'claro', FUENTES);

/** El esquema oscuro existe y esta verificado, y NO esta aplicado. */
export const temaOscuro: TemaMaterial = temaMaterial(ORIGEN_INSTITUCIONAL, 'oscuro', FUENTES);

export const temaPorModo = (modo: ModoDeColor): TemaMaterial =>
  modo === 'claro' ? temaClaro : temaOscuro;

/** Puente hacia la forma de tema anterior. */
export function comoThemeTokens(tema: TemaMaterial): ThemeTokens {
  const c = tema.color;

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
      categorical: tema.categorical,
    },
    font: {
      sans: tema.font.sans,
      mono: tema.font.mono,
      size: {
        xs: tema.typography['body-small'].size,
        sm: tema.typography['body-medium'].size,
        base: tema.typography['body-large'].size,
        lg: tema.typography['title-large'].size,
        xl: tema.typography['headline-small'].size,
        xxl: tema.typography['headline-medium'].size,
      },
      weight: { regular: 400, medium: 500, bold: 700 },
    },
    space: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
    radius: {
      sm: tema.shape['extra-small'],
      md: tema.shape.medium,
      lg: tema.shape.large,
    },
    shadow: { sm: tema.elevation[1], md: tema.elevation[2] },
  };
}
