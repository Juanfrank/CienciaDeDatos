import { cookies } from 'next/headers';
import { type ColorMode } from '@app/design-tokens';

/** En que modo de color se dibuja la aplicacion — seccion 4.3. */
export const THEME_COOKIE = 'tema';

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark'];

export function colorModeIs(valor: string | undefined): valor is ColorMode {
  return valor === 'light' || valor === 'dark';
}

/** El modo pedido, o el claro. */
export async function colorMode(): Promise<ColorMode> {
  const valor = (await cookies()).get(THEME_COOKIE)?.value;
  return colorModeIs(valor) ? valor : 'light';
}
