import { describe, expect, it } from 'vitest';
// @ts-expect-error -- herramienta en JavaScript, sin tipos.
import { segmentar, unir } from './segmentos.mjs';

/**
 * El escaner que separa codigo, comentario y cadena.
 *
 * Lo unico que no puede fallar es la reconstruccion: si `unir(segmentar(x))` no devuelve `x`, el
 * renombrado corrompe archivos en vez de renombrarlos. Todo lo demas es un matiz; esto no.
 */

const tipos = (fuente: string) =>
  (segmentar(fuente) as { tipo: string; texto: string }[])
    .filter((s) => s.texto !== '')
    .map((s) => `${s.tipo}:${s.texto}`);

describe('segmentar', () => {
  it('reconstruye la fuente exactamente', () => {
    const fuente = [
      "import { a } from 'b';",
      '/** Un bloque */',
      'const x = "cadena con // barras";',
      '// linea',
      'const y = `plantilla ${valor} final`;',
      "const z = 'con \\' escape';",
    ].join('\n');

    expect(unir(segmentar(fuente))).toBe(fuente);
  });

  it('separa el comentario de linea del codigo', () => {
    expect(tipos('const a = 1; // nota')).toEqual(['codigo:const a = 1; ', 'comentario:// nota']);
  });

  it('no confunde una barra dentro de una cadena con un comentario', () => {
    const fuente = 'const u = "http://x";';
    expect(tipos(fuente)).toEqual(['codigo:const u = ', 'cadena:"http://x"', 'codigo:;']);
  });

  it('la interpolacion de una plantilla vuelve a ser codigo', () => {
    expect(tipos('`a ${dato} b`')).toEqual([
      'cadena:`a ${',
      'codigo:dato',
      'cadena:} b`',
    ]);
  });

  it('una comilla escapada no cierra la cadena', () => {
    const fuente = "'no \\' acaba aqui'";
    expect(segmentar(fuente)).toHaveLength(1);
    expect(unir(segmentar(fuente))).toBe(fuente);
  });

  it('una expresion regular es cadena, no codigo', () => {
    // Una prueba comprueba un mensaje con `/no existen en el esquema activo/`. Tratado como
    // codigo, el renombrado convierte `esquema` en `scheme` dentro de la afirmacion, que pasa a
    // comprobar un texto que el servidor nunca dice.
    expect(tipos('expect(x).toMatch(/no existe el esquema/);')).toEqual([
      'codigo:expect(x).toMatch(',
      'cadena:/no existe el esquema/',
      'codigo:);',
    ]);
  });

  it('una division no se confunde con una expresion regular', () => {
    expect(tipos('const r = a / b / c;')).toEqual(['codigo:const r = a / b / c;']);
  });

  it('un comentario de bloque sin cerrar no se come el resto en silencio', () => {
    // Devuelve lo que hay, y sigue reconstruyendo: un archivo mal formado no debe corromperse.
    const fuente = 'const a = 1;\n/* sin cerrar';
    expect(unir(segmentar(fuente))).toBe(fuente);
  });
});
