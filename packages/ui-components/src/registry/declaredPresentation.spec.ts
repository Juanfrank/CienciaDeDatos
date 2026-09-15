import { describe, expect, it } from 'vitest';
import { optionsOf, type ChartOptions, type ChartKind } from '../charts/options';
import type { CategoricalViewModel } from './viewModel';
import { initialCatalog } from './catalog';
import { PRESENTATION_KEYS, type PresentationKey } from '../presentation/contract';

/**
 * Lo que un objeto DECLARA admitir y lo que su dibujo HONRA tienen que ser lo mismo — 4.2 y 4.5.
 */

const vm: CategoricalViewModel = {
  series: ['Casos', 'Dias'],
  aggregated: false,
  points: [
    { label: 'A', values: [10, 4] },
    { label: 'B', values: [20, 8] },
    { label: 'C', values: [30, 2] },
  ],
};

const PALETTE = {
  series: ['#c1', '#c2', '#c3', '#c4', '#c5', '#c6', '#c7', '#c8'],
  content: '#111111',
  mutedText: '#555555',
  line: '#999999',
  superficie: '#ffffff',
  superficieElevada: '#eeeeee',
};

const BASE: ChartOptions = { vm, palette: PALETTE, titulo: 'T', dimension: 'Tribunal' };

/** DOS valores validos y distintos por clave. */
const VALUES: Partial<Record<PresentationKey, unknown[]>> = {
  leyenda: ['oculta', 'derecha'],
  datumLabels: [
    { mostrar: true, cellPosition: 'dentro' },
    { mostrar: true, onlyEnds: true },
  ],
  tooltip: [{ total: true }, { sortValue: true }],
  ejes: [
    { xTitle: 'X', tituloY: 'Y' },
    { gridlines: false, showX: false },
  ],
  apilado: ['apilado', 'porcentaje'],
  circular: [{ radioInterior: 40 }, { labels: 'categoria', totalEnElCentro: true }],
  medidor: [{ minimo: 0, maximo: 100 }, { maximo: 7 }],
  combinado: [{ axisSecondary: true }, { axisSecondary: false }],
  embudo: [{ compare: 'anterior' }, { compare: 'ninguna' }],
  cascada: [{ showTotal: false }, { showTotal: true }],
  referencias: [[{ valor: 15, etiqueta: 'meta', style: 'discontinua', color: 'primario' }], [{ valor: 5 }]],
  seriesColors: [
    [3, 5],
    [7, 0],
  ],
  condicional: [
    { rules: [{ medida: 'Casos', comparator: 'mayor', valor: 15, color: 'exito' }] },
    { rules: [{ medida: 'Dias', comparator: 'menor', valor: 5, color: 'peligro' }] },
  ],
};

/** Claves que NO decide el constructor de opciones, y que por tanto esta sonda no puede ver. */
const DRAWING_OUTSIDE: PresentationKey[] = PRESENTATION_KEYS.filter(
  (c) => !(c in VALUES),
);

/** Que tipo de grafico dibuja cada objeto del catalogo. Los demas objetos no pasan por aqui. */
const OBJECT_KIND: Record<string, ChartKind> = {
  barras: 'barras',
  'barras-horizontales': 'barras-horizontales',
  lineas: 'lineas',
  area: 'area',
  pastel: 'circular',
  dona: 'circular',
  medidor: 'medidor',
  combinado: 'combinado',
  dispersion: 'dispersion',
  embudo: 'embudo',
  cascada: 'cascada',
  'mapa-de-arbol': 'mapa-de-arbol',
};

/** Lo que el dibujo lee pero el objeto NO declara, a proposito. */
const EXCEPCIONES: { objeto: string; clave: PresentationKey; porque: string }[] = [
  ...['pastel', 'dona', 'medidor', 'embudo', 'cascada', 'mapa-de-arbol'].map((objeto) => ({
    objeto,
    clave: 'seriesColors' as PresentationKey,
    porque:
      'La paleta se remapea, pero estos objetos colorean por CATEGORIA y no por medida: una ' +
      'porcion, una etapa, un rectangulo. El control del panel lista una fila por medida, y aqui ' +
      'solo hay una, asi que ofreceria recolorear «la medida» para cambiar el color de la primera ' +
      'porcion. Elegir el color por categoria es un control distinto, que todavia no existe.',
  })),
  {
    objeto: 'dispersion',
    clave: 'seriesColors',
    porque:
      'Una dispersion dibuja UNA nube de puntos: sus dos o tres medidas son los ejes y el tamano, ' +
      'no series con color propio. El color sale del primer hueco de la paleta, asi que el ' +
      'control del panel listaria una fila por medida de las cuales solo la primera haria algo — ' +
      'que es la otra forma de romper esto, un control que no responde.',
  },
  {
    objeto: 'dispersion',
    clave: 'leyenda',
    porque:
      'Una dispersion tiene UNA serie, que ademas se llama como el grafico: las medidas son los ' +
      'ejes, no series. La leyenda repetiria el titulo de la tarjeta debajo de ella.',
  },
  ...['dispersion', 'cascada'].map((objeto) => ({
    objeto,
    clave: 'apilado' as PresentationKey,
    porque:
      'Aqui no se apila nada. La clave llega al eje de valor compartido, que anade el sufijo «%» ' +
      'cuando el apilado es al 100 %, y a nada mas. Declararla pondria un control que solo puede ' +
      'estropear el eje.',
  })),
];

const esExcepcion = (objeto: string, clave: PresentationKey) =>
  EXCEPCIONES.some((e) => e.objeto === objeto && e.clave === clave);

/** Los `formatter` se comparan LLAMANDOLOS, no por el texto de su fuente. */
const MUESTRA = {
  name: 'A',
  value: 10,
  dataIndex: 0,
  percent: 33,
  seriesName: 'Casos',
  axisValue: 'A',
  data: { name: 'A', value: 10 },
};

const huella = (x: unknown): string =>
  JSON.stringify(x, (_clave, valor: unknown) => {
    if (typeof valor !== 'function') return valor;
    try {
      return `${String(valor(MUESTRA))}|${String(valor([MUESTRA]))}`;
    } catch {
      return String(valor);
    }
  });

/** true si poner la clave cambia lo que se dibuja. */
function honra(tipo: ChartKind, clave: PresentationKey): boolean {
  const sin = huella(optionsOf(tipo, BASE));
  return (VALUES[clave] ?? []).some((valor) => {
    try {
      return huella(optionsOf(tipo, { ...BASE, [clave]: valor } as ChartOptions)) !== sin;
    } catch {
      // Que la construccion reviente con la clave puesta tambien es honrarla: la esta leyendo.
      return true;
    }
  });
}

const charts = initialCatalog.filter((o) => OBJECT_KIND[o.objectId]);
const ultima = (objectId: string) => {
  const o = initialCatalog.find((d) => d.objectId === objectId);
  return o?.versions[o.versions.length - 1];
};

describe('lo que el objeto declara es lo que su dibujo honra', () => {
  it('la sonda cubre todos los graficos del catalogo', () => {
    // Si manana se publica un objeto de tipo nuevo y nadie lo anade a `OBJECT_KIND`, esta
    // prueba pasaria por no mirarlo. Se cuenta para que eso falle.
    expect(charts.map((o) => o.objectId).sort()).toEqual(Object.keys(OBJECT_KIND).sort());
  });

  for (const objeto of charts) {
    const tipo = OBJECT_KIND[objeto.objectId] as ChartKind;

    it(`${objeto.objectId}: no honra en silencio nada que no ofrezca el editor`, () => {
      const declara = new Set(ultima(objeto.objectId)?.presentation ?? []);
      const ocultas = (Object.keys(VALUES) as PresentationKey[]).filter(
        (c) => honra(tipo, c) && !declara.has(c) && !esExcepcion(objeto.objectId, c),
      );

      expect(ocultas).toEqual([]);
    });

    it(`${objeto.objectId}: no ofrece nada que su dibujo ignore`, () => {
      const declara = ultima(objeto.objectId)?.presentation ?? [];
      const muertas = declara.filter(
        (c) => !DRAWING_OUTSIDE.includes(c) && !honra(tipo, c),
      );

      expect(muertas).toEqual([]);
    });
  }
});

describe('las excepciones estan justificadas, no silenciadas', () => {
  it('cada excepcion nombra un objeto y una clave que existen', () => {
    for (const e of EXCEPCIONES) {
      expect(OBJECT_KIND[e.objeto], e.objeto).toBeDefined();
      expect(PRESENTATION_KEYS).toContain(e.clave);
    }
  });

  it('cada excepcion explica POR QUE, con algo mas que una palabra', () => {
    // Un motivo de tres palabras es una excusa; lo que hace util a la lista es poder decidir,
    // al leerla, si sigue valiendo.
    for (const e of EXCEPCIONES) expect(e.porque.length, `${e.objeto}.${e.clave}`).toBeGreaterThan(60);
  });

  it('ninguna excepcion sobra: todas siguen describiendo algo que de verdad pasa', () => {
    /*
     * Una excepcion que ya no hace falta es peor que no tenerla: dice que el dibujo hace algo
     * que dejo de hacer, y quien la lea la creera. Si el objeto deja de leer la clave, o pasa a
     * declararla, la excepcion tiene que desaparecer con ella.
     */
    const sobrantes = EXCEPCIONES.filter((e) => {
      const tipo = OBJECT_KIND[e.objeto] as ChartKind;
      const declara = new Set(ultima(e.objeto)?.presentation ?? []);
      return !honra(tipo, e.clave) || declara.has(e.clave);
    });

    expect(sobrantes.map((e) => `${e.objeto}.${e.clave}`)).toEqual([]);
  });
});

/** Y el resto del contrato, que no es de presentacion pero se olvida igual. */
describe('la version vigente de cada objeto de datos esta completa', () => {
  const withData = initialCatalog.filter((o) => {
    const v = o.versions[o.versions.length - 1];
    return v && !(v.dataContract.dimensions.max === 0 && v.dataContract.measures.max === 0);
  });

  it('hay objetos de datos que comprobar', () => {
    expect(withData.length).toBeGreaterThan(10);
  });

  for (const objeto of withData) {
    const v = objeto.versions[objeto.versions.length - 1];

    it(`${objeto.objectId} ${v?.version}: declara pozos con nombre y ayuda de mapeo`, () => {
      // Se exige a la version VIGENTE y no a todas: una publicada no se toca (4.5), asi que lo
      // que se corrige entra en una version nueva, que es la que el editor ofrece.
      expect(v?.dataContract.wells, 'pozos').toBeDefined();
      expect(v?.dataContract.notes ?? '', 'notes').not.toBe('');
    });
  }
});
