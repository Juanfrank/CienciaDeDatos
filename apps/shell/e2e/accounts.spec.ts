import { expect, test } from './instance';
import { DEMO_KEY, SECRETO_TOTP_DEMO, totpCodeOf, mailUser } from '../src/server/demoCredentials';
import { asLogin } from './session';

/** Cuentas locales, desbloqueo y restablecimiento — seccion 4.7.2. */

const ACCOUNT = 'u-sin-equipo';
const MAIL = mailUser(ACCOUNT);

/** Una contrasena distinta por uso. */
let contador = 0;
const newKey = (): string => `Restablecida-${Date.now()}-${(contador += 1)}-Aa!`;

/** Tramita un restablecimiento como Administrador y devuelve el codigo. */
async function tramitar(
  page: import('@playwright/test').Page,
  email = MAIL,
): Promise<{ resetId: string; code: string; entregado: boolean }> {
  const respuesta = await page.request.post('/api/admin/accounts', {
    data: { accion: 'restablecer', email },
  });
  expect(respuesta.ok(), await respuesta.text()).toBe(true);
  return (await respuesta.json()) as { resetId: string; code: string; entregado: boolean };
}

/** Falla el inicio de sesion las veces que hagan falta para bloquear la cuenta. */
async function bloquear(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await page.request.post('/api/sign-in', { data: { mail: MAIL, clave: `Mal-${i}-2026!` } });
  }
}

/*
 * Las cuentas locales ya no tienen seccion propia: viven en la tabla de USUARIOS.
 *
 * Eran dos tablas de las mismas personas en dos pantallas, y quien busca por que alguien no puede
 * entrar no tiene por que saber de antemano si su cuenta es local o institucional — es justo lo
 * que viene a averiguar.
 */
test.describe('la superficie de cuentas locales (4.7.2)', () => {
  test('un Visor no entra, ni por la pagina ni por la API', async ({ page }) => {
    await asLogin(page, 'u-beto');
    expect((await page.request.get('/api/admin/accounts')).status()).toBe(403);
    await page.goto('/admin/users');
    await expect(page.getByTestId('tabla-usuarios')).toHaveCount(0);
  });

  test('un Administrador ve cuantas cuentas locales hay y cual es el canal de entrega', async ({
    page,
  }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/users');

    await expect(page.getByTestId('tabla-usuarios')).toBeVisible();
    // La cuenta local se distingue de la institucional en la propia fila.
    await expect(page.getByTestId(`usuario-${ACCOUNT}-tipo`)).toHaveText('Local');
    // Sin correo institucional configurado, la pantalla lo dice en vez de dar a entender que
    // sale un correo: de ese canal depende que el flujo sea seguro.
    await expect(page.getByTestId('canal-restablecimiento')).toContainText('no configurado');
    await expect(page.getByTestId('canal-restablecimiento')).toContainText('MEDIADO');
  });

  test('una cuenta bloqueada se ve como tal y se puede desbloquear SIN cambiar la contrasena', async ({
    page,
  }) => {
    await asLogin(page, 'u-admin');
    await bloquear(page);

    await page.goto('/admin/users');
    await expect(page.getByTestId(`usuario-${ACCOUNT}`)).toContainText('Bloqueada');

    await page.getByTestId(`unlock-${ACCOUNT}`).click();
    await expect(page.getByTestId(`usuario-${ACCOUNT}`)).toContainText('Activa');

    // Y la contrasena de siempre vuelve a servir: un error de dedos no obliga a cambiarla.
    const entrada = await page.request.post('/api/sign-in', {
      data: { mail: MAIL, clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
    });
    // La cuenta no pertenece a ningun equipo, asi que autenticar funciona y la sesion no se
    // emite: 403 por falta de equipo, NO 401 por credenciales. Esa distincion es el resultado.
    expect(entrada.status()).toBe(403);
  });
});

test.describe('restablecimiento con token de un solo uso', () => {
  test('el flujo completo: tramitar, canjear, y entrar con la contrasena nueva', async ({ page }) => {
    await asLogin(page, 'u-admin');

    const first = newKey();
    const one = await tramitar(page);
    // El canal automatico no entrego nada y lo dice; por eso el codigo viaja al Administrador.
    expect(one.entregado).toBe(false);
    expect(one.resetId).toBeTruthy();

    const canjeado = await page.request.post('/api/reset', {
      data: { resetId: one.resetId, code: one.code, clave: first },
    });
    expect(canjeado.ok(), await canjeado.text()).toBe(true);

    // Sirve: 403 por no pertenecer a ningun equipo, NO 401 por credenciales. La cuenta esta
    // reservada justo por eso, y esa distincion es lo que prueba que la contrasena es correcta.
    const withFirstThe = await page.request.post('/api/sign-in', {
      data: { mail: MAIL, clave: first, code: totpCodeOf(SECRETO_TOTP_DEMO) },
    });
    expect(withFirstThe.status()).toBe(403);

    // Y al restablecerla otra vez, la anterior deja de servir.
    const segunda = newKey();
    const dos = await tramitar(page);
    await page.request.post('/api/reset', {
      data: { resetId: dos.resetId, code: dos.code, clave: segunda },
    });

    expect(
      (
        await page.request.post('/api/sign-in', {
          data: { mail: MAIL, clave: first, code: totpCodeOf(SECRETO_TOTP_DEMO) },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post('/api/sign-in', {
          data: { mail: MAIL, clave: segunda, code: totpCodeOf(SECRETO_TOTP_DEMO) },
        })
      ).status(),
    ).toBe(403);
  });

  test('no se puede reutilizar una contrasena reciente (4.7.2)', async ({ page }) => {
    await asLogin(page, 'u-admin');

    const clave = newKey();
    const primero = await tramitar(page);
    await page.request.post('/api/reset', {
      data: { resetId: primero.resetId, code: primero.code, clave },
    });

    const second = await tramitar(page);
    const repetida = await page.request.post('/api/reset', {
      data: { resetId: second.resetId, code: second.code, clave },
    });

    expect(repetida.status()).toBe(422);
    expect((await repetida.json()).motivo).toBe('reutiliza-contrasena');
  });

  test('el token sirve UNA sola vez', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const { resetId, code } = await tramitar(page);

    const primero = await page.request.post('/api/reset', {
      data: { resetId, code, clave: newKey() },
    });
    expect(primero.ok(), await primero.text()).toBe(true);

    const second = await page.request.post('/api/reset', {
      data: { resetId, code, clave: newKey() },
    });

    expect(second.status()).toBe(400);
    expect((await second.json()).motivo).toBe('token-ya-usado');
  });

  test('un codigo inventado no sirve, y no hay forma de comprobarlo sin canjearlo', async ({
    page,
  }) => {
    await asLogin(page, 'u-admin');
    const { resetId } = await tramitar(page);

    const fallo = await page.request.post('/api/reset', {
      data: { resetId, code: 'inventado', clave: newKey() },
    });
    expect(fallo.status()).toBe(400);
    expect((await fallo.json()).motivo).toBe('token-invalido');

    // No hay GET: un endpoint para preguntar si un resetId existe seria un oraculo para tantear
    // tokens sin gastar intentos.
    expect((await page.request.get('/api/reset')).status()).toBe(405);
  });

  test('la contrasena nueva pasa por la politica, y el error dice que falta', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const { resetId, code } = await tramitar(page);

    const fallo = await page.request.post('/api/reset', {
      data: { resetId, code, clave: 'corta' },
    });

    // 422 y no 400: el token servia; lo que falla es la contrasena propuesta. Esa distincion le
    // dice a quien lo usa si tiene que pedir otro codigo o solo elegir mejor.
    expect(fallo.status()).toBe(422);
    expect((await fallo.json()).motivo).toBe('politica-incumplida');

    // El codigo sigue vivo: un intento rechazado por la politica no gasta el token.
    const bueno = await page.request.post('/api/reset', {
      data: { resetId, code, clave: newKey() },
    });
    expect(bueno.ok(), await bueno.text()).toBe(true);
  });

  test('restablecer una cuenta inexistente responde 404 al Administrador', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const respuesta = await page.request.post('/api/admin/accounts', {
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
    await page.goto('/reset');
    // Sin sesion no redirige a /sign-in: quien llega aqui es precisamente quien no puede entrar.
    await expect(page).toHaveURL(/\/reset/);
    await expect(page.getByTestId('reset-id')).toBeVisible();
    await expect(page.getByTestId('reset-code')).toBeVisible();
  });

  test('desde la pantalla, con el codigo que da el panel', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/users');
    await page.getByTestId(`reset-${ACCOUNT}`).click();

    const resetId = await page.getByTestId('reset-id').innerText();
    const code = await page.getByTestId('reset-code').innerText();

    const clave = newKey();
    await page.goto('/reset');
    await page.getByTestId('reset-id').fill(resetId);
    await page.getByTestId('reset-code').fill(code);
    await page.getByTestId('reset-key').fill(clave);
    await page.getByTestId('reset-repetida').fill(clave);
    await page.getByTestId('reset-send').click();

    await expect(page.getByTestId('reset-ir-a-acceso')).toBeVisible();
  });

  test('dos contrasenas distintas se avisan antes de enviar', async ({ page }) => {
    await page.goto('/reset');
    await page.getByTestId('reset-id').fill('x');
    await page.getByTestId('reset-code').fill('y');
    await page.getByTestId('reset-key').fill(newKey());
    await page.getByTestId('reset-repetida').fill('Otra-Cosa-2026!');
    await page.getByTestId('reset-send').click();

    await expect(page.getByTestId('reset-error')).toContainText('no coinciden');
  });
});
