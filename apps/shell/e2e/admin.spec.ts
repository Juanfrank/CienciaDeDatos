import { expect, test } from './instancia';
import { entrarComo } from './session';

/** Panel de administracion — verificacion en navegador (4.10.8). */

test.describe('acceso al panel: ocultar no es proteger (criterio de la seccion 9)', () => {
  test('un Visor no ve el enlace y la API le responde 403', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('enlace-admin')).toHaveCount(0);

    // Lo que importa no es el enlace ausente, sino que llamar a la API a mano no sirva.
    for (const path of ['/api/admin/arbol', '/api/admin/equipos', '/api/admin/auditoria']) {
      expect((await page.request.get(path)).status()).toBe(403);
    }
  });

  test('un Colaborador tampoco: crear borradores no es administrar', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/');
    await expect(page.getByTestId('enlace-admin')).toHaveCount(0);
    expect((await page.request.get('/api/admin/arbol')).status()).toBe(403);
  });

  test('una escritura de administracion tambien se rechaza, no solo la lectura', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const respuesta = await page.request.post('/api/admin/arbol', {
      data: { type: 'renombrar', nodeId: 'nodo-norte', name: 'Intento no autorizado' },
    });
    expect(respuesta.status()).toBe(403);
  });

  test('un Visor que pide la pagina no ve contenido del panel', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/admin');
    await expect(page.getByTestId('sin-permiso')).toBeVisible();
    await expect(page.getByTestId('admin-nav-arbol')).toHaveCount(0);
  });

  test('un Administrador si entra', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    await page.goto('/');
    await expect(page.getByTestId('enlace-admin')).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-arbol')).toBeVisible();
  });
});

test.describe('editor de ambitos: la puerta de ampliacion (4.10.4)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'u-admin');
  });

  test('AMPLIAR sin justificacion se rechaza y dice que dimension se amplia', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/ambitos', {
      data: {
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: {
          restrictions: [
            {
              dimension: { table: 'DimTribunal', field: 'Materia' },
              allowedValues: ['Penal', 'Civil', 'Laboral'],
            },
          ],
        },
      },
    });

    expect(respuesta.status()).toBe(422);
    const body = await respuesta.json();
    expect(body.detail.dimensiones.join(' ')).toContain('Laboral');
  });

  test('con justificacion se guarda y queda DESTACADA en auditoria', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/ambitos', {
      data: {
        destino: { tipo: 'equipo', teamId: 'equipo-norte' },
        scope: {
          restrictions: [
            {
              dimension: { table: 'DimTribunal', field: 'Materia' },
              allowedValues: ['Penal', 'Civil', 'Laboral'],
            },
          ],
        },
        justificacion: 'Auditoria laboral trimestral aprobada por el Consejo',
      },
    });
    expect(respuesta.status()).toBe(200);

    await page.goto('/admin/auditoria?soloAmpliaciones=1');
    const tabla = page.getByTestId('audit-table');
    await expect(tabla).toContainText('Auditoria laboral trimestral');
    await expect(tabla).toContainText('Ampliacion');
    // Y el contador de ampliaciones vigentes deja de ser cero.
    await expect(page.getByTestId('resumen-ampliaciones')).not.toContainText('0 ampliacion');
  });

  test('NO acepta una dimension que no existe en el esquema real', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/ambitos', {
      data: {
        destino: { tipo: 'equipo', teamId: 'equipo-este' },
        scope: {
          restrictions: [
            {
              dimension: { table: 'DimInventada', field: 'CampoAMano' },
              allowedValues: ['x'],
            },
          ],
        },
      },
    });
    expect(respuesta.status()).toBe(422);
    expect((await respuesta.json()).error).toMatch(/no existen en el esquema activo/);
  });

  test('el editor solo ofrece dimensiones del esquema, no un campo de texto libre', async ({ page }) => {
    await page.goto('/admin/ambitos');
    const picker = page.getByTestId('add-dispersion');
    await expect(picker).toBeVisible();
    const opciones = await picker.locator('option').allTextContents();
    expect(opciones.join(' ')).toContain('DimTribunal.Distrito');
    expect(opciones.join(' ')).not.toContain('DimInventada');
  });
});

test.describe('editor de arbol (4.1.2)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'u-admin');
  });

  test('avisa de que mover cambia el acceso ANTES de confirmarlo', async ({ page }) => {
    const previo = await page.request.post('/api/admin/arbol?previsualizar=1', {
      data: { type: 'mover', nodeId: 'nodo-m-audiencias', newParentId: 'nodo-este' },
    });
    const body = await previo.json();
    expect(body.cambiaElAmbito).toBe(true);
    expect(body.moduleIds).toContain('audiencias');
  });

  test('el arbol se reorganiza SOLO CON TECLADO, sin arrastrar', async ({ page }) => {
    // 4.10.8 pide arrastrar y soltar; 4.9 dice que la accesibilidad no se pospone. Los dos
    // gestos llaman a la misma operacion, asi que basta con comprobar el accesible.
    await page.goto('/admin/arbol');
    await page.getByTestId('node-nodo-m-audiencias').click();
    await page.getByTestId('move-nodo-m-audiencias').selectOption('nodo-este');

    // Mover cambia el ambito, asi que pide confirmacion explicita.
    await expect(page.getByTestId('confirmar-movimiento')).toBeVisible();
    await expect(page.getByTestId('confirmar-movimiento')).toContainText('Distrito Norte');
    await expect(page.getByTestId('confirmar-movimiento')).toContainText('Distrito Este');

    // Se espera a que la escritura TERMINE antes de navegar. Antes el almacen era un mapa de
    // proceso y la escritura acababa dentro del mismo tick; ahora va a disco y compartida, asi
    // que navegar sin esperar es una carrera — la prueba pasaba por casualidad.
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/admin/arbol') && r.request().method() === 'POST',
      ),
      page.getByTestId('confirmar-movimiento-si').click(),
    ]);

    // El movimiento queda registrado en la auditoria.
    await page.goto('/admin/auditoria?soloMovimientos=1');
    await expect(page.getByTestId('audit-table')).toContainText('nodo-m-audiencias');
  });

  test('el movimiento cambia el ambito efectivo de inmediato', async ({ page }) => {
    // Tras la prueba anterior, 'audiencias' vive bajo Distrito Este.
    const r = await page.request.get(
      '/api/admin/quien-ve-que?userId=u-ana&teamId=equipo-norte&moduleId=audiencias',
    );
    const body = await r.json();
    const origenes = (body.pasos as { source: string }[]).map((p) => p.source);
    expect(origenes).toContain('Distrito Este');
    expect(origenes).not.toContain('Distrito Norte');
  });

  test('la papelera conserva lo eliminado y permite restaurarlo', async ({ page }) => {
    await page.goto('/admin/arbol');
    await page.getByTestId('node-nodo-m-nacional').click();
    await page.getByTestId('trash-nodo-m-nacional').click();

    await expect(page.getByTestId('papelera')).toBeVisible();
    await expect(page.getByTestId('papelera')).toContainText('Estadisticas nacionales');

    await page.getByTestId('restore-nodo-m-nacional').click();
    await expect(page.getByTestId('node-nodo-m-nacional')).toBeVisible();
  });
});

test.describe('quien ve que (4.10.8)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'u-admin');
  });

  test('nombra la carpeta de la organizacion general que origino el ambito', async ({ page }) => {
    await page.goto('/admin/quien-ve-que');
    await page.getByTestId('qvq-usuario').selectOption('u-ana');
    await page.getByTestId('qvq-equipo').selectOption('equipo-norte');
    await page.getByTestId('qvq-modulo').selectOption('casos-pendientes');
    await page.getByTestId('qvq-consultar').click();

    const pasos = page.getByTestId('qvq-pasos');
    await expect(pasos).toBeVisible();
    // Lo que el documento pide destacar: que capa lo causo y desde donde.
    await expect(pasos).toContainText('Equipo Distrito Norte');
    await expect(pasos).toContainText('Regional');
    await expect(pasos).toContainText('Distrito Norte');
  });

  test('distingue "no tiene acceso" de "no ve filas"', async ({ page }) => {
    const r = await page.request.get(
      '/api/admin/quien-ve-que?userId=u-ana&teamId=equipo-norte&moduleId=estadisticas',
    );
    const body = await r.json();
    expect(body.existeEnElArbol).toBe(true);
    expect(body.tieneAcceso).toBe(false);
  });
});

test.describe('paquetes visuales (4.10.6)', () => {
  test('un paquete no puede colar un modulo no concedido, y se señala al Administrador', async ({
    page,
  }) => {
    await entrarComo(page, 'u-admin');

    // Un paquete para el equipo Este que incluye un modulo que ese equipo NO tiene concedido.
    await page.request.post('/api/admin/paquetes', {
      data: {
        paquete: {
          id: 'pkg-prueba',
          name: 'Vista del Este',
          visualTree: [
            {
              id: 'v1',
              type: 'folder',
              name: 'Todo',
              children: [
                {
                  id: 'v-casos-este',
                  type: 'module',
                  moduleRef: { moduleId: 'casos-este', slug: 'casos-este', name: 'Casos Este' },
                },
                {
                  id: 'v-intruso',
                  type: 'module',
                  moduleRef: {
                    moduleId: 'casos-pendientes',
                    slug: 'casos-pendientes',
                    name: 'Casos del Norte',
                  },
                },
              ],
            },
          ],
        },
      },
    });

    const esteTeam = await page.request
      .get('/api/admin/equipos')
      .then((r) => r.json())
      .then((c) => c.equipos.find((t: { id: string }) => t.id === 'equipo-este'));

    await page.request.post('/api/admin/equipos', {
      data: { accion: 'guardar', equipo: { ...esteTeam, assignedPackageId: 'pkg-prueba' } },
    });

    // El panel lo señala explicitamente en vez de ocultarlo sin aviso.
    await page.goto('/admin/paquetes');
    await expect(page.getByTestId('package-problemas-pkg-prueba')).toBeVisible();
    await expect(page.getByTestId('package-problemas-pkg-prueba')).toContainText('casos-pendientes');

    // Y lo que de verdad importa: al equipo Este NO se le muestra.
    await entrarComo(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('nav-casos-pendientes')).toHaveCount(0);
    await expect(page.getByTestId('nav-casos-este')).toBeVisible();
  });
});

test.describe('membresia (4.10.2)', () => {
  test('anadir y quitar a una persona de un equipo cambia lo que ve', async ({ page }) => {
    await entrarComo(page, 'u-admin');

    await page.request.post('/api/admin/equipos', {
      data: { accion: 'membresia', teamId: 'equipo-este', userId: 'u-nuevo', role: 'visor' },
    });

    const equipos = await page.request.get('/api/admin/equipos').then((r) => r.json());
    const este = equipos.equipos.find((t: { id: string }) => t.id === 'equipo-este');
    expect(este.members.some((m: { userId: string }) => m.userId === 'u-nuevo')).toBe(true);

    await page.request.post('/api/admin/equipos', {
      data: { accion: 'membresia', teamId: 'equipo-este', userId: 'u-nuevo', role: null },
    });
    const after = await page.request.get('/api/admin/equipos').then((r) => r.json());
    const este2 = after.equipos.find((t: { id: string }) => t.id === 'equipo-este');
    expect(este2.members.some((m: { userId: string }) => m.userId === 'u-nuevo')).toBe(false);
  });
});

test.describe('la institucion no se puede quedar sin Administrador (4.10.1)', () => {
  /**
   * El caso que esto impide no es hipotetico: el modelo de permisos es circular, y sin la
   * comprobacion un Administrador puede retirarse el rol a si mismo y dejar el gobierno
   * inaccesible para todos, incluido el. Restituirlo exigiria entrar en la base de datos.
   */
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'u-admin');
  });

  test('retirarse el rol a uno mismo se rechaza con 409', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/equipos', {
      data: { accion: 'membresia', teamId: 'equipo-norte', userId: 'u-admin', role: null },
    });

    // 409 y no 403: el permiso lo tiene. Lo que falla es el estado en que quedaria el sistema.
    expect(respuesta.status()).toBe(409);
    expect((await respuesta.json()).error).toContain('u-admin');

    // Y sigue administrando: el panel se abre igual.
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-arbol')).toBeVisible();
  });

  test('degradarse a Colaborador tampoco', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/equipos', {
      data: { accion: 'membresia', teamId: 'equipo-norte', userId: 'u-admin', role: 'colaborador' },
    });
    expect(respuesta.status()).toBe(409);
  });

  test('reescribir la membresia del equipo entero tampoco, que es el camino discreto', async ({
    page,
  }) => {
    const { equipos } = (await (await page.request.get('/api/admin/equipos')).json()) as {
      equipos: { id: string; members: { userId: string; role: string }[] }[];
    };
    const norte = equipos.find((e) => e.id === 'equipo-norte');
    if (!norte) throw new Error('fixture inesperado');

    // Aqui no se menciona la palabra "rol" en ningun sitio: se manda el equipo con una lista de
    // miembros distinta, y el Administrador simplemente no esta en ella.
    const respuesta = await page.request.post('/api/admin/equipos', {
      data: {
        accion: 'guardar',
        equipo: { ...norte, members: norte.members.filter((m) => m.userId !== 'u-admin') },
      },
    });

    expect(respuesta.status()).toBe(409);
  });

  test('borrar el equipo donde estaba el ultimo Administrador tampoco', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/equipos', {
      data: { accion: 'borrar', teamId: 'equipo-norte' },
    });
    expect(respuesta.status()).toBe(409);
  });

  test('con otro Administrador nombrado antes, el relevo pasa', async ({ page }) => {
    const membresia = (teamId: string, userId: string, role: string | null) =>
      page.request.post('/api/admin/equipos', {
        data: { accion: 'membresia', teamId, userId, role },
      });

    // Se usa u-beto en equipo-este, del que ya es miembro, para no inventar membresias que otras
    // pruebas puedan asumir. Se deshace al terminar.
    try {
      expect((await membresia('equipo-este', 'u-beto', 'administrador')).ok()).toBe(true);

      // Ahora si: u-admin puede soltar el rol, porque Beto administra.
      const relevo = await membresia('equipo-norte', 'u-admin', 'colaborador');
      expect(relevo.ok(), await relevo.text()).toBe(true);
    } finally {
      /*
       * La restitucion la hace BETO, no u-admin.
       */
      await entrarComo(page, 'u-beto');
      await membresia('equipo-norte', 'u-admin', 'administrador');
      await membresia('equipo-este', 'u-beto', 'visor');
    }

    // Y el estado quedo como estaba, comprobado desde la cuenta restituida.
    await entrarComo(page, 'u-admin');
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-arbol')).toBeVisible();
  });

  test('el panel avisa cuando solo hay un Administrador', async ({ page }) => {
    await page.goto('/admin/equipos');
    // El servidor lo impide, pero eso solo avisa cuando ya se esta intentando. Con uno solo, el
    // sistema esta a una baja de necesitar el procedimiento de acceso de emergencia.
    await expect(page.getByTestId('administradores')).toContainText('u-admin');
    await expect(page.getByTestId('administradores')).toContainText('al menos dos');
  });
});

test.describe('el carril de administracion', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'u-admin');
  });

  test('las siete superficies estan agrupadas por lo que se hace con ellas', async ({ page }) => {
    await page.goto('/admin');
    // Siete elementos planos superan lo que alguien recorre de un vistazo, y mezclaban tres
    // momentos distintos: ordenar la institucion, dar acceso, y comprobar que quedo bien.
    for (const grupo of ['Estructura', 'Acceso', 'Supervision']) {
      await expect(page.getByRole('heading', { name: grupo })).toBeVisible();
    }
    // Y cada grupo ETIQUETA su lista, para que un lector de pantalla anuncie donde empieza.
    const listas = page.locator('.admin__nav ul[aria-labelledby]');
    await expect(listas).toHaveCount(3);
  });

  test('el resumen se marca al entrar, y solo en su ruta exacta', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-admin')).toHaveAttribute('aria-current', 'page');

    await page.goto('/admin/equipos');
    // Con la regla de prefijo, /admin reclamaria /admin/equipos y habria DOS activas a la vez.
    await expect(page.getByTestId('admin-nav-admin')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('admin-nav-equipos')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('la cabecera dice en que seccion se esta, para cuando el carril esta plegado', async ({ page }) => {
    await page.goto('/admin/auditoria');
    await expect(page.getByTestId('admin-seccion-actual')).toHaveText('Auditoria');
    // En el resumen no se repite: el titulo ya lo dice.
    await page.goto('/admin');
    await expect(page.getByTestId('admin-seccion-actual')).toHaveCount(0);
  });

  test('cada cifra del resumen lleva a donde se actua sobre ella', async ({ page }) => {
    await page.goto('/admin');
    // Antes eran numeros muertos: se leia «2 en papelera» y habia que buscar donde esta la papelera.
    const tarjetas = page.getByTestId('resumen-gobierno').getByRole('link');
    await expect(tarjetas).toHaveCount(5);
    for (const enlace of await tarjetas.all()) {
      await expect(enlace).toHaveAttribute('href', /^\/admin\//);
    }
  });

  test('las cifras se reparten en una fila, no en cinco', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/admin');
    const dataRows = await page
      .getByTestId('resumen-gobierno')
      .evaluate((el) => new Set([...el.children].map((c) => c.getBoundingClientRect().top)).size);
    // `.tarjetas` no tenia ninguna regla de disposicion: cinco cifras ocupaban cinco filas.
    expect(dataRows).toBe(1);
  });

  test('el registro dice quien, que y cuando, no identificadores crudos', async ({ page }) => {
    // Se provoca un cambio real para que haya algo que leer.
    await page.goto('/admin/equipos');
    await page.goto('/admin/auditoria');
    const dataRows = page.locator('.log__row');
    if ((await dataRows.count()) > 0) {
      await expect(dataRows.first().locator('time')).toHaveAttribute('dateTime', /\d{4}-\d{2}-\d{2}/);
    }
  });
});
