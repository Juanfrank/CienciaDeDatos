import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '@app/access-control';
import { ICON_PREFIX, disabledResources, setResourceDisabled } from './catalogo';
import { editorPalette } from './editor';
import { borrar } from './almacenCompartido';
import { KEY_CATALOG } from './catalogo';

/**
 * Deshabilitar un recurso APAGA algo — seccion 4.5.
 *
 * Es la prueba que faltaba y por la que el interruptor no hacia nada. `disabledResources` estaba
 * escrito, la tabla lo dibujaba y el boton lo escribia; la paleta del editor no lo consultaba. Un
 * interruptor que no apaga es peor que no tenerlo: quien lo pulsa se queda creyendo que ya esta.
 */

const admin: Actor = { userId: 'u-admin', role: 'administrador' };

beforeEach(async () => {
  await borrar(KEY_CATALOG);
});

describe('deshabilitar un objeto', () => {
  it('lo quita de la paleta del editor', async () => {
    const antes = await editorPalette();
    expect(antes.objetos.map((o) => o.objectId)).toContain('pastel');

    await setResourceDisabled(admin, 'pastel', true);

    const despues = await editorPalette();
    expect(despues.objetos.map((o) => o.objectId)).not.toContain('pastel');
    // Y solo ese: deshabilitar uno no puede llevarse por delante a los demas.
    expect(despues.objetos.length).toBe(antes.objetos.length - 1);
  });

  it('y volver a habilitarlo lo devuelve', async () => {
    await setResourceDisabled(admin, 'pastel', true);
    await setResourceDisabled(admin, 'pastel', false);
    expect((await editorPalette()).objetos.map((o) => o.objectId)).toContain('pastel');
  });
});

describe('deshabilitar un icono', () => {
  it('lo quita del desplegable de iconos del editor', async () => {
    const antes = await editorPalette();
    expect(antes.iconos).toContain('balanza');

    await setResourceDisabled(admin, `${ICON_PREFIX}balanza`, true);

    const despues = await editorPalette();
    expect(despues.iconos).not.toContain('balanza');
    expect(despues.iconos.length).toBe(antes.iconos.length - 1);
  });

  it('el prefijo mantiene separados un icono y un objeto que se llamen igual', async () => {
    /*
     * `tabla` es las dos cosas: un objeto del catalogo y un icono. Sin prefijo serian la misma
     * clave en el conjunto de deshabilitados, y apagar el icono apagaria tambien el objeto —un
     * fallo que nadie relacionaria con haber tocado un icono.
     */
    await setResourceDisabled(admin, `${ICON_PREFIX}tabla`, true);

    const palette = await editorPalette();
    expect(palette.iconos).not.toContain('tabla');
    expect(palette.objetos.map((o) => o.objectId)).toContain('tabla');
  });

  it('un icono que no existe no se puede deshabilitar', async () => {
    await expect(setResourceDisabled(admin, `${ICON_PREFIX}no-existe`, true)).rejects.toThrow();
    expect(await disabledResources()).not.toContain(`${ICON_PREFIX}no-existe`);
  });
});
