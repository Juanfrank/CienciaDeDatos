import { expect, test } from './instance';
import { alDia, asLogin, newModule, objectDraft } from './session';

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
    /*
     * 4.10.8 pide arrastrar y soltar; 4.9 dice que la accesibilidad no se pospone. Los dos gestos
     * llaman a la misma operacion, asi que basta con comprobar el accesible.
     *
     * El movimiento se hace desde la TABLA DE MODULOS: la de organizacion general ensena solo
     * carpetas, y lo que aqui se mueve es un modulo.
     */
    await page.goto('/admin/modules');
    await page.getByTestId('mover-nodo-m-audiencias').click();
    await page.getByTestId('mover-nodo-m-audiencias-a-nodo-este').click();

    // Mover cambia el ambito, asi que pide confirmacion explicita y dice QUE cambia.
    const aviso = page.getByTestId('confirmar-movimiento-nodo-m-audiencias');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Distrito Este');
    await expect(aviso).toContainText('audiencias');

    // Se espera a que la escritura TERMINE antes de navegar. Antes el almacen era un mapa de
    // proceso y la escritura acababa dentro del mismo tick; ahora va a disco y compartida, asi
    // que navegar sin esperar es una carrera — la prueba pasaba por casualidad.
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/admin/tree') && r.request().method() === 'POST',
      ),
      page.getByTestId('confirmar-movimiento-si-nodo-m-audiencias').click(),
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
    /*
     * Con una CARPETA, que es lo que la organizacion general gobierna ahora.
     *
     * Y con `nodo-este`, que esta vacio para cuando llega esta prueba: la anterior se llevo
     * `audiencias` dentro, asi que restaurar tiene que devolver la carpeta con lo que tenia.
     */
    await page.goto('/admin/modules/tree');
    await page.getByTestId('trash-nodo-este').click();

    await expect(page.getByTestId('papelera')).toBeVisible();
    await expect(page.getByTestId('papelera')).toContainText('Distrito Este');
    await expect(page.getByTestId('carpeta-nodo-este')).toHaveCount(0);

    await page.getByTestId('restore-nodo-este').click();
    await expect(page.getByTestId('carpeta-nodo-este')).toBeVisible();
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

test.describe('los equipos, en tabla (4.10.2)', () => {
  test('la tabla dice cuantos miembros tiene cada equipo, sin abrir nada', async ({ page }) => {
    /*
     * Era un acordeon: cada equipo abria la lista entera de nodos del arbol, el desplegable de
     * paquete y un selector de rol por cada persona del directorio. La pregunta que se hace al
     * entrar —cuantos son— obligaba a desplegar equipo por equipo y contar a ojo.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/teams');

    const norte = page.getByTestId('equipo-equipo-norte');
    await expect(norte).toBeVisible();
    // El numero sale de la membresia de verdad, no de un rotulo escrito a mano.
    const { equipos } = (await (await page.request.get('/api/admin/teams')).json()) as {
      equipos: { id: string; members: unknown[] }[];
    };
    const cuantos = equipos.find((e) => e.id === 'equipo-norte')?.members.length ?? -1;
    await expect(page.getByTestId('equipo-equipo-norte-miembros')).toHaveText(String(cuantos));
  });

  test('miembros y permisos son DOS pantallas, y cada una hace lo suyo', async ({ page }) => {
    /*
     * Son dos preguntas distintas —QUIEN esta dentro y QUE alcanza— y juntas obligaban a recorrer
     * el arbol entero para cambiarle el rol a una persona. Se comprueba que cada pantalla escribe
     * de verdad, no solo que se abre.
     */
    await asLogin(page, 'u-admin');
    // Sobre un equipo PROPIO: cambiar la membresia de uno de la semilla mueve el acceso de
    // personas que otras pruebas usan, y el almacen es el mismo para toda la suite.
    const id = `equipo-dos-pantallas-${Date.now()}`;
    const creado = await page.request.post('/api/admin/teams', {
      data: { accion: 'guardar', equipo: { id, name: 'Dos pantallas', grantedNodes: [], members: [] } },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto('/admin/teams');
    await page.getByTestId(`miembros-${id}`).click();
    await expect(page.getByTestId('tabla-miembros')).toBeVisible();
    await page.getByTestId(`role-${id}-u-beto`).selectOption('colaborador');
    await expect(page.getByTestId(`role-${id}-u-beto`)).toHaveValue('colaborador');

    await page.goto('/admin/teams');
    await page.getByTestId(`permisos-equipo-${id}`).click();
    await expect(page.getByTestId(`package-${id}`)).toBeVisible();
    // Y la membresia no se toca desde aqui: es la otra pantalla.
    await expect(page.getByTestId('tabla-miembros')).toHaveCount(0);

    // Lo que manda es el almacen, no la pantalla.
    const { equipos } = (await (await page.request.get('/api/admin/teams')).json()) as {
      equipos: { id: string; members: { userId: string; role: string }[] }[];
    };
    const equipo = equipos.find((e) => e.id === id);
    expect(equipo?.members.find((m) => m.userId === 'u-beto')?.role).toBe('colaborador');

    await page.request.post('/api/admin/teams', { data: { accion: 'borrar', teamId: id } });
  });

  test('eliminar un equipo PREGUNTA, y dice a cuantos deja sin acceso', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const id = `equipo-prueba-${Date.now()}`;
    const creado = await page.request.post('/api/admin/teams', {
      data: {
        accion: 'guardar',
        equipo: { id, name: 'Equipo de prueba', grantedNodes: [], members: [] },
      },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto('/admin/teams');
    await page.getByTestId(`borrar-equipo-${id}`).click();
    // Pregunta antes: quitar un equipo quita el acceso de todos sus miembros a la vez.
    await expect(page.getByTestId(`borrar-equipo-aviso-${id}`)).toBeVisible();
    await page.getByTestId(`borrar-equipo-confirmar-${id}`).click();

    await expect(page.getByTestId(`equipo-${id}`)).toHaveCount(0);
    const { equipos } = (await (await page.request.get('/api/admin/teams')).json()) as {
      equipos: { id: string }[];
    };
    expect(equipos.map((e) => e.id)).not.toContain(id);
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

  /** Lo mismo con DOS objetos atrasados, que es lo que «subir todos» tiene que resolver. */
  const conDosViejas = async (page: import('@playwright/test').Page, slug: string) => {
    const creado = await page.request.post('/api/modules', {
      data: { nombre: `Modulo ${slug}`, slug },
    });
    expect(creado.ok(), await creado.text()).toBe(true);
    const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };

    // Dos objetos DISTINTOS: con dos instancias del mismo, subir una subiria las dos —la subida
    // es por objeto, no por instancia— y el boton de «todos» pasaria la prueba sin recorrer nada.
    const viejo = (id: string, objectId: string, x: number) => ({
      id,
      position: { x, y: 0, w: 3, h: 2 },
      instance: {
        instanceId: id,
        objectId,
        version: '1.0.0',
        title: id,
        binding: {
          datasetId: 'casos-por-distrito-trimestre',
          dimensions: objectId === 'tarjeta-kpi' ? [] : [{ table: 'DimTribunal', field: 'Distrito' }],
          measures: ['CasosPendientes'],
        },
      },
    });

    const guardado = await page.request.put(`/api/modules/${slug}/edit`, {
      data: {
        paginas: [
          {
            ...modulo.pages[0],
            slug: 'general',
            name: 'General',
            items: [viejo('kpi', 'tarjeta-kpi', 0), viejo('barras', 'barras', 3)],
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
    // Un solo gesto: ya no hay pantalla de confirmacion que repita de antemano lo que el informe
    // dice despues y con datos reales.
    await page.getByTestId(`bump-${slug}-tarjeta-kpi`).click();

    /*
     * El informe sale ARRIBA, en un mensaje emergente, no dentro de la celda.
     *
     * Escrito en la celda ensanchaba la columna y descuadraba la tabla entera, y ademas se
     * borraba con el refresco que seguia a subir la version: el objeto dejaba de estar atrasado,
     * el servidor dejaba de dibujar el boton, y con el se iba el unico sitio donde constaba que
     * se conservo. Fuera de la tabla sobrevive al refresco y no la deforma.
     */
    const aviso = page.getByTestId('emergente').first();
    await expect(aviso).toBeVisible();
    // Y dice QUE conservo, con el nombre del objeto delante: sin eso, «hecho» es una promesa sin
    // comprobante, y tres mensajes seguidos no dirian cual fue cual.
    await expect(aviso).toContainText('formato');

    // Lo que manda es el almacen, no el mensaje.
    const { modulo } = (await (await page.request.get(`/api/modules/${slug}/edit`)).json()) as {
      modulo: { pages: { items: { instance: { version: string; presentacion?: Record<string, unknown> } }[] }[] };
    };
    const instancia = modulo.pages[0]?.items[0]?.instance;
    expect(instancia?.version).not.toBe('1.0.0');
    expect(instancia?.presentacion?.['formato']).toBe('entero');
  });

  test('«subir todos» deja UN mensaje por objeto, no uno para todos', async ({ page }) => {
    /*
     * Con ocho objetos atrasados, ocho gestos iguales son la clase de trabajo que se acaba no
     * haciendo: lo que queda entonces es un modulo sirviendo versiones viejas porque subirlas era
     * tedioso, no porque nadie decidiera no subirlas.
     *
     * Y el aviso es UNO POR OBJETO. Un solo «se subieron dos» no dice cual de los dos perdio una
     * clave por el camino, que es justamente lo que hay que mirar despues.
     */
    await asLogin(page, 'u-admin');
    const slug = `subir-todos-${Date.now()}`;
    await conDosViejas(page, slug);

    await page.goto('/admin/modules');
    await page.getByTestId(`objetos-${slug}`).click();
    await page.getByTestId(`bump-todos-${slug}`).click();

    await expect(page.getByTestId('emergente')).toHaveCount(2);

    // Lo que manda es el almacen, no el mensaje: los dos objetos suben, no solo el primero.
    const { modulo } = (await (await page.request.get(`/api/modules/${slug}/edit`)).json()) as {
      modulo: { pages: { items: { instance: { version: string } }[] }[] };
    };
    const versiones = (modulo.pages[0]?.items ?? []).map((i) => i.instance.version);
    expect(versiones).toHaveLength(2);
    expect(versiones.filter((v) => v === '1.0.0')).toEqual([]);
  });
});

test.describe('una caida de red no deja el panel inservible', () => {
  test('el boton vuelve a estar disponible y dice que no hubo conexion', async ({ page }) => {
    /*
     * Dieciseis controles del panel tenian la misma forma: encender la bandera de «en curso»,
     * esperar al servidor, apagarla. `fetch` no devuelve error cuando no hay red: LANZA, y
     * entonces la linea que apaga la bandera no llega a correr. El boton se quedaba
     * deshabilitado para siempre, sin decir nada, y la unica salida era recargar la pagina.
     *
     * Se corta la peticion de verdad con `route.abort`: un 500 es una respuesta y ya tenia
     * camino; lo que no lo tenia es que no hubiera respuesta ninguna.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/resources/other');

    const boton = page.getByTestId('deshabilitar-icono:balanza');
    await expect(boton).toBeEnabled();

    await page.route('**/api/admin/resources', (ruta) => ruta.abort('failed'));
    await boton.click();

    await expect(page.getByTestId('error-icono:balanza')).toContainText('No hay conexion');
    // Y sobre todo: se puede volver a intentar sin recargar la pagina.
    await expect(boton).toBeEnabled();

    // Restablecida la conexion, el mismo boton funciona sin recargar nada.
    await page.unroute('**/api/admin/resources');
    await boton.click();
    await expect(page.getByTestId('asset-balanza-estado')).toHaveText(/Deshabilitar/i);

    /*
     * Y se deja el mundo como se encontro.
     *
     * El proyecto «sequential» comparte almacen entre pruebas: dejar el icono deshabilitado hace
     * fallar a la de mas abajo, que lo necesita disponible para comprobar que deshabilitarlo lo
     * retira del desplegable. Una prueba que rompe a la siguiente no es una prueba, es una
     * bomba de relojeria.
     */
    await boton.click();
    await expect(page.getByTestId('asset-balanza-estado')).not.toHaveText(/Deshabilitar/i);
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

test.describe('los modulos se ven ANIDADOS, con los permisos de cada carpeta (4.1 y 4.10.6)', () => {
  test('la tabla es el arbol: carpeta, subcarpeta y los modulos dentro', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    // Tres niveles de la siembra: Institucional > Regional > Distrito Norte.
    await expect(page.getByTestId('carpeta-nodo-institucional')).toHaveAttribute('data-depth', '0');
    await expect(page.getByTestId('carpeta-nodo-regional')).toHaveAttribute('data-depth', '1');
    await expect(page.getByTestId('carpeta-nodo-norte')).toHaveAttribute('data-depth', '2');
    // Y el modulo, un nivel mas adentro que su carpeta.
    await expect(page.getByTestId('modulo-audiencias')).toHaveAttribute('data-depth', '3');
  });

  test('una carpeta dice si restringe por su cuenta o solo hereda', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    // `nodo-institucional` no lleva ambito propio en la siembra; `nodo-norte` si.
    await expect(page.getByTestId('carpeta-nodo-institucional-ambito')).toHaveText(/Hereda/);
    await expect(page.getByTestId('carpeta-nodo-norte-ambito')).toHaveText(/Restringe/);
  });

  test('desde la carpeta se llega al editor de ambitos CON esa carpeta ya elegida', async ({
    page,
  }) => {
    /*
     * El enlace existe para ahorrar un paso, y el paso que ahorra es encontrar la carpeta otra
     * vez en un desplegable de quince destinos. Si llegara sin elegir, no ahorraria nada.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');
    await page.getByTestId('permisos-nodo-norte').click();

    await expect(page).toHaveURL(/\/admin\/scopes\?destino=nodo-norte/);
    await expect(page.getByTestId('picker-target-scope')).toHaveValue('nodo-norte');
  });

  test('un borrador sin colocar sigue viendose, en su propia tabla', async ({ page }) => {
    // Al pasar de lista plana a arbol, lo que el arbol no coloca desaparece de la pantalla. Un
    // borrador entra en la organizacion general al publicarse, asi que son la mayoria.
    await asLogin(page, 'u-admin');
    const slug = `suelto-${Date.now()}`;
    const creado = await page.request.post('/api/modules', {
      data: { nombre: `Modulo ${slug}`, slug },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto('/admin/modules');
    await expect(page.getByTestId('tabla-modulos-sueltos')).toBeVisible();
    await expect(
      page.getByTestId('tabla-modulos-sueltos').getByTestId(`modulo-${slug}`),
    ).toBeVisible();
  });
});

test.describe('paquetes visuales: se crean desde la pantalla (4.1.3)', () => {
  test('crear, editar y borrar un paquete sin tocar el seed', async ({ page }) => {
    /*
     * La API llevaba desde el principio entera —guardar, validar, auditar, borrar— y no la
     * llamaba ninguna pantalla: la lista era de solo lectura y un paquete solo existia si lo
     * habia sembrado el seed. Esta prueba recorre el camino que faltaba.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/packages');

    await page.getByTestId('add-package').click();
    await page.getByTestId('package-name').fill('Vista de prueba');
    await page.getByTestId('package-modulo-audiencias').check();
    await page.getByTestId('guardar-package').click();

    // Se busca por el nombre dentro de la tabla: el identificador lo genera el cliente, asi que
    // la prueba no puede conocerlo de antemano.
    const fila = page.getByTestId('tabla-paquetes').locator('tbody tr').filter({
      hasText: 'Vista de prueba',
    });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('1 modulo');

    // Editar: se abre con lo que tenia, y anadir otro modulo se refleja en la tabla.
    const id = ((await fila.getAttribute('data-testid')) ?? '').replace('package-', '');
    await page.getByTestId(`editar-package-${id}`).click();
    await expect(page.getByTestId('package-modulo-audiencias')).toBeChecked();
    await page.getByTestId('package-modulo-casos-pendientes').check();
    await page.getByTestId('guardar-package').click();
    await expect(page.getByTestId(`package-${id}`)).toContainText('2 modulos');

    await page.getByTestId(`borrar-package-${id}`).click();
    await expect(page.getByTestId(`package-${id}`)).toHaveCount(0);
  });

  test('la tabla dice cuantos nodos no se muestran, y por que', async ({ page }) => {
    /*
     * La validacion de 4.10.6 ya existia y salia en la pantalla; lo que no habia era forma de
     * provocarla desde la interfaz. Un paquete asignado al equipo Este que incluya un modulo del
     * Norte referencia algo que esa audiencia no tiene concedido: no falla, simplemente no se le
     * dibuja, y sin aviso nadie se entera hasta que alguien pregunta por que no lo ve.
     */
    await asLogin(page, 'u-admin');

    const creado = await page.request.post('/api/admin/packages', {
      data: {
        paquete: {
          id: 'pkg-colgante',
          name: 'Con un nodo fuera',
          visualTree: [
            {
              id: 'pkg-colgante-norte',
              type: 'module',
              moduleRef: {
                moduleId: 'casos-pendientes',
                slug: 'casos-pendientes',
                name: 'Casos pendientes',
              },
            },
          ],
        },
      },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    // Se le asigna al equipo Este, que no tiene concedida la carpeta Norte. `saveTeam` reemplaza
    // el equipo entero, asi que se lee primero: mandar solo el campo que cambia lo dejaria sin
    // miembros ni nodos concedidos.
    const { equipos } = (await (await page.request.get('/api/admin/teams')).json()) as {
      equipos: { id: string }[];
    };
    const este = equipos.find((e) => e.id === 'equipo-este');
    const asignado = await page.request.post('/api/admin/teams', {
      data: { accion: 'guardar', equipo: { ...este, assignedPackageId: 'pkg-colgante' } },
    });
    expect(asignado.ok(), await asignado.text()).toBe(true);

    await page.goto('/admin/modules/packages');
    await expect(page.getByTestId('package-estado-pkg-colgante')).toContainText(/no se muestra/);
    await expect(page.getByTestId('package-problemas-pkg-colgante')).toContainText(
      'casos-pendientes',
    );

    // Borrar el paquete tambien lo despega del equipo, asi que no queda nada que deshacer: es
    // parte de lo que hace `deletePackage` y conviene que la prueba dependa de ello.
    await page.getByTestId('borrar-package-pkg-colgante').click();
    await expect(page.getByTestId('package-pkg-colgante')).toHaveCount(0);

    const despues = (await (await page.request.get('/api/admin/teams')).json()) as {
      equipos: { id: string; assignedPackageId?: string }[];
    };
    expect(despues.equipos.find((e) => e.id === 'equipo-este')?.assignedPackageId).toBeUndefined();
  });
});

test.describe('las seis acciones de una fila del arbol (4.1 y 4.10.8)', () => {
  test('subir y bajar cambian el orden, y los extremos salen apagados', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    // Dentro de Regional, en el ORDEN DEL ARBOL: Norte va primero y Este despues. Por nombre
    // saldrian al reves, y esa es justo la razon de que la tabla ya no ordene por nombre.
    const orden = async () =>
      await page.locator('[data-testid^="carpeta-nodo-distrito"], [data-testid="carpeta-nodo-norte"], [data-testid="carpeta-nodo-este"]').evaluateAll((filas) =>
        filas.map((f) => f.getAttribute('data-testid')),
      );
    expect(await orden()).toEqual(['carpeta-nodo-norte', 'carpeta-nodo-este']);

    // El primero de su carpeta no puede subir: el boton se apaga en vez de fallar al pulsarlo.
    await expect(page.getByTestId('subir-nodo-norte')).toBeDisabled();
    await expect(page.getByTestId('bajar-nodo-este')).toBeDisabled();

    await page.getByTestId('bajar-nodo-norte').click();
    await expect
      .poll(async () => await orden())
      .toEqual(['carpeta-nodo-este', 'carpeta-nodo-norte']);

    // Se deja como estaba: el almacen sobrevive entre pruebas del mismo archivo.
    await page.getByTestId('subir-nodo-norte').click();
    await expect
      .poll(async () => await orden())
      .toEqual(['carpeta-nodo-norte', 'carpeta-nodo-este']);
  });

  test('ocultar un modulo lo retira de la navegacion Y de su URL', async ({ page }) => {
    /*
     * Ocultar no puede ser cosmetico.
     *
     * Si solo desapareciera del menu, `/m/{slug}` seguiria sirviendolo a quien conociera la
     * direccion, y eso es ocultamiento de interfaz — lo que el criterio de la seccion 9 dice
     * expresamente que no basta. Las dos mitades se comprueban juntas.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');
    await page.getByTestId('ocultar-nodo-m-audiencias').click();
    await expect(page.getByTestId('modulo-audiencias')).toHaveAttribute('data-hidden', 'si');

    // Con `u-admin`, que esta en el equipo Norte y SI lo veria: con alguien que no lo ve de todas
    // formas, la prueba pasaria sin comprobar nada.
    await page.goto('/');
    await expect(page.getByTestId('nav-audiencias')).toHaveCount(0);
    await page.goto('/m/audiencias');
    await expect(page.getByTestId('module-title')).toHaveCount(0);

    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');
    await page.getByTestId('ocultar-nodo-m-audiencias').click();
    await expect(page.getByTestId('modulo-audiencias')).toHaveAttribute('data-hidden', 'no');
  });

  test('las dos tablas de modulos reparten las columnas IGUAL', async ({ page }) => {
    /*
     * El ancho de una columna es lo que permite leer dos tablas seguidas sin reorientarse.
     *
     * Las dos dibujan la misma cabecera, pero el reparto lo decidia el contenido de cada una: la
     * de vigentes lleva sangrias y nombres largos, la de sueltos no, y las mismas seis columnas
     * acababan en sitios distintos. Se comparan los bordes reales, no las clases: una clase
     * puesta y un `table-layout` que no llega a aplicarse se ven identicos en el codigo.
     */
    await asLogin(page, 'u-admin');

    // Hace falta que haya una tabla de sueltos: se crea un borrador, que nace sin colocar.
    const slug = `ancho-${Date.now()}`;
    const creado = await page.request.post('/api/modules', {
      data: { nombre: `Modulo ${slug}`, slug },
    });
    expect(creado.ok(), await creado.text()).toBe(true);

    await page.goto('/admin/modules');
    await expect(page.getByTestId('tabla-modulos-sueltos')).toBeVisible();

    const anchos = async (testid: string): Promise<number[]> => {
      // Hijos DIRECTOS: dentro de una celda hay otra tabla —la de objetos del modulo— y con el
      // selector de descendencia sus encabezados, que estan ocultos, entraban en la cuenta.
      const celdas = page.getByTestId(testid).locator('> thead > tr > th');
      const total = await celdas.count();
      const salida: number[] = [];
      for (let i = 0; i < total; i++) {
        const caja = await celdas.nth(i).boundingBox();
        salida.push(Math.round(caja?.width ?? -1));
      }
      return salida;
    };

    expect(await anchos('tabla-modulos-sueltos')).toEqual(await anchos('tabla-modulos'));
  });

  test('una carpeta tambien tiene lapiz, apagado: la columna no se descuadra', async ({ page }) => {
    /*
     * El lapiz desaparecia en las carpetas y con el se corria un sitio toda la fila de iconos.
     * Se comprueba que ESTA y que esta APAGADO: si solo se comprobara que esta, un boton activo
     * que no hace nada pasaria la prueba.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    const lapiz = page.getByTestId('editar-nodo-norte');
    await expect(lapiz).toBeVisible();
    await expect(lapiz).toBeDisabled();
  });

  test('retirar un modulo publicado lo saca de servicio, y restablecerlo lo devuelve', async ({
    page,
  }) => {
    /*
     * Lo que se comprueba es que el modulo DEJA DE SERVIRSE en `/m/{slug}` y vuelve, no que la
     * tabla cambie de rotulo: el rotulo es interfaz, y ocultar en la interfaz no es retirar.
     *
     * Sobre `audiencias`, que es semilla, y termina restablecido: el estado con el que empieza es
     * el mismo con el que acaba. Borrarlo —que es lo que hacia la primera version de esta prueba—
     * dejaba sin modulo a `editor.spec`, que mira justamente su historial. No se veia porque con
     * varios workers cada uno tiene su almacen y las dos caian en almacenes distintos; en el pase
     * secuencial de verdad —un worker, un almacen— la segunda fallaba. Una prueba que destruye
     * algo sembrado no falla ella: hace fallar a otra, y en otro archivo.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    await page.getByTestId('retirar-nodo-m-audiencias').click();
    await page.getByTestId('retirar-motivo-nodo-m-audiencias').fill('La medida esta mal.');
    await page.getByTestId('retirar-confirmar-nodo-m-audiencias').click();
    await expect(page.getByTestId('restablecer-nodo-m-audiencias')).toBeVisible();

    await page.goto('/m/audiencias');
    await expect(page.getByTestId('module-title')).toHaveCount(0);

    await page.goto('/admin/modules');
    await page.getByTestId('restablecer-nodo-m-audiencias').click();
    await expect(page.getByTestId('retirar-nodo-m-audiencias')).toBeVisible();

    await page.goto('/m/audiencias');
    await expect(page.getByTestId('module-title')).toBeVisible();
  });

  test('borrar exige retirar antes, y se lleva tambien el nodo del arbol', async ({ page }) => {
    /*
     * La otra mitad del ciclo, sobre un modulo PROPIO: esta prueba destruye, asi que lo que
     * destruye tiene que ser suyo.
     *
     * No mira `/m/{slug}`: un modulo recien publicado no esta concedido al equipo de quien lo
     * publico, asi que ahi respondería 404 por falta de acceso y no por el estado — y una
     * comprobacion que pasa por dos motivos distintos no comprueba ninguno. Lo que se mira aqui es
     * el guardian —la papelera no existe sobre lo publicado— y que al borrar se va tambien el nodo:
     * un nodo que apunta a nada dibuja un enlace roto en el menu de todo el mundo.
     *
     * El boton se busca DENTRO de la fila y no por el id del nodo: el nodo lo pone el arbol al
     * publicar y no hay por que saber como lo compone.
     */
    await asLogin(page, 'u-admin');
    const slug = `ciclo-${Date.now()}`;
    await objectDraft(page, slug);
    for (const transition of ['enviar', 'publicar']) {
      const paso = await page.request.post(`/api/modules/${slug}/status`, { data: { transition } });
      expect(paso.ok(), `No se pudo ${transition} ${slug}: ${await paso.text()}`).toBe(true);
    }

    await page.goto('/admin/modules');
    const fila = page.getByTestId(`modulo-${slug}`);
    const boton = (accion: string) => fila.locator(`[data-testid^="${accion}-"]`).first();
    const panel = (accion: string) => page.locator(`[data-testid^="${accion}-"]`).first();

    await expect(fila.locator('[data-testid^="eliminar-"]')).toHaveCount(0);

    await boton('retirar').click();
    await panel('retirar-motivo').fill('Ya no se usa.');
    await panel('retirar-confirmar').click();
    await boton('eliminar').click();
    await panel('eliminar-confirmar').click();

    await expect(page.getByTestId(`modulo-${slug}`)).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId(`nav-${slug}`)).toHaveCount(0);
  });


});

test.describe('configuracion de un modulo (4.1 y 4.11)', () => {
  test('apagar una opcion la RETIRA de la barra del modulo', async ({ page }) => {
    // El interruptor tiene que apagar algo. Se comprueba cruzando las dos pantallas: se apaga en
    // la configuracion y se mira en el modulo.
    await asLogin(page, 'u-admin');
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('incrustar')).toBeVisible();

    await page.goto('/admin/modules/casos-pendientes/settings');
    await page.getByTestId('opcion-embebido-casilla').uncheck();
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();

    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('incrustar')).toHaveCount(0);
    // Y solo esa: apagar una no puede llevarse por delante a las demas.
    await expect(page.getByTestId('open-export')).toBeVisible();

    await page.goto('/admin/modules/casos-pendientes/settings');
    await page.getByTestId('opcion-embebido-casilla').check();
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();
  });

  test('la descripcion se guarda y se lee en el propio modulo', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const texto = `Demoras por materia, al cierre del trimestre ${Date.now()}`;

    await page.goto('/admin/modules/casos-pendientes/settings');
    await page.getByTestId('settings-descripcion').fill(texto);
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();

    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('module-descripcion')).toHaveText(texto);
  });

  test('una URL invalida se rechaza con el motivo, no se sanea en silencio', async ({ page }) => {
    // Corregirla por detras dejaria a quien la escribio con una direccion que no es la suya, y
    // enterandose el dia que la comparte.
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/casos-pendientes/settings');
    await page.getByTestId('settings-slug').fill('Con Mayusculas Y Espacios');
    await page.getByTestId('guardar-settings').click();

    await expect(page.getByTestId('settings-mensaje')).toContainText('no sirve como URL');
    // Y la de verdad no cambio.
    await page.goto('/m/casos-pendientes');
    await expect(page.getByTestId('module-title')).toBeVisible();
  });

  test('el tipo de navegador y el nombre de una pagina se guardan de verdad', async ({ page }) => {
    /*
     * Las dos puntas estaban bien y el medio se comia la configuracion.
     *
     * La pantalla mandaba el navegador y las paginas, `saveSettings` sabia guardarlos, y la ruta
     * de en medio construia el objeto sin ellos: elegir un panel derecho o renombrar una pagina
     * decia «guardado» y no guardaba nada. Por eso la prueba cruza las dos pantallas en vez de
     * mirar el formulario: en el formulario, el fallo no se veia.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/settings');
    await page.getByTestId('navegador-panel-derecho').check();
    await page.getByTestId('pagina-graficos-nombre').fill('Graficos y series');
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();

    await page.goto('/m/composicion');
    await expect(page.getByTestId('navegador-de-pagina')).toHaveAttribute(
      'data-tipo',
      'panel-derecho',
    );
    await expect(page.getByTestId('nav-pagina-graficos')).toContainText('Graficos y series');

    // Se deja como estaba.
    await page.goto('/admin/modules/composicion/settings');
    await page.getByTestId('navegador-panel-izquierdo').check();
    await page.getByTestId('pagina-graficos-nombre').fill('Graficos');
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();
  });

  test('la seccion de filtros del panel se configura DESDE LA PANTALLA', async ({ page }) => {
    /*
     * Existia en el modelo y solo se podia poner por API o sembrandola a mano.
     *
     * Quien administra veia la eleccion de navegador y de comportamiento, y no tenia forma de
     * anadirle los filtros que el propio modelo describe. Una funcionalidad que solo se alcanza
     * por API no esta entregada, esta escrita — asi que la prueba cruza las dos pantallas: se
     * anade aqui y se mira en el modulo.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/m/composicion');
    await expect(page.getByTestId('navegador-filtros')).toBeVisible();
    // El distrito NO esta todavia: es lo que esta prueba va a anadir.
    await expect(page.getByTestId('filter-DimTribunal.Distrito')).toHaveCount(0);

    await page.goto('/admin/modules/composicion/settings');
    await page.getByTestId('nav-filtro-anadir').selectOption('DimTribunal.Distrito');
    await expect(page.getByTestId('nav-filtro-DimTribunal.Distrito')).toBeVisible();
    await page.getByTestId('nav-filtro-DimTribunal.Distrito-etiqueta').fill('Distrito judicial');
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();

    // Y aparece en el panel, con su rotulo y con los MISMOS controles que el panel de filtros.
    await page.goto('/m/composicion');
    const nuevo = page.getByTestId('filter-DimTribunal.Distrito');
    await expect(nuevo).toBeVisible();
    await expect(nuevo).toContainText('Distrito judicial');

    // Se deja como estaba: la siguiente prueba no tiene por que heredar lo que esta puso.
    await page.goto('/admin/modules/composicion/settings');
    await page.getByTestId('nav-filtro-DimTribunal.Distrito-quitar').click();
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();

    await page.goto('/m/composicion');
    await expect(page.getByTestId('filter-DimTribunal.Distrito')).toHaveCount(0);
  });
});

test.describe('permisos de un modulo, desde el modulo (4.10.6)', () => {
  test('dice quien lo alcanza y por que, distinguiendo lo heredado', async ({ page }) => {
    /*
     * Con `composicion` y no con `audiencias`.
     *
     * `audiencias` lo mueve a Distrito Este una prueba anterior de este mismo archivo, asi que
     * para cuando llega esta el equipo Este ya lo hereda y la comprobacion diria otra cosa. El
     * orden dentro de un archivo es parte de lo que se prueba, asi que se elige un modulo que
     * nadie mueve en vez de pelearse con el.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/permissions');

    // El equipo Norte tiene concedida la carpeta Regional, no el modulo: es herencia, y revocarla
    // desde aqui no se puede. La pantalla lo dice en vez de ofrecer un boton que no haria nada.
    await expect(page.getByTestId('acceso-equipo-norte-como')).toContainText(/Hereda/);
    await expect(page.getByTestId('acceso-equipo-norte')).toContainText(/Se revoca en la carpeta/);
  });

  test('conceder a un equipo hace que sus personas lo vean', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/permissions');
    // El equipo Este no lo alcanza todavia, asi que no sale en la tabla: la tabla es de quien lo
    // tiene, no de quien no.
    await expect(page.getByTestId('acceso-equipo-este')).toHaveCount(0);

    // Se concede desde el boton de anadir, marcando uno o varios: la tabla ensena quien TIENE
    // acceso, no quien no lo tiene, y la unica accion de una fila es quitarlo.
    await page.getByTestId('anadir-equipos').click();
    await page.getByTestId('marcar-equipo-equipo-este').check();
    await page.getByTestId('conceder-marcados').click();
    await expect(page.getByTestId('acceso-equipo-este-como')).toContainText(/Concedido aqui/);

    // Lo que manda es lo que ve la persona, no la insignia. `u-beto` es visor del equipo Este.
    await asLogin(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('nav-composicion')).toBeVisible();

    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/permissions');
    await page.getByTestId('quitar-equipo-equipo-este').click();
    await expect(page.getByTestId('acceso-equipo-este')).toHaveCount(0);
  });

  test('conceder a UNA PERSONA se lo da a ella y a nadie mas de su equipo', async ({ page }) => {
    /*
     * Es el camino que se abrio en el modelo, y la unica forma de comprobarlo es mirando lo que
     * ve cada cual: antes este boton metia a la persona en un equipo que ya tenia el modulo, que
     * concedia pero de paso le daba todo lo demas del equipo.
     *
     * `u-beto` esta solo en el equipo Este, que no alcanza `composicion`. Se le concede a su
     * nombre, y lo que prueba que la concesion es individual y no del equipo son dos cosas: que
     * el equipo Este sigue sin salir en la tabla de equipos, y que `u-ana` —que TAMBIEN esta en
     * el equipo Este— no lo ve cuando trabaja desde ese equipo.
     *
     * Ana con su equipo Norte activo si lo ve, y eso no dice nada: el Norte tiene concedida la
     * carpeta Regional de la que cuelga. Por eso se le cambia el equipo activo antes de mirar; sin
     * ese paso la prueba pasaria por un motivo que no es el suyo.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/permissions');
    await expect(page.getByTestId('acceso-equipo-este')).toHaveCount(0);

    await page.getByTestId('anadir-personas').click();
    await page.getByTestId('marcar-persona-u-beto').check();
    await page.getByTestId('dar-acceso').click();
    await expect(page.getByTestId('persona-u-beto-como')).toContainText(/Concedido a su nombre/);

    // Concedio a la PERSONA: el equipo no aparece entre los que lo alcanzan.
    await expect(page.getByTestId('acceso-equipo-este')).toHaveCount(0);

    // Y lo que manda es lo que se ve. Beto si, y ademas puede abrirlo: ocultar no es proteger, y
    // conceder tampoco puede quedarse en el menu.
    await asLogin(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('nav-composicion')).toBeVisible();
    await page.goto('/m/composicion');
    await expect(page.getByRole('heading', { name: 'Composicion' })).toBeVisible();

    // Ana, compañera suya en el equipo Este, no: la concesion fue nominal, no del equipo.
    await asLogin(page, 'u-ana');
    expect(
      (
        await page.request.post('/api/session/active-team', {
          data: { teamId: 'equipo-este' },
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/');
    await expect(page.getByTestId('nav-composicion')).toHaveCount(0);

    // Y se revoca por el mismo sitio por el que se concedio.
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/permissions');
    await page.getByTestId('quitar-persona-u-beto').click();
    await expect(page.getByTestId('persona-u-beto')).toHaveCount(0);

    await asLogin(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('nav-composicion')).toHaveCount(0);
  });

  test('revocado, la URL escrita a mano tampoco sirve (criterio de la seccion 9)', async ({
    page,
  }) => {
    // El menu es lo primero que se mira y lo ultimo que protege. La comprobacion que importa es
    // la del backend, y desde que hay dos caminos de concesion tiene que mirar los dos: uno que
    // solo preguntara por el equipo le cerraria la puerta a quien la tiene a su nombre, y uno que
    // no preguntara por nada se la abriria a todos.
    await asLogin(page, 'u-beto');
    const respuesta = await page.request.get('/m/composicion');
    expect(respuesta.status()).toBe(404);
  });
});

test.describe('la tabla del arbol se pliega y se despliega (4.1)', () => {
  test('plegar una carpeta esconde lo que contiene, y desplegarla lo devuelve', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    /*
     * Con `composicion`, que vive en `nodo-norte` y no lo mueve nadie.
     *
     * `audiencias` lo lleva a Distrito Este una prueba anterior de este mismo archivo, asi que
     * para cuando llega esta ya no esta en la carpeta que se pliega. El orden dentro de un archivo
     * es parte de lo que se prueba, asi que se elige un modulo quieto en vez de pelearse con el.
     */
    await expect(page.getByTestId('modulo-composicion')).toBeVisible();
    await expect(page.getByTestId('plegar-nodo-norte')).toHaveAttribute('aria-expanded', 'true');

    await page.getByTestId('plegar-nodo-norte').click();
    await expect(page.getByTestId('plegar-nodo-norte')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('modulo-composicion')).toHaveCount(0);
    // Y la carpeta sigue ahi: plegar no es ocultar.
    await expect(page.getByTestId('carpeta-nodo-norte')).toBeVisible();
    // Lo que esta FUERA de esa rama no se toca.
    await expect(page.getByTestId('carpeta-nodo-este')).toBeVisible();

    await page.getByTestId('plegar-nodo-norte').click();
    await expect(page.getByTestId('modulo-composicion')).toBeVisible();
  });

  test('plegar una carpeta de arriba se lleva las subcarpetas enteras', async ({ page }) => {
    // Es lo que distingue «esconder lo de dentro» de «esconder la rama»: sin recorrer ancestros,
    // plegar Institucional dejaria Regional y sus modulos a la vista.
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    await page.getByTestId('plegar-nodo-institucional').click();
    await expect(page.getByTestId('carpeta-nodo-regional')).toHaveCount(0);
    await expect(page.getByTestId('carpeta-nodo-norte')).toHaveCount(0);
    await expect(page.getByTestId('modulo-composicion')).toHaveCount(0);
    await expect(page.getByTestId('carpeta-nodo-institucional')).toBeVisible();

    await page.getByTestId('desplegar-todo').click();
    await expect(page.getByTestId('modulo-composicion')).toBeVisible();
  });

  test('colapsar todo deja solo la raiz, y expandir todo lo devuelve', async ({ page }) => {
    /*
     * Dos botones, no uno por nivel.
     *
     * Habia uno por cada profundidad del arbol y la fila crecia con la organizacion: con cinco
     * niveles eran cinco botones para un gesto que casi siempre es «cierralo todo» o «abrelo
     * todo». Plegar un nivel concreto se sigue pudiendo carpeta a carpeta, que es cuando de
     * verdad se quiere.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    await page.getByTestId('colapsar-todo').click();
    // La raiz se queda; todo lo que cuelga de ella desaparece, a cualquier profundidad.
    await expect(page.getByTestId('carpeta-nodo-institucional')).toBeVisible();
    await expect(page.getByTestId('carpeta-nodo-regional')).toHaveCount(0);
    await expect(page.getByTestId('carpeta-nodo-norte')).toHaveCount(0);

    await page.getByTestId('desplegar-todo').click();
    await expect(page.getByTestId('carpeta-nodo-norte')).toBeVisible();
  });

  test('el buscador y los botones van EN LA MISMA LINEA', async ({ page }) => {
    /*
     * Se mide la posicion en pantalla, no la clase ni el orden del marcado.
     *
     * Eran dos bloques apilados y empujaban la tabla un renglon hacia abajo por tres controles.
     * Comprobar que comparten envoltorio pasaria igual de verde con los dos uno encima del otro;
     * lo que se afirma es que se ven en la misma linea, asi que se comparan sus cajas.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    const buscador = await page.getByTestId('buscar-tabla-modulos').boundingBox();
    const boton = await page.getByTestId('colapsar-todo').boundingBox();
    expect(buscador).not.toBeNull();
    expect(boton).not.toBeNull();

    // Se solapan verticalmente: comparten renglon aunque no midan lo mismo de alto.
    const arriba = Math.max(buscador?.y ?? 0, boton?.y ?? 0);
    const abajo = Math.min(
      (buscador?.y ?? 0) + (buscador?.height ?? 0),
      (boton?.y ?? 0) + (boton?.height ?? 0),
    );
    expect(abajo).toBeGreaterThan(arriba);
  });

  test('lo plegado se recuerda al volver, y es de quien mira', async ({ page }) => {
    /*
     * Vive en el navegador de cada persona.
     *
     * No es una decision sobre la organizacion —eso son mover, ocultar y los permisos, que si van
     * al almacen y a la auditoria—: es como prefiere leer la pantalla quien la mira. Guardarlo en
     * el servidor lo compartiria con todo el mundo, que no es lo que nadie espera de un triangulo.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');
    await page.getByTestId('plegar-nodo-norte').click();
    await expect(page.getByTestId('modulo-composicion')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('plegar-nodo-norte')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('modulo-composicion')).toHaveCount(0);

    await page.getByTestId('desplegar-todo').click();
    await page.reload();
    await expect(page.getByTestId('modulo-composicion')).toBeVisible();
  });
});

test.describe('el carril dice el nivel con la sangria (4.10.8)', () => {
  test('una subseccion empieza a la DERECHA de la seccion de la que cuelga', async ({ page }) => {
    /*
     * Se mide la posicion en pantalla, no la clase ni la regla.
     *
     * La sangria estaba escrita en `.admin__hijas` y no estaba en vigor: mas arriba hay un
     * `.admin__nav ul { margin: 0 }` que gana por especificidad, asi que el submenu salia a
     * cuatro pixeles de su madre. Comprobar que el `ul` lleva la clase habria pasado igual de
     * verde con el fallo puesto; lo unico que lo distingue es donde empieza el texto.
     *
     * Se compara enlace con enlace y no caja con caja: la caja de la lista podria estar sangrada
     * y el texto de dentro seguir alineado con el de arriba, que es justo lo que se ve.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/resources');

    const submenu = page.getByTestId('submenu-resources');
    await expect(submenu).toBeVisible();

    const sangria = await page.evaluate(() => {
      const hijas = document.querySelector('.admin__hijas') as HTMLElement;
      const madre = hijas.parentElement as HTMLElement;
      const izquierda = (e: Element) => e.getBoundingClientRect().left;
      return (
        izquierda(hijas.querySelector('a') as Element) -
        izquierda(madre.querySelector('a') as Element)
      );
    });

    // Un umbral, no una cifra exacta: lo que se afirma es que se ve, no cuanto mide el token.
    expect(sangria).toBeGreaterThanOrEqual(16);
  });

  test('la portada de Recursos cuenta lo que hay, y el numero es el de la pantalla hija', async ({
    page,
  }) => {
    /*
     * El indice de tarjetas se quito y la portada se quedo sin nada debajo del titulo.
     * Lo que la sustituye tiene que decir algo que el carril no diga, y para eso hay un numero.
     *
     * Se compara con la tabla de la pantalla hija, no con una cifra escrita aqui: un contador
     * propio empezaria coincidiendo y dejaria de hacerlo la primera vez que entre un objeto al
     * catalogo, y el que se ve primero es el que engana.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/resources');

    const celda = page.getByTestId('familia-containers').locator('td').last();
    const dice = Number((await celda.innerText()).trim().split(/\s+/)[0]);
    expect(dice).toBeGreaterThan(0);

    await page.getByTestId('familia-containers').getByRole('link').click();
    await expect(page).toHaveURL(/\/admin\/resources\/containers$/);
    expect(await page.locator('[data-testid^="recurso-"][data-testid$="-estado"]').count()).toBe(
      dice,
    );
  });
});


test.describe('crear y editar desde la tabla de modulos (4.1 y 4.10.8)', () => {
  test('crear una carpeta la coloca donde se dijo, y aparece en la tabla', async ({ page }) => {
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    await page.getByTestId('abrir-crear-carpeta').click();
    await page.getByTestId('nueva-carpeta-nombre').fill('Carpeta de prueba');
    await page.getByTestId('nueva-carpeta-padre').selectOption('nodo-norte');
    await page.getByTestId('crear-carpeta').click();

    const fila = page.getByRole('row', { name: /Carpeta de prueba/ });
    await expect(fila).toBeVisible();
    // Dentro de Distrito Norte, que esta a profundidad 2: la hija va una mas adentro.
    await expect(fila).toHaveAttribute('data-depth', '3');
  });

  test('crear un modulo lo abre EN EL EDITOR, que es donde se sigue', async ({ page }) => {
    // Un borrador recien creado esta vacio: devolver a la tabla obliga a buscar la fila nueva y
    // abrirla, que es el paso que de verdad se queria dar.
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    await page.getByTestId('abrir-crear-modulo').click();
    await page.getByTestId('nuevo-modulo-nombre').fill('Módulo de prueba');
    // El slug se propone a partir del nombre, sin acentos y con guiones.
    await expect(page.getByTestId('nuevo-modulo-slug')).toHaveValue('modulo-de-prueba');
    await page.getByTestId('crear-modulo').click();

    await expect(page).toHaveURL(/\/editor\/modulo-de-prueba$/);
  });

  test('editar un publicado abre una revision y NO lo retira de la navegacion', async ({ page }) => {
    /*
     * Es lo que separa «editar» de lo que habia antes, que era despublicar.
     *
     * Se comprueba lo que ve una persona cualquiera mientras tanto: si el modulo desapareciera de
     * su menu, corregir una palabra habria apagado el tablero para toda la institucion.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules');

    const fila = page.getByTestId('modulo-composicion');
    await expect(fila).toContainText('Publicado');
    await fila.getByTestId(/^editar-/).click();

    // Lleva al editor de la REVISION, que es un modulo distinto con su propio slug.
    await expect(page).toHaveURL(/\/editor\/composicion-revision$/);

    // Y el publicado sigue en pie para quien lo tenia.
    await asLogin(page, 'u-ana');
    await page.goto('/');
    await expect(page.getByTestId('nav-composicion')).toBeVisible();
    await page.goto('/m/composicion');
    await expect(page.getByRole('heading', { name: 'Composicion' })).toBeVisible();
  });
});


test.describe('mas de un tema, cada uno con sus dos versiones (4.3)', () => {
  test('el de fabrica ensena SUS DOS versiones, no dos temas', async ({ page }) => {
    /*
     * Antes la pantalla listaba «Institucional claro» e «Institucional oscuro» como si fueran dos
     * temas. Con eso no habia forma de tener un segundo tema sin tener cuatro entradas, y nada
     * impedia que alguien cambiara una version y no la otra.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/themes');

    await expect(page.getByTestId('tema-institucional')).toBeVisible();
    await expect(page.getByTestId('tema-institucional-light')).toBeVisible();
    await expect(page.getByTestId('tema-institucional-dark')).toBeVisible();
    // Y las dos pasan contraste: la que no corre tambien se mira.
    await expect(page.getByTestId('tema-institucional-light-contraste')).toBeVisible();
    await expect(page.getByTestId('tema-institucional-dark-contraste')).toBeVisible();
  });

  test('un tema nuevo se crea, se sirve, y REPINTA la aplicacion entera', async ({ page }) => {
    /*
     * Lo que importa no es que la fila aparezca: es que el color cambie donde se mira.
     *
     * Se compara el color CALCULADO de la marca antes y despues de servirlo, y en una pagina que
     * no es la de temas. Una pantalla de temas que solo se dibuja a si misma es un catalogo, no
     * una configuracion.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/');
    const antes = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--md-sys-color-primary').trim(),
    );
    expect(antes).not.toBe('');

    await page.goto('/admin/themes');
    await page.getByTestId('abrir-crear-tema').click();
    await page.getByTestId('nuevo-tema-nombre').fill('Verde de prueba');
    await page.getByTestId('nuevo-tema-primario').fill('#00695c');
    await page.getByTestId('crear-tema').click();

    const nuevo = page.locator('[data-testid^="tema-tema-"]').first();
    await expect(nuevo).toContainText('Verde de prueba');
    // Nace con sus DOS versiones, como cualquier tema.
    await expect(nuevo.locator('[data-testid$="-light"]')).toBeVisible();
    await expect(nuevo.locator('[data-testid$="-dark"]')).toBeVisible();

    await nuevo.locator('[data-testid^="activar-"]').click();
    await expect(nuevo.locator('[data-testid$="-activo"]')).toBeVisible();

    await page.goto('/');
    const despues = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--md-sys-color-primary').trim(),
    );
    expect(despues).not.toBe(antes);
  });

  test('el de fabrica no se puede borrar: es el que queda', async ({ page }) => {
    // Sin un tema que siempre este, borrar el ultimo dejaria la aplicacion sin color, y sin forma
    // de volver a entrar a crear uno — el panel tambien se dibuja con el.
    await asLogin(page, 'u-admin');
    await page.goto('/admin/themes');
    await expect(page.getByTestId('borrar-institucional')).toHaveCount(0);
    await expect(page.getByTestId('tema-institucional-fabrica')).toBeVisible();
  });
});


test.describe('el carril colapsado no se superpone al contenido', () => {
  test('ni con `overlay`, que era el unico que lo hacia', async ({ page }) => {
    /*
     * `overlay` no reservaba NADA: el carril se ponia encima del ancho entero y el modulo
     * arrancaba debajo de una franja de iconos, con su titulo y su primera columna medio tapados.
     * Superponer la version colapsada no gana ancho —son tres centimetros y medio— y se lleva por
     * delante lo primero que se mira.
     *
     * Se prueba con `overlay` y no con el comportamiento por defecto: `grilla` ya reservaba el
     * carril al plegarse, asi que una prueba sobre el habria pasado con el fallo puesto.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/composicion/settings');
    await page.getByTestId('elegir-comportamiento-overlay').check();
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();

    await page.goto('/m/composicion');
    const navegador = page.getByTestId('navegador-de-pagina');
    await expect(navegador).toHaveAttribute('data-comportamiento', 'overlay');

    await page.getByTestId('navegador-plegar').click();
    await expect(navegador).toHaveAttribute('data-abierto', 'no');

    const carril = await navegador.boundingBox();
    const primera = await page.locator('.grid__cell').first().boundingBox();
    expect(carril).not.toBeNull();
    expect(primera).not.toBeNull();
    expect(primera?.x ?? 0).toBeGreaterThanOrEqual((carril?.x ?? 0) + (carril?.width ?? 0));

    // Se deja como estaba: la siguiente prueba no hereda lo que esta puso.
    await page.goto('/admin/modules/composicion/settings');
    await page.getByTestId('elegir-comportamiento-grilla').check();
    await page.getByTestId('guardar-settings').click();
    await expect(page.getByTestId('settings-mensaje')).toBeVisible();
  });
});

test.describe('las personas, y como entran, en una sola tabla (4.10.1 y 4.7.2)', () => {
  test('los equipos son un NUMERO que abre el detalle, no una lista en la celda', async ({
    page,
  }) => {
    /*
     * Con cuatro equipos, una fila ocupaba cuatro renglones y la tabla dejaba de leerse de un
     * vistazo. El numero responde «en cuantos esta» sin abrir nada, y el detalle —que equipo y
     * con que rol— esta a un clic.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/users');

    // Ana esta en los dos equipos de la semilla.
    await expect(page.getByTestId('usuario-u-ana-equipos')).toHaveText('2');
    await page.getByTestId('usuario-u-ana-equipos').click();

    const dialogo = page.getByTestId('usuario-u-ana-equipos-dialogo');
    await expect(dialogo.getByTestId('usuario-u-ana-equipo-equipo-norte')).toContainText(
      'colaborador',
    );
    await expect(dialogo.getByTestId('usuario-u-ana-equipo-equipo-este')).toContainText('visor');
  });

  test('la columna «Ambito propio» ya no esta, y la de cuenta si', async ({ page }) => {
    /*
     * «Ambito propio» decia «hereda» en casi todas las filas —es lo normal— y llevaba a una
     * pantalla que ya esta en el carril: una columna que casi siempre dice lo mismo no informa.
     * En su sitio va lo que si cambia de una fila a otra y no se sabia sin cambiar de pantalla:
     * si la persona entra por Azure AD o con una cuenta local.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/users');

    await expect(page.getByTestId('usuario-u-ana-ambito')).toHaveCount(0);
    await expect(page.getByTestId('usuario-u-ana-tipo')).toBeVisible();
  });
});

test.describe('el formato de salida de un objeto (4.2, 4.3 y 4.5)', () => {
  test('el lapiz del recurso fija con que formato NACE lo que se coloque despues', async ({
    page,
  }) => {
    /*
     * La prueba que impide que esto sea un formulario que guarda y ya.
     *
     * La leccion es la del interruptor de iconos de mas arriba: la decision se guardaba, la tabla
     * la dibujaba, y lo que el editor colocaba seguia naciendo igual. Por eso lo que se mira no es
     * que la pantalla vuelva a ensenar lo guardado —eso pasaria igual con el cable cortado—, sino
     * un objeto RECIEN COLOCADO en el editor.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/resources/visualizations');
    await page.getByTestId('editar-barras').click();
    await expect(page).toHaveURL(/\/admin\/resources\/defaults\/barras$/);

    // El mismo panel de Formato del editor, con sus secciones y sus testids: «Grafico» nace
    // plegada alli y aqui tambien, porque es el mismo componente y no una copia suya.
    await page.getByTestId('pres-barras-grafico').locator('summary').click();
    await page.getByTestId('pres-barras-leyenda').selectOption('abajo');
    await page.getByTestId('predeterminar-guardar').click();
    await expect(page.getByTestId('predeterminar-guardado')).toBeVisible();

    // Y la tabla lo dice, que es como se distingue un objeto configurado de uno de fabrica.
    await page.goto('/admin/resources/visualizations');
    await expect(page.getByTestId('recurso-barras-predeterminado')).toBeVisible();

    const slug = `salida-${Date.now()}`;
    await newModule(page, slug);
    await page.getByTestId('add-barras').click();
    await alDia(page);

    const bloque = page.locator('[data-testid^="block-obj-"]').first();
    const id = ((await bloque.getAttribute('data-testid')) ?? '').replace('block-', '');
    await page.getByTestId(`select-${id}`).click();
    await page.getByTestId('tab-formato').click();
    await expect(page.getByTestId(`pres-${id}-leyenda`)).toHaveValue('abajo');

    // Quitarlo devuelve el objeto a como salia de fabrica, sin tener que deshacer control a mano.
    await page.goto('/admin/resources/defaults/barras');
    await page.getByTestId('predeterminar-limpiar').click();
    await expect(page.getByTestId('predeterminar-guardado')).toBeVisible();

    const otro = `salida-${Date.now()}-b`;
    await newModule(page, otro);
    await page.getByTestId('add-barras').click();
    await alDia(page);
    const segundo = page.locator('[data-testid^="block-obj-"]').first();
    const idB = ((await segundo.getAttribute('data-testid')) ?? '').replace('block-', '');
    await page.getByTestId(`select-${idB}`).click();
    await page.getByTestId('tab-formato').click();
    await expect(page.getByTestId(`pres-${idB}-leyenda`)).not.toHaveValue('abajo');
  });

  test('un icono no lleva ni lapiz ni propuesta: no tiene formato ni versiones', async ({
    page,
  }) => {
    // El lapiz de un icono abria el formulario de proponer una version de un objeto que no existe.
    await asLogin(page, 'u-admin');
    await page.goto('/admin/resources/other');
    await expect(page.getByTestId('deshabilitar-icono:balanza')).toBeVisible();
    await expect(page.getByTestId('editar-icono:balanza')).toHaveCount(0);
    await expect(page.getByTestId('proponer-icono:balanza')).toHaveCount(0);
  });
});
