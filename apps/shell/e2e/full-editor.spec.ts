import { expect, test, type Page } from './instance';
import { initialCatalog, placeable } from '@app/ui-components';
import { FIRST_OPENS, KEY_CONTROL } from '../src/components/editor/controls';
import {
  alDia,
  asLogin,
  DATASET_DEMO,
  DISTRITO_DEMO,
  moduleWithObject,
  newModule,
} from './session';

/** Todo objeto del catalogo se COLOCA y se CONFIGURA desde el editor — seccion 4.2. */


/** Despliega todas las secciones del panel. */
const openSections = async (page: Page) => {
  await page
    .locator('.editor-panel details')
    .evaluateAll((nodos) => nodos.forEach((n) => ((n as HTMLDetailsElement).open = true)));
};

/**
 * Los que van en la rejilla, por la MISMA regla que usa la paleta.
 *
 * Se filtra con `placeable` y no con `!attachable`: un complemento se adjunta y tiene su propia
 * pestana, y un navegador de pagina se elige en la configuracion del modulo porque lo que navega
 * es el modulo entero. Repitiendo aqui la condicion, el dia que entre una cuarta clase de objeto
 * esta prueba exigiria en la paleta algo que la paleta no ofrece — que es como se descubrio esta.
 */
const COLOCABLES = initialCatalog.filter(placeable);

test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-admin');
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

    await alDia(page);
  });

  test('y lo colocado sobrevive a recargar SIN pulsar nada: se guarda solo', async ({ page }) => {
    // Colocar y que se dibuje no es haberlo guardado. Es la diferencia entre un editor y una
    // maqueta, y se comprueba saliendo y volviendo — aqui sin tocar ningun boton, que es lo que
    // distingue el autoguardado de un guardado explicito.
    const slug = `persiste-${Date.now()}`;
    await newModule(page, slug);

    await page.getByTestId('add-embudo').click();
    await alDia(page);
    await page.getByTestId('tab-objetos').click();
    await page.getByTestId('add-mapa-de-arbol').click();
    await alDia(page);

    await page.goto(`/editor/${slug}`);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(2);
  });

  test('y el boton de guardar escribe lo mismo, solo que ya', async ({ page }) => {
    /*
     * El boton no es otro camino: es el mismo, disparado a mano.
     *
     * Se comprueba que con el se llega al mismo sitio —recargar y encontrarlo— porque un boton
     * que pareciera guardar sin guardar seria peor que no tenerlo: alguien lo pulsa, ve
     * «Guardado» y cierra la pestana.
     */
    const slug = `manual-${Date.now()}`;
    await newModule(page, slug);

    await page.getByTestId('add-embudo').click();
    await expect(page.getByTestId('guardar-borrador')).toBeEnabled();
    await page.getByTestId('guardar-borrador').click();
    await alDia(page);
    // El boton se apaga solo cuando no queda nada por guardar: es el mismo estado que lee
    // `data-dirty`, dicho donde lo ve quien lo pulso. No se comprueba el texto porque depende
    // del idioma y esta prueba no va de eso.
    await expect(page.getByTestId('guardar-borrador')).toBeDisabled();

    await page.goto(`/editor/${slug}`);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(1);
  });

  /*
   * Descartar, con autoguardado, deshace LA SESION.
   *
   * No puede significar «vuelve a lo ultimo guardado», porque lo ultimo guardado es lo que hay en
   * pantalla un segundo despues de cada gesto: el boton no haria nada. Significa volver a como
   * estaba el modulo al abrir el editor, y esa vuelta atras se guarda como cualquier otro cambio.
   * Se comprueba recargando, que es lo unico que distingue haber revertido de parecerlo.
   */
  test('descartar deshace la sesion entera, y la vuelta atras tambien se guarda', async ({
    page,
  }) => {
    const slug = `descarta-${Date.now()}`;
    await newModule(page, slug);

    // Una primera sesion que SI deja algo: se abre, se coloca, se guarda solo.
    await page.getByTestId('add-embudo').click();
    await alDia(page);

    // Y una segunda sesion, que es la que se va a descartar entera. Abrirla de nuevo es lo que
    // fija el punto de retorno en «un objeto».
    await page.goto(`/editor/${slug}`);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(1);
    await page.getByTestId('tab-objetos').click();
    await page.getByTestId('add-mapa-de-arbol').click();
    await alDia(page);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(2);

    await page.getByTestId('descartar-borrador').click();
    await alDia(page);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(1);

    // Y al volver sigue habiendo uno: lo descartado se fue tambien del almacen.
    await page.goto(`/editor/${slug}`);
    await expect(page.locator('[data-testid^="block"]')).toHaveCount(1);
  });
});

test.describe('configurable: lo que cada objeto declara sale en su panel @catalogo', () => {
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
      const item = (id ?? '').replace('block-', '');

      await page.getByTestId('tab-formato').click();
      await expect(page.getByTestId(`pres-${item}`)).toBeVisible();
      await openSections(page);

      for (const clave of keys) {
        /*
         * Algunos controles solo aparecen despues de encender otro, y eso esta bien: el color del
         * resaltado no significa nada mientras no haya resaltado. Lo que se comprueba es que se
         * PUEDE llegar a el, no que este siempre dibujado.
         */
        const interruptor = FIRST_OPENS[clave];
        // rama-declarada: solo algunas claves traen interruptor; el `expect` de abajo corre igual
        if (interruptor) {
          /*
           * Se espera al guardado ANTES de pulsar, y se afirma el estado despues.
           */
          await alDia(page);
          const casilla = page.getByTestId(`pres-${item}-${interruptor}`);
          await casilla.click();
          await expect(casilla).toBeChecked();
          // Encender el interruptor dibuja controles nuevos, y alguno trae su propia seccion.
          await openSections(page);
        }

        await expect(
          page.getByTestId(`pres-${item}-${KEY_CONTROL[clave]}`),
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
    // Ya mapeado: colocar desde la paleta no mapea nada, y un medidor sin cifra no tiene escala
    // que fijar. Lo que esta prueba mira es la escala, no como se mapea.
    const item = await moduleWithObject(page, `usar-medidor-${Date.now()}`, {
      objectId: 'medidor',
      title: 'Medidor',
      binding: {
        datasetId: DATASET_DEMO,
        dimensions: [],
        measures: ['CasosIngresados'],
        slots: { valor: ['CasosIngresados'] },
      },
    });

    await page.getByTestId('tab-formato').click();
    await openSections(page);
    // La escala deducida se ve antes de tocar nada: el respaldo la dice siempre.
    const fallback = page.getByTestId('medidor').first();
    await expect(fallback).toContainText('Escala');

    /*
     * Se escribe y se SALE del campo.
     */
    await page.getByTestId(`pres-${item}-maximo`).fill('5000');
    await page.getByTestId(`pres-${item}-maximo`).blur();
    await alDia(page);

    // El respaldo accesible dice la escala con palabras: es lo que lee quien no ve la aguja, y es
    // donde se comprueba sin abrir el canvas. Sale de la misma funcion que el dibujo.
    await expect(fallback).toContainText('5,000');
  });

  test('el embudo: cambiar contra que compara cambia la columna del respaldo', async ({ page }) => {
    const item = await moduleWithObject(page, `usar-embudo-${Date.now()}`, {
      objectId: 'embudo',
      title: 'Embudo',
      binding: {
        datasetId: DATASET_DEMO,
        dimensions: [DISTRITO_DEMO],
        measures: ['CasosIngresados'],
      },
    });

    await page.getByTestId('tab-formato').click();
    await openSections(page);
    const compare = page.getByTestId(`pres-${item}-comparar`);
    await expect(compare).toBeVisible();

    await compare.selectOption('anterior');
    await alDia(page);
    await expect(page.getByTestId('embudo').first()).toContainText('De la anterior');

    await compare.selectOption('primero');
    await alDia(page);
    await expect(page.getByTestId('embudo').first()).toContainText('De la primera');
  });

  test('los multiplos: elegir dos columnas desde el panel reparte los paneles', async ({ page }) => {
    const item = await moduleWithObject(page, `usar-multiplos-${Date.now()}`, {
      objectId: 'barras',
      title: 'Grafico de columnas',
      binding: {
        datasetId: DATASET_DEMO,
        dimensions: [DISTRITO_DEMO],
        measures: ['CasosIngresados'],
        slots: {
          'eje-x': ['DimTribunal.Distrito'],
          serie: [],
          'eje-y': ['CasosIngresados'],
          multiplo: [],
        },
      },
    });

    // El eje ya viene mapeado; lo unico que hay que anadir es la dimension que reparte los paneles.
    await page.getByTestId('tab-datos').click();
    await page.getByTestId(`well-${item}-multiplo-anadir`).click();
    await page.getByTestId(`well-${item}-multiplo-opcion-DimTribunal.Materia`).click();
    await alDia(page);

    // Sin tocar nada mas, el objeto ya se parte en paneles: el pozo es lo que lo decide.
    await expect(page.locator('.multiples__panel').first()).toBeVisible();

    await page.getByTestId('tab-formato').click();
    await openSections(page);
    await page.getByTestId(`pres-${item}-multiplos-columnas`).selectOption('2');
    await alDia(page);

    const gridColumns = await page
      .locator('.multiplos')
      .first()
      .evaluate((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length);
    expect(gridColumns).toBe(2);
  });
});
