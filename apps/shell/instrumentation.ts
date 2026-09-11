/**
 * Arranque del proceso del shell.
 *
 * Next llama a `register` una vez por proceso de servidor, antes de atender ninguna solicitud.
 * Es el sitio correcto para levantar el trabajador de fondo —exportaciones, alertas y
 * suscripciones—: arrancarlo desde un Route Handler lo ataria al ciclo de una solicitud, que es
 * justo lo que 5.3 prohibe.
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { iniciarTrabajadorDeFondo } = await import('./src/server/trabajador');
  iniciarTrabajadorDeFondo();
}
