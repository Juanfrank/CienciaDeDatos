import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/** Elementos y contenedores. */

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-admin');
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
    await expect(page.getByTestId('titulo-de-seccion').first()).toBeVisible();
    await expect(page.getByTestId('linea-divisoria').first()).toBeVisible();
    await expect(page.getByTestId('forma').first()).toBeVisible();
    // Ningun objeto marcado como roto: un elemento no tiene dataset, y la validacion tiene que
    // saberlo en vez de exigirle uno.
    await expect(page.getByTestId('objeto-roto')).toHaveCount(0);
  });

  test('un cuadrado es cuadrado, no un rectangulo estirado a la celda', async ({ page }) => {
    await page.goto('/m/composicion/elementos');
    const circulo = page.locator('[data-forma="circulo"] .forma__cuerpo');
    const caja = await circulo.boundingBox();
    expect(caja).not.toBeNull();
    expect(Math.abs((caja?.width ?? 0) - (caja?.height ?? 0))).toBeLessThan(2);
  });

  test('el conector nace y muere en los bordes de los dos objetos que une', async ({ page }) => {
    await page.goto('/m/composicion/elementos');
    // El trazado se calcula en un efecto, con el DOM ya medido: antes de eso el conector dice que
    // le faltan extremos. Esperarlo no es tolerar lentitud, es que la geometria no existe hasta
    // que el navegador ha repartido la rejilla.
    await expect(page.locator('.conexion path')).toHaveCount(2);

    const medir = async () => {
      return page.evaluate(() => {
        // `> path` y no `path`: dentro del `<defs>` esta la punta de flecha, que iria primero.
        const svg = document.querySelector('.conexion > path');
        const a = document.querySelector('[data-testid="celda-flujo-origen"]');
        const b = document.querySelector('[data-testid="celda-flujo-destino"]');
        if (!svg || !a || !b) return null;
        const d = svg.getAttribute('d') ?? '';
        const [, x0 = '0', y0 = '0'] = /M\s*([-\d.]+)\s*([-\d.]+)/.exec(d) ?? [];
        const puntos = [...d.matchAll(/L\s*([-\d.]+)\s*([-\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
        const fin = puntos[puntos.length - 1] ?? [0, 0];
        const rejilla = document.querySelector('.rejilla');
        if (!rejilla) return null;
        const base = rejilla.getBoundingClientRect();
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return {
          inicio: [Number(x0), Number(y0)],
          fin,
          derechaDeA: ra.right - base.left,
          izquierdaDeB: rb.left - base.left,
        };
      });
    };

    const before = await medir();
    expect(before).not.toBeNull();
    expect(Math.abs((before?.inicio[0] ?? 0) - (before?.derechaDeA ?? 0))).toBeLessThan(2);
    expect(Math.abs((before?.fin[0] ?? 0) - (before?.izquierdaDeB ?? 0))).toBeLessThan(2);

    // Y sigue pegado tras redimensionar: es la propiedad que distingue un conector de una raya
    // dibujada encima, y la unica forma de comprobarla es cambiando la geometria de verdad.
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.waitForTimeout(400);
    const after = await medir();
    expect(Math.abs((after?.inicio[0] ?? 0) - (after?.derechaDeA ?? 0))).toBeLessThan(2);
    expect(after?.fin[0]).not.toBe(before?.fin[0]);
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
    const contenedor = page.getByTestId('celda-cont-pestanas');
    const before = await contenedor.boundingBox();

    await page.getByTestId('pestana-p2').click();
    await expect(page.getByTestId('contenedor-con-pestanas').getByTestId('matriz')).toBeVisible();

    const after = await contenedor.boundingBox();
    // Es la regla que el contenido de la segunda pestana —una matriz de varias filas— romperia si
    // el alto lo mandara lo que hay dentro en vez de la rejilla.
    expect(after?.x).toBe(before?.x);
    expect(after?.y).toBe(before?.y);
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
  });

  test('cada pestana tiene su propia disposicion, no la misma con otros datos', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    await expect(page.getByTestId('grafico-cp-barras')).toBeVisible();
    await page.getByTestId('pestana-p2').click();
    // La segunda lleva dos objetos donde la primera llevaba uno: son disposiciones distintas, no
    // la misma rejilla con contenido cambiado.
    await expect(page.getByTestId('contenedor-con-pestanas').getByTestId('matriz')).toBeVisible();
    await expect(page.getByTestId('contenedor-con-pestanas').getByTestId('kpi-valor')).toBeVisible();
    /*
     * La pestana inactiva se OCULTA, no se desmonta.
     */
    await expect(page.getByTestId('grafico-cp-barras')).toBeHidden();
  });

  test('el ampliable abre una ventana con su propia rejilla y se cierra explicitamente', async ({ page }) => {
    await page.goto('/m/composicion/contenedores');
    await expect(page.getByTestId('ampliado')).toHaveCount(0);
    await page.getByTestId('ampliar').click();

    const ventana = page.getByTestId('ampliado');
    await expect(ventana).toBeVisible();
    const columnasFuera = await page
      .getByTestId('contenedor-ampliable')
      .locator('.contenedor__rejilla')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    const columnasDentro = await ventana
      .locator('.contenedor__rejilla')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columnasDentro).toBeGreaterThan(columnasFuera);

    // El cierre es un control, no «pulsar fuera»: quien navega con teclado se quedaria dentro.
    await page.getByTestId('cerrar-ampliado').click();
    await expect(page.getByTestId('ampliado')).toHaveCount(0);
  });

});

test.describe('la seccion Objetos del editor', () => {
  /** Un borrador nuevo: el editor abre lo que se esta construyendo, no lo ya publicado. */
  const borrador = async (page: import('@playwright/test').Page) => {
    const slug = `objetos-${Date.now().toString(36)}`;
    await page.goto('/editor');
    await page.getByTestId('nuevo-modulo-nombre').fill(`Modulo ${slug}`);
    await page.getByTestId('nuevo-modulo-slug').fill(slug);
    await page.getByTestId('crear-modulo').click();
    await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();
    await page.goto(`/editor/${slug}`);
    return slug;
  };

  test('tres subsecciones, abiertas de inicio y plegables', async ({ page }) => {
    await borrador(page);
    for (const id of ['seccion-visualizaciones', 'seccion-elementos', 'seccion-contenedores']) {
      await expect(page.getByTestId(id)).toHaveAttribute('open', '');
    }
    // Plegable, no solo abierta: es lo que pedia el requisito, y `<details>` sin `open` es lo que
    // un lector de pantalla anuncia como contraido.
    await page.getByTestId('seccion-elementos').locator('> summary').click();
    await expect(page.getByTestId('seccion-elementos')).not.toHaveAttribute('open', '');
  });

  test('los elementos y los contenedores se ofrecen para colocar', async ({ page }) => {
    await borrador(page);
    await expect(page.getByTestId('anadir-cuadro-de-texto')).toBeVisible();
    await expect(page.getByTestId('anadir-linea-divisoria')).toBeVisible();
    await expect(page.getByTestId('anadir-contenedor-con-pestanas')).toBeVisible();
  });

  test('un elemento se coloca sin pasar por Datos, porque no los tiene', async ({ page }) => {
    await borrador(page);
    await page.getByTestId('anadir-cuadro-de-texto').click();
    await expect(page.getByTestId('cuadro-de-texto')).toBeVisible();
    // La pestana Datos se deshabilita: un cuadro de texto abriria un desplegable de datasets y
    // cero pozos, una pantalla donde no hay nada que hacer.
    await expect(page.getByTestId('pestana-datos')).toBeDisabled();
    await expect(page.getByTestId('pestana-formato')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('los dos carriles de pantalla', () => {
  /** La caja de un elemento frente al banner y a la ventana. */
  const medir = (page: import('@playwright/test').Page, selector: string) =>
    page.evaluate((sel) => {
      const banner = document.querySelector('.cabecera');
      const carril = document.querySelector(sel);
      if (!banner || !carril) return null;
      const b = banner.getBoundingClientRect();
      const c = carril.getBoundingClientRect();
      return {
        arriba: Math.round(c.top),
        bajoElBanner: Math.round(b.bottom),
        abajo: Math.round(c.bottom),
        izquierda: Math.round(c.left),
        derecha: Math.round(c.right),
        ventanaAlto: window.innerHeight,
        ventanaAncho: window.innerWidth,
      };
    }, selector);

  test('el arbol de navegacion ocupa todo el lado izquierdo bajo el banner', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    // Un modulo largo: es el caso que fallaba. El carril media lo que midiera el contenido de al
    // lado, asi que en un modulo corto se quedaba a media pantalla y en uno largo se pasaba.
    await page.goto('/m/composicion/contenedores');
    const c = await medir(page, '.lateral');
    expect(c).not.toBeNull();
    expect(c?.izquierda).toBe(0);
    expect(c?.arriba).toBe(c?.bajoElBanner);
    expect(c?.abajo).toBe(c?.ventanaAlto);
  });

  test('el panel de objetos ocupa todo el lado derecho bajo el banner', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const slug = `carril-${Date.now().toString(36)}`;
    await page.goto('/editor');
    await page.getByTestId('nuevo-modulo-nombre').fill('Carriles');
    await page.getByTestId('nuevo-modulo-slug').fill(slug);
    await page.getByTestId('crear-modulo').click();
    await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();
    await page.goto(`/editor/${slug}`);

    const c = await medir(page, '.panel-editor');
    expect(c).not.toBeNull();
    expect(c?.derecha).toBe(c?.ventanaAncho);
    expect(c?.arriba).toBe(c?.bajoElBanner);
    expect(c?.abajo).toBe(c?.ventanaAlto);
  });

  test('el taller se desplaza por dentro: el carril no se mueve con el', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    const slug = `scroll-${Date.now().toString(36)}`;
    await page.goto('/editor');
    await page.getByTestId('nuevo-modulo-nombre').fill('Desplazar');
    await page.getByTestId('nuevo-modulo-slug').fill(slug);
    await page.getByTestId('crear-modulo').click();
    await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();
    await page.goto(`/editor/${slug}`);

    const before = await medir(page, '.panel-editor');
    await page.locator('.taller__obra').evaluate((el) => el.scrollBy(0, 400));
    await page.waitForTimeout(200);
    const after = await medir(page, '.panel-editor');
    // Es la razon de que el carril sea hermano de la columna que se desplaza y no viva dentro de
    // ella: con `sticky` dentro, bajar por el lienzo lo arrastraba unos pixeles antes de fijarlo.
    expect(after?.arriba).toBe(before?.arriba);
    expect(after?.abajo).toBe(before?.abajo);
  });
});
