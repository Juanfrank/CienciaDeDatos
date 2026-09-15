'use client';

import Link from 'next/link';
import { Icon, type IconName } from './Icon';

/**
 * Un icono que LLEVA a otro sitio, no que hace algo aqui.
 *
 * Es un enlace y no un boton con `router.push` dentro, y la diferencia no es de estilo: un enlace
 * se abre en otra pestana con el boton central, se copia con el menu contextual, y un lector de
 * pantalla lo anuncia como enlace — que es lo que es. Un boton que navega miente en las tres
 * cosas.
 */
export function IconLink({
  icono,
  etiqueta,
  href,
  ...resto
}: {
  icono: IconName;
  etiqueta: string;
  href: string;
} & { 'data-testid'?: string }) {
  return (
    <Link href={href} className="icon-button" aria-label={etiqueta} title={etiqueta} {...resto}>
      <Icon nombre={icono} />
    </Link>
  );
}
