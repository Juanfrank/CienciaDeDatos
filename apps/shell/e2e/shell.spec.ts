import { expect, test } from './instance';
import { asLogin } from './session';

/** Verificacion de punta a punta del shell, en un navegador real. */

/**
 * Toda prueba empieza con una sesion de verdad. Antes no hacia falta: la aplicacion emitia una
 * sola con un usuario de demostracion en cuanto llegaba una peticion sin cookie, que es
 * exactamente lo que A1 quito.
 */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
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
    await asLogin(page, 'u-ana');
    await page.goto('/m/audiencias');
    const roto = page.getByTestId('object-broken');
    await expect(roto).toBeVisible();
    await expect(roto).toContainText('CampoRetirado');
    // El resto del modulo sigue en pie: el objeto sano de al lado se dibuja igual.
    await expect(page.getByTestId('module-title')).toBeVisible();
    await expect(page.getByTestId('barras')).toBeVisible();
  });
});

test.describe('ambito de acceso por equipo activo (4.10.4)', () => {
  test('dos equipos distintos ven datos distintos y correctos en el mismo dataset', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    const norteText = await page.getByTestId('tabla').innerText();
    expect(norteText).toContain('Distrito Norte');
    expect(norteText).not.toContain('Distrito Este');

    await asLogin(page, 'u-beto');
    await page.goto('/m/casos-este');
    const esteText = await page.getByTestId('barras').innerText();
    expect(esteText.length).toBeGreaterThan(0);

    const datos = await page.request.get('/api/modules/casos-este').then((r) => r.json());
    const dataRows = datos.objetos[0].result.rows as unknown[][];
    const distritos = [...new Set(dataRows.map((f) => String(f[0])))];
    expect(distritos).toEqual(['Distrito Este']);
  });

  test('cambiar el equipo activo cambia los datos SIN cerrar sesion', async ({ page }) => {
    await page.goto('/m/casos-pendientes');
    const before = await page.getByTestId('tabla').innerText();
    expect(before).toContain('Distrito Norte');

    const beforeCookie = (await page.context().cookies()).find((c) => c.name === 'sesion')?.value;

    // Ana pertenece a los dos equipos. Cambia el ACTIVO, no la identidad: es el gesto que
    // describe 4.10.2, y antes esta prueba lo hacia cambiando de persona en un desplegable, que
    // no probaba nada de lo que dice su titulo.
    await page.getByTestId('team-picker').selectOption('equipo-este');
    await page.waitForLoadState('networkidle');
    await page.goto('/m/casos-este');

    await expect(page.getByTestId('module-title')).toHaveText('Casos pendientes Este');

    // La sesion es la MISMA: cambiar de equipo no reemite credenciales (criterio de seccion 9).
    const afterCookie = (await page.context().cookies()).find((c) => c.name === 'sesion')?.value;
    expect(afterCookie).toBe(beforeCookie);
  });
});

test.describe('acceso: ocultar no es proteger (criterio de la seccion 9)', () => {
  test('un modulo no concedido al equipo NO se abre por URL directa', async ({ page }) => {
    await asLogin(page, 'u-ana');
    // 'estadisticas' existe en la organizacion general pero vive fuera de la carpeta concedida
    // al equipo Norte. El arbol no lo muestra; escribir la URL a mano tampoco debe servir.
    const respuesta = await page.goto('/m/estadisticas');
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByTestId('module-title')).toHaveCount(0);
  });

  test('la API tampoco lo sirve, aunque se la llame directamente', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const respuesta = await page.request.get('/api/modules/estadisticas');
    expect(respuesta.status()).toBe(404);
  });

  test('un equipo no puede fijar un teamId al que no pertenece', async ({ page }) => {
    await asLogin(page, 'u-beto');
    // Beto solo pertenece al equipo Este. Pedir el Norte con una peticion a mano es 403.
    const respuesta = await page.request.post('/api/session/active-team', {
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
    await asLogin(page, 'u-ana');
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
    await asLogin(page, 'u-beto');
    await page.goto('/m/casos-este');
    await page.getByTestId('bar-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');
  });
});

test.describe('la interfaz distingue lo elegido de lo impuesto por el ambito', () => {
  test('sin filtros propios solo se muestra la restriccion de ambito', async ({ page }) => {
    await asLogin(page, 'u-ana');
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
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('active-scope').focus();
    await expect(page.getByTestId('detail-scope')).toContainText('Penal, Civil');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('detail-scope')).toHaveCount(0);
  });

  test('al elegir un filtro, aparece como propio y deja de contarse como ambito', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page.getByTestId('filtros-activos')).toContainText('Penal');

    await page.getByTestId('active-scope').hover();
    await expect(page.getByTestId('detail-scope')).not.toContainText('Materia');
  });
});

test.describe('marcadores (4.4)', () => {
  test('guardar el estado actual como marcador y volver a el', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    await page.getByTestId('open-bookmarks').click();
    await page.getByTestId('bookmark-name').fill('Solo penal');
    await page.getByTestId('save-bookmark').click();

    await expect(page.getByTestId('bookmark-Solo penal')).toBeVisible();

    // Salir del modulo y volver por el marcador reproduce el estado guardado.
    await page.goto('/m/casos-pendientes');
    await expect(page).not.toHaveURL(/Materia=/);
    await page.getByTestId('open-bookmarks').click();
    await page.getByTestId('bookmark-Solo penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);
  });

  test('un marcador compartido se filtra segun QUIEN LO ABRE, no quien lo creo', async ({ page }) => {
    // Ana, del equipo Norte, guarda un marcador filtrado a su distrito.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Distrito=Distrito+Norte');
    await page.getByTestId('open-bookmarks').click();
    await page.getByTestId('bookmark-name').fill('Mi distrito');
    await page.getByTestId('save-bookmark').click();
    await expect(page.getByTestId('bookmark-Mi distrito')).toBeVisible();

    const url = await page.getByTestId('bookmark-Mi distrito').getAttribute('href');
    expect(url).toContain('Distrito+Norte');

    // Beto, del equipo Este, abre exactamente esa URL.
    await asLogin(page, 'u-beto');
    const datos = await page.request
      .get(`/api/modules/casos-este?${url?.split('?')[1] ?? ''}`)
      .then((r) => r.json());

    // El marcador pedia el Norte; el ambito de Beto no lo permite. No ve los datos de Ana.
    const dataRows = datos.objetos.find((o: { result?: unknown }) => o.result)?.result.rows ?? [];
    expect(dataRows).toHaveLength(0);
  });
});

test.describe('la politica de contenido no rompe la pagina', () => {
  /*
   * Una CSP mal puesta no da error: deja la pagina en blanco. El navegador bloquea los scripts,
   * React no hidrata y lo que queda es el HTML sin comportamiento. Por eso lo que se comprueba
   * aqui no es la cabecera —eso ya lo hace una prueba unitaria— sino que la aplicacion SIGUE
   * VIVA con ella puesta: que hay consola limpia, que el JavaScript corrio y que un gesto que
   * depende de el funciona.
   */
  test('la cabecera va, los scripts se ejecutan y no hay nada bloqueado', async ({
    page,
    origen,
  }) => {
    const bloqueados: string[] = [];
    page.on('console', (m) => {
      const t = m.text();
      if (/Content Security Policy|refused to|blocked/i.test(t)) bloqueados.push(t);
    });

    const respuesta = await page.goto('/m/casos-pendientes');
    const csp = respuesta?.headers()['content-security-policy'] ?? '';
    expect(csp, 'no llego la cabecera').toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("frame-ancestors 'none'");

    // Si React no hidrato, esto es `undefined` y el resto de la suite fallaria en cascada.
    await expect(page.getByTestId('slicer-Penal')).toBeVisible();
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/Materia=Penal/);

    expect(bloqueados, `la CSP bloqueo algo:\n${bloqueados.join('\n')}`).toEqual([]);
    expect(origen).toContain('http://localhost:');
  });

  test('la vista incrustable conserva su propia politica de enmarcado', async ({ page }) => {
    const respuesta = await page.goto('/embed/m/casos-pendientes');
    const csp = respuesta?.headers()['content-security-policy'] ?? '';
    // Sin origenes configurados se deniega, que es el valor por defecto y lo correcto.
    expect(csp).toContain('frame-ancestors');
    expect(csp).toContain("default-src 'self'");
  });
});

test.describe('principio 1: el navegador solo habla con esta aplicacion', () => {
  test('ninguna peticion sale fuera del origen de la aplicacion', async ({ page, origen }) => {
    const externas: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.origin !== origen) externas.push(req.url());
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
    await asLogin(page, 'u-admin');

    // La norma de marca pide el nombre de la institucion en cada pagina. Se comprueba en las
    // tres superficies distintas —modulo, panel de administracion y avisos— porque cada una
    // tiene su propia disposicion y es donde se perderia si alguien anadiera una cuarta.
    for (const path of ['/m/casos-pendientes', '/admin', '/notices']) {
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
  test('dos objetos que declaran el mismo alto miden exactamente lo mismo', async ({ page }) => {
    /*
     * Se agrupa por fila Y POR ALTO DECLARADO, no solo por fila.
     *
     * Agrupando solo por fila, la prueba decia «todo lo que empieza en la misma fila mide igual»,
     * que no es la regla: una rejilla existe precisamente para que un panel de cuatro filas
     * conviva con una tarjeta de dos. Lo que se comprueba es lo que si es regla — que el alto sale
     * de lo declarado y no del contenido—, y para eso hay que comparar lo comparable.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
    await expect(page.locator('.grid__cell').first()).toBeVisible();

    const celdas = await page.locator('.grid__cell').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          alto: Math.round(r.height),
          /*
           * `gridRowStart`, no `gridRowEnd`.
           *
           * La celda declara su alto con `grid-row: span N`, y ese atajo deja el `span` en el
           * INICIO y el final en `auto`. Leyendo el final, todas las celdas dicen lo mismo y el
           * agrupado vuelve a ser por fila a secas.
           */
          filas: getComputedStyle(el).gridRowStart,
        };
      }),
    );
    expect(celdas.length).toBeGreaterThan(3);

    const porGrupo = new Map<string, number[]>();
    for (const c of celdas) {
      const clave = `${c.top}|${c.filas}`;
      porGrupo.set(clave, [...(porGrupo.get(clave) ?? []), c.alto]);
    }

    // Al menos un grupo con varios objetos, o la prueba no comprueba nada.
    expect([...porGrupo.values()].some((altos) => altos.length > 1)).toBe(true);
    for (const altos of porGrupo.values()) expect(new Set(altos).size).toBe(1);
  });

  test('el alto es multiplo exacto de las filas declaradas, no del contenido', async ({ page }) => {
    await asLogin(page, 'u-admin');
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
    await asLogin(page, 'u-admin');
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

test.describe('dentro de una tarjeta, nada se dibuja encima de nada', () => {
  /*
   * Con un ancho FIJO, y no el que traiga el proyecto.
   *
   * El solape solo aparece cuando el titulo y el subtitulo ocupan dos lineas cada uno, que es lo
   * que pasa a esta anchura: la cabecera se come el alto y al cuerpo le queda menos de lo que su
   * contenido mide. Con una ventana mas ancha, el titulo cabe en una linea, sobra sitio y la
   * prueba pasaria con el fallo puesto — verde por la razon equivocada.
   */
  test.use({ viewport: { width: 1280, height: 900 } });

  test('la cifra y su comparacion no se superponen en una tarjeta baja', async ({ page }) => {
    /*
     * El cuerpo de una tarjeta es una columna FLEXIBLE, para que un grafico llene el alto que le
     * toque. Un bloque de texto no puede tratarse igual: comprimido a cuatro pixeles, su cifra
     * —que mide cuarenta y cuatro— se dibujaba encima de lo que viniera detras, y en una tarjeta
     * baja con comparacion el delta quedaba escrito sobre el valor.
     *
     * Se mide en pixeles y sobre HERMANOS del mismo cuerpo: comparar cajas de tarjetas distintas
     * habria dado verde con el fallo puesto.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    /*
     * Se comparan los TEXTOS, no las cajas que los contienen.
     *
     * El bloque de la cifra se encogia a cuatro pixeles y su `<p>` —de cuarenta y cuatro— se
     * salia por abajo: las cajas hermanas no se tocaban y aun asi el delta quedaba escrito encima
     * del valor. Mirando solo a los hermanos directos, esta prueba habria dado verde con el fallo
     * delante.
     */
    const solapes = await page.evaluate(`(() => {
      const malos = [];
      for (const tarjeta of Array.from(document.querySelectorAll('.objeto'))) {
        const textos = Array.from(tarjeta.querySelectorAll('.object__body p, .object__body span'))
          .filter((el) => el.children.length === 0 && (el.textContent || '').trim() !== '')
          .map((el) => ({ rotulo: el.textContent.trim().slice(0, 20), r: el.getBoundingClientRect() }))
          .filter((t) => t.r.width > 0 && t.r.height > 0);

        for (let i = 0; i < textos.length; i += 1) {
          for (let j = i + 1; j < textos.length; j += 1) {
            const a = textos[i].r;
            const b = textos[j].r;
            const seCruzan =
              a.left < b.right - 1 && b.left < a.right - 1 &&
              a.top < b.bottom - 1 && b.top < a.bottom - 1;
            if (seCruzan) malos.push(textos[i].rotulo + ' / ' + textos[j].rotulo);
          }
        }
      }
      return malos;
    })()`);

    expect(solapes).toEqual([]);
  });
});


test.describe('el navegador de MODULOS se colapsa desde el propio panel', () => {
  test('el control al pie lo pliega a un carril, y lo devuelve', async ({ page }) => {
    /*
     * El sandwich de la cabecera existia desde el principio; lo que faltaba era poder plegarlo
     * desde donde se esta mirando. Y plegado se queda en un CARRIL, no en la nada: desaparecer
     * del todo deja sin forma de volver desde el propio panel y borra la pista de que hay un
     * arbol de modulos detras.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const lateral = page.locator('#navegacion-lateral');
    const ancho = async () => (await lateral.boundingBox())?.width ?? 0;
    const desplegado = await ancho();
    expect(desplegado).toBeGreaterThan(100);

    await page.getByTestId('lateral-plegar').click();
    await expect.poll(ancho).toBeLessThan(desplegado);
    // Sigue ahi, y con el su boton: es lo que garantiza el camino de vuelta.
    await expect(lateral).toBeVisible();
    await expect(page.getByTestId('lateral-plegar')).toBeVisible();

    await page.getByTestId('lateral-plegar').click();
    await expect.poll(ancho).toBe(desplegado);
  });

  test('el sandwich de la cabecera y el boton del pie son EL MISMO estado', async ({ page }) => {
    // Con el estado dentro de cada componente, plegar desde abajo dejaba al sandwich diciendo
    // `aria-expanded="true"` sobre un panel colapsado — y eso es lo que un lector de pantalla lee.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const sandwich = page.getByTestId('open-navigation');
    await expect(sandwich).toHaveAttribute('aria-expanded', 'true');

    await page.getByTestId('lateral-plegar').click();
    await expect(sandwich).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('lateral-plegar')).toHaveAttribute('aria-expanded', 'false');

    // Y al reves: se despliega desde la cabecera y el de abajo se entera.
    await sandwich.click();
    await expect(page.getByTestId('lateral-plegar')).toHaveAttribute('aria-expanded', 'true');
  });

  test('superpuesto, pero sin tapar nada: ni desplegado ni en carril', async ({ page }) => {
    /*
     * «Superpuesto» quiere decir que no pide columna, no que tape.
     *
     * Reservando solo el carril con el panel desplegado, los 224 px de diferencia caian sobre el
     * modulo: el segmentador, el navegador de paginas y los marcadores quedaban debajo del arbol
     * y dejaban de poder pulsarse. No es que se vieran mal — es que no respondian.
     */
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    const lateral = page.locator('#navegacion-lateral');
    const principal = page.locator('.principal');
    const titulo = page.locator('.principal h1, .principal h2').first();

    // Se superpone: se dibuja DENTRO de la caja del contenido, cosa imposible si pidiera columna.
    const abierto = await lateral.boundingBox();
    const contenido = await principal.boundingBox();
    expect((abierto?.x ?? 0) + (abierto?.width ?? 0)).toBeGreaterThan(contenido?.x ?? 0);

    // Y aun asi no tapa: el modulo empieza pasado el panel.
    const conPanel = await titulo.boundingBox();
    expect(conPanel?.x ?? 0).toBeGreaterThanOrEqual((abierto?.x ?? 0) + (abierto?.width ?? 0));

    // La prueba de fuego: lo que hay en esa franja se puede PULSAR.
    await expect(page.getByTestId('slicer-Penal')).toBeVisible();
    await page.getByTestId('slicer-Penal').click({ timeout: 10_000 });
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);

    // Plegado, el modulo empieza pasado el carril: la version colapsada tampoco se superpone.
    await page.getByTestId('lateral-plegar').click();
    const carril = await lateral.boundingBox();
    await expect
      .poll(async () => (await titulo.boundingBox())?.x ?? 0)
      .toBeGreaterThanOrEqual((carril?.x ?? 0) + (carril?.width ?? 0));
  });
});
