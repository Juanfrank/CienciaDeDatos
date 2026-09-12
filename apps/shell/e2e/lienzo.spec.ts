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

    // Se cambia la medida desde su pozo: otra medida, otra cifra, en el mismo gesto.
    await page.getByTestId(`pozo-${id}-valor-quitar-CasosIngresados`).click();
    await guardado(page);
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-DiasPromedioResolucion`).click();
    await guardado(page);

    await expect(valor).not.toHaveText(antes);
  });

  test('un objeto roto se marca EN EL LIENZO y el resto se sigue editando', async ({ page }) => {
    await nuevoModulo(page, 'lienzo-roto');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // Se quita la unica medida: el contrato exige al menos una.
    await page.getByTestId(`pozo-${id}-valor-quitar-CasosIngresados`).click();
    await guardado(page);

    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toBeVisible();
    await expect(page.getByTestId('editor-bloqueos')).toBeVisible();
    // El panel sigue operativo: se puede deshacer sin recargar ni perder la seleccion.
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-CasosIngresados`).click();
    await guardado(page);
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toHaveCount(0);
  });
});

test.describe('la rejilla es visible y se maneja', () => {
  test('las guias son doce por fila, no solo doce rayas verticales', async ({ page }) => {
    /*
     * La rejilla siempre existio; lo que no existia era verla. Y la primera version dibujaba una
     * franja por columna con borde solo a los lados: se veian las verticales y ninguna horizontal,
     * asi que parecia una rejilla de doce columnas y altura libre. No lo es — la posicion lleva `y`
     * y `h`— y sin las horizontales no hay forma de ver cuantas filas ocupa un bloque.
     */
    await nuevoModulo(page, 'lienzo-guias');
    const guias = await page.locator('.lienzo__guia').count();
    expect(guias % 12).toBe(0);
    expect(guias).toBeGreaterThan(12);

    const bordes = await page
      .locator('.lienzo__guia')
      .first()
      .evaluate((el) => {
        const e = getComputedStyle(el);
        return [e.borderTopStyle, e.borderRightStyle, e.borderBottomStyle, e.borderLeftStyle];
      });
    expect(bordes).toEqual(['dashed', 'dashed', 'dashed', 'dashed']);
  });

  test('ensanchar y mover cambian la posicion, y el lienzo lo refleja', async ({ page }) => {
    await nuevoModulo(page, 'lienzo-mover');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);
    await page.getByTestId('pestana-formato').click();

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
    await page.getByTestId('pestana-formato').click();

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

test.describe('los pozos de campos', () => {
  test('un grafico de barras pide eje X, serie y eje Y por su nombre', async ({ page }) => {
    // «Dimension 1» y «dimension 2» no dicen nada: la primera reparte las barras y la segunda las
    // agrupa en series. Quien construye un modulo piensa en ejes, no en indices de un array.
    await nuevoModulo(page, 'pozos-barras');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await expect(page.getByTestId(`pozo-${id}-eje-x`)).toContainText('Eje X');
    await expect(page.getByTestId(`pozo-${id}-serie`)).toContainText('Serie');
    await expect(page.getByTestId(`pozo-${id}-eje-y`)).toContainText('Eje Y');
  });

  test('un campo anadido a un pozo entra en SU tramo, no al final', async ({ page }) => {
    /*
     * Es el fallo que no se ve hasta que alguien lo usa: con la insercion al final del array, un
     * campo puesto en «Eje X» acabaria detras del de «Serie» y el grafico agruparia por lo que
     * deberia repartir.
     */
    await nuevoModulo(page, 'pozos-orden');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // El eje X viene con una dimension; se anade otra a «Serie».
    await page.getByTestId(`pozo-${id}-serie-anadir`).click();
    await page.getByTestId(`pozo-${id}-serie-opcion-DimTribunal.Materia`).click();
    await guardado(page);

    await expect(page.getByTestId(`pozo-${id}-eje-x`)).toContainText('DimTribunal.Distrito');
    await expect(page.getByTestId(`pozo-${id}-serie`)).toContainText('DimTribunal.Materia');
  });

  test('el buscador filtra, y un pozo lleno ya no ofrece anadir', async ({ page }) => {
    await nuevoModulo(page, 'pozos-buscar');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`pozo-${id}-serie-anadir`).click();
    await page.getByTestId(`pozo-${id}-serie-buscar`).fill('Materia');
    await expect(page.getByTestId(`pozo-${id}-serie-opcion-DimTribunal.Materia`)).toBeVisible();
    await expect(page.getByTestId(`pozo-${id}-serie-opcion-DimTiempo.Trimestre`)).toHaveCount(0);

    await page.getByTestId(`pozo-${id}-serie-opcion-DimTribunal.Materia`).click();
    await guardado(page);
    // Cupo 1/1: el `+` se apaga, pero el chiclet se sigue pudiendo quitar.
    await expect(page.getByTestId(`pozo-${id}-serie-anadir`)).toBeDisabled();
    await expect(
      page.getByTestId(`pozo-${id}-serie-quitar-DimTribunal.Materia`),
    ).toBeEnabled();
  });

  test('Escape cierra el buscador y NO deselecciona el objeto', async ({ page }) => {
    /*
     * El editor tiene su propio Escape, que deselecciona. Con los dos escuchando en `document`,
     * cerrar el buscador deseleccionaba ademas el objeto y el panel entero se iba a la tienda: se
     * perdia justo lo que se estaba configurando.
     */
    await nuevoModulo(page, 'pozos-escape');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`pozo-${id}-serie-anadir`).click();
    await expect(page.getByTestId(`pozo-${id}-serie-buscar`)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId(`pozo-${id}-serie-buscar`)).toHaveCount(0);
    // El objeto sigue elegido: la capa de dentro se cierra, la de fuera no se entera.
    await expect(page.getByTestId('pestana-datos')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`elegir-${id}`)).toHaveAttribute('aria-pressed', 'true');

    // Y un segundo Escape, ya sin emergente, si deselecciona.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pestana-datos')).toBeDisabled();
  });

  test('quitar un chiclet quita el campo del mapeo', async ({ page }) => {
    await nuevoModulo(page, 'pozos-quitar');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`pozo-${id}-eje-x-quitar-DimTribunal.Distrito`).click();
    await guardado(page);

    await expect(page.getByTestId(`pozo-${id}-eje-x`)).toContainText('0/1');
    // Sin dimension, el objeto incumple su contrato y se marca roto: se ve en el acto.
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toBeVisible();
  });
});

test.describe('secciones, complementos y pestanas', () => {
  test('tamano y posicion vive en Formato, no en Datos', async ({ page }) => {
    // Cuanto ocupa un objeto en la rejilla no cambia lo que mide: es como se ve.
    await nuevoModulo(page, 'sec-tamano');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await expect(page.getByTestId(`posicion-${id}`)).toHaveCount(0);
    await page.getByTestId('pestana-formato').click();
    await expect(page.getByTestId(`seccion-tamano-${id}`)).toBeVisible();
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 1–6 de 12');
  });

  test('las secciones se pliegan y se despliegan', async ({ page }) => {
    await nuevoModulo(page, 'sec-plegar');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    const campos = page.getByTestId(`seccion-campos-${id}`);
    await expect(campos).toHaveAttribute('open', '');
    await campos.locator('summary').click();
    await expect(campos).not.toHaveAttribute('open', '');
  });

  test('se puede adjuntar un tooltip desde el editor', async ({ page }) => {
    /*
     * Los objetos adjuntables estaban en el catalogo y en el modelo desde F3.4, con su validacion
     * y sus pruebas, y no habia forma de anadir uno desde el editor: los del seed se escribieron a
     * mano.
     */
    await nuevoModulo(page, 'sec-adjunto');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId('pestana-complementos').click();
    await expect(page.getByTestId(`sin-complementos-${id}`)).toBeVisible();

    await page.getByTestId(`adjuntar-tooltip-explicativo-${id}`).click();
    await guardado(page);

    // Nace con texto: un tooltip vacio no es nada y la validacion lo rechaza.
    await expect(page.getByTestId(`texto-${id}`)).not.toHaveValue('');
    await expect(page.getByTestId('editor-sin-bloqueos')).toBeVisible();
    // Y se dibuja en el lienzo, que es donde se comprueba que sirve de algo.
    await expect(page.getByTestId(`bloque-${id}`).locator('.complemento__icono')).toHaveCount(1);
    // Uno de cada tipo: dos tooltips se dibujarian uno encima del otro.
    await expect(page.getByTestId(`adjuntar-tooltip-explicativo-${id}`)).toBeDisabled();
  });

  test('la barra de pestanas ofrece chevron cuando no caben todas', async ({ page }) => {
    // La lista crece con cada tipo de interaccion. Encogerlas hasta que quepan cortaria los
    // rotulos y dejaria una fila de iconos sin nombre.
    await nuevoModulo(page, 'sec-chevron');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    await expect(page.getByTestId('pestanas-derecha')).toBeVisible();
    await page.getByTestId('pestanas-derecha').click();
    await expect(page.getByTestId('pestanas-izquierda')).toBeVisible();
  });
});
