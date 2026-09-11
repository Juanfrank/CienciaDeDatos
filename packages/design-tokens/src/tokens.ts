/**
 * Tema organizacional — seccion 4.3 del contrato de ingenieria.
 *
 * Tema por defecto con anulaciones permitidas por objeto, dentro de un conjunto DOCUMENTADO Y
 * LIMITADO. El limite es deliberado: si cualquier objeto pudiera anular cualquier token, dos
 * modulos institucionales dejarian de parecerse entre si y la validacion de contraste (abajo)
 * no podria garantizar nada.
 */

export interface ColorScale {
  50: string;
  100: string;
  300: string;
  500: string;
  700: string;
  900: string;
}

export interface ThemeTokens {
  color: {
    /** Color institucional principal. */
    brand: ColorScale;
    /** Grises de superficie y texto. */
    neutral: ColorScale;
    /** Semanticos de estado. */
    success: string;
    warning: string;
    danger: string;
    /** Superficies. */
    background: string;
    surface: string;
    surfaceMuted: string;
    /** Texto. */
    text: string;
    textMuted: string;
    textOnBrand: string;
    border: string;
    /**
     * Paleta categorica para series de datos. Ocho valores: mas alla de ocho categorias, un
     * grafico deja de leerse por color y conviene otra forma visual.
     */
    categorical: string[];
  };
  font: {
    sans: string;
    mono: string;
    size: { xs: string; sm: string; base: string; lg: string; xl: string; xxl: string };
    weight: { regular: number; medium: number; bold: number };
  };
  space: { xs: string; sm: string; md: string; lg: string; xl: string };
  radius: { sm: string; md: string; lg: string };
  shadow: { sm: string; md: string };
}

/**
 * Tema institucional por defecto.
 *
 * Los colores son un punto de partida neutro y accesible; la identidad visual definitiva la
 * fija la institucion. Cambiarlos aqui los cambia en toda la aplicacion, que es justo el
 * proposito de centralizarlos.
 */
export const defaultTheme: ThemeTokens = {
  color: {
    brand: {
      50: '#eef2ff',
      100: '#dbe3fe',
      300: '#a5b4fc',
      500: '#4f46e5',
      700: '#3730a3',
      900: '#1e1b4b',
    },
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      300: '#cbd5e1',
      500: '#64748b',
      700: '#334155',
      900: '#0f172a',
    },
    success: '#15803d',
    warning: '#a16207',
    danger: '#b91c1c',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#475569',
    textOnBrand: '#ffffff',
    border: '#cbd5e1',
    categorical: [
      '#4f46e5',
      '#0891b2',
      '#15803d',
      '#a16207',
      '#b91c1c',
      '#7e22ce',
      '#be185d',
      '#0f766e',
    ],
  },
  font: {
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    size: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.5rem', xxl: '2rem' },
    weight: { regular: 400, medium: 500, bold: 700 },
  },
  space: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
  shadow: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
    md: '0 4px 12px rgba(15, 23, 42, 0.12)',
  },
};

/**
 * Tokens que un objeto PUEDE anular. El resto no es anulable.
 *
 * Es el "conjunto documentado y limitado" de 4.3, expresado como dato y no como convencion,
 * para que `validateOverrides` pueda rechazar lo que quede fuera.
 */
export const OVERRIDABLE_TOKENS = [
  'color.categorical',
  'color.surface',
  'color.text',
  'color.textMuted',
  'color.border',
  'font.size.base',
  'radius.md',
  'space.md',
] as const;

export type OverridableToken = (typeof OVERRIDABLE_TOKENS)[number];

export type ThemeOverrides = Partial<Record<OverridableToken, string | string[]>>;

export interface OverrideProblem {
  token: string;
  problem: string;
}

/** Rechaza anulaciones fuera del conjunto permitido. */
export function validateOverrides(overrides: Record<string, unknown>): OverrideProblem[] {
  const permitidos = new Set<string>(OVERRIDABLE_TOKENS);
  return Object.keys(overrides)
    .filter((token) => !permitidos.has(token))
    .map((token) => ({
      token,
      problem:
        `'${token}' no esta en el conjunto de tokens anulables por objeto (4.3). ` +
        `Permitidos: ${OVERRIDABLE_TOKENS.join(', ')}.`,
    }));
}

/** Expone el tema como variables CSS, para consumirlo sin acoplar los componentes a este modulo. */
export function toCssVariables(theme: ThemeTokens = defaultTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const recorrer = (prefijo: string, valor: unknown): void => {
    if (typeof valor === 'string' || typeof valor === 'number') {
      vars[`--${prefijo}`] = String(valor);
      return;
    }
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => {
        vars[`--${prefijo}-${i}`] = String(v);
      });
      return;
    }
    if (valor && typeof valor === 'object') {
      for (const [clave, sub] of Object.entries(valor)) {
        recorrer(`${prefijo}-${clave}`, sub);
      }
    }
  };
  for (const [clave, valor] of Object.entries(theme)) recorrer(clave, valor);
  return vars;
}
