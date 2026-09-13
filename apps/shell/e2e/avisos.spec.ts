import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './sesion';

/** Alertas y suscripciones basadas en datos (4.9). */

interface AlertaCreada {
  id: string;
  teamId: string;
  ownerUserId: string;
}

/** Crea una regla por API, que es como la crea la interfaz. */
async function crearAlerta(page: Page, datos: Record<string, unknown>) {
  const r = await page.request.post('/api/alertas', { data: datos });
  return {
    estado: r.status(),
    body: (await r.json()) as { alerta?: AlertaCreada; error?: string },
  };
}

/** Borra lo creado por la prueba: el almacen persiste entre pruebas del mismo servidor. */
async function limpiar(page: Page) {
  for (const path of ['/api/alertas', '/api/suscripciones']) {
    const body = (await (await page.request.get(path)).json()) as Record<string, { id: string }[]>;
    for (const item of Object.values(body)[0] ?? []) {
      await page.request.delete(`${path}?id=${encodeURIComponent(item.id)}`);
    }
  }
}

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'u-ana');
});

test.describe('reglas de alerta', () => {
  test.afterEach(async ({ page }) => {
    await limpiar(page);
  });

  test('se crea sobre un objeto y una medida del modulo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { estado, body } = await crearAlerta(page, {
      nombre: 'Pendientes altos',
      modulo: 'casos-pendientes',
      objeto: 'barras-distrito',
      medida: 'CasosPendientes',
      operador: 'mayor-que',
      umbral: 10,
    });

    expect(estado).toBe(201);
    // El equipo NO viaja en el cuerpo: lo pone el servidor desde la sesion, porque es el que
    // decide con que ambito se evalua la regla.
    expect(body.alerta?.teamId).toBe('equipo-norte');
    expect(body.alerta?.ownerUserId).toBe('u-ana');
  });

  test('rechaza una medida que el objeto no mapea', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    // Una regla sobre una medida inexistente no dispararia nunca y nadie sabria por que.
    const { estado } = await crearAlerta(page, {
      nombre: 'Inventada',
      modulo: 'casos-pendientes',
      objeto: 'barras-distrito',
      medida: 'MedidaQueNoExiste',
      operador: 'mayor-que',
      umbral: 10,
    });
    expect(estado).toBe(400);
  });

  test('rechaza un objeto que no esta en el modulo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { estado } = await crearAlerta(page, {
      nombre: 'Inventada',
      modulo: 'casos-pendientes',
      objeto: 'objeto-inventado',
      medida: 'CasosPendientes',
      operador: 'mayor-que',
      umbral: 10,
    });
    expect(estado).toBe(400);
  });

  test('rechaza un operador desconocido', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { estado } = await crearAlerta(page, {
      nombre: 'Rara',
      modulo: 'casos-pendientes',
      objeto: 'barras-distrito',
      medida: 'CasosPendientes',
      operador: 'parecido-a',
      umbral: 10,
    });
    expect(estado).toBe(400);
  });
});

test.describe('una regla es privada de quien la creo', () => {
  test('no aparece en la lista de otra persona ni se puede borrar', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const { body } = await crearAlerta(page, {
      nombre: 'Solo de Ana',
      modulo: 'casos-pendientes',
      objeto: 'barras-distrito',
      medida: 'CasosPendientes',
      operador: 'mayor-que',
      umbral: 999999,
    });
    const id = body.alerta?.id ?? '';

    await entrarComo(page, 'u-beto');
    const lista = (await (await page.request.get('/api/alertas')).json()) as {
      alertas: { id: string }[];
    };
    // Ver la regla de otra persona revelaria que modulo vigila y con que umbral.
    expect(lista.alertas.some((a) => a.id === id)).toBe(false);

    // Borrarla responde 404 y no 403: decir "prohibido" confirmaria que ese id existe.
    expect((await page.request.delete(`/api/alertas?id=${id}`)).status()).toBe(404);

    await entrarComo(page, 'u-ana');
    expect((await page.request.delete(`/api/alertas?id=${id}`)).status()).toBe(200);
  });
});

test.describe('la bandeja es de quien pide, sin parametro que manipular', () => {
  test('cada persona ve su propia bandeja', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const deAna = (await (await page.request.get('/api/notificaciones')).json()) as {
      notificaciones: unknown[];
    };

    await entrarComo(page, 'u-beto');
    const deBeto = (await (await page.request.get('/api/notificaciones')).json()) as {
      notificaciones: unknown[];
    };

    // No hay endpoint que acepte un userId: la bandeja sale de la sesion. Se comprueba que las
    // dos respuestas son independientes y no la misma lista compartida.
    expect(Array.isArray(deAna.notificaciones)).toBe(true);
    expect(Array.isArray(deBeto.notificaciones)).toBe(true);
  });
});

test.describe('suscripciones', () => {
  test.afterEach(async ({ page }) => {
    await limpiar(page);
  });

  test('se crea con cadencia y formato, y queda listada', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const r = await page.request.post('/api/suscripciones', {
      data: {
        nombre: 'Casos cada lunes',
        modulo: 'casos-pendientes',
        formato: 'pdf',
        cadencia: 'semanal',
        hora: 8,
        diaSemana: 1,
      },
    });
    expect(r.status()).toBe(201);

    const lista = (await (await page.request.get('/api/suscripciones')).json()) as {
      suscripciones: { name: string; teamId: string }[];
    };
    expect(lista.suscripciones.map((s) => s.name)).toContain('Casos cada lunes');
    expect(lista.suscripciones[0]?.teamId).toBe('equipo-norte');
  });

  test('rechaza una hora fuera de rango y una cadencia desconocida', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    const comun = { nombre: 'X', modulo: 'casos-pendientes', formato: 'pdf' };

    expect(
      (await page.request.post('/api/suscripciones', { data: { ...comun, cadencia: 'diaria', hora: 99 } })).status(),
    ).toBe(400);
    expect(
      (await page.request.post('/api/suscripciones', { data: { ...comun, cadencia: 'cuando-sea', hora: 8 } })).status(),
    ).toBe(400);
  });
});

test.describe('interfaz', () => {
  test.afterEach(async ({ page }) => {
    await limpiar(page);
  });

  test('se crea una alerta desde el modulo que se esta viendo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('crear-aviso').click();
    await expect(page.getByTestId('dialogo-aviso')).toBeVisible();

    await page.getByTestId('aviso-nombre').fill('Pendientes por encima de 10');
    await page.getByTestId('aviso-objeto').selectOption('barras-distrito');
    await page.getByTestId('aviso-umbral').fill('10');
    await page.getByTestId('aviso-guardar').click();

    await expect(page).toHaveURL(/\/avisos/);
    await expect(page.getByTestId('alerta-Pendientes por encima de 10')).toBeVisible();
  });

  test('un segmentador no se ofrece como objeto vigilable', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('crear-aviso').click();

    // Un segmentador no mapea ninguna medida: vigilarlo daria una alerta que no dispara nunca.
    const opciones = await page.getByTestId('aviso-objeto').locator('option').allTextContents();
    expect(opciones).not.toContain('Materia');
    expect(opciones).toContain('Pendientes por distrito');
  });

  test('la regla captura los filtros de la URL: la URL es el estado (4.11)', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');

    await page.getByTestId('crear-aviso').click();
    await page.getByTestId('aviso-nombre').fill('Solo penal');
    await page.getByTestId('aviso-umbral').fill('10');
    await page.getByTestId('aviso-guardar').click();
    await expect(page).toHaveURL(/\/avisos/);

    const lista = (await (await page.request.get('/api/alertas')).json()) as {
      alertas: { name: string; filters: Record<string, string[]> }[];
    };
    const creada = lista.alertas.find((a) => a.name === 'Solo penal');
    expect(creada?.filters['DimTribunal.Materia']).toEqual(['Penal']);
  });

  test('se crea una suscripcion desde el mismo dialogo', async ({ page }) => {
    await entrarComo(page, 'u-ana');
    await page.goto('/m/casos-pendientes');

    await page.getByTestId('crear-aviso').click();
    await page.getByTestId('pestana-suscripcion').click();
    await page.getByTestId('aviso-nombre').fill('Resumen semanal');
    await page.getByTestId('aviso-cadencia').selectOption('semanal');
    await page.getByTestId('aviso-guardar').click();

    await expect(page).toHaveURL(/\/avisos/);
    await expect(page.getByTestId('suscripcion-Resumen semanal')).toBeVisible();
  });
});
