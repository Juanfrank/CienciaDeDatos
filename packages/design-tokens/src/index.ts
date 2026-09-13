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
  PARES_DE_CONTRASTE,
  PARES_GRAFICOS,
  esquemaDe,
  paletasDe,
  type EsquemaMaterial,
  type ModoDeColor,
  type OrigenDelTema,
  type PaletasTonales,
} from './material3';
export {
  ELEVACION,
  ESTADO,
  FORMA,
  MOVIMIENTO,
  TIPOGRAFIA,
  categoricaDe,
  temaMaterial,
  variablesMaterial,
  type EstiloTipografico,
  type RolTipografico,
  type TemaMaterial,
} from './material3Tokens';
export {
  ORIGEN_INSTITUCIONAL,
  comoThemeTokens,
  temaClaro,
  temaOscuro,
  temaPorModo,
} from './temaInstitucional';
