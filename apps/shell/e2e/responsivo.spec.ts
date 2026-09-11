import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Diseño responsivo y movil — seccion 4.9.
 *
 * Se comprueba en un navegador real a tres anchos, porque los tres fallos que se corrigieron
 * aqui —el arbol entero por encima del contenido, las cajas altas y vacias en una columna, y la
 * disposicion de escritorio pintada primero en un movil— no se ven en ninguna prueba unitaria.
 */

const MOVIL = { width: 390, height: 844 };
const TABLETA = { width: 820, height: 1180 };
const ESCRITORIO = { width: 1280, height: 900 };

async function entrarComo(page: Page, userId: string) {
  await page.goto('/');
  await page.request.post('/api/sesion/equipo-activo', { data: { userId } });
}

test.describe('la disposicion se adapta al ancho', () => {
  test('en escritorio los objetos se reparten en la rejilla de doce columnas', async ({ page }) => {
    await page.setViewportSize(ESCRITORIO);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // Las dos tarjetas de arriba comparten fila: tienen la misma coordenada vertical.
    const cajas = await page.locator('.rejilla__celda').evaluateAll((celdas) =>
      celdas.map((c) => c.getBoundingClientRect().top),
    );
    expect(cajas[0]).toBe(cajas[1]);
  });

  test('en movil todo se apila en una sola columna', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const cajas = await page.locator('.rejilla__celda').evaluateAll((celdas) =>
      celdas.map((c) => c.getBoundingClientRect()),
    );
    // Ninguna caja comparte fila con otra, y todas tienen el mismo ancho.
    const topes = cajas.map((c) => Math.round(c.top));
    expect(new Set(topes).size).toBe(topes.length);
    expect(new Set(cajas.map((c) => Math.round(c.width))).size).toBe(1);
  });

  test('en movil el alto lo marca el contenido, no el alto guardado', async ({ page }) => {
    // El grafico se guardo con alto 4 para equilibrar la rejilla ancha. Aplicado a una sola
    // columna dejaba una caja alta y medio vacia debajo de tres barras.
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const grafico = page.locator('.rejilla__celda').filter({ hasText: 'Pendientes por distrito' });
    const alto = (await grafico.boundingBox())?.height ?? 0;
    expect(alto).toBeLessThan(280);
  });

  test('la disposicion correcta esta en el PRIMER pintado, sin esperar al JavaScript', async ({
    browser,
  }) => {
    // Con JavaScript desactivado la pagina tiene que salir ya dispuesta para movil: antes se
    // medía la ventana al montar y se pintaba primero la disposicion de escritorio.
    const contexto = await browser.newContext({ viewport: MOVIL, javaScriptEnabled: false });
    const pagina = await contexto.newPage();
    await pagina.goto('/m/casos-pendientes');

    const anchos = await pagina.locator('.rejilla__celda').evaluateAll((celdas) =>
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
    const titulo = await page.getByTestId('titulo-modulo').boundingBox();
    expect(titulo?.y ?? 9999).toBeLessThan(MOVIL.height);
  });

  test('al desplegarlo aparece el arbol completo y se puede navegar', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('abrir-navegacion').click();
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();

    await page.getByTestId('nav-audiencias').click();
    await expect(page.getByTestId('titulo-modulo')).toHaveText('Audiencias');
  });

  test('en escritorio no hay nada que plegar: el arbol esta siempre visible', async ({ page }) => {
    // El plegado se apaga con una media query, no con JavaScript. Esta prueba es la que
    // comprueba que esa anulacion funciona de verdad en un navegador.
    await page.setViewportSize(ESCRITORIO);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await expect(page.getByTestId('abrir-navegacion')).not.toBeVisible();
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();
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
      await page.setViewportSize(tamano);
      await entrarComo(page, 'u-ana');
      await page.goto('/m/casos-pendientes');

      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(desborda).toBe(false);
    });
  }

  test('la tabla ancha se desplaza dentro de su region, no arrastra la pagina', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const contenedor = page.locator('.tabla-contenedor').last();
    const desplazable = await contenedor.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(desplazable).toBe(true);
  });

  test('el panel de administracion tampoco desborda en movil', async ({ page }) => {
    await page.setViewportSize(MOVIL);
    await entrarComo(page, 'u-admin');
    await page.goto('/admin/equipos');

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(desborda).toBe(false);
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

    const resumen = page.getByTestId('abrir-navegacion');
    await resumen.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();

    // `<details>` expone el estado por si mismo; es la razon de usarlo en vez de un div y estado.
    expect(await resumen.evaluate((el) => el.parentElement?.hasAttribute('open'))).toBe(true);
  });
});
