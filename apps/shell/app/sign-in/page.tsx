import { redirect } from 'next/navigation';
import { defaultIdentity } from '@app/design-tokens';
import { Login } from '../../src/components/Login';
import { AZURE_AD_AVAILABLE } from '../../src/server/identity';
import { sessionGet } from '../../src/server/session';
import { activeTheme, themeVariables } from '../../src/server/theme';

/** Pantalla de acceso (4.7). */
export const metadata = { title: 'Iniciar sesion' };

export default async function LoginPage() {
  // Con sesion valida no se muestra la pantalla: se vuelve a la aplicacion.
  if (await sessionGet()) redirect('/');

  /*
   * Esta pantalla se dibuja SIEMPRE en oscuro, y es la unica que no sigue la preferencia de quien
   * mira. El modo de color es una comodidad de quien ya trabaja dentro; aqui todavia no hay
   * nadie, y lo que hace falta es que la puerta de la institucion se vea igual siempre — un
   * membrete que cambia de aspecto segun el ajuste del navegador es un membrete que no sirve para
   * reconocerlo.
   *
   * No son colores escritos a mano: es la version OSCURA del mismo tema institucional, que ya
   * pasa la puerta de contraste. Cambiar el tema de la institucion cambia tambien esta pantalla.
   */
  const variables = themeVariables(await activeTheme(), 'dark');

  return (
    <Login
      azureAdAvailable={AZURE_AD_AVAILABLE}
      identity={defaultIdentity}
      variables={variables}
    />
  );
}
