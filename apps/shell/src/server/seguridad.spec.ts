import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { framedHeaders, parsearOrigenes } from './embedding';

/**
 * Las cabeceras con las que sale toda respuesta.
 *
 * Se comprueban aqui y no en el navegador porque son una decision del middleware, no del dibujo:
 * una prueba unitaria lo dice en un milisegundo y no depende de que haya un servidor levantado.
 */

/** La misma lista que aplica `middleware.ts`. Si una cambia, esta prueba lo dice. */
const CABECERAS = ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'];

describe('cabeceras de seguridad', () => {
  const fuente = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8');

  for (const cabecera of CABECERAS) {
    it(`${cabecera} se pone en toda respuesta`, () => {
      expect(fuente).toContain(cabecera);
    });
  }

  it('HSTS solo en produccion', () => {
    // En desarrollo no hay HTTPS: fijar el navegador a un esquema que la maquina no sirve deja la
    // aplicacion inalcanzable hasta que alguien limpia el estado del navegador.
    const bloque = fuente.slice(fuente.indexOf('Strict-Transport-Security') - 200);
    expect(bloque).toContain("NODE_ENV'] === 'production'");
  });

  it('el enmarcado sigue decidiendose por ruta', () => {
    expect(framedHeaders('/admin', parsearOrigenes(''))['x-frame-options']).toBe('DENY');
  });
});
