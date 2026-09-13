import { describe, expect, it } from 'vitest';
import { opcionesDe, type OpcionesDeGrafico, type TipoDeGrafico } from '../graficos/opciones';
import type { CategoricalViewModel } from './viewModel';
import { catalogoInicial } from './catalog';
import { CLAVES_DE_PRESENTACION, type ClaveDePresentacion } from '../presentacion/contrato';

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

const PALETA = {
  series: ['#c1', '#c2', '#c3', '#c4', '#c5', '#c6', '#c7', '#c8'],
  texto: '#111111',
  textoAtenuado: '#555555',
  linea: '#999999',
  superficie: '#ffffff',
  superficieElevada: '#eeeeee',
};

const BASE: OpcionesDeGrafico = { vm, paleta: PALETA, titulo: 'T', dimension: 'Tribunal' };

/** DOS valores validos y distintos por clave. */
const VALORES: Partial<Record<ClaveDePresentacion, unknown[]>> = {
  leyenda: ['oculta', 'derecha'],
  etiquetasDeDato: [
    { mostrar: true, posicion: 'dentro' },
    { mostrar: true, soloExtremos: true },
  ],
  tooltip: [{ total: true }, { ordenarPorValor: true }],
  ejes: [
    { tituloX: 'X', tituloY: 'Y' },
    { cuadricula: false, mostrarX: false },
  ],
  apilado: ['apilado', 'porcentaje'],
  circular: [{ radioInterior: 40 }, { etiquetas: 'categoria', totalEnElCentro: true }],
  medidor: [{ minimo: 0, maximo: 100 }, { maximo: 7 }],
  combinado: [{ ejeSecundario: true }, { ejeSecundario: false }],
  embudo: [{ comparar: 'anterior' }, { comparar: 'ninguna' }],
  cascada: [{ mostrarTotal: false }, { mostrarTotal: true }],
  referencias: [[{ valor: 15, etiqueta: 'meta', estilo: 'discontinua', color: 'primario' }], [{ valor: 5 }]],
  coloresDeSerie: [
    [3, 5],
    [7, 0],
  ],
  condicional: [
    { reglas: [{ medida: 'Casos', comparador: 'mayor', valor: 15, color: 'exito' }] },
    { reglas: [{ medida: 'Dias', comparador: 'menor', valor: 5, color: 'peligro' }] },
  ],
};

/** Claves que NO decide el constructor de opciones, y que por tanto esta sonda no puede ver. */
const FUERA_DEL_DIBUJO: ClaveDePresentacion[] = CLAVES_DE_PRESENTACION.filter(
  (c) => !(c in VALORES),
);

/** Que tipo de grafico dibuja cada objeto del catalogo. Los demas objetos no pasan por aqui. */
const TIPO_DE_OBJETO: Record<string, TipoDeGrafico> = {
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
const EXCEPCIONES: { objeto: string; clave: ClaveDePresentacion; porque: string }[] = [
  ...['pastel', 'dona', 'medidor', 'embudo', 'cascada', 'mapa-de-arbol'].map((objeto) => ({
    objeto,
    clave: 'coloresDeSerie' as ClaveDePresentacion,
    porque:
      'La paleta se remapea, pero estos objetos colorean por CATEGORIA y no por medida: una ' +
      'porcion, una etapa, un rectangulo. El control del panel lista una fila por medida, y aqui ' +
      'solo hay una, asi que ofreceria recolorear «la medida» para cambiar el color de la primera ' +
      'porcion. Elegir el color por categoria es un control distinto, que todavia no existe.',
  })),
  {
    objeto: 'dispersion',
    clave: 'coloresDeSerie',
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
    clave: 'apilado' as ClaveDePresentacion,
    porque:
      'Aqui no se apila nada. La clave llega al eje de valor compartido, que anade el sufijo «%» ' +
      'cuando el apilado es al 100 %, y a nada mas. Declararla pondria un control que solo puede ' +
      'estropear el eje.',
  })),
];

const esExcepcion = (objeto: string, clave: ClaveDePresentacion) =>
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
function honra(tipo: TipoDeGrafico, clave: ClaveDePresentacion): boolean {
  const sin = huella(opcionesDe(tipo, BASE));
  return (VALORES[clave] ?? []).some((valor) => {
    try {
      return huella(opcionesDe(tipo, { ...BASE, [clave]: valor } as OpcionesDeGrafico)) !== sin;
    } catch {
      // Que la construccion reviente con la clave puesta tambien es honrarla: la esta leyendo.
      return true;
    }
  });
}

const graficos = catalogoInicial.filter((o) => TIPO_DE_OBJETO[o.objectId]);
const ultima = (objectId: string) => {
  const o = catalogoInicial.find((d) => d.objectId === objectId);
  return o?.versions[o.versions.length - 1];
};

describe('lo que el objeto declara es lo que su dibujo honra', () => {
  it('la sonda cubre todos los graficos del catalogo', () => {
    // Si manana se publica un objeto de tipo nuevo y nadie lo anade a `TIPO_DE_OBJETO`, esta
    // prueba pasaria por no mirarlo. Se cuenta para que eso falle.
    expect(graficos.map((o) => o.objectId).sort()).toEqual(Object.keys(TIPO_DE_OBJETO).sort());
  });

  for (const objeto of graficos) {
    const tipo = TIPO_DE_OBJETO[objeto.objectId] as TipoDeGrafico;

    it(`${objeto.objectId}: no honra en silencio nada que no ofrezca el editor`, () => {
      const declara = new Set(ultima(objeto.objectId)?.presentation ?? []);
      const ocultas = (Object.keys(VALORES) as ClaveDePresentacion[]).filter(
        (c) => honra(tipo, c) && !declara.has(c) && !esExcepcion(objeto.objectId, c),
      );

      expect(ocultas).toEqual([]);
    });

    it(`${objeto.objectId}: no ofrece nada que su dibujo ignore`, () => {
      const declara = ultima(objeto.objectId)?.presentation ?? [];
      const muertas = declara.filter(
        (c) => !FUERA_DEL_DIBUJO.includes(c) && !honra(tipo, c),
      );

      expect(muertas).toEqual([]);
    });
  }
});

describe('las excepciones estan justificadas, no silenciadas', () => {
  it('cada excepcion nombra un objeto y una clave que existen', () => {
    for (const e of EXCEPCIONES) {
      expect(TIPO_DE_OBJETO[e.objeto], e.objeto).toBeDefined();
      expect(CLAVES_DE_PRESENTACION).toContain(e.clave);
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
      const tipo = TIPO_DE_OBJETO[e.objeto] as TipoDeGrafico;
      const declara = new Set(ultima(e.objeto)?.presentation ?? []);
      return !honra(tipo, e.clave) || declara.has(e.clave);
    });

    expect(sobrantes.map((e) => `${e.objeto}.${e.clave}`)).toEqual([]);
  });
});

/** Y el resto del contrato, que no es de presentacion pero se olvida igual. */
describe('la version vigente de cada objeto de datos esta completa', () => {
  const conDatos = catalogoInicial.filter((o) => {
    const v = o.versions[o.versions.length - 1];
    return v && !(v.dataContract.dimensions.max === 0 && v.dataContract.measures.max === 0);
  });

  it('hay objetos de datos que comprobar', () => {
    expect(conDatos.length).toBeGreaterThan(10);
  });

  for (const objeto of conDatos) {
    const v = objeto.versions[objeto.versions.length - 1];

    it(`${objeto.objectId} ${v?.version}: declara pozos con nombre y ayuda de mapeo`, () => {
      // Se exige a la version VIGENTE y no a todas: una publicada no se toca (4.5), asi que lo
      // que se corrige entra en una version nueva, que es la que el editor ofrece.
      expect(v?.dataContract.pozos, 'pozos').toBeDefined();
      expect(v?.dataContract.notes ?? '', 'notes').not.toBe('');
    });
  }
});
