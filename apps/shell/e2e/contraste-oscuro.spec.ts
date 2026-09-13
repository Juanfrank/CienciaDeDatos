import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './sesion';

/** Contraste con el TEMA OSCURO — secciones 4.3 y 4.9. */

const NIVEL = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Pone el modo oscuro en el contexto, que es como lo pediria una persona desde sus ajustes. */
async function enOscuro(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: 'tema', value: 'dark', url: 'http://localhost:4310' },
  ]);
}

async function infracciones(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(NIVEL).analyze();
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} nodo(s): ` +
      v.nodes.map((n) => n.target.join(' ')).join(' | '),
  );
}

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
  await enOscuro(page);
});

test('el modo se pide con una cookie y llega al documento', async ({ page }) => {
  /*
   * Se comprueba primero, y por separado, que el tema CAMBIA. Sin esto, todas las pruebas de
   * abajo podrian estar analizando la aplicacion en claro y pasando por eso — que es exactamente
   * la clase de prueba que aprueba por coincidencia.
   */
  await page.goto('/m/composicion/familia');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const fondo = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue('--md-sys-color-surface').trim(),
  );
  const luminancia = await page.evaluate((color: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
    const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * canal(r ?? 0) + 0.7152 * canal(g ?? 0) + 0.0722 * canal(b ?? 0);
  }, fondo);

  // Una superficie oscura de verdad, no un gris claro que pase por oscuro.
  expect(luminancia).toBeLessThan(0.1);
});

test('los dos juegos de variables vienen del MISMO modo', async ({ page }) => {
  /*
   * El layout emite los roles de MD3 y los del tema derivado que todavia leen unas cuantas
   * hojas de estilo. Si uno se calculara en oscuro y el otro quedara fijo en claro, la pagina
   * saldria oscura con textos pensados para fondo blanco: cada juego correcto por separado y la
   * pagina ilegible. Es el fallo mas facil de introducir aqui y el mas dificil de atribuir.
   */
  await page.goto('/m/casos-pendientes');

  const { md, derived } = await page.evaluate(() => {
    const e = getComputedStyle(document.body);
    return {
      md: e.getPropertyValue('--md-sys-color-on-surface').trim(),
      derived: e.getPropertyValue('--color-text').trim(),
    };
  });

  expect(md).not.toBe('');
  expect(derived).toBe(md);
});

test.describe('paginas de modulo en dark', () => {
  const paginas = [
    ['familia', 'columnas, barras y area'],
    ['proporcion', 'pastel, dona y medidor'],
    ['relacion', 'combinado y dispersion'],
    ['flujo', 'embudo, cascada y mapa de arbol'],
    ['referencia', 'metas, escalas y colores de serie'],
    ['detalle', 'etiquetas, tooltip y rotulos girados'],
    ['multiplos', 'pequenos multiplos'],
    ['condicional', 'formato condicional'],
    ['contenedores', 'pestanas, desplazables y ampliables'],
  ] as const;

  for (const [slug, que] of paginas) {
    test(`/${slug} — ${que} — no tiene infracciones WCAG 2.1 AA en dark`, async ({ page }) => {
      await page.goto(`/m/composicion/${slug}`);
      // Se espera a que ECharts monte: el grafico lee los colores de las variables CSS al
      // dibujar, asi que antes de montar la pagina no tiene todavia los colores del tema.
      await expect(page.locator('.grafico').first()).toHaveAttribute('data-montado', 'si');

      expect(await infracciones(page)).toEqual([]);
    });
  }
});

test.describe('el resto de la aplicacion en dark', () => {
  test('un modulo con tabla, KPI y segmentadores', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('tabla')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el aviso de un objeto roto se sigue leyendo', async ({ page }) => {
    // Es cuando mas falta hace: un mensaje de error que no contrasta deja a quien mira sin saber
    // por que el objeto esta vacio.
    await page.goto('/m/audiencias?DimTribunal.Materia=Penal');
    await expect(page.getByTestId('objeto-roto')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('el editor de modulos, que es la pantalla con mas cromo', async ({ page }) => {
    // Con un objeto YA DIBUJADO y su panel abierto: la paleta, los pozos y las pestanas son la
    // mayor concentracion de texto pequeno sobre superficies elevadas de toda la aplicacion.
    const slug = `dark-${Date.now()}`;
    const creado = await page.request.post('/api/modulos', {
      data: { nombre: 'Modulo en dark', slug },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto(`/editor/${slug}`);
    await page.getByTestId('anadir-barras').click();
    await expect(page.locator('[data-testid^="bloque-obj-"]')).toHaveCount(1);

    expect(await infracciones(page)).toEqual([]);
  });

  test('el panel de administracion', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await enOscuro(page);
    await page.goto('/admin/arbol');
    await expect(page.locator('h1')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });

  test('la pantalla de restablecer, que se ve SIN sesion', async ({ page }) => {
    // El tema se aplica en el layout raiz, que envuelve tambien lo que se ve sin haber entrado:
    // si el modo dependiera de la sesion, esta pantalla saldria en claro.
    await page.goto('/restablecer');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('restablecer-enviar')).toBeVisible();

    expect(await infracciones(page)).toEqual([]);
  });
});
