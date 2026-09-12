import { redirect } from 'next/navigation';
import { defaultIdentity } from '@app/design-tokens';
import { Acceso } from '../../src/components/Acceso';
import { AZURE_AD_DISPONIBLE } from '../../src/server/identidad';
import { obtenerSesion } from '../../src/server/sesion';

/**
 * Pantalla de acceso (4.7).
 *
 * Fuera del grupo (modulos) y del panel: no tiene cabecera con selector de equipo ni arbol de
 * navegacion, porque todavia no hay nadie de quien saber el equipo.
 */
export const metadata = { title: 'Iniciar sesion' };

export default async function PaginaAcceso() {
  // Con sesion valida no se muestra la pantalla: se vuelve a la aplicacion.
  if (await obtenerSesion()) redirect('/');

  return <Acceso azureAdDisponible={AZURE_AD_DISPONIBLE} identidad={defaultIdentity} />;
}
