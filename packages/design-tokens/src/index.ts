/**
 * Tema organizacional y accesibilidad — seccion 4.3.
 *
 * Tema por defecto con un conjunto documentado y limitado de anulaciones por objeto, mas la
 * validacion de contraste que debe pasar ANTES de publicar un modulo institucional. La
 * accesibilidad no es opcional ni se pospone (seccion 4.9).
 */
export {
  checkContrast,
  contrastRatio,
  findContrastFailures,
  institutionalContrastChecks,
  parseHex,
  relativeLuminance,
  type ContrastCheck,
  type ContrastResult,
  type TextSize,
  type WcagLevel,
} from './contrast';
export {
  OVERRIDABLE_TOKENS,
  defaultTheme,
  toCssVariables,
  validateOverrides,
  type ColorScale,
  type OverridableToken,
  type OverrideProblem,
  type ThemeOverrides,
  type ThemeTokens,
} from './tokens';
