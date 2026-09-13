import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/** Editor de modulos y ciclo de vida — secciones 4.1, 4.2 y criterios de la seccion 9. */

const nuevoSlug = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

/** Crea un borrador con un objeto valido, por API, que es lo que hace la interfaz. */
async function borradorConObjeto(
  page: import('@playwright/test').Page,
  slug: string,
): Promise<void> {
  const creado = await page.request.post('/api/modulos', {
    data: { nombre: `Modulo ${slug}`, slug },
  });
  expect(creado.ok(), await creado.text()).toBe(true);

  const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };
  const pagina = modulo.pages[0];

  const guardado = await page.request.put(`/api/modulos/${slug}/edicion`, {
    data: {
      paginas: [
        {
          ...pagina,
          slug: 'general',
          name: 'General',
          items: [
            {
              id: 'kpi',
              position: { x: 0, y: 0, w: 3, h: 2 },
              instance: {
                instanceId: 'kpi',
                objectId: 'tarjeta-kpi',
                version: '1.0.0',
                title: 'Pendientes',
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
  expect(guardado.ok(), await guardado.text()).toBe(true);
}

test.describe('quien entra al editor (4.10.1)', () => {
  test('un Visor no ve el enlace y la API le responde 403', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('enlace-editor')).toHaveCount(0);

    // Lo que importa no es el enlace ausente: crear modulos a mano tampoco debe funcionar.
    const respuesta = await page.request.post('/api/modulos', {
      data: { nombre: 'Intento', slug: nuevoSlug('intento-visor') },
    });
    expect(respuesta.status()).toBe(403);
  });

  test('un Visor que pide la pagina no ve el editor', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/editor');
    await expect(page.getByTestId('sin-permiso-editor')).toBeVisible();
    await expect(page.getByTestId('lista-modulos')).toHaveCount(0);
  });

  test('un Colaborador si entra', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/');
    await expect(page.getByTestId('enlace-editor')).toBeVisible();
    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Editor de modulos' })).toBeVisible();
  });
});

test.describe('un modulo se construye con objetos prediseñados, no con consultas (4.2)', () => {
  test('crear un borrador y colocarle un objeto desde el catalogo', async ({ page }) => {
    const slug = nuevoSlug('construido');
    await entrarComo(page, 'u-ana');
    await page.goto('/editor');

    await page.getByTestId('nuevo-modulo-nombre').fill(`Modulo ${slug}`);
    await page.getByTestId('nuevo-modulo-slug').fill(slug);
    await page.getByTestId('crear-modulo').click();

    await expect(page.getByTestId(`fila-${slug}`)).toBeVisible();

    await page.goto(`/editor/${slug}`);
    await expect(page.getByTestId('lienzo-vacio')).toBeVisible();

    // El catalogo ofrece objetos, no una caja donde escribir SQL. Comprobar que NO hay donde
    // escribir una consulta es la mitad del criterio de 4.2 que importa.
    await expect(page.getByTestId('anadir-tarjeta-kpi')).toBeVisible();
    await expect(page.getByTestId('anadir-barras')).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);

    await page.getByTestId('anadir-tarjeta-kpi').click();

    // El objeto aparece EN EL LIENZO, dibujado, y queda elegido: el panel salta a «Datos», que es
    // lo que se va a configurar a continuacion.
    await expect(page.locator('[data-testid^="bloque-obj-"]')).toHaveCount(1);
    await expect(page.getByTestId('lienzo-vacio')).toHaveCount(0);
    await expect(page.getByTestId('pestana-datos')).toHaveAttribute('aria-selected', 'true');
  });

  test('los complementos no se pueden colocar sueltos en la rejilla', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const slug = nuevoSlug('sin-complementos');
    await borradorConObjeto(page, slug);
    await page.goto(`/editor/${slug}`);

    // 'tooltip-explicativo' y 'tabla-de-datos' son adjuntables: acompañan a otro objeto. La
    // validacion los rechaza como elementos de la rejilla, asi que tampoco se ofrecen.
    await expect(page.getByTestId('anadir-tooltip-explicativo')).toHaveCount(0);
    await expect(page.getByTestId('anadir-tabla-de-datos')).toHaveCount(0);
  });

  test('un objeto con un campo inexistente se marca ROTO y el modulo se sigue editando', async ({
    page,
  }) => {
    await entrarComo(page, 'u-ana');
    const slug = nuevoSlug('roto');
    await borradorConObjeto(page, slug);

    // Se rompe el mapeo por API, como si la fuente hubiera retirado el campo.
    const actual = await (await page.request.get(`/api/modulos/${slug}/edicion`)).json();
    actual.modulo.pages[0].items[0].instance.binding.measures = ['MedidaRetirada'];
    await page.request.put(`/api/modulos/${slug}/edicion`, {
      data: { paginas: actual.modulo.pages },
    });

    await page.goto(`/editor/${slug}`);

    // El bloque se dibuja MARCADO ROTO en el lienzo, con su problema, y el modulo se sigue
    // editando alrededor. Es literalmente lo que pide 4.2: no fallar en silencio.
    const block = page.getByTestId('bloque-kpi');
    await expect(block).toBeVisible();
    await expect(block.getByTestId('objeto-roto')).toBeVisible();
    await expect(page.getByTestId('problemas-kpi')).toContainText('MedidaRetirada');
    await expect(page.getByTestId('editor-bloqueos')).toBeVisible();
  });
});

test.describe('borrador -> pendiente -> publicado (4.1)', () => {
  test('un Colaborador propone y un Administrador publica', async ({ page }) => {
    const slug = nuevoSlug('flujo');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);

    await page.goto('/editor');
    await page.getByTestId(`enviar-${slug}`).click();
    await expect(page.getByTestId(`fila-${slug}`)).toContainText('Pendiente de aprobacion');

    // Ana no puede publicar lo que ella misma propuso.
    await expect(page.getByTestId(`publicar-${slug}`)).toHaveCount(0);
    const intento = await page.request.post(`/api/modulos/${slug}/estado`, {
      data: { transicion: 'publicar' },
    });
    expect(intento.status()).toBe(403);

    await entrarComo(page, 'u-admin');
    await page.goto('/editor');
    await page.getByTestId(`publicar-${slug}`).click();
    await expect(page.getByTestId(`fila-${slug}`)).toContainText('Publicado');
  });

  test('un modulo con problemas no se puede proponer', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const slug = nuevoSlug('con-problemas');
    await page.request.post('/api/modulos', { data: { nombre: 'Vacio', slug } });

    // Sin objetos no hay nada roto, asi que se rompe uno a proposito.
    const actual = await (await page.request.get(`/api/modulos/${slug}/edicion`)).json();
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
    await page.request.put(`/api/modulos/${slug}/edicion`, { data: { paginas: actual.modulo.pages } });

    const respuesta = await page.request.post(`/api/modulos/${slug}/estado`, {
      data: { transicion: 'enviar' },
    });
    expect(respuesta.status()).toBe(422);

    await page.goto('/editor');
    // Y el boton no se ofrece: la pantalla dice por que antes de que nadie lo intente.
    const enviar = page.getByTestId(`enviar-${slug}`);
    await expect(enviar).toBeDisabled();
    await expect(page.getByTestId(`bloqueos-${slug}`)).toBeVisible();

    // Y ademas SE VE deshabilitado. Sin estilo propio se dibujaba igual que un enlace activo
    // —subrayado y en azul—, asi que quien lo pulsaba no entendia por que no pasaba nada y lo
    // volvia a pulsar. Un control inerte que parece pulsable es peor que uno ausente.
    await expect(enviar).toHaveCSS('cursor', 'not-allowed');
    await expect(enviar).not.toHaveCSS('text-decoration-line', 'underline');
  });

  test('no se puede saltar la aprobacion', async ({ page }) => {
    await entrarComo(page, 'u-admin');
    const slug = nuevoSlug('sin-escalas');
    await borradorConObjeto(page, slug);

    const respuesta = await page.request.post(`/api/modulos/${slug}/estado`, {
      data: { transicion: 'publicar' },
    });
    expect(respuesta.status()).toBe(409);
  });
});

test.describe('un borrador es personal (criterio de la seccion 9)', () => {
  test('no se ve desde otra cuenta, ni por la lista ni por URL directa', async ({ page }) => {
    const slug = nuevoSlug('personal');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);

    await entrarComo(page, 'u-beto');
    // Un Visor ni siquiera entra al editor; lo que se comprueba es la API, que es donde
    // importa, y la pagina del modulo.
    expect((await page.request.get(`/api/modulos/${slug}/edicion`)).status()).toBe(404);
    expect((await page.request.get(`/api/modulos/${slug}`)).status()).toBe(404);
    expect((await page.goto(`/m/${slug}`))?.status()).toBe(404);
  });

  test('ni un Administrador ve el borrador ajeno', async ({ page }) => {
    const slug = nuevoSlug('ni-admin');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);

    await entrarComo(page, 'u-admin');
    expect((await page.request.get(`/api/modulos/${slug}/edicion`)).status()).toBe(404);

    // Cuando se propone, si: revisar a ciegas no es revisar.
    await entrarComo(page, 'u-ana');
    await page.request.post(`/api/modulos/${slug}/estado`, { data: { transicion: 'enviar' } });
    await entrarComo(page, 'u-admin');
    expect((await page.request.get(`/api/modulos/${slug}/edicion`)).status()).toBe(200);
  });

  test('otro Colaborador no puede reescribirlo', async ({ page }) => {
    const slug = nuevoSlug('ajeno');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);

    // u-admin tiene el permiso general de editar borradores y aun asi no puede tocar este.
    await entrarComo(page, 'u-admin');
    const respuesta = await page.request.put(`/api/modulos/${slug}/edicion`, {
      data: { nombre: 'Reescrito' },
    });
    expect(respuesta.status()).toBe(404);
  });
});

test.describe('retirar un modulo lo quita de la vista de todos', () => {
  test('publicar lo cuelga de la organizacion general, y conceder el nodo lo hace visible', async ({
    page,
  }) => {
    const slug = nuevoSlug('retirado');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);
    const detalle = await (await page.request.get(`/api/modulos/${slug}/edicion`)).json();
    const moduleId = detalle.modulo.moduleId as string;
    await page.request.post(`/api/modulos/${slug}/estado`, { data: { transicion: 'enviar' } });

    await entrarComo(page, 'u-admin');
    await page.request.post(`/api/modulos/${slug}/estado`, { data: { transicion: 'publicar' } });

    // Publicar lo cuelga en la RAIZ del arbol, que es el sitio mas restrictivo: existe en la
    // organizacion general y todavia no esta concedido a ningun equipo. Que publicar no conceda
    // acceso es deliberado — conceder es 4.10.6 y lo decide un Administrador.
    const arbol = (await (await page.request.get('/api/admin/arbol')).json()) as {
      nodes: { id: string }[];
    };
    expect(arbol.nodes.some((n) => n.id === `nodo-${moduleId}`)).toBe(true);

    await entrarComo(page, 'u-beto');
    expect((await page.request.get(`/api/modulos/${slug}`)).status()).toBe(404);

    // Se concede el nodo al equipo de Beto y entonces si lo ve.
    await entrarComo(page, 'u-admin');
    const equipos = await (await page.request.get('/api/admin/equipos')).json();
    const equipoEste = (equipos.equipos as { id: string; grantedNodes: string[] }[]).find(
      (e) => e.id === 'equipo-este',
    );
    if (!equipoEste) throw new Error('fixture inesperado');
    const concedidosOriginales = [...equipoEste.grantedNodes];

    try {
      await page.request.post('/api/admin/equipos', {
        data: {
          accion: 'guardar',
          equipo: { ...equipoEste, grantedNodes: [...concedidosOriginales, `nodo-${moduleId}`] },
        },
      });

      await entrarComo(page, 'u-beto');
      expect((await page.request.get(`/api/modulos/${slug}`)).status()).toBe(200);

      // Y al retirarlo deja de servir, aunque el nodo siga concedido: el estado manda.
      await entrarComo(page, 'u-admin');
      const retirada = await page.request.post(`/api/modulos/${slug}/estado`, {
        data: { transicion: 'devolver', motivo: 'La medida esta mal calculada.' },
      });
      expect(retirada.ok(), await retirada.text()).toBe(true);

      await entrarComo(page, 'u-beto');
      expect((await page.request.get(`/api/modulos/${slug}`)).status()).toBe(404);
      const navegacion = await (await page.request.get('/api/navegacion')).json();
      expect(JSON.stringify(navegacion.arbol)).not.toContain(slug);
    } finally {
      // Se devuelve el equipo a su estado: las demas pruebas asumen lo que el seed concede.
      await entrarComo(page, 'u-admin');
      await page.request.post('/api/admin/equipos', {
        data: { accion: 'guardar', equipo: { ...equipoEste, grantedNodes: concedidosOriginales } },
      });
    }
  });

  test('retirar exige motivo', async ({ page }) => {
    const slug = nuevoSlug('sin-motivo');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);
    await page.request.post(`/api/modulos/${slug}/estado`, { data: { transicion: 'enviar' } });

    await entrarComo(page, 'u-admin');
    const respuesta = await page.request.post(`/api/modulos/${slug}/estado`, {
      data: { transicion: 'devolver' },
    });
    expect(respuesta.status()).toBe(400);
  });
});

test.describe('cada transicion queda registrada (4.10.7)', () => {
  test('el panel de auditoria muestra la publicacion y quien la aprobo', async ({ page }) => {
    const slug = nuevoSlug('auditado');
    await entrarComo(page, 'u-ana');
    await borradorConObjeto(page, slug);
    await page.request.post(`/api/modulos/${slug}/estado`, { data: { transicion: 'enviar' } });

    await entrarComo(page, 'u-admin');
    const publicado = await page.request.post(`/api/modulos/${slug}/estado`, {
      data: { transicion: 'publicar' },
    });
    expect(publicado.ok()).toBe(true);

    const audit = await (await page.request.get('/api/admin/auditoria')).json();
    const dataRows = (audit.eventos as { entityType: string; action: string; actorId: string }[])
      .filter((e) => e.entityType === 'module');

    expect(dataRows.some((f) => f.action === 'publish' && f.actorId === 'u-admin')).toBe(true);
  });
});
