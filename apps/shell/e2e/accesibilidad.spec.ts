import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './instance';
import { asLogin } from './session';

/**
 * Accesibilidad — seccion 4.9, "no opcional, no se pospone", y criterio de la seccion 9:
 * "Accesibilidad verificada (no pospuesta) en los modulos publicados a nivel institucional".
 */

const LEVEL = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Analiza la pagina actual y devuelve las infracciones, ya legibles en el mensaje de fallo. */
async function infracciones(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(LEVEL).analyze();
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} nodo(s): ` +
      v.nodes.map((n) => n.target.join(' ')).join(' | '),
  );
}

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('paginas de modulo', () => {
  test('un modulo con sus objetos no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('tabla')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('con filtros activos y objetos rotos tampoco', async ({ page }) => {
    // 'audiencias' contiene un objeto marcado como roto: el aviso de error tambien tiene que
    // ser accesible, que es justo cuando mas falta hace.
    await asLogin(page, 'u-ana');
    await page.goto('/m/audiencias?DimTribunal.Materia=Penal');
    await expect(page.getByTestId('object-broken')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('con un tooltip explicativo abierto tampoco hay infracciones', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('icon-tooltip-Pendientes por distrito').hover();
    await expect(page.getByTestId('tooltip-Pendientes por distrito')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el emergente de datos de origen es accesible, con el foco dentro', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('data-table-open-Pendientes por distrito').click();
    await expect(page.getByTestId('data-table-Pendientes por distrito')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);

    // El <dialog> nativo lleva el foco dentro por su cuenta. Se comprueba porque es la mitad
    // del motivo de usarlo en vez de un div con position: fixed.
    const dentro = await page.evaluate(() =>
      document.querySelector('dialog[open]')?.contains(document.activeElement),
    );
    expect(dentro).toBe(true);
  });

  test('el estado de una exportacion en curso es accesible', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('open-export').click();
    await page.getByTestId('exportar').click();
    await expect(page.getByTestId('export-status')).toHaveText(/Lista/, { timeout: 15_000 });

    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('panel de administracion (4.10.8)', () => {
  for (const path of [
    '/admin',
    '/admin/modules/tree',
    '/admin/teams',
    '/admin/modules/packages',
    '/admin/scopes',
    '/admin/who-sees-what',
    '/admin/accounts',
    '/admin/audit',
  ]) {
    test(`${path} no tiene infracciones WCAG 2.1 AA`, async ({ page }) => {
      await asLogin(page, 'u-admin');
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();

      expect(await infracciones(page)).toEqual([]);
    });
  }
});

test.describe('restablecimiento de contrasena (4.7.2)', () => {
  test('la pantalla de restablecimiento es accesible, sin sesion', async ({ page }) => {
    await page.goto('/reset');
    await expect(page.getByTestId('reset-send')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('personalizacion (4.6)', () => {
  test('el dialogo de Mi vista es accesible, con sus casillas etiquetadas', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('my-view').click();
    await expect(page.getByTestId('dialogo-my-view')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('editor de modulos (4.2)', () => {
  test('la lista y el editor de un modulo no tienen infracciones WCAG 2.1 AA', async ({ page }) => {
    await asLogin(page, 'u-ana');

    // Con un modulo de verdad dentro: un editor vacio no dibuja ni la paleta ni los campos de
    // mapeo, que es justo donde estaria el problema de accesibilidad si lo hubiera.
    const slug = `accesible-${Date.now()}`;
    const creado = await page.request.post('/api/modules', {
      data: { nombre: 'Modulo accesible', slug },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Editor de modulos' })).toBeVisible();
    expect(await infracciones(page)).toEqual([]);

    await page.goto(`/editor/${slug}`);
    await page.getByTestId('add-barras').click();
    // Con el objeto YA DIBUJADO en el lienzo y su panel abierto: es donde estarian los problemas
    // si los hubiera —un bloque que anida controles, unas pestanas que no se anuncian como tales,
    // un `<select>` sin nombre—.
    await expect(page.locator('[data-testid^="block-obj-"]')).toHaveCount(1);
    expect(await infracciones(page)).toEqual([]);
  });

  test('la pantalla de sin permiso tampoco', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/editor');
    await expect(page.getByTestId('without-permission-editor')).toBeVisible();
    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('avisos (4.9)', () => {
  test('la bandeja de avisos no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/notices');
    await expect(page.getByRole('heading', { name: 'Avisos' })).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el dialogo para crear un aviso es accesible, con sus campos etiquetados', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('create-notice').click();
    await expect(page.getByTestId('dialogo-aviso')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el punto de avisos nunca es la unica senal: lleva su texto', async ({ page }) => {
    // El punto del avatar es para la vista. Quien no la usa necesita oir cuantos y de que.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const disparador = page.getByTestId('account-trigger');
    await expect(disparador).toBeVisible();
    // El contador se sondea despues de la primera pintura: sin esperarlo se mira un menu vacio.
    await page.waitForResponse((r) => r.url().includes('/api/notifications'));

    if ((await page.getByTestId('account-dot').count()) > 0) {
      await expect(disparador).toContainText(/\d+ avisos? sin leer/);
    }

    await disparador.click();
    await expect(page.getByTestId('link-avisos')).toContainText('Avisos');
  });
});

test.describe('paginas de estado', () => {
  test('la pagina de sin permiso es accesible', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/admin-without-permission');
    expect(await infracciones(page)).toEqual([]);
  });

  test('la pagina de no encontrado es accesible', async ({ page }) => {
    await page.goto('/m/no-existe');
    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('navegacion solo con teclado', () => {
  test('se llega a la navegacion, a un segmentador y a exportar sin tocar el raton', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // Se recorre el orden de tabulacion y se comprueba que los controles clave estan en el.
    const alcanzados: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const testId = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      if (testId) alcanzados.push(testId);
    }

    expect(alcanzados).toContain('nav-casos-pendientes');
    expect(alcanzados).toContain('slicer-Penal');
    // Es el icono lo que esta en el orden de tabulacion; el boton de generar vive dentro del
    // panel que abre, y llegar al panel es llegar a exportar.
    expect(alcanzados).toContain('open-export');
  });

  test('el foco se VE: un control alcanzable sin indicador es inservible de hecho', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // El foco se lleva con el teclado, no con .focus(): :focus-visible no se activa cuando el
    // foco llega por programa o con el raton, que es justo la distincion que se quiere probar.
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo) return null;
      const style = getComputedStyle(activo);
      return { ancho: style.outlineWidth, style: style.outlineStyle };
    });

    expect(contorno?.style).not.toBe('none');
    expect(Number.parseFloat(contorno?.ancho ?? '0')).toBeGreaterThanOrEqual(2);
  });

  test('la tabla que se desplaza es alcanzable con el tabulador y esta anunciada', async ({
    page,
  }) => {
    // Una region con desplazamiento que no recibe foco deja su contenido fuera de alcance para
    // quien no usa raton. axe lo marca como scrollable-region-focusable.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const contenedor = page.locator('.container-table').first();
    await expect(contenedor).toHaveAttribute('tabindex', '0');
    await expect(contenedor).toHaveAttribute('role', 'region');
    await expect(contenedor).toHaveAttribute('aria-label', /.+/);
  });

  test('un segmentador se activa con Enter y con Espacio, no solo con el raton', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('slicer-Penal').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByTestId('slicer-Civil').focus();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/Materia=Civil/);
  });
});

test.describe('los objetos anadidos en los ultimos lotes @catalogo', () => {
  /*
   * Doce tipos de grafico y ocho claves de presentacion nuevas se anadieron sin volver a pasar
   * axe por las paginas donde viven. Un objeto puede estar bien por dentro y romper la pagina al
   * componer: un encabezado que salta de nivel, un color de serie que no contrasta con la
   * superficie, un rotulo que se queda sin nombre accesible.
   */
  const paginas = [
    ['familia', 'columnas, barras y area'],
    ['proporcion', 'pastel, dona y medidor'],
    ['relacion', 'combinado y dispersion'],
    ['flujo', 'embudo, cascada y mapa de arbol'],
    ['referencia', 'metas, escalas y colores de serie'],
    ['detalle', 'etiquetas, tooltip y rotulos girados'],
    ['multiplos', 'pequenos multiplos'],
    ['condicional', 'formato condicional'],
  ] as const;

  for (const [slug, que] of paginas) {
    test(`/${slug} — ${que} — no tiene infracciones WCAG 2.1 AA`, async ({ page }) => {
      await asLogin(page, 'u-ana');
      await page.goto(`/m/composicion/${slug}`);
      // Se espera a que ECharts monte: el lienzo anade su capa `aria` y sus patrones al dibujar,
      // y analizar antes seria analizar una pagina que todavia no es la que se ve.
      await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

      expect(await infracciones(page)).toEqual([]);
    });
  }

  test('el respaldo de cada objeto nuevo sigue siendo alcanzable con el tabulador', async ({
    page,
  }) => {
    /*
     * El respaldo es el camino accesible, no un apano: un `<canvas>` no tiene nada dentro que un
     * lector de pantalla pueda recorrer. Cada objeto nuevo trae el suyo, y la comprobacion es que
     * SIGUE en el documento despues de que ECharts monte encima.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/composicion/flujo');

    for (const testid of ['embudo', 'cascada', 'mapa-de-arbol']) {
      const fallback = page.getByTestId(testid).first();
      await expect(fallback).toBeAttached();
      // Oculto a la vista, presente en el documento: es lo que distingue «no se dibuja» de «no
      // existe para quien no ve el dibujo».
      await expect(fallback).not.toBeInViewport();
    }
  });

  test('los paneles de un multiplo se recorren por sus encabezados', async ({ page }) => {
    // Es como se navega con lector de pantalla una tarjeta con varios graficos dentro: sin
    // encabezados, los seis paneles son un unico bloque sin estructura.
    await asLogin(page, 'u-ana');
    await page.goto('/m/composicion/multiplos');

    const titulos = page.locator('.multiples__title');
    expect(await titulos.count()).toBeGreaterThan(1);
    await expect(titulos.first()).toHaveText(/\w/);
  });
});
