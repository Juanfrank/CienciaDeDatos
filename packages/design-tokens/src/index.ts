/** Tema organizacional y accesibilidad — seccion 4.3. */
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
export { defaultIdentity, type InstitutionIdentity } from './identity';
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
export {
  CONTRAST_PAIRS,
  CHART_PAIRS,
  schemeFor,
  palettesFor,
  type MaterialScheme,
  type ColorMode,
  type ThemeSource,
  type TonalPalettes,
} from './material3';
export {
  ELEVATION,
  STATUS,
  SHAPE,
  MOVIMIENTO,
  TYPOGRAPHY,
  categoricalFor,
  materialTheme,
  materialVariables,
  type TypographicStyle,
  type TypographicRole,
  type MaterialTheme,
} from './material3Tokens';
export {
  INSTITUTIONAL_SOURCE,
  FONTS,
  asThemeTokens,
  lightTheme,
  darkTheme,
  themeForMode,
} from './institutionalTheme';
export {
  type ThemeDefinition,
  INSTITUTIONAL_THEME,
  SOURCE_ROLES,
  sourceColorIs,
  themeVersion,
  themeVersions,
} from './themeDefinition';
