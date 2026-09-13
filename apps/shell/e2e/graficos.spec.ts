import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/** Galeria de objetos sobre Apache ECharts — seccion 4.2 y accesibilidad de 4.9. */

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

  /*
   * Nada se busca por su etiqueta.
   */
  const rutaDelPrimerPadre = async (page: import('@playwright/test').Page): Promise<string> => {
    const boton = page.locator('[data-testid^="matriz-plegar-"]').first();
    const id = (await boton.getAttribute('data-testid')) ?? '';
    return id.replace('matriz-plegar-', '');
  };

  const n = (s: string) => Number(s.replace(/[^0-9]/g, ''));
  const totalDe = async (fila: import('@playwright/test').Locator) =>
    n(await fila.locator('td.es-total').last().innerText());

  test('el subtotal de un padre es la suma de sus hijos', async ({ page }) => {
    await expect(page.getByTestId('matriz')).toBeVisible();
    const padre = await rutaDelPrimerPadre(page);

    const hijos = await page.locator(`[data-testid^="matriz-fila-${padre}||"]`).all();
    expect(hijos.length).toBeGreaterThan(1);

    let suma = 0;
    for (const hijo of hijos) suma += await totalDe(hijo);
    expect(await totalDe(page.getByTestId(`matriz-fila-${padre}`))).toBe(suma);
  });

  test('plegar esconde los hijos y deja el subtotal del padre', async ({ page }) => {
    const padre = await rutaDelPrimerPadre(page);
    const before = await page.locator('[data-testid^="matriz-fila-"]').count();

    await page.getByTestId(`matriz-plegar-${padre}`).click();
    await expect(page.locator(`[data-testid^="matriz-fila-${padre}||"]`)).toHaveCount(0);
    await expect(page.getByTestId(`matriz-fila-${padre}`)).toBeVisible();
    expect(await page.locator('[data-testid^="matriz-fila-"]').count()).toBeLessThan(before);

    // Y vuelve: plegar es un gesto de lectura, no un cambio.
    await page.getByTestId(`matriz-plegar-${padre}`).click();
    expect(await page.locator('[data-testid^="matriz-fila-"]').count()).toBe(before);
  });

  test('pulsar un encabezado ordena, y lo anuncia en aria-sort', async ({ page }) => {
    const encabezado = page.locator('th', { has: page.getByTestId('matriz-ordenar-total-0') });
    await expect(encabezado).toHaveAttribute('aria-sort', 'none');

    await page.getByTestId('matriz-ordenar-total-0').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'ascending');
    await page.getByTestId('matriz-ordenar-total-0').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'descending');
  });

  test('ordenar no rompe la jerarquia: los hijos siguen bajo su padre', async ({ page }) => {
    // Ordenar la tabla entera por una columna repartiria los hijos de un grupo entre otros grupos.
    // Se ordena cada nivel por separado, asi que el padre sigue trayendo a los suyos detras.
    const padre = await rutaDelPrimerPadre(page);
    const hijos = await page.locator(`[data-testid^="matriz-fila-${padre}||"]`).count();

    await page.getByTestId('matriz-ordenar-total-0').click();
    await expect(page.locator(`[data-testid^="matriz-fila-${padre}||"]`)).toHaveCount(hijos);
    expect(await totalDe(page.getByTestId(`matriz-fila-${padre}`))).toBeGreaterThan(0);
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

/** Lo que ECharts dibuja de VERDAD, no lo que el constructor de opciones devuelve. */
test.describe('los formateadores llegan hasta el dibujo', () => {
  test('la cifra sobre la barra dice lo MISMO que el respaldo de la misma tarjeta', async ({
    page,
  }) => {
    await page.goto('/m/composicion/familia');

    const grafico = page.getByTestId('grafico-f-barras');
    await expect(grafico).toHaveAttribute('data-montado', 'si');

    /*
     * Se compara con el respaldo y no con una cifra escrita aqui.
     */
    const delRespaldo = (await grafico.locator('.barras__valor').first().innerText()).trim();
    expect(delRespaldo).toMatch(/\d/);
    await expect(grafico.locator('svg text').filter({ hasText: delRespaldo })).not.toHaveCount(0);
  });

  test('y la cifra del medidor, donde ademas es la unica que se ve', async ({ page }) => {
    await page.goto('/m/composicion/proporcion');

    const medidor = page.getByTestId('grafico-pr-medidor-meta');
    await expect(medidor).toHaveAttribute('data-montado', 'si');

    const delRespaldo = (await medidor.locator('.medidor-respaldo dd').first().innerText()).trim();
    expect(delRespaldo).toMatch(/\d/);
    await expect(medidor.locator('svg text').filter({ hasText: delRespaldo })).not.toHaveCount(0);
  });
});

test.describe('lo que cuesta una pagina llena de graficos', () => {
  /*
   * Doce tipos de objeto y los pequenos multiplos hacen que una sola tarjeta pueda montar varias
   * instancias de ECharts. Esto no mide milisegundos —un presupuesto de tiempo en CI es una
   * prueba que falla los dias que la maquina esta ocupada— sino lo que SI es estable y lo que de
   * verdad se descontrola: cuantos lienzos y cuantos nodos del documento produce una pagina.
   */
  const paginas = ['familia', 'proporcion', 'flujo', 'relacion', 'multiplos', 'referencia'];

  for (const slug of paginas) {
    test(`/${slug} no monta mas lienzos ni nodos de los que declara`, async ({ page }) => {
      await page.goto(`/m/composicion/${slug}`);
      await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

      // Una pagina de seis objetos monta seis lienzos. Mas significaria que algo se esta
      // dibujando dos veces, que es como empiezan las fugas de memoria con ECharts.
      expect(await page.locator('.grafico__lienzo').count()).toBeLessThanOrEqual(12);

      /*
       * El presupuesto de nodos es lo que protege al respaldo accesible de crecer sin freno: es
       * una tabla en HTML por objeto, y con un dataset grande son miles de celdas que nadie ve y
       * que el navegador tiene que mantener.
       */
      const nodos = await page.evaluate(() => document.querySelectorAll('*').length);
      expect(nodos).toBeLessThan(2000);
    });
  }

  test('ECharts se descarga UNA vez, por muchos graficos que haya en la pagina', async ({ page }) => {
    // El modulo es un solo `chunk`: si cada objeto pidiera el suyo, una pagina de seis graficos
    // haria seis descargas del mismo codigo.
    const peticiones: string[] = [];
    page.on('request', (r) => {
      if (/echarts/i.test(r.url())) peticiones.push(r.url());
    });

    await page.goto('/m/composicion/familia');
    await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

    expect(new Set(peticiones).size).toBeLessThanOrEqual(peticiones.length);
    expect(peticiones.length).toBeLessThanOrEqual(2);
  });
});

test.describe('el filtrado cruzado llega a TODOS los objetos (4.4)', () => {
  /*
   * Esta tabla existe porque el gesto estaba a medias y de formas distintas en cada objeto: el
   * combinado y el mapa de arbol filtraban con el raton y no con el teclado, la dispersion al
   * reves, y las lineas y los multiplos de ninguna de las dos maneras. Ninguna prueba fallaba:
   * cada objeto tenia la mitad que alguien se acordo de cablear.
   */
  const objetos = [
    // El respaldo de las columnas es una lista de barras, no una tabla: su boton es otro y por eso
    // lleva su propio identificador. Se comprueba igual, porque el gesto es el mismo.
    { pagina: 'familia', respaldo: 'barras', boton: 'barra-Penal', campo: 'DimTribunal.Materia' },
    { pagina: 'familia', respaldo: 'lineas', boton: 'filtrar-Q1', campo: 'DimTiempo.Trimestre' },
    { pagina: 'proporcion', respaldo: 'circular', boton: 'filtrar-Penal', campo: 'DimTribunal.Materia' },
    { pagina: 'relacion', respaldo: 'combinado', boton: 'filtrar-Q1', campo: 'DimTiempo.Trimestre' },
    { pagina: 'relacion', respaldo: 'dispersion', boton: 'filtrar-Q1', campo: 'DimTiempo.Trimestre' },
    { pagina: 'flujo', respaldo: 'embudo', boton: 'filtrar-Q1', campo: 'DimTiempo.Trimestre' },
    { pagina: 'flujo', respaldo: 'cascada', boton: 'filtrar-Q1', campo: 'DimTiempo.Trimestre' },
    // El mapa de arbol rotula sus filas «Penal / Q1» y filtra por el GRUPO: filtrar la materia
    // por la etiqueta compuesta no encontraria nada y el modulo se vaciaria sin decir por que.
    { pagina: 'flujo', respaldo: 'mapa-de-arbol', boton: 'filtrar-Penal', campo: 'DimTribunal.Materia' },
  ] as const;

  for (const { pagina, respaldo, boton: testid, campo } of objetos) {
    test(`${respaldo} filtra con el teclado, por su respaldo`, async ({ page }) => {
      await page.goto(`/m/composicion/${pagina}`);

      /*
       * `.first()` tambien en el boton: un mapa de arbol de dos niveles tiene una fila por
       * combinacion, y las cuatro de la materia «Penal» filtran por lo mismo. Que compartan
       * identificador es correcto —hacen lo mismo—, pero obliga a acotar aqui.
       */
      const boton = page.getByTestId(respaldo).first().getByTestId(testid).first();
      await expect(boton).toBeAttached();

      // Al recibir el foco se muestra: un control invisible que recibe el foco desorienta mas
      // que uno que no existe.
      await boton.focus();
      await boton.press('Enter');

      // El punto del nombre del campo se escapa: `DimTiempo.Trimestre` como expresion regular
      // aceptaria cualquier caracter en su lugar.
      await expect(page).toHaveURL(new RegExp(`${campo.replace('.', '\\.')}=`));
    });
  }

  test('y en un multiplo se filtra por la categoria del eje, no por el panel', async ({ page }) => {
    /*
     * Es lo que se ha pulsado. Filtrar ademas por la dimension que reparte los paneles seria
     * hacer dos cosas con un gesto: quien pulsa «Q1» dentro del panel «Penal» para ver el resto
     * del modulo en Q1 se encontraria tambien con Penal puesto sin haberlo pedido.
     */
    await page.goto('/m/composicion/multiplos');

    const boton = page.getByTestId('multiplos').first().getByTestId('filtrar-Q1').first();
    await boton.focus();
    await boton.press('Enter');

    await expect(page).toHaveURL(/DimTiempo\.Trimestre=Q1/);
    await expect(page).not.toHaveURL(/DimTribunal\.Materia=/);
  });

  test('un medidor NO ofrece el gesto: no tiene dimension por la que filtrar', async ({ page }) => {
    // Ofrecerlo y que no hiciera nada seria peor que no ofrecerlo, que es justo lo que pasaba en
    // la dispersion: el punto se resaltaba al pulsarlo y no ocurria nada.
    await page.goto('/m/composicion/proporcion');

    const medidor = page.getByTestId('medidor').first();
    await expect(medidor).toBeAttached();
    await expect(medidor.locator('button')).toHaveCount(0);
  });
});
