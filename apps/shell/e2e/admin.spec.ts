import { expect, test } from './instance';
import { alDia, asLogin, newModule } from './session';

/** Panel de administracion — verificacion en navegador (4.10.8). */

test.describe('acceso al panel: ocultar no es proteger (criterio de la seccion 9)', () => {
  test('un Visor no ve el enlace y la API le responde 403', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('link-admin')).toHaveCount(0);

    // Lo que importa no es el enlace ausente, sino que llamar a la API a mano no sirva.
    for (const path of ['/api/admin/tree', '/api/admin/teams', '/api/admin/audit']) {
      expect((await page.request.get(path)).status()).toBe(403);
    }
  });

  test('un Colaborador tampoco: crear borradores no es administrar', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/');
    await expect(page.getByTestId('link-admin')).toHaveCount(0);
    expect((await page.request.get('/api/admin/tree')).status()).toBe(403);
  });

  test('una escritura de administracion tambien se rechaza, no solo la lectura', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const respuesta = await page.request.post('/api/admin/tree', {
      data: { type: 'renombrar', nodeId: 'nodo-norte', name: 'Intento no autorizado' },
    });
    expect(respuesta.status()).toBe(403);
  });

  test('un Visor que pide la pagina no ve contenido del panel', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/admin');
    await expect(page.getByTestId('without-permission')).toBeVisible();
    await expect(page.getByTestId('admin-nav-modules')).toHaveCount(0);
  });

  test('un Administrador si entra', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/');
    // El enlace vive en el menu de la cuenta: existe siempre, se ve al desplegarlo.
    await page.getByTestId('account-trigger').click();
    await expect(page.getByTestId('link-admin')).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-modules')).toBeVisible();
  });
});

test.describe('editor de ambitos: la puerta de ampliacion (4.10.4)', () => {
  test.beforeEach(async ({ page }) => {
    await asLogin(page, 'u-admin');
  });

  test('AMPLIAR sin justificacion se rechaza y dice que dimension se amplia', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/scopes', {
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
    const respuesta = await page.request.post('/api/admin/scopes', {
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

    await page.goto('/admin/audit?onlyExpansions=1');
    const tabla = page.getByTestId('audit-table');
    await expect(tabla).toContainText('Auditoria laboral trimestral');
    await expect(tabla).toContainText('Ampliacion');
    // Y el contador de ampliaciones vigentes deja de ser cero.
    await expect(page.getByTestId('resumen-ampliaciones')).not.toContainText('0 ampliacion');
  });

  test('NO acepta una dimension que no existe en el esquema real', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/scopes', {
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
    await page.goto('/admin/scopes');
    const picker = page.getByTestId('add-dispersion');
    // Las dimensiones llegan por `fetch` DESPUES del primer pintado. El `select` ya existe antes,
    // con su «Elegir dimension…» dentro, asi que esperar a que sea visible no espera a nada:
    // `allTextContents()` se lleva una foto de una lista que aun no ha llegado. Se espera a la
    // opcion concreta con un matcher que reintenta, que es lo unico que ata la espera al dato.
    await expect(picker.locator('option', { hasText: 'DimTribunal.Distrito' })).toHaveCount(1);

    const opciones = await picker.locator('option').allTextContents();
    expect(opciones.join(' ')).not.toContain('DimInventada');
  });
});

test.describe('editor de arbol (4.1.2)', () => {
  test.beforeEach(async ({ page }) => {
    await asLogin(page, 'u-admin');
  });

  test('avisa de que mover cambia el acceso ANTES de confirmarlo', async ({ page }) => {
    const previo = await page.request.post('/api/admin/tree?previsualizar=1', {
      data: { type: 'mover', nodeId: 'nodo-m-audiencias', newParentId: 'nodo-este' },
    });
    const body = await previo.json();
    expect(body.cambiaElAmbito).toBe(true);
    expect(body.moduleIds).toContain('audiencias');
  });

  test('el arbol se reorganiza SOLO CON TECLADO, sin arrastrar', async ({ page }) => {
    // 4.10.8 pide arrastrar y soltar; 4.9 dice que la accesibilidad no se pospone. Los dos
    // gestos llaman a la misma operacion, asi que basta con comprobar el accesible.
    await page.goto('/admin/modules/tree');
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
        (r) => r.url().endsWith('/api/admin/tree') && r.request().method() === 'POST',
      ),
      page.getByTestId('confirmar-movimiento-si').click(),
    ]);

    // El movimiento queda registrado en la auditoria.
    await page.goto('/admin/audit?onlyMoves=1');
    await expect(page.getByTestId('audit-table')).toContainText('nodo-m-audiencias');
  });

  test('el movimiento cambia el ambito efectivo de inmediato', async ({ page }) => {
    // Tras la prueba anterior, 'audiencias' vive bajo Distrito Este.
    const r = await page.request.get(
      '/api/admin/who-sees-what?userId=u-ana&teamId=equipo-norte&moduleId=audiencias',
    );
    const body = await r.json();
    const origenes = (body.pasos as { source: string }[]).map((p) => p.source);
    expect(origenes).toContain('Distrito Este');
    expect(origenes).not.toContain('Distrito Norte');
  });

  test('la papelera conserva lo eliminado y permite restaurarlo', async ({ page }) => {
    await page.goto('/admin/modules/tree');
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
    await asLogin(page, 'u-admin');
  });

  test('nombra la carpeta de la organizacion general que origino el ambito', async ({ page }) => {
    await page.goto('/admin/who-sees-what');
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
      '/api/admin/who-sees-what?userId=u-ana&teamId=equipo-norte&moduleId=estadisticas',
    );
    const body = await r.json();
    expect(body.treeTheExists).toBe(true);
    expect(body.tieneAcceso).toBe(false);
  });
});

test.describe('paquetes visuales (4.10.6)', () => {
  test('un paquete no puede colar un modulo no concedido, y se señala al Administrador', async ({
    page,
  }) => {
    await asLogin(page, 'u-admin');

    // Un paquete para el equipo Este que incluye un modulo que ese equipo NO tiene concedido.
    await page.request.post('/api/admin/packages', {
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
      .get('/api/admin/teams')
      .then((r) => r.json())
      .then((c) => c.equipos.find((t: { id: string }) => t.id === 'equipo-este'));

    await page.request.post('/api/admin/teams', {
      data: { accion: 'guardar', equipo: { ...esteTeam, assignedPackageId: 'pkg-prueba' } },
    });

    // El panel lo señala explicitamente en vez de ocultarlo sin aviso.
    await page.goto('/admin/modules/packages');
    await expect(page.getByTestId('package-problemas-pkg-prueba')).toBeVisible();
    await expect(page.getByTestId('package-problemas-pkg-prueba')).toContainText('casos-pendientes');

    // Y lo que de verdad importa: al equipo Este NO se le muestra.
    await asLogin(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('nav-casos-pendientes')).toHaveCount(0);
    await expect(page.getByTestId('nav-casos-este')).toBeVisible();
  });
});

test.describe('membresia (4.10.2)', () => {
  test('anadir y quitar a una persona de un equipo cambia lo que ve', async ({ page }) => {
    await asLogin(page, 'u-admin');

    await page.request.post('/api/admin/teams', {
      data: { accion: 'membresia', teamId: 'equipo-este', userId: 'u-nuevo', role: 'visor' },
    });

    const equipos = await page.request.get('/api/admin/teams').then((r) => r.json());
    const este = equipos.equipos.find((t: { id: string }) => t.id === 'equipo-este');
    expect(este.members.some((m: { userId: string }) => m.userId === 'u-nuevo')).toBe(true);

    await page.request.post('/api/admin/teams', {
      data: { accion: 'membresia', teamId: 'equipo-este', userId: 'u-nuevo', role: null },
    });
    const after = await page.request.get('/api/admin/teams').then((r) => r.json());
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
    await asLogin(page, 'u-admin');
  });

  test('retirarse el rol a uno mismo se rechaza con 409', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/teams', {
      data: { accion: 'membresia', teamId: 'equipo-norte', userId: 'u-admin', role: null },
    });

    // 409 y no 403: el permiso lo tiene. Lo que falla es el estado en que quedaria el sistema.
    expect(respuesta.status()).toBe(409);
    expect((await respuesta.json()).error).toContain('u-admin');

    // Y sigue administrando: el panel se abre igual.
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-modules')).toBeVisible();
  });

  test('degradarse a Colaborador tampoco', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/teams', {
      data: { accion: 'membresia', teamId: 'equipo-norte', userId: 'u-admin', role: 'colaborador' },
    });
    expect(respuesta.status()).toBe(409);
  });

  test('reescribir la membresia del equipo entero tampoco, que es el camino discreto', async ({
    page,
  }) => {
    const { equipos } = (await (await page.request.get('/api/admin/teams')).json()) as {
      equipos: { id: string; members: { userId: string; role: string }[] }[];
    };
    const norte = equipos.find((e) => e.id === 'equipo-norte');
    if (!norte) throw new Error('fixture inesperado');

    // Aqui no se menciona la palabra "rol" en ningun sitio: se manda el equipo con una lista de
    // miembros distinta, y el Administrador simplemente no esta en ella.
    const respuesta = await page.request.post('/api/admin/teams', {
      data: {
        accion: 'guardar',
        equipo: { ...norte, members: norte.members.filter((m) => m.userId !== 'u-admin') },
      },
    });

    expect(respuesta.status()).toBe(409);
  });

  test('borrar el equipo donde estaba el ultimo Administrador tampoco', async ({ page }) => {
    const respuesta = await page.request.post('/api/admin/teams', {
      data: { accion: 'borrar', teamId: 'equipo-norte' },
    });
    expect(respuesta.status()).toBe(409);
  });

  test('con otro Administrador nombrado antes, el relevo pasa', async ({ page }) => {
    const membresia = (teamId: string, userId: string, role: string | null) =>
      page.request.post('/api/admin/teams', {
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
      await asLogin(page, 'u-beto');
      await membresia('equipo-norte', 'u-admin', 'administrador');
      await membresia('equipo-este', 'u-beto', 'visor');
    }

    // Y el estado quedo como estaba, comprobado desde la cuenta restituida.
    await asLogin(page, 'u-admin');
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-modules')).toBeVisible();
  });

  test('el panel avisa cuando solo hay un Administrador', async ({ page }) => {
    await page.goto('/admin/teams');
    // El servidor lo impide, pero eso solo avisa cuando ya se esta intentando. Con uno solo, el
    // sistema esta a una baja de necesitar el procedimiento de acceso de emergencia.
    await expect(page.getByTestId('administradores')).toContainText('u-admin');
    await expect(page.getByTestId('administradores')).toContainText('al menos dos');
  });
});

test.describe('el carril de administracion', () => {
  test.beforeEach(async ({ page }) => {
    await asLogin(page, 'u-admin');
  });

  test('las siete superficies estan agrupadas por lo que se hace con ellas', async ({ page }) => {
    await page.goto('/admin');
    // Siete elementos planos superan lo que alguien recorre de un vistazo. Se agrupan por el
    // OBJETO que se administra, que es como se formula la peticion: «los permisos de Ana».
    for (const grupo of ['Contenido', 'Personas', 'Datos', 'Supervision']) {
      await expect(page.getByRole('heading', { name: grupo })).toBeVisible();
    }
    // Y cada grupo ETIQUETA su lista, para que un lector de pantalla anuncie donde empieza.
    const listas = page.locator('.admin__nav ul[aria-labelledby]');
    await expect(listas).toHaveCount(4);
  });

  test('el resumen se marca al entrar, y solo en su ruta exacta', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('admin-nav-admin')).toHaveAttribute('aria-current', 'page');

    await page.goto('/admin/teams');
    // Con la regla de prefijo, /admin reclamaria /admin/teams y habria DOS activas a la vez.
    await expect(page.getByTestId('admin-nav-admin')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('admin-nav-teams')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('la cabecera dice en que seccion se esta, para cuando el carril esta plegado', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page.getByTestId('admin-section-current')).toHaveText('Auditoria');
    // En el resumen no se repite: el titulo ya lo dice.
    await page.goto('/admin');
    await expect(page.getByTestId('admin-section-current')).toHaveCount(0);
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
    /*
     * El cambio se PROVOCA con una escritura, y la comprobacion NO es condicional.
     *
     * Antes decia «se provoca un cambio real» y lo que hacia era `goto('/admin/teams')`: una
     * lectura, que no registra nada. Debajo, la unica asercion vivia dentro de
     * `if (filas.count() > 0)`, asi que con el registro vacio —que era siempre— la prueba no
     * comprobaba absolutamente nada y salia verde igual. Una prueba que pasa sin mirar es peor
     * que no tenerla: ocupa el sitio de la que si miraria.
     */
    const equipo = await page.request
      .get('/api/admin/teams')
      .then((r) => r.json())
      .then((c) => c.equipos.find((t: { id: string }) => t.id === 'equipo-este'));
    const guardado = await page.request.post('/api/admin/teams', {
      data: { accion: 'guardar', equipo },
    });
    expect(guardado.status()).toBe(200);

    await page.goto('/admin/audit');
    // El selector tambien estaba mal, de la forma mas dificil de ver: `.log__row` EXISTE, pero en
    // el resumen de `/admin`, no en la tabla de `/admin/audit`, que es la pagina que se abria.
    // Clase correcta, pagina equivocada, cero filas y ninguna queja.
    const filas = page.getByTestId('audit-table').locator('tbody tr');
    await expect(filas.first()).toBeVisible();

    // «Cuando»: una fecha legible, no el ISO crudo ni un numero de milisegundos.
    await expect(filas.first().locator('td').first()).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    // «Quien»: una persona, no el identificador con el que el gobierno la guarda.
    await expect(filas.first().locator('td').nth(1)).toHaveText('Juan F. Medina C.');
    // «Que» y «Accion» estan, y dicen algo.
    await expect(filas.first().locator('td').nth(2)).toHaveText(/\w/);
    await expect(filas.first().locator('td').nth(3)).toHaveText(/\w/);
  });
});

/**
 * La matriz de permisos de 4.10.1, visible — y dibujada desde el codigo que decide.
 *
 * `MATRIX` estaba escrita, probada y era invisible. Quien administra no tenia forma de ver que
 * puede cada rol, y la unica alternativa habria sido copiar la tabla a mano en el panel.
 */
test.describe('roles y permisos (4.10.1)', () => {
  test.beforeEach(async ({ page }) => {
    await asLogin(page, 'u-admin');
  });

  test('se llega desde Usuarios y la tabla dice si y no con palabras', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByTestId('ir-a-permisos').click();
    await expect(page).toHaveURL(/\/admin\/users\/permissions/);

    const matriz = page.getByTestId('permissions-matrix');
    await expect(matriz).toBeVisible();
    // Una marca «✓» sin texto no la lee un lector de pantalla (4.9): se escribe la palabra.
    await expect(matriz).toContainText('Si');
    await expect(matriz).toContainText('No');
  });

  /*
   * Es LA separacion de 4.10.1, y la razon de que la tabla exista: un Colaborador propone y un
   * Administrador publica. Si alguna vez deja de cumplirse, se ve aqui.
   */
  test('el Colaborador propone y NO publica', async ({ page }) => {
    await page.goto('/admin/users/permissions');

    const proponer = page.getByTestId('cap-proponer-objetos-al-repositorio');
    const publicar = page.getByTestId('cap-publicar-modulo-institucional');

    // La segunda columna es Colaborador: administrador, colaborador, visor.
    await expect(proponer.locator('td').nth(1)).toHaveAttribute('data-puede', 'si');
    await expect(publicar.locator('td').nth(1)).toHaveAttribute('data-puede', 'no');
    await expect(publicar.locator('td').first()).toHaveAttribute('data-puede', 'si');
  });

  test('un Visor no la ve: es parte del panel', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/admin/users/permissions');
    await expect(page).toHaveURL(/admin-without-permission/);
  });
});

test.describe('que hay dentro de cada modulo, y subirlo de version (4.5)', () => {
  /**
   * Deja un modulo publicado con una tarjeta anclada a 1.0.0 y un ajuste puesto a mano.
   *
   * Se hace por la API y no por el editor porque lo que se comprueba no es colocar: es que subir
   * de version respete lo que alguien configuro. Para eso hace falta partir de una version VIEJA
   * con algo configurado, y el editor solo sabe colocar la ultima.
   */
  const conTarjetaVieja = async (page: import('@playwright/test').Page, slug: string) => {
    const creado = await page.request.post('/api/modules', {
      data: { nombre: `Modulo ${slug}`, slug },
    });
    expect(creado.ok(), await creado.text()).toBe(true);
    const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };

    const guardado = await page.request.put(`/api/modules/${slug}/edit`, {
      data: {
        paginas: [
          {
            ...modulo.pages[0],
            slug: 'general',
            name: 'General',
            items: [
              {
                id: 'kpi',
                position: { x: 0, y: 0, w: 3, h: 2 },
                instance: {
                  instanceId: 'kpi',
                  objectId: 'tarjeta-kpi',
                  // 1.0.0 existe y NO es la ultima: es la unica forma de que la fila salga
                  // atrasada y ofrezca el boton.
                  version: '1.0.0',
                  title: 'Pendientes',
                  binding: {
                    datasetId: 'casos-por-distrito-trimestre',
                    dimensions: [],
                    measures: ['CasosPendientes'],
                  },
                  // `formato` lo admiten 1.0.0 y la ultima: es lo que tiene que sobrevivir.
                  presentacion: { formato: 'entero' },
                },
              },
            ],
          },
        ],
      },
    });
    expect(guardado.ok(), await guardado.text()).toBe(true);
  };

  test('la columna Objetos despliega cada objeto con su version', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const slug = `objetos-${Date.now()}`;
    await conTarjetaVieja(page, slug);

    await page.goto('/admin/modules');
    const desplegable = page.getByTestId(`objetos-${slug}`);
    await expect(desplegable).toBeVisible();
    // Plegado dice cuantos hay y cuantos estan atrasados: es lo que se lee sin abrir nada.
    await expect(page.getByTestId(`objetos-atrasados-${slug}`)).toBeVisible();

    await desplegable.click();
    await expect(page.getByTestId(`objeto-${slug}-tarjeta-kpi-1.0.0`)).toBeVisible();
  });

  test('subir a la ultima CONSERVA lo configurado, y lo dice', async ({ page }) => {
    /*
     * El punto entero de subir de version.
     *
     * Una clave que la version nueva sigue admitiendo tiene que llegar intacta; solo lo que la
     * version nueva anade cae a su valor por defecto. Si `formato` se perdiera, subir de version
     * seria rehacer la configuracion de cada objeto a mano, y nadie subiria nunca.
     */
    await asLogin(page, 'u-admin');
    const slug = `subir-${Date.now()}`;
    await conTarjetaVieja(page, slug);

    await page.goto('/admin/modules');
    await page.getByTestId(`objetos-${slug}`).click();
    await page.getByTestId(`bump-${slug}-tarjeta-kpi`).click();
    await page.getByTestId(`bump-confirm-${slug}-tarjeta-kpi`).click();

    const hecho = page.getByTestId(`bump-hecho-${slug}-tarjeta-kpi`);
    await expect(hecho).toBeVisible();
    // Y dice QUE conservo: sin eso, «hecho» es una promesa sin comprobante.
    await expect(hecho).toContainText('formato');

    // Lo que manda es el almacen, no el mensaje.
    const { modulo } = (await (await page.request.get(`/api/modules/${slug}/edit`)).json()) as {
      modulo: { pages: { items: { instance: { version: string; presentacion?: Record<string, unknown> } }[] }[] };
    };
    const instancia = modulo.pages[0]?.items[0]?.instance;
    expect(instancia?.version).not.toBe('1.0.0');
    expect(instancia?.presentacion?.['formato']).toBe('entero');
  });
});

test.describe('los recursos que no son objetos (4.5)', () => {
  test('los iconos salen en tabla, con quien los usa y su estado', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/resources/other');

    await expect(page.getByTestId('tabla-iconos')).toBeVisible();
    await expect(page.getByTestId('asset-balanza')).toBeVisible();
    // El cromo se distingue de lo que el editor ofrece: sobre el no hay interruptor que apagar.
    await expect(page.getByTestId('asset-sandwich-estado')).toHaveText(/Cromo/);
    await expect(page.getByTestId('deshabilitar-icono:sandwich')).toHaveCount(0);
    await expect(page.getByTestId('deshabilitar-icono:balanza')).toBeVisible();
  });

  test('deshabilitar un icono lo RETIRA del desplegable del editor', async ({ page }) => {
    /*
     * El interruptor tiene que apagar algo.
     *
     * `disabledResources` llevaba escrito desde el principio, la tabla lo dibujaba y el boton lo
     * escribia — y la paleta del editor no lo consultaba, asi que deshabilitar cambiaba una
     * insignia del panel y nada mas. Esta prueba es la que cruza las dos pantallas.
     */
    await asLogin(page, 'u-admin');
    const slug = `icono-${Date.now()}`;
    await newModule(page, slug);
    await page.getByTestId('add-tarjeta-kpi').click();
    await alDia(page);

    const bloque = page.locator('[data-testid^="block-obj-"]').first();
    const id = ((await bloque.getAttribute('data-testid')) ?? '').replace('block-', '');
    await page.getByTestId(`select-${id}`).click();
    await page.getByTestId('tab-formato').click();
    await expect(page.getByTestId(`pres-${id}-icono`).locator('option[value="balanza"]')).toHaveCount(1);

    await page.goto('/admin/resources/other');
    await page.getByTestId('deshabilitar-icono:balanza').click();
    await expect(page.getByTestId('asset-balanza-estado')).toHaveText(/Deshabilitar/i);

    await page.goto(`/editor/${slug}`);
    await page.getByTestId(`select-${id}`).click();
    await page.getByTestId('tab-formato').click();
    await expect(page.getByTestId(`pres-${id}-icono`).locator('option[value="balanza"]')).toHaveCount(0);

    // Se deja como estaba: el almacen sobrevive entre pruebas del mismo archivo.
    await page.goto('/admin/resources/other');
    await page.getByTestId('deshabilitar-icono:balanza').click();
    await expect(page.getByTestId('asset-balanza-estado')).not.toHaveText(/Deshabilitar/i);
  });
});
