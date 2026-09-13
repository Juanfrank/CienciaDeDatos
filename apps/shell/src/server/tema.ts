import { cookies } from 'next/headers';
import { type ColorMode } from '@app/design-tokens';

/** En que modo de color se dibuja la aplicacion — seccion 4.3. */
export const COOKIE_DE_TEMA = 'tema';

export const MODOS_DE_COLOR: readonly ColorMode[] = ['light', 'dark'];

export function esModoDeColor(valor: string | undefined): valor is ColorMode {
  return valor === 'light' || valor === 'dark';
}

/** El modo pedido, o el claro. */
export async function modoDeColor(): Promise<ColorMode> {
  const valor = (await cookies()).get(COOKIE_DE_TEMA)?.value;
  return esModoDeColor(valor) ? valor : 'light';
}
