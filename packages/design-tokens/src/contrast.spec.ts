import { describe, expect, it } from 'vitest';
import {
  checkContrast,
  contrastRatio,
  findContrastFailures,
  institutionalContrastChecks,
  parseHex,
} from './contrast';
import { INSTITUTIONAL_SOURCE } from './institutionalTheme';
import { OVERRIDABLE_TOKENS, defaultTheme, toCssVariables, validateOverrides } from './tokens';

describe('contrastRatio (WCAG 2.1)', () => {
  it('negro sobre blanco da la razon maxima de 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('colores identicos dan 1', () => {
    expect(contrastRatio('#4f46e5', '#4f46e5')).toBeCloseTo(1, 5);
  });

  it('es simetrica: el orden de los colores no cambia la razon', () => {
    expect(contrastRatio('#333333', '#eeeeee')).toBeCloseTo(
      contrastRatio('#eeeeee', '#333333') ?? 0,
      10,
    );
  });

  it('acepta hexadecimal de tres digitos', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });

  it('devuelve null ante un color no interpretable', () => {
    expect(contrastRatio('rebeccapurple', '#ffffff')).toBeNull();
    expect(contrastRatio('#gggggg', '#ffffff')).toBeNull();
  });
});

describe('checkContrast', () => {
  it('aplica el umbral AA de 4.5 para texto normal', () => {
    const r = checkContrast({ label: 't', foreground: '#767676', background: '#ffffff' });
    expect(r.required).toBe(4.5);
    expect(r.passes).toBe(true);
  });

  it('un gris demasiado light sobre blanco no pasa AA', () => {
    // #8a8a8a sobre blanco da 3.45:1, por debajo del 4.5 que exige el texto normal.
    const r = checkContrast({ label: 't', foreground: '#8a8a8a', background: '#ffffff' });
    expect(r.ratio).toBeCloseTo(3.45, 1);
    expect(r.passes).toBe(false);
  });

  it('el umbral baja a 3 para texto grande y marcas graficas', () => {
    // El mismo 3.45:1 si pasa cuando el umbral aplicable es 3.
    const r = checkContrast({ label: 't', foreground: '#8a8a8a', background: '#ffffff', size: 'large' });
    expect(r.required).toBe(3);
    expect(r.passes).toBe(true);
  });

  it('un gris que no llega ni a 3:1 falla en ambos tamanos', () => {
    const combinacion = { label: 't', foreground: '#999999', background: '#ffffff' };
    expect(checkContrast(combinacion).ratio).toBeCloseTo(2.85, 1);
    expect(checkContrast(combinacion).passes).toBe(false);
    expect(checkContrast({ ...combinacion, size: 'large' }).passes).toBe(false);
  });

  it('AAA es mas exigente que AA', () => {
    const combinacion = { label: 't', foreground: '#767676', background: '#ffffff' };
    expect(checkContrast(combinacion, 'AA').passes).toBe(true);
    expect(checkContrast(combinacion, 'AAA').passes).toBe(false);
  });

  it('un color no interpretable NO pasa: falla del lado seguro', () => {
    const r = checkContrast({ label: 't', foreground: 'azul', background: '#ffffff' });
    expect(r.passes).toBe(false);
    expect(r.error).toMatch(/no interpretable/);
  });
});

describe('puerta de publicacion de un modulo institucional (4.3)', () => {
  it('el tema por defecto pasa todas las comprobaciones en AA', () => {
    const fallos = findContrastFailures(institutionalContrastChecks(defaultTheme));
    expect(fallos.map((f) => `${f.label}: ${f.ratio?.toFixed(2)}`)).toEqual([]);
  });

  it('comprueba tambien cada color de la paleta categorica sobre la superficie', () => {
    // Una serie de datos que no contrasta con el fondo es ilegible aunque el texto si contraste.
    const labels = institutionalContrastChecks(defaultTheme).map((c) => c.label);
    expect(labels.filter((e) => e.startsWith('serie'))).toHaveLength(
      defaultTheme.color.categorical.length,
    );
  });

  it('detecta un tema mal configurado y devuelve TODOS los fallos, no solo el primero', () => {
    const malo = {
      color: {
        ...defaultTheme.color,
        text: '#dddddd',
        textMuted: '#e5e5e5',
        surface: '#ffffff',
        background: '#ffffff',
      },
    };
    const fallos = findContrastFailures(institutionalContrastChecks(malo));
    expect(fallos.length).toBeGreaterThanOrEqual(3);
    expect(fallos.map((f) => f.label)).toContain('texto sobre superficie');
  });
});

describe('anulaciones por objeto (4.3)', () => {
  it('acepta las anulaciones del conjunto documentado', () => {
    expect(validateOverrides({ 'color.surface': '#fafafa', 'radius.md': '2px' })).toEqual([]);
  });

  it('rechaza cualquier token fuera de ese conjunto', () => {
    const problems = validateOverrides({ 'color.brand': '#ff0000' });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.problem).toMatch(/no esta en el conjunto de tokens anulables/);
  });

  it('el conjunto anulable es deliberadamente pequeno', () => {
    // Si crece sin control, dos modulos institucionales dejan de parecerse entre si y la
    // validacion de contraste no puede garantizar nada.
    expect(OVERRIDABLE_TOKENS.length).toBeLessThanOrEqual(12);
  });
});

describe('toCssVariables', () => {
  it('aplana el tema a variables CSS', () => {
    const vars = toCssVariables();
    expect(vars['--color-text']).toBe(defaultTheme.color.text);
    expect(vars['--color-brand-500']).toBe(defaultTheme.color.brand[500]);
    expect(vars['--space-md']).toBe(defaultTheme.space.md);
  });

  it('expande la paleta categorica a una variable por serie', () => {
    const vars = toCssVariables();
    expect(vars['--color-categorical-0']).toBe(defaultTheme.color.categorical[0]);
    expect(vars['--color-categorical-7']).toBe(defaultTheme.color.categorical[7]);
  });
});

describe('marca institucional del Poder Judicial', () => {
  it('el azul y el rojo de ORIGEN son exactamente los de la norma de marca', () => {
    // Fijados como prueba y no solo como constante: son un dato de la institucion, no una
    // preferencia de diseno, y un cambio accidental tiene que fallar en CI y no descubrirse en
    // un informe ya impreso.
    //
    // Lo que se fija es el ORIGEN. Desde que el tema se genera con Material Design 3, los roles
    // son TONOS derivados de esos dos colores, no los colores mismos: `primary` es el tono 40 de
    // la paleta del azul. Es lo que compra la garantia de contraste, y es donde estaba el apaño
    // del tema anterior — ver el bloque del acento, mas abajo.
    expect(INSTITUTIONAL_SOURCE.primario).toBe('#0050dd');
    expect(INSTITUTIONAL_SOURCE.acento).toBe('#ef3340');
  });

  it('el azul derivado es el mismo azul a ojo: la marca no se altera, se normaliza', () => {
    // #0050DD esta en el tono 39.5 de su propia paleta, asi que el tono 40 cae practicamente
    // encima. La diferencia es de medio tono —imperceptible— y a cambio el par con su `onPrimary`
    // deja de depender de que alguien lo comprobara.
    const derived = defaultTheme.color.brand[500];
    expect(derived).not.toBe(INSTITUTIONAL_SOURCE.primario);
    expect(contrastRatio(derived, INSTITUTIONAL_SOURCE.primario) ?? 0).toBeLessThan(1.1);
  });

  it('la tipografia institucional encabeza la pila, con alternativas detras', () => {
    const stack = defaultTheme.font.sans;
    // La variable la rellena `next/font`, que sirve Montserrat desde el propio origen; el nombre
    // suelto detras cubre el caso de que la fuente este instalada en el sistema.
    expect(stack.indexOf('Montserrat')).toBeLessThan(stack.indexOf('system-ui'));
    // Si nada de eso carga, la aplicacion no puede caer en la serif por defecto del navegador.
    expect(stack).toMatch(/sans-serif$/);
  });

  it('las series de datos abren con el azul y siguen con el rojo, como fija la marca', () => {
    expect(defaultTheme.color.categorical[0]).toBe(defaultTheme.color.brand[500]);
    expect(defaultTheme.color.categorical[1]).toBe(defaultTheme.color.accent[300]);
  });

  it('el tema institucional completo pasa la puerta de contraste', () => {
    expect(findContrastFailures(institutionalContrastChecks(defaultTheme))).toEqual([]);
  });
});

describe('el rojo institucional no puede llevar texto pequeno', () => {
  it('EL ROJO DE MARCA sigue sin admitir texto encima: el hecho no ha cambiado', () => {
    // Es el hecho que ordenaba todo el uso del acento en el tema anterior, y sigue siendo cierto
    // del color de marca: #EF3340 da 4.02:1 sobre blanco.
    const overWhite = contrastRatio(INSTITUTIONAL_SOURCE.acento, '#ffffff') ?? 0;
    expect(overWhite).toBeGreaterThanOrEqual(3); // vale como elemento grafico
    expect(overWhite).toBeLessThan(4.5); // y no como texto
  });

  it('lo que cambia es QUIEN lo resuelve: antes una nota al pie, ahora el sistema', () => {
    // El tema anterior elegia a mano `accent[700]` para el texto en rojo y dejaba escrita una
    // advertencia para quien viniera despues. Ahora el rol derivado ya admite texto encima,
    // porque su tono se calcula para ello y no se escoge.
    expect(
      contrastRatio(defaultTheme.color.textOnBrand, defaultTheme.color.accent[500]) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('el color de error sale del rol `error`, que es donde MD3 lo pone', () => {
    expect(
      contrastRatio(defaultTheme.color.textOnBrand, defaultTheme.color.danger) ?? 0,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('la puerta sigue detectando el uso incorrecto del color de MARCA', () => {
    // Poner el rojo de marca de fondo con texto blanco encima sigue siendo el error que la
    // norma previene, y la puerta tiene que seguir viendolo.
    const fallos = findContrastFailures([
      {
        label: 'texto blanco sobre el rojo de marca',
        foreground: '#ffffff',
        background: INSTITUTIONAL_SOURCE.acento,
      },
    ]);
    expect(fallos).toHaveLength(1);
  });
});
