import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './instancia';
import { entrarComo } from './session';

/** Panel de filtros — objeto de categoria `filtro` con varias dimensiones. */

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('agrupa varias dimensiones en un solo objeto', () => {
  test('cada dimension trae el selector que se le configuro', async ({ page }) => {
    await page.goto('/m/casos-pendientes');

    // Materia con pastillas, distrito con desplegable: el mismo objeto, dos gestos distintos.
    await expect(page.getByTestId('filtro-DimTribunal.Materia-Penal')).toBeVisible();
    await expect(page.getByTestId('filtro-DimTribunal.Distrito-desplegable')).toBeVisible();
  });

  test('una pastilla se refleja en la URL y recorta el resto del modulo', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('filtro-DimTribunal.Materia-Penal').click();

    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('el desplegable ELIGE, no alterna: cambiar deja un solo valor', async ({ page }) => {
    // Con `alternar` en vez de `fijar`, cambiar de distrito habria dejado los dos en la URL y el
    // modulo se habria filtrado por ambos sin que nadie lo pidiera.
    await page.goto('/m/casos-pendientes');
    const desplegable = page.getByTestId('filtro-DimTribunal.Distrito-desplegable');

    await desplegable.selectOption('Distrito Norte');
    await expect(page).toHaveURL(/DimTribunal\.Distrito=Distrito\+Norte/);

    const url = new URL(page.url());
    expect(url.searchParams.getAll('DimTribunal.Distrito')).toHaveLength(1);
  });

  test('«Quitar» limpia solo SU dimension, no todo el panel', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('filtro-DimTribunal.Materia-Penal').click();
    await page.getByTestId('filtro-DimTribunal.Distrito-desplegable').selectOption('Distrito Norte');

    await page.getByTestId('filtro-DimTribunal.Materia-limpiar').click();
    // Se espera al enrutador antes de leer la URL: `replace` no la actualiza de inmediato, y
    // leerla justo despues del clic mide el estado anterior.
    await expect(page).not.toHaveURL(/Materia=Penal/);

    const url = new URL(page.url());
    expect(url.searchParams.getAll('DimTribunal.Materia')).toEqual([]);
    expect(url.searchParams.getAll('DimTribunal.Distrito')).toEqual(['Distrito Norte']);
  });

  test('dos gestos seguidos no se pisan', async ({ page }) => {
    /*
     * Esta es la prueba del defecto real que destapo el panel.
     */
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('filtro-DimTribunal.Materia-Penal').click();
    await page
      .getByTestId('filtro-DimTribunal.Distrito-desplegable')
      .selectOption('Distrito Norte');

    await expect(page).toHaveURL(/DimTribunal\.Distrito=Distrito\+Norte/);
    const url = new URL(page.url());
    expect(url.searchParams.getAll('DimTribunal.Materia')).toEqual(['Penal']);
    expect(url.searchParams.getAll('DimTribunal.Distrito')).toEqual(['Distrito Norte']);
  });

  test('el panel dice cuantos filtros hay puestos', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('filters-panel-puestos-filtros')).toHaveCount(0);

    await page.getByTestId('filtro-DimTribunal.Materia-Penal').click();
    await expect(page.getByTestId('filters-panel-puestos-filtros')).toContainText('1 de 2');
  });

  test('la URL con filtros puestos se abre igual en otra pestana', async ({ page, context }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('filtro-DimTribunal.Materia-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    const otra = await context.newPage();
    await otra.goto(page.url());
    await expect(otra.getByTestId('filtro-DimTribunal.Materia-Penal')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await otra.close();
  });

  test('no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    // Seis tipos de control en una rejilla es justo donde se pierden las etiquetas: un `fieldset`
    // sin `legend`, un `<select>` sin nombre, un campo de busqueda que parece un filtro mas.
    await page.goto('/m/casos-pendientes');
    const { violations } = await new AxeBuilder({ page })
      .include('[data-testid="filters-panel-filtros"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
