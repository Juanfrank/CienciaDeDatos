import { expect, test } from './instance';
import { asLogin } from './session';

/** Objetos adjuntados: tooltip explicativo y tabla de datos emergente. */

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('tooltip explicativo', () => {
  test('aparece al posar el puntero y explica el objeto entero', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const tooltip = page.getByTestId('tooltip-Pendientes por distrito');
    await expect(tooltip).toHaveCount(0);

    await page.getByTestId('icon-tooltip-Pendientes por distrito').hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('agrega los cuatro trimestres');
  });

  test('aparece tambien al enfocar con teclado y se cierra con Escape (WCAG 1.4.13)', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('icon-tooltip-Casos pendientes').focus();
    await expect(page.getByTestId('tooltip-Casos pendientes')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tooltip-Casos pendientes')).toHaveCount(0);
  });

  test('el icono queda descrito por el tooltip mientras esta visible', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const icono = page.getByTestId('icon-tooltip-Casos pendientes');
    await expect(icono).not.toHaveAttribute('aria-describedby', /.+/);

    await icono.hover();
    await expect(icono).toHaveAttribute('aria-describedby', /.+/);
  });
});

test.describe('tabla de datos con alcance de objeto', () => {
  test('muestra las filas de origen del objeto, sin agregar', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('data-table-open-Casos pendientes').click();
    const popover = page.getByTestId('data-table-Casos pendientes');
    await expect(popover).toBeVisible();

    // La tarjeta muestra UN numero; su tabla de origen muestra las filas que lo componen, con
    // el trimestre que la tarjeta agrego y dejo de ensenar.
    await expect(popover.getByTestId('table-data-rows')).toContainText('DimTiempo.Trimestre');
    await expect(popover.getByTestId('data-table-resumen')).toContainText('fila(s) de origen');
  });

  test('se cierra con Escape, como cualquier dialogo modal', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('data-table-open-Casos pendientes').click();
    await expect(page.getByTestId('data-table-Casos pendientes')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('data-table-Casos pendientes')).not.toBeVisible();
  });
});

test.describe('tabla de datos con alcance de subobjeto', () => {
  test('lista las categorias y desglosa las filas detras de una cifra concreta', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('data-table-open-Pendientes por distrito').click();
    const popover = page.getByTestId('data-table-Pendientes por distrito');
    await expect(popover).toContainText('Elija una categoria');

    await popover.getByTestId('drill-Distrito Norte').click();
    await expect(popover.getByTestId('data-table-resumen')).toContainText(
      'detras de Distrito Norte',
    );

    // Las filas desglosadas son SOLO las de esa categoria, con su granularidad completa.
    const dataRows = popover.getByTestId('table-data-rows');
    await expect(dataRows).toContainText('Distrito Norte');
    await expect(dataRows).not.toContainText('Distrito Este');
  });

  test('se puede volver a las categorias sin cerrar el emergente', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('data-table-open-Pendientes por distrito').click();
    const popover = page.getByTestId('data-table-Pendientes por distrito');
    await popover.getByTestId('drill-Distrito Norte').click();
    await popover.getByTestId('data-table-volver').click();

    await expect(popover).toContainText('Elija una categoria');
  });
});

test.describe('un complemento no amplia lo que se puede ver (principio 5)', () => {
  test('el desglose solo alcanza las filas del ambito de quien mira', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('data-table-open-Casos pendientes').click();
    const dataRows = page.getByTestId('data-table-Casos pendientes').getByTestId('table-data-rows');

    // El emergente lee el mismo dataset que el objeto, que llego al navegador ya filtrado en el
    // servidor. La restriccion por la que se aserta es la de DISTRITO y no la de materia: las
    // pruebas del panel de administracion corren antes en la misma sesion de servidor y amplian
    // deliberadamente el ambito de materia del equipo Norte, asi que asertar sobre ella seria
    // asertar sobre lo que otra prueba acaba de cambiar.
    await expect(dataRows).toContainText('Distrito Norte');
    await expect(dataRows).not.toContainText('Distrito Este');
  });

  test('un filtro activo tambien acota el emergente: ensena lo que se esta viendo', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');

    await page.getByTestId('data-table-open-Casos pendientes').click();
    const dataRows = page.getByTestId('data-table-Casos pendientes').getByTestId('table-data-rows');

    await expect(dataRows).toContainText('Penal');
    await expect(dataRows).not.toContainText('Civil');
    await expect(dataRows).not.toContainText('Distrito Este');
  });
});

test.describe('donde se coloca el tooltip', () => {
  test('sale PEGADO a su icono, y nunca sobre la cifra que explica', async ({ page }) => {
    /*
     * Las dos mitades de la regla, juntas, porque cada una sola admite la version rota de la otra.
     *
     * Caia hacia abajo desde el icono, o sea justo sobre el contenido: para leer que significaba
     * la cifra habia que tapar la cifra. La primera version de esta prueba lo arreglo exigiendo
     * que no tocara la tarjeta ENTERA, y eso lo mandaba al otro extremo de la pantalla —encima del
     * arbol de navegacion— cuando la tarjeta estaba a la derecha. Un globo a medio metro de su
     * icono deja de leerse como su explicacion.
     *
     * Lo que no se puede tapar es el CUERPO, que es donde esta el dato. El encabezado es el titulo
     * y los iconos, y apoyarse en esa franja no esconde ningun numero.
     */
    await page.goto('/m/casos-pendientes');
    const icono = page.locator('.addon__icon').first();
    await icono.hover();
    await expect(page.getByRole('tooltip').first()).toBeVisible();

    const medidas = await page.evaluate(() => {
      const globo = document.querySelector('[role="tooltip"]')?.getBoundingClientRect();
      const boton = document.querySelector('.addon__icon')?.getBoundingClientRect();
      const cuerpo = document.querySelector('.object__body')?.getBoundingClientRect();
      if (!globo || !boton || !cuerpo) return null;
      return {
        // Lo que separa el globo del icono que lo abrio, en los dos ejes.
        lejosX: Math.max(boton.left - globo.right, globo.left - boton.right, 0),
        lejosY: Math.max(boton.top - globo.bottom, globo.top - boton.bottom, 0),
        tapaCuerpo: !(
          globo.right <= cuerpo.left ||
          globo.left >= cuerpo.right ||
          globo.bottom <= cuerpo.top ||
          globo.top >= cuerpo.bottom
        ),
      };
    });

    // Adyacente: a un hueco de distancia, no a un panel de distancia.
    expect(medidas?.lejosX).toBeLessThanOrEqual(16);
    expect(medidas?.lejosY).toBeLessThanOrEqual(16);
    expect(medidas?.tapaCuerpo).toBe(false);
  });

  test('se descarta con Escape, sin mover el puntero (1.4.13)', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.locator('.addon__icon').first().hover();
    await expect(page.getByRole('tooltip').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});
