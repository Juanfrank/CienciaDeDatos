import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Galeria de objetos sobre Apache ECharts — seccion 4.2 y accesibilidad de 4.9.
 *
 * Lo que se comprueba aqui no es que ECharts dibuje bien —eso es cosa de ECharts— sino las tres
 * decisiones de esta aplicacion: que el grafico se carga de forma diferida, que el respaldo
 * accesible sigue existiendo detras del lienzo, y que el color no es el unico medio de
 * distinguir una serie.
 */

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('el grafico monta sobre el respaldo, no en su lugar', () => {
  test('con JavaScript se ve el lienzo y el respaldo queda oculto pero presente', async ({ page }) => {
    await page.goto('/m/casos-pendientes');

    const grafico = page.locator('.grafico').first();
    await expect(grafico).toHaveAttribute('data-montado', 'si');
    await expect(grafico.locator('canvas, svg')).not.toHaveCount(0);

    // El respaldo NO se quita del documento: es el camino accesible.
    const respaldo = grafico.getByTestId('grafico-respaldo');
    await expect(respaldo).toBeAttached();
    await expect(respaldo).not.toBeInViewport();
  });

  test('SIN JavaScript se ve el respaldo, con sus barras y sus cifras', async ({ browser }) => {
    const contexto = await browser.newContext({ javaScriptEnabled: false });
    const pagina = await contexto.newPage();
    await entrarComo(pagina, 'u-ana');
    await pagina.goto('/m/casos-pendientes');

    // Sin JavaScript ECharts no monta, y la pagina sigue sirviendo: el objeto no queda en blanco.
    // Se localiza POR INSTANCIA: el modulo lleva mas de un grafico y `barras` es el respaldo de
    // cada uno, asi que sin acotar el localizador la comprobacion es ambigua.
    const porDistrito = pagina.getByTestId('grafico-barras-distrito');
    await expect(porDistrito.getByTestId('barras')).toBeVisible();
    await expect(porDistrito.getByTestId('barras')).toContainText('Distrito Norte');
    await expect(porDistrito).toHaveAttribute('data-montado', 'no');

    await contexto.close();
  });
});

test.describe('interaccion', () => {
  test('pulsar una barra del lienzo filtra el resto del modulo', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    const lienzo = page.getByTestId('grafico-lienzo').first();
    await expect(lienzo).toBeVisible();

    // Hay que traerlo a la vista ANTES de medirlo: `boundingBox` da coordenadas del documento y
    // `mouse.click` las del viewport. El grafico queda por debajo del pliegue, asi que el clic
    // caia fuera de la ventana y no lo recibia nadie.
    await lienzo.scrollIntoViewIfNeeded();
    const caja = await lienzo.boundingBox();
    if (!caja) throw new Error('el lienzo deberia tener tamano');

    // Se pulsa sobre el area de la barra. ECharts resuelve la categoria y el modulo se filtra.
    await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height * 0.7);

    await expect(page).toHaveURL(/DimTribunal\.Distrito=/);
  });

  test('y el mismo filtrado se alcanza con el teclado, por el respaldo', async ({ page }) => {
    await page.goto('/m/casos-pendientes');

    // El respaldo esta oculto a la vista pero es alcanzable. Al recibir el foco SE MUESTRA:
    // un control invisible que recibe el foco desorienta mas que uno que no existe.
    const boton = page.getByTestId('barra-Distrito Norte');
    await boton.focus();
    await expect(page.getByTestId('grafico-respaldo').first()).toBeInViewport();

    await boton.press('Enter');
    await expect(page).toHaveURL(/DimTribunal\.Distrito=Distrito\+Norte/);
  });
});

test.describe('el color no es el unico medio de distinguir (WCAG 1.4.1)', () => {
  test('ECharts dibuja un patron distinto sobre cada serie', async ({ page }) => {
    // `aria.decal.show` en las opciones. Con varias series, el patron es lo unico que separa una
    // de otra al imprimir en gris o para quien no distingue ciertos colores.
    await page.goto('/m/casos-pendientes');
    const conVariasSeries = page.getByTestId('grafico-barras-flujo');
    await expect(conVariasSeries).toHaveAttribute('data-montado', 'si');

    // Con pocos elementos el renderizador es SVG, y los patrones son <pattern> de verdad.
    await expect
      .poll(() => conVariasSeries.locator('.grafico__lienzo pattern').count())
      .toBeGreaterThan(0);
  });

  test('y con una sola serie no dibuja ninguno', async ({ page }) => {
    // La otra mitad de la regla, y la que se olvida: 1.4.1 pide que el color no sea el UNICO
    // medio de distinguir cosas. Con una serie no hay nada que distinguir —la categoria la dice
    // el eje—, asi que el trazado no transmite nada y solo raya la barra. Sin esta prueba, la
    // condicion se podria quitar sin que fallara nada.
    await page.goto('/m/casos-pendientes');
    const unaSerie = page.getByTestId('grafico-barras-distrito');
    await expect(unaSerie).toHaveAttribute('data-montado', 'si');

    expect(await unaSerie.locator('.grafico__lienzo pattern').count()).toBe(0);
  });

  test('y las series usan la paleta institucional, no la de la libreria', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

    // Las variables del tema se inyectan en `body`. Leerlas de `documentElement` devolvia cadena
    // vacia y ECharts caia en su propia paleta: el grafico salia con los colores de la libreria
    // y no se notaba, porque un grafico con colores plausibles no parece roto.
    const primaria = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--md-sys-color-categorical-0').trim(),
    );
    expect(primaria).toMatch(/^#[0-9a-f]{6}$/i);

    const usaElTema = await page.evaluate((color) => {
      const nodos = [...document.querySelectorAll('.grafico__lienzo [fill]')];
      return nodos.some((n) => (n.getAttribute('fill') ?? '').toLowerCase() === color.toLowerCase());
    }, primaria);
    expect(usaElTema).toBe(true);
  });
});

test.describe('carga diferida (4.2)', () => {
  test('un modulo sin graficos no descarga ECharts', async ({ page }) => {
    const descargas: string[] = [];
    page.on('request', (r) => descargas.push(r.url()));

    // La bandeja de avisos no tiene ningun objeto de datos: nada que dibujar.
    await page.goto('/avisos');
    await expect(page.getByRole('heading', { name: 'Avisos' })).toBeVisible();

    const pesado = descargas.filter((u) => /echarts/i.test(u));
    expect(pesado, `no deberia descargarse ECharts: ${pesado.join(', ')}`).toEqual([]);
  });
});

test.describe('accesibilidad del grafico', () => {
  test('un modulo con graficos no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test('con el respaldo abierto por foco tampoco', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('barra-Distrito Norte').focus();

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

test.describe('la matriz, con jerarquia', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
  });

  test('anida las materias dentro de su distrito, con subtotal', async ({ page }) => {
    const matriz = page.getByTestId('matriz');
    await expect(matriz).toBeVisible();

    // El padre y sus dos hijos. Nada se identifica por la etiqueta: «Penal» puede colgar de mas
    // de un distrito, asi que la ruta completa es lo unico unico.
    await expect(page.getByTestId('matriz-fila-Distrito Norte')).toBeVisible();
    await expect(page.getByTestId('matriz-fila-Distrito Norte||Penal')).toBeVisible();
    await expect(page.getByTestId('matriz-fila-Distrito Norte||Civil')).toBeVisible();

    /*
     * El subtotal del padre es la suma de TODOS sus hijos, sean los que sean.
     *
     * Se cuentan por prefijo de ruta y no por nombre: el ambito efectivo de quien mira decide
     * cuantas materias hay, y una version anterior de esta prueba nombraba dos —las del seed— y
     * fallaba en cuanto otra prueba dejaba la sesion con otro equipo activo. Lo que se comprueba
     * es la relacion, que es lo que no puede cambiar.
     */
    const n = (s: string) => Number(s.replace(/[^0-9]/g, ''));
    const totalDe = async (fila: import('@playwright/test').Locator) =>
      n(await fila.locator('td.es-total').last().innerText());

    const padre = await totalDe(page.getByTestId('matriz-fila-Distrito Norte'));
    const hijos = await page.locator('[data-testid^="matriz-fila-Distrito Norte||"]').all();
    expect(hijos.length).toBeGreaterThan(1);

    let suma = 0;
    for (const hijo of hijos) suma += await totalDe(hijo);
    expect(padre).toBe(suma);
  });

  test('plegar un distrito esconde sus materias y deja su subtotal', async ({ page }) => {
    const antes = await page.locator('[data-testid^="matriz-fila-"]').count();
    await page.getByTestId('matriz-plegar-Distrito Norte').click();

    await expect(page.getByTestId('matriz-fila-Distrito Norte||Penal')).toHaveCount(0);
    await expect(page.getByTestId('matriz-fila-Distrito Norte')).toBeVisible();
    expect(await page.locator('[data-testid^="matriz-fila-"]').count()).toBeLessThan(antes);

    // Y vuelve: plegar es un gesto de lectura, no un cambio.
    await page.getByTestId('matriz-plegar-Distrito Norte').click();
    await expect(page.getByTestId('matriz-fila-Distrito Norte||Penal')).toBeVisible();
  });

  test('pulsar un encabezado ordena, y lo anuncia en aria-sort', async ({ page }) => {
    const encabezado = page.locator('th', { has: page.getByTestId('matriz-ordenar-total-0') });
    await expect(encabezado).toHaveAttribute('aria-sort', 'none');

    await page.getByTestId('matriz-ordenar-total-0').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'ascending');
    await page.getByTestId('matriz-ordenar-total-0').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'descending');
  });
});

test.describe('la tabla se ordena por su encabezado', () => {
  test('pulsar la columna ordena las filas y alterna la direccion', async ({ page }) => {
    /*
     * Es lo primero que alguien intenta hacer con una tabla, y no pasaba nada. El objeto declaraba
     * «columnas ordenables» en su propio changelog desde la version inicial y la capacidad no
     * existia: un encabezado que no responde ensena que la tabla no se ordena, y quien lo prueba
     * una vez no lo vuelve a intentar.
     */
    await entrarComo(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
    const tabla = page.getByTestId('tabla').first();
    await expect(tabla).toBeVisible();

    const primeraColumna = await tabla.locator('thead th').first().innerText();
    const boton = tabla.locator('thead th').first().locator('button');
    const valores = () => tabla.locator('tbody tr td:first-child').allInnerTexts();

    await boton.click();
    const asc = await valores();
    await boton.click();
    const desc = await valores();

    expect(asc.length).toBeGreaterThan(1);
    expect(desc).toEqual([...asc].reverse());
    expect(primeraColumna.length).toBeGreaterThan(0);
  });
});
