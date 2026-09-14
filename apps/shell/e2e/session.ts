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

/**
 * Un modulo vacio, listo para editar.
 *
 * Se crea por API y no rellenando el formulario. La diferencia importa: cincuenta y seis pruebas
 * usaban el formulario como MONTAJE —dos cargas de pagina y tres interacciones cada una, por algo
 * que no era lo que venian a comprobar—. Quien prueba la creacion por la interfaz, porque ESA es
 * su pregunta, es `editor.spec.ts`, y sigue haciendolo por el formulario.
 */
export async function newModule(page: Page, slug: string): Promise<void> {
  const creado = await page.request.post('/api/modulos', {
    data: { nombre: `Modulo ${slug}`, slug },
  });
  expect(creado.ok(), `No se pudo crear el modulo ${slug}: ${await creado.text()}`).toBe(true);
  await page.goto(`/editor/${slug}`);
}
