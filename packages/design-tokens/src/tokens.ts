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
export const defaultTheme: ThemeTokens = {
  color: {
    brand: {
      // Tinte claro para insignias y fondos de enfasis.
      50: '#e8f0fe',
      // Borde institucional, tomado de la papeleria oficial.
      100: '#c7d6fb',
      300: '#6e9bf0',
      // Azul institucional.
      500: '#0050dd',
      700: '#003da6',
      900: '#001e52',
    },
    accent: {
      50: '#fdecee',
      100: '#fac9ce',
      300: '#f5838c',
      // Rojo institucional. Solo enfasis y series de datos: no admite texto pequeño.
      500: '#ef3340',
      // El unico rojo de la familia que SI admite texto pequeño (4.84:1 sobre blanco).
      700: '#d72e3a',
      900: '#8f1f26',
    },
    neutral: {
      50: '#f7f8fa',
      100: '#eef1f6',
      300: '#c7cedb',
      // Gris institucional de la papeleria oficial.
      500: '#5b6b87',
      700: '#3a465c',
      900: '#1a1a1a',
    },
    success: '#15803d',
    warning: '#b45309',
    // Rojo de estado: el hermano con texto del acento, no el acento. Un badge de error lleva
    // texto blanco encima, y con `#ef3340` ese texto quedaria en 4.02:1.
    danger: '#d72e3a',
    background: '#f3f5f9',
    surface: '#ffffff',
    surfaceMuted: '#eef1f6',
    text: '#1a1a1a',
    textMuted: '#5b6b87',
    textOnBrand: '#ffffff',
    border: '#c7cedb',
    /**
     * Paleta categorica.
     *
     * Abre con el azul institucional y sigue con el rojo de acento, que es el orden que fija la
     * norma de marca para las series de un grafico. De ahi en adelante la norma solo dice
     * "grises para lo terciario", que sirve en un informe de una o dos series y no en una
     * aplicacion donde un objeto puede tener ocho: la extension se queda dentro de la familia
     * institucional, se aleja en tono ademas de en color —para que se distingan tambien en
     * escala de grises y con daltonismo— y cada valor supera 3:1 sobre la superficie.
     */
    categorical: [
      '#0050dd',
      '#ef3340',
      '#0e7490',
      '#b45309',
      '#15803d',
      '#6d28d9',
      '#5b6b87',
      '#9d174d',
    ],
  },
  font: {
    // Montserrat es la tipografia institucional. Las alternativas de detras no son decoracion:
    // si la fuente no carga —red caida, entorno sin acceso— la aplicacion tiene que seguir
    // legible en vez de caer en la serif por defecto del navegador.
    sans: "var(--font-montserrat), Montserrat, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    size: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.5rem', xxl: '2rem' },
    weight: { regular: 400, medium: 500, bold: 700 },
  },
  space: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
  shadow: {
    sm: '0 1px 2px rgba(26, 26, 26, 0.08)',
    md: '0 4px 12px rgba(26, 26, 26, 0.12)',
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
