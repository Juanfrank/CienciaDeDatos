import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './instancia';
import { entrarComo } from './session';

/** Consulta en lenguaje natural — seccion 4.9. */

interface RespuestaDeConsulta {
  entendido: string;
  resoluble: boolean;
  noEntendido: string[];
  filtros: Record<string, string[]>;
  url: string;
}

const preguntar = async (page: Page, pregunta: string, modulo = 'casos-pendientes') => {
  const r = await page.request.post('/api/consulta', { data: { pregunta, modulo } });
  return { estado: r.status(), body: (await r.json()) as Partial<RespuestaDeConsulta> };
};

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('entiende preguntas sobre lo que el modulo muestra', () => {
  test('reconoce una medida y devuelve la URL del modulo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { body } = await preguntar(page, 'cuantos casos pendientes hay');

    expect(body.resoluble).toBe(true);
    expect(body.url).toBe('/m/casos-pendientes');
  });

  test('reconoce un valor y lo convierte en filtro de la URL', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { body } = await preguntar(page, 'casos pendientes en Penal');

    expect(body.filtros).toEqual({ 'DimTribunal.Materia': ['Penal'] });
    expect(body.url).toContain('DimTribunal.Materia=Penal');
  });

  test('la respuesta es una URL, no datos: el endpoint no devuelve ninguna cifra', async ({
    page,
  }) => {
    // Es lo que mantiene la funcion dentro del contrato: quien pregunta navega a una URL normal
    // y el camino de lectura de siempre le aplica su ambito.
    await entrarComo(page, 'u-ana');
    const { body } = await preguntar(page, 'casos pendientes en Penal');

    expect(Object.keys(body).sort()).toEqual([
      'entendido',
      'filtros',
      'noEntendido',
      'resoluble',
      'url',
    ]);
  });
});

test.describe('una pregunta no revela lo que hay fuera del ambito (4.11)', () => {
  test('un valor fuera de alcance no se reconoce ni se nombra en la respuesta', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { body } = await preguntar(page, 'casos pendientes en Distrito Este');

    // Ni se filtra por el, ni se confirma que exista.
    expect(body.filtros?.['DimTribunal.Distrito']).toBeUndefined();
    expect(body.entendido).not.toContain('Este');
    expect(body.noEntendido).toContain('este');
  });

  test('la misma pregunta se entiende distinto segun quien la haga', async ({ page }) => {
    const pregunta = 'casos pendientes en Distrito Este';

    await entrarComo(page, 'u-ana');
    const norte = await preguntar(page, pregunta);

    await entrarComo(page, 'u-beto');
    const este = await preguntar(page, pregunta, 'casos-este');

    expect(norte.body.filtros?.['DimTribunal.Distrito']).toBeUndefined();
    expect(este.body.filtros?.['DimTribunal.Distrito']).toEqual(['Distrito Este']);
  });

  test('preguntar sobre un modulo no concedido responde como si no existiera', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { estado } = await preguntar(page, 'casos pendientes', 'estadisticas');
    expect(estado).toBe(404);
  });

  test('una pregunta vacia o desmesurada se rechaza antes de resolver nada', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    expect((await preguntar(page, '')).estado).toBe(400);
    expect((await preguntar(page, 'x'.repeat(400))).estado).toBe(400);
  });
});

/*
 * La INTERFAZ de la consulta esta retirada de la pagina mientras lo que devuelve no sea una
 * respuesta util (`VISIBLE_QUERY` en ModuleView). El componente y su ruta siguen ahi y las
 * pruebas tambien: saltarlas deja constancia de que existen y las devuelve al servicio cambiando
 * una sola constante, mientras que borrarlas obligaria a reescribirlas cuando el campo vuelva.
 */
test.describe.skip('la interfaz enseña lo que entendio antes de aplicarlo', () => {
  test('muestra la interpretacion y navega a la vista al confirmar', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('pregunta').fill('casos pendientes en Penal');
    await page.getByTestId('preguntar').click();

    await expect(page.getByTestId('pregunta-entendido')).toContainText('Penal');
    await page.getByTestId('pregunta-aplicar').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('avisa de lo que NO reconocio en vez de contestar a medias en silencio', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('pregunta').fill('casos pendientes de homicidios');
    await page.getByTestId('preguntar').click();

    await expect(page.getByTestId('pregunta-no-entendido')).toContainText('homicidios');
    // Lo que si entendio se conserva: se contesta lo que se pudo y se avisa de lo que no.
    await expect(page.getByTestId('pregunta-entendido')).toContainText('pendientes');
  });

  test('una pregunta sin nada reconocible no ofrece navegar', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('pregunta').fill('que tal va todo');
    await page.getByTestId('preguntar').click();

    await expect(page.getByTestId('pregunta-entendido')).toContainText('No se reconocio');
    await expect(page.getByTestId('pregunta-aplicar')).toHaveCount(0);
  });

  test('se puede preguntar con el teclado y la respuesta se anuncia', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('pregunta').fill('casos pendientes en Civil');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('pregunta-entendido')).toContainText('Civil');

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('no aparece en la vista incrustada', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/incrustar/m/casos-pendientes');
    await expect(page.getByTestId('pregunta')).toHaveCount(0);
  });
});
