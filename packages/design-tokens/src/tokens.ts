/** Tema organizacional — seccion 4.3 del contrato de ingenieria. */

import { asThemeTokens, lightTheme } from './institutionalTheme';

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
    /** Color institucional de acento. */
    accent: ColorScale;
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

/** Tema institucional del Poder Judicial de la Republica Dominicana. */
/** Tema institucional por defecto — DERIVADO del esquema Material Design 3. */
export const defaultTheme: ThemeTokens = asThemeTokens(lightTheme);

/** Tokens que un objeto PUEDE anular. El resto no es anulable. */
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
