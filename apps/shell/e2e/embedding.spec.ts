import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './instance';
import { asLogin } from './session';

/** Incorporacion en otros portales — seccion 4.9. */

/** Toda prueba empieza con una sesion de verdad; las que necesiten otra persona la piden. */
test.beforeEach(async ({ page }) => {
  await asLogin(page, 'u-ana');
});

test.describe('politica de enmarcado', () => {
  test('ninguna pantalla normal se puede enmarcar', async ({ page }) => {
    // Denegar por defecto cierra el clickjacking en toda la aplicacion —incluido el panel de
    // administracion— sin que haya que acordarse de ninguna pantalla.
    for (const path of ['/m/casos-pendientes', '/admin', '/notices']) {
      const respuesta = await page.request.get(path);
      expect(respuesta.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(respuesta.headers()['x-frame-options']).toBe('DENY');
    }
  });

  test('sin portales configurados, la ruta de incrustacion tampoco se enmarca', async ({ page }) => {
    // El servidor de pruebas corre sin EMBED_ALLOWED_ORIGINS: es el caso de la configuracion
    // olvidada, y tiene que fallar cerrado.
    const respuesta = await page.request.get('/embed/m/casos-pendientes');
    expect(respuesta.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});

test.describe('la vista incrustada aplica el mismo ambito', () => {
  test('muestra los datos del equipo de QUIEN MIRA, no del que la incrusto', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes');
    await expect(page.getByTestId('module-title')).toHaveText('Casos pendientes');
    await expect(page.getByTestId('tabla')).toContainText('Distrito Norte');
    await expect(page.getByTestId('tabla')).not.toContainText('Distrito Este');
  });

  test('un modulo no concedido al equipo tampoco se incrusta', async ({ page }) => {
    await asLogin(page, 'u-ana');
    // 'estadisticas' vive fuera de lo concedido al equipo Norte. La ruta de incrustacion no
    // puede ser el atajo que se salta esa comprobacion.
    const respuesta = await page.goto('/embed/m/estadisticas');
    expect(respuesta?.status()).toBe(404);
  });

  test('un filtro fuera del ambito no amplia lo incrustado', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes?DimTribunal.Distrito=Distrito+Este');
    await expect(page.getByTestId('tabla')).not.toContainText('Distrito Este');
  });
});

test.describe('la vista incrustada conserva lo que la hace interpretable', () => {
  test('lleva procedencia (4.6), frescura (4.8) e identidad institucional', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes');

    // Dentro de otro portal es donde mas falta hacen: quien mira ya no tiene alrededor la
    // aplicacion que le diga de donde salen las cifras ni de cuando son.
    await expect(page.getByTestId('procedencia')).toContainText('Vista institucional oficial');
    await expect(page.getByTestId('frescura')).toContainText('Datos actualizados');
    await expect(page.locator('.embedded__institucion')).toContainText('Poder Judicial');
  });

  test('no lleva los controles que sacan de la vista', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes');

    for (const control of ['exportar', 'create-notice', 'incrustar']) {
      await expect(page.getByTestId(control)).toHaveCount(0);
    }
    // El arbol de navegacion tampoco: compite con la navegacion del portal anfitrion.
    await expect(page.getByTestId('nav-audiencias')).toHaveCount(0);
  });

  test('el enlace de vuelta abre en pestana nueva', async ({ page }) => {
    // Navegar en el mismo marco dejaria la aplicacion entera metida en un hueco del portal.
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes');
    await expect(page.getByTestId('see-completo')).toHaveAttribute('target', '_blank');
  });

  test('el filtrado cruzado sigue funcionando dentro del marco', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes');
    await page.getByTestId('slicer-Penal').click();
    await expect(page).toHaveURL(/DimTribunal\.Materia=Penal/);
  });

  test('no tiene infracciones WCAG 2.1 AA', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/embed/m/casos-pendientes');

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe('el codigo de incrustacion se copia desde la vista', () => {
  test('lleva la URL de incrustacion con los filtros de delante', async ({ page }) => {
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes?DimTribunal.Materia=Penal');

    await page.getByTestId('incrustar').click();
    const code = await page.getByTestId('embed-code').inputValue();

    expect(code).toContain('/embed/m/casos-pendientes');
    expect(code).toContain('DimTribunal.Materia=Penal');
    expect(code).toContain('allow=""');
  });

  test('avisa de que la vista incrustada NO es publica', async ({ page }) => {
    // Quien pega el codigo espera que funcione para cualquier visitante del portal. Decirlo
    // aqui evita que se descubra en produccion y se pida "un modo publico" para arreglarlo.
    await asLogin(page, 'u-ana');
    await page.goto('/m/casos-pendientes');
    await page.getByTestId('incrustar').click();

    await expect(page.getByTestId('embed-notice')).toContainText('iniciado sesion');
    await expect(page.getByTestId('embed-notice')).toContainText('su propio');
  });
});
