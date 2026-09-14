import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './instancia';
import { entrarComo } from './session';

/** Diseño responsivo y movil — seccion 4.9. */

const MOVIL = { width: 390, height: 844 };
const TABLETA = { width: 820, height: 1180 };
const ESCRITORIO = { width: 1280, height: 900 };

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('la disposicion se adapta al ancho', () => {
  test('en escritorio los objetos se reparten en la rejilla de doce columnas', async ({ page }) => {
    await page.setViewportSize(ESCRITORIO);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // Las dos tarjetas de arriba comparten fila: tienen la misma coordenada vertical.
    const cajas = await page.locator('.grid__cell').evaluateAll((celdas) =>
      celdas.map((c) => c.getBoundingClientRect().top),
    );
    expect(cajas[0]).toBe(cajas[1]);
  });

  test('en movil todo se apila en una sola columna', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const cajas = await page.locator('.grid__cell').evaluateAll((celdas) =>
      celdas.map((c) => c.getBoundingClientRect()),
    );
    // Ninguna caja comparte fila con otra, y todas tienen el mismo ancho.
    const topes = cajas.map((c) => Math.round(c.top));
    expect(new Set(topes).size).toBe(topes.length);
    expect(new Set(cajas.map((c) => Math.round(c.width))).size).toBe(1);

    /*
     * Y ese ancho es el de la REJILLA, no un doceavo.
     */
    const rejilla = await page
      .locator('.rejilla')
      .evaluate((n) => Math.round(n.getBoundingClientRect().width));
    expect(Math.round(cajas[0]?.width ?? 0)).toBe(rejilla);
  });

  test('en movil el alto lo marca el contenido, no el alto guardado', async ({ page }) => {
    // El grafico se guardo con alto 4 para equilibrar la rejilla ancha. Aplicado a una sola
    // columna dejaba una caja alta y medio vacia debajo de tres barras.
    //
    // Se comprueba el MECANISMO y no una cifra. Antes era `alto < 280 px`, y ese numero
    // dependia del tamano de la tipografia: al adoptar Material Design 3, con su escala y su
    // espaciado mayores, el mismo objeto —igual de lleno— paso a medir 317 y la prueba fallo
    // sin que nada se hubiera roto. Un umbral absoluto sobre una medida de pantalla envejece
    // con el primer cambio de diseno.
    await entrarComo(page, 'u-ana');

    const cell = () =>
      page.locator('.grid__cell').filter({ hasText: 'Pendientes por distrito' });

    await page.setViewportSize(ESCRITORIO);
    await page.goto('/m/casos-pendientes');
    // En escritorio SI manda el alto guardado: son cuatro filas de rejilla.
    expect(
      await cell().evaluate((el) => getComputedStyle(el).gridRow),
      'en escritorio la celda ocupa las filas que se guardaron',
    ).toContain('span');

    await page.setViewportSize(MOVIL);
    await page.goto('/m/casos-pendientes');

    // En una sola columna la celda pasa a `auto`: la altura la pone lo que hay dentro.
    expect(await cell().evaluate((el) => getComputedStyle(el).gridRow)).toBe('auto');

    // Y lo que hay dentro la llena. NO se compara con el alto de escritorio: en una columna
    // estrecha las etiquetas se parten y el contenido ocupa MAS, legitimamente. Lo que la caja
    // no puede tener es hueco sobrante, que era el defecto original.
    const sobrante = await cell().evaluate((el) => {
      const alto = el.getBoundingClientRect().height;
      const contenido = [...el.children].reduce((total, hijo) => {
        const box = hijo.getBoundingClientRect();
        return total + box.height;
      }, 0);
      return alto - contenido;
    });
    expect(sobrante).toBeLessThan(8);
  });

  test('la disposicion correcta esta en el PRIMER pintado, sin esperar al JavaScript', async ({
    browser,
  }) => {
    // Con JavaScript desactivado la pagina tiene que salir ya dispuesta para movil: antes se
    // medía la ventana al montar y se pintaba primero la disposicion de escritorio.
    const contexto = await browser.newContext({ viewport: MOVIL, javaScriptEnabled: false });
    const pagina = await contexto.newPage();
    // Contexto nuevo: no hereda la sesion del beforeEach, que va contra otro contexto.
    await entrarComo(pagina, 'u-ana');
    await pagina.goto('/m/casos-pendientes');

    const anchos = await pagina.locator('.grid__cell').evaluateAll((celdas) =>
      celdas.map((c) => Math.round(c.getBoundingClientRect().width)),
    );
    expect(new Set(anchos).size).toBe(1);
    await contexto.close();
  });
});

test.describe('la navegacion no se interpone en un movil', () => {
  test('en movil el arbol viene plegado y el modulo esta arriba del todo', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await expect(page.getByTestId('abrir-navegacion')).toBeVisible();
    await expect(page.getByTestId('nav-audiencias')).not.toBeVisible();

    // Lo que se venia a ver tiene que estar a la vista sin desplazarse.
    const titulo = await page.getByTestId('module-title').boundingBox();
    expect(titulo?.y ?? 9999).toBeLessThan(MOVIL.height);
  });

  test('al desplegarlo aparece el arbol completo y se puede navegar', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('abrir-navegacion').click();
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();

    await page.getByTestId('nav-audiencias').click();
    await expect(page.getByTestId('module-title')).toHaveText('Audiencias');
  });

  test('en escritorio el arbol viene desplegado, y el boton lo pliega', async ({ page }) => {
    // El ancho ya no decide si SE PUEDE plegar, solo como empieza. El boton esta a cualquier
    // ancho, porque en una pantalla ancha tambien hay motivos para querer el modulo entero.
    await page.setViewportSize(ESCRITORIO);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const button = page.getByTestId('abrir-navegacion');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('nav-audiencias')).not.toBeVisible();
  });

  test('lo que se pliega a mano NO lo vuelve a abrir un cambio de tamano', async ({ page }) => {
    // Cualquier `change` de la media query reabria el panel recien cerrado, y no hace falta
    // cruzar el umbral para que llegue uno. Se veia como un boton que no funciona, porque el
    // panel volvia solo unas decimas despues.
    await page.setViewportSize(ESCRITORIO);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('abrir-navegacion').click();
    await expect(page.getByTestId('nav-audiencias')).not.toBeVisible();

    await page.setViewportSize(TABLETA);
    await expect(page.getByTestId('nav-audiencias')).not.toBeVisible();
    await expect(page.getByTestId('abrir-navegacion')).toHaveAttribute('aria-expanded', 'false');
  });

  test('en tableta tambien se mantiene visible', async ({ page }) => {
    await page.setViewportSize(TABLETA);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();
  });
});

test.describe('nada se sale de la pantalla', () => {
  for (const [nombre, tamano] of [
    ['movil', MOVIL],
    ['tableta', TABLETA],
  ] as const) {
    test(`en ${nombre} no hay desplazamiento horizontal de pagina`, async ({ page }) => {
      // Una pagina que se desplaza en horizontal en un movil es el sintoma clasico de un ancho
      // fijo olvidado. Las tablas SI se desplazan, pero dentro de su propia region.
      //
      // Se recorren TODAS las superficies y no solo un modulo: esta prueba miraba /m y /admin, y
      // el editor —que llego despues— desbordaba por la columna de acciones de su tabla sin que
      // nada lo detectara. Una lista es mas facil de ampliar que de recordar.
      await page.setViewportSize(tamano);
      await entrarComo(page, 'u-ana');

      for (const path of ['/m/casos-pendientes', '/editor', '/avisos']) {
        await page.goto(path);
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(overflows, `${path} desborda en horizontal`).toBe(false);
      }
    });
  }

  test('la tabla ancha se desplaza dentro de su region, no arrastra la pagina', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const contenedor = page.locator('.container-table').last();
    const scrollable = await contenedor.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrollable).toBe(true);
  });

  test('la tabla del editor tambien se desplaza dentro de su region', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/editor');

    const contenedor = page.locator('.table-container-data').first();
    expect(await contenedor.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });

  test('el panel de administracion tampoco desborda en movil', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-admin');
    await page.goto('/admin/equipos');

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});

test.describe('accesibilidad en movil (4.9)', () => {
  test('un modulo en movil no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    // La accesibilidad se comprueba TAMBIEN a este ancho: al plegar y reordenar aparecen
    // problemas que no existen en escritorio.
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('el arbol plegado se abre con teclado y anuncia su estado', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const button = page.getByTestId('abrir-navegacion');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();

    // El estado se anuncia con `aria-expanded` sobre el boton, y `aria-controls` dice QUE panel
    // abre. Los dos tienen que moverse juntos: un boton que dice «desplegado» sobre un panel
    // oculto es peor que ninguno.
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toHaveAttribute('aria-controls', 'navegacion-lateral');
  });
});

test.describe('las paginas de objetos nuevos, en un movil', () => {
  /*
   * Doce tipos de grafico y los pequenos multiplos se disenaron y se revisaron a 1500 px. A 390
   * los problemas son otros: una rejilla de paneles que no cabe, un objeto mas ancho que la
   * pantalla, un rotulo girado que empuja el area de dibujo hasta dejarla sin alto.
   */
  const paginas = [
    'familia',
    'proporcion',
    'relacion',
    'flujo',
    'referencia',
    'detalle',
    'multiplos',
    'condicional',
  ];

  for (const slug of paginas) {
    test(`/${slug} no desborda a lo ancho`, async ({ page }) => {
      await page.setViewportSize(MOVIL);
      await entrarComo(page, 'u-ana');
      await page.goto(`/m/composicion/${slug}`);
      await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

      /*
       * El documento no se desplaza a lo ancho.
       */
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows, 'la pagina se desplaza a lo ancho').toBe(false);

      // Y ninguna tarjeta se sale de su columna.
      const maxWidth = await page.locator('.objeto').evaluateAll((nodos) =>
        Math.max(0, ...nodos.map((n) => n.getBoundingClientRect().right)),
      );
      expect(maxWidth).toBeLessThanOrEqual(MOVIL.width + 1);
    });
  }

  test('un multiplo se apila en una sola columna cuando no caben dos', async ({ page }) => {
    /*
     * `columnsFor` elige la rejilla mas cuadrada por el NUMERO de paneles, sin saber cuanto
     * ancho hay. En un movil, dos columnas dejan cada panel en 170 px: un grafico donde no cabe
     * ni el rotulo del eje.
     */
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/composicion/multiplos');
    await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

    const izquierdas = await page.locator('.multiples__panel').evaluateAll((nodos) =>
      nodos.map((n) => Math.round(n.getBoundingClientRect().left)),
    );
    expect(new Set(izquierdas).size).toBe(1);
  });
});
