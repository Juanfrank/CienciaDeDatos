import { expect, type Page } from '@playwright/test';
import {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  totpCodeOf,
  mailUser,
} from '../src/server/demoCredentials';

/** Inicio de sesion de verdad para las pruebas de navegador. */
export async function asLogin(page: Page, userId: string, base = ''): Promise<void> {
  const respuesta = await page.request.post(`${base}/api/acceso`, {
    data: {
      mail: mailUser(userId),
      clave: DEMO_KEY,
      code: totpCodeOf(SECRETO_TOTP_DEMO),
    },
  });

  // Si el inicio de sesion falla, la prueba debe caerse AQUI y no diez pasos mas adelante con un
  // "no se encontro el elemento" que no dice nada de la causa.
  expect(
    respuesta.ok(),
    `No se pudo iniciar sesion como ${userId}: ${respuesta.status()} ${await respuesta.text()}`,
  ).toBe(true);

  await page.goto(`${base || '/'}`);
}

/** Cierra la sesion del contexto, revocandola tambien del lado servidor. */
export async function salir(page: Page, base = ''): Promise<void> {
  await page.request.delete(`${base}/api/acceso`);
}
