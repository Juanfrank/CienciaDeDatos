import { describe, expect, it } from 'vitest';
import {
  EMBEDDING_PREFIX,
  WITHOUT_FRAMED,
  framedHeaders,
  embeddingCode,
  isEmbeddablePath,
  origenesDescartados,
  parsearOrigenes,
  framedPolicy,
} from './embedding';

/**
 * La incrustacion se decide con dos reglas y las dos importan: quien puede enmarcarnos, y que
 * pasa cuando no hay nadie configurado. La segunda es la que se olvida, y la que decide si una
 * configuracion a medias deja la aplicacion cerrada o abierta a cualquiera.
 */

describe('parsearOrigenes', () => {
  it('acepta origenes completos con https', () => {
    expect(parsearOrigenes('https://portal.ejemplo.do, https://intranet.ejemplo.do')).toEqual([
      'https://portal.ejemplo.do',
      'https://intranet.ejemplo.do',
    ]);
  });

  it('descarta un dominio sin esquema', () => {
    // `frame-ancestors` distingue esquema: `portal.ejemplo.do` admitiria tambien http://, que es
    // enmarcar datos institucionales sobre una conexion que cualquiera puede leer.
    expect(parsearOrigenes('portal.ejemplo.do')).toEqual([]);
    expect(origenesDescartados('portal.ejemplo.do')).toEqual(['portal.ejemplo.do']);
  });

  it('descarta http, comodines y rutas', () => {
    const valor = 'http://portal.do, https://*.ejemplo.do, https://portal.do/ruta';
    expect(parsearOrigenes(valor)).toEqual([]);
    expect(origenesDescartados(valor)).toHaveLength(3);
  });

  it('admite self, para incrustar dentro de la propia aplicacion', () => {
    expect(parsearOrigenes("'self'")).toEqual(["'self'"]);
  });

  it('sin configuracion no hay ningun origen', () => {
    expect(parsearOrigenes(undefined)).toEqual([]);
    expect(parsearOrigenes('')).toEqual([]);
  });
});

describe('framedPolicy', () => {
  const origenes = ['https://portal.ejemplo.do'];

  it('deniega el enmarcado en cualquier ruta que no sea de incrustacion', () => {
    for (const path of ['/', '/m/casos', '/admin', '/admin/teams', '/notices', '/api/alerts']) {
      expect(framedPolicy(path, origenes)).toBe(WITHOUT_FRAMED);
    }
  });

  it('permite enmarcar la ruta de incrustacion desde los origenes configurados', () => {
    expect(framedPolicy('/embed/m/casos', origenes)).toBe(
      'frame-ancestors https://portal.ejemplo.do',
    );
  });

  it('SIN lista configurada la ruta de incrustacion tambien deniega', () => {
    // Falla cerrado a proposito: una configuracion olvidada tiene que dejar la aplicacion sin
    // incrustar, nunca incrustable por cualquiera.
    expect(framedPolicy('/embed/m/casos', [])).toBe(WITHOUT_FRAMED);
  });

  it('una ruta que solo empieza parecido no cuenta como incrustable', () => {
    expect(isEmbeddablePath('/incrustaciones-falsas')).toBe(false);
    expect(isEmbeddablePath(EMBEDDING_PREFIX)).toBe(true);
    expect(isEmbeddablePath('/embed/m/casos')).toBe(true);
  });
});

describe('framedHeaders', () => {
  it('donde se deniega, acompana con X-Frame-Options', () => {
    const cabeceras = framedHeaders('/admin', ['https://portal.ejemplo.do']);
    expect(cabeceras['content-security-policy']).toBe(WITHOUT_FRAMED);
    expect(cabeceras['x-frame-options']).toBe('DENY');
  });

  it('donde se permite, NO se emite X-Frame-Options', () => {
    // La cabecera antigua no admite lista de origenes —ALLOW-FROM se retiro— asi que ponerla
    // bloquearia la incrustacion en los navegadores que le dan prioridad.
    const cabeceras = framedHeaders('/embed/m/casos', ['https://portal.ejemplo.do']);
    expect(cabeceras['x-frame-options']).toBeUndefined();
  });
});

describe('embeddingCode', () => {
  it('produce un iframe sin permisos de navegador', () => {
    const code = embeddingCode('https://capa.ejemplo.do/', '/embed/m/casos', 'Casos');
    expect(code).toContain('src="https://capa.ejemplo.do/embed/m/casos"');
    // El iframe no usa camara, micro ni ubicacion: declararlo evita que el portal anfitrion se
    // los conceda sin querer.
    expect(code).toContain('allow=""');
  });

  it('escapa las comillas del titulo, que viene del nombre del modulo', () => {
    const code = embeddingCode('https://x.do', '/embed/m/a', 'Casos "especiales"');
    expect(code).toContain('title="Casos &quot;especiales&quot;"');
  });
});
