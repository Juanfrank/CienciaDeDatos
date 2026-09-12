import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * El lienzo del editor — seccion 4.2, con la accesibilidad de 4.9.
 *
 * Lo que se comprueba, por encima de que dibuje: que lo que se edita es el modulo y no una
 * representacion suya. Un editor que muestra un formulario obliga a publicar para saber que se ha
 * construido; uno que muestra el modulo, no.
 */

const guardado = async (page: Page) =>
  expect(page.locator('.editor')).toHaveAttribute('data-guardando', 'no');

const nuevoModulo = async (page: Page, slug: string) => {
  await page.goto('/editor');
  await page.getByTestId('nuevo-modulo-nombre').fill(slug);
  await page.getByTestId('nuevo-modulo-slug').fill(slug);
  await page.getByTestId('crear-modulo').click();
  await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();
  await page.goto(`/editor/${slug}`);
};

const idDelBloque = async (page: Page): Promise<string> => {
  const testid = await page
    .locator('[data-testid^="bloque-obj-"]')
    .first()
    .getAttribute('data-testid');
  return (testid ?? '').replace('bloque-', '');
};

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-admin');
});

test.describe('se edita el modulo, no un formulario', () => {
  test('un objeto recien colocado DIBUJA datos reales', async ({ page }) => {
    await nuevoModulo(page, 'lienzo-vivo');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);

    // La cifra sale del cache, ya recortada por el ambito de quien edita. Sin esto, el editor
    // volveria a ser una lista de desplegables y habria que publicar para ver el resultado.
    const id = await idDelBloque(page);
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('kpi-valor')).not.toHaveText('0');
  });

  test('cambiar el mapeo cambia lo dibujado, sin recargar', async ({ page }) => {
    await nuevoModulo(page, 'lienzo-mapeo');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    const valor = page.getByTestId(`bloque-${id}`).getByTestId('kpi-valor');
    const antes = await valor.innerText();

    // Se cambia la medida: otra medida, otra cifra, en el mismo gesto.
    await page.getByTestId(`med-${id}-CasosIngresados`).click();
    await guardado(page);
    await page.getByTestId(`med-${id}-DiasPromedioResolucion`).click();
    await guardado(page);

    await expect(valor).not.toHaveText(antes);
  });

  test('un objeto roto se marca EN EL LIENZO y el resto se sigue editando', async ({ page }) => {
    await nuevoModulo(page, 'lienzo-roto');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // Se quita la unica medida: el contrato exige al menos una.
    await page.getByTestId(`med-${id}-CasosIngresados`).click();
    await guardado(page);

    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toBeVisible();
    await expect(page.getByTestId('editor-bloqueos')).toBeVisible();
    // El panel sigue operativo: se puede deshacer sin recargar ni perder la seleccion.
    await page.getByTestId(`med-${id}-CasosIngresados`).click();
    await guardado(page);
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toHaveCount(0);
  });
});

test.describe('la rejilla es visible y se maneja', () => {
  test('hay doce guias de columna', async ({ page }) => {
    // La rejilla siempre existio; lo que no existia era verla. Doce guias es el contrato de la
    // disposicion guardada, y esta prueba falla si alguien cambia una sin cambiar la otra.
    await nuevoModulo(page, 'lienzo-guias');
    await expect(page.locator('.lienzo__guia')).toHaveCount(12);
  });

  test('ensanchar y mover cambian la posicion, y el lienzo lo refleja', async ({ page }) => {
    await nuevoModulo(page, 'lienzo-mover');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 1–6 de 12');

    await page.getByTestId(`ensanchar-${id}`).click();
    await guardado(page);
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 1–7 de 12');

    await page.getByTestId(`derecha-${id}`).click();
    await guardado(page);
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 2–8 de 12');

    // Y la posicion que se anuncia es la que el bloque ocupa de verdad en la rejilla.
    const columna = await page
      .getByTestId(`bloque-${id}`)
      .evaluate((el) => getComputedStyle(el).gridColumnStart);
    expect(columna).toBe('2');
  });

  test('los botones de borde se apagan en el borde, no guardan algo invalido', async ({ page }) => {
    // Un boton que guarda algo invalido y luego muestra un error hace trabajar a quien edita para
    // descubrir un limite que el editor ya conoce.
    await nuevoModulo(page, 'lienzo-borde');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await expect(page.getByTestId(`izquierda-${id}`)).toBeDisabled();

    for (let i = 0; i < 6; i += 1) {
      await page.getByTestId(`ensanchar-${id}`).click();
      await guardado(page);
    }
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 1–12 de 12');
    await expect(page.getByTestId(`ensanchar-${id}`)).toBeDisabled();
    await expect(page.getByTestId(`derecha-${id}`)).toBeDisabled();
  });

  test('dos objetos de media anchura se colocan UNO AL LADO DEL OTRO', async ({ page }) => {
    // `findFreeSlot` estaba escrito y probado desde que se escribio la rejilla, y no lo llamaba
    // nadie: el editor anterior apilaba al final, asi que esto no pasaba nunca.
    await nuevoModulo(page, 'lienzo-hueco');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    await page.getByTestId('pestana-visualizaciones').click();
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    const filas = await page
      .locator('[data-testid^="bloque-obj-"]')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).gridRowStart));
    expect(filas).toEqual(['1', '1']);
  });
});

test.describe('el panel es la unica tienda, y sus pestanas', () => {
  test('sin nada elegido, Datos y Formato estan deshabilitadas', async ({ page }) => {
    // Deshabilitadas y no ocultas: una barra que cambia de numero de pestanas obliga a volver a
    // buscar donde estaba cada cosa.
    await nuevoModulo(page, 'panel-vacio');
    await expect(page.getByTestId('pestana-visualizaciones')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('pestana-datos')).toBeDisabled();
    await expect(page.getByTestId('pestana-formato')).toBeDisabled();
  });

  test('elegir un bloque en el lienzo abre sus pestanas', async ({ page }) => {
    await nuevoModulo(page, 'panel-elegir');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // Escape deselecciona, como en cualquier editor de bloques.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pestana-datos')).toBeDisabled();
    await expect(page.getByTestId(`elegir-${id}`)).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId(`elegir-${id}`).click();
    await expect(page.getByTestId(`elegir-${id}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pestana-datos')).toHaveAttribute('aria-selected', 'true');
  });

  test('las pestanas se recorren con las flechas', async ({ page }) => {
    // Es lo que distingue una barra de pestanas de tres botones que se parecen: dentro del grupo
    // se navega con flechas y el grupo entero ocupa una parada del tabulador.
    await nuevoModulo(page, 'panel-flechas');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);

    await page.getByTestId('pestana-datos').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('pestana-formato')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('pestana-datos')).toHaveAttribute('aria-selected', 'true');
  });

  test('no hay ninguna caja donde escribir una consulta', async ({ page }) => {
    // La otra mitad del criterio de 4.2 que importa: el catalogo ofrece objetos, no SQL.
    await nuevoModulo(page, 'panel-sin-sql');
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.getByTestId('tienda')).toBeVisible();
  });

  test('el editor no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await nuevoModulo(page, 'panel-axe');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
