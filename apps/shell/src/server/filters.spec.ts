import { describe, expect, it } from 'vitest';
import { filtersNormalize, filtersOfQuery } from './filters';

/**
 * Los filtros llegan de fuera, y sus CLAVES tambien.
 *
 * Lo que se fija aqui es que una clave con nombre de propiedad del lenguaje se trate como un
 * nombre de campo mas. Asignandola con `objeto[clave] = valor`, `__proto__` no se guarda: cambia
 * el prototipo del objeto y el filtro desaparece sin error, sin clave y sin valor.
 */

describe('normalizacion de filtros', () => {
  it('una lista y un valor suelto acaban los dos en lista', () => {
    expect(filtersNormalize({ 'DimTribunal.Distrito': 'Norte', 'DimTiempo.Ano': ['2025', '2026'] })).toEqual({
      'DimTribunal.Distrito': ['Norte'],
      'DimTiempo.Ano': ['2025', '2026'],
    });
  });

  it('lo que no es cadena ni lista de cadenas no entra', () => {
    expect(filtersNormalize({ a: 3, b: [1, 'dos', null], c: null })).toEqual({ b: ['dos'] });
    expect(filtersNormalize(null)).toEqual({});
    expect(filtersNormalize('no soy un objeto')).toEqual({});
  });

  it('una clave llamada __proto__ se guarda como un campo mas, no cambia el objeto', () => {
    // El cuerpo se construye con `JSON.parse`, que es de donde sale de verdad: en un literal,
    // `__proto__:` fija el prototipo y la clave no llega a existir, asi que un literal aqui
    // probaria otra cosa. `JSON.parse` si crea la propiedad, y es lo que recibe la ruta.
    const cuerpo: unknown = JSON.parse('{"__proto__": ["x"], "normal": ["y"]}');
    const salida = filtersNormalize(cuerpo);

    expect(Object.prototype.hasOwnProperty.call(salida, '__proto__')).toBe(true);
    expect(Object.keys(salida).sort()).toEqual(['__proto__', 'normal']);
    // Y el objeto sigue siendo un objeto corriente: sin esto, su prototipo seria el array.
    expect(Object.getPrototypeOf(salida)).toBe(Object.prototype);
  });

  it('la query string se normaliza igual, y con las mismas claves raras', () => {
    const params = new URLSearchParams();
    params.append('DimTiempo.Ano', '2025');
    params.append('DimTiempo.Ano', '2026');
    params.append('DimTribunal.Distrito', 'Norte');
    params.append('__proto__', 'x');

    const salida = filtersOfQuery(params);
    expect(salida['DimTiempo.Ano']).toEqual(['2025', '2026']);
    expect(salida['DimTribunal.Distrito']).toBe('Norte');
    expect(Object.prototype.hasOwnProperty.call(salida, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(salida)).toBe(Object.prototype);
  });
});
