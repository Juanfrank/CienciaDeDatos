/**
 * Validacion automatica de contraste — seccion 4.3.
 *
 * El documento la exige "sobre combinaciones de color elegidas ANTES de publicar un modulo
 * institucional". Es decir: es una puerta de publicacion, no una advertencia cosmetica. Y la
 * seccion 4.9 es explicita en que la accesibilidad no es opcional y no se pospone.
 *
 * Implementa el calculo de razon de contraste de WCAG 2.1 (luminancia relativa).
 */

export type WcagLevel = 'AA' | 'AAA';
export type TextSize = 'normal' | 'large';

/** Umbrales de WCAG 2.1. "Grande" es >=18.66px en negrita o >=24px normal. */
const UMBRALES: Record<WcagLevel, Record<TextSize, number>> = {
  AA: { normal: 4.5, large: 3 },
  AAA: { normal: 7, large: 4.5 },
};

/** Componentes RGB de un color hexadecimal de 3 o 6 digitos. */
export function parseHex(color: string): { r: number; g: number; b: number } | null {
  const limpio = color.trim().replace(/^#/, '');
  const expandido =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(expandido)) return null;
  return {
    r: parseInt(expandido.slice(0, 2), 16),
    g: parseInt(expandido.slice(2, 4), 16),
    b: parseInt(expandido.slice(4, 6), 16),
  };
}

/** Luminancia relativa segun WCAG 2.1. */
export function relativeLuminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const canal = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Razon de contraste entre dos colores, de 1 (identicos) a 21 (negro sobre blanco). */
export function contrastRatio(foreground: string, background: string): number | null {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 === null || l2 === null) return null;
  const claro = Math.max(l1, l2);
  const oscuro = Math.min(l1, l2);
  return (claro + 0.05) / (oscuro + 0.05);
}

export interface ContrastCheck {
  foreground: string;
  background: string;
  /** Que combinacion es, para poder señalarla en la interfaz. */
  label: string;
  size?: TextSize;
}

export interface ContrastResult extends ContrastCheck {
  ratio: number | null;
  required: number;
  passes: boolean;
  /** Presente cuando algun color no se pudo interpretar. */
  error?: string;
}

export function checkContrast(check: ContrastCheck, level: WcagLevel = 'AA'): ContrastResult {
  const size = check.size ?? 'normal';
  const required = UMBRALES[level][size];
  const ratio = contrastRatio(check.foreground, check.background);

  if (ratio === null) {
    return {
      ...check,
      size,
      ratio: null,
      required,
      passes: false,
      error: `Color no interpretable: '${check.foreground}' sobre '${check.background}'. Solo se admite hexadecimal.`,
    };
  }

  return { ...check, size, ratio, required, passes: ratio >= required };
}

/**
 * Puerta de publicacion: comprueba todas las combinaciones y devuelve las que no pasan.
 *
 * Devolver la lista completa —en vez de lanzar al primer fallo— es deliberado: quien publica
 * necesita ver de una vez todo lo que hay que corregir, no descubrirlo de uno en uno.
 */
export function findContrastFailures(
  checks: ContrastCheck[],
  level: WcagLevel = 'AA',
): ContrastResult[] {
  return checks.map((c) => checkContrast(c, level)).filter((r) => !r.passes);
}

/**
 * Combinaciones que todo modulo institucional debe superar antes de publicarse.
 *
 * Incluye cada color de la paleta categorica sobre la superficie: una serie de datos que no
 * contrasta con el fondo es ilegible, aunque el texto de la pagina si contraste.
 */
export function institutionalContrastChecks(theme: {
  color: {
    text: string;
    textMuted: string;
    textOnBrand: string;
    surface: string;
    background: string;
    categorical: string[];
    brand: { 500: string; 700: string };
    accent: { 500: string; 700: string };
    danger: string;
  };
}): ContrastCheck[] {
  const { color } = theme;
  return [
    { label: 'texto sobre superficie', foreground: color.text, background: color.surface },
    { label: 'texto sobre fondo', foreground: color.text, background: color.background },
    { label: 'texto atenuado sobre superficie', foreground: color.textMuted, background: color.surface },
    { label: 'texto atenuado sobre fondo', foreground: color.textMuted, background: color.background },
    { label: 'texto sobre color de marca', foreground: color.textOnBrand, background: color.brand[500] },
    // Enlaces, botones de texto y el indicador de foco usan el tono 700 sobre las dos
    // superficies. Es la combinacion mas repetida de toda la interfaz.
    { label: 'enlace sobre superficie', foreground: color.brand[700], background: color.surface },
    { label: 'enlace sobre fondo', foreground: color.brand[700], background: color.background },
    {
      label: 'texto sobre color de estado de error',
      foreground: color.textOnBrand,
      background: color.danger,
    },
    /**
     * El acento se comprueba como ELEMENTO GRAFICO (3:1), no como texto.
     *
     * No es una excepcion que se hace para que pase: es lo que el acento es, segun la propia
     * norma de marca —enfasis y contraste, nunca relleno dominante—. Comprobarlo a 4.5:1 daria
     * un fallo permanente que alguien acabaria silenciando, y silenciar la puerta de contraste
     * es peor que no tenerla.
     */
    {
      label: 'acento como elemento grafico sobre superficie',
      foreground: color.accent[500],
      background: color.surface,
      size: 'large' as const,
    },
    /**
     * Y el tono con el que SI se puede escribir en rojo se comprueba como texto.
     *
     * Estas dos comprobaciones juntas son la regla: si alguien aclara `accent[700]` buscando
     * acercarlo al rojo de la marca, esta prueba lo detiene antes de que llegue a un rotulo.
     */
    {
      label: 'texto de acento sobre superficie',
      foreground: color.accent[700],
      background: color.surface,
    },
    ...color.categorical.map((c, i) => ({
      label: `serie ${i + 1} sobre superficie`,
      foreground: c,
      background: color.surface,
      // Las marcas de un grafico son elementos graficos, no texto: el umbral aplicable es el
      // de componente no textual (3:1), que coincide con el de texto grande.
      size: 'large' as const,
    })),
  ];
}
