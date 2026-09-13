import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  createTranslator,
  isLocale,
  type Locale,
  type Translator,
} from '@app/i18n';

/**
 * En que idioma se dibuja la aplicacion.
 *
 * Lo decide una cookie explicita y NADA MAS. La negociacion por `Accept-Language` existe en
 * `@app/i18n` y aqui esta deliberadamente sin cablear: la cabecera la manda el navegador, no la
 * persona, y con ella cualquiera que tenga el sistema en ingles veria una aplicacion
 * institucional en un idioma que nadie ha revisado. El idioma de esta aplicacion es el espanol.
 *
 * Es la misma decision que en el modo de color, y por el mismo motivo. Encender la negociacion
 * automatica es cambiar esta funcion, y lo que lo habilita es haber traducido el catalogo entero.
 */
export const COOKIE_DE_IDIOMA = 'idioma';

export async function idioma(): Promise<Locale> {
  const chosen = (await cookies()).get(COOKIE_DE_IDIOMA)?.value;
  return isLocale(chosen) ? chosen : DEFAULT_LOCALE;
}

/** El traductor de la peticion en curso, para un componente de servidor. */
export async function traductor(): Promise<Translator> {
  return createTranslator(await idioma());
}
