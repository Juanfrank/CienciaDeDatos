/**
 * Tema organizacional — seccion 4.3 del contrato de ingenieria.
 *
 * Tema por defecto con anulaciones permitidas por objeto, dentro de un conjunto DOCUMENTADO Y
 * LIMITADO. El limite es deliberado: si cualquier objeto pudiera anular cualquier token, dos
 * modulos institucionales dejarian de parecerse entre si y la validacion de contraste (abajo)
 * no podria garantizar nada.
 */

import { comoThemeTokens, temaClaro } from './temaInstitucional';

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
    /**
     * Color institucional de acento.
     *
     * El rojo de la marca es de ENFASIS: rotulos, segunda serie de un grafico, remates. No es
     * un relleno dominante ni un fondo para texto pequeño — ver la nota del tema por defecto.
     */
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

/**
 * Tema institucional del Poder Judicial de la Republica Dominicana.
 *
 * Azul `#0050DD` como color principal y rojo `#EF3340` como acento, con Montserrat de
 * tipografia. Cambiarlos aqui los cambia en toda la aplicacion Y en los archivos exportados,
 * que es justo el proposito de centralizarlos: una marca que se detiene en la pantalla no es
 * una marca, y un PDF que circula por correo con otros colores es el caso que lo demuestra.
 *
 * ADVERTENCIA SOBRE EL ROJO INSTITUCIONAL, que condiciona todo lo de abajo. `#EF3340` da 4.02:1
 * sobre blanco: pasa el umbral de elemento GRAFICO (3:1) y NO el de texto pequeño (4.5:1), ni
 * como texto sobre blanco ni como fondo con texto blanco encima. Coincide con la norma de marca
 * —"usar con moderacion, para enfasis y contraste, nunca como relleno dominante"— asi que se
 * respeta el valor exacto para acento y series de datos, y el texto que tenga que ir en rojo usa
 * `accent[700]`, el hermano mas oscuro que si admite texto (4.84:1). La alternativa seria aclarar
 * el rojo de la marca, y eso no se hace: la marca es un dato de la institucion, no una variable
 * de diseño.
 */
/**
 * Tema institucional por defecto — DERIVADO del esquema Material Design 3.
 *
 * Antes era una lista de valores escritos a mano, con una advertencia de varios parrafos sobre
 * el rojo institucional y que hermano de la escala usar para texto. Ahora sale de
 * `temaInstitucional`, que aplica la tabla de tonos de MD3 sobre los dos colores de marca: los
 * pares de contraste dejan de ser algo que alguien comprobo una vez y pasan a ser una propiedad
 * de como se construye el tema.
 *
 * Sigue existiendo con esta forma porque lo consume el paquete de EXPORTACION, que dibuja PDF,
 * Excel y SVG fuera del navegador y no tiene variables CSS de las que tirar. Que salga de los
 * mismos roles es lo que impide que un archivo que circula por correo lleve otra marca que la
 * pantalla de la que salio.
 */
export const defaultTheme: ThemeTokens = comoThemeTokens(temaClaro);

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
