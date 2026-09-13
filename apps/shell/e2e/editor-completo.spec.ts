import { expect, test, type Page } from '@playwright/test';
import { catalogoInicial } from '@app/ui-components';
import { ABRE_PRIMERO, CONTROL_DE_CLAVE } from '../src/components/editor/controles';
import { entrarComo } from './sesion';

/** Todo objeto del catalogo se COLOCA y se CONFIGURA desde el editor — seccion 4.2. */

const guardado = async (page: Page) =>
  expect(page.locator('.editor')).toHaveAttribute('data-guardando', 'no');

/** Despliega todas las secciones del panel. */
const abrirSecciones = async (page: Page) => {
  await page
    .locator('.panel-editor details')
    .evaluateAll((nodos) => nodos.forEach((n) => ((n as HTMLDetailsElement).open = true)));
};

const nuevoModulo = async (page: Page, slug: string) => {
  await page.goto('/editor');
  await page.getByTestId('nuevo-modulo-nombre').fill(slug);
  await page.getByTestId('nuevo-modulo-slug').fill(slug);
  await page.getByTestId('crear-modulo').click();
  await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();
  await page.goto(`/editor/${slug}`);
};

/** Los que van en la rejilla. Los complementos se adjuntan y tienen su propia pestana. */
const COLOCABLES = catalogoInicial.filter((o) => !o.attachable);

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-admin');
});

test.describe('colocable: el catalogo entero entra por la paleta', () => {
  test('cada objeto se anade desde el panel y aparece en el lienzo', async ({ page }) => {
    await nuevoModulo(page, `todos-${Date.now()}`);

    for (const [i, objeto] of COLOCABLES.entries()) {
      /*
       * Primero se vuelve a la pestana de Objetos, y LUEGO se busca el boton.
       */
      await page.getByTestId('pestana-objetos').click();

      const boton = page.getByTestId(`anadir-${objeto.objectId}`);
      // El boton tiene que EXISTIR: un objeto publicado que no sale en la paleta esta en el
      // catalogo y fuera del alcance de quien edita.
      await expect(boton, `${objeto.objectId} no esta en la paleta`).toBeAttached();
      await boton.click();
      await expect(
        page.locator('[data-testid^="bloque-"]'),
        `${objeto.objectId} no llego al lienzo`,
      ).toHaveCount(i + 1);
    }

    await guardado(page);
  });

  test('y lo colocado sobrevive a recargar: se guardo de verdad', async ({ page }) => {
    // Colocar y que se dibuje no es haberlo guardado. Es la diferencia entre un editor y una
    // maqueta, y se comprueba saliendo y volviendo.
    const slug = `persiste-${Date.now()}`;
    await nuevoModulo(page, slug);

    await page.getByTestId('anadir-embudo').click();
    await page.getByTestId('pestana-objetos').click();
    await page.getByTestId('anadir-mapa-de-arbol').click();
    await guardado(page);

    await page.goto(`/editor/${slug}`);
    await expect(page.locator('[data-testid^="bloque-"]')).toHaveCount(2);
  });
});

test.describe('configurable: lo que cada objeto declara sale en su panel', () => {
  /*
   * Se comprueba OBJETO A OBJETO y no sobre la union de las claves.
   */
  for (const objeto of COLOCABLES) {
    const version = objeto.versions[objeto.versions.length - 1];
    const claves = version?.presentation ?? [];

    test(`${objeto.objectId} — ${claves.length} claves`, async ({ page }) => {
      await nuevoModulo(page, `cfg-${objeto.objectId}-${Date.now()}`);
      await page.getByTestId(`anadir-${objeto.objectId}`).click();

      const id = await page
        .locator('[data-testid^="bloque-"]')
        .first()
        .getAttribute('data-testid');
      const item = (id ?? '').replace('bloque-', '');

      await page.getByTestId('pestana-formato').click();
      await expect(page.getByTestId(`pres-${item}`)).toBeVisible();
      await abrirSecciones(page);

      for (const clave of claves) {
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
    await nuevoModulo(page, `usar-medidor-${Date.now()}`);
    await page.getByTestId('anadir-medidor').click();
    await guardado(page);
    const id = await page.locator('[data-testid^="bloque-"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('bloque-', '');

    // El objeto llega ya mapeado a la primera medida del dataset: colocar algo que no dibuja nada
    // seria empezar por una tarjeta vacia. Aqui solo hace falta la escala.
    await page.getByTestId('pestana-formato').click();
    await abrirSecciones(page);
    // La escala deducida se ve antes de tocar nada: el respaldo la dice siempre.
    const respaldo = page.getByTestId('medidor').first();
    await expect(respaldo).toContainText('Escala');

    /*
     * Se escribe y se SALE del campo.
     */
    await page.getByTestId(`pres-${item}-maximo`).fill('5000');
    await page.getByTestId(`pres-${item}-maximo`).blur();
    await guardado(page);

    // El respaldo accesible dice la escala con palabras: es lo que lee quien no ve la aguja, y es
    // donde se comprueba sin abrir el canvas. Sale de la misma funcion que el dibujo.
    await expect(respaldo).toContainText('5,000');
  });

  test('el embudo: cambiar contra que compara cambia la columna del respaldo', async ({ page }) => {
    await nuevoModulo(page, `usar-embudo-${Date.now()}`);
    await page.getByTestId('anadir-embudo').click();
    const id = await page.locator('[data-testid^="bloque-"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('bloque-', '');

    await page.getByTestId('pestana-formato').click();
    await abrirSecciones(page);
    const comparar = page.getByTestId(`pres-${item}-comparar`);
    await expect(comparar).toBeVisible();

    await comparar.selectOption('anterior');
    await guardado(page);
    await expect(page.getByTestId('embudo').first()).toContainText('De la anterior');

    await comparar.selectOption('primero');
    await guardado(page);
    await expect(page.getByTestId('embudo').first()).toContainText('De la primera');
  });

  test('los multiplos: elegir dos columnas desde el panel reparte los paneles', async ({ page }) => {
    await nuevoModulo(page, `usar-multiplos-${Date.now()}`);
    await page.getByTestId('anadir-barras').click();
    await guardado(page);
    const id = await page.locator('[data-testid^="bloque-"]').first().getAttribute('data-testid');
    const item = (id ?? '').replace('bloque-', '');

    // El eje ya viene mapeado; lo unico que hay que anadir es la dimension que reparte los paneles.
    await page.getByTestId('pestana-datos').click();
    await page.getByTestId(`pozo-${item}-multiplo-anadir`).click();
    await page.getByTestId(`pozo-${item}-multiplo-opcion-DimTribunal.Materia`).click();
    await guardado(page);

    // Sin tocar nada mas, el objeto ya se parte en paneles: el pozo es lo que lo decide.
    await expect(page.locator('.multiplos__panel').first()).toBeVisible();

    await page.getByTestId('pestana-formato').click();
    await abrirSecciones(page);
    await page.getByTestId(`pres-${item}-multiplos-columnas`).selectOption('2');
    await guardado(page);

    const columnas = await page
      .locator('.multiplos')
      .first()
      .evaluate((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length);
    expect(columnas).toBe(2);
  });
});
