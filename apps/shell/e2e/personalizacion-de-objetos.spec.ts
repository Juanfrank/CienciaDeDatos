import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Personalizar un objeto SIN escribir codigo — secciones 4.2 y 4.3.
 *
 * Lo que se comprueba de punta a punta: lo que se elige en el editor sale en la pantalla del
 * modulo. Antes, cambiar el icono, el color o el formato de una cifra era tocar codigo y
 * desplegar, y las pruebas del editor solo llegaban hasta el mapeo.
 */

type Pagina = import('@playwright/test').Page;

/**
 * Espera a que el editor termine de guardar.
 *
 * Cada cambio guarda el modulo entero y deshabilita los controles mientras tanto. Encadenar dos
 * gestos sin esperar hace que el segundo caiga sobre un control muerto.
 */
const guardado = async (page: Pagina) => {
  await expect(page.locator('.editor')).toHaveAttribute('data-guardando', 'no');
};

/**
 * El id del objeto recien colocado, leido del BLOQUE del lienzo.
 *
 * El editor genera el id, asi que la prueba lo descubre de donde se ve: el lienzo. Antes se leia
 * de la ficha de una lista que ya no existe.
 */
const idDelPrimerBloque = async (page: Pagina): Promise<string> => {
  const testid = await page.locator('[data-testid^="bloque-obj-"]').first().getAttribute('data-testid');
  return (testid ?? '').replace('bloque-', '');
};

/**
 * Abre una subseccion del panel por su testid.
 *
 * Las subsecciones de «Formato» vienen plegadas salvo la primera: en un panel de 300 px, siete
 * controles apilados obligan a recorrerlos todos para encontrar uno. Las pruebas abren la que
 * necesitan, igual que haria quien edita.
 */
const abrir = async (page: Pagina, prueba: string) => {
  const seccion = page.getByTestId(prueba);
  if (await seccion.evaluate((el) => !(el as HTMLDetailsElement).open)) {
    await seccion.locator('summary').click();
  }
};

const crearModulo = async (page: Pagina, slug: string) => {
  await page.goto('/editor');
  await page.getByTestId('nuevo-modulo-nombre').fill(slug);
  await page.getByTestId('nuevo-modulo-slug').fill(slug);
  await page.getByTestId('crear-modulo').click();
  await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();
  await page.goto(`/editor/${slug}`);
};

test.describe('el editor configura como se ve un objeto', () => {
  test('icono, acento, resaltado, subtitulo y formato llegan al modulo', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await crearModulo(page, 'pers-kpi');

    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelPrimerBloque(page);
    await page.getByTestId('pestana-formato').click();

    await page.getByTestId(`pres-${id}-icono`).selectOption('balanza');
    await guardado(page);
    await page.getByTestId(`pres-${id}-acento`).selectOption('terciario');
    await guardado(page);
    // `.click()` y no `.check()`: el editor no es optimista — la casilla no cambia hasta que el
    // servidor devuelve el modulo guardado, y `.check()` exige que el estado cambie en el acto.
    await page.getByTestId(`pres-${id}-resaltado`).click();
    await guardado(page);
    await expect(page.getByTestId(`pres-${id}-resaltado`)).toBeChecked();
    await page.getByTestId(`pres-${id}-subtitulo`).fill('Al cierre');
    await page.getByTestId(`pres-${id}-subtitulo`).blur();
    await guardado(page);
    await abrir(page, `pres-${id}-cifra`);
    await page.getByTestId(`pres-${id}-unidad`).fill('casos');
    await page.getByTestId(`pres-${id}-unidad`).blur();
    await guardado(page);
    await expect(page.getByTestId('editor-sin-bloqueos')).toBeVisible();

    // Se recarga: lo elegido tiene que venir del servidor, no del estado del componente.
    await page.reload();
    await page.getByTestId(`elegir-${id}`).click();
    await page.getByTestId('pestana-formato').click();
    await expect(page.getByTestId(`pres-${id}-icono`)).toHaveValue('balanza');
    await expect(page.getByTestId(`pres-${id}-acento`)).toHaveValue('terciario');
    await expect(page.getByTestId(`pres-${id}-resaltado`)).toBeChecked();
    await expect(page.getByTestId(`pres-${id}-subtitulo`)).toHaveValue('Al cierre');
    await abrir(page, `pres-${id}-cifra`);
    await expect(page.getByTestId(`pres-${id}-unidad`)).toHaveValue('casos');
  });

  test('y lo configurado se DIBUJA en la pantalla del modulo', async ({ page }) => {
    /*
     * La otra mitad, sobre un modulo publicado.
     *
     * El borrador que crea la prueba anterior no se puede abrir en /m/: no esta publicado ni
     * concedido a ningun equipo, y eso es correcto —publicar pasa por aprobacion—. Asi que el
     * dibujado se comprueba sobre un modulo del seed que lleva presentacion configurada.
     */
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const tarjeta = page.locator('.objeto').first();
    await expect(tarjeta).toHaveAttribute('data-acento', 'primario');
    await expect(tarjeta).toHaveAttribute('data-resaltado', 'si');
    await expect(tarjeta.getByTestId('objeto-subtitulo')).toHaveText('Al cierre del trimestre');
    // La unidad sale del formato de la instancia, no de una cadena escrita en el componente.
    await expect(tarjeta.getByTestId('kpi-valor')).toContainText('casos');

    // La segunda tarjeta es el MISMO objeto con otra presentacion.
    const segunda = page.locator('.objeto').nth(1);
    await expect(segunda).toHaveAttribute('data-acento', 'terciario');
  });

  test('el editor NO ofrece lo que el objeto no admite', async ({ page }) => {
    // Una tabla con `leyenda` guardaria una opcion que no dibuja nada. El contrato dice que
    // claves admite cada objeto y el editor solo puede ofrecer esas.
    await entrarComo(page, 'u-admin');
    await crearModulo(page, 'pers-tabla');

    await page.getByTestId('anadir-tabla').click();
    await guardado(page);
    const id = await idDelPrimerBloque(page);
    await page.getByTestId('pestana-formato').click();

    await expect(page.getByTestId(`pres-${id}-icono`)).toBeVisible();
    // Una tabla tiene formato de cifra pero no leyenda: la subseccion «Grafico» ni siquiera se
    // dibuja, que es mas claro que dibujarla vacia.
    await expect(page.getByTestId(`pres-${id}-cifra`)).toHaveCount(1);
    await expect(page.getByTestId(`pres-${id}-grafico`)).toHaveCount(0);
    await expect(page.getByTestId(`pres-${id}-leyenda`)).toHaveCount(0);
    await expect(page.getByTestId(`pres-${id}-etiquetas`)).toHaveCount(0);
  });

  test('no hay ninguna caja donde escribir un color ni una ruta SVG', async ({ page }) => {
    /*
     * El limite de 4.3, comprobado en la interfaz.
     *
     * Un hexadecimal escrito a mano seria un color que la puerta de contraste no ha comprobado
     * nunca, y una ruta SVG pegada seria contenido sin revisar dentro del documento. Los dos
     * controles son desplegables de un conjunto cerrado, y esta prueba falla si alguien los
     * convierte en campos de texto «para que sea mas flexible».
     */
    await entrarComo(page, 'u-admin');
    await crearModulo(page, 'pers-cerrado');
    await page.getByTestId('anadir-tarjeta-kpi').click();
    await guardado(page);
    const id = await idDelPrimerBloque(page);
    await page.getByTestId('pestana-formato').click();

    for (const control of ['icono', 'acento']) {
      const nombre = await page
        .getByTestId(`pres-${id}-${control}`)
        .evaluate((el) => el.tagName.toLowerCase());
      expect(nombre, control).toBe('select');
    }
  });

  test('el panel de filtros deja elegir el selector de cada dimension', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await crearModulo(page, 'pers-panel');

    await page.getByTestId('anadir-panel-de-filtros').click();
    await guardado(page);
    const id = await idDelPrimerBloque(page);

    // Se anade una segunda dimension desde su pozo: tiene que aparecer su fila de selector sola.
    await page.getByTestId(`pozo-${id}-filtros-anadir`).click();
    await page.getByTestId(`pozo-${id}-filtros-opcion-DimTribunal.Materia`).click();
    await guardado(page);
    await expect(page.getByTestId(`pozo-${id}-filtros`)).toContainText('DimTribunal.Materia');

    await page.getByTestId('pestana-formato').click();
    await abrir(page, `pres-${id}-selectores`);
    await expect(page.getByTestId(`selectores-${id}-DimTribunal.Materia`)).toBeVisible();

    await page.getByTestId(`selectores-${id}-DimTribunal.Materia`).selectOption('desplegable');
    await guardado(page);
    await expect(page.getByTestId('editor-sin-bloqueos')).toBeVisible();

    // El borrador no se abre en /m/ —no esta publicado ni concedido—, asi que lo que se
    // comprueba aqui es que la eleccion sobrevive al servidor.
    // Tras recargar no hay nada elegido, asi que hay que volver a elegir el bloque. Que el desplegable se DIBUJE lo
    // cubre `filtros.spec.ts` sobre el panel del modulo publicado.
    await page.reload();
    await page.getByTestId(`elegir-${id}`).click();
    await page.getByTestId('pestana-formato').click();
    await abrir(page, `pres-${id}-selectores`);
    await expect(page.getByTestId(`selectores-${id}-DimTribunal.Materia`)).toHaveValue(
      'desplegable',
    );
    await expect(page.getByTestId(`selectores-${id}-DimTribunal.Distrito`)).toHaveValue(
      'pastillas',
    );
  });

  test('un selector de fecha sobre un texto se ofrece DESHABILITADO, no oculto', async ({
    page,
  }) => {
    // Esconderlo dejaria a quien edita preguntandose por que el calendario existe en otro panel
    // y no en este. Deshabilitado con su motivo, la respuesta esta donde surge la pregunta.
    await entrarComo(page, 'u-admin');
    await crearModulo(page, 'pers-fecha');
    await page.getByTestId('anadir-panel-de-filtros').click();
    await guardado(page);
    const id = await idDelPrimerBloque(page);
    await page.getByTestId('pestana-formato').click();
    await abrir(page, `pres-${id}-selectores`);

    const opcion = page
      .getByTestId(`selectores-${id}-DimTribunal.Distrito`)
      .locator('option[value="calendario"]');
    await expect(opcion).toHaveCount(1);
    // Se comprueba el ATRIBUTO: `toBeDisabled` no evalua `<option>` —no es un control de
    // formulario para Playwright— y devolveria «enabled» sobre una opcion deshabilitada.
    await expect(opcion).toHaveAttribute('disabled', '');
    await expect(opcion).toContainText('necesita una fecha');
  });
});
