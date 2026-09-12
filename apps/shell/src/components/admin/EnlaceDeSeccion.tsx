'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Enlace del carril de administracion, con estado activo.
 *
 * Existe como componente de cliente por una sola razon: el layout de /admin se renderiza en el
 * servidor y alli no hay ruta actual que consultar. `usePathname` la da en el cliente sin
 * convertir el layout entero —ni la comprobacion de permiso que hace— en codigo de cliente.
 *
 * El estado activo se marca con `aria-current="page"`, y el CSS se cuelga de ESE atributo en vez
 * de una clase suelta: asi lo que se ve y lo que anuncia un lector de pantalla no pueden
 * separarse, que es justo la forma de fallo que 4.9 no admite.
 */
export function EnlaceDeSeccion({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  const ruta = usePathname();
  // Coincidencia por prefijo: /admin/equipos/e-1/miembros sigue siendo "Equipos y membresia".
  const activo = ruta === href || ruta.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      data-testid={`admin-nav-${href.split('/').pop()}`}
    >
      <span className="admin__nav-label">{label}</span>
      <span className="admin__nav-desc">{desc}</span>
    </Link>
  );
}
