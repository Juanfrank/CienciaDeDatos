import { describe, expect, it } from 'vitest';
import { colorCondicional, describirRegla, type ConditionalFormat } from './condicional';

const rules = (...r: ConditionalFormat['rules']): ConditionalFormat => ({ rules: r });

describe('colorCondicional', () => {
  it('gana la PRIMERA regla que casa, no la mas especifica', () => {
    /*
     * Con dos reglas que se solapan, quien edita decide cual manda subiendola en la lista, y eso
     * se puede razonar mirandola. Una resolucion por especificidad obligaria a simular el
     * algoritmo de cabeza para saber de que color sale una barra.
     */
    const f = rules(
      { comparador: 'mayor', valor: 100, color: 'error' },
      { comparador: 'mayor', valor: 50, color: 'primario' },
    );
    expect(colorCondicional(f, 200)).toBe('error');
    expect(colorCondicional(f, 60)).toBe('primario');
    expect(colorCondicional(f, 10)).toBeUndefined();
  });

  it('un nulo NO entra en ninguna regla, ni siquiera en «menor que»', () => {
    /*
     * `null` es «no hay respuesta», no un numero pequeno. Tratarlo como cero lo pintaria de rojo
     * en cuanto alguien escriba «menor que 10», que es afirmar algo sobre un dato que no existe.
     */
    const f = rules({ comparador: 'menor', valor: 10, color: 'error' });
    expect(colorCondicional(f, null)).toBeUndefined();
    expect(colorCondicional(f, undefined)).toBeUndefined();
    expect(colorCondicional(f, 0)).toBe('error');
  });

  it('una regla con medida solo se aplica a ESA medida', () => {
    // «Mayor que 90» significa una cosa en dias y un disparate en casos.
    const f = rules({ medida: 'DiasResolucion', comparador: 'mayor', valor: 90, color: 'error' });
    expect(colorCondicional(f, 120, 'DiasResolucion')).toBe('error');
    expect(colorCondicional(f, 120, 'CasosPendientes')).toBeUndefined();
  });

  it('sin medida declarada, se aplica a todas', () => {
    const f = rules({ comparador: 'mayor', valor: 90, color: 'error' });
    expect(colorCondicional(f, 120, 'LaQueSea')).toBe('error');
  });

  it('«entre» incluye los dos extremos y no depende del orden en que se escriban', () => {
    const f = rules({ comparador: 'entre', valor: 90, hasta: 30, color: 'terciario' });
    expect(colorCondicional(f, 30)).toBe('terciario');
    expect(colorCondicional(f, 90)).toBe('terciario');
    expect(colorCondicional(f, 60)).toBe('terciario');
    expect(colorCondicional(f, 91)).toBeUndefined();
  });

  it('«entre» sin el otro extremo no casa nunca', () => {
    // Se rechaza al guardar; aqui se comprueba que ademas no pinta nada por si llegara.
    expect(colorCondicional(rules({ comparador: 'entre', valor: 90, color: 'error' }), 90)).toBeUndefined();
  });

  it('mas reglas del maximo no se evaluan', () => {
    const seis = rules(
      ...Array.from({ length: 6 }, (_, i) => ({
        comparador: 'igual' as const,
        valor: i,
        color: 'error' as const,
      })),
    );
    expect(colorCondicional(seis, 4)).toBe('error');
    expect(colorCondicional(seis, 5)).toBeUndefined();
  });

  it('sin formato condicional no hay color', () => {
    expect(colorCondicional(undefined, 100)).toBeUndefined();
  });
});

describe('describirRegla', () => {
  it('se lee como una frase, para el panel y para el respaldo accesible', () => {
    expect(describirRegla({ comparador: 'mayor', valor: 90, color: 'error' })).toBe('mayor que 90');
    expect(describirRegla({ comparador: 'entre', valor: 30, hasta: 90, color: 'error' })).toBe(
      'entre 30 y 90',
    );
  });
});
