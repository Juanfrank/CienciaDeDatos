import { expect, test } from './instance';
import { asLogin } from './session';

/** Elementos y contenedores. */

test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-admin');
});

test.describe('elementos (no leen datos)', () => {
  test('un modulo lleno de elementos no aparece sin datos ni degradado', async ({ page }) => {
    await page.goto('/m/composicion/elementos');
    // La cabecera decia «Sin datos poblados todavia» porque los objetos que si leen vivian dentro
    // de otro objeto y su frescura no subia. Es el aviso que la gente mira para saber si fiarse.
    await expect(page.getByTestId('frescura')).toContainText('Datos actualizados');
  });

  test('cada elemento se dibuja, y ninguno pide un dataset que no declaro', async ({ page }) => {
    await page.goto('/m/composicion/elementos');
    await expect(page.getByTestId('cuadro-de-texto')).toBeVisible();
    await expect(page.getByTestId('title-de-seccion').first()).toBeVisible();
    await expect(page.getByTestId('linea-divisoria').first()).toBeVisible();
    await expect(page.getByTestId('forma').first()).toBeVisible();
    // Ningun objeto marcado como roto: un elemento no tiene dataset, y la validacion tiene que
    // saberlo en vez de exigirle uno.
    await expect(page.getByTestId('object-broken')).toHaveCount(0);
  });

  test('un cuadrado es cuadrado, no un rectangulo estirado a la celda', async ({ page }) => {
    await page.goto('/m/composicion/elementos');
    const circulo = page.locator('[data-shape="circulo"] .shape__body');
    const box = await circulo.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThan(2);
  });

  test('el conector nace y muere en los bordes de los dos objetos que une', async ({ page }) => {
    await page.goto('/m/composicion/elementos');
    // El trazado se calcula en un efecto, con el DOM ya medido: antes de eso el conector dice que
    // le faltan extremos. Esperarlo no es tolerar lentitud, es que la geometria no existe hasta
    // que el navegador ha repartido la rejilla.
    await expect(page.locator('.conexion path')).toHaveCount(2);

    const resize = async () => {
      return page.evaluate(() => {
        // `> path` y no `path`: dentro del `<defs>` esta la punta de flecha, que iria primero.
        const svg = document.querySelector('.conexion > path');
        const a = document.querySelector('[data-testid="cell-flujo-origen"]');
        const b = document.querySelector('[data-testid="cell-flujo-destino"]');
        if (!svg || !a || !b) return null;
        const d = svg.getAttribute('d') ?? '';
        const [, x0 = '0', y0 = '0'] = /M\s*([-\d.]+)\s*([-\d.]+)/.exec(d) ?? [];
        const puntos = [...d.matchAll(/L\s*([-\d.]+)\s*([-\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
        const end = puntos[puntos.length - 1] ?? [0, 0];
        const rejilla = document.querySelector('.rejilla');
        if (!rejilla) return null;
        const base = rejilla.getBoundingClientRect();
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return {
          home: [Number(x0), Number(y0)],
          end,
          derechaDeA: ra.right - base.left,
          izquierdaDeB: rb.left - base.left,
        };
      });
    };

    const before = await resize();
    expect(before).not.toBeNull();
    expect(Math.abs((before?.home[0] ?? 0) - (before?.derechaDeA ?? 0))).toBeLessThan(2);
    expect(Math.abs((before?.end[0] ?? 0) - (before?.izquierdaDeB ?? 0))).toBeLessThan(2);

    // Y sigue pegado tras redimensionar: es la propiedad que distingue un conector de una raya
    // dibujada encima, y la unica forma de comprobarla es cambiando la geometria de verdad.
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.waitForTimeout(400);
    const after = await resize();
    expect(Math.abs((after?.home[0] ?? 0) - (after?.derechaDeA ?? 0))).toBeLessThan(2);
    expect(after?.end[0]).not.toBe(before?.end[0]);
  });
});

test.describe('contenedores', () => {
  test('los cinco se dibujan con su contenido dentro', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    await expect(page.getByTestId('contenedor-simple')).toBeVisible();
    await expect(page.getByTestId('contenedor-desplazable')).toBeVisible();
    await expect(page.getByTestId('contenedor-con-pestanas')).toBeVisible();
    await expect(page.getByTestId('contenedor-ampliable')).toBeVisible();
    // Lo de dentro se lee por el MISMO camino que lo de fuera: si no, la cifra no estaria aqui.
    await expect(page.getByTestId('contenedor-simple').getByTestId('tabla')).toHaveCount(0);
    await expect(page.getByTestId('contenedor-desplazable').getByTestId('tabla')).toBeVisible();
  });

  test('el desplazable se desplaza por UN eje, nunca por los dos', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    const ejes = await page.getByTestId('contenedor-desplazable').evaluate((el) => {
      const s = getComputedStyle(el);
      return { x: s.overflowX, y: s.overflowY };
    });
    // Y el que no se eligio esta en `hidden` explicito: con `auto`, la segunda barra apareceria
    // sola en cuanto un filtro alargara el contenido.
    expect([ejes.x, ejes.y].filter((v) => v === 'auto' || v === 'scroll')).toHaveLength(1);
    expect([ejes.x, ejes.y]).toContain('hidden');
  });

  test('cambiar de pestana no mueve el contenedor ni cambia lo que ocupa', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    const contenedor = page.getByTestId('cell-cont-pestanas');
    // Se mide DESPUES de que la primera pestana haya dibujado. ECharts monta en un segundo
    // pintado: midiendo nada mas cargar, `before` sale de una disposicion que todavia se esta
    // asentando y la comparacion falla por cuatro pixeles bajo carga, sin que nada se haya movido.
    await expect(page.getByTestId('chart-cp-barras')).toHaveAttribute('data-montado', 'si');

    /*
     * Se mide contra el DOCUMENTO, no contra la ventana.
     *
     * `boundingBox()` da coordenadas de viewport, y pulsar una pestana que esta por debajo del
     * pliegue desplaza la pagina para alcanzarla: el contenedor salia «movido» 359 px sin haberse
     * movido ni un pixel. La prueba decia algo verdadero por una razon falsa —que la pagina cabia
     * entera— y dejo de pasar en cuanto la pagina crecio. `offsetTop` no depende del desplazamiento.
     */
    const caja = async () =>
      await contenedor.evaluate((el) => {
        const e = el as HTMLElement;
        return { x: e.offsetLeft, y: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight };
      });
    const before = await caja();

    await page.getByTestId('tab-p2').click();
    await expect(page.getByTestId('contenedor-con-pestanas').getByTestId('matriz')).toBeVisible();

    const after = await caja();
    // Es la regla que el contenido de la segunda pestana —una matriz de varias filas— romperia si
    // el alto lo mandara lo que hay dentro en vez de la rejilla.
    expect(after?.x).toBe(before?.x);
    expect(after?.y).toBe(before?.y);
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
  });

  test('cada pestana tiene su propia disposicion, no la misma con otros datos', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    await expect(page.getByTestId('chart-cp-barras')).toBeVisible();
    await page.getByTestId('tab-p2').click();
    // La segunda lleva dos objetos donde la primera llevaba uno: son disposiciones distintas, no
    // la misma rejilla con contenido cambiado.
    await expect(page.getByTestId('contenedor-con-pestanas').getByTestId('matriz')).toBeVisible();
    await expect(page.getByTestId('contenedor-con-pestanas').getByTestId('value-kpi')).toBeVisible();
    /*
     * La pestana inactiva se OCULTA, no se desmonta.
     */
    await expect(page.getByTestId('chart-cp-barras')).toBeHidden();
  });

  test('el ampliable abre una ventana con su propia rejilla y se cierra explicitamente', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    await expect(page.getByTestId('ampliado')).toHaveCount(0);
    await page.getByTestId('ampliar').click();

    const ventana = page.getByTestId('ampliado');
    await expect(ventana).toBeVisible();
    const outsideColumns = await page
      .getByTestId('contenedor-ampliable')
      .locator('.container__grid')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    const insideColumns = await ventana
      .locator('.container__grid')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(insideColumns).toBeGreaterThan(outsideColumns);

    // El cierre es un control, no «pulsar fuera»: quien navega con teclado se quedaria dentro.
    await page.getByTestId('close-expanded').click();
    await expect(page.getByTestId('ampliado')).toHaveCount(0);
  });

});

test.describe('la seccion Objetos del editor', () => {
  /** Un borrador nuevo: el editor abre lo que se esta construyendo, no lo ya publicado. */
  const borrador = async (page: import('@playwright/test').Page) => {
    const slug = `objetos-${Date.now().toString(36)}`;
    await page.goto('/editor');
    await page.getByTestId('new-module-name').fill(`Modulo ${slug}`);
    await page.getByTestId('new-module-slug').fill(slug);
    await page.getByTestId('create-module').click();
    await expect(page.getByTestId(`row-${slug}`)).toBeVisible();
    await page.goto(`/editor/${slug}`);
    return slug;
  };

  test('tres subsecciones, abiertas de inicio y plegables', async ({ page }) => {
    await borrador(page);
    for (const id of ['visualization-section', 'element-section', 'container-section']) {
      await expect(page.getByTestId(id)).toHaveAttribute('open', '');
    }
    // Plegable, no solo abierta: es lo que pedia el requisito, y `<details>` sin `open` es lo que
    // un lector de pantalla anuncia como contraido.
    await page.getByTestId('element-section').locator('> summary').click();
    await expect(page.getByTestId('element-section')).not.toHaveAttribute('open', '');
  });

  test('los elementos y los contenedores se ofrecen para colocar', async ({ page }) => {
    await borrador(page);
    await expect(page.getByTestId('add-cuadro-de-texto')).toBeVisible();
    await expect(page.getByTestId('add-linea-divisoria')).toBeVisible();
    await expect(page.getByTestId('add-contenedor-con-pestanas')).toBeVisible();
  });

  test('un elemento se coloca sin pasar por Datos, porque no los tiene', async ({ page }) => {
    await borrador(page);
    await page.getByTestId('add-cuadro-de-texto').click();
    await expect(page.getByTestId('cuadro-de-texto')).toBeVisible();
    // La pestana Datos se deshabilita: un cuadro de texto abriria un desplegable de datasets y
    // cero pozos, una pantalla donde no hay nada que hacer.
    await expect(page.getByTestId('tab-datos')).toBeDisabled();
    await expect(page.getByTestId('tab-formato')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('los dos carriles de pantalla', () => {
  /** La caja de un elemento frente al banner y a la ventana. */
  const resize = (page: import('@playwright/test').Page, picker: string) =>
    page.evaluate((sel) => {
      const banner = document.querySelector('.cabecera');
      const rail = document.querySelector(sel);
      if (!banner || !rail) return null;
      const b = banner.getBoundingClientRect();
      const c = rail.getBoundingClientRect();
      return {
        arriba: Math.round(c.top),
        bajoElBanner: Math.round(b.bottom),
        abajo: Math.round(c.bottom),
        izquierda: Math.round(c.left),
        derecha: Math.round(c.right),
        ventanaAlto: window.innerHeight,
        ventanaAncho: window.innerWidth,
      };
    }, picker);

  test('el arbol de navegacion ocupa todo el lado izquierdo bajo el banner', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    // Un modulo largo: es el caso que fallaba. El carril media lo que midiera el contenido de al
    // lado, asi que en un modulo corto se quedaba a media pantalla y en uno largo se pasaba.
    await page.goto('/m/composicion/contenedores');
    const c = await resize(page, '.lateral');
    expect(c).not.toBeNull();
    expect(c?.izquierda).toBe(0);
    expect(c?.arriba).toBe(c?.bajoElBanner);
    expect(c?.abajo).toBe(c?.ventanaAlto);
  });

  test('el panel de objetos ocupa todo el lado derecho bajo el banner', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const slug = `carril-${Date.now().toString(36)}`;
    await page.goto('/editor');
    await page.getByTestId('new-module-name').fill('Carriles');
    await page.getByTestId('new-module-slug').fill(slug);
    await page.getByTestId('create-module').click();
    await expect(page.getByTestId(`row-${slug}`)).toBeVisible();
    await page.goto(`/editor/${slug}`);

    const c = await resize(page, '.editor-panel');
    expect(c).not.toBeNull();
    expect(c?.derecha).toBe(c?.ventanaAncho);
    expect(c?.arriba).toBe(c?.bajoElBanner);
    expect(c?.abajo).toBe(c?.ventanaAlto);
  });

  test('el taller se desplaza por dentro: el carril no se mueve con el', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    const slug = `scroll-${Date.now().toString(36)}`;
    await page.goto('/editor');
    await page.getByTestId('new-module-name').fill('Desplazar');
    await page.getByTestId('new-module-slug').fill(slug);
    await page.getByTestId('create-module').click();
    await expect(page.getByTestId(`row-${slug}`)).toBeVisible();
    await page.goto(`/editor/${slug}`);

    const before = await resize(page, '.editor-panel');
    await page.locator('.taller__obra').evaluate((el) => el.scrollBy(0, 400));
    await page.waitForTimeout(200);
    const after = await resize(page, '.editor-panel');
    // Es la razon de que el carril sea hermano de la columna que se desplaza y no viva dentro de
    // ella: con `sticky` dentro, bajar por el lienzo lo arrastraba unos pixeles antes de fijarlo.
    expect(after?.arriba).toBe(before?.arriba);
    expect(after?.abajo).toBe(before?.abajo);
  });
});

test.describe('contenedor expandible: se abre EN SU SITIO y empuja lo de abajo', () => {
  test('al abrirlo, lo que tiene debajo se desplaza hacia abajo', async ({ page }) => {
    /*
     * Se mide la POSICION real en pantalla, no una clase ni un atributo.
     *
     * Que la celda diga que ocupa mas filas no prueba nada: lo que hay que comprobar es que el
     * vecino de abajo no se quede tapado, y eso solo lo dice su caja. Es ademas la diferencia
     * entera con el contenedor ampliable, que abre una ventana ENCIMA y deja lo de debajo donde
     * estaba.
     *
     * Se mira en el modulo publicado y no en el editor: en el lienzo cada objeto lleva encima su
     * capa de seleccion —ahi se eligen, no se usan— y el chiclet no llegaria a recibir el clic.
     */
    await page.goto('/m/composicion/contenedores');

    const chiclet = page.getByTestId('chiclet');
    await expect(chiclet).toBeVisible();
    await expect(chiclet).toHaveAttribute('aria-expanded', 'false');

    // El siguiente del arbol, no el primero de la pagina: el expandible va arriba del todo.
    const arribaDelSiguiente = async () =>
      (await page.getByTestId('cell-cont-simple').boundingBox())?.y ?? 0;
    const cerrado = await arribaDelSiguiente();
    expect(cerrado).toBeGreaterThan(0);

    await chiclet.click();
    await expect(chiclet).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => await arribaDelSiguiente()).toBeGreaterThan(cerrado);

    // Y al plegarlo vuelve a su sitio: abrir no puede dejar un hueco permanente.
    await chiclet.click();
    await expect(chiclet).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => await arribaDelSiguiente()).toBe(cerrado);
  });

  test('el panel se oculta, no se desmonta: lo de dentro sobrevive al plegarlo', async ({ page }) => {
    // Desmontarlo tiraria lo que alguien hubiera elegido en un filtro del contenido, que es justo
    // lo que no puede pasar en el caso que lo motivo.
    await page.goto('/m/composicion/contenedores');

    const panel = page.locator('.contenedor-expandible__panel');
    await expect(panel).toBeHidden();
    await page.getByTestId('chiclet').click();
    await expect(panel).toBeVisible();
    await page.getByTestId('chiclet').click();
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeHidden();
  });

  test('cerrado ocupa UNA fila, por alto que lo pusieran en el lienzo', async ({ page }) => {
    // Un chiclet que reservara cuatro filas vacias no seria un chiclet.
    await page.goto('/m/composicion/contenedores');
    const celda = await page.getByTestId('cell-cont-expandible').boundingBox();
    const vecina = await page.getByTestId('cell-cont-simple').boundingBox();
    expect(celda?.height ?? 0).toBeLessThan(vecina?.height ?? 0);
  });
});
