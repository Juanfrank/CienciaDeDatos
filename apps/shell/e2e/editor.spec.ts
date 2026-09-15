import { expect, test } from './instance';
import { alDia, asLogin, newModule, objectDraft } from './session';

/** Editor de modulos y ciclo de vida — secciones 4.1, 4.2 y criterios de la seccion 9. */

const newSlug = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test.describe('quien entra al editor (4.10.1)', () => {
  test('un Visor no ve el enlace y la API le responde 403', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('link-editor')).toHaveCount(0);

    // Lo que importa no es el enlace ausente: crear modulos a mano tampoco debe funcionar.
    const respuesta = await page.request.post('/api/modules', {
      data: { nombre: 'Intento', slug: newSlug('intento-visor') },
    });
    expect(respuesta.status()).toBe(403);
  });

  test('un Visor que pide la pagina no ve el editor', async ({ page }) => {
    await asLogin(page, 'u-beto');
    await page.goto('/editor');
    await expect(page.getByTestId('without-permission-editor')).toBeVisible();
    await expect(page.getByTestId('module-list')).toHaveCount(0);
  });

  test('un Colaborador si entra', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/');
    // El enlace vive en el menu de la cuenta: existe siempre, se ve al desplegarlo.
    await page.getByTestId('account-trigger').click();
    await expect(page.getByTestId('link-editor')).toBeVisible();
    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Editor de modulos' })).toBeVisible();
  });
});

test.describe('cuando el servidor no contesta, el editor lo dice', () => {
  test('una caida de red deja el aviso, y lo escrito sigue ahi', async ({ page }) => {
    /*
     * `fetch` no devuelve una respuesta con error cuando no hay red: LANZA. Sin recoger eso, el
     * editor se quedaba diciendo «Sin guardar» sin decir por que —el mensaje de error se limpia
     * al empezar a guardar— y la promesa rechazada subia sin dueno.
     *
     * Se corta la peticion de verdad, con `route.abort`, en vez de devolver un 500: un 500 es
     * una respuesta y ya tenia camino. Lo que no lo tenia es que no hubiera respuesta ninguna.
     */
    const slug = newSlug('sin-red');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);
    await page.goto(`/editor/${slug}`);
    await expect(page.getByTestId('add-tarjeta-kpi')).toBeVisible();
    await alDia(page);

    await page.route(`**/api/modules/${slug}/edit`, (ruta) => ruta.abort('failed'));

    // Un cambio cualquiera dispara el autoguardado.
    await page.getByTestId('add-tarjeta-kpi').click();

    await expect(page.getByTestId('editor-error')).toContainText('no hay conexion');
    // Y sigue marcado como sin guardar: lo escrito no se da por guardado por haberlo intentado.
    await expect(page.locator('.editor')).toHaveAttribute('data-dirty', 'si');

    // Restablecida la conexion, el autoguardado se rearma solo y acaba guardando.
    await page.unroute(`**/api/modules/${slug}/edit`);
    await expect(page.locator('.editor')).toHaveAttribute('data-dirty', 'no', { timeout: 15_000 });
  });
});

test.describe('un modulo se construye con objetos prediseñados, no con consultas (4.2)', () => {
  test('crear un borrador y colocarle un objeto desde el catalogo', async ({ page }) => {
    const slug = newSlug('construido');
    await asLogin(page, 'u-ana');
    await page.goto('/editor');

    await page.getByTestId('new-module-name').fill(`Modulo ${slug}`);
    await page.getByTestId('new-module-slug').fill(slug);
    await page.getByTestId('create-module').click();

    await expect(page.getByTestId(`row-${slug}`)).toBeVisible();

    await page.goto(`/editor/${slug}`);
    await expect(page.getByTestId('empty-canvas')).toBeVisible();

    // El catalogo ofrece objetos, no una caja donde escribir SQL. Comprobar que NO hay donde
    // escribir una consulta es la mitad del criterio de 4.2 que importa.
    await expect(page.getByTestId('add-tarjeta-kpi')).toBeVisible();
    await expect(page.getByTestId('add-barras')).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);

    await page.getByTestId('add-tarjeta-kpi').click();

    // El objeto aparece EN EL LIENZO, dibujado, y queda elegido: el panel salta a «Datos», que es
    // lo que se va a configurar a continuacion.
    await expect(page.locator('[data-testid^="block-obj-"]')).toHaveCount(1);
    await expect(page.getByTestId('empty-canvas')).toHaveCount(0);
    await expect(page.getByTestId('tab-datos')).toHaveAttribute('aria-selected', 'true');
  });

  test('los complementos no se pueden colocar sueltos en la rejilla', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const slug = newSlug('sin-complementos');
    await objectDraft(page, slug);
    await page.goto(`/editor/${slug}`);

    // 'tooltip-explicativo' y 'tabla-de-datos' son adjuntables: acompañan a otro objeto. La
    // validacion los rechaza como elementos de la rejilla, asi que tampoco se ofrecen.
    await expect(page.getByTestId('add-tooltip-explicativo')).toHaveCount(0);
    await expect(page.getByTestId('add-tabla-de-datos')).toHaveCount(0);
  });

  test('un objeto con un campo inexistente se marca ROTO y el modulo se sigue editando', async ({
    page,
  }) => {
    await asLogin(page, 'u-ana');
    const slug = newSlug('roto');
    await objectDraft(page, slug);

    // Se rompe el mapeo por API, como si la fuente hubiera retirado el campo.
    const actual = await (await page.request.get(`/api/modules/${slug}/edit`)).json();
    actual.modulo.pages[0].items[0].instance.binding.measures = ['MedidaRetirada'];
    await page.request.put(`/api/modules/${slug}/edit`, {
      data: { paginas: actual.modulo.pages },
    });

    await page.goto(`/editor/${slug}`);

    // El bloque se dibuja MARCADO ROTO en el lienzo, con su problema, y el modulo se sigue
    // editando alrededor. Es literalmente lo que pide 4.2: no fallar en silencio.
    const block = page.getByTestId('block-kpi');
    await expect(block).toBeVisible();
    await expect(block.getByTestId('object-broken')).toBeVisible();
    await expect(page.getByTestId('problems-kpi')).toContainText('MedidaRetirada');
    await expect(page.getByTestId('locks-editor')).toBeVisible();
  });
});

test.describe('borrador -> pendiente -> publicado (4.1)', () => {
  test('un Colaborador propone y un Administrador publica', async ({ page }) => {
    const slug = newSlug('flujo');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);

    await page.goto('/editor');
    await page.getByTestId(`send-${slug}`).click();
    await expect(page.getByTestId(`row-${slug}`)).toContainText('Esperando aprobacion');

    // Ana no puede publicar lo que ella misma propuso.
    await expect(page.getByTestId(`publish-${slug}`)).toHaveCount(0);
    const intento = await page.request.post(`/api/modules/${slug}/status`, {
      data: { transition: 'publicar' },
    });
    expect(intento.status()).toBe(403);

    await asLogin(page, 'u-admin');
    await page.goto('/editor');
    await page.getByTestId(`publish-${slug}`).click();
    await expect(page.getByTestId(`row-${slug}`)).toContainText('Publicado');
  });

  test('un modulo con problemas no se puede proponer', async ({ page }) => {
    await asLogin(page, 'u-ana');
    const slug = newSlug('con-problemas');
    await page.request.post('/api/modules', { data: { nombre: 'Vacio', slug } });

    // Sin objetos no hay nada roto, asi que se rompe uno a proposito.
    const actual = await (await page.request.get(`/api/modules/${slug}/edit`)).json();
    actual.modulo.pages[0].items = [
      {
        id: 'malo',
        position: { x: 0, y: 0, w: 3, h: 2 },
        instance: {
          instanceId: 'malo',
          objectId: 'tarjeta-kpi',
          version: '1.0.0',
          title: 'Malo',
          binding: { datasetId: 'casos-por-distrito-trimestre', dimensions: [], measures: [] },
        },
      },
    ];
    await page.request.put(`/api/modules/${slug}/edit`, { data: { paginas: actual.modulo.pages } });

    const respuesta = await page.request.post(`/api/modules/${slug}/status`, {
      data: { transition: 'enviar' },
    });
    expect(respuesta.status()).toBe(422);

    await page.goto('/editor');
    // Y el boton no se ofrece: la pantalla dice por que antes de que nadie lo intente.
    const enviar = page.getByTestId(`send-${slug}`);
    await expect(enviar).toBeDisabled();
    await expect(page.getByTestId(`locks-${slug}`)).toBeVisible();

    // Y ademas SE VE deshabilitado. Sin estilo propio se dibujaba igual que un enlace activo
    // —subrayado y en azul—, asi que quien lo pulsaba no entendia por que no pasaba nada y lo
    // volvia a pulsar. Un control inerte que parece pulsable es peor que uno ausente.
    await expect(enviar).toHaveCSS('cursor', 'not-allowed');
    await expect(enviar).not.toHaveCSS('text-decoration-line', 'underline');
  });

  test('no se puede saltar la aprobacion', async ({ page }) => {
    await asLogin(page, 'u-admin');
    const slug = newSlug('sin-escalas');
    await objectDraft(page, slug);

    const respuesta = await page.request.post(`/api/modules/${slug}/status`, {
      data: { transition: 'publicar' },
    });
    expect(respuesta.status()).toBe(409);
  });
});

test.describe('un borrador es personal (criterio de la seccion 9)', () => {
  test('no se ve desde otra cuenta, ni por la lista ni por URL directa', async ({ page }) => {
    const slug = newSlug('personal');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);

    await asLogin(page, 'u-beto');
    // Un Visor ni siquiera entra al editor; lo que se comprueba es la API, que es donde
    // importa, y la pagina del modulo.
    expect((await page.request.get(`/api/modules/${slug}/edit`)).status()).toBe(404);
    expect((await page.request.get(`/api/modules/${slug}`)).status()).toBe(404);
    expect((await page.goto(`/m/${slug}`))?.status()).toBe(404);
  });

  test('ni un Administrador ve el borrador ajeno', async ({ page }) => {
    const slug = newSlug('ni-admin');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);

    await asLogin(page, 'u-admin');
    expect((await page.request.get(`/api/modules/${slug}/edit`)).status()).toBe(404);

    // Cuando se propone, si: revisar a ciegas no es revisar.
    await asLogin(page, 'u-ana');
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });
    await asLogin(page, 'u-admin');
    expect((await page.request.get(`/api/modules/${slug}/edit`)).status()).toBe(200);
  });

  test('otro Colaborador no puede reescribirlo', async ({ page }) => {
    const slug = newSlug('ajeno');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);

    // u-admin tiene el permiso general de editar borradores y aun asi no puede tocar este.
    await asLogin(page, 'u-admin');
    const respuesta = await page.request.put(`/api/modules/${slug}/edit`, {
      data: { nombre: 'Reescrito' },
    });
    expect(respuesta.status()).toBe(404);
  });
});

test.describe('retirar un modulo lo quita de la vista de todos', () => {
  test('publicar lo cuelga de la organizacion general, y conceder el nodo lo hace visible', async ({
    page,
  }) => {
    const slug = newSlug('retirado');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);
    const detalle = await (await page.request.get(`/api/modules/${slug}/edit`)).json();
    const moduleId = detalle.modulo.moduleId as string;
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });

    await asLogin(page, 'u-admin');
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'publicar' } });

    // Publicar lo cuelga en la RAIZ del arbol, que es el sitio mas restrictivo: existe en la
    // organizacion general y todavia no esta concedido a ningun equipo. Que publicar no conceda
    // acceso es deliberado — conceder es 4.10.6 y lo decide un Administrador.
    const arbol = (await (await page.request.get('/api/admin/tree')).json()) as {
      nodes: { id: string }[];
    };
    expect(arbol.nodes.some((n) => n.id === `nodo-${moduleId}`)).toBe(true);

    await asLogin(page, 'u-beto');
    expect((await page.request.get(`/api/modules/${slug}`)).status()).toBe(404);

    // Se concede el nodo al equipo de Beto y entonces si lo ve.
    await asLogin(page, 'u-admin');
    const equipos = await (await page.request.get('/api/admin/teams')).json();
    const esteTeam = (equipos.equipos as { id: string; grantedNodes: string[] }[]).find(
      (e) => e.id === 'equipo-este',
    );
    if (!esteTeam) throw new Error('fixture inesperado');
    const concedidosOriginales = [...esteTeam.grantedNodes];

    try {
      await page.request.post('/api/admin/teams', {
        data: {
          accion: 'guardar',
          equipo: { ...esteTeam, grantedNodes: [...concedidosOriginales, `nodo-${moduleId}`] },
        },
      });

      await asLogin(page, 'u-beto');
      expect((await page.request.get(`/api/modules/${slug}`)).status()).toBe(200);

      // Y al retirarlo deja de servir, aunque el nodo siga concedido: el estado manda.
      await asLogin(page, 'u-admin');
      const retirada = await page.request.post(`/api/modules/${slug}/status`, {
        data: { transition: 'retirar', motivo: 'La medida esta mal calculada.' },
      });
      expect(retirada.ok(), await retirada.text()).toBe(true);

      await asLogin(page, 'u-beto');
      expect((await page.request.get(`/api/modules/${slug}`)).status()).toBe(404);
      const navigation = await (await page.request.get('/api/navigation')).json();
      expect(JSON.stringify(navigation.arbol)).not.toContain(slug);
    } finally {
      // Se devuelve el equipo a su estado: las demas pruebas asumen lo que el seed concede.
      await asLogin(page, 'u-admin');
      await page.request.post('/api/admin/teams', {
        data: { accion: 'guardar', equipo: { ...esteTeam, grantedNodes: concedidosOriginales } },
      });
    }
  });

  test('retirar exige motivo', async ({ page }) => {
    const slug = newSlug('sin-motivo');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });

    await asLogin(page, 'u-admin');
    const respuesta = await page.request.post(`/api/modules/${slug}/status`, {
      data: { transition: 'devolver' },
    });
    expect(respuesta.status()).toBe(400);
  });
});

test.describe('cada transicion queda registrada (4.10.7)', () => {
  test('el panel de auditoria muestra la publicacion y quien la aprobo', async ({ page }) => {
    const slug = newSlug('auditado');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });

    await asLogin(page, 'u-admin');
    const publicado = await page.request.post(`/api/modules/${slug}/status`, {
      data: { transition: 'publicar' },
    });
    expect(publicado.ok()).toBe(true);

    const audit = await (await page.request.get('/api/admin/audit')).json();
    const dataRows = (audit.eventos as { entityType: string; action: string; actorId: string }[])
      .filter((e) => e.entityType === 'module');

    expect(dataRows.some((f) => f.action === 'publish' && f.actorId === 'u-admin')).toBe(true);
  });
});

/**
 * El historial de versiones publicadas — seccion 4.5.
 *
 * El modelo decia versionar desde el primer dia; lo que hacia era sobrescribir con un contador al
 * lado. La pregunta que esto responde es la que nadie podia responder: «¿que veia la gente antes
 * del cambio del martes?».
 */
test.describe('lo publicado se guarda, no se pisa (4.5)', () => {
  /** Publica el borrador y devuelve la version resultante. */
  async function publicar(page: import('@playwright/test').Page, slug: string): Promise<number> {
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });
    const respuesta = await page.request.post(`/api/modules/${slug}/status`, {
      data: { transition: 'publicar' },
    });
    expect(respuesta.ok(), await respuesta.text()).toBe(true);
    const { modulo } = (await respuesta.json()) as { modulo: { version: number } };
    return modulo.version;
  }

  /**
   * Anade un objeto a algo YA publicado y lo vuelve a publicar, por el camino que existe.
   *
   * Lo publicado no se devuelve a borrador para editarlo: se abre una REVISION, que es un
   * borrador aparte con su propio slug, y al aprobarla se publica sobre el original conservando
   * el suyo. Antes estas pruebas lo hacian con «devolver», que retiraba el modulo de la vista de
   * toda la institucion mientras se editaba.
   */
  async function segundaVersion(
    page: import('@playwright/test').Page,
    slug: string,
  ): Promise<string> {
    const abierta = await page.request.post(`/api/modules/${slug}/revision`, {});
    expect(abierta.ok(), await abierta.text()).toBe(true);
    const { modulo } = (await abierta.json()) as { modulo: { slug: string } };

    const actual = await (await page.request.get(`/api/modules/${modulo.slug}/edit`)).json();
    const pagina = actual.modulo.pages[0];
    await page.request.put(`/api/modules/${modulo.slug}/edit`, {
      data: {
        paginas: [
          {
            ...pagina,
            items: [
              ...pagina.items,
              {
                id: 'kpi-dos',
                position: { x: 3, y: 0, w: 3, h: 2 },
                instance: {
                  instanceId: 'kpi-dos',
                  objectId: 'tarjeta-kpi',
                  version: '1.0.0',
                  title: 'Resueltos',
                  binding: {
                    datasetId: 'casos-por-distrito-trimestre',
                    dimensions: [],
                    measures: ['CasosPendientes'],
                  },
                },
              },
            ],
          },
        ],
      },
    });
    return modulo.slug;
  }

  test('cada publicacion deja una fila, y volver atras publica una NUEVA', async ({ page }) => {
    const slug = newSlug('historial');
    await asLogin(page, 'u-admin');
    await objectDraft(page, slug);
    const primera = await publicar(page, slug);

    // Un segundo objeto, y otra publicacion. La revision se publica SOBRE el original.
    const segunda = await publicar(page, await segundaVersion(page, slug));
    expect(segunda).toBeGreaterThan(primera);

    await page.goto(`/admin/modules/${slug}/history`);
    await expect(page.getByTestId(`history-v${primera}`)).toBeVisible();
    await expect(page.getByTestId(`history-v${segunda}`)).toBeVisible();
    // La vigente no se puede restaurar sobre si misma: no se ofrece.
    await expect(page.getByTestId(`history-vigente-${segunda}`)).toBeVisible();
    await expect(page.getByTestId(`restore-v${segunda}`)).toHaveCount(0);

    // La foto vieja conserva SU contenido: un objeto, no los dos de ahora.
    await expect(page.getByTestId(`history-v${primera}`)).toContainText('1');
    await expect(page.getByTestId(`history-v${segunda}`)).toContainText('2');

    // Volver atras pide confirmacion con el numero delante, no un «¿seguro?» a secas.
    await page.getByTestId(`restore-v${primera}`).click();
    await page.getByTestId(`restore-confirm-v${primera}`).click();

    const tercera = segunda + 1;
    await expect(page.getByTestId(`history-v${tercera}`)).toBeVisible();
    await expect(page.getByTestId(`history-v${tercera}`)).toContainText(`restaurada de v${primera}`);
    // Y las dos anteriores siguen ahi: una vuelta atras no borra lo que hubo.
    await expect(page.getByTestId(`history-v${primera}`)).toBeVisible();
    await expect(page.getByTestId(`history-v${segunda}`)).toBeVisible();
  });

  test('la v1 de un modulo de la semilla tambien consta, y se puede MIRAR', async ({ page }) => {
    /*
     * Un modulo de la semilla nace publicado en la v1 sin pasar por `publicar`, asi que no dejaba
     * fila en el historial: la pantalla decia «no hay versiones» de algo que llevaba meses
     * sirviendose. Lo que estuvo publicado tiene que constar, lo publicara una persona o la
     * semilla.
     *
     * Y se puede VER sin restaurar. Antes lo unico que se ofrecia era restaurar —es decir,
     * publicar—: para saber si una version servia habia que ponerla en produccion y juzgar
     * despues.
     */
    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/audiencias/history');

    await expect(page.getByTestId('history-empty')).toHaveCount(0);
    await expect(page.getByTestId('history-v1')).toBeVisible();

    await page.getByTestId('ver-v1').click();
    // La disposicion es la de aquella version: se dibujan sus objetos, no una lista de metadatos.
    await expect(page.locator('.rejilla .grid__cell').first()).toBeVisible();
  });

  test('un Colaborador no ve el historial: es informacion de gobierno', async ({ page }) => {
    const slug = newSlug('historial-permiso');
    await asLogin(page, 'u-admin');
    await objectDraft(page, slug);
    await publicar(page, slug);

    await asLogin(page, 'u-ana');
    const respuesta = await page.request.get(`/api/modules/${slug}/history`);
    expect(respuesta.status()).toBe(403);
  });
});

/**
 * La cola de revision del panel — seccion 4.1.
 *
 * La aprobacion vivia en `/editor`, mezclada con los borradores propios de quien miraba, y el
 * motivo de la devolucion se pedia con `window.prompt`: un dialogo del navegador sin etiqueta,
 * sin tema y sin lector de pantalla, que 4.9 no admite.
 */
test.describe('cola de revision (4.1)', () => {
  test('dice quien propuso, que cambia, y deja decidir desde ahi', async ({ page }) => {
    const slug = newSlug('cola');

    // Un Administrador publica una primera version, para que haya con que comparar.
    await asLogin(page, 'u-admin');
    await objectDraft(page, slug);
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'publicar' } });

    /*
     * Y ahora se propone un cambio: un objeto mas, en una REVISION.
     *
     * Lo publicado no se devuelve a borrador para editarlo — eso lo retiraria de la vista de toda
     * la institucion mientras se edita—, y la revision es un borrador APARTE con su propio slug.
     * La cola habla de ese slug, que es el que espera decision.
     */
    const abierta = await page.request.post(`/api/modules/${slug}/revision`, {});
    expect(abierta.ok(), await abierta.text()).toBe(true);
    const { modulo: revision } = (await abierta.json()) as { modulo: { slug: string } };

    const actual = await (await page.request.get(`/api/modules/${revision.slug}/edit`)).json();
    const pagina = actual.modulo.pages[0];
    await page.request.put(`/api/modules/${revision.slug}/edit`, {
      data: {
        paginas: [
          {
            ...pagina,
            items: [
              ...pagina.items,
              {
                id: 'kpi-dos',
                position: { x: 3, y: 0, w: 3, h: 2 },
                instance: {
                  instanceId: 'kpi-dos',
                  objectId: 'tarjeta-kpi',
                  version: '1.0.0',
                  title: 'Resueltos',
                  binding: {
                    datasetId: 'casos-por-distrito-trimestre',
                    dimensions: [],
                    measures: ['CasosPendientes'],
                  },
                },
              },
            ],
          },
        ],
      },
    });
    await page.request.post(`/api/modules/${revision.slug}/status`, {
      data: { transition: 'enviar' },
    });

    // El aviso de la lista LLEVA a la cola: antes decia cuantas habia y no iba a ninguna parte.
    await page.goto('/admin/modules');
    await page.getByTestId('ir-a-pendientes').click();
    await expect(page).toHaveURL(/\/admin\/modules\/pending/);

    const fila = page.getByTestId(`pending-${revision.slug}`);
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('Juan F. Medina C.');
    // Y el cambio, en palabras: el objeto nuevo por su titulo, no por su identificador.
    await expect(page.getByTestId(`pending-diff-${revision.slug}`)).toContainText('Resueltos');

    await page.getByTestId(`approve-${revision.slug}`).click();
    await expect(page.getByTestId(`pending-${revision.slug}`)).toHaveCount(0);
  });

  test('devolver exige el motivo, en un campo de verdad y no en un prompt', async ({ page }) => {
    const slug = newSlug('devolver');
    await asLogin(page, 'u-ana');
    await objectDraft(page, slug);
    await page.request.post(`/api/modules/${slug}/status`, { data: { transition: 'enviar' } });

    await asLogin(page, 'u-admin');
    await page.goto('/admin/modules/pending');
    await page.getByTestId(`return-${slug}`).click();

    // El boton no se puede pulsar sin motivo: es la misma regla que el servidor exige, dicha
    // antes de gastar un viaje.
    await expect(page.getByTestId(`return-confirm-${slug}`)).toBeDisabled();
    await page.getByTestId(`return-reason-${slug}`).fill('Falta la comparacion con el trimestre anterior');
    await expect(page.getByTestId(`return-confirm-${slug}`)).toBeEnabled();
    await page.getByTestId(`return-confirm-${slug}`).click();

    await expect(page.getByTestId(`pending-${slug}`)).toHaveCount(0);

    // Y vuelve a ser un borrador de quien lo propuso. Se comprueba desde SU sesion: un borrador
    // es personal, y ni un Administrador lo ve — que es justamente otra prueba de este archivo.
    await asLogin(page, 'u-ana');
    const detalle = await (await page.request.get(`/api/modules/${slug}/edit`)).json();
    expect(detalle.modulo.status).toBe('borrador');
  });

  test('un Colaborador no entra a la cola: no es suya la decision', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/admin/modules/pending');
    await expect(page).toHaveURL(/admin-without-permission/);
  });
});

test.describe('el panel de filtros se personaliza sin escribir codigo (4.2)', () => {
  test('cada campo elige su orden, su recuento y sus formas de acotar', async ({ page }) => {
    /*
     * Lo que se comprueba no es que los controles esten, sino que lo elegido SOBREVIVA.
     *
     * El editor reescribia el selector entero al cambiar su tipo y solo conservaba la etiqueta:
     * el orden de los valores, el recuento y los botones de «Todos» desaparecian por cambiar otra
     * cosa. Es la clase de perdida que nadie denuncia porque parece que uno no lo habia puesto.
     */
    await asLogin(page, 'u-admin');
    await newModule(page, newSlug('panel-opciones'));
    await page.getByTestId('add-panel-de-filtros').click();
    await alDia(page);

    const id = await page
      .locator('[data-testid^="block-obj-"]')
      .first()
      .getAttribute('data-testid')
      .then((t) => (t ?? '').replace('block-', ''));

    // Un campo que filtrar, desde su pozo.
    await page.getByTestId(`well-${id}-filtros-anadir`).click();
    await page.getByTestId(`well-${id}-filtros-opcion-DimTribunal.Materia`).click();
    await alDia(page);

    await page.getByTestId('tab-formato').click();
    const campo = `selectores-${id}-DimTribunal.Materia`;

    await page.getByTestId(`${campo}-recuento`).check();
    await page.getByTestId(`${campo}-orden`).selectOption('alfabetico');
    await alDia(page);

    // Y ahora se cambia el TIPO de control, que es lo que antes se llevaba todo por delante.
    await page.getByTestId(campo).selectOption('lista');
    await alDia(page);

    await expect(page.getByTestId(`${campo}-recuento`)).toBeChecked();
    await expect(page.getByTestId(`${campo}-orden`)).toHaveValue('alfabetico');

    /*
     * Las formas de acotar solo se eligen en AVANZADO.
     *
     * En basico hay una sola —la lista de valores— y ofrecer las otras cinco seria configurar
     * algo que el campo no va a ensenar. El nivel es lo primero que se decide, y de el cuelga
     * todo lo demas.
     */
    await expect(page.getByTestId(`${campo}-modo-vacios`)).not.toBeVisible();
    await page.getByTestId(`${campo}-nivel`).selectOption('avanzado');
    await alDia(page);

    // Quitar formas de acotar deja el campo con las que queden, y nunca con ninguna.
    await page.getByTestId(`${campo}-modo-vacios`).uncheck();
    await alDia(page);
    await expect(page.getByTestId(`${campo}-modo-vacios`)).not.toBeChecked();
    await expect(page.getByTestId(`${campo}-modo-valores`)).toBeChecked();
  });
});
