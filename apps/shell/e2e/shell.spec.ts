import { expect, test } from '@playwright/test';
import { entrarComo } from './session';

/** Verificacion de punta a punta del shell, en un navegador real. */

/**
 * Toda prueba empieza con una sesion de verdad. Antes no hacia falta: la aplicacion emitia una
 * sola con un usuario de demostracion en cuanto llegaba una peticion sin cookie, que es
 * exactamente lo que A1 quito.
 */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('navegacion y ruteo por slug (4.11)', () => {
  test('la raiz redirige al primer modulo accesible', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/m\/casos-pendientes/);
    await expect(page.getByTestId('module-title')).toHaveText('Casos pendientes');
  });

  test('cada modulo tiene su propia URL estable, abrible directamente', async ({ page }) => {
    await page.goto('/m/audiencias');
    await expect(page.getByTestId('module-title')).toHaveText('Audiencias');
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
    await expect(page.getByTestId('value-kpi').first()).not.toHaveText('0');
    await expect(page.getByTestId('chart-barras-distrito').getByTestId('barras')).toBeVisible();
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
    await expect(page.getByTestId('module-title')).toBeVisible();
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
    const dataRows = datos.objetos[0].result.rows as unknown[][];
    const distritos = [...new Set(dataRows.map((f) => String(f[0])))];
    expect(distritos).toEqual(['Distrito Este']);
  });

  test('cambiar el equipo activo cambia los datos SIN cerrar sesion', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    const before = await page.getByTestId('tabla').innerText();
    expect(before).toContain('Distrito Norte');

    const cookieAntes = (await page.context().cookies()).find((c) => c.name === 'sesion')?.value;

    // Ana pertenece a los dos equipos. Cambia el ACTIVO, no la identidad: es el gesto que
    // describe 4.10.2, y antes esta prueba lo hacia cambiando de persona en un desplegable, que
    // no probaba nada de lo que dice su titulo.
    await page.getByTestId('team-picker').selectOption('equipo-este');
    await page.waitForLoadState('networkidle');
    await page.goto('/m/casos-este');

    await expect(page.getByTestId('module-title')).toHaveText('Casos pendientes Este');

    // La sesion es la MISMA: cambiar de equipo no reemite credenciales (criterio de seccion 9).
    const cookieDespues = (await page.context().cookies()).find((c) => c.name === 'sesion')?.value;
    expect(cookieDespues).toBe(cookieAntes);
  });
});

test.describe('acceso: ocultar no es proteger (criterio de la seccion 9)', () => {
  test('un modulo no concedido al equipo NO se abre por URL directa', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    // 'estadisticas' existe en la organizacion general pero vive fuera de la carpeta concedida
    // al equipo Norte. El arbol no lo muestra; escribir la URL a mano tampoco debe servir.
    const respuesta = await page.goto('/m/estadisticas');
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByTestId('module-title')).toHaveCount(0);
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
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('recargar la URL con filtros reproduce el mismo estado sin pasos adicionales', async ({ page }) => {
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
    await expect(page.getByTestId('slicer-Penal')).toHaveAttribute('aria-pressed', 'true');

    // En una pestaña nueva, la misma URL da la misma vista.
    await page.reload();
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });

  test('un parametro fuera del ambito no amplia el resultado ni revela nada', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    // El equipo Norte no puede ver el Distrito Este, lo pida la URL o no.
    await page.goto('/m/casos-pendientes?DimTribunal.Distrito=Distrito+Este');
    const content = await page.getByTestId('tabla').innerText();
    expect(content).not.toContain('Distrito Este');
  });

  test('un segmentador no se filtra a si mismo: se puede elegir un segundo valor', async ({ page }) => {
    // Si el segmentador se filtrara con su propia seleccion, al elegir 'Penal' desapareceria
    // 'Civil' y no habria forma de anadirlo ni de volver atras.
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await expect(page.getByTestId('slicer-Civil')).toBeVisible();
    await page.getByTestId('slicer-Civil').click();
    await expect(page).toHaveURL(/Materia=Penal[\s\S]*Materia=Civil/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Civil');
  });

  test('los ajustes de filtro usan replaceState: el boton atras no se satura', async ({ page }) => {
    await page.goto('/m/audiencias');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);
    await page.getByTestId('slicer-Civil').click();
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
    await page.getByTestId('bar-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });
});

test.describe('la interfaz distingue lo elegido de lo impuesto por el ambito', () => {
  test('sin filtros propios solo se muestra la restriccion de ambito', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    // Que la vista esta recortada se ve SIEMPRE; el detalle de por donde, solo si se pide. El
    // enunciado completo ocupaba una linea entera encima del modulo y crece con el ambito.
    const badge = page.getByTestId('active-scope');
    await expect(badge).toBeVisible();
    await expect(page.getByTestId('detail-scope')).toHaveCount(0);

    // El equipo Norte esta restringido a Penal y Civil: eso es ambito, no una eleccion.
    await badge.hover();
    await expect(page.getByTestId('detail-scope')).toContainText('Penal, Civil');
    await expect(page.getByTestId('filtros-activos')).toHaveCount(0);
  });

  test('el detalle del ambito tambien se alcanza con el teclado (1.4.13)', async ({ page }) => {
    // Un detalle que solo aparece al pasar el raton no existe para quien no lo usa, y el ambito
    // es justo lo que explica por que las cifras salen como salen.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('active-scope').focus();
    await expect(page.getByTestId('detail-scope')).toContainText('Penal, Civil');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('detail-scope')).toHaveCount(0);
  });

  test('al elegir un filtro, aparece como propio y deja de contarse como ambito', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');

    await page.getByTestId('active-scope').hover();
    await expect(page.getByTestId('detail-scope')).not.toContainText('Materia');
  });
});

test.describe('marcadores (4.4)', () => {
  test('guardar el estado actual como marcador y volver a el', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByTestId('abrir-marcadores').click();
    await page.getByTestId('bookmark-name').fill('Solo penal');
    await page.getByTestId('save-bookmark').click();

    await expect(page.getByTestId('only-bookmark penal')).toBeVisible();

    // Salir del modulo y volver por el marcador reproduce el estado guardado.
    await page.goto('/m/casos-pendientes');
    await expect(page).not.toHaveURL(/Materia=/);
    await page.getByTestId('abrir-marcadores').click();
    await page.getByTestId('only-bookmark penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);
  });

  test('un marcador compartido se filtra segun QUIEN LO ABRE, no quien lo creo', async ({ page }) => {
    // Ana, del equipo Norte, guarda un marcador filtrado a su distrito.
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Distrito=Distrito+Norte');
    await page.getByTestId('abrir-marcadores').click();
    await page.getByTestId('bookmark-name').fill('Mi distrito');
    await page.getByTestId('save-bookmark').click();
    await expect(page.getByTestId('my-bookmark distrito')).toBeVisible();

    const url = await page.getByTestId('my-bookmark distrito').getAttribute('href');
    expect(url).toContain('Distrito+Norte');

    // Beto, del equipo Este, abre exactamente esa URL.
    await entrarComo(page, 'u-beto');
    const datos = await page.request
      .get(`/api/modulos/casos-este?${url?.split('?')[1] ?? ''}`)
      .then((r) => r.json());

    // El marcador pedia el Norte; el ambito de Beto no lo permite. No ve los datos de Ana.
    const dataRows = datos.objetos.find((o: { result?: unknown }) => o.result)?.result.rows ?? [];
    expect(dataRows).toHaveLength(0);
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
    await page.getByTestId('slicer-Penal').click();
    await page.waitForLoadState('networkidle');
    await page.goto('/m/audiencias');
    await page.waitForLoadState('networkidle');

    // Verificacion directa del criterio de la seccion 9: ninguna llamada a un endpoint XMLA,
    // a un servidor SQL ni al Data Warehouse.
    expect(externas).toEqual([]);
  });
});

test.describe('identidad institucional (4.3)', () => {
  test('el nombre de la institucion y su emblema estan en TODAS las paginas', async ({ page }) => {
    await entrarComo(page, 'u-admin');

    // La norma de marca pide el nombre de la institucion en cada pagina. Se comprueba en las
    // tres superficies distintas —modulo, panel de administracion y avisos— porque cada una
    // tiene su propia disposicion y es donde se perderia si alguien anadiera una cuarta.
    for (const path of ['/m/casos-pendientes', '/admin', '/avisos']) {
      await page.goto(path);
      await expect(page.getByTestId('institucion')).toContainText(
        'Poder Judicial de la República Dominicana',
      );
      await expect(page.locator('.header__emblema')).toBeVisible();
    }
  });

  test('el emblema se sirve desde el propio origen, no de un CDN externo', async ({ page }) => {
    // Principio 1: el navegador solo habla con esta aplicacion. Un logotipo traido de fuera es
    // la forma mas facil de abrir esa puerta sin darse cuenta.
    const src = await page.goto('/m/casos-pendientes').then(async () => {
      return page.locator('.header__emblema').getAttribute('src');
    });
    expect(src?.startsWith('/')).toBe(true);

    const respuesta = await page.request.get(src ?? '');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toContain('image/png');
  });

  test('el emblema es decorativo: el nombre lo lleva el texto de al lado', async ({ page }) => {
    // Con texto alternativo, un lector de pantalla anunciaria dos veces la institucion.
    await page.goto('/m/casos-pendientes');
    await expect(page.locator('.header__emblema')).toHaveAttribute('alt', '');
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

test.describe('el alto de un objeto no depende de su contenido', () => {
  /*
   * La disposicion se guarda en `{x, y, w, h}` y `h` es un numero de FILAS. Si la fila se estira
   * con el contenido, `h` deja de significar un alto y pasa a significar «al menos esto»: dos
   * tarjetas declaradas iguales salen con alturas distintas porque una tiene el subtitulo mas
   * largo, la fila entera crece para acomodar a la mas alta, y lo que alguien compuso cuadrado se
   * publica descuadrado. Se nota poco en el editor y mucho en pantalla.
   */
  test('dos objetos de la misma fila miden exactamente lo mismo', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
    await expect(page.locator('.grid__cell').first()).toBeVisible();

    const celdas = await page.locator('.grid__cell').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), alto: Math.round(r.height) };
      }),
    );
    expect(celdas.length).toBeGreaterThan(3);

    const porFila = new Map<number, number[]>();
    for (const c of celdas) porFila.set(c.top, [...(porFila.get(c.top) ?? []), c.alto]);

    // Al menos una fila con varios objetos, o la prueba no comprueba nada.
    expect([...porFila.values()].some((altos) => altos.length > 1)).toBe(true);
    for (const altos of porFila.values()) expect(new Set(altos).size).toBe(1);
  });

  test('el alto es multiplo exacto de las filas declaradas, no del contenido', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
    await expect(page.locator('.grid__cell').first()).toBeVisible();

    const { unit, hole, altos } = await page.evaluate(() => {
      const rejilla = document.querySelector('.rejilla') as HTMLElement;
      const e = getComputedStyle(rejilla);
      return {
        unit: parseFloat(e.gridAutoRows),
        hole: parseFloat(e.rowGap),
        altos: Array.from(document.querySelectorAll('.grid__cell')).map((el) =>
          Math.round(el.getBoundingClientRect().height),
        ),
      };
    });

    // alto = n*unidad + (n-1)*hueco para algun n entero. Si el contenido mandara, no cuadraria.
    for (const alto of altos) {
      const n = (alto + hole) / (unit + hole);
      expect(Math.abs(n - Math.round(n))).toBeLessThan(0.01);
    }
  });

  test('una tabla que no cabe se desplaza DENTRO de su tarjeta', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
    const contenedor = page.getByTestId('tabla').first().locator('..');

    const medida = await contenedor.evaluate((el: HTMLElement) => ({
      overflows: el.scrollHeight > el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(medida.overflowY).toBe('auto');
    expect(medida.overflows).toBe(true);

    // Y se desplaza de verdad, sin que la tarjeta crezca.
    const before = await page.getByTestId('tabla').first().locator('../..').boundingBox();
    await contenedor.evaluate((el) => el.scrollTo(0, 9999));
    const after = await page.getByTestId('tabla').first().locator('../..').boundingBox();
    expect(Math.round(after?.height ?? 0)).toBe(Math.round(before?.height ?? 0));
    expect(await contenedor.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});
