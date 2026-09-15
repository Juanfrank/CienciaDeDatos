import AxeBuilder from '@axe-core/playwright';
import { DEMO_KEY, SECRETO_TOTP_DEMO, mailUser, totpCodeOf } from '../src/server/demoCredentials';
import { expect, test } from './instance';
import { asLogin } from './session';

/** Incorporacion en otros portales — seccion 4.9. */

/**
 * Un codigo de incrustacion, pedido por la API.
 *
 * La URL incrustada ya no es `/embed/m/{slug}` con los filtros en la query: es `/embed/{codigo}`,
 * y el codigo queda registrado con quien lo genero. Componerla a mano en las pruebas volveria a
 * probar algo que la aplicacion ya no hace.
 */
const codigoDe = async (
  page: import('@playwright/test').Page,
  cuerpo: Record<string, unknown>,
): Promise<string> => {
  const respuesta = await page.request.post('/api/embeds', { data: cuerpo });
  expect(respuesta.ok(), await respuesta.text()).toBe(true);
  const { codigo } = (await respuesta.json()) as { codigo: { code: string } };
  return codigo.code;
};

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('politica de enmarcado', () => {
  test('ninguna pantalla normal se puede enmarcar', async ({ page }) => {
    // Denegar por defecto cierra el clickjacking en toda la aplicacion —incluido el panel de
    // administracion— sin que haya que acordarse de ninguna pantalla.
    for (const path of ['/m/casos-pendientes', '/admin', '/notices']) {
      const respuesta = await page.request.get(path);
      expect(respuesta.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(respuesta.headers()['x-frame-options']).toBe('DENY');
    }
  });

  test('sin portales configurados, la ruta de incrustacion tampoco se enmarca', async ({ page }) => {
    // El servidor de pruebas corre sin EMBED_ALLOWED_ORIGINS: es el caso de la configuracion
    // olvidada, y tiene que fallar cerrado.
    const code = await codigoDe(page, { modulo: 'casos-pendientes' });
    const respuesta = await page.request.get(`/embed/${code}`);
    expect(respuesta.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});

test.describe('la vista incrustada aplica el mismo ambito', () => {
  test('muestra los datos del equipo de QUIEN MIRA, no del que la incrusto', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);
    await expect(page.getByTestId('module-title')).toHaveText('Casos pendientes');
    await expect(page.getByTestId('tabla')).toContainText('Distrito Norte');
    await expect(page.getByTestId('tabla')).not.toContainText('Distrito Este');
  });

  test('un modulo no concedido al equipo tampoco se incrusta', async ({ page }) => {
    await asLogin(page, 'u-ana');
    // 'estadisticas' vive fuera de lo concedido al equipo Norte. Generar el codigo pasa por la
    // MISMA puerta que servir el modulo, asi que el atajo se cierra antes de que exista una URL.
    const respuesta = await page.request.post('/api/embeds', { data: { modulo: 'estadisticas' } });
    expect(respuesta.status()).toBe(404);
  });

  test('un filtro fuera del ambito no amplia lo incrustado', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const code = await codigoDe(page, {
      modulo: 'casos-pendientes',
      filtros: { 'DimTribunal.Distrito': ['Distrito Este'] },
    });
    await page.goto(`/embed/${code}`);
    await expect(page.getByTestId('tabla')).not.toContainText('Distrito Este');
  });
});

test.describe('la vista incrustada conserva lo que la hace interpretable', () => {
  test('lleva procedencia (4.6), frescura (4.8) e identidad institucional', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);

    // Dentro de otro portal es donde mas falta hacen: quien mira ya no tiene alrededor la
    // aplicacion que le diga de donde salen las cifras ni de cuando son.
    await expect(page.getByTestId('procedencia')).toContainText('Vista institucional oficial');
    await expect(page.getByTestId('frescura')).toContainText('Datos actualizados');
    await expect(page.locator('.embedded__institucion')).toContainText('Poder Judicial');
  });

  test('no lleva los controles que sacan de la vista', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);

    for (const control of ['exportar', 'create-notice', 'incrustar']) {
      await expect(page.getByTestId(control)).toHaveCount(0);
    }
    // El arbol de navegacion tampoco: compite con la navegacion del portal anfitrion.
    await expect(page.getByTestId('nav-audiencias')).toHaveCount(0);
  });

  test('el enlace de vuelta abre en pestana nueva', async ({ page }) => {
    // Navegar en el mismo marco dejaria la aplicacion entera metida en un hueco del portal.
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);
    await expect(page.getByTestId('see-completo')).toHaveAttribute('target', '_blank');
  });

  test('el filtrado cruzado sigue funcionando dentro del marco', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
  });

  test('no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe('el codigo de incrustacion se copia desde la vista', () => {
  test('el codigo lo genera el SERVIDOR, y queda a nombre de quien lo pidio', async ({ page }) => {
    /*
     * La URL ya no dice el modulo ni los filtros: dice un codigo. Eso es lo que permite responder
     * quien puso una vista de la institucion en la pagina de otro —y quitarla— sin tocar el
     * modulo. Los filtros de delante siguen viajando, pero dentro del codigo.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');

    await page.getByTestId('incrustar').click();
    await expect(page.getByTestId('embed-code')).not.toHaveValue('');
    const code = await page.getByTestId('embed-code').inputValue();

    // La direccion lleva el codigo y NADA del modulo: ni su slug ni sus filtros. El `title` del
    // marco si lo nombra, y eso se queda — es lo que un lector de pantalla anuncia del iframe.
    const src = /src="([^"]+)"/.exec(code)?.[1] ?? '';
    expect(src).toMatch(/\/embed\/inc-[a-z0-9-]+$/);
    expect(src).not.toContain('casos-pendientes');
    expect(src).not.toContain('Materia');
    expect(code).toContain('allow=""');

    // Y consta en el registro, con su dueno y su vista.
    await asLogin(page, 'u-admin');
    const { codigos } = (await (await page.request.get('/api/embeds')).json()) as {
      codigos: { code: string; createdBy: string; filters: Record<string, string[]> }[];
    };
    const registro = codigos.find((c) => code.includes(c.code));
    expect(registro?.createdBy).toBe('u-ana');
    expect(registro?.filters['DimTribunal.Materia']).toEqual(['Penal']);
  });

  test('avisa de que la vista incrustada NO es publica', async ({ page }) => {
    // Quien pega el codigo espera que funcione para cualquier visitante del portal. Decirlo
    // aqui evita que se descubra en produccion y se pida "un modo publico" para arreglarlo.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('incrustar').click();

    await expect(page.getByTestId('embed-notice')).toContainText('iniciado sesion');
    await expect(page.getByTestId('embed-notice')).toContainText('su propio');
  });
});


test.describe('las dos formas de incrustar (4.9)', () => {
  test('sin encabezado: ni emblema ni salida, y SI quien mira', async ({ page }) => {
    /*
     * La version limpia se incrusta dentro de un sistema que ya es del Poder Judicial, asi que el
     * emblema repetido no dice nada nuevo y el enlace de salida es justo lo que quien la incrusta
     * no quiere. Lo que NO se quita es quien mira: lo que se ve depende de su ambito, y una vista
     * que no lo diga se lee como la de todo el mundo.
     */
    await asLogin(page, 'u-ana');
    const code = await codigoDe(page, { modulo: 'casos-pendientes', cromo: 'limpio' });
    await page.goto(`/embed/${code}`);

    await expect(page.locator('.embedded__institucion')).toHaveCount(0);
    await expect(page.getByTestId('see-completo')).toHaveCount(0);
    await expect(page.getByTestId('embedded-quien')).toBeVisible();

    // Y sigue siendo el modulo, no una version recortada de sus datos.
    await expect(page.getByTestId('module-title')).toContainText('Casos pendientes');
    await expect(page.getByTestId('frescura')).toContainText('Datos actualizados');
  });

  test('la cabecera de la APLICACION no entra en el marco, en ninguna de las dos', async ({
    page,
  }) => {
    /*
     * Servia DOS encabezados: el de la aplicacion encima del institucional, y con el la
     * navegacion entera de la capa de visualizacion dentro del hueco del portal anfitrion. La
     * version «sin encabezado» tenia uno igualmente, que es lo que lo dejo a la vista.
     *
     * Se comprueba por el conmutador de navegacion y por el nombre de la institucion que dibuja
     * esa cabecera: los dos salen de ella y de ningun otro sitio.
     */
    await asLogin(page, 'u-ana');
    const rutas = [
      `/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`,
      `/embed/${await codigoDe(page, { modulo: 'casos-pendientes', cromo: 'limpio' })}`,
    ];
    for (const ruta of rutas) {
      await page.goto(ruta);
      await expect(page.locator('.cabecera'), ruta).toHaveCount(0);
      await expect(page.getByTestId('open-navigation'), ruta).toHaveCount(0);
      await expect(page.getByTestId('institucion'), ruta).toHaveCount(0);
    }
  });

  test('el navegador de pagina SI entra, y sus enlaces NO salen del marco', async ({ page }) => {
    /*
     * Ir de una pagina del modulo a otra es moverse dentro de lo que se incrusto, asi que el
     * navegador entra: sin el, incrustar un modulo de once paginas ensenaria una y escondaria
     * diez. Lo que no puede hacer es apuntar a `/m/...`, que se llevaria la aplicacion entera al
     * hueco del portal anfitrion — que es lo que la vista incrustada existe para no hacer.
     */
    await asLogin(page, 'u-ana');
    const code = await codigoDe(page, { modulo: 'composicion', cromo: 'limpio' });
    await page.goto(`/embed/${code}`);

    const enlace = page.getByTestId('nav-pagina-graficos');
    await expect(enlace).toBeVisible();
    // Conserva el CODIGO: salirse de el seria perder a quien genero la vista.
    await expect(enlace).toHaveAttribute('href', new RegExp(`^/embed/${code}\\?pagina=`));

    /*
     * Y el modulo EMPIEZA donde acaba el panel — se mide, no se confia.
     *
     * El margen del cuerpo incrustado estaba escrito con el atajo `padding`, que ponia a cero el
     * lado del panel y se llevaba por delante la reserva sin que nadie lo decidiera: el titulo
     * del modulo salia cortado por debajo del navegador y nadie lo veia hasta mirar la pantalla.
     */
    const panel = await page.getByTestId('navegador-de-pagina').boundingBox();
    const titulo = await page.getByTestId('module-title').boundingBox();
    expect(panel).not.toBeNull();
    expect(titulo).not.toBeNull();
    expect(titulo?.x ?? 0).toBeGreaterThanOrEqual((panel?.x ?? 0) + (panel?.width ?? 0));

    await enlace.click();
    await expect(page).toHaveURL(new RegExp(`/embed/${code}\\?pagina=graficos$`));
    // Y sigue sin encabezado despues de navegar: el cromo lo fija el codigo, no el enlace.
    await expect(page.locator('.embedded__institucion')).toHaveCount(0);
  });

  test('con encabezado: emblema, salida, y tambien quien mira', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto(`/embed/${await codigoDe(page, { modulo: 'casos-pendientes' })}`);

    await expect(page.locator('.embedded__institucion')).toContainText('Poder Judicial');
    await expect(page.getByTestId('see-completo')).toBeVisible();
    await expect(page.getByTestId('embedded-quien')).toBeVisible();
  });

  test('sin sesion se dibuja la PANTALLA DE ACCESO, y entrar deja en la misma vista', async ({
    page,
  }) => {
    /*
     * Antes era un aviso con un enlace a otra pestana. Ahora se entra aqui dentro, y lo que hay
     * que comprobar no es que el formulario exista: es a donde lleva. Un `router.push('/')` —que
     * es lo que hacia la pantalla de acceso— meteria la aplicacion entera en el hueco del portal
     * anfitrion, que es exactamente lo que la vista incrustada existe para no hacer.
     */
    const code = await codigoDe(page, { modulo: 'casos-pendientes', cromo: 'limpio' });
    await page.context().clearCookies();
    await page.goto(`/embed/${code}`);

    await expect(page.getByLabel(/correo/i)).toBeVisible();
    // Y la salida a una pestana propia sigue ahi: un iframe de otro sitio muchas veces no puede
    // escribir la cookie de sesion, y sin ella entrar aqui fallaria en silencio.
    await expect(page.getByTestId('embedded-without-session')).toBeVisible();

    // Se entra POR EL FORMULARIO, no por la API: lo que se comprueba es a donde lleva entrar
    // desde aqui dentro, y eso solo lo decide el formulario.
    await page.getByLabel(/correo/i).fill(mailUser('u-ana'));
    await page.getByLabel(/contrase/i).fill(DEMO_KEY);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.getByLabel(/codigo|código/i).fill(totpCodeOf(SECRETO_TOTP_DEMO));
    await page.getByRole('button', { name: /verificar|entrar/i }).click();
    await expect(page).toHaveURL(new RegExp(`/embed/${code}$`));
    await expect(page.getByTestId('module-title')).toBeVisible();
  });

  test('el dialogo ofrece las dos, y cada una genera SU codigo', async ({ page }) => {
    /*
     * El cromo dejo de viajar en la query: lo fija el codigo. Elegir la otra forma genera un
     * codigo distinto, que es lo que permite revocar la version limpia sin tocar la completa.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('incrustar').click();
    await expect(page.getByTestId('embed-code')).not.toHaveValue('');
    const completo = await page.getByTestId('embed-code').inputValue();

    /*
     * El campo se VACIA mientras el servidor acuna el otro codigo, y tiene que hacerlo: dejar el
     * anterior a la vista mientras se pide otro invita a copiar el que ya no es. Por eso lo que se
     * espera no es «que cambie» —el hueco intermedio ya es un cambio— sino el boton de copiar, que
     * vuelve a habilitarse justo cuando hay un codigo nuevo que copiar.
     */
    await page.getByTestId('cromo-limpio').check();
    await expect(page.getByTestId('incrustar-copiar')).toBeEnabled();
    const limpio = await page.getByTestId('embed-code').inputValue();
    expect(limpio).not.toBe(completo);
    expect(limpio).not.toBe('');

    // Y el registro lo dice: dos codigos, uno de cada forma.
    await asLogin(page, 'u-admin');
    const { codigos } = (await (await page.request.get('/api/embeds')).json()) as {
      codigos: { code: string; chrome: string }[];
    };
    expect(codigos.find((c) => completo.includes(c.code))?.chrome).toBe('completo');
    expect(codigos.find((c) => limpio.includes(c.code))?.chrome).toBe('limpio');
  });
});

test.describe('los codigos se registran y se pueden suprimir (4.9 y 4.10.7)', () => {
  test('el panel dice QUIEN genero cada codigo, y para que vista', async ({ page }) => {
    /*
     * Es la pregunta que antes no tenia respuesta: donde estan las vistas de la institucion
     * metidas en paginas de fuera, y quien las puso ahi. Con la URL compuesta a mano no habia
     * lista, no habia dueno y no habia forma de retirar una sin tocar el modulo.
     */
    await asLogin(page, 'u-ana');
    const code = await codigoDe(page, { modulo: 'casos-pendientes' });

    await asLogin(page, 'u-admin');
    await page.goto('/admin/embeds');
    const fila = page.getByTestId(`codigo-${code}`);
    await expect(fila).toContainText('Ana Rodriguez M.');
    await expect(fila).toContainText('Casos pendientes');
    await expect(page.getByTestId(`estado-${code}`)).toHaveText('Activo');
  });

  test('suprimir un vinculo NO lo convierte en un 404: dice que fue suprimido', async ({ page }) => {
    /*
     * Un 404 dentro del portal de otra institucion se lee como que la aplicacion se cayo, y quien
     * la mantiene no tiene por donde empezar a preguntar. El vinculo sobrevive a su revocacion
     * justamente para poder decir que paso, y con el motivo que se escribio al suprimirlo.
     */
    await asLogin(page, 'u-ana');
    const code = await codigoDe(page, { modulo: 'casos-pendientes' });
    await page.goto(`/embed/${code}`);
    await expect(page.getByTestId('module-title')).toBeVisible();

    await asLogin(page, 'u-admin');
    await page.goto('/admin/embeds');
    await page.getByTestId(`revocar-${code}`).click();
    await page.getByTestId(`revocar-motivo-${code}`).fill('La cifra estaba mal calculada.');
    await page.getByTestId(`revocar-confirmar-${code}`).click();
    await expect(page.getByTestId(`estado-${code}`)).toHaveText('Suprimido');

    // La URL sigue respondiendo, sin datos y diciendo por que.
    const respuesta = await page.goto(`/embed/${code}`);
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByTestId('embed-revocado')).toContainText('La cifra estaba mal calculada');
    await expect(page.getByTestId('module-title')).toHaveCount(0);
  });

  test('un codigo que no existe si es un 404, y solo un Administrador ve la lista', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    // Inventado: no hay nada que decir de el, y fingir que existio seria peor.
    expect((await page.goto('/embed/inc-noexiste'))?.status()).toBe(404);

    // Y el registro es de gobierno: dice donde estan las vistas de toda la institucion.
    expect((await page.request.get('/api/embeds')).status()).toBe(403);
  });
});

test.describe('la puerta anti-CSRF (2.16)', () => {
  /*
   * Es lo que permite que la cookie pueda cruzar de sitio sin quedarse sin proteccion.
   *
   * `sameSite: 'lax'` era la UNICA defensa contra la falsificacion de peticiones, y es tambien lo
   * que impedia que un portal externo viera datos: el navegador no manda la cookie a un iframe de
   * otro sitio. Levantar lo segundo sin poner otra cosa en el sitio de lo primero seria cambiar un
   * problema por uno peor.
   */
  test('una escritura sin token se rechaza, aunque la sesion sea buena', async ({ page }) => {
    // Se quita la cabecera que `asLogin` dejo puesta: asi es como llega una peticion falsificada
    // —con la cookie, porque la manda el navegador, y sin token, porque no se puede leer desde
    // otro sitio—.
    await page.context().setExtraHTTPHeaders({});

    const respuesta = await page.request.post('/api/bookmarks', {
      data: { name: 'falsificado', moduleSlug: 'casos-pendientes', query: '' },
    });

    expect(respuesta.status()).toBe(403);
    expect(await respuesta.text()).toContain('token');
  });

  test('con el token puesto, la misma escritura pasa', async ({ page }) => {
    // El contraste importa: un 403 constante tambien lo daria una ruta rota.
    const respuesta = await page.request.post('/api/bookmarks', {
      data: { name: 'legitimo', moduleSlug: 'casos-pendientes', query: '' },
    });

    expect(respuesta.ok(), await respuesta.text()).toBe(true);
  });

  test('leer no necesita token', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({});

    // Una lectura no cambia nada, asi que falsificarla no consigue nada: exigir token ahi seria
    // ruido, y ademas rompe la navegacion normal del navegador.
    const respuesta = await page.request.get('/api/bookmarks');
    expect(respuesta.ok()).toBe(true);
  });
});
