import { expect, type Page } from '@playwright/test';
import {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  totpCodeOf,
  mailUser,
} from '../src/server/demoCredentials';

/** Inicio de sesion de verdad para las pruebas de navegador. */
export async function asLogin(page: Page, userId: string, base = ''): Promise<void> {
  const respuesta = await page.request.post(`${base}/api/sign-in`, {
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
  await page.request.delete(`${base}/api/sign-in`);
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
  const creado = await page.request.post('/api/modules', {
    data: { nombre: `Modulo ${slug}`, slug },
  });
  expect(creado.ok(), `No se pudo crear el modulo ${slug}: ${await creado.text()}`).toBe(true);
  await page.goto(`/editor/${slug}`);
}

/**
 * Espera a que el editor este AL DIA: nada pendiente, nada en vuelo, nada dibujandose.
 *
 * Son tres esperas y hacen falta las tres. Al principio bastaba `data-saving`, porque cada gesto
 * escribia y el lienzo se dibujaba con lo que devolvia esa escritura; al separar dibujar de
 * guardar hizo falta `data-drawing`; y con el autoguardado aparece una tercera ventana —el
 * rebote— en la que no se esta guardando ni dibujando y el cambio sigue solo en el navegador.
 * Mirando dos de las tres, la espera pasa por encima de esa ventana y la prueba lee el estado
 * anterior.
 *
 * Vive aqui porque estaba copiada en tres archivos de pruebas, que es la forma conocida de que
 * una se arregle y las otras dos se queden como estaban: al anadir `data-dirty` paso exactamente
 * eso.
 */
export async function alDia(page: Page): Promise<void> {
  await expect(page.locator('.editor')).toHaveAttribute('data-dirty', 'no');
  await expect(page.locator('.editor')).toHaveAttribute('data-saving', 'no');
  await expect(page.locator('.editor')).toHaveAttribute('data-drawing', 'no');
}
