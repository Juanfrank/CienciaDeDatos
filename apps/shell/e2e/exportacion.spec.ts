import { expect, test, type Page } from './instance';
import { asLogin } from './session';

/** Exportacion — seccion 4.9, encolada como exige 5.3. */

interface EstadoExportacion {
  id: string;
  estado: 'encolada' | 'procesando' | 'lista' | 'fallida';
  error?: string;
  archivo?: { nombre: string; bytes: number; descargarEn: string };
}

/** Cuanto se espera a que el trabajador termine. Mira la cola dos veces por segundo. */
const PLAZO = 15_000;

/**
 * Encola y espera a que el trabajador termine. Devuelve el estado final.
 *
 * Si no termina, el error dice QUE paso — apartado 2.18.
 *
 * Lo hacia con `expect.poll`, y eso mezclaba dos fallos que no se parecen en nada. Uno es «el
 * trabajo termino en un estado que no esperaba la prueba», que es un fallo de verdad. El otro es
 * «el trabajo seguia en cola cuando se acabo el plazo», que con tres workers compitiendo por la
 * maquina puede no ser un fallo de nada. Los dos salian como la misma linea roja, bajo el titulo
 * de la prueba y sin decir en que estado quedo, asi que la unica forma de saber cual era los dos
 * era volver a reproducirlo — y uno de los dos no se reproduce.
 *
 * Ahora la espera es propia y el mensaje lleva el id, el ultimo estado visto, cuantas veces se
 * pregunto y el error que el trabajo traiga. Con eso, la proxima vez que falle no empieza de cero.
 */
async function exportar(page: Page, body: Record<string, unknown>): Promise<EstadoExportacion> {
  const encolada = await page.request.post('/api/exports', { data: body });
  expect(encolada.status()).toBe(202);
  const { id } = (await encolada.json()) as { id: string };

  const consultar = async (): Promise<EstadoExportacion> =>
    (await (await page.request.get(`/api/exports/${id}`)).json()) as EstadoExportacion;

  const desde = Date.now();
  let consultas = 0;
  let estado = await consultar();

  while (estado.estado !== 'lista' && estado.estado !== 'fallida') {
    if (Date.now() - desde > PLAZO) {
      throw new Error(
        `La exportacion ${id} no termino en ${PLAZO} ms: se quedo en '${estado.estado}' tras ` +
          `${consultas} consultas. Esto NO es «termino en el estado equivocado»: es que el ` +
          `trabajador no la saco de la cola a tiempo. Ver 2.18 en la hoja de ruta.`,
      );
    }
    await page.waitForTimeout(250);
    consultas += 1;
    estado = await consultar();
  }

  return estado;
}

/** El archivo de un trabajo que la prueba espera terminado; falla si no lo esta. */
function fileOf(estado: EstadoExportacion): NonNullable<EstadoExportacion['archivo']> {
  expect(estado.archivo).toBeDefined();
  return estado.archivo as NonNullable<EstadoExportacion['archivo']>;
}

/** El contenido de un archivo descargado por el navegador, como texto. */
async function textoDe(descarga: import('@playwright/test').Download): Promise<string> {
  const flujo = await descarga.createReadStream();
  const trozos: Buffer[] = [];
  for await (const trozo of flujo) trozos.push(Buffer.from(trozo as Buffer));
  return Buffer.concat(trozos).toString('utf8');
}

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('la exportacion se despacha a una cola (5.3)', () => {
  test('encolar responde 202 con un identificador, no con el archivo', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const respuesta = await page.request.post('/api/exports', {
      data: { modulo: 'casos-pendientes', formato: 'csv' },
    });

    expect(respuesta.status()).toBe(202);
    const body = (await respuesta.json()) as Record<string, unknown>;
    expect(body['id']).toBeTruthy();
    expect(body['estado']).toBe('encolada');
    // La respuesta de encolado no lleva datos: el archivo todavia no existe.
    expect(respuesta.headers()['content-type']).toContain('application/json');
    expect(JSON.stringify(body)).not.toContain('Distrito');
  });

  test('el estado avanza hasta lista y entonces aparece la descarga', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });

    expect(estado.estado).toBe('lista');
    expect(fileOf(estado).nombre).toMatch(/^casos-pendientes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(fileOf(estado).bytes).toBeGreaterThan(0);
  });

  test('un formato desconocido se rechaza antes de encolar nada', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const respuesta = await page.request.post('/api/exports', {
      data: { modulo: 'casos-pendientes', formato: 'docx' },
    });
    expect(respuesta.status()).toBe(400);
  });
});

test.describe('el archivo sale filtrado por el ambito de quien exporta (principio 5)', () => {
  test('el CSV del equipo Norte no contiene datos del Este', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });

    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();
    expect(csv).toContain('Distrito Norte');
    expect(csv).not.toContain('Distrito Este');
  });

  test('un filtro de la URL fuera del ambito no amplia el archivo ni se anuncia como aplicado', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, {
      modulo: 'casos-pendientes',
      formato: 'csv',
      filtros: { 'DimTribunal.Distrito': ['Distrito Este'] },
    });

    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();
    // Ni una fila del Este, ni un encabezado que diga que el archivo esta filtrado por el Este:
    // un archivo vacio que anuncia ese filtro se leeria como "no hay casos en el Este".
    expect(csv).not.toContain('Distrito Este');
    expect(csv).toContain('fuera de su ambito de acceso');
    expect(csv).toContain('DimTribunal.Distrito');
  });

  test('no se puede exportar un modulo que el equipo no tiene concedido', async ({ page }) => {
    await asLogin(page, 'u-ana');
    // 'estadisticas' existe, pero vive fuera de la carpeta concedida al equipo Norte. Encolar
    // se admite —el modulo existe— pero el trabajo tiene que fallar al resolver, no generar.
    const estado = await exportar(page, { modulo: 'estadisticas', formato: 'csv' });
    expect(estado.estado).toBe('fallida');
    expect(estado.archivo).toBeUndefined();
  });
});

test.describe('cada objeto exporta LO QUE MUESTRA, no el dataset entero', () => {
  test('la tarjeta KPI exporta una fila y el grafico una por categoria', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });
    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();

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
    const card = bloques.get('Casos pendientes') ?? [];
    expect(card[0]).toBe('Indicador,CasosPendientes');
    expect(card.filter((l) => l.trim() !== '')).toHaveLength(2);

    // El grafico muestra una barra por distrito: exporta una fila por distrito, ya agregada.
    const barras = bloques.get('Pendientes por distrito') ?? [];
    expect(barras[0]).toBe('DimTribunal.Distrito,CasosPendientes');
    expect(barras.filter((l) => l.trim() !== '')).toHaveLength(2); // cabecera + Distrito Norte
  });

  test('dos objetos distintos ya no producen la misma tabla repetida', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });
    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();

    // Era el defecto: cinco objetos sobre el mismo dataset volcaban cinco veces lo mismo.
    const cabeceras = csv.split('\r\n').filter((l) => l.startsWith('DimTribunal.Distrito,'));
    expect(new Set(cabeceras).size).toBe(cabeceras.length);
  });
});

test.describe('la procedencia de la vista sobrevive a la exportacion (4.6)', () => {
  test('el CSV lleva la etiqueta de vista institucional y los filtros aplicados', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, {
      modulo: 'casos-pendientes',
      formato: 'csv',
      filtros: { 'DimTribunal.Materia': ['Penal'] },
    });

    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();
    expect(csv).toContain('Vista institucional oficial');
    expect(csv).toContain('DimTribunal.Materia = Penal');
    expect(csv).toContain('u-ana');
  });

  test('una vista personalizada se marca tambien en el nombre del archivo', async ({ page }) => {
    await asLogin(page, 'u-ana');

    // La procedencia ya NO se declara en la peticion: la decide el servidor mirando si esta
    // persona tiene personalizacion de este modulo. Antes esta prueba enviaba
    // `personalizada: true` y pasaba sin que hubiera ninguna personalizacion detras, que es
    // exactamente el agujero que 4.6 deja abierto si la etiqueta la elige el navegador.
    await page.request.put('/api/modules/casos-pendientes/view', {
      data: { ocultos: ['kpi-ingresados'] },
    });

    try {
      const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });

      expect(fileOf(estado).nombre).toContain('-vista-personalizada');
      const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();
      expect(csv).toContain('no es la vista institucional oficial');
      // Y lo que se oculto no aparece en el archivo: se exporta lo que se ve.
      expect(csv).not.toContain('Ingresados vs resueltos');
    } finally {
      await page.request.delete('/api/modules/casos-pendientes/view');
    }
  });
});

test.describe('los tres formatos salen con contenido valido', () => {
  for (const [formato, firma, tipo] of [
    ['xlsx', 'PK', 'spreadsheetml'],
    ['pdf', '%PDF-', 'application/pdf'],
    /*
     * El CSV se reconoce por su BOM, y el BOM son TRES BYTES.
     *
     * La firma se compara sobre los bytes crudos, leidos como latin1, asi que aqui va la forma en
     * que esos tres bytes se leen —`ï»¿`— y no el caracter U+FEFF que representan: escrito como
     * caracter, la comparacion tomaba un solo byte y nunca podia coincidir con nada.
     */
    ['csv', '\u00ef\u00bb\u00bf', 'text/csv'],
  ] as const) {
    test(`${formato} se descarga con su tipo y su firma`, async ({ page }) => {
      await asLogin(page, 'u-ana');
      const estado = await exportar(page, { modulo: 'casos-pendientes', formato });
      expect(estado.estado).toBe('lista');

      const descarga = await page.request.get(fileOf(estado).descargarEn);
      expect(descarga.headers()['content-type']).toContain(tipo);
      expect(descarga.headers()['content-disposition']).toContain(`filename="casos-pendientes-`);
      // Los datos exportados no se guardan en ningun intermediario.
      expect(descarga.headers()['cache-control']).toContain('no-store');

      const body = await descarga.body();
      expect(body.subarray(0, firma.length).toString('latin1')).toBe(firma);
    });
  }
});

test.describe('un archivo exportado no es alcanzable por otra persona', () => {
  test('consultar y descargar la exportacion de otro responde 404', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const estado = await exportar(page, { modulo: 'casos-pendientes', formato: 'csv' });
    const statusPath = `/api/exports/${estado.id}`;
    const filePath = fileOf(estado).descargarEn;

    // La misma URL de descarga, con otra sesion. Se responde 404 y no 403: decir "prohibido"
    // confirmaria que ese identificador existe y que alguien exporto ese modulo.
    await asLogin(page, 'u-beto');
    expect((await page.request.get(statusPath)).status()).toBe(404);
    expect((await page.request.get(filePath)).status()).toBe(404);
  });
});

test.describe('la interfaz refleja el ciclo encolar-consultar-descargar', () => {
  test('pulsar Generar DESCARGA el archivo, sin pedir un segundo clic', async ({ page }) => {
    /*
     * Antes aparecia un enlace «Descargar …» dentro de la barra de iconos y habia que pulsarlo.
     * Quien pulso «Generar» ya dijo lo que queria: el segundo clic le hace repetir la misma
     * decision, y mientras tanto el archivo espera a que alguien se acuerde de el.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('open-export').click();
    await page.getByLabel('Formato').selectOption('csv');

    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.getByTestId('exportar').click(),
    ]);

    expect(descarga.suggestedFilename()).toContain('casos-pendientes');
    // Y se dice arriba, en el emergente, no dentro de la barra.
    await expect(page.getByTestId('emergente')).toContainText('casos-pendientes');
  });

  test('cerrar el panel no se lleva por delante la descarga ni el aviso', async ({ page }) => {
    // Una exportacion tarda, y lo normal es cerrar el panel mientras tanto. El emergente vive en
    // la disposicion raiz justamente para que cerrar el panel no se lo lleve.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('open-export').click();

    const espera = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByTestId('exportar').click();
    await page.getByTestId('open-export').click();
    await expect(page.getByTestId('export-panel')).toHaveCount(0);

    await espera;
    await expect(page.getByTestId('emergente')).toContainText('descargando');
  });

  test('exporta lo que se ve: el filtro elegido viaja al archivo', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByTestId('open-export').click();
    await page.getByLabel('Formato').selectOption('csv');

    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.getByTestId('exportar').click(),
    ]);
    const csv = await textoDe(descarga);
    expect(csv).toContain('DimTribunal.Materia = Penal');
    /*
     * Ni rastro de «Civil», y eso incluye a los objetos de FILTRO.
     *
     * Un panel de filtros lista los valores disponibles —todos, tambien los que el filtro deja
     * fuera: para eso esta—. Exportado como una tabla mas, el archivo diria «Civil» junto al
     * aviso de que se filtro por «Penal», y quien lo recibiera no sabria cual de las dos cosas
     * creerse. Un control no es contenido.
     */
    expect(csv).not.toContain('Civil');
  });
});

test.describe('lo exportado dice lo mismo que la pantalla', () => {
  /*
   * Es la misma clase de defecto que hubo en el lienzo, en el otro extremo del sistema: todo lo
   * que se anadio a la presentacion —el formato de la cifra, la meta, la regla de color— se veia
   * en pantalla y no llegaba al archivo. Un PDF que circula por correo diciendo «2216» donde la
   * pantalla decia «2,216» contradice al objeto del que salio.
   */
  test('el CSV lleva el NUMERO, porque un CSV se calcula', async ({ page }) => {
    const estado = await exportar(page, {
      modulo: 'composicion',
      pagina: 'condicional',
      formato: 'csv',
    });
    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();

    /*
     * Se comprueba la INVARIANTE, no una cifra concreta.
     */
    const celdas = csv
      .split(/\r?\n/)
      .filter((l) => !l.startsWith('#') && l !== '')
      .flatMap((l) => l.split(','));

    // Hay cifras de cuatro digitos o mas, que son las que llevarian separador en pantalla...
    expect(celdas.some((c) => /^\d{4,}$/.test(c))).toBe(true);
    // ...y ninguna viene entre comillas con separador, que es como el escapador emitiria el texto
    // formateado. Con el, quien abra el archivo en una hoja de calculo no puede sumar la columna.
    expect(csv).not.toMatch(/"\d{1,3}(,\d{3})+"/);
  });

  test('y aun asi no pierde la meta ni la regla: van como comentario', async ({ page }) => {
    const estado = await exportar(page, {
      modulo: 'composicion',
      pagina: 'condicional',
      formato: 'csv',
    });
    const csv = await (await page.request.get(fileOf(estado).descargarEn)).text();

    // En pantalla son una raya y una barra roja; en un CSV no hay donde dibujarlas, pero quien
    // reciba el archivo tiene que poder saber contra que se leian esas cifras.
    expect(csv).toContain('# Umbral: 600');
    expect(csv).toContain('# Marcado en pantalla: mayor que 600');
  });
});
