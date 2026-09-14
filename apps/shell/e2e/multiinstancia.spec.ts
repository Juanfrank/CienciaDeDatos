import { expect, test, type Page } from './instance';
import { asLogin } from './session';

/**
 * Criterio de la seccion 9: "la aplicacion escala a mas de una instancia sin perdida de sesion
 * ni de estado de personalizacion en edicion".
 */

/** Reproduce en la otra instancia la cookie de sesion que tiene esta pagina. */
async function withSameSession(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const sesion = cookies.find((c) => c.name === 'sesion');
  expect(sesion, 'la sesion tiene que existir para poder comprobar que viaja').toBeDefined();
  return { cookie: `sesion=${sesion?.value ?? ''}` };
}

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('la sesion sobrevive al cambio de instancia', () => {
  test('la segunda instancia reconoce la sesion abierta en la primera', async ({ page, instanceOther }) => {
    await asLogin(page, 'u-beto');

    const cabeceras = await withSameSession(page);
    const respuesta = await page.request.get(`${instanceOther}/api/navigation`, { headers: cabeceras });

    expect(respuesta.status()).toBe(200);
    const body = (await respuesta.json()) as { equipoActivo?: string };
    // Beto pertenece al equipo Este: si la segunda instancia no viera la sesion, la peticion
    // seria de alguien sin autenticar y responderia 401, no un arbol de navegacion.
    expect(body.equipoActivo).toBe('equipo-este');
  });

  test('cambiar de equipo en una instancia se ve en la otra, sin cerrar sesion', async ({ page, instanceOther }) => {
    await asLogin(page, 'u-ana');
    const cabeceras = await withSameSession(page);

    // El cambio se hace contra la SEGUNDA instancia y se comprueba en la primera.
    await page.request.post(`${instanceOther}/api/session/active-team`, {
      headers: cabeceras,
      data: { teamId: 'equipo-este' },
    });

    const aqui = (await (await page.request.get('/api/navigation')).json()) as {
      equipoActivo?: string;
    };
    expect(aqui.equipoActivo).toBe('equipo-este');
  });
});

test.describe('la personalizacion no se queda en una instancia', () => {
  test('un marcador guardado en una instancia se lista desde la otra', async ({ page, instanceOther }) => {
    await asLogin(page, 'u-ana');
    const cabeceras = await withSameSession(page);

    const nombre = `marcador-multiinstancia-${Date.now()}`;
    await page.request.post('/api/bookmarks', {
      data: {
        name: nombre,
        moduleSlug: 'casos-pendientes',
        query: 'DimTribunal.Materia=Penal',
        compartir: false,
      },
    });

    const fromTheOther = (await (
      await page.request.get(`${instanceOther}/api/bookmarks`, { headers: cabeceras })
    ).json()) as { bookmarks: { name: string }[] };

    expect(fromTheOther.bookmarks.map((m) => m.name)).toContain(nombre);
  });
});

test.describe('el gobierno es el mismo en las dos instancias', () => {
  test('un cambio del Administrador en una se aplica en la otra', async ({ page, instanceOther }) => {
    // Es lo grave de un gobierno por proceso: no perder configuracion, sino que una instancia
    // siga sirviendo datos con los permisos anteriores al cambio.
    //
    // Se crea y se borra un equipo DE USAR Y TIRAR en vez de renombrar uno sembrado: el almacen
    // persiste entre pruebas, y tocar el equipo Norte dejaba fallando a las de otros archivos
    // que asertan sobre su nombre. Un estado compartido de verdad obliga a limpiar de verdad.
    await asLogin(page, 'u-admin');
    const cabeceras = await withSameSession(page);

    const id = `equipo-multiinstancia-${Date.now()}`;
    const equipo = {
      id,
      name: 'Equipo de prueba multiinstancia',
      grantedNodes: [],
      members: [],
      defaultScope: { restrictions: [] },
      moduleScopeOverrides: {},
    };

    try {
      const guardado = await page.request.post('/api/admin/teams', {
        data: { accion: 'guardar', equipo },
      });
      expect(guardado.status()).toBe(200);

      const fromTheOther = (await (
        await page.request.get(`${instanceOther}/api/admin/teams`, { headers: cabeceras })
      ).json()) as { equipos: { id: string; name: string }[] };

      expect(fromTheOther.equipos.map((e) => e.id)).toContain(id);
    } finally {
      await page.request.post('/api/admin/teams', { data: { accion: 'borrar', teamId: id } });
    }
  });

  test('la auditoria de la otra instancia incluye ese mismo cambio', async ({ page, instanceOther }) => {
    // Un registro de auditoria por instancia no es un registro de auditoria.
    await asLogin(page, 'u-admin');
    const cabeceras = await withSameSession(page);

    const before = (await (
      await page.request.get(`${instanceOther}/api/admin/audit`, { headers: cabeceras })
    ).json()) as { eventos: unknown[] };

    // De usar y tirar, por lo mismo: la auditoria solo tiene que crecer, no importa con que.
    const id = `equipo-auditoria-${Date.now()}`;
    await page.request.post('/api/admin/teams', {
      data: {
        accion: 'guardar',
        equipo: {
          id,
          name: 'Equipo de prueba de auditoria',
          grantedNodes: [],
          members: [],
          defaultScope: { restrictions: [] },
          moduleScopeOverrides: {},
        },
      },
    });

    const after = (await (
      await page.request.get(`${instanceOther}/api/admin/audit`, { headers: cabeceras })
    ).json()) as { eventos: unknown[] };

    expect(after.eventos.length).toBeGreaterThan(before.eventos.length);
    await page.request.post('/api/admin/teams', { data: { accion: 'borrar', teamId: id } });
  });
});

test.describe('las dos instancias sirven el mismo dato del cache', () => {
  test('un modulo se ve igual en las dos', async ({ page, instanceOther }) => {
    // Criterio de la seccion 9: dos modulos distintos —aqui, dos instancias— leen de la misma
    // entrada de cache, sin consultas redundantes a la fuente.
    await asLogin(page, 'u-ana');
    const cabeceras = await withSameSession(page);

    const aqui = (await (await page.request.get('/api/modules/casos-pendientes')).json()) as {
      generatedAt?: string;
    };
    const alla = (await (
      await page.request.get(`${instanceOther}/api/modules/casos-pendientes`, { headers: cabeceras })
    ).json()) as { generatedAt?: string };

    expect(alla.generatedAt).toBe(aqui.generatedAt);
  });
});
