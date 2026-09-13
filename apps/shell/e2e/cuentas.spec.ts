import { expect, test } from '@playwright/test';
import { CLAVE_DEMO, SECRETO_TOTP_DEMO, codigoTotpDe, usuarioACorreo } from '../src/server/credencialesDemo';
import { entrarComo } from './sesion';

/** Cuentas locales, desbloqueo y restablecimiento — seccion 4.7.2. */

const CUENTA = 'u-sin-equipo';
const CORREO = usuarioACorreo(CUENTA);

/** Una contrasena distinta por uso. */
let contador = 0;
const claveNueva = (): string => `Restablecida-${Date.now()}-${(contador += 1)}-Aa!`;

/** Tramita un restablecimiento como Administrador y devuelve el codigo. */
async function tramitar(
  page: import('@playwright/test').Page,
  email = CORREO,
): Promise<{ resetId: string; codigo: string; entregado: boolean }> {
  const respuesta = await page.request.post('/api/admin/cuentas', {
    data: { accion: 'restablecer', email },
  });
  expect(respuesta.ok(), await respuesta.text()).toBe(true);
  return (await respuesta.json()) as { resetId: string; codigo: string; entregado: boolean };
}

/** Falla el inicio de sesion las veces que hagan falta para bloquear la cuenta. */
async function bloquear(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await page.request.post('/api/acceso', { data: { correo: CORREO, clave: `Mal-${i}-2026!` } });
  }
}

test.describe('la superficie de cuentas locales (4.7.2)', () => {
  test('un Visor no entra, ni por la pagina ni por la API', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    expect((await page.request.get('/api/admin/cuentas')).status()).toBe(403);
    await page.goto('/admin/cuentas');
    await expect(page.getByTestId('tabla-cuentas')).toHaveCount(0);
  });

  test('un Administrador ve cuantas cuentas locales hay y cual es el canal de entrega', async ({
    page,
  }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/admin/cuentas');

    await expect(page.getByTestId('tabla-cuentas')).toBeVisible();
    // Sin correo institucional configurado, la pantalla lo dice en vez de dar a entender que
    // sale un correo: de ese canal depende que el flujo sea seguro.
    await expect(page.getByTestId('canal-restablecimiento')).toContainText('no configurado');
    await expect(page.getByTestId('canal-restablecimiento')).toContainText('MEDIADO');
  });

  test('una cuenta bloqueada se ve como tal y se puede desbloquear SIN cambiar la contrasena', async ({
    page,
  }) => {
    await entrarComo(page, 'u-admin');
    await bloquear(page);

    await page.goto('/admin/cuentas');
    await expect(page.getByTestId(`cuenta-${CUENTA}`)).toContainText('Bloqueada');

    await page.getByTestId(`desbloquear-${CUENTA}`).click();
    await expect(page.getByTestId(`cuenta-${CUENTA}`)).toContainText('Activa');

    // Y la contrasena de siempre vuelve a servir: un error de dedos no obliga a cambiarla.
    const entrada = await page.request.post('/api/acceso', {
      data: { correo: CORREO, clave: CLAVE_DEMO, codigo: codigoTotpDe(SECRETO_TOTP_DEMO) },
    });
    // La cuenta no pertenece a ningun equipo, asi que autenticar funciona y la sesion no se
    // emite: 403 por falta de equipo, NO 401 por credenciales. Esa distincion es el resultado.
    expect(entrada.status()).toBe(403);
  });
});

test.describe('restablecimiento con token de un solo uso', () => {
  test('el flujo completo: tramitar, canjear, y entrar con la contrasena nueva', async ({ page }) => {
    await entrarComo(page, 'u-admin');

    const primera = claveNueva();
    const uno = await tramitar(page);
    // El canal automatico no entrego nada y lo dice; por eso el codigo viaja al Administrador.
    expect(uno.entregado).toBe(false);
    expect(uno.resetId).toBeTruthy();

    const canjeado = await page.request.post('/api/restablecer', {
      data: { resetId: uno.resetId, codigo: uno.codigo, clave: primera },
    });
    expect(canjeado.ok(), await canjeado.text()).toBe(true);

    // Sirve: 403 por no pertenecer a ningun equipo, NO 401 por credenciales. La cuenta esta
    // reservada justo por eso, y esa distincion es lo que prueba que la contrasena es correcta.
    const conLaPrimera = await page.request.post('/api/acceso', {
      data: { correo: CORREO, clave: primera, codigo: codigoTotpDe(SECRETO_TOTP_DEMO) },
    });
    expect(conLaPrimera.status()).toBe(403);

    // Y al restablecerla otra vez, la anterior deja de servir.
    const segunda = claveNueva();
    const dos = await tramitar(page);
    await page.request.post('/api/restablecer', {
      data: { resetId: dos.resetId, codigo: dos.codigo, clave: segunda },
    });

    expect(
      (
        await page.request.post('/api/acceso', {
          data: { correo: CORREO, clave: primera, codigo: codigoTotpDe(SECRETO_TOTP_DEMO) },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post('/api/acceso', {
          data: { correo: CORREO, clave: segunda, codigo: codigoTotpDe(SECRETO_TOTP_DEMO) },
        })
      ).status(),
    ).toBe(403);
  });

  test('no se puede reutilizar una contrasena reciente (4.7.2)', async ({ page }) => {
    await entrarComo(page, 'u-admin');

    const clave = claveNueva();
    const primero = await tramitar(page);
    await page.request.post('/api/restablecer', {
      data: { resetId: primero.resetId, codigo: primero.codigo, clave },
    });

    const segundo = await tramitar(page);
    const repetida = await page.request.post('/api/restablecer', {
      data: { resetId: segundo.resetId, codigo: segundo.codigo, clave },
    });

    expect(repetida.status()).toBe(422);
    expect((await repetida.json()).motivo).toBe('reutiliza-contrasena');
  });

  test('el token sirve UNA sola vez', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    const { resetId, codigo } = await tramitar(page);

    const primero = await page.request.post('/api/restablecer', {
      data: { resetId, codigo, clave: claveNueva() },
    });
    expect(primero.ok(), await primero.text()).toBe(true);

    const segundo = await page.request.post('/api/restablecer', {
      data: { resetId, codigo, clave: claveNueva() },
    });

    expect(segundo.status()).toBe(400);
    expect((await segundo.json()).motivo).toBe('token-ya-usado');
  });

  test('un codigo inventado no sirve, y no hay forma de comprobarlo sin canjearlo', async ({
    page,
  }) => {
    await entrarComo(page, 'u-admin');
    const { resetId } = await tramitar(page);

    const fallo = await page.request.post('/api/restablecer', {
      data: { resetId, codigo: 'inventado', clave: claveNueva() },
    });
    expect(fallo.status()).toBe(400);
    expect((await fallo.json()).motivo).toBe('token-invalido');

    // No hay GET: un endpoint para preguntar si un resetId existe seria un oraculo para tantear
    // tokens sin gastar intentos.
    expect((await page.request.get('/api/restablecer')).status()).toBe(405);
  });

  test('la contrasena nueva pasa por la politica, y el error dice que falta', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    const { resetId, codigo } = await tramitar(page);

    const fallo = await page.request.post('/api/restablecer', {
      data: { resetId, codigo, clave: 'corta' },
    });

    // 422 y no 400: el token servia; lo que falla es la contrasena propuesta. Esa distincion le
    // dice a quien lo usa si tiene que pedir otro codigo o solo elegir mejor.
    expect(fallo.status()).toBe(422);
    expect((await fallo.json()).motivo).toBe('politica-incumplida');

    // El codigo sigue vivo: un intento rechazado por la politica no gasta el token.
    const bueno = await page.request.post('/api/restablecer', {
      data: { resetId, codigo, clave: claveNueva() },
    });
    expect(bueno.ok(), await bueno.text()).toBe(true);
  });

  test('restablecer una cuenta inexistente responde 404 al Administrador', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    const respuesta = await page.request.post('/api/admin/cuentas', {
      data: { accion: 'restablecer', email: 'no-existe@poderjudicial.gob.do' },
    });
    // Aqui SI se distingue, y es correcto: quien pregunta es un Administrador autenticado
    // mirando la lista de cuentas que ya tiene delante. La indistincion protege el formulario
    // publico de acceso, no el panel.
    expect(respuesta.status()).toBe(404);
  });
});

test.describe('la pantalla de restablecimiento', () => {
  test('no pide sesion, y el identificador no viaja en la URL', async ({ page }) => {
    await page.goto('/restablecer');
    // Sin sesion no redirige a /acceso: quien llega aqui es precisamente quien no puede entrar.
    await expect(page).toHaveURL(/\/restablecer/);
    await expect(page.getByTestId('restablecer-id')).toBeVisible();
    await expect(page.getByTestId('restablecer-codigo')).toBeVisible();
  });

  test('desde la pantalla, con el codigo que da el panel', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/admin/cuentas');
    await page.getByTestId(`restablecer-${CUENTA}`).click();

    const resetId = await page.getByTestId('reset-id').innerText();
    const codigo = await page.getByTestId('reset-codigo').innerText();

    const clave = claveNueva();
    await page.goto('/restablecer');
    await page.getByTestId('restablecer-id').fill(resetId);
    await page.getByTestId('restablecer-codigo').fill(codigo);
    await page.getByTestId('restablecer-clave').fill(clave);
    await page.getByTestId('restablecer-repetida').fill(clave);
    await page.getByTestId('restablecer-enviar').click();

    await expect(page.getByTestId('restablecer-ir-a-acceso')).toBeVisible();
  });

  test('dos contrasenas distintas se avisan antes de enviar', async ({ page }) => {
    await page.goto('/restablecer');
    await page.getByTestId('restablecer-id').fill('x');
    await page.getByTestId('restablecer-codigo').fill('y');
    await page.getByTestId('restablecer-clave').fill(claveNueva());
    await page.getByTestId('restablecer-repetida').fill('Otra-Cosa-2026!');
    await page.getByTestId('restablecer-enviar').click();

    await expect(page.getByTestId('restablecer-error')).toContainText('no coinciden');
  });
});
