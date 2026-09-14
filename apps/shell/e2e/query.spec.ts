import { expect, test, type Page } from './instance';
import { asLogin } from './session';

/** Consulta en lenguaje natural — seccion 4.9. */

interface QueryResponse {
  entendido: string;
  resoluble: boolean;
  noEntendido: string[];
  filtros: Record<string, string[]>;
  url: string;
}

const preguntar = async (page: Page, pregunta: string, modulo = 'casos-pendientes') => {
  const r = await page.request.post('/api/query', { data: { pregunta, modulo } });
  return { estado: r.status(), body: (await r.json()) as Partial<QueryResponse> };
};

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('entiende preguntas sobre lo que el modulo muestra', () => {
  test('reconoce una medida y devuelve la URL del modulo', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const { body } = await preguntar(page, 'cuantos casos pendientes hay');

    expect(body.resoluble).toBe(true);
    expect(body.url).toBe('/m/casos-pendientes');
  });

  test('reconoce un valor y lo convierte en filtro de la URL', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const { body } = await preguntar(page, 'casos pendientes en Penal');

    expect(body.filtros).toEqual({ 'DimTribunal.Materia': ['Penal'] });
    expect(body.url).toContain('DimTribunal.Materia=Penal');
  });

  test('la respuesta es una URL, no datos: el endpoint no devuelve ninguna cifra', async ({
    page,
  }) => {
    // Es lo que mantiene la funcion dentro del contrato: quien pregunta navega a una URL normal
    // y el camino de lectura de siempre le aplica su ambito.
    await asLogin(page, 'u-ana');
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
    await asLogin(page, 'u-ana');
    const { body } = await preguntar(page, 'casos pendientes en Distrito Este');

    // Ni se filtra por el, ni se confirma que exista.
    expect(body.filtros?.['DimTribunal.Distrito']).toBeUndefined();
    expect(body.entendido).not.toContain('Este');
    expect(body.noEntendido).toContain('este');
  });

  test('la misma pregunta se entiende distinto segun quien la haga', async ({ page }) => {
    const pregunta = 'casos pendientes en Distrito Este';

    await asLogin(page, 'u-ana');
    const norte = await preguntar(page, pregunta);

    await asLogin(page, 'u-beto');
    const este = await preguntar(page, pregunta, 'casos-este');

    expect(norte.body.filtros?.['DimTribunal.Distrito']).toBeUndefined();
    expect(este.body.filtros?.['DimTribunal.Distrito']).toEqual(['Distrito Este']);
  });

  test('preguntar sobre un modulo no concedido responde como si no existiera', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const { estado } = await preguntar(page, 'casos pendientes', 'estadisticas');
    expect(estado).toBe(404);
  });

  test('una pregunta vacia o desmesurada se rechaza antes de resolver nada', async ({ page }) => {
    await asLogin(page, 'u-ana');
    expect((await preguntar(page, '')).estado).toBe(400);
    expect((await preguntar(page, 'x'.repeat(400))).estado).toBe(400);
  });
});

/*
 * La INTERFAZ de la consulta esta retirada de la pagina mientras lo que devuelve no sea una
 * respuesta util (`VISIBLE_QUERY` en ModuleView). El componente y su ruta siguen cubiertos por sus
 * pruebas unitarias y por las de arriba, que van contra la API.
 *
 * Las de navegador que la ejercitaban estaban saltadas, y una prueba que no corre no comprueba
 * nada: se desincroniza del codigo en silencio y el dia que se reactiva hay que reescribirla
 * igual. Viven en el historial, en el commit que retiro el campo.
 */
