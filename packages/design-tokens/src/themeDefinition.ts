import { type ColorMode, type ThemeSource } from './material3';
import { type MaterialTheme, materialTheme } from './material3Tokens';
import { INSTITUTIONAL_SOURCE, FONTS } from './institutionalTheme';

/**
 * Un tema: un nombre y TRES colores de origen — seccion 4.3.
 *
 * Lo que se guarda no son los tokens, son los origenes. Material Design 3 deriva de ellos los
 * cuarenta y tantos tokens de cada modo, y el claro y el oscuro de un tema salen del MISMO origen:
 * por eso un tema no es «el claro» y otro «el oscuro», sino que cada tema tiene los dos. Guardarlos
 * como dos temas sueltos —que es como estaban— permitia que alguien cambiara uno y no el otro, y
 * la aplicacion pasaria a oscuro con colores de otra marca.
 *
 * Tampoco se guarda token a token. Editar uno suelto rompe la relacion de contraste que 4.9 exige,
 * y la pantalla dejaria de poder prometer AA: lo que se elige son los origenes, y el contraste se
 * comprueba sobre lo derivado antes de dejar guardar.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  /** Para que se creo, en una frase. Se lee en la lista de temas. */
  description?: string;
  source: ThemeSource;
  /**
   * De fabrica: viene con la aplicacion y no se borra.
   *
   * Sin un tema que siempre este, borrar el ultimo dejaria la aplicacion sin color —y sin forma de
   * volver a entrar a crear uno, porque el panel tambien se dibuja con el.
   */
  builtIn?: boolean;
}

/** El tema institucional, el que viene de fabrica. */
export const INSTITUTIONAL_THEME: ThemeDefinition = {
  id: 'institucional',
  name: 'Institucional',
  description: 'La norma de marca del Poder Judicial: azul, rojo de acento y el gris de la portada.',
  source: INSTITUTIONAL_SOURCE,
  builtIn: true,
};

/** Las dos versiones de un tema, derivadas de su origen. Todo tema tiene las dos. */
export function themeVersions(definicion: ThemeDefinition): Record<ColorMode, MaterialTheme> {
  return {
    light: materialTheme(definicion.source, 'light', FONTS),
    dark: materialTheme(definicion.source, 'dark', FONTS),
  };
}

/** Una version concreta. */
export function themeVersion(definicion: ThemeDefinition, mode: ColorMode): MaterialTheme {
  return materialTheme(definicion.source, mode, FONTS);
}

/** Los tres roles de origen, en el orden en que se explican y se editan. */
export const SOURCE_ROLES: readonly (keyof ThemeSource)[] = ['primario', 'acento', 'neutro'];

/** Un color de origen valido: hexadecimal de seis digitos. Es lo que el derivador sabe leer. */
export function sourceColorIs(valor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(valor.trim());
}
