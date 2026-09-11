import { expect, test } from '@playwright/test';
import { entrarComo } from './sesion';

/**
 * Panel de administracion — verificacion en navegador (4.10.8).
 *
 * Cada bloque corresponde a un criterio de aceptacion de la seccion 9.
 *
 * Nota sobre el estado: el almacen de gobierno es del proceso y las pruebas corren en serie
 * contra un unico servidor, asi que las escrituras PERSISTEN entre pruebas. Por eso cada una
 * toca entidades distintas, y las que no pueden evitar compartir asertan sobre lo que es
 * estable (la cadena de carpetas que origina un ambito) y no sobre valores que otra prueba
 * pueda haber cambiado.
 */

test.describe('acceso al panel: ocultar no es proteger (criterio de la seccion 9)', () => {
  test('un Visor no ve el enlace y la API le responde 403', async ({ page }) => {
    await entrarComo(page, 'u-beto');
    await page.goto('/');
    await expect(page.getByTestId('enlace-admin')).toHaveCount(0);

    // Lo que importa no es el enlace ausente, sino que llamar a la API a mano no sirva.
    for (const ruta of ['/api/admin/arbol', '/api/admin/equipos', '/api/admin/auditoria']) {
      expect((await page.request.get(ruta)).status()).toBe(403);
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
    const cuerpo = await respuesta.json();
    expect(cuerpo.detail.dimensiones.join(' ')).toContain('Laboral');
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
    const tabla = page.getByTestId('tabla-auditoria');
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
    const selector = page.getByTestId('anadir-dimension');
    await expect(selector).toBeVisible();
    const opciones = await selector.locator('option').allTextContents();
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
    const cuerpo = await previo.json();
    expect(cuerpo.cambiaElAmbito).toBe(true);
    expect(cuerpo.moduleIds).toContain('audiencias');
  });

  test('el arbol se reorganiza SOLO CON TECLADO, sin arrastrar', async ({ page }) => {
    // 4.10.8 pide arrastrar y soltar; 4.9 dice que la accesibilidad no se pospone. Los dos
    // gestos llaman a la misma operacion, asi que basta con comprobar el accesible.
    await page.goto('/admin/arbol');
    await page.getByTestId('nodo-nodo-m-audiencias').click();
    await page.getByTestId('mover-nodo-m-audiencias').selectOption('nodo-este');

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
    await expect(page.getByTestId('tabla-auditoria')).toContainText('nodo-m-audiencias');
  });

  test('el movimiento cambia el ambito efectivo de inmediato', async ({ page }) => {
    // Tras la prueba anterior, 'audiencias' vive bajo Distrito Este.
    const r = await page.request.get(
      '/api/admin/quien-ve-que?userId=u-ana&teamId=equipo-norte&moduleId=audiencias',
    );
    const cuerpo = await r.json();
    const origenes = (cuerpo.pasos as { origen: string }[]).map((p) => p.origen);
    expect(origenes).toContain('Distrito Este');
    expect(origenes).not.toContain('Distrito Norte');
  });

  test('la papelera conserva lo eliminado y permite restaurarlo', async ({ page }) => {
    await page.goto('/admin/arbol');
    await page.getByTestId('nodo-nodo-m-nacional').click();
    await page.getByTestId('papelera-nodo-m-nacional').click();

    await expect(page.getByTestId('papelera')).toBeVisible();
    await expect(page.getByTestId('papelera')).toContainText('Estadisticas nacionales');

    await page.getByTestId('restaurar-nodo-m-nacional').click();
    await expect(page.getByTestId('nodo-nodo-m-nacional')).toBeVisible();
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
    const cuerpo = await r.json();
    expect(cuerpo.existeEnElArbol).toBe(true);
    expect(cuerpo.tieneAcceso).toBe(false);
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

    const equipoEste = await page.request
      .get('/api/admin/equipos')
      .then((r) => r.json())
      .then((c) => c.equipos.find((t: { id: string }) => t.id === 'equipo-este'));

    await page.request.post('/api/admin/equipos', {
      data: { accion: 'guardar', equipo: { ...equipoEste, assignedPackageId: 'pkg-prueba' } },
    });

    // El panel lo señala explicitamente en vez de ocultarlo sin aviso.
    await page.goto('/admin/paquetes');
    await expect(page.getByTestId('paquete-problemas-pkg-prueba')).toBeVisible();
    await expect(page.getByTestId('paquete-problemas-pkg-prueba')).toContainText('casos-pendientes');

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
    const despues = await page.request.get('/api/admin/equipos').then((r) => r.json());
    const este2 = despues.equipos.find((t: { id: string }) => t.id === 'equipo-este');
    expect(este2.members.some((m: { userId: string }) => m.userId === 'u-nuevo')).toBe(false);
  });
});
