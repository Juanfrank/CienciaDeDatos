import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Lo que el catalogo declara tiene que estar EN EL PANEL — secciones 4.2 y 4.5.
 *
 * La auditoria del contrato encontro capacidades que el dibujo honraba y la version no declaraba.
 * El sintoma no es un error: es que el control no sale en el panel, asi que la funcion solo se
 * puede usar escribiendo la instancia a mano. Una prueba unitaria compara las dos listas; estas
 * comprueban lo que de verdad importa, que es que la persona que edita lo vea.
 */

test.describe('lo que se declaro en la auditoria llega al editor', () => {
  test('las barras horizontales ofrecen color por valor, como las columnas', async ({ page }) => {
    /*
     * Es el hallazgo que ordena todo esto: el mismo constructor dibuja los dos objetos y colorea
     * por valor sin mirar la orientacion. Las columnas lo declaran desde su 1.4.0 y las barras
     * horizontales no lo declararon nunca, asi que la capacidad estaba entera y era inalcanzable.
     */
    await entrarComo(page, 'u-ana');
    const slug = `contrato-${Date.now()}`;
    const creado = await page.request.post('/api/modulos', { data: { nombre: 'Contrato', slug } });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto(`/editor/${slug}`);
    await page.getByTestId('anadir-barras-horizontales').click();
    await expect(page.locator('[data-testid^="bloque-obj-"]')).toHaveCount(1);

    const id = await page.locator('[data-testid^="bloque-obj-"]').first().getAttribute('data-testid');
    const instancia = (id ?? '').replace('bloque-', '');

    // La seccion vive en la pestana de Formato, que es donde se personaliza el objeto.
    await page.getByTestId('pestana-formato').click();
    await expect(page.getByTestId(`pres-${instancia}-condicional`)).toBeVisible();
  });

  test('el combinado ofrece apilar sus columnas', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const slug = `contrato-comb-${Date.now()}`;
    const creado = await page.request.post('/api/modulos', { data: { nombre: 'Contrato', slug } });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto(`/editor/${slug}`);
    await page.getByTestId('anadir-combinado').click();
    await expect(page.locator('[data-testid^="bloque-obj-"]')).toHaveCount(1);

    const id = await page.locator('[data-testid^="bloque-obj-"]').first().getAttribute('data-testid');
    const instancia = (id ?? '').replace('bloque-', '');

    /*
     * Se busca el ajuste por su nombre, que es como se llega a el de verdad.
     *
     * La pestana de Formato tiene dieciocho secciones y casi todas empiezan plegadas: comprobar
     * que el control esta en el documento no dice que alguien pueda encontrarlo. El buscador del
     * panel abre la seccion que lo contiene, asi que esto prueba el camino entero.
     */
    await page.getByTestId('pestana-formato').click();
    await page.getByTestId('buscar-ajuste').fill('apilado');
    await expect(page.getByTestId(`pres-${instancia}-apilado`)).toBeVisible();
  });

  test('el mapa pide un Territorio y un Valor, no «dimension 1»', async ({ page }) => {
    // El mapa era el unico objeto de datos sin pozos con nombre. Que su render aun no exista no
    // es motivo para dejar el mapeo sin nombrar: el mapeo es lo unico que hoy se puede preparar.
    await entrarComo(page, 'u-ana');
    const slug = `contrato-mapa-${Date.now()}`;
    const creado = await page.request.post('/api/modulos', { data: { nombre: 'Contrato', slug } });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto(`/editor/${slug}`);
    await page.getByTestId('anadir-mapa').click();
    await expect(page.locator('[data-testid^="bloque-obj-"]')).toHaveCount(1);

    const id = await page.locator('[data-testid^="bloque-obj-"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('bloque-', '');

    // Los pozos viven en la pestana de Datos. Se pide explicitamente para que la prueba no
    // dependa de a que pestana salte el editor al seleccionar el objeto.
    await page.getByTestId('pestana-datos').click();
    await expect(page.getByTestId(`pozo-${item}-territorio`)).toBeVisible();
    await expect(page.getByTestId(`pozo-${item}-valor`)).toBeVisible();
    await expect(page.getByTestId(`pozo-${item}-territorio`)).toContainText('Territorio');
  });
});

test.describe('la matriz colorea por valor', () => {
  test('una cifra por encima del umbral se pinta, y las demas no', async ({ page }) => {
    /*
     * La tabla llana tiene color por valor desde su 1.2.0 y la matriz no lo tenia, aunque las dos
     * comparten la lista de lo que admiten presentar: el color entro en una y nadie miro al lado.
     * Y es en la matriz donde mas hace falta — un cruce son doce cifras, y encontrar a ojo la que
     * se sale es justo el trabajo que el color ahorra.
     */
    await entrarComo(page, 'u-ana');
    await page.goto('/m/composicion/condicional');

    const matriz = page.getByTestId('matriz');
    await expect(matriz).toBeVisible();

    /*
     * Se comprueba la REGLA, no cuantas celdas salen pintadas.
     *
     * La primera version contaba: «alguna pintada y no todas». Pasaba sola y fallaba dentro de la
     * suite completa, porque el ambito activo cambia los numeros y con otro reparto salian las
     * diez por encima del umbral — una prueba que depende de los datos y no de lo que afirma.
     * Leyendo cada celda y su color, lo que se comprueba es que pintada equivale a pasar de 300,
     * que es lo que la regla dice y vale con cualquier reparto.
     */
    const celdas = await matriz.locator('td').evaluateAll((tds) =>
      tds.map((td) => ({
        texto: td.textContent ?? '',
        pintada: (td.getAttribute('style') ?? '').includes('--md-sys-color-error'),
      })),
    );

    expect(celdas.length).toBeGreaterThan(0);
    for (const { texto, pintada } of celdas) {
      const valor = Number(texto.replace(/[^0-9.-]/g, ''));
      if (Number.isNaN(valor)) continue;
      expect(pintada, `${texto} -> ${pintada ? 'pintada' : 'sin pintar'}`).toBe(valor > 300);
    }
    expect(celdas.some((c) => c.pintada)).toBe(true);
  });

  test('el color llega tambien a los subtotales, no solo a las celdas', async ({ page }) => {
    // Las cuatro clases de celda de una matriz —celda, total de fila, total de columna y total
    // general— se escribian en cuatro sitios distintos, que es como el color se queda en tres.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/composicion/condicional');

    const totales = await page
      .getByTestId('matriz')
      .locator('td.es-total')
      .evaluateAll((tds) =>
        tds.map((td) => ({
          texto: td.textContent ?? '',
          pintada: (td.getAttribute('style') ?? '').includes('--md-sys-color-error'),
        })),
      );

    expect(totales.length).toBeGreaterThan(0);
    // La misma regla, aplicada a los subtotales: un subtotal es una cifra como cualquier otra, y
    // que el color se quedara en las celdas seria justo el fallo de escribirlas en cuatro sitios.
    for (const { texto, pintada } of totales) {
      const valor = Number(texto.replace(/[^0-9.-]/g, ''));
      if (Number.isNaN(valor)) continue;
      expect(pintada, `total ${texto}`).toBe(valor > 300);
    }
    expect(totales.some((t) => t.pintada), 'ningun subtotal pintado').toBe(true);
  });
});
