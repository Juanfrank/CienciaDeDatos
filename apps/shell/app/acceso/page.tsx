import { redirect } from 'next/navigation';
import { defaultIdentity } from '@app/design-tokens';
import { Acceso } from '../../src/components/Acceso';
import { AZURE_AD_DISPONIBLE } from '../../src/server/identity';
import { obtenerSesion } from '../../src/server/session';

/** Pantalla de acceso (4.7). */
export const metadata = { title: 'Iniciar sesion' };

export default async function PaginaAcceso() {
  // Con sesion valida no se muestra la pantalla: se vuelve a la aplicacion.
  if (await obtenerSesion()) redirect('/');

  return <Acceso azureAdDisponible={AZURE_AD_DISPONIBLE} identidad={defaultIdentity} />;
}
