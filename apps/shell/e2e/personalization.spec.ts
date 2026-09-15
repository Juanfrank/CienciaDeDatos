import { expect, test } from './instance';
import { asLogin } from './session';

/** Personalizacion por usuario — seccion 4.6. */

const MODULE = 'casos-pendientes';
const OCULTABLE = 'kpi-ingresados';

/** Deja el modulo sin personalizacion para esta persona. Las pruebas comparten el almacen. */
async function withoutCustomize(page: import('@playwright/test').Page): Promise<void> {
  await page.request.delete(`/api/modules/${MODULE}/view`);
}

test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
  await withoutCustomize(page);
});

test.describe('la vista se distingue de la institucional (4.6)', () => {
  test('sin personalizar, el modulo se anuncia como vista institucional oficial', async ({ page }) => {
    await page.goto(`/m/${MODULE}`);
    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
  });

  test('al ocultar un objeto, la vista pasa a anunciarse como personalizada', async ({ page }) => {
    await page.goto(`/m/${MODULE}`);
    await expect(page.getByTestId(`cell-${OCULTABLE}`)).toBeVisible();

    await page.getByTestId('my-view').click();
    await page.getByTestId(`see-${OCULTABLE}`).uncheck();
    await page.getByTestId('my-view-save').click();

    await expect(page.getByTestId('procedencia')).toContainText('personalizada');
    // Y el objeto deja de dibujarse: lo que no esta en la vista no se lee ni viaja al navegador.
    await expect(page.getByTestId(`cell-${OCULTABLE}`)).toHaveCount(0);

    await withoutCustomize(page);
  });

  test('siempre hay camino de vuelta a la vista oficial', async ({ page }) => {
    await page.request.put(`/api/modules/${MODULE}/view`, { data: { ocultos: [OCULTABLE] } });
    await page.goto(`/m/${MODULE}`);
    await expect(page.getByTestId('procedencia')).toContainText('personalizada');

    await page.getByTestId('my-view').click();
    await page.getByTestId('my-view-descartar').click();

    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
    await expect(page.getByTestId(`cell-${OCULTABLE}`)).toBeVisible();
  });
});

test.describe('colocar los objetos en la propia vista (2.2)', () => {
  /*
   * Se prueba por el TECLADO, no arrastrando.
   *
   * No es una comodidad de la prueba: 4.9 dice que la accesibilidad no se pospone, y el camino del
   * teclado es el que se rompe sin que nadie lo note, porque no es el que se usa al mirar la
   * pantalla. Si funciona por aqui, el arrastre —que corre sobre la misma operacion— tiene donde
   * apoyarse; al reves no.
   */
  /** El ultimo objeto de la pagina: debajo siempre hay sitio, porque la rejilla crece. */
  const ULTIMO = 'tabla-detalle';

  test('las flechas mueven el objeto, y la posicion se guarda', async ({ page }) => {
    await page.goto(`/m/${MODULE}`);
    await page.getByTestId('colocar').click();

    const foco = page.getByTestId(`reorganizar-foco-${ULTIMO}`);
    await expect(foco).toBeVisible();
    const antes = await foco.getAttribute('aria-label');

    await foco.focus();
    await page.keyboard.press('ArrowDown');

    // La etiqueta dice donde esta: es lo unico que anuncia el movimiento a quien no ve la rejilla,
    // asi que si no cambia, el gesto no existe para esa persona aunque el objeto se haya movido.
    await expect(foco).not.toHaveAttribute('aria-label', antes ?? '');

    await page.getByTestId('colocar-guardar').click();
    await expect(page.getByTestId('procedencia')).toContainText('personalizada');

    // Y lo guardado es la posicion, no un texto: se lee del propio registro.
    const guardada = await (await page.request.get(`/api/modules/${MODULE}/view`)).json();
    expect(guardada.posiciones[ULTIMO]).toBeDefined();

    await withoutCustomize(page);
  });

  test('Mayus con las flechas cambia el tamano', async ({ page }) => {
    await page.goto(`/m/${MODULE}`);
    await page.getByTestId('colocar').click();

    // Este objeto tiene vecinos a los cuatro lados, asi que no se puede mover — y estrecharlo si.
    // Sirve ademas de comprobacion de que los dos gestos son distintos y no uno disfrazado.
    const foco = page.getByTestId(`reorganizar-foco-${OCULTABLE}`);
    await expect(foco).toHaveAttribute('aria-label', /columna 4 a 6 de 12/);

    await foco.focus();
    await page.keyboard.press('ArrowRight');
    // Sigue igual: a la derecha esta el panel de filtros, y colocar no puede pisar.
    await expect(foco).toHaveAttribute('aria-label', /columna 4 a 6 de 12/);

    await page.keyboard.press('Shift+ArrowLeft');
    await expect(foco).toHaveAttribute('aria-label', /columna 4 a 5 de 12/);
  });

  test('el servidor no acepta una colocacion que pise otro objeto', async ({ page }) => {
    await page.goto(`/m/${MODULE}`);

    /*
     * A mano, saltandose la pantalla: dentro del modo, la comprobacion de solapamiento impide
     * llegar aqui. Lo que se comprueba es que la puerta este en el servidor, no en la interfaz —el
     * criterio de la seccion 9—, porque la interfaz es lo que se puede rodear.
     */
    const r = await page.request.put(`/api/modules/${MODULE}/view`, {
      data: {
        posiciones: {
          [OCULTABLE]: { x: 0, y: 0, w: 12, h: 40 },
        },
      },
    });

    expect(r.status()).toBe(400);
    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
  });
});

test.describe('la personalizacion es de quien la hace', () => {
  test('la vista de otra persona no cambia', async ({ page }) => {
    await page.request.put(`/api/modules/${MODULE}/view`, { data: { ocultos: [OCULTABLE] } });

    // Beto no tiene concedido casos-pendientes; se comprueba con u-admin, que si lo tiene.
    await asLogin(page, 'u-admin');
    await page.goto(`/m/${MODULE}`);
    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
    await expect(page.getByTestId(`cell-${OCULTABLE}`)).toBeVisible();

    await asLogin(page, 'u-ana');
    await withoutCustomize(page);
  });

  test('no hay parametro con el que pedir la vista de otro', async ({ page }) => {
    // La vista es la de la sesion, siempre. Un userId en el cuerpo no puede cambiar eso.
    const respuesta = await page.request.put(`/api/modules/${MODULE}/view`, {
      data: { ocultos: [OCULTABLE], userId: 'u-admin' },
    });
    expect(respuesta.ok()).toBe(true);

    await asLogin(page, 'u-admin');
    const suya = await (await page.request.get(`/api/modules/${MODULE}/view`)).json();
    expect(suya.personalizada).toBe(false);

    await asLogin(page, 'u-ana');
    await withoutCustomize(page);
  });
});

test.describe('el limite de 4.6 se comprueba en el backend', () => {
  test('una personalizacion que intenta cambiar la medida se rechaza', async ({ page }) => {
    const respuesta = await page.request.put(`/api/modules/${MODULE}/view`, {
      data: { ocultos: [], measures: ['MedidaInventada'] },
    });

    expect(respuesta.status()).toBe(400);
    expect((await respuesta.json()).error).toContain('4.6');
  });

  test('no se puede ocultar un objeto que el modulo no tiene', async ({ page }) => {
    const respuesta = await page.request.put(`/api/modules/${MODULE}/view`, {
      data: { ocultos: ['objeto-inventado'] },
    });
    expect(respuesta.status()).toBe(400);
  });

  test('no se puede dejar la vista vacia', async ({ page }) => {
    const view = await (await page.request.get(`/api/modules/${MODULE}/view`)).json();
    const all = (view.objetos as { id: string }[]).map((o) => o.id);

    const respuesta = await page.request.put(`/api/modules/${MODULE}/view`, {
      data: { ocultos: all },
    });
    expect(respuesta.status()).toBe(400);
  });
});

test.describe('la distincion viaja al exportar (4.6)', () => {
  test('el archivo de una vista personalizada lo dice, y el servidor no se fia del cliente', async ({
    page,
  }) => {
    await page.request.put(`/api/modules/${MODULE}/view`, { data: { ocultos: [OCULTABLE] } });

    // Se pide la exportacion diciendo EXPLICITAMENTE que no es personalizada. El servidor no lo
    // mira: la procedencia la decide el, comprobando si esta persona tiene personalizacion. Que
    // el navegador pudiera elegir la etiqueta convertia 4.6 en una sugerencia.
    const encolada = await page.request.post('/api/exports', {
      data: { modulo: MODULE, formato: 'csv', filtros: {}, personalizada: false },
    });
    expect(encolada.ok(), await encolada.text()).toBe(true);
    const { id } = (await encolada.json()) as { id: string };

    await expect
      .poll(async () => (await (await page.request.get(`/api/exports/${id}`)).json()).estado, {
        timeout: 15_000,
      })
      .toBe('lista');

    const descarga = await page.request.get(`/api/exports/${id}/download`);
    const content = await descarga.text();

    expect(content).toContain('Vista personalizada');
    expect(content).not.toContain('Vista institucional oficial');
    // Y el nombre del archivo tambien lo dice, para quien lo reciba por correo sin abrirlo.
    expect(descarga.headers()['content-disposition']).toContain('vista-personalizada');

    await withoutCustomize(page);
  });

  test('el archivo de la vista oficial se anuncia como tal', async ({ page }) => {
    const encolada = await page.request.post('/api/exports', {
      data: { modulo: MODULE, formato: 'csv', filtros: {} },
    });
    const { id } = (await encolada.json()) as { id: string };

    await expect
      .poll(async () => (await (await page.request.get(`/api/exports/${id}`)).json()).estado, {
        timeout: 15_000,
      })
      .toBe('lista');

    const content = await (await page.request.get(`/api/exports/${id}/download`)).text();
    expect(content).toContain('Vista institucional oficial');
  });
});

test.describe('la personalizacion sobrevive al cambio de instancia (seccion 9)', () => {
  test('lo guardado en una instancia se ve desde la otra', async ({ page, instanceOther }) => {
    await page.request.put(`/api/modules/${MODULE}/view`, { data: { ocultos: [OCULTABLE] } });

    const cookies = await page.context().cookies();
    const sesion = cookies.find((c) => c.name === 'sesion');
    const respuesta = await page.request.get(`${instanceOther}/api/modules/${MODULE}/view`, {
      headers: { cookie: `sesion=${sesion?.value ?? ''}` },
    });

    expect(respuesta.status()).toBe(200);
    expect((await respuesta.json()).ocultos).toEqual([OCULTABLE]);

    await withoutCustomize(page);
  });
});
