import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './sesion';

/** El lienzo del editor — seccion 4.2, con la accesibilidad de 4.9. */

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
    const before = await valor.innerText();

    // Se cambia la medida desde su pozo: otra medida, otra cifra, en el mismo gesto.
    await page.getByTestId(`pozo-${id}-valor-quitar-CasosIngresados`).click();
    await guardado(page);
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-CasosResueltos`).click();
    await guardado(page);

    /*
     * Antes esto comprobaba SOLO que la cifra cambiara, y con eso no basta.
     */
    await expect(valor).not.toHaveText(before);
    await expect(valor).not.toHaveText('0');
    await expect(valor).not.toHaveText('—');
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

  test('un bloque de N filas cubre EXACTAMENTE N celdas de guia', async ({ page }) => {
    /*
     * La insignia decia 6x3 y el bloque cubria tres celdas y media largas.
     */
    await nuevoModulo(page, 'lienzo-filas');
    // Un grafico: alto de sobra para que las filas que ocupa crezcan por encima del minimo, que es
    // el caso en el que las dos rejillas se separaban.
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    const medida = await page.getByTestId(`bloque-${id}`).evaluate((el) => {
      const estilo = getComputedStyle(el);
      const first = Number(estilo.gridRowStart) - 1;
      const alto = Number(estilo.gridRowEnd.replace('span ', ''));
      const celdas = Array.from(document.querySelectorAll('.lienzo__guia')) as HTMLElement[];
      const gridColumns = 12;
      const caja = el.getBoundingClientRect();
      const enColumna1 = (fila: number) => celdas[fila * gridColumns]?.getBoundingClientRect();
      return {
        alto,
        arribaBloque: Math.round(caja.top),
        abajoBloque: Math.round(caja.bottom),
        arribaGuia: Math.round(enColumna1(first)?.top ?? NaN),
        abajoGuia: Math.round(enColumna1(first + alto - 1)?.bottom ?? NaN),
      };
    });

    expect(medida.alto).toBeGreaterThan(1);
    expect(medida.arribaBloque).toBe(medida.arribaGuia);
    expect(medida.abajoBloque).toBe(medida.abajoGuia);
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
    const column = await page
      .getByTestId(`bloque-${id}`)
      .evaluate((el) => getComputedStyle(el).gridColumnStart);
    expect(column).toBe('2');
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
    await page.getByTestId('pestana-objetos').click();
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    const dataRows = await page
      .locator('[data-testid^="bloque-obj-"]')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).gridRowStart));
    expect(dataRows).toEqual(['1', '1']);
  });
});

test.describe('el panel es la unica tienda, y sus pestanas', () => {
  test('sin nada elegido, Datos y Formato estan deshabilitadas', async ({ page }) => {
    // Deshabilitadas y no ocultas: una barra que cambia de numero de pestanas obliga a volver a
    // buscar donde estaba cada cosa.
    await nuevoModulo(page, 'panel-vacio');
    await expect(page.getByTestId('pestana-objetos')).toHaveAttribute(
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
    // Se comprueba la SECCION y no una lista concreta: las listas se agrupan por familia y sus
    // identificadores cambian con esa agrupacion, pero que exista una tienda de objetos no.
    await expect(page.getByTestId('seccion-visualizaciones')).toBeVisible();
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
    // Cupo 1/1: el `+` DESAPARECE —antes se apagaba, y un boton apagado no explica por que—,
    // pero el chiclet se sigue pudiendo quitar.
    await expect(page.getByTestId(`pozo-${id}-serie-anadir`)).toHaveCount(0);
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

test.describe('arrastrar y redimensionar', () => {
  /**
   * Arrastra un asa N celdas. Se mueve en varios pasos porque un unico `mouse.move` salta el
   * `pointermove` intermedio y el arrastre nunca llega a calcular un destino.
   */
  const arrastrar = async (
    page: Page,
    prueba: string,
    celdasX: number,
    celdasY: number,
  ) => {
    const asa = await page.getByTestId(prueba).boundingBox();
    if (!asa) throw new Error(`Sin asa: ${prueba}`);
    const rejilla = await page.locator('.lienzo__rejilla').boundingBox();
    if (!rejilla) throw new Error('Sin rejilla');

    // El ancho de celda se mide de la rejilla real, igual que hace el propio arrastre: es fluida.
    const anchoDeCelda = (rejilla.width - 16 * 11) / 12 + 16;
    const altoDeCelda = 56 + 16;

    const desdeX = asa.x + asa.width / 2;
    const desdeY = asa.y + asa.height / 2;
    await page.mouse.move(desdeX, desdeY);
    await page.mouse.down();
    for (let paso = 1; paso <= 4; paso += 1) {
      await page.mouse.move(
        desdeX + (celdasX * anchoDeCelda * paso) / 4,
        desdeY + (celdasY * altoDeCelda * paso) / 4,
      );
    }
    await page.mouse.up();
  };

  test('arrastrar el asa mueve el bloque de columna', async ({ page }) => {
    await nuevoModulo(page, 'arr-mover');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId('pestana-formato').click();
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 1–6 de 12');

    await arrastrar(page, `asa-mover-${id}`, 3, 0);
    await guardado(page);

    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 4–9 de 12');
  });

  test('arrastrar la esquina cambia el ancho', async ({ page }) => {
    await nuevoModulo(page, 'arr-medir');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);
    await page.getByTestId('pestana-formato').click();

    await arrastrar(page, `asa-medir-${id}`, 2, 0);
    await guardado(page);

    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 1–8 de 12');
  });

  test('el arrastre pasa por el MISMO camino que los botones', async ({ page }) => {
    /*
     * Era la condicion con la que se aplazo el arrastre: un solo sitio donde se decide donde queda
     * un objeto. Se comprueba mezclando los dos gestos sobre el mismo bloque — si fueran caminos
     * distintos, el segundo partiria de un estado que el primero no actualizo.
     */
    await nuevoModulo(page, 'arr-mismo');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);
    await page.getByTestId('pestana-formato').click();

    await arrastrar(page, `asa-mover-${id}`, 2, 0);
    await guardado(page);
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 3–8 de 12');

    await page.getByTestId(`derecha-${id}`).click();
    await guardado(page);
    await expect(page.getByTestId(`posicion-${id}`)).toContainText('Columna 4–9 de 12');
  });

  test('un destino ocupado se marca invalido y al soltar NO pasa nada', async ({ page }) => {
    /*
     * Empujar los objetos de alrededor es lo que hacen otros editores y es donde se pierde el
     * control: se mueve uno y se descolocan tres. Aqui el destino ocupado se rechaza.
     */
    await nuevoModulo(page, 'arr-ocupado');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    await page.getByTestId('pestana-objetos').click();
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    // El primero esta en 1–6 y el segundo en 7–12, en la misma fila.
    const primero = (
      (await page.locator('[data-testid^="bloque-obj-"]').first().getAttribute('data-testid')) ?? ''
    ).replace('bloque-', '');

    await page.getByTestId(`elegir-${primero}`).click();
    await page.getByTestId('pestana-formato').click();
    await expect(page.getByTestId(`posicion-${primero}`)).toContainText('Columna 1–6 de 12');

    await arrastrar(page, `asa-mover-${primero}`, 6, 0);
    await guardado(page);

    // Sigue donde estaba: el destino se pisaba con el otro bloque.
    await expect(page.getByTestId(`posicion-${primero}`)).toContainText('Columna 1–6 de 12');
  });

  test('sin permiso de edicion no hay asas', async ({ page }) => {
    // Un modulo publicado se mira. Las asas solo aparecen donde el panel tambien aparece.
    await entrarComo(page, 'u-ana');
    await page.goto('/editor/casos-pendientes');
    await expect(page.getByTestId('editor-solo-lectura')).toBeVisible();
    await expect(page.locator('.lienzo__asa')).toHaveCount(0);
  });
});

test.describe('las ranuras mandan, no el orden', () => {
  test('se puede llenar el Eje Y sin llenar el Eje X', async ({ page }) => {
    /*
     * El caso que el reparto posicional no podia expresar: el primer campo caia siempre en la
     * primera ranura. Aqui la medida va a su sitio y el eje X se queda vacio — y el objeto se
     * marca roto, que es lo correcto: un grafico de barras sin eje no se puede dibujar.
     */
    await nuevoModulo(page, 'ranura-solo-y');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`pozo-${id}-eje-x-quitar-DimTribunal.Distrito`).click();
    await guardado(page);

    await expect(page.getByTestId(`pozo-${id}-eje-x`)).toContainText('0/1');
    await expect(page.getByTestId(`pozo-${id}-eje-y`)).toContainText('CasosIngresados');
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toBeVisible();
  });

  test('se puede llenar SOLO la serie, y el editor dice que falta el eje', async ({ page }) => {
    await nuevoModulo(page, 'ranura-solo-serie');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`pozo-${id}-eje-x-quitar-DimTribunal.Distrito`).click();
    await guardado(page);
    await page.getByTestId(`pozo-${id}-serie-anadir`).click();
    await page.getByTestId(`pozo-${id}-serie-opcion-DimTribunal.Materia`).click();
    await guardado(page);

    // Una dimension mapeada: el contrato global («entre 1 y 2») se cumple. La ranura no.
    await expect(page.getByTestId(`pozo-${id}-serie`)).toContainText('DimTribunal.Materia');
    await expect(page.getByTestId('editor-bloqueos')).toContainText('Eje X');

    /*
     * Y el bloque se marca ROTO en el lienzo, no se dibuja con la serie haciendo de eje.
     */
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toBeVisible();
  });

  test('el campo vuelve a SU ranura, no a la primera libre', async ({ page }) => {
    await nuevoModulo(page, 'ranura-vuelve');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`pozo-${id}-eje-x-quitar-DimTribunal.Distrito`).click();
    await guardado(page);
    await page.getByTestId(`pozo-${id}-serie-anadir`).click();
    await page.getByTestId(`pozo-${id}-serie-opcion-DimTribunal.Materia`).click();
    await guardado(page);
    await page.getByTestId(`pozo-${id}-eje-x-anadir`).click();
    await page.getByTestId(`pozo-${id}-eje-x-opcion-DimTribunal.Distrito`).click();
    await guardado(page);

    // Cada uno donde se puso, aunque se hayan llenado en orden inverso al declarado.
    await expect(page.getByTestId(`pozo-${id}-eje-x`)).toContainText('DimTribunal.Distrito');
    await expect(page.getByTestId(`pozo-${id}-serie`)).toContainText('DimTribunal.Materia');
    await expect(page.getByTestId('editor-sin-bloqueos')).toBeVisible();
  });

  test('un modulo guardado ANTES de las ranuras se sigue viendo igual', async ({ page }) => {
    /*
     * El seed se escribio con el modelo posicional. Sin la deduccion por orden, cada modulo ya
     * publicado apareceria con las ranuras vacias y sus campos perdidos de vista.
     */
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await expect(page.getByTestId('kpi-valor').first()).not.toHaveText('0');
    await expect(page.getByTestId('objeto-roto')).toHaveCount(0);
    await expect(page.getByTestId('grafico-barras-flujo')).toHaveAttribute('data-montado', 'si');
  });
});

test.describe('el panel se lee de un vistazo', () => {
  test('la ayuda vive en un icono, no en un parrafo bajo cada rotulo', async ({ page }) => {
    await nuevoModulo(page, 'panel-ayuda');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    // El texto no esta a la vista...
    await expect(page.getByText('La dimension que reparte las barras.')).toHaveCount(0);

    // ...y aparece al posarse sobre el icono, con el papel que le corresponde.
    await page.locator('.ayuda__icono').first().hover();
    const globo = page.getByRole('tooltip');
    await expect(globo).toBeVisible();
    await expect(globo).toHaveText('La dimension que reparte las barras.');

    // 1.4.13: se descarta con Escape, sin mover el puntero.
    await page.keyboard.press('Escape');
    await expect(globo).toHaveCount(0);
  });

  test('Escape sobre una ayuda NO deselecciona el objeto', async ({ page }) => {
    // Mismo choque que tenia el buscador de campos: dos Escape escuchando en `document`.
    await nuevoModulo(page, 'panel-escape');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);

    await page.locator('.ayuda__icono').first().hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('pestana-datos')).toBeEnabled();
  });

  test('lo obligatorio lleva asterisco, y lo dice tambien con palabras', async ({ page }) => {
    await nuevoModulo(page, 'panel-obligatorio');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // El eje X hace falta para dibujar; la serie no.
    const ejeX = page.locator(`[data-testid="pozo-${id}-eje-x"] .pozo__obligatorio`);
    await expect(ejeX).toHaveCount(1);
    await expect(page.locator(`[data-testid="pozo-${id}-serie"] .pozo__obligatorio`)).toHaveCount(0);

    // El color no puede ser el unico portador de la informacion (1.4.1).
    await expect(page.locator(`[data-testid="pozo-${id}-eje-x"]`)).toContainText('(obligatorio)');
  });

  test('el panel se desplaza, y la barra ocupa sitio de verdad', async ({ page }) => {
    /*
     * El desplazamiento existia y no se veia: la barra iba `thin` con el canal transparente, que
     * contra el fondo del panel se lee como el borde del panel. Se comprueba por medida y no por
     * captura, porque el navegador de las pruebas se lanza con `--hide-scrollbars`.
     */
    await page.setViewportSize({ width: 1500, height: 620 });
    await nuevoModulo(page, 'panel-scroll');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    await page.getByTestId('pestana-formato').click();

    const total = await page.locator('.panel-editor details').count();
    for (let i = 0; i < total; i += 1) {
      const d = page.locator('.panel-editor details').nth(i);
      if ((await d.getAttribute('open')) === null) await d.locator('> summary').click();
    }

    const medida = await page
      .locator('.panel-editor__cuerpo')
      .evaluate((el: HTMLElement) => ({
        desborda: el.scrollHeight > el.clientHeight,
        anchoDeBarra: el.offsetWidth - el.clientWidth,
      }));
    expect(medida.desborda).toBe(true);
    expect(medida.anchoDeBarra).toBeGreaterThan(0);

    await page.locator('.panel-editor__cuerpo').evaluate((el) => el.scrollTo(0, 9999));
    const abajo = await page
      .locator('.panel-editor__cuerpo')
      .evaluate((el) => el.scrollTop > 0);
    expect(abajo).toBe(true);
  });
});

test.describe('como se resume cada medida', () => {
  test('el chiclet trae el operador que DECLARA el esquema, no siempre suma', async ({ page }) => {
    /*
     * El fallo tenia un numero: una tarjeta con los dias de resolucion mostraba 10 593 dias —la
     * suma de los promedios— donde el promedio real eran 165,5. La capa de presentacion sumaba
     * siempre porque sumar era lo unico que sabia hacer.
     */
    await nuevoModulo(page, 'agr-declarada');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // La medida que trae por defecto es aditiva, y el esquema la declara suma.
    await expect(page.getByTestId(`pozo-${id}-valor-agregacion-CasosIngresados`)).toHaveValue(
      'suma',
    );

    // La de dias se declara promedio en el esquema: el desplegable parte de ahi, sin tocarlo.
    await page.getByTestId(`dataset-${id}`).selectOption('casos-detalle');
    await guardado(page);
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-DiasResolucion`).click();
    await guardado(page);

    await expect(page.getByTestId(`pozo-${id}-valor-agregacion-DiasResolucion`)).toHaveValue(
      'promedio',
    );
  });

  test('cambiar el operador cambia la cifra dibujada, en vivo', async ({ page }) => {
    await nuevoModulo(page, 'agr-cambia');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`dataset-${id}`).selectOption('casos-detalle');
    await guardado(page);
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-DiasResolucion`).click();
    await guardado(page);

    const valor = page.getByTestId(`bloque-${id}`).getByTestId('kpi-valor');
    const promediado = await valor.innerText();

    await page.getByTestId(`pozo-${id}-valor-agregacion-DiasResolucion`).selectOption('suma');
    await guardado(page);
    const sumado = await valor.innerText();

    /*
     * No es cosmetico: el mismo mapeo con otro operador es otra cifra. La suma de 1 200 casos es
     * ordenes de magnitud mayor que su promedio.
     */
    const aNumero = (content: string) =>
      Number(content.replace(/[^0-9.,]/g, '').replace(/,/g, ''));
    expect(sumado).not.toBe(promediado);
    expect(aNumero(sumado)).toBeGreaterThan(aNumero(promediado));
  });

  test('el desplegable NO ofrece lo que el grano no admite', async ({ page }) => {
    /*
     * Ofrecer los siete y rechazar cuatro al guardar obliga a descubrir el limite probando,
     * cuando el editor ya lo sabe. Es el mismo criterio por el que los botones de borde del
     * lienzo se apagan en el borde en vez de guardar algo invalido y avisar despues.
     */
    await nuevoModulo(page, 'agr-opciones');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    const opciones = () =>
      page
        .getByTestId(`pozo-${id}-valor-agregacion-CasosIngresados`)
        .locator('option')
        .allTextContents();

    // Dataset agrupado: solo las aditivas, porque un promedio de promedios no se puede recalcular.
    expect(await opciones()).toEqual(['Suma', 'Minimo', 'Maximo']);

    // Grano atomico: todas menos «Sin resumir», que es de la fuente y no de quien edita.
    await page.getByTestId(`dataset-${id}`).selectOption('casos-detalle');
    await guardado(page);
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-DiasResolucion`).click();
    await guardado(page);

    const deAtomico = await page
      .getByTestId(`pozo-${id}-valor-agregacion-DiasResolucion`)
      .locator('option')
      .allTextContents();
    expect(deAtomico).toContain('Promedio');
    expect(deAtomico).toContain('Recuento distinto');
    expect(deAtomico).not.toContain('Sin resumir');
  });

  test('un pozo lleno no ensena el boton de anadir', async ({ page }) => {
    // Un boton apagado es una promesa que no se cumple: ocupa sitio, invita a pulsarlo y no
    // explica que hay que quitar algo antes. El hueco desaparece y vuelve al quitar un campo.
    await nuevoModulo(page, 'pozo-lleno');
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await idDelBloque(page);

    // El eje X admite uno y ya lo trae: no hay `+`.
    await expect(page.getByTestId(`pozo-${id}-eje-x-anadir`)).toHaveCount(0);
    // La serie esta vacia y admite uno: ahi si.
    await expect(page.getByTestId(`pozo-${id}-serie-anadir`)).toBeVisible();

    // Al vaciar el eje X, el `+` vuelve.
    await page.getByTestId(`pozo-${id}-eje-x-quitar-DimTribunal.Distrito`).click();
    await guardado(page);
    await expect(page.getByTestId(`pozo-${id}-eje-x-anadir`)).toBeVisible();
  });

  test('un promedio sobre un dataset YA agrupado se marca roto, no se dibuja', async ({ page }) => {
    /*
     * La comprobacion que hace que el numero falso deje de ser alcanzable desde el editor. Sobre
     * filas ya agrupadas un promedio de promedios solo coincide con el real si todos los grupos
     * pesan igual — y no hay forma de saber si pesan igual desde el resultado.
     */
    await nuevoModulo(page, 'agr-imposible');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    /*
     * El desplegable ya no ofrece 'promedio' aqui, asi que la combinacion se fuerza por la API —
     * que es exactamente el caso que queda: un modulo guardado cuando era valida, con el grano del
     * dataset cambiado despues. El mensaje tiene que seguir estando para ese caso.
     */
    await page.evaluate(async (itemId) => {
      const url = location.pathname.replace('/editor/', '/api/modulos/') + '/edicion';
      const { modulo } = await (await fetch(url)).json();
      for (const pagina of modulo.pages) {
        for (const it of pagina.items) {
          if (it.id === itemId) it.instance.binding.aggregations = { CasosIngresados: 'promedio' };
        }
      }
      await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paginas: modulo.pages }),
      });
    }, id);
    await page.reload();
    await guardado(page);

    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toBeVisible();
    await expect(page.getByTestId('editor-bloqueos')).toContainText(/ya agrupado/);

    // Y se puede deshacer desde el propio desplegable: el operador guardado aparece marcado como
    // no aplicable, y volver a una aditiva devuelve el objeto a la vida.
    await page.getByTestId(`elegir-${id}`).click();
    await page.getByTestId('pestana-datos').click();
    await page.getByTestId(`pozo-${id}-valor-agregacion-CasosIngresados`).selectOption('suma');
    await guardado(page);
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('kpi-valor')).toBeVisible();
  });

  test('el MISMO promedio sobre grano atomico se acepta', async ({ page }) => {
    // El grano es lo que decide, no la medida: sobre los casos uno a uno no hay ninguna
    // agregacion previa que arruinar.
    await nuevoModulo(page, 'agr-atomico');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);

    await page.getByTestId(`dataset-${id}`).selectOption('casos-detalle');
    await guardado(page);
    await page.getByTestId(`pozo-${id}-valor-anadir`).click();
    await page.getByTestId(`pozo-${id}-valor-opcion-DiasResolucion`).click();
    await guardado(page);

    await expect(page.getByTestId(`bloque-${id}`).getByTestId('objeto-roto')).toHaveCount(0);
    await expect(page.getByTestId(`bloque-${id}`).getByTestId('kpi-valor')).toBeVisible();
  });
});

test.describe('estilo de texto y paleta', () => {
  test('negrita, cursiva y color se aplican al titulo, en vivo', async ({ page }) => {
    await nuevoModulo(page, 'estilo-texto');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);
    const pres = `pres-obj-${id.replace('obj-', '')}`;

    await page.getByTestId('pestana-formato').click();

    await page.getByTestId(`${pres}-texto-titulo-negrita`).click();
    await guardado(page);
    await page.getByTestId(`${pres}-texto-titulo-cursiva`).click();
    await guardado(page);
    await page.getByTestId(`${pres}-texto-titulo-color-terciario`).click();
    await guardado(page);

    const estilo = await page
      .getByTestId(`bloque-${id}`)
      .getByTestId('objeto-titulo')
      .evaluate((el) => {
        const e = getComputedStyle(el);
        return { peso: e.fontWeight, estilo: e.fontStyle, color: e.color };
      });
    expect(estilo.peso).toBe('700');
    expect(estilo.estilo).toBe('italic');
    // El color sale del ROL del tema, no de un hex escrito a mano: se comprueba que cambio, no
    // cual es, porque el valor exacto es del tema y el tema puede cambiar.
    expect(estilo.color).not.toBe('rgb(0, 0, 0)');
  });

  test('la paleta ofrece ROLES del tema, no un color libre', async ({ page }) => {
    /*
     * Es la decision que sostiene 4.3. Un selector de color libre es lo que pide cualquiera y es
     * justo lo que romperia la garantia: un color elegido a mano no tiene par de contraste
     * comprobado contra la superficie donde acabe, y no sigue al tema oscuro.
     */
    await nuevoModulo(page, 'estilo-paleta');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    await page.getByTestId('pestana-formato').click();

    const palette = page.getByRole('radiogroup', { name: /Color de Estilo del titulo/ });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('radio')).toHaveCount(6);
    // Nada de `input[type=color]`: ahi es donde entraria el color suelto.
    await expect(page.locator('input[type="color"]')).toHaveCount(0);
  });

  test('configurar el valor no borra lo puesto en el titulo', async ({ page }) => {
    // Sin fundir con lo que ya hubiera, el ultimo destino tocado reemplazaria a los demas.
    await nuevoModulo(page, 'estilo-fusion');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelBloque(page);
    const pres = `pres-obj-${id.replace('obj-', '')}`;

    await page.getByTestId('pestana-formato').click();
    await page.getByTestId(`${pres}-texto-titulo-negrita`).click();
    await guardado(page);

    // El estilo del valor vive en «Medida > Valor»: la cifra y su rotulo son cosas distintas.
    await page.getByTestId(`${pres}-medida`).locator('> summary').click();
    await page.getByTestId(`${pres}-valor`).locator('> summary').click();
    await page.getByTestId(`${pres}-texto-valor-cursiva`).click();
    await guardado(page);

    await expect(page.getByTestId(`${pres}-texto-titulo-negrita`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId(`${pres}-texto-valor-cursiva`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('el panel de formato se busca, no se recorre', () => {
  /*
   * Los identificadores del panel llevan dentro el de la instancia, que se genera al crearla, asi
   * que se localizan por su SUFIJO. Fijar el identificador completo obligaria a leer antes el de
   * la instancia, y eso ataria la prueba a como se generan.
   */
  const panelDe = (page: import('@playwright/test').Page) => page.locator('.editor__formato');
  const enPanel = (page: import('@playwright/test').Page, sufijo: string) =>
    panelDe(page).locator(`[data-testid$="${sufijo}"]`);
  const buscador = (page: import('@playwright/test').Page) =>
    panelDe(page).getByTestId('buscar-ajuste');

  const conUnGrafico = async (page: import('@playwright/test').Page, slug: string) => {
    await nuevoModulo(page, slug);
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    await page.getByRole('tab', { name: 'Formato' }).click();
    await expect(panelDe(page)).toBeVisible();
  };

  test('escribir «meta» deja solo las secciones que hablan de eso', async ({ page }) => {
    /*
     * El panel llego a dieciocho secciones. Con esa cantidad la pregunta deja de ser «que
     * opciones hay» y pasa a ser «donde esta la que quiero», y plegar no lo resuelve: plegado,
     * encontrar algo obliga a abrir y cerrar una por una.
     */
    await conUnGrafico(page, 'panel-buscar');

    const before = await panelDe(page).locator('details.seccion').count();
    expect(before).toBeGreaterThan(5);

    // «Meta» no es el titulo de ninguna seccion: es como se llama de verdad una linea de
    // referencia. Un buscador que solo mirara el titulo obligaria a saber ya como se llama.
    await buscador(page).fill('meta');
    await expect(enPanel(page, '-referencias')).toBeVisible();
    await expect(enPanel(page, '-rotulo')).toHaveCount(0);

    // Y lo que queda se abre solo: si siguiera plegado haria falta un clic mas para ver lo que se
    // estaba buscando.
    await expect(enPanel(page, '-ref-anadir')).toBeVisible();
  });

  test('busca sin acentos y vaciar el buscador lo devuelve todo', async ({ page }) => {
    await conUnGrafico(page, 'panel-buscar-2');

    // Quien busca «grafico» tiene que encontrar «Gráfico».
    await buscador(page).fill('grafico');
    await expect(enPanel(page, '-rotulo')).toHaveCount(0);

    await buscador(page).fill('');
    await expect(enPanel(page, '-rotulo')).toBeVisible();
  });

  test('una busqueda sin resultados no deja el panel en blanco sin explicacion', async ({ page }) => {
    await conUnGrafico(page, 'panel-buscar-3');
    await buscador(page).fill('zzzzz');

    await expect(panelDe(page).locator('details.seccion')).toHaveCount(0);
    // Un panel vacio se lee como «este objeto no tiene ajustes», que es falso, y ademas no da la
    // salida.
    await expect(panelDe(page).getByTestId('sin-resultados')).toBeVisible();
  });
});

test.describe('la paleta se elige por la pregunta, no por el nombre', () => {
  /*
   * Quince visualizaciones en una lista plana convierten elegir un objeto en recordar su nombre:
   * «Grafico de columnas» y «Grafico de barras» solo se distinguen por el icono. Agrupadas por lo
   * que responden se elige por lo que se quiere contar, que es como llega la necesidad.
   */
  test('las visualizaciones se agrupan por lo que responden', async ({ page }) => {
    await nuevoModulo(page, 'paleta-familias');

    await expect(page.getByTestId('familia-comparacion')).toBeVisible();
    await expect(page.getByTestId('familia-evolucion')).toBeVisible();
    await expect(page.getByTestId('familia-proporcion')).toBeVisible();

    // El rotulo es la PREGUNTA, no el nombre tecnico de la familia.
    await expect(page.getByTestId('familia-comparacion')).toContainText('Comparar entre categorias');
  });

  test('el buscador encuentra por la descripcion, no solo por el nombre', async ({ page }) => {
    /*
     * La descripcion es donde estan las palabras con las que alguien busca. Buscando solo por
     * nombre habria que saber ya como se llama el objeto, que es lo que no se sabe al buscar.
     */
    await nuevoModulo(page, 'paleta-buscar');

    await page.getByTestId('buscar-objeto').fill('etapas');
    await expect(page.getByTestId('anadir-embudo')).toBeVisible();
    await expect(page.getByTestId('anadir-barras')).toHaveCount(0);
  });

  test('una familia sin resultados no deja su rotulo colgando', async ({ page }) => {
    // Un encabezado «Comparar entre categorias» sobre una lista vacia se lee como un error.
    await nuevoModulo(page, 'paleta-vacia');

    await page.getByTestId('buscar-objeto').fill('etapas');
    await expect(page.getByTestId('familia-comparacion')).toHaveCount(0);
    await expect(page.getByTestId('familia-proporcion')).toBeVisible();
  });

  test('y sin ningun resultado lo dice, con la salida', async ({ page }) => {
    await nuevoModulo(page, 'paleta-nada');

    await page.getByTestId('buscar-objeto').fill('zzzzz');
    await expect(page.getByTestId('sin-objetos')).toBeVisible();
    await page.getByTestId('limpiar-busqueda-objeto').click();
    await expect(page.getByTestId('anadir-barras')).toBeVisible();
  });

  test('las fichas van en DOS columnas, no en fila india', async ({ page }) => {
    /*
     * Se MIDEN las cajas, no se comprueba la regla de CSS.
     */
    await nuevoModulo(page, 'paleta-columnas');

    const fichas = page.getByTestId('tienda-proporcion').locator('.tienda__objeto');
    expect(await fichas.count()).toBeGreaterThanOrEqual(4);

    const cajas = await fichas.evaluateAll((nodos) =>
      nodos.map((n) => {
        const { x, y } = n.getBoundingClientRect();
        return { x: Math.round(x), y: Math.round(y) };
      }),
    );

    const first = cajas[0];
    const segunda = cajas[1];
    const tercera = cajas[2];
    if (!first || !segunda || !tercera) throw new Error('faltan fichas que medir');

    // Las dos primeras comparten fila y la segunda esta a la derecha.
    expect(segunda.y).toBe(first.y);
    expect(segunda.x).toBeGreaterThan(first.x);
    // Y la tercera baja de fila, alineada con la primera: eso es una rejilla de DOS columnas y no
    // de tres, que con cinco objetos tambien daria dos en la primera fila.
    expect(tercera.y).toBeGreaterThan(first.y);
    expect(tercera.x).toBe(first.x);
  });

  test('una familia se pliega y se despliega, y las demas no se mueven', async ({ page }) => {
    // Ocho familias abiertas son una lista larga en un carril estrecho. Plegar las que no
    // interesan es lo que deja a la vista las que si.
    await nuevoModulo(page, 'paleta-plegar');

    const family = page.getByTestId('familia-proporcion');
    const objeto = page.getByTestId('anadir-embudo');
    await expect(objeto).toBeVisible();

    await family.locator('summary').click();
    await expect(objeto).not.toBeVisible();
    // Plegar una no toca a las demas: son secciones independientes, no un acordeon.
    await expect(page.getByTestId('anadir-barras')).toBeVisible();

    await family.locator('summary').click();
    await expect(objeto).toBeVisible();
  });

  test('buscar ABRE la familia que contiene el resultado, aunque estuviera plegada', async ({
    page,
  }) => {
    /*
     * Es la trampa de hacer plegables unos grupos que ademas se filtran: el titulo de una familia
     * es la PREGUNTA —«Repartir un total»— y nunca coincide con lo que se escribe en el buscador,
     * asi que la seccion se quedaria plegada justo cuando acaba de encontrar lo que se buscaba.
     */
    await nuevoModulo(page, 'paleta-buscar-plegada');

    await page.getByTestId('familia-proporcion').locator('summary').click();
    await expect(page.getByTestId('anadir-embudo')).not.toBeVisible();

    await page.getByTestId('buscar-objeto').fill('etapas');
    await expect(page.getByTestId('anadir-embudo')).toBeVisible();
  });
});
