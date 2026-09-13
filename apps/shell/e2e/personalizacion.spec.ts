import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/** Personalizacion por usuario — seccion 4.6. */

const MODULO = 'casos-pendientes';
const OCULTABLE = 'kpi-ingresados';

/** Deja el modulo sin personalizacion para esta persona. Las pruebas comparten el almacen. */
async function sinPersonalizar(page: import('@playwright/test').Page): Promise<void> {
  await page.request.delete(`/api/modulos/${MODULO}/vista`);
}

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
  await sinPersonalizar(page);
});

test.describe('la vista se distingue de la institucional (4.6)', () => {
  test('sin personalizar, el modulo se anuncia como vista institucional oficial', async ({ page }) => {
    await page.goto(`/m/${MODULO}`);
    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
  });

  test('al ocultar un objeto, la vista pasa a anunciarse como personalizada', async ({ page }) => {
    await page.goto(`/m/${MODULO}`);
    await expect(page.getByTestId(`celda-${OCULTABLE}`)).toBeVisible();

    await page.getByTestId('mi-vista').click();
    await page.getByTestId(`ver-${OCULTABLE}`).uncheck();
    await page.getByTestId('mi-vista-guardar').click();

    await expect(page.getByTestId('procedencia')).toContainText('personalizada');
    // Y el objeto deja de dibujarse: lo que no esta en la vista no se lee ni viaja al navegador.
    await expect(page.getByTestId(`celda-${OCULTABLE}`)).toHaveCount(0);

    await sinPersonalizar(page);
  });

  test('siempre hay camino de vuelta a la vista oficial', async ({ page }) => {
    await page.request.put(`/api/modulos/${MODULO}/vista`, { data: { ocultos: [OCULTABLE] } });
    await page.goto(`/m/${MODULO}`);
    await expect(page.getByTestId('procedencia')).toContainText('personalizada');

    await page.getByTestId('mi-vista').click();
    await page.getByTestId('mi-vista-descartar').click();

    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
    await expect(page.getByTestId(`celda-${OCULTABLE}`)).toBeVisible();
  });
});

test.describe('la personalizacion es de quien la hace', () => {
  test('la vista de otra persona no cambia', async ({ page }) => {
    await page.request.put(`/api/modulos/${MODULO}/vista`, { data: { ocultos: [OCULTABLE] } });

    // Beto no tiene concedido casos-pendientes; se comprueba con u-admin, que si lo tiene.
    await entrarComo(page, 'u-admin');
    await page.goto(`/m/${MODULO}`);
    await expect(page.getByTestId('procedencia')).toContainText('institucional oficial');
    await expect(page.getByTestId(`celda-${OCULTABLE}`)).toBeVisible();

    await entrarComo(page, 'u-ana');
    await sinPersonalizar(page);
  });

  test('no hay parametro con el que pedir la vista de otro', async ({ page }) => {
    // La vista es la de la sesion, siempre. Un userId en el cuerpo no puede cambiar eso.
    const respuesta = await page.request.put(`/api/modulos/${MODULO}/vista`, {
      data: { ocultos: [OCULTABLE], userId: 'u-admin' },
    });
    expect(respuesta.ok()).toBe(true);

    await entrarComo(page, 'u-admin');
    const suya = await (await page.request.get(`/api/modulos/${MODULO}/vista`)).json();
    expect(suya.personalizada).toBe(false);

    await entrarComo(page, 'u-ana');
    await sinPersonalizar(page);
  });
});

test.describe('el limite de 4.6 se comprueba en el backend', () => {
  test('una personalizacion que intenta cambiar la medida se rechaza', async ({ page }) => {
    const respuesta = await page.request.put(`/api/modulos/${MODULO}/vista`, {
      data: { ocultos: [], measures: ['MedidaInventada'] },
    });

    expect(respuesta.status()).toBe(400);
    expect((await respuesta.json()).error).toContain('4.6');
  });

  test('no se puede ocultar un objeto que el modulo no tiene', async ({ page }) => {
    const respuesta = await page.request.put(`/api/modulos/${MODULO}/vista`, {
      data: { ocultos: ['objeto-inventado'] },
    });
    expect(respuesta.status()).toBe(400);
  });

  test('no se puede dejar la vista vacia', async ({ page }) => {
    const vista = await (await page.request.get(`/api/modulos/${MODULO}/vista`)).json();
    const todos = (vista.objetos as { id: string }[]).map((o) => o.id);

    const respuesta = await page.request.put(`/api/modulos/${MODULO}/vista`, {
      data: { ocultos: todos },
    });
    expect(respuesta.status()).toBe(400);
  });
});

test.describe('la distincion viaja al exportar (4.6)', () => {
  test('el archivo de una vista personalizada lo dice, y el servidor no se fia del cliente', async ({
    page,
  }) => {
    await page.request.put(`/api/modulos/${MODULO}/vista`, { data: { ocultos: [OCULTABLE] } });

    // Se pide la exportacion diciendo EXPLICITAMENTE que no es personalizada. El servidor no lo
    // mira: la procedencia la decide el, comprobando si esta persona tiene personalizacion. Que
    // el navegador pudiera elegir la etiqueta convertia 4.6 en una sugerencia.
    const encolada = await page.request.post('/api/exportaciones', {
      data: { modulo: MODULO, formato: 'csv', filtros: {}, personalizada: false },
    });
    expect(encolada.ok(), await encolada.text()).toBe(true);
    const { id } = (await encolada.json()) as { id: string };

    await expect
      .poll(async () => (await (await page.request.get(`/api/exportaciones/${id}`)).json()).estado, {
        timeout: 15_000,
      })
      .toBe('lista');

    const descarga = await page.request.get(`/api/exportaciones/${id}/descarga`);
    const texto = await descarga.text();

    expect(texto).toContain('Vista personalizada');
    expect(texto).not.toContain('Vista institucional oficial');
    // Y el nombre del archivo tambien lo dice, para quien lo reciba por correo sin abrirlo.
    expect(descarga.headers()['content-disposition']).toContain('vista-personalizada');

    await sinPersonalizar(page);
  });

  test('el archivo de la vista oficial se anuncia como tal', async ({ page }) => {
    const encolada = await page.request.post('/api/exportaciones', {
      data: { modulo: MODULO, formato: 'csv', filtros: {} },
    });
    const { id } = (await encolada.json()) as { id: string };

    await expect
      .poll(async () => (await (await page.request.get(`/api/exportaciones/${id}`)).json()).estado, {
        timeout: 15_000,
      })
      .toBe('lista');

    const texto = await (await page.request.get(`/api/exportaciones/${id}/descarga`)).text();
    expect(texto).toContain('Vista institucional oficial');
  });
});

test.describe('la personalizacion sobrevive al cambio de instancia (seccion 9)', () => {
  test('lo guardado en una instancia se ve desde la otra', async ({ page }) => {
    await page.request.put(`/api/modulos/${MODULO}/vista`, { data: { ocultos: [OCULTABLE] } });

    const cookies = await page.context().cookies();
    const sesion = cookies.find((c) => c.name === 'sesion');
    const respuesta = await page.request.get(`http://localhost:4311/api/modulos/${MODULO}/vista`, {
      headers: { cookie: `sesion=${sesion?.value ?? ''}` },
    });

    expect(respuesta.status()).toBe(200);
    expect((await respuesta.json()).ocultos).toEqual([OCULTABLE]);

    await sinPersonalizar(page);
  });
});
