import { describe, expect, it } from 'vitest';
import { SIN_RED, motivoDeFallo, pedir } from './pedir';

/**
 * El envoltorio de `fetch`, probado sobre lo unico que importa: que NO lanza.
 *
 * Dieciseis controles del panel tienen la misma forma —encender la bandera de «en curso»,
 * esperar, apagarla—. Con `fetch` a pelo, una caida de red hace que la espera lance y la linea
 * que apaga la bandera no llega a correr: el boton se queda deshabilitado para siempre y la
 * unica salida es recargar la pagina.
 */

const conCuerpo = (cuerpo: unknown, ok = false): Response =>
  ({ ok, json: async () => cuerpo }) as unknown as Response;

describe('pedir', () => {
  it('sin red devuelve null en vez de lanzar', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('sin red'))) as typeof fetch;
    try {
      await expect(pedir('/api/notifications')).resolves.toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  it('con red devuelve la respuesta tal cual, sin tocarla', async () => {
    const original = globalThis.fetch;
    const respuesta = conCuerpo({ hola: 1 }, true);
    globalThis.fetch = (() => Promise.resolve(respuesta)) as typeof fetch;
    try {
      await expect(pedir('/api/notifications')).resolves.toBe(respuesta);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('motivoDeFallo', () => {
  it('sin respuesta lo dice, en vez de dar el mensaje generico', async () => {
    // «No se pudo guardar» delante de una caida de red manda a buscar el fallo donde no esta.
    expect(await motivoDeFallo(null, 'No se pudo guardar.')).toBe(SIN_RED);
  });

  it('prefiere lo que explique el servidor', async () => {
    expect(await motivoDeFallo(conCuerpo({ error: 'Ese slug ya existe.' }), 'Generico.')).toBe(
      'Ese slug ya existe.',
    );
  });

  it('un cuerpo que no es JSON no rompe el mensaje', async () => {
    // Un 502 de un proxy devuelve HTML. Sin el catch, leer el cuerpo lanzaria y el control se
    // quedaria igual de mudo que antes.
    const html = { ok: false, json: async () => Promise.reject(new Error('no es JSON')) };
    expect(await motivoDeFallo(html as unknown as Response, 'Generico.')).toBe('Generico.');
  });

  it('un JSON sin campo error cae al mensaje del control', async () => {
    expect(await motivoDeFallo(conCuerpo({ otra: 'cosa' }), 'Generico.')).toBe('Generico.');
  });
});
