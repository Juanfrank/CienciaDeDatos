import { expect, test, type Page } from '@playwright/test';
import { initialCatalog } from '@app/ui-components';
import { ABRE_PRIMERO, CONTROL_DE_CLAVE } from '../src/components/editor/controls';
import { entrarComo } from './session';

/** Todo objeto del catalogo se COLOCA y se CONFIGURA desde el editor — seccion 4.2. */

const guardado = async (page: Page) =>
  expect(page.locator('.editor')).toHaveAttribute('data-saving', 'no');

/** Despliega todas las secciones del panel. */
const abrirSecciones = async (page: Page) => {
  await page
    .locator('.editor-panel details')
    .evaluateAll((nodos) => nodos.forEach((n) => ((n as HTMLDetailsElement).open = true)));
};

const newModule = async (page: Page, slug: string) => {
  await page.goto('/editor');
  await page.getByTestId('new-module-name').fill(slug);
  await page.getByTestId('nuevo-modulo-slug').fill(slug);
  await page.getByTestId('create-module').click();
  await expect(page.getByTestId(`row-${slug}`)).toBeVisible();
  await page.goto(`/editor/${slug}`);
};

/** Los que van en la rejilla. Los complementos se adjuntan y tienen su propia pestana. */
const COLOCABLES = initialCatalog.filter((o) => !o.attachable);

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-admin');
});

test.describe('colocable: el catalogo entero entra por la paleta', () => {
  test('cada objeto se anade desde el panel y aparece en el lienzo', async ({ page }) => {
    await newModule(page, `todos-${Date.now()}`);

    for (const [i, objeto] of COLOCABLES.entries()) {
      /*
       * Primero se vuelve a la pestana de Objetos, y LUEGO se busca el boton.
       */
      await page.getByTestId('tab-objetos').click();

      const button = page.getByTestId(`add-${objeto.objectId}`);
      // El boton tiene que EXISTIR: un objeto publicado que no sale en la paleta esta en el
      // catalogo y fuera del alcance de quien edita.
      await expect(button, `${objeto.objectId} no esta en la paleta`).toBeAttached();
      await button.click();
      await expect(
        page.locator('[data-testid^="block"]'),
        `${objeto.objectId} no llego al lienzo`,
      ).toHaveCount(i + 1);
    }

    await guardado(page);
  });

  test('y lo colocado sobrevive a recargar: se guardo de verdad', async ({ page }) => {
    // Colocar y que se dibuje no es haberlo guardado. Es la diferencia entre un editor y una
    // maqueta, y se comprueba saliendo y volviendo.
    const slug = `persiste-${Date.now()}`;
    await newModule(page, slug);

    await page.getByTestId('add-embudo').click();
    await page.getByTestId('tab-objetos').click();
    await page.getByTestId('add-mapa-de-arbol').click();
    await guardado(page);

    await page.goto(`/editor/${slug}`);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(2);
  });
});

test.describe('configurable: lo que cada objeto declara sale en su panel', () => {
  /*
   * Se comprueba OBJETO A OBJETO y no sobre la union de las claves.
   */
  for (const objeto of COLOCABLES) {
    const version = objeto.versions[objeto.versions.length - 1];
    const keys = version?.presentation ?? [];

    test(`${objeto.objectId} — ${keys.length} claves`, async ({ page }) => {
      await newModule(page, `cfg-${objeto.objectId}-${Date.now()}`);
      await page.getByTestId(`add-${objeto.objectId}`).click();

      const id = await page
        .locator('[data-testid^="block"]')
        .first()
        .getAttribute('data-testid');
      const item = (id ?? '').replace('block', '');

      await page.getByTestId('tab-formato').click();
      await expect(page.getByTestId(`pres-${item}`)).toBeVisible();
      await abrirSecciones(page);

      for (const clave of keys) {
        /*
         * Algunos controles solo aparecen despues de encender otro, y eso esta bien: el color del
         * resaltado no significa nada mientras no haya resaltado. Lo que se comprueba es que se
         * PUEDE llegar a el, no que este siempre dibujado.
         */
        const interruptor = ABRE_PRIMERO[clave];
        if (interruptor) {
          /*
           * Se espera al guardado ANTES de pulsar, y se afirma el estado despues.
           */
          await guardado(page);
          const casilla = page.getByTestId(`pres-${item}-${interruptor}`);
          await casilla.click();
          await expect(casilla).toBeChecked();
          // Encender el interruptor dibuja controles nuevos, y alguno trae su propia seccion.
          await abrirSecciones(page);
        }

        await expect(
          page.getByTestId(`pres-${item}-${CONTROL_DE_CLAVE[clave]}`),
          `${objeto.objectId} declara '${clave}' y el panel no lo ofrece`,
        ).toBeAttached();
      }
    });
  }
});

test.describe('utilizable: configurar desde el panel cambia lo que se dibuja', () => {
  /*
   * Que el control exista no es que funcione. Estas pruebas mueven el control de verdad y miran
   * el objeto, que es la unica forma de distinguir un panel de una lista de campos.
   */

  test('el medidor: fijar el maximo desde el panel cambia la escala del respaldo', async ({
    page,
  }) => {
    await newModule(page, `usar-medidor-${Date.now()}`);
    await page.getByTestId('add-medidor').click();
    await guardado(page);
    const id = await page.locator('[data-testid^="block"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('block', '');

    // El objeto llega ya mapeado a la primera medida del dataset: colocar algo que no dibuja nada
    // seria empezar por una tarjeta vacia. Aqui solo hace falta la escala.
    await page.getByTestId('tab-formato').click();
    await abrirSecciones(page);
    // La escala deducida se ve antes de tocar nada: el respaldo la dice siempre.
    const fallback = page.getByTestId('medidor').first();
    await expect(fallback).toContainText('Escala');

    /*
     * Se escribe y se SALE del campo.
     */
    await page.getByTestId(`pres-${item}-maximo`).fill('5000');
    await page.getByTestId(`pres-${item}-maximo`).blur();
    await guardado(page);

    // El respaldo accesible dice la escala con palabras: es lo que lee quien no ve la aguja, y es
    // donde se comprueba sin abrir el canvas. Sale de la misma funcion que el dibujo.
    await expect(fallback).toContainText('5,000');
  });

  test('el embudo: cambiar contra que compara cambia la columna del respaldo', async ({ page }) => {
    await newModule(page, `usar-embudo-${Date.now()}`);
    await page.getByTestId('add-embudo').click();
    const id = await page.locator('[data-testid^="block"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('block', '');

    await page.getByTestId('tab-formato').click();
    await abrirSecciones(page);
    const compare = page.getByTestId(`pres-${item}-comparar`);
    await expect(compare).toBeVisible();

    await compare.selectOption('anterior');
    await guardado(page);
    await expect(page.getByTestId('embudo').first()).toContainText('De la anterior');

    await compare.selectOption('primero');
    await guardado(page);
    await expect(page.getByTestId('embudo').first()).toContainText('De la primera');
  });

  test('los multiplos: elegir dos columnas desde el panel reparte los paneles', async ({ page }) => {
    await newModule(page, `usar-multiplos-${Date.now()}`);
    await page.getByTestId('add-barras').click();
    await guardado(page);
    const id = await page.locator('[data-testid^="block"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('block', '');

    // El eje ya viene mapeado; lo unico que hay que anadir es la dimension que reparte los paneles.
    await page.getByTestId('tab-datos').click();
    await page.getByTestId(`well-${item}-multiplo-anadir`).click();
    await page.getByTestId(`well-${item}-multiplo-opcion-DimTribunal.Materia`).click();
    await guardado(page);

    // Sin tocar nada mas, el objeto ya se parte en paneles: el pozo es lo que lo decide.
    await expect(page.locator('.multiples__panel').first()).toBeVisible();

    await page.getByTestId('tab-formato').click();
    await abrirSecciones(page);
    await page.getByTestId(`pres-${item}-multiplos-columnas`).selectOption('2');
    await guardado(page);

    const gridColumns = await page
      .locator('.multiplos')
      .first()
      .evaluate((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length);
    expect(gridColumns).toBe(2);
  });
});
