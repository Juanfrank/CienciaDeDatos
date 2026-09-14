import { describe, expect, it } from 'vitest';
import { conditionalColor, ruleDescribe, type ConditionalFormat } from './conditional';

const rules = (...r: ConditionalFormat['rules']): ConditionalFormat => ({ rules: r });

describe('conditionalColor', () => {
  it('gana la PRIMERA regla que casa, no la mas especifica', () => {
    /*
     * Con dos reglas que se solapan, quien edita decide cual manda subiendola en la lista, y eso
     * se puede razonar mirandola. Una resolucion por especificidad obligaria a simular el
     * algoritmo de cabeza para saber de que color sale una barra.
     */
    const f = rules(
      { comparator: 'mayor', valor: 100, color: 'error' },
      { comparator: 'mayor', valor: 50, color: 'primario' },
    );
    expect(conditionalColor(f, 200)).toBe('error');
    expect(conditionalColor(f, 60)).toBe('primario');
    expect(conditionalColor(f, 10)).toBeUndefined();
  });

  it('un nulo NO entra en ninguna regla, ni siquiera en «menor que»', () => {
    /*
     * `null` es «no hay respuesta», no un numero pequeno. Tratarlo como cero lo pintaria de rojo
     * en cuanto alguien escriba «menor que 10», que es afirmar algo sobre un dato que no existe.
     */
    const f = rules({ comparator: 'menor', valor: 10, color: 'error' });
    expect(conditionalColor(f, null)).toBeUndefined();
    expect(conditionalColor(f, undefined)).toBeUndefined();
    expect(conditionalColor(f, 0)).toBe('error');
  });

  it('una regla con medida solo se aplica a ESA medida', () => {
    // «Mayor que 90» significa una cosa en dias y un disparate en casos.
    const f = rules({ medida: 'DiasResolucion', comparator: 'mayor', valor: 90, color: 'error' });
    expect(conditionalColor(f, 120, 'DiasResolucion')).toBe('error');
    expect(conditionalColor(f, 120, 'CasosPendientes')).toBeUndefined();
  });

  it('sin medida declarada, se aplica a todas', () => {
    const f = rules({ comparator: 'mayor', valor: 90, color: 'error' });
    expect(conditionalColor(f, 120, 'LaQueSea')).toBe('error');
  });

  it('«entre» incluye los dos extremos y no depende del orden en que se escriban', () => {
    const f = rules({ comparator: 'entre', valor: 90, hasta: 30, color: 'terciario' });
    expect(conditionalColor(f, 30)).toBe('terciario');
    expect(conditionalColor(f, 90)).toBe('terciario');
    expect(conditionalColor(f, 60)).toBe('terciario');
    expect(conditionalColor(f, 91)).toBeUndefined();
  });

  it('«entre» sin el otro extremo no casa nunca', () => {
    // Se rechaza al guardar; aqui se comprueba que ademas no pinta nada por si llegara.
    expect(conditionalColor(rules({ comparator: 'entre', valor: 90, color: 'error' }), 90)).toBeUndefined();
  });

  it('mas reglas del maximo no se evaluan', () => {
    const seis = rules(
      ...Array.from({ length: 6 }, (_, i) => ({
        comparator: 'igual' as const,
        valor: i,
        color: 'error' as const,
      })),
    );
    expect(conditionalColor(seis, 4)).toBe('error');
    expect(conditionalColor(seis, 5)).toBeUndefined();
  });

  it('sin formato condicional no hay color', () => {
    expect(conditionalColor(undefined, 100)).toBeUndefined();
  });
});

describe('ruleDescribe', () => {
  it('se lee como una frase, para el panel y para el respaldo accesible', () => {
    expect(ruleDescribe({ comparator: 'mayor', valor: 90, color: 'error' })).toBe('mayor que 90');
    expect(ruleDescribe({ comparator: 'entre', valor: 30, hasta: 90, color: 'error' })).toBe(
      'entre 30 y 90',
    );
  });
});
