import { describe, expect, it } from 'vitest';
import { initialCatalog } from '../registry/catalog';
import { OBJECT_FAMILIES } from '../registry/types';
import { OBJECT_ICONS, ICON_NAMES, ICON_STROKES } from './icons';
import {
  PRESENTATION_KEYS,
  MIN_PRESENTATION,
  formatterOf,
  validatePresentation,
  type PresentationKey,
} from './contract';

/** El estandar minimo, como prueba. */
describe('el minimo de personalizacion lo cumple TODO el catalogo', () => {
  const versiones = initialCatalog.flatMap((o) =>
    o.versions.map((v) => ({ objectId: o.objectId, categoria: o.category, version: v })),
  );

  it.each(versiones.map((v) => [`${v.objectId}@${v.version.version}`, v] as const))(
    '%s admite las cuatro claves basicas',
    (_nombre, { version }) => {
      for (const clave of MIN_PRESENTATION) {
        expect(version.presentation).toContain(clave);
      }
    },
  );

  it('ningun objeto declara una clave que no existe en el contrato', () => {
    // La lista sale de `PRESENTATION_KEYS`, no de una copia aqui: una copia se queda
    // obsoleta en cuanto se anade una clave, y entonces la prueba falla por estar desactualizada
    // en vez de por haber encontrado algo.
    const validas = new Set<string>(PRESENTATION_KEYS);
    for (const { objectId, version } of versiones) {
      for (const clave of version.presentation) {
        expect(validas, `${objectId} declara '${clave}'`).toContain(clave);
      }
    }
  });

  it('solo los graficos admiten leyenda y etiquetas de dato', () => {
    // Una tabla con `leyenda` guardaria una opcion que no dibuja nada, y esa es la clase de
    // configuracion muerta que luego nadie se atreve a quitar por si acaso hace algo.
    /*
     * Se RECOGE y se afirma despues, fuera de toda rama.
     *
     * Estaba como `if (categoria !== 'grafico') expect(...)`, y eso no comprueba nada el dia que
     * el catalogo no tenga ningun objeto que no sea grafico: cero vueltas con la condicion cierta,
     * cero aserciones, verde. Es la misma forma que dejo la prueba del registro de auditoria sin
     * mirar nada durante meses. Lo ata `tools/coherence/aserciones.spec.ts`.
     */
    const conLeyendaSinSerlo = versiones
      .filter(({ categoria }) => categoria !== 'grafico')
      .flatMap(({ version, objectId }) =>
        version.presentation
          .filter((c) => (['legend', 'datumLabels'] as PresentationKey[]).includes(c))
          .map((clave) => `${objectId}: ${clave}`),
      );

    expect(conLeyendaSinSerlo).toEqual([]);
  });
});

describe('validatePresentation', () => {
  const todas: PresentationKey[] = [
    ...MIN_PRESENTATION,
    'formato',
    'legend',
    'datumLabels',
  ];

  it('acepta una presentacion completa y valida', () => {
    expect(
      validatePresentation(
        {
          icono: 'balanza',
          acento: 'terciario',
          highlight: true,
          subtitulo: 'Cierre del trimestre',
          formato: { decimales: 1, unit: '%' },
          legend: 'oculta',
          datumLabels: true,
        },
        todas,
      ),
    ).toEqual([]);
  });

  it('rechaza una clave que el objeto no admite, y dice cuales admite', () => {
    const [issue] = validatePresentation({ legend: 'abajo' }, MIN_PRESENTATION);
    expect(issue?.clave).toBe('legend');
    expect(issue?.issue).toContain('icono');
  });

  it('rechaza un icono que no esta en el catalogo', () => {
    const problems = validatePresentation(
      { icono: 'unicornio' as never },
      MIN_PRESENTATION,
    );
    expect(problems.map((p) => p.clave)).toEqual(['icono']);
  });

  it('rechaza un color en vez de un rol de acento', () => {
    // El punto de 4.3: si aqui entrara '#ff0000', la puerta de contraste dejaria de garantizar
    // nada sobre lo que se ve, porque ese color no sale de ningun par comprobado.
    const problems = validatePresentation({ acento: '#ff0000' as never }, MIN_PRESENTATION);
    expect(problems.map((p) => p.clave)).toEqual(['acento']);
  });

  it('rechaza un subtitulo que es un parrafo', () => {
    const problems = validatePresentation({ subtitulo: 'x'.repeat(81) }, MIN_PRESENTATION);
    expect(problems.map((p) => p.clave)).toEqual(['subtitulo']);
  });

  it('rechaza decimales fuera de rango y unidades que son frases', () => {
    const problems = validatePresentation(
      { formato: { decimales: 9, unit: 'casos pendientes' } },
      todas,
    );
    expect(problems.map((p) => p.clave).sort()).toEqual(['formato.decimales', 'formato.unidad']);
  });

  it('no se queja de una instancia sin presentacion', () => {
    expect(validatePresentation(undefined, MIN_PRESENTATION)).toEqual([]);
  });
});

describe('formatterOf', () => {
  // `Intl` separa la cifra de su sufijo compacto con un espacio DURO, que es lo tipograficamente
  // correcto —no se parte de linea entre «12,5» y «k»— y no se ve en el codigo fuente. Se
  // normaliza para que una prueba que falla no muestre dos cadenas identicas.
  const withoutHard = (s: string) => s.replace(/\u00a0/g, ' ');

  it('sin formato, entero con separador de miles', () => {
    expect(formatterOf(undefined)(12500)).toBe('12,500');
  });

  it('respeta los decimales pedidos', () => {
    expect(formatterOf({ decimales: 2 })(12.5)).toBe('12.50');
  });

  it('anade la unidad separada del numero', () => {
    expect(formatterOf({ unit: '%' })(18)).toBe('18 %');
  });

  it('compacta cuando se le pide, sin comerse la precision', () => {
    // Con cero decimales, 12.500 salia «13 k»: el compacto redondea sobre la cifra ya reducida.
    expect(withoutHard(formatterOf({ compacto: true })(12500))).toBe('12.5 k');
    expect(withoutHard(formatterOf({ compacto: true })(12000))).toBe('12 k');
    // Y si alguien pide decimales explicitos, mandan los pedidos.
    expect(withoutHard(formatterOf({ compacto: true, decimales: 0 })(12500))).toBe('13 k');
  });
});

describe('circular y medidor: lo que se rechaza al guardar', () => {
  const withPie: PresentationKey[] = [...MIN_PRESENTATION, 'circular'];
  const withGauge: PresentationKey[] = [...MIN_PRESENTATION, 'medidor'];

  it('un hueco fuera de rango no llega a guardarse', () => {
    // Por encima del limite no queda anillo: el grafico dejaria de decir nada sobre proporciones.
    expect(validatePresentation({ circular: { radioInterior: 95 } }, withPie)).toHaveLength(1);
    expect(validatePresentation({ circular: { radioInterior: 55 } }, withPie)).toEqual([]);
  });

  it('un modo de etiqueta inventado se rechaza', () => {
    const problems = validatePresentation(
      { circular: { labels: 'ambos' as never } },
      withPie,
    );
    expect(problems[0]?.clave).toBe('circular.etiquetas');
  });

  it('un minimo por encima del maximo se rechaza, no se intercambia', () => {
    /*
     * Intercambiarlos al dibujar dejaria pasar el error y pintaria una aguja que nadie pidio.
     * 4.2 manda marcar el mapeo que no cuadra, no arreglarlo por dentro.
     */
    const problems = validatePresentation({ medidor: { minimo: 100, maximo: 10 } }, withGauge);
    expect(problems[0]?.clave).toBe('medidor.maximo');
    expect(validatePresentation({ medidor: { minimo: 0, maximo: 3000 } }, withGauge)).toEqual([]);
  });

  it('un objeto que no las admite las rechaza', () => {
    // Una tabla no tiene porciones ni aguja: la clave sobra y el editor tiene que decirlo.
    expect(validatePresentation({ circular: { radioInterior: 10 } }, MIN_PRESENTATION)).toHaveLength(1);
    expect(validatePresentation({ medidor: { maximo: 10 } }, MIN_PRESENTATION)).toHaveLength(1);
  });
});

describe('los nombres del catalogo', () => {
  it('no hay dos objetos que se llamen igual', () => {
    /*
     * Esta prueba existe porque `barras` y `barras-horizontales` se llamaron los dos «Grafico de
     * barras» durante trece lotes. En la paleta salian dos entradas identicas que solo el icono
     * distinguia, y elegir entre ellas era adivinar. Nada fallaba: un nombre repetido no rompe
     * nada, solo hace imposible elegir.
     */
    const names = initialCatalog.map((o) => o.name);
    const repetidos = names.filter((n, i) => names.indexOf(n) !== i);
    expect(repetidos).toEqual([]);
  });

  it('ni dos con el mismo identificador, que si es el contrato (4.5)', () => {
    const ids = initialCatalog.map((o) => o.objectId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('la familia de cada objeto', () => {
  /*
   * El tipo no puede expresar «obligatoria salvo en dos categorias» sin partir la definicion en
   * dos, asi que la exigencia vive aqui. Sin esta prueba, un objeto nuevo que consuma datos y
   * olvide su familia no falla: aparece en la paleta bajo un grupo vacio o fuera de todos, y solo
   * se nota mirando.
   */
  /*
   * Los complementos tampoco: no se colocan en la rejilla, se adjuntan a otro objeto y tienen su
   * propia pestana. Agruparlos por pregunta no significa nada, porque la pregunta la hace el
   * objeto al que acompanan.
   */
  const WITHOUT_FAMILY = new Set(['elemento', 'contenedor', 'complemento']);

  it('todo objeto que consume datos declara a que pregunta responde', () => {
    for (const objeto of initialCatalog) {
      if (WITHOUT_FAMILY.has(objeto.category)) continue;
      expect(objeto.family, `${objeto.objectId} no declara familia`).toBeDefined();
    }
  });

  it('y los que solo componen la pagina NO la declaran', () => {
    // Un cuadro de texto no responde a ninguna pregunta sobre los datos: ponerle «comparacion»
    // seria rellenar un campo para que no estuviera vacio.
    for (const objeto of initialCatalog) {
      if (!WITHOUT_FAMILY.has(objeto.category)) continue;
      expect(objeto.family, `${objeto.objectId} no deberia declarar familia`).toBeUndefined();
    }
  });

  it('todas las familias declaradas existen', () => {
    for (const objeto of initialCatalog) {
      if (objeto.family === undefined) continue;
      expect(OBJECT_FAMILIES).toContain(objeto.family);
    }
  });
});

describe('el catalogo de iconos', () => {
  it('todos los ofrecidos para un objeto existen', () => {
    for (const nombre of OBJECT_ICONS) expect(ICON_NAMES).toContain(nombre);
  });

  it('ningun trazo esta vacio', () => {
    for (const [nombre, stroke] of Object.entries(ICON_STROKES)) {
      expect(stroke.length, nombre).toBeGreaterThan(4);
    }
  });

  it('el cromo de la aplicacion NO se ofrece para rotular un dato', () => {
    // Un aspa de cerrar encima de una cifra no significa nada, y el editor no deberia poder
    // ofrecerlo solo porque el icono exista.
    expect(OBJECT_ICONS).not.toContain('close');
    expect(OBJECT_ICONS).not.toContain('sandwich');
  });
});

describe('la escala del eje de valores', () => {
  const conEjes = (axes: Record<string, unknown>) =>
    validatePresentation({ axes } as never, ['axes']).map((p) => p.clave);

  it('acepta una escala logaritmica con un minimo positivo', () => {
    expect(conEjes({ scale: 'logaritmica', yMin: 1 })).toEqual([]);
  });

  it('rechaza una escala que no existe', () => {
    expect(conEjes({ scale: 'raiz-cuadrada' })).toEqual(['axes.scale']);
  });

  it('rechaza una logaritmica que empiece en cero o por debajo', () => {
    /*
     * El logaritmo de cero no existe: el grafico se dibujaria con una escala que miente, y asi es
     * como se descubriria — mirandolo. Se rechaza al guardar.
     */
    expect(conEjes({ scale: 'logaritmica', yMin: 0 })).toEqual(['axes.yMin']);
    expect(conEjes({ scale: 'logaritmica', yMin: -5 })).toEqual(['axes.yMin']);
    expect(conEjes({ scale: 'logaritmica', fromZero: true })).toEqual(['axes.fromZero']);
  });

  it('un minimo de cero sigue valiendo en una escala lineal', () => {
    expect(conEjes({ yMin: 0, fromZero: true })).toEqual([]);
  });
});
