import { describe, expect, it } from 'vitest';
import {
  PREFIJO_INCRUSTACION,
  SIN_ENMARCADO,
  cabecerasDeEnmarcado,
  codigoDeIncrustacion,
  esRutaIncrustable,
  origenesDescartados,
  parsearOrigenes,
  politicaDeEnmarcado,
} from './incrustacion';

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

describe('politicaDeEnmarcado', () => {
  const origenes = ['https://portal.ejemplo.do'];

  it('deniega el enmarcado en cualquier ruta que no sea de incrustacion', () => {
    for (const path of ['/', '/m/casos', '/admin', '/admin/equipos', '/avisos', '/api/alertas']) {
      expect(politicaDeEnmarcado(path, origenes)).toBe(SIN_ENMARCADO);
    }
  });

  it('permite enmarcar la ruta de incrustacion desde los origenes configurados', () => {
    expect(politicaDeEnmarcado('/incrustar/m/casos', origenes)).toBe(
      'frame-ancestors https://portal.ejemplo.do',
    );
  });

  it('SIN lista configurada la ruta de incrustacion tambien deniega', () => {
    // Falla cerrado a proposito: una configuracion olvidada tiene que dejar la aplicacion sin
    // incrustar, nunca incrustable por cualquiera.
    expect(politicaDeEnmarcado('/incrustar/m/casos', [])).toBe(SIN_ENMARCADO);
  });

  it('una ruta que solo empieza parecido no cuenta como incrustable', () => {
    expect(esRutaIncrustable('/incrustaciones-falsas')).toBe(false);
    expect(esRutaIncrustable(PREFIJO_INCRUSTACION)).toBe(true);
    expect(esRutaIncrustable('/incrustar/m/casos')).toBe(true);
  });
});

describe('cabecerasDeEnmarcado', () => {
  it('donde se deniega, acompana con X-Frame-Options', () => {
    const cabeceras = cabecerasDeEnmarcado('/admin', ['https://portal.ejemplo.do']);
    expect(cabeceras['content-security-policy']).toBe(SIN_ENMARCADO);
    expect(cabeceras['x-frame-options']).toBe('DENY');
  });

  it('donde se permite, NO se emite X-Frame-Options', () => {
    // La cabecera antigua no admite lista de origenes —ALLOW-FROM se retiro— asi que ponerla
    // bloquearia la incrustacion en los navegadores que le dan prioridad.
    const cabeceras = cabecerasDeEnmarcado('/incrustar/m/casos', ['https://portal.ejemplo.do']);
    expect(cabeceras['x-frame-options']).toBeUndefined();
  });
});

describe('codigoDeIncrustacion', () => {
  it('produce un iframe sin permisos de navegador', () => {
    const codigo = codigoDeIncrustacion('https://capa.ejemplo.do/', '/incrustar/m/casos', 'Casos');
    expect(codigo).toContain('src="https://capa.ejemplo.do/incrustar/m/casos"');
    // El iframe no usa camara, micro ni ubicacion: declararlo evita que el portal anfitrion se
    // los conceda sin querer.
    expect(codigo).toContain('allow=""');
  });

  it('escapa las comillas del titulo, que viene del nombre del modulo', () => {
    const codigo = codigoDeIncrustacion('https://x.do', '/incrustar/m/a', 'Casos "especiales"');
    expect(codigo).toContain('title="Casos &quot;especiales&quot;"');
  });
});
