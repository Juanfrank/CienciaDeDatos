import { describe, expect, it } from 'vitest';
import { ResolvedorLocal, normalizar, queryUrl } from './resolver';
import type { Vocabulary } from './types';

/**
 * El bloque que mas importa es el ultimo: el vocabulario se construye con lo que quien pregunta
 * YA PUEDE VER, asi que una pregunta por un valor fuera de su alcance no puede contestarse
 * confirmando que ese valor existe. Es 4.11 aplicado a una caja de texto.
 */

const resolutor = new ResolvedorLocal();

/** Vocabulario de alguien del equipo Norte: sus valores, no todos los del dataset. */
const vocabulary: Vocabulary = {
  moduleSlug: 'casos-pendientes',
  measures: [
    { clave: 'CasosPendientes', etiqueta: 'casos pendientes' },
    { clave: 'CasosIngresados', etiqueta: 'casos ingresados' },
  ],
  dimensions: [
    { clave: 'DimTribunal.Distrito', etiqueta: 'distrito' },
    { clave: 'DimTribunal.Materia', etiqueta: 'materia' },
  ],
  values: [
    { dimension: 'DimTribunal.Distrito', valor: 'Distrito Norte' },
    { dimension: 'DimTribunal.Materia', valor: 'Penal' },
    { dimension: 'DimTribunal.Materia', valor: 'Civil' },
  ],
};

describe('normalizar', () => {
  it('iguala acentos y mayusculas', () => {
    expect(normalizar('Penál')).toBe(normalizar('penal'));
    expect(normalizar('  MATERIA ')).toBe('materia');
  });
});

describe('reconoce medidas, dimensiones y valores', () => {
  it('una medida sola da una consulta de total', () => {
    const r = resolutor.resolver('cuantos casos pendientes hay', vocabulary);
    expect(r.measure).toBe('CasosPendientes');
    expect(r.intent).toBe('total');
    expect(r.resoluble).toBe(true);
  });

  it('un valor da un filtro sobre su dimension', () => {
    const r = resolutor.resolver('casos pendientes en Penal', vocabulary);
    expect(r.filters).toEqual({ 'DimTribunal.Materia': ['Penal'] });
  });

  it('prefiere el valor mas largo: "distrito norte" no se lee como "distrito"', () => {
    // Con los n-gramas al reves, "Distrito Norte" se reconoceria como la DIMENSION distrito y se
    // perderia el filtro entero.
    const r = resolutor.resolver('casos pendientes en Distrito Norte', vocabulary);
    expect(r.filters).toEqual({ 'DimTribunal.Distrito': ['Distrito Norte'] });
    expect(r.groupBy).toBeUndefined();
  });

  it('"por materia" pide un desglose', () => {
    const r = resolutor.resolver('casos pendientes por materia', vocabulary);
    expect(r.intent).toBe('desglose');
    expect(r.groupBy).toBe('DimTribunal.Materia');
  });

  it('reconoce dos valores de la misma dimension', () => {
    const r = resolutor.resolver('casos pendientes en Penal y Civil', vocabulary);
    expect(r.filters['DimTribunal.Materia']).toEqual(['Penal', 'Civil']);
  });

  it('detecta un ranking con su limite', () => {
    const r = resolutor.resolver('top 3 distrito por casos ingresados', vocabulary);
    expect(r.intent).toBe('ranking');
    expect(r.limite).toBe(3);
    expect(r.measure).toBe('CasosIngresados');
  });
});

describe('dice lo que NO entendio, sin adivinar', () => {
  it('las palabras vacias no se cuentan como no entendidas', () => {
    // Devolver "no entendi: hay, en" hace parecer roto algo que funciono.
    const r = resolutor.resolver('cuantos casos pendientes hay en Penal', vocabulary);
    expect(r.noEntendido).toEqual([]);
  });

  it('una palabra desconocida se devuelve tal cual, sin sugerir un parecido', () => {
    const r = resolutor.resolver('casos pendientes de homicidios', vocabulary);
    expect(r.noEntendido).toEqual(['homicidios']);
    // Lo reconocido se conserva: se contesta lo que se pudo y se avisa de lo que no.
    expect(r.measure).toBe('CasosPendientes');
  });

  it('una pregunta sin nada reconocible no es resoluble', () => {
    const r = resolutor.resolver('que tal va todo', vocabulary);
    expect(r.resoluble).toBe(false);
    expect(r.explicacion).toMatch(/No se reconocio nada/);
  });
});

describe('el vocabulario limita lo que se puede preguntar (4.11)', () => {
  it('un valor fuera del ambito NO se reconoce ni se confirma', () => {
    // 'Distrito Este' no esta en el vocabulario de esta persona porque no aparece en los datos
    // que puede ver. Reconocerlo seria confirmar que existe.
    const r = resolutor.resolver('casos pendientes en Distrito Este', vocabulary);

    expect(r.filters['DimTribunal.Distrito']).toBeUndefined();
    expect(r.explicacion).not.toContain('Este');
    // Se devuelve como no entendido, que es lo mismo que se diria de un valor inexistente: las
    // dos situaciones tienen que ser indistinguibles desde fuera.
    expect(r.noEntendido).toContain('este');
  });

  it('tampoco se reconoce una medida que el modulo no expone', () => {
    const r = resolutor.resolver('presupuesto por distrito', vocabulary);
    expect(r.measure).toBeUndefined();
    expect(r.noEntendido).toContain('presupuesto');
  });

  it('dos personas con vocabularios distintos entienden distinto la misma pregunta', () => {
    const delEste: Vocabulary = {
      ...vocabulary,
      values: [{ dimension: 'DimTribunal.Distrito', valor: 'Distrito Este' }],
    };
    const pregunta = 'casos pendientes en Distrito Este';

    expect(resolutor.resolver(pregunta, delEste).filters['DimTribunal.Distrito']).toEqual([
      'Distrito Este',
    ]);
    expect(resolutor.resolver(pregunta, vocabulary).filters['DimTribunal.Distrito']).toBeUndefined();
  });
});

describe('queryUrl', () => {
  it('la respuesta es una URL del modulo con los filtros entendidos', () => {
    const r = resolutor.resolver('casos pendientes en Penal', vocabulary);
    expect(queryUrl('casos-pendientes', r)).toBe(
      '/m/casos-pendientes?DimTribunal.Materia=Penal',
    );
  });

  it('sin filtros, la URL limpia del modulo', () => {
    const r = resolutor.resolver('casos pendientes', vocabulary);
    expect(queryUrl('casos-pendientes', r)).toBe('/m/casos-pendientes');
  });

  it('la URL no lleva la medida ni el desglose: son lo que el modulo ya muestra', () => {
    // Resolver una pregunta no reconfigura el modulo; lo enfoca. Meter la medida en la URL
    // abriria la puerta a pedir una medida que el modulo no mapea, que es 4.2 otra vez.
    const r = resolutor.resolver('casos ingresados por materia', vocabulary);
    expect(queryUrl('casos-pendientes', r)).not.toContain('CasosIngresados');
  });
});
