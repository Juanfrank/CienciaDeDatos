import { expect, test, type Page } from '@playwright/test';

/**
 * Objetos adjuntados: tooltip explicativo y tabla de datos emergente.
 *
 * No son objetos independientes — no ocupan celda en la rejilla y no se enlazan contra ningun
 * dataset: leen el de su anfitrion, que ya viene filtrado por el ambito de quien mira. Eso
 * ultimo es lo que estas pruebas vigilan mas de cerca: un complemento no puede convertirse en
 * una via para ver filas que la persona no podria ver de otro modo.
 */

async function entrarComo(page: Page, userId: string) {
  await page.goto('/');
  await page.request.post('/api/sesion/equipo-activo', { data: { userId } });
}

test.describe('tooltip explicativo', () => {
  test('aparece al posar el puntero y explica el objeto entero', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const tooltip = page.getByTestId('tooltip-Pendientes por distrito');
    await expect(tooltip).toHaveCount(0);

    await page.getByTestId('tooltip-icono-Pendientes por distrito').hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('agrega los cuatro trimestres');
  });

  test('aparece tambien al enfocar con teclado y se cierra con Escape (WCAG 1.4.13)', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('tooltip-icono-Casos pendientes').focus();
    await expect(page.getByTestId('tooltip-Casos pendientes')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tooltip-Casos pendientes')).toHaveCount(0);
  });

  test('el icono queda descrito por el tooltip mientras esta visible', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const icono = page.getByTestId('tooltip-icono-Casos pendientes');
    await expect(icono).not.toHaveAttribute('aria-describedby', /.+/);

    await icono.hover();
    await expect(icono).toHaveAttribute('aria-describedby', /.+/);
  });
});

test.describe('tabla de datos con alcance de objeto', () => {
  test('muestra las filas de origen del objeto, sin agregar', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('tabla-datos-abrir-Casos pendientes').click();
    const emergente = page.getByTestId('tabla-datos-Casos pendientes');
    await expect(emergente).toBeVisible();

    // La tarjeta muestra UN numero; su tabla de origen muestra las filas que lo componen, con
    // el trimestre que la tarjeta agrego y dejo de ensenar.
    await expect(emergente.getByTestId('tabla-datos-filas')).toContainText('DimTiempo.Trimestre');
    await expect(emergente.getByTestId('tabla-datos-resumen')).toContainText('fila(s) de origen');
  });

  test('se cierra con Escape, como cualquier dialogo modal', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('tabla-datos-abrir-Casos pendientes').click();
    await expect(page.getByTestId('tabla-datos-Casos pendientes')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tabla-datos-Casos pendientes')).not.toBeVisible();
  });
});

test.describe('tabla de datos con alcance de subobjeto', () => {
  test('lista las categorias y desglosa las filas detras de una cifra concreta', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('tabla-datos-abrir-Pendientes por distrito').click();
    const emergente = page.getByTestId('tabla-datos-Pendientes por distrito');
    await expect(emergente).toContainText('Elija una categoria');

    await emergente.getByTestId('desglosar-Distrito Norte').click();
    await expect(emergente.getByTestId('tabla-datos-resumen')).toContainText(
      'detras de Distrito Norte',
    );

    // Las filas desglosadas son SOLO las de esa categoria, con su granularidad completa.
    const filas = emergente.getByTestId('tabla-datos-filas');
    await expect(filas).toContainText('Distrito Norte');
    await expect(filas).not.toContainText('Distrito Este');
  });

  test('se puede volver a las categorias sin cerrar el emergente', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('tabla-datos-abrir-Pendientes por distrito').click();
    const emergente = page.getByTestId('tabla-datos-Pendientes por distrito');
    await emergente.getByTestId('desglosar-Distrito Norte').click();
    await emergente.getByTestId('tabla-datos-volver').click();

    await expect(emergente).toContainText('Elija una categoria');
  });
});

test.describe('un complemento no amplia lo que se puede ver (principio 5)', () => {
  test('el desglose solo alcanza las filas del ambito de quien mira', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('tabla-datos-abrir-Casos pendientes').click();
    const filas = page.getByTestId('tabla-datos-Casos pendientes').getByTestId('tabla-datos-filas');

    // El emergente lee el mismo dataset que el objeto, que llego al navegador ya filtrado en el
    // servidor. La restriccion por la que se aserta es la de DISTRITO y no la de materia: las
    // pruebas del panel de administracion corren antes en la misma sesion de servidor y amplian
    // deliberadamente el ambito de materia del equipo Norte, asi que asertar sobre ella seria
    // asertar sobre lo que otra prueba acaba de cambiar.
    await expect(filas).toContainText('Distrito Norte');
    await expect(filas).not.toContainText('Distrito Este');
  });

  test('un filtro activo tambien acota el emergente: ensena lo que se esta viendo', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');

    await page.getByTestId('tabla-datos-abrir-Casos pendientes').click();
    const filas = page.getByTestId('tabla-datos-Casos pendientes').getByTestId('tabla-datos-filas');

    await expect(filas).toContainText('Penal');
    await expect(filas).not.toContainText('Civil');
    await expect(filas).not.toContainText('Distrito Este');
  });
});
