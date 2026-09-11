import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Exportacion — seccion 4.9, encolada como exige 5.3.
 *
 * Lo que se verifica aqui no es que salga un archivo, sino COMO sale: encolar devuelve un
 * identificador, el estado se consulta y la descarga es una peticion aparte. Si alguien
 * convirtiera esto en una generacion sincrona, la primera prueba fallaria.
 */

interface EstadoExportacion {
  id: string;
  estado: 'encolada' | 'procesando' | 'lista' | 'fallida';
  error?: string;
  archivo?: { nombre: string; bytes: number; descargarEn: string };
}

/** Encola y espera a que el trabajador termine. Devuelve el estado final. */
async function exportar(page: Page, cuerpo: Record<string, unknown>): Promise<EstadoExportacion> {
  const encolada = await page.request.post('/api/exportaciones', { data: cuerpo });
  expect(encolada.status()).toBe(202);
  const { id } = (await encolada.json()) as { id: string };

  const consultar = async (): Promise<EstadoExportacion> =>
    (await (await page.request.get(`/api/exportaciones/${id}`)).json()) as EstadoExportacion;

  await expect.poll(async () => (await consultar()).estado, { timeout: 15_000 }).toMatch(/lista|fallida/);

  return consultar();
}

/** El archivo de un trabajo que la prueba espera terminado; falla si no lo esta. */
function archivoDe(estado: EstadoExportacion): NonNullable<EstadoExportacion['archivo']> {
  expect(estado.archivo).toBeDefined();
  return estado.archivo as NonNullable<EstadoExportacion['archivo']>;
}

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('la exportacion se despacha a una cola (5.3)', () => {
  test('encolar responde 202 con un identificador, no con el archivo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const respuesta = await page.request.post('/api/exportaciones', {
      data: { modulo: 'casos-pendientes', formato: 'csv' },
    });

    expect(respuesta.status()).toBe(202);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    expect(cuerpo['id']).toBeTruthy();
    expect(cuerpo['estado']).toBe('encolada');
    // La respuesta de encolado no lleva datos: el archivo todavia no existe.
    expect(respuesta.headers()['content-type']).toContain('application/json');
    expect(JSON.stringify(cuerpo)).not.toContain('Distrito');
  });

  test('el estado avanza hasta lista y entonces aparece la descarga', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });

    expect(estado.estado).toBe('lista');
    expect(archivoDe(estado).nombre).toMatch(/^casos-pendientes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(archivoDe(estado).bytes).toBeGreaterThan(0);
  });

  test('un formato desconocido se rechaza antes de encolar nada', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const respuesta = await page.request.post('/api/exportaciones', {
      data: { modulo: 'casos-pendientes', formato: 'docx' },
    });
    expect(respuesta.status()).toBe(400);
  });
});

test.describe('el archivo sale filtrado por el ambito de quien exporta (principio 5)', () => {
  test('el CSV del equipo Norte no contiene datos del Este', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });

    const csv = await (await page.request.get(archivoDe(estado).descargarEn)).text();
    expect(csv).toContain('Distrito Norte');
    expect(csv).not.toContain('Distrito Este');
  });

  test('un filtro de la URL fuera del ambito no amplia el archivo ni se anuncia como aplicado', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, {
      modulo: 'casos-pendientes',
      formato: 'csv',
      filtros: { 'DimTribunal.Distrito': ['Distrito Este'] },
    });

    const csv = await (await page.request.get(archivoDe(estado).descargarEn)).text();
    // Ni una fila del Este, ni un encabezado que diga que el archivo esta filtrado por el Este:
    // un archivo vacio que anuncia ese filtro se leeria como "no hay casos en el Este".
    expect(csv).not.toContain('Distrito Este');
    expect(csv).toContain('fuera de su ambito de acceso');
    expect(csv).toContain('DimTribunal.Distrito');
  });

  test('no se puede exportar un modulo que el equipo no tiene concedido', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    // 'estadisticas' existe, pero vive fuera de la carpeta concedida al equipo Norte. Encolar
    // se admite —el modulo existe— pero el trabajo tiene que fallar al resolver, no generar.
    const estado = await exportar(page, { modulo: 'estadisticas', formato: 'csv' });
    expect(estado.estado).toBe('fallida');
    expect(estado.archivo).toBeUndefined();
  });
});

test.describe('cada objeto exporta LO QUE MUESTRA, no el dataset entero', () => {
  test('la tarjeta KPI exporta una fila y el grafico una por categoria', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });
    const csv = await (await page.request.get(archivoDe(estado).descargarEn)).text();

    const bloques = new Map(
      csv
        .split('\r\n\r\n')
        .slice(1)
        .map((b) => {
          const [titulo, ...resto] = b.split('\r\n');
          return [(titulo ?? '').replace(/^# /, ''), resto];
        }),
    );

    // La tarjeta muestra un numero: exporta una cabecera y UNA fila.
    const tarjeta = bloques.get('Casos pendientes') ?? [];
    expect(tarjeta[0]).toBe('Indicador,CasosPendientes');
    expect(tarjeta.filter((l) => l.trim() !== '')).toHaveLength(2);

    // El grafico muestra una barra por distrito: exporta una fila por distrito, ya agregada.
    const barras = bloques.get('Pendientes por distrito') ?? [];
    expect(barras[0]).toBe('DimTribunal.Distrito,CasosPendientes');
    expect(barras.filter((l) => l.trim() !== '')).toHaveLength(2); // cabecera + Distrito Norte
  });

  test('dos objetos distintos ya no producen la misma tabla repetida', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });
    const csv = await (await page.request.get(archivoDe(estado).descargarEn)).text();

    // Era el defecto: cinco objetos sobre el mismo dataset volcaban cinco veces lo mismo.
    const cabeceras = csv.split('\r\n').filter((l) => l.startsWith('DimTribunal.Distrito,'));
    expect(new Set(cabeceras).size).toBe(cabeceras.length);
  });

  test('la imagen dibuja el primer GRAFICO, no la primera celda del modulo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'svg' });
    const svg = await (await page.request.get(archivoDe(estado).descargarEn)).text();

    // La primera celda del modulo es una tarjeta KPI. Antes salia un grafico de barras de un
    // solo numero con la etiqueta repetida; ahora sale el grafico de verdad.
    expect(svg).toContain('aria-label="Pendientes por distrito"');
    expect(svg).toContain('>Distrito Norte<');
  });
});

test.describe('la procedencia de la vista sobrevive a la exportacion (4.6)', () => {
  test('el CSV lleva la etiqueta de vista institucional y los filtros aplicados', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, {
      modulo: 'casos-pendientes',
      formato: 'csv',
      filtros: { 'DimTribunal.Materia': ['Penal'] },
    });

    const csv = await (await page.request.get(archivoDe(estado).descargarEn)).text();
    expect(csv).toContain('Vista institucional oficial');
    expect(csv).toContain('DimTribunal.Materia = Penal');
    expect(csv).toContain('u-ana');
  });

  test('una vista personalizada se marca tambien en el nombre del archivo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, {
      modulo: 'casos-pendientes',
      formato: 'csv',
      personalizada: true,
    });

    expect(archivoDe(estado).nombre).toContain('-vista-personalizada');
    const csv = await (await page.request.get(archivoDe(estado).descargarEn)).text();
    expect(csv).toContain('no es la vista institucional oficial');
  });
});

test.describe('los cuatro formatos salen con contenido valido', () => {
  for (const [formato, firma, tipo] of [
    ['xlsx', 'PK', 'spreadsheetml'],
    ['pdf', '%PDF-', 'application/pdf'],
    ['svg', '<svg ', 'image/svg+xml'],
  ] as const) {
    test(`${formato} se descarga con su tipo y su firma`, async ({ page }) => {
      await entrarComo(page, 'u-ana');
      const estado = await exportar(page, { modulo: 'casos-pendientes', formato });
      expect(estado.estado).toBe('lista');

      const descarga = await page.request.get(archivoDe(estado).descargarEn);
      expect(descarga.headers()['content-type']).toContain(tipo);
      expect(descarga.headers()['content-disposition']).toContain(`filename="casos-pendientes-`);
      // Los datos exportados no se guardan en ningun intermediario.
      expect(descarga.headers()['cache-control']).toContain('no-store');

      const cuerpo = await descarga.body();
      expect(cuerpo.subarray(0, firma.length).toString('latin1')).toBe(firma);
    });
  }
});

test.describe('un archivo exportado no es alcanzable por otra persona', () => {
  test('consultar y descargar la exportacion de otro responde 404', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });
    const rutaEstado = `/api/exportaciones/${estado.id}`;
    const rutaArchivo = archivoDe(estado).descargarEn;

    // La misma URL de descarga, con otra sesion. Se responde 404 y no 403: decir "prohibido"
    // confirmaria que ese identificador existe y que alguien exporto ese modulo.
    await entrarComo(page, 'u-beto');
    expect((await page.request.get(rutaEstado)).status()).toBe(404);
    expect((await page.request.get(rutaArchivo)).status()).toBe(404);
  });
});

test.describe('la interfaz refleja el ciclo encolar-consultar-descargar', () => {
  test('pulsar Generar muestra el estado y luego el enlace de descarga', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByLabel('Exportar').selectOption('csv');
    await page.getByTestId('exportar').click();

    // El estado es una region viva: cambia sin recargar y se anuncia a un lector de pantalla.
    await expect(page.getByTestId('estado-exportacion')).toHaveText(/Lista/, { timeout: 15_000 });

    const enlace = page.getByTestId('descargar-exportacion');
    await expect(enlace).toBeVisible();
    await expect(enlace).toContainText('casos-pendientes');
  });

  test('exporta lo que se ve: el filtro elegido viaja al archivo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByLabel('Exportar').selectOption('csv');
    await page.getByTestId('exportar').click();
    await expect(page.getByTestId('estado-exportacion')).toHaveText(/Lista/, { timeout: 15_000 });

    const href = await page.getByTestId('descargar-exportacion').getAttribute('href');
    const csv = await (await page.request.get(href ?? '')).text();
    expect(csv).toContain('DimTribunal.Materia = Penal');
    expect(csv).not.toContain('Civil');
  });
});
