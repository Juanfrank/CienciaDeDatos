import { cookies } from 'next/headers';
import { type ModoDeColor } from '@app/design-tokens';

/**
 * En que modo de color se dibuja la aplicacion — seccion 4.3.
 *
 * El esquema oscuro se genera desde siempre junto al claro y la puerta de contraste lo recorre
 * entero, pero hasta ahora no habia forma de PEDIRLO: el layout fijaba el tema claro, asi que lo
 * unico verificado del oscuro eran sus tokens. Un tema se rompe al componer, no en la tabla de
 * tonos, y eso solo se ve dibujando cada pantalla en ese modo.
 *
 * Se elige con una cookie explicita y NO con `prefers-color-scheme`. La diferencia importa: la
 * media query enciende el modo oscuro a cualquiera que lleve el sistema en oscuro, incluidas las
 * pantallas que nadie ha revisado; la cookie lo enciende solo a quien lo pide. Encenderlo para
 * todos es un paso posterior, y lo que lo habilita es que las pruebas de esta tanda recorran en
 * oscuro las mismas paginas que ya se recorren en claro.
 */
export const COOKIE_DE_TEMA = 'tema';

export const MODOS_DE_COLOR: readonly ModoDeColor[] = ['claro', 'oscuro'];

export function esModoDeColor(valor: string | undefined): valor is ModoDeColor {
  return valor === 'claro' || valor === 'oscuro';
}

/**
 * El modo pedido, o el claro.
 *
 * Un valor desconocido en la cookie cae en claro en vez de fallar: es una preferencia de
 * presentacion, no una credencial, y una cookie manipulada no debe dejar la aplicacion en blanco.
 */
export async function modoDeColor(): Promise<ModoDeColor> {
  const valor = (await cookies()).get(COOKIE_DE_TEMA)?.value;
  return esModoDeColor(valor) ? valor : 'claro';
}
