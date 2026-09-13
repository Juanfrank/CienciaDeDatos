import { describe, expect, it } from 'vitest';
// @ts-expect-error -- herramienta en JavaScript, sin tipos.
import { segmentar, segmentarJsx, unir } from './segmentos.mjs';

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

  it('tras una palabra clave, la barra abre expresion regular', () => {
    // `return /[",\n]/.test(x)`: mirando solo la puntuacion anterior, la barra pasaba por
    // division, la comilla de dentro de la clase abria una cadena que se comia el resto de la
    // linea, y el identificador de despues se quedaba sin renombrar.
    expect(tipos('return /[",\\n]/.test(texto);')).toEqual([
      'codigo:return ',
      'cadena:/[",\\n]/',
      'codigo:.test(texto);',
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

describe('segmentarJsx', () => {
  const zonas = (fuente: string) =>
    (segmentarJsx(fuente) as { tipo: string; texto: string }[]).map((s) => `${s.tipo}:${s.texto}`);

  it('el texto visible de un JSX es prosa, no codigo', () => {
    // `<h1>Editor de modulos</h1>`: tratado como codigo, el renombrado dejo la cabecera del
    // editor diciendo «Editor de modules».
    expect(zonas('<h1>Editor de modulos</h1>')).toEqual([
      'codigo:<h1>',
      'prosa:Editor de modulos',
      'codigo:</h1>',
    ]);
  });

  it('el texto que sigue a una interpolacion tambien es prosa', () => {
    expect(zonas('<p>{n} modulos visibles</p>')).toEqual([
      'codigo:<p>{n}',
      'prosa: modulos visibles',
      'codigo:</p>',
    ]);
  });

  it('un generico no se confunde con texto', () => {
    // `}` cierra la funcion y `<` abre el generico: entre medias no hay nada que leer.
    const fuente = 'function f() {}\nexport const m: Record<string, number> = {};';
    expect(zonas(fuente)).toEqual([`codigo:${fuente}`]);
  });

  it('una comparacion no se confunde con texto', () => {
    expect(zonas('const b = a > uno;')).toEqual(['codigo:const b = a > uno;']);
  });

  it('reconstruye la fuente exactamente', () => {
    const fuente = '<div className="x">\n  Texto con {dato} dentro\n</div>';
    expect(unir(segmentarJsx(fuente))).toBe(fuente);
  });
});
