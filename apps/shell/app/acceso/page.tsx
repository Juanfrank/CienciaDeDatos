import { redirect } from 'next/navigation';
import { defaultIdentity } from '@app/design-tokens';
import { Login } from '../../src/components/Login';
import { AZURE_AD_DISPONIBLE } from '../../src/server/identity';
import { obtenerSesion } from '../../src/server/session';

/** Pantalla de acceso (4.7). */
export const metadata = { title: 'Iniciar sesion' };

export default async function LoginPage() {
  // Con sesion valida no se muestra la pantalla: se vuelve a la aplicacion.
  if (await obtenerSesion()) redirect('/');

  return <Login azureAdDisponible={AZURE_AD_DISPONIBLE} identity={defaultIdentity} />;
}
