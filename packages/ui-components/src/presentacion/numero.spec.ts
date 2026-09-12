import { describe, expect, it } from 'vitest';
import { formatoDeMedida, formateadorDeNumero, problemaDelPatron } from './numero';

const f = (formato: Parameters<typeof formateadorDeNumero>[0]) => formateadorDeNumero(formato);
const p = (patron: string) => formateadorDeNumero({ tipo: 'personalizado', patron });

/*
 * Los separadores son los de `es-DO` —coma para millares, punto para decimales— y se comprueban
 * contra `Intl`, no contra una cadena escrita a mano. Escribirlos a mano fue el primer error de
 * esta implementacion: puse la convencion de Espana, que es la contraria, y las dos vias del
 * formateador —la general por `Intl` y la personalizada— daban separadores distintos.
 */
const local = (n: number, d?: number) =>
  new Intl.NumberFormat(
    'es-DO',
    d === undefined ? {} : { minimumFractionDigits: d, maximumFractionDigits: d },
  ).format(n);

describe('los tipos que no hay que escribir', () => {
  it('general ensena los decimales que traiga, sin fijarlos', () => {
    expect(f({ tipo: 'general' })(1234.5)).toBe(local(1234.5));
    expect(f({ tipo: 'general' })(1234)).toBe(local(1234));
  });

  it('entero redondea y decimal fija dos', () => {
    expect(f({ tipo: 'entero' })(1234.6)).toBe(local(1235));
    expect(f({ tipo: 'decimal' })(1234.5)).toBe(local(1234.5, 2));
    expect(f({ tipo: 'decimal', decimales: 1 })(1234.55)).toBe(local(1234.6, 1));
  });

  it('el separador de millares se puede apagar', () => {
    expect(f({ tipo: 'entero', millares: false })(1234567)).toBe('1234567');
  });

  it('porcentaje anade el simbolo y NO multiplica', () => {
    /*
     * `Intl` con `style: 'percent'` multiplicaria por 100, y ahi esta el problema: unos datasets
     * traen 18,5 y otros 0,185, y la aplicacion no puede saber cual. Se escribe el simbolo y se
     * deja la cifra como viene; quien tenga la fraccion usa la cadena personalizada con `%`, que
     * si multiplica porque ahi se pide explicitamente.
     */
    expect(f({ tipo: 'porcentaje' })(18.5)).toBe(`${local(18.5, 1)}%`);
    expect(f({ tipo: 'porcentaje', decimales: 0 })(18.5)).toBe(`${local(19, 0)}%`);
  });

  it('moneda antepone el simbolo, y el simbolo se elige', () => {
    // Texto y no codigo ISO: `Intl` con `currency: 'DOP'` escribe «RD$» o «DOP» segun los datos
    // que traiga el motor, y un informe institucional no puede depender de eso.
    expect(f({ tipo: 'moneda' })(1234.5)).toBe(`RD$ ${local(1234.5, 2)}`);
    expect(f({ tipo: 'moneda', simbolo: 'US$' })(1234.5)).toBe(`US$ ${local(1234.5, 2)}`);
  });

  it('null es «no hay respuesta», nunca cero', () => {
    expect(f({ tipo: 'entero' })(null)).toBe('—');
  });
});

describe('la cadena personalizada', () => {
  it("'0' rellena y '#' no", () => {
    expect(p('0000')(42)).toBe('0042');
    expect(p('####')(42)).toBe('42');
    expect(p('0.00')(3.5)).toBe('3.50');
    expect(p('0.##')(3.5)).toBe('3.5');
    expect(p('0.##')(3)).toBe('3');
  });

  it("la coma entre marcadores agrupa; suelta es un literal", () => {
    expect(p('#,##0')(1234567)).toBe('1,234,567');
    expect(p('0')(1234567)).toBe('1234567');
  });

  it('el porcentaje multiplica por cien', () => {
    expect(p('0.0%')(0.185)).toBe('18.5%');
  });

  it('los literales salen tal cual, y la barra escapa lo reservado', () => {
    expect(p('RD$ #,##0.00')(1234.5)).toBe('RD$ 1,234.50');
    expect(p('#,##0 "casos"')(1234)).toBe('1,234 casos');
    // Sin escapar, el % multiplicaria. Escapado, es solo el simbolo.
    expect(p('0\\%')(5)).toBe('5%');
    expect(p('0%')(5)).toBe('500%');
  });

  it('tres secciones: positivo, negativo y cero', () => {
    /*
     * Es la forma en que se leen las cifras en un informe contable: el negativo entre parentesis
     * y el cero como raya, para que un cero real no se confunda con un hueco.
     */
    const contable = p('#,##0;(#,##0);—');
    expect(contable(1240)).toBe('1,240');
    expect(contable(-1240)).toBe('(1,240)');
    expect(contable(0)).toBe('—');
  });

  it('sin seccion de negativos, antepone el signo', () => {
    expect(p('#,##0')(-1240)).toBe('-1,240');
  });
});

describe('un patron que no vale no rompe el objeto', () => {
  it('se dice POR QUE no vale', () => {
    expect(problemaDelPatron('')).toMatch(/vacio/);
    expect(problemaDelPatron('a;b;c;d')).toMatch(/tres secciones/);
    expect(problemaDelPatron('casos')).toMatch(/marcador de digito/);
    expect(problemaDelPatron('#,##0')).toBeNull();
  });

  it('al dibujar se cae al formato general, no a un objeto en blanco', () => {
    // Un numero sin formatear se lee; una tarjeta vacia, no.
    expect(p('sin marcadores')(1234)).toBe(local(1234));
  });
});

describe('el formato es POR MEDIDA, con un general de respaldo', () => {
  const formatos = {
    general: { tipo: 'entero' as const },
    porMedida: { DiasResolucion: { tipo: 'decimal' as const, decimales: 1 } },
  };

  it('una medida con formato propio usa el suyo', () => {
    expect(formatoDeMedida(formatos, 'DiasResolucion').tipo).toBe('decimal');
  });

  it('una medida sin formato propio cae en el general', () => {
    expect(formatoDeMedida(formatos, 'CasosIngresados').tipo).toBe('entero');
  });

  it('el general es una REGLA que se consulta, no una copia', () => {
    // Cambiarlo cambia todas las que no se hayan tocado. Es lo que uno espera de «general», y no
    // pasaria si al crear cada medida se le hubiera copiado el valor.
    const otro = { ...formatos, general: { tipo: 'decimal' as const } };
    expect(formatoDeMedida(otro, 'CasosIngresados').tipo).toBe('decimal');
    expect(formatoDeMedida(otro, 'DiasResolucion').decimales).toBe(1);
  });
});
