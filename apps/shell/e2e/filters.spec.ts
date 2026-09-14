import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './instance';
import { asLogin } from './session';

/** Panel de filtros — objeto de categoria `filtro` con varias dimensiones. */

test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('agrupa varias dimensiones en un solo objeto', () => {
  test('cada dimension trae el selector que se le configuro', async ({ page }) => {
    await page.goto('/m/casos-pendientes');

    // Materia con pastillas, distrito con desplegable: el mismo objeto, dos gestos distintos.
    await expect(page.getByTestId('filter-DimTribunal.Materia-Penal')).toBeVisible();
    await expect(page.getByTestId('filter-DimTribunal.Distrito-desplegable')).toBeVisible();
  });

  test('una pastilla se refleja en la URL y recorta el resto del modulo', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('filter-DimTribunal.Materia-Penal').click();

    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('el desplegable ELIGE, no alterna: cambiar deja un solo valor', async ({ page }) => {
    // Con `alternar` en vez de `fijar`, cambiar de distrito habria dejado los dos en la URL y el
    // modulo se habria filtrado por ambos sin que nadie lo pidiera.
    await page.goto('/m/casos-pendientes');
    const desplegable = page.getByTestId('filter-DimTribunal.Distrito-desplegable');

    await desplegable.selectOption('Distrito Norte');
    await expect(page).toHaveURL(/DimTribunal\.Distrito=Distrito\+Norte/);

    const url = new URL(page.url());
    expect(url.searchParams.getAll('DimTribunal.Distrito')).toHaveLength(1);
  });

  test('«Quitar» limpia solo SU dimension, no todo el panel', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('filter-DimTribunal.Materia-Penal').click();
    await page.getByTestId('filter-DimTribunal.Distrito-desplegable').selectOption('Distrito Norte');

    await page.getByTestId('filter-DimTribunal.Materia-limpiar').click();
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

    await page.getByTestId('filter-DimTribunal.Materia-Penal').click();
    await page
      .getByTestId('filter-DimTribunal.Distrito-desplegable')
      .selectOption('Distrito Norte');

    await expect(page).toHaveURL(/DimTribunal\.Distrito=Distrito\+Norte/);
    const url = new URL(page.url());
    expect(url.searchParams.getAll('DimTribunal.Materia')).toEqual(['Penal']);
    expect(url.searchParams.getAll('DimTribunal.Distrito')).toEqual(['Distrito Norte']);
  });

  test('el panel dice cuantos filtros hay puestos', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('filters-panel-puestos-filtros')).toHaveCount(0);

    await page.getByTestId('filter-DimTribunal.Materia-Penal').click();
    await expect(page.getByTestId('filters-panel-puestos-filtros')).toContainText('1 de 2');
  });

  test('la URL con filtros puestos se abre igual en otra pestana', async ({ page, context }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('filter-DimTribunal.Materia-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    const otra = await context.newPage();
    await otra.goto(page.url());
    await expect(otra.getByTestId('filter-DimTribunal.Materia-Penal')).toHaveAttribute(
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

test.describe('las cinco formas de acotar, y no solo «es» (4.4)', () => {
  const MATERIA = 'filter-DimTribunal.Materia';

  test('«no es» excluye, y no es lo mismo que no elegir', async ({ page }) => {
    /*
     * Es la forma que mas se echa de menos y la que no existia: con cinco materias, ver «todas
     * menos una» obligaba a pulsar cuatro pastillas y a acordarse de cual faltaba.
     */
    await page.goto('/m/casos-pendientes');
    await page.getByTestId(`${MATERIA}-modo`).selectOption('excluir');
    await page.getByTestId(`${MATERIA}-Penal`).click();

    await expect(page).toHaveURL(/DimTribunal\.Materia\.no=Penal/);
    // Y acota de verdad: el resto del modulo se queda sin lo penal.
    await expect(page.getByTestId('cell-tabla-detalle')).not.toContainText('Penal');
  });

  test('«contiene» acota por texto, sin distinguir mayusculas', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId(`${MATERIA}-modo`).selectOption('texto');
    await page.getByTestId(`${MATERIA}-contiene`).fill('pen');
    // Al salir del campo: cada tecla reescribiria la URL y volveria a dibujar la pagina.
    await page.getByTestId(`${MATERIA}-contiene`).blur();

    await expect(page).toHaveURL(/DimTribunal\.Materia\.contiene=pen/);
    await expect(page.getByTestId('cell-tabla-detalle')).toContainText('Penal');
    await expect(page.getByTestId('cell-tabla-detalle')).not.toContainText('Civil');
  });

  test('«vacios» distingue lo que tiene valor de lo que no', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId(`${MATERIA}-modo`).selectOption('vacios');
    await page.getByTestId(`${MATERIA}-vacios`).selectOption('si');

    await expect(page).toHaveURL(/DimTribunal\.Materia\.vacio=si/);
    // Ninguna fila tiene la materia en blanco, asi que no queda ninguna: el objeto lo dice en vez
    // de ensenar lo de siempre como si el filtro no estuviera.
    await expect(page.getByTestId('cell-tabla-detalle')).not.toContainText('Penal');
  });

  test('cambiar de forma LIMPIA la anterior', async ({ page }) => {
    // «Es Penal» y «no es Penal» a la vez no devuelve nada, y quien cambio de modo no pidio eso.
    await page.goto('/m/casos-pendientes');
    await page.getByTestId(`${MATERIA}-Penal`).click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);

    await page.getByTestId(`${MATERIA}-modo`).selectOption('excluir');
    await expect(page).not.toHaveURL(/DimTribunal\.Materia=Penal/);
  });

  test('un enlace compartido abre en la forma que trae puesta', async ({ page }) => {
    // Abriendo siempre en «es», quien recibe el enlace veria un filtro de exclusion dibujado como
    // si fuera de inclusion: el mismo control diciendo lo contrario de lo que hace.
    await page.goto('/m/casos-pendientes?DimTribunal.Materia.no=Penal');
    await expect(page.getByTestId(`${MATERIA}-modo`)).toHaveValue('excluir');
    await expect(page.getByTestId(`${MATERIA}-Penal`)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('personalizacion del panel (4.2)', () => {
  test('el recuento dice cuantas filas hay detras de cada valor', async ({ page }) => {
    // Sin el, elegir un valor y encontrarlo vacio es la unica forma de saber que no habia nada.
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('filter-DimTribunal.Materia-Penal')).toContainText('(');
  });

  test('«Todos» y «Ninguno» eligen de una vez', async ({ page }) => {
    // Sobre la materia, que es donde se eligen varios: el distrito es un desplegable y sostiene
    // uno solo, asi que alli los dos botones no podrian hacer lo que dicen.
    await page.goto('/m/casos-pendientes');
    const materia = 'filter-DimTribunal.Materia';

    await page.getByTestId(`${materia}-todos`).click();
    // Se espera al enrutador antes de leer la URL: `replace` no la actualiza de inmediato.
    await expect(page).toHaveURL(/DimTribunal\.Materia=/);
    const url = new URL(page.url());
    expect(url.searchParams.getAll('DimTribunal.Materia').length).toBeGreaterThan(1);

    await page.getByTestId(`${materia}-ninguno`).click();
    await expect(page).not.toHaveURL(/DimTribunal\.Materia=/);
  });
});
