import { expect, test } from '@playwright/test';

/**
 * Verificacion de punta a punta del shell, en un navegador real.
 *
 * Cada bloque corresponde a un criterio de aceptacion de la seccion 9 que solo se puede
 * comprobar con la aplicacion corriendo.
 */

/** Pone la sesion en una persona y su equipo antes de navegar. */
async function entrarComo(page: import('@playwright/test').Page, userId: string) {
  await page.goto('/');
  await page.request.post('/api/sesion/equipo-activo', { data: { userId } });
}

test.describe('navegacion y ruteo por slug (4.11)', () => {
  test('la raiz redirige al primer modulo accesible', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/m\/casos-pendientes/);
    await expect(page.getByTestId('titulo-modulo')).toHaveText('Casos pendientes');
  });

  test('cada modulo tiene su propia URL estable, abrible directamente', async ({ page }) => {
    await page.goto('/m/audiencias');
    await expect(page.getByTestId('titulo-modulo')).toHaveText('Audiencias');
  });

  test('el arbol de navegacion solo muestra lo concedido al equipo activo', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('nav-casos-pendientes')).toBeVisible();
    await expect(page.getByTestId('nav-audiencias')).toBeVisible();
    // 'estadisticas' vive fuera de la carpeta concedida al equipo Norte.
    await expect(page.getByTestId('nav-estadisticas')).toHaveCount(0);
  });
});

test.describe('los objetos se dibujan con datos leidos del cache', () => {
  test('un modulo muestra KPI, barras, matriz y tabla con datos reales', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('kpi-valor').first()).not.toHaveText('0');
    await expect(page.getByTestId('barras')).toBeVisible();
    await expect(page.getByTestId('matriz')).toBeVisible();
    await expect(page.getByTestId('tabla')).toBeVisible();
  });

  test('muestra la marca de tiempo del dato servido (4.8)', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('frescura')).toContainText('Datos actualizados');
  });

  test('un objeto con un campo retirado se marca ROTO, no desaparece (4.2)', async ({ page }) => {
    // 'audiencias' contiene un objeto mapeado a un campo que ya no existe en el dataset.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/audiencias');
    const roto = page.getByTestId('objeto-roto');
    await expect(roto).toBeVisible();
    await expect(roto).toContainText('CampoRetirado');
    // El resto del modulo sigue en pie: el objeto sano de al lado se dibuja igual.
    await expect(page.getByTestId('titulo-modulo')).toBeVisible();
    await expect(page.getByTestId('barras')).toBeVisible();
  });
});

test.describe('ambito de acceso por equipo activo (4.10.4)', () => {
  test('dos equipos distintos ven datos distintos y correctos en el mismo dataset', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    const textoNorte = await page.getByTestId('tabla').innerText();
    expect(textoNorte).toContain('Distrito Norte');
    expect(textoNorte).not.toContain('Distrito Este');

    await entrarComo(page, 'u-beto');
    await page.goto('/m/casos-este');
    const textoEste = await page.getByTestId('barras').innerText();
    expect(textoEste.length).toBeGreaterThan(0);

    const datos = await page.request.get('/api/modulos/casos-este').then((r) => r.json());
    const filas = datos.objetos[0].result.rows as unknown[][];
    const distritos = [...new Set(filas.map((f) => String(f[0])))];
    expect(distritos).toEqual(['Distrito Este']);
  });

  test('cambiar el equipo activo cambia los datos SIN cerrar sesion', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    const antes = await page.getByTestId('tabla').innerText();
    expect(antes).toContain('Distrito Norte');

    // La misma sesion: solo cambia el equipo activo.
    await page.getByTestId('selector-usuario').selectOption('u-beto');
    await page.waitForLoadState('networkidle');
    await page.goto('/m/casos-este');

    await expect(page.getByTestId('titulo-modulo')).toHaveText('Casos pendientes Este');
  });
});

test.describe('acceso: ocultar no es proteger (criterio de la seccion 9)', () => {
  test('un modulo no concedido al equipo NO se abre por URL directa', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    // 'estadisticas' existe en la organizacion general pero vive fuera de la carpeta concedida
    // al equipo Norte. El arbol no lo muestra; escribir la URL a mano tampoco debe servir.
    const respuesta = await page.goto('/m/estadisticas');
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByTestId('titulo-modulo')).toHaveCount(0);
  });

  test('la API tampoco lo sirve, aunque se la llame directamente', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const respuesta = await page.request.get('/api/modulos/estadisticas');
    expect(respuesta.status()).toBe(404);
  });

  test('un equipo no puede fijar un teamId al que no pertenece', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    // Beto solo pertenece al equipo Este. Pedir el Norte con una peticion a mano es 403.
    const respuesta = await page.request.post('/api/sesion/equipo-activo', {
      data: { teamId: 'equipo-norte' },
    });
    expect(respuesta.status()).toBe(403);
  });
});

test.describe('estado de filtros en la URL (4.11)', () => {
  test('seleccionar en el segmentador se refleja en la query string', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('recargar la URL con filtros reproduce el mismo estado sin pasos adicionales', async ({ page }) => {
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
    await expect(page.getByTestId('segmentador-Penal')).toHaveAttribute('aria-pressed', 'true');

    // En una pestaña nueva, la misma URL da la misma vista.
    await page.reload();
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('un parametro fuera del ambito no amplia el resultado ni revela nada', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    // El equipo Norte no puede ver el Distrito Este, lo pida la URL o no.
    await page.goto('/m/casos-pendientes?DimTribunal.Distrito=Distrito+Este');
    const texto = await page.getByTestId('tabla').innerText();
    expect(texto).not.toContain('Distrito Este');
  });

  test('un segmentador no se filtra a si mismo: se puede elegir un segundo valor', async ({ page }) => {
    // Si el segmentador se filtrara con su propia seleccion, al elegir 'Penal' desapareceria
    // 'Civil' y no habria forma de anadirlo ni de volver atras.
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await expect(page.getByTestId('segmentador-Civil')).toBeVisible();
    await page.getByTestId('segmentador-Civil').click();
    await expect(page).toHaveURL(/Materia=Penal[\s\S]*Materia=Civil/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Civil');
  });

  test('los ajustes de filtro usan replaceState: el boton atras no se satura', async ({ page }) => {
    await page.goto('/m/audiencias');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);
    await page.getByTestId('segmentador-Civil').click();
    await expect(page).toHaveURL(/Materia=Civil/);

    // Dos ajustes de filtro no han anadido dos entradas al historial: un solo "atras" vuelve
    // al modulo anterior, no deshace filtro a filtro.
    await page.goBack();
    await expect(page).toHaveURL(/\/m\/audiencias/);
  });
});

test.describe('filtrado cruzado (4.4)', () => {
  test('pulsar una categoria en el grafico filtra el resto del modulo', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/m/casos-este');
    await page.getByTestId('barra-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });
});

test.describe('la interfaz distingue lo elegido de lo impuesto por el ambito', () => {
  test('sin filtros propios solo se muestra la restriccion de ambito', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    // El equipo Norte esta restringido a Penal y Civil: eso es ambito, no una eleccion.
    await expect(page.getByTestId('ambito-activo')).toContainText('Penal, Civil');
    await expect(page.getByTestId('filtros-activos')).toHaveCount(0);
  });

  test('al elegir un filtro, aparece como propio y deja de contarse como ambito', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
    await expect(page.getByTestId('ambito-activo')).not.toContainText('Materia');
  });
});

test.describe('marcadores (4.4)', () => {
  test('guardar el estado actual como marcador y volver a el', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByTestId('abrir-marcadores').click();
    await page.getByTestId('nombre-marcador').fill('Solo penal');
    await page.getByTestId('guardar-marcador').click();

    await expect(page.getByTestId('marcador-Solo penal')).toBeVisible();

    // Salir del modulo y volver por el marcador reproduce el estado guardado.
    await page.goto('/m/casos-pendientes');
    await expect(page).not.toHaveURL(/Materia=/);
    await page.getByTestId('abrir-marcadores').click();
    await page.getByTestId('marcador-Solo penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);
  });

  test('un marcador compartido se filtra segun QUIEN LO ABRE, no quien lo creo', async ({ page }) => {
    // Ana, del equipo Norte, guarda un marcador filtrado a su distrito.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Distrito=Distrito+Norte');
    await page.getByTestId('abrir-marcadores').click();
    await page.getByTestId('nombre-marcador').fill('Mi distrito');
    await page.getByTestId('guardar-marcador').click();
    await expect(page.getByTestId('marcador-Mi distrito')).toBeVisible();

    const url = await page.getByTestId('marcador-Mi distrito').getAttribute('href');
    expect(url).toContain('Distrito+Norte');

    // Beto, del equipo Este, abre exactamente esa URL.
    await entrarComo(page, 'u-beto');
    const datos = await page.request
      .get(`/api/modulos/casos-este?${url?.split('?')[1] ?? ''}`)
      .then((r) => r.json());

    // El marcador pedia el Norte; el ambito de Beto no lo permite. No ve los datos de Ana.
    const filas = datos.objetos.find((o: { result?: unknown }) => o.result)?.result.rows ?? [];
    expect(filas).toHaveLength(0);
  });
});

test.describe('principio 1: el navegador solo habla con esta aplicacion', () => {
  test('ninguna peticion sale fuera del origen de la aplicacion', async ({ page }) => {
    const externas: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.origin !== 'http://localhost:4310') externas.push(req.url());
    });

    await page.goto('/m/casos-pendientes');
    await page.getByTestId('segmentador-Penal').click();
    await page.waitForLoadState('networkidle');
    await page.goto('/m/audiencias');
    await page.waitForLoadState('networkidle');

    // Verificacion directa del criterio de la seccion 9: ninguna llamada a un endpoint XMLA,
    // a un servidor SQL ni al Data Warehouse.
    expect(externas).toEqual([]);
  });
});

test.describe('salud (seccion 7)', () => {
  test('/health reporta el conector activo sin instanciar ninguno', async ({ request }) => {
    const informe = await request.get('/health').then((r) => r.json());
    expect(informe.status).toBe('ok');
    expect(informe.configuredConnector).toBe('mock');
    const conector = informe.checks.find((c: { name: string }) => c.name === 'conector-de-datos');
    expect(conector.detail).toContain("'mock'");
  });
});
