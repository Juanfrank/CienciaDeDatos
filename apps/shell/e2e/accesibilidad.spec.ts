import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Accesibilidad — seccion 4.9, "no opcional, no se pospone", y criterio de la seccion 9:
 * "Accesibilidad verificada (no pospuesta) en los modulos publicados a nivel institucional".
 *
 * Se verifica con axe sobre la aplicacion REAL, no sobre componentes aislados: la mayoria de los
 * fallos de accesibilidad aparecen al componer (un encabezado que salta de h1 a h3, un control
 * sin etiqueta dentro de una barra, contraste que solo falla con el tema aplicado).
 *
 * El alcance es WCAG 2.1 AA, que es el nivel que exige la normativa de accesibilidad web en el
 * sector publico. Un fallo hace fallar la prueba: sin eso, "verificada" no significa nada.
 */

const NIVEL = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Analiza la pagina actual y devuelve las infracciones, ya legibles en el mensaje de fallo. */
async function infracciones(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(NIVEL).analyze();
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} nodo(s): ` +
      v.nodes.map((n) => n.target.join(' ')).join(' | '),
  );
}

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('paginas de modulo', () => {
  test('un modulo con sus objetos no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('tabla')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('con filtros activos y objetos rotos tampoco', async ({ page }) => {
    // 'audiencias' contiene un objeto marcado como roto: el aviso de error tambien tiene que
    // ser accesible, que es justo cuando mas falta hace.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/audiencias?DimTribunal.Materia=Penal');
    await expect(page.getByTestId('objeto-roto')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('con un tooltip explicativo abierto tampoco hay infracciones', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('tooltip-icono-Pendientes por distrito').hover();
    await expect(page.getByTestId('tooltip-Pendientes por distrito')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el emergente de datos de origen es accesible, con el foco dentro', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('tabla-datos-abrir-Pendientes por distrito').click();
    await expect(page.getByTestId('tabla-datos-Pendientes por distrito')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);

    // El <dialog> nativo lleva el foco dentro por su cuenta. Se comprueba porque es la mitad
    // del motivo de usarlo en vez de un div con position: fixed.
    const dentro = await page.evaluate(() =>
      document.querySelector('dialog[open]')?.contains(document.activeElement),
    );
    expect(dentro).toBe(true);
  });

  test('el estado de una exportacion en curso es accesible', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('exportar').click();
    await expect(page.getByTestId('estado-exportacion')).toHaveText(/Lista/, { timeout: 15_000 });

    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('panel de administracion (4.10.8)', () => {
  for (const ruta of [
    '/admin',
    '/admin/arbol',
    '/admin/equipos',
    '/admin/paquetes',
    '/admin/ambitos',
    '/admin/quien-ve-que',
    '/admin/auditoria',
  ]) {
    test(`${ruta} no tiene infracciones WCAG 2.1 AA`, async ({ page }) => {
      await entrarComo(page, 'u-admin');
      await page.goto(ruta);
      await expect(page.locator('h1')).toBeVisible();

      expect(await infracciones(page)).toEqual([]);
    });
  }
});

test.describe('avisos (4.9)', () => {
  test('la bandeja de avisos no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/avisos');
    await expect(page.getByRole('heading', { name: 'Avisos' })).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el dialogo para crear un aviso es accesible, con sus campos etiquetados', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('crear-aviso').click();
    await expect(page.getByTestId('dialogo-aviso')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el contador de la campana se anuncia con texto, no solo con un numero', async ({
    page,
  }) => {
    // "Avisos 3" no dice de que. El numero es para la vista; el texto, para quien no la usa.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('campana')).toContainText(/aviso\(s\) sin leer|ningun aviso sin leer/);
  });
});

test.describe('paginas de estado', () => {
  test('la pagina de sin permiso es accesible', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/admin-sin-permiso');
    expect(await infracciones(page)).toEqual([]);
  });

  test('la pagina de no encontrado es accesible', async ({ page }) => {
    await page.goto('/m/no-existe');
    expect(await infracciones(page)).toEqual([]);
  });
});

test.describe('navegacion solo con teclado', () => {
  test('se llega a la navegacion, a un segmentador y a exportar sin tocar el raton', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // Se recorre el orden de tabulacion y se comprueba que los controles clave estan en el.
    const alcanzados: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const testId = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      if (testId) alcanzados.push(testId);
    }

    expect(alcanzados).toContain('nav-casos-pendientes');
    expect(alcanzados).toContain('segmentador-Penal');
    expect(alcanzados).toContain('exportar');
  });

  test('el foco se VE: un control alcanzable sin indicador es inservible de hecho', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // El foco se lleva con el teclado, no con .focus(): :focus-visible no se activa cuando el
    // foco llega por programa o con el raton, que es justo la distincion que se quiere probar.
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo) return null;
      const estilo = getComputedStyle(activo);
      return { ancho: estilo.outlineWidth, estilo: estilo.outlineStyle };
    });

    expect(contorno?.estilo).not.toBe('none');
    expect(Number.parseFloat(contorno?.ancho ?? '0')).toBeGreaterThanOrEqual(2);
  });

  test('la tabla que se desplaza es alcanzable con el tabulador y esta anunciada', async ({
    page,
  }) => {
    // Una region con desplazamiento que no recibe foco deja su contenido fuera de alcance para
    // quien no usa raton. axe lo marca como scrollable-region-focusable.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const contenedor = page.locator('.tabla-contenedor').first();
    await expect(contenedor).toHaveAttribute('tabindex', '0');
    await expect(contenedor).toHaveAttribute('role', 'region');
    await expect(contenedor).toHaveAttribute('aria-label', /.+/);
  });

  test('un segmentador se activa con Enter y con Espacio, no solo con el raton', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('segmentador-Penal').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByTestId('segmentador-Civil').focus();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/Materia=Civil/);
  });
});
