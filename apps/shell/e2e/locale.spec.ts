import { expect, test, type Page } from './instancia';
import { entrarComo } from './session';

/**
 * El idioma de la interfaz.
 *
 * La aplicacion esta en espanol y seguira estandolo. Lo que estas pruebas comprueban es que la
 * capa de traduccion es REAL: que una cadena migrada al catalogo cambia de verdad al pedir otro
 * idioma, y que el documento declara el que esta usando. Sin esto, el catalogo seria una lista
 * que nadie lee y las cadenas volverian a los componentes sin que nada fallara.
 */

const enIngles = async (page: Page, origen: string) => {
  await page.context().addCookies([{ name: 'idioma', value: 'en', url: origen }]);
};

const newModule = async (page: Page, slug: string) => {
  await page.goto('/editor');
  await page.getByTestId('new-module-name').fill(slug);
  await page.getByTestId('nuevo-modulo-slug').fill(slug);
  await page.getByTestId('create-module').click();
  await expect(page.getByTestId(`row-${slug}`)).toBeVisible();
  await page.goto(`/editor/${slug}`);
};

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-admin');
});

test('el documento declara el idioma que esta usando', async ({ page, origen }) => {
  // `lang` no es decorativo: lo usan el lector de pantalla para elegir voz, el navegador para
  // separar silabas y el corrector ortografico. Un documento en ingles marcado como espanol se
  // lee en voz alta con la pronunciacion equivocada.
  await page.goto('/m/casos-pendientes');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await enIngles(page, origen);
  await page.goto('/m/casos-pendientes');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('la cabecera del navegador NO cambia el idioma por su cuenta', async ({ browser }) => {
  /*
   * El navegador de estas pruebas pide `en-US`, como el de mucha gente.
   *
   * Si la negociacion por `Accept-Language` estuviera cableada, cualquiera con el sistema en
   * ingles veria una aplicacion institucional en un idioma que nadie ha revisado. El idioma de
   * esta aplicacion es el espanol y solo lo cambia una eleccion explicita.
   */
  const contexto = await browser.newContext({ locale: 'en-US' });
  const pagina = await contexto.newPage();
  await entrarComo(pagina, 'u-admin');
  await pagina.goto('/m/casos-pendientes');

  await expect(pagina.locator('html')).toHaveAttribute('lang', 'es');
  await contexto.close();
});

test('una cadena migrada al catalogo cambia de idioma', async ({ page, origen }) => {
  await newModule(page, `idioma-${Date.now()}`);
  await expect(page.getByTestId('tab-formato')).toContainText('Formato');

  await enIngles(page, origen);
  await page.reload();
  await expect(page.getByTestId('tab-formato')).toContainText('Format');
});

test('las familias de la paleta y su buscador tambien', async ({ page, origen }) => {
  await enIngles(page, origen);
  await newModule(page, `idioma-paleta-${Date.now()}`);

  await expect(page.getByTestId('family-proporcion')).toContainText('Break down a total');
  await expect(page.getByTestId('family-comparacion')).toContainText('Compare across categories');

  // El mensaje con argumento se interpola en el idioma pedido, no se queda con la llave a la vista.
  await page.getByTestId('search-object').fill('zzzzz');
  await expect(page.getByTestId('without-objects')).toContainText('No object matches "zzzzz"');
});

test('un idioma desconocido no deja la pagina a medias', async ({ page, origen }) => {
  // La cookie es texto que manda el cliente. Es una preferencia de presentacion, no una
  // credencial: un valor manipulado cae al idioma de la aplicacion.
  await page
    .context()
    .addCookies([{ name: 'idioma', value: 'klingon', url: origen }]);
  await page.goto('/m/casos-pendientes');

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByTestId('tabla')).toBeVisible();
});
