import { expect, type Page } from '@playwright/test';
import {
  CLAVE_DEMO,
  SECRETO_TOTP_DEMO,
  codigoTotpDe,
  usuarioACorreo,
} from '../src/server/credencialesDemo';

/**
 * Inicio de sesion de verdad para las pruebas de navegador.
 *
 * Antes bastaba con `POST /api/sesion/equipo-activo { userId }`: la sesion se emitia sola y ese
 * desplegable cambiaba de identidad sin autenticar. Ahora las pruebas pasan por el mismo camino
 * que una persona —correo, contrasena y TOTP contra `/api/acceso`—, que es lo que hace que lo
 * que comprueban sea el sistema real y no un atajo de desarrollo.
 *
 * El codigo TOTP se calcula aqui con el mismo secreto sembrado. No es un rodeo a la segunda
 * verificacion: es lo que hace cualquier cliente TOTP, y el servidor lo valida igual.
 */
export async function entrarComo(page: Page, userId: string, base = ''): Promise<void> {
  const respuesta = await page.request.post(`${base}/api/acceso`, {
    data: {
      correo: usuarioACorreo(userId),
      clave: CLAVE_DEMO,
      codigo: codigoTotpDe(SECRETO_TOTP_DEMO),
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
