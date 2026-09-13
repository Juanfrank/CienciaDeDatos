import { describe, expect, it } from 'vitest';
import { CATALOGOS, createTranslator, es, formatMessage, LOCALES } from './index';
import { negotiateLocale, headerPreferences } from './locales';

/**
 * Los catalogos no pueden discrepar.
 *
 * El tipo obliga a que el ingles tenga las mismas claves que el espanol, pero no ve lo que hay
 * DENTRO del mensaje: un traductor que se come un `{consulta}` produce una frase sin el dato, y
 * uno que escribe `{query}` produce una llave literal en pantalla. Ninguna de las dos cosas falla
 * al compilar ni al dibujar.
 */

/** Los argumentos ICU de un mensaje, sin importar su tipo ni sus opciones. */
function argumentosDe(mensaje: string): string[] {
  const names = new Set<string>();
  const re = /\{\s*([a-zA-Z0-9_]+)\s*(?:,|\})/g;
  let m = re.exec(mensaje);
  while (m) {
    names.add(m[1] as string);
    m = re.exec(mensaje);
  }
  return [...names].sort();
}

describe('catalogos', () => {
  const keys = Object.keys(es) as (keyof typeof es)[];

  it('hay catalogo para cada idioma admitido', () => {
    expect(Object.keys(CATALOGOS).sort()).toEqual([...LOCALES].sort());
  });

  for (const locale of LOCALES) {
    it(`${locale}: tiene exactamente las claves del catalogo de referencia`, () => {
      expect(Object.keys(CATALOGOS[locale]).sort()).toEqual([...keys].sort());
    });

    it(`${locale}: ningun mensaje esta vacio`, () => {
      const vacios = keys.filter((c) => CATALOGOS[locale][c].trim() === '');
      expect(vacios).toEqual([]);
    });

    it(`${locale}: cada mensaje usa los mismos argumentos que el de referencia`, () => {
      const distintos = keys.filter(
        (c) =>
          argumentosDe(CATALOGOS[locale][c]).join(',') !== argumentosDe(es[c]).join(','),
      );
      expect(distintos).toEqual([]);
    });

    it(`${locale}: ningun mensaje deja un argumento sin cerrar`, () => {
      const rotos = keys.filter((c) => {
        const content = CATALOGOS[locale][c];
        let profundidad = 0;
        for (const caracter of content) {
          if (caracter === '{') profundidad++;
          else if (caracter === '}') profundidad--;
          if (profundidad < 0) return true;
        }
        return profundidad !== 0;
      });
      expect(rotos).toEqual([]);
    });
  }

  it('ningun mensaje es un fragmento pensado para concatenarse', () => {
    // Una cadena que empieza o acaba en espacio solo tiene sentido pegada a otra, y eso no se
    // puede traducir: el orden de las palabras cambia entre idiomas.
    for (const locale of LOCALES) {
      const fragmentos = keys.filter((c) => CATALOGOS[locale][c] !== CATALOGOS[locale][c].trim());
      expect(fragmentos, locale).toEqual([]);
    }
  });
});

describe('formato ICU', () => {
  it('interpola por nombre', () => {
    expect(formatMessage('Hola {quien}', { quien: 'Ana' })).toBe('Hola Ana');
  });

  it('deja visible el argumento que no recibe valor', () => {
    // `undefined` en mitad de una frase parece un dato; `{total}` dice que falta un parametro.
    expect(formatMessage('Van {total}')).toBe('Van {total}');
  });

  it('elige la forma plural por idioma y sustituye la almohadilla', () => {
    const mensaje = '{n, plural, one {# panel} other {# paneles}}';
    expect(formatMessage(mensaje, { n: 1 }, 'es')).toBe('1 panel');
    expect(formatMessage(mensaje, { n: 4 }, 'es')).toBe('4 paneles');
  });

  it('la forma exacta gana a la categoria', () => {
    const mensaje = '{n, plural, =0 {ninguno} one {uno} other {# de ellos}}';
    expect(formatMessage(mensaje, { n: 0 })).toBe('ninguno');
    expect(formatMessage(mensaje, { n: 7 })).toBe('7 de ellos');
  });

  it('anida argumentos dentro de una opcion', () => {
    const mensaje = '{n, plural, one {Falta {fieldName}} other {Faltan {n} campos}}';
    expect(formatMessage(mensaje, { n: 1, fieldName: 'Distrito' })).toBe('Falta Distrito');
    expect(formatMessage(mensaje, { n: 3, fieldName: 'Distrito' })).toBe('Faltan 3 campos');
  });

  it('selecciona por valor', () => {
    const mensaje = '{estado, select, roto {Roto} other {Correcto}}';
    expect(formatMessage(mensaje, { estado: 'roto' })).toBe('Roto');
    expect(formatMessage(mensaje, { estado: 'otro' })).toBe('Correcto');
  });

  it('formatea numeros con las reglas del idioma', () => {
    expect(formatMessage('{n, number}', { n: 2216 }, 'en')).toBe('2,216');
  });
});

describe('traductor', () => {
  it('devuelve el mensaje del idioma pedido', () => {
    expect(createTranslator('en')('accion.guardar')).toBe('Save');
    expect(createTranslator('es')('accion.guardar')).toBe('Guardar');
  });

  it('trae los formateadores de Intl atados al mismo idioma', () => {
    const t = createTranslator('en');
    expect(t.numero(2216)).toBe('2,216');
    expect(t.lista(['a', 'b', 'c'])).toBe('a, b, and c');
  });

  it('un idioma desconocido cae al de referencia en vez de romper', () => {
    expect(createTranslator('pt' as 'es')('accion.guardar')).toBe('Guardar');
  });
});

describe('negociacion de idioma', () => {
  it('compara por la subetiqueta primaria', () => {
    expect(negotiateLocale(['es-DO'])).toBe('es');
    expect(negotiateLocale(['en-US'])).toBe('en');
  });

  it('cae al idioma de la aplicacion cuando ninguno coincide', () => {
    expect(negotiateLocale(['fr-FR', 'de'])).toBe('es');
    expect(negotiateLocale([])).toBe('es');
  });

  it('ordena las preferencias de una cabecera por calidad', () => {
    expect(headerPreferences('fr;q=0.5,en;q=0.9,es;q=0.1')).toEqual(['en', 'fr', 'es']);
    expect(negotiateLocale(headerPreferences('fr;q=0.5,en;q=0.9'))).toBe('en');
  });
});
