import { expect, test } from '@playwright/test';
import {
  CLAVE_DEMO,
  SECRETO_TOTP_DEMO,
  codigoTotpDe,
  usuarioACorreo,
} from '../src/server/credencialesDemo';
import { entrarComo } from './sesion';

/** Autenticacion de punta a punta — seccion 4.7 y criterios de la seccion 9. */

const CORREO = usuarioACorreo('u-ana');

/** Un correo distinto por prueba: el bloqueo es por cuenta y se pegarian entre ellas. */
const correoNuevo = () => `inexistente-${Date.now()}-${Math.random().toString(36).slice(2)}@poderjudicial.gob.do`;

test.describe('sin sesion no se entra (criterio de la seccion 9)', () => {
  test('una pagina lleva a la pantalla de acceso, no a los datos', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page).toHaveURL(/\/acceso/);
    await expect(page.getByTestId('acceso-entrar')).toBeVisible();
    // Lo importante no es la redireccion, sino que no se haya dibujado el modulo.
    await expect(page.getByTestId('tabla')).toHaveCount(0);
  });

  test('las rutas de API responden 401, no datos ni una redireccion silenciosa', async ({ page }) => {
    for (const path of [
      '/api/navegacion',
      '/api/modulos/casos-pendientes',
      '/api/marcadores',
      '/api/alertas',
      '/api/suscripciones',
      '/api/notificaciones',
    ]) {
      const respuesta = await page.request.get(path, { maxRedirects: 0 });
      expect(respuesta.status(), `${path} deberia exigir sesion`).toBe(401);
    }
  });

  test('el panel de administracion responde 401 antes que 403', async ({ page }) => {
    // "No se quien eres" y "se quien eres y no puedes" son respuestas distintas. Devolver 403 a
    // quien no ha entrado le hace buscar un permiso cuando lo que le falta es la sesion.
    const respuesta = await page.request.get('/api/admin/arbol', { maxRedirects: 0 });
    expect(respuesta.status()).toBe(401);
  });

  test('una escritura sin sesion tampoco pasa', async ({ page }) => {
    const marcador = await page.request.post('/api/marcadores', {
      maxRedirects: 0,
      data: { name: 'intruso', moduleSlug: 'casos-pendientes' },
    });
    expect(marcador.status()).toBe(401);

    // Encolar una exportacion es una escritura y ademas gasta trabajo del proceso de fondo: si
    // no exigiera sesion, seria una forma de cargar el sistema sin haber entrado.
    const exportacion = await page.request.post('/api/exportaciones', {
      maxRedirects: 0,
      data: { modulo: 'casos-pendientes', formato: 'csv' },
    });
    expect(exportacion.status()).toBe(401);

    const consulta = await page.request.post('/api/consulta', {
      maxRedirects: 0,
      data: { pregunta: 'casos por distrito', modulo: 'casos-pendientes' },
    });
    expect(consulta.status()).toBe(401);
  });

  test('el 401 llega ANTES de validar el cuerpo', async ({ page }) => {
    // Con un cuerpo deliberadamente invalido. Si respondiera 400, quien no ha entrado podria
    // averiguar que formatos admite la aplicacion y que campos espera cada ruta, probando
    // cuerpos hasta que el mensaje cambie. La sesion se comprueba primero, siempre.
    const respuesta = await page.request.post('/api/exportaciones', {
      maxRedirects: 0,
      data: { formato: 'formato-que-no-existe' },
    });
    expect(respuesta.status()).toBe(401);
  });
});

test.describe('el segundo factor es obligatorio en las cuentas locales (4.7.2)', () => {
  test('con la contrasena correcta y sin codigo, la respuesta es 428 y no hay sesion', async ({ page }) => {
    const respuesta = await page.request.post('/api/acceso', {
      data: { correo: CORREO, clave: CLAVE_DEMO },
    });

    expect(respuesta.status()).toBe(428);
    expect((await respuesta.json()).motivo).toBe('mfa-requerido');
    // Saber la contrasena no basta: hasta aqui no se ha emitido ninguna sesion.
    expect((await page.context().cookies()).find((c) => c.name === 'sesion')).toBeUndefined();
  });

  test('un codigo equivocado no entra aunque la contrasena sea correcta', async ({ page }) => {
    const respuesta = await page.request.post('/api/acceso', {
      data: { correo: CORREO, clave: CLAVE_DEMO, codigo: '000000' },
    });
    expect(respuesta.status()).toBe(401);
    expect((await respuesta.json()).motivo).toBe('mfa-invalido');
  });

  test('el formulario pide el codigo solo despues de comprobar la contrasena', async ({ page }) => {
    await page.goto('/acceso');
    // No se pide el segundo factor de entrada: obligaria a sacar el telefono antes de saber si
    // la contrasena era correcta.
    await expect(page.getByTestId('acceso-codigo')).toHaveCount(0);

    await page.getByTestId('acceso-correo').fill(CORREO);
    await page.getByTestId('acceso-clave').fill(CLAVE_DEMO);
    await page.getByTestId('acceso-entrar').click();

    await expect(page.getByTestId('acceso-codigo')).toBeVisible();
    await expect(page.getByTestId('acceso-error')).toContainText('codigo');
  });
});

test.describe('la pantalla de acceso no informa a quien tantea', () => {
  test('cuenta inexistente y contrasena incorrecta dan el MISMO mensaje', async ({ page }) => {
    const inexistente = await page.request.post('/api/acceso', {
      data: { correo: correoNuevo(), clave: CLAVE_DEMO },
    });
    const equivocada = await page.request.post('/api/acceso', {
      data: { correo: CORREO, clave: 'Esta-no-es-2026!' },
    });

    expect(inexistente.status()).toBe(401);
    expect(equivocada.status()).toBe(401);
    // Distinguirlos convertiria la pantalla en un comprobador de correos institucionales
    // validos, que es lo primero que necesita un ataque por fuerza bruta.
    expect((await inexistente.json()).error).toBe((await equivocada.json()).error);
  });

  test('la cuenta se bloquea tras varios intentos fallidos', async ({ page }) => {
    // Cuenta reservada para esto. El bloqueo dura un minuto y vive en el almacen compartido:
    // usar una cuenta real dejaria sin sesion a todas las pruebas que corren despues, y el
    // sintoma —"no se pudo iniciar sesion"— no apuntaria a esta prueba.
    const correo = usuarioACorreo('u-sin-equipo');

    let ultimo = '';
    for (let i = 0; i < 6; i += 1) {
      const r = await page.request.post('/api/acceso', {
        data: { correo, clave: `Mal-${i}-2026!` },
      });
      ultimo = (await r.json()).motivo as string;
    }

    expect(ultimo).toBe('cuenta-bloqueada');

    // Y estando bloqueada, la contrasena CORRECTA tampoco entra: si entrara, el bloqueo solo
    // frenaria a quien se equivoca, no a quien acierta al final.
    const conLaBuena = await page.request.post('/api/acceso', {
      data: { correo, clave: CLAVE_DEMO, codigo: codigoTotpDe(SECRETO_TOTP_DEMO) },
    });
    expect((await conLaBuena.json()).motivo).toBe('cuenta-bloqueada');
  });
});

test.describe('la sesion emitida es la de quien entro', () => {
  test('entrar da acceso a los datos de SU equipo, no a los de otro', async ({ page }) => {
    await entrarComo(page, 'u-ana');

    const navegacion = await (await page.request.get('/api/navegacion')).json();
    expect(navegacion.equipoActivo).toBe('equipo-norte');

    const modulo = await (await page.request.get('/api/modulos/casos-pendientes')).json();
    const dataRows = modulo.objetos[0].result.rows as unknown[][];
    expect([...new Set(dataRows.map((f) => String(f[0])))]).toEqual(['Distrito Norte']);
  });

  test('ya no se puede cambiar de persona sin autenticar', async ({ page }) => {
    await entrarComo(page, 'u-ana');

    // Esta era la puerta de atras del entorno de demostracion: un desplegable que cambiaba de
    // identidad. La ruta ya no acepta userId, y lo que hay que comprobar es que ignorarlo no
    // basta — que NO se convierta en un cambio silencioso.
    const respuesta = await page.request.post('/api/sesion/equipo-activo', {
      data: { userId: 'u-admin' },
    });
    expect(respuesta.status()).toBe(400);

    const navegacion = await (await page.request.get('/api/navegacion')).json();
    expect(navegacion.equipoActivo).toBe('equipo-norte');
    expect((await page.request.get('/api/admin/arbol')).status()).toBe(403);
  });

  test('cerrar sesion REVOCA, no solo borra la cookie', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const cookie = (await page.context().cookies()).find((c) => c.name === 'sesion');
    expect(cookie).toBeDefined();

    await page.goto('/m/casos-pendientes');
    await page.getByTestId('cerrar-sesion').click();
    await expect(page).toHaveURL(/\/acceso/);

    // Con el identificador anterior —una copia de la cookie tomada antes de salir— tampoco se
    // entra. Si solo se hubiera borrado la cookie del navegador, esta peticion daria 200.
    const respuesta = await page.request.get('/api/navegacion', {
      headers: { cookie: `sesion=${cookie?.value ?? ''}` },
      maxRedirects: 0,
    });
    expect(respuesta.status()).toBe(401);
  });
});

test.describe('Azure AD se declara, no se simula', () => {
  test('el boton existe y dice que no esta habilitado en este entorno', async ({ page }) => {
    await page.goto('/acceso');
    const boton = page.getByTestId('acceso-azure');
    await expect(boton).toBeVisible();
    await expect(boton).toContainText('Azure AD');

    await boton.click();
    // Se explica, no se finge un inicio de sesion que pareceria funcionar — el mismo criterio
    // que siguen los conectores de datos pendientes.
    await expect(page.getByTestId('acceso-error')).toContainText('Azure AD');
    await expect(page).toHaveURL(/\/acceso/);
  });

  test('la ruta responde 501, no un 200 con una sesion falsa', async ({ page }) => {
    const respuesta = await page.request.post('/api/acceso', { data: { proveedor: 'azure-ad' } });
    expect(respuesta.status()).toBe(501);
    expect((await page.context().cookies()).find((c) => c.name === 'sesion')).toBeUndefined();
  });
});

test.describe('con sesion, la pantalla de acceso no se queda en medio', () => {
  test('quien ya entro va a la aplicacion', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/acceso');
    await expect(page).toHaveURL(/\/m\//);
  });
});
