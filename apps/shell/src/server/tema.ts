import { cookies } from 'next/headers';
import { type ModoDeColor } from '@app/design-tokens';

/** En que modo de color se dibuja la aplicacion — seccion 4.3. */
export const COOKIE_DE_TEMA = 'tema';

export const MODOS_DE_COLOR: readonly ModoDeColor[] = ['claro', 'oscuro'];

export function esModoDeColor(valor: string | undefined): valor is ModoDeColor {
  return valor === 'claro' || valor === 'oscuro';
}

/** El modo pedido, o el claro. */
export async function modoDeColor(): Promise<ModoDeColor> {
  const valor = (await cookies()).get(COOKIE_DE_TEMA)?.value;
  return esModoDeColor(valor) ? valor : 'claro';
}
