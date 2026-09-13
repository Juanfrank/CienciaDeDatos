import {
  MAX_RADIO_INTERIOR,
  MAX_REFERENCIAS,
  etiquetasNormalizadas,
  type ConfiguracionCircular,
  type ComparacionDeEmbudo,
  type ConfiguracionDeCascada,
  type ConfiguracionDeCombinado,
  type ConfiguracionDeEmbudo,
  type ConfiguracionDeEjes,
  type ConfiguracionDeMedidor,
  type EstiloDeReferencia,
  type ConfiguracionDeEtiquetas,
  type ConfiguracionDeTooltip,
  type EtiquetaCircular,
  type EtiquetasDeDato,
  type LineaDeReferencia,
  type ModoDeApilado,
  type ModoDeLeyenda,
} from '../presentacion/contrato';
import { colorCondicional, type FormatoCondicional } from '../presentacion/condicional';
import type { CategoricalViewModel } from '../registry/viewModel';

/**
 * Construccion de las opciones de Apache ECharts (4.2).
 *
 * Funciones puras: reciben el modelo de vista y la paleta y devuelven el objeto de opciones. No
 * tocan el DOM ni importan ECharts, asi que se prueban sin navegador. El montaje vive en el shell.
 */

export interface PaletaDeGrafico {
  /** Ocho colores de serie, del tema institucional. */
  series: string[];
  texto: string;
  textoAtenuado: string;
  linea: string;
  superficie: string;
  superficieElevada: string;
}

export interface OpcionesDeGrafico {
  vm: CategoricalViewModel;
  paleta: PaletaDeGrafico;
  titulo: string;
  /** Nombre de la dimension del eje, para el rotulo accesible. */
  dimension?: string;
  leyenda?: ModoDeLeyenda;
  /** La cifra sobre cada barra o punto. `true` es la forma anterior y se sigue admitiendo. */
  etiquetasDeDato?: EtiquetasDeDato;
  tooltip?: ConfiguracionDeTooltip;
  ejes?: ConfiguracionDeEjes;
  /** Como formatear una cifra de la serie `s`. */
  formatear?: (valor: number, serie: number) => string;
  apilado?: ModoDeApilado;
  circular?: ConfiguracionCircular;
  combinado?: ConfiguracionDeCombinado;
  referencias?: LineaDeReferencia[];
  coloresDeSerie?: number[];
  condicional?: FormatoCondicional;
  embudo?: ConfiguracionDeEmbudo;
  cascada?: ConfiguracionDeCascada;
  medidor?: ConfiguracionDeMedidor;
  /** Cuantas series iniciales son columnas, en un combinado. */
  seriesDeColumna?: number;
}

/* ── Apilado ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Los valores que se dibujan, segun el modo de apilado.
 *
 * En `porcentaje` se convierten a su parte del total de la categoria: `stack` de ECharts suma,
 * no reparte. Un total de cero deja las partes en cero y no en `NaN`.
 */
function valoresApilados(o: OpcionesDeGrafico): (number | null)[][] {
  const crudos = o.vm.series.map((_, s) => o.vm.points.map((p) => p.values[s] ?? null));
  if (o.apilado !== 'porcentaje') return crudos;

  return crudos.map((serie, s) =>
    serie.map((valor, i) => {
      if (valor === null) return null;
      const total = o.vm.series.reduce((suma, _, otra) => suma + (o.vm.points[i]?.values[otra] ?? 0), 0);
      void s;
      return total === 0 ? 0 : (valor / total) * 100;
    }),
  );
}

/** `stack` de ECharts: el mismo nombre en todas las series es lo que las apila. */
const pilaDe = (o: OpcionesDeGrafico) => (o.apilado && o.apilado !== 'ninguno' ? { stack: 'total' } : {});

/** El tooltip de un grafico al 100 %. */
function tooltipDe(o: OpcionesDeGrafico) {
  const comun = {
    trigger: 'axis' as const,
    backgroundColor: o.paleta.superficieElevada,
    borderWidth: 0,
    textStyle: { color: o.paleta.texto },
    extraCssText: 'box-shadow: none;',
  };

  const porcentaje = o.apilado === 'porcentaje';
  const conTotal = o.tooltip?.total === true;
  const ordenar = o.tooltip?.ordenarPorValor === true;
  // Sin nada que anadir, se deja el tooltip de ECharts: formatea igual y no cuesta nada.
  if (!porcentaje && !conTotal && !ordenar) return comun;

  return {
    ...comun,
    formatter: (params: { name: string; seriesName: string; value: number; dataIndex: number }[]) => {
      const punto = params[0];
      if (!punto) return '';

      /*
       * Se vuelve al MODELO para cada fila, en vez de usar el valor que ECharts pasa.
       */
      const crudoDe = (nombreDeSerie: string, i: number) =>
        o.vm.points[i]?.values[o.vm.series.indexOf(nombreDeSerie)] ?? null;
      const formatear = (n: number, serie: string) =>
        o.formatear?.(n, o.vm.series.indexOf(serie)) ?? String(n);

      const filas = params.map((p) => {
        const crudo = crudoDe(p.seriesName, p.dataIndex);
        const cifra = crudo === null ? '—' : formatear(crudo, p.seriesName);
        return {
          orden: crudo ?? Number.NEGATIVE_INFINITY,
          texto: porcentaje
            ? `${p.seriesName}: ${p.value.toFixed(1)} % (${cifra})`
            : `${p.seriesName}: ${cifra}`,
        };
      });
      // Los nulos quedan al final: no compiten por «el mayor», porque no son un numero.
      if (ordenar) filas.sort((a, b) => b.orden - a.orden);

      const lineas = [punto.name, ...filas.map((f) => f.texto)];
      if (conTotal) {
        const suma = params.reduce((total, p) => total + (crudoDe(p.seriesName, p.dataIndex) ?? 0), 0);
        // El total usa el formato de la PRIMERA serie: es una suma de las medidas apiladas, que
        // por construccion comparten unidad; usar otro dejaria «2,216» junto a «2216».
        lineas.push(`Total: ${formatear(suma, o.vm.series[0] ?? '')}`);
      }
      return lineas.join('<br/>');
    },
  };
}

/**
 * Donde poner la leyenda, resuelto, y cuanto margen hay que reservarle.
 *
 * `auto` la ensena solo con mas de una serie. El margen se devuelve aparte porque `containLabel`
 * de ECharts cuenta los rotulos del eje pero no la leyenda.
 */
function leyendaDe(o: OpcionesDeGrafico, hayQueDistinguir = o.vm.series.length > 1) {
  const varias = hayQueDistinguir;
  const mode: ModoDeLeyenda = o.leyenda ?? 'auto';
  const visible = mode === 'auto' ? varias : mode !== 'oculta';
  if (!visible) return { legend: { show: false }, margen: { bottom: 8, left: 8, right: 16, top: 24 } };

  /*
   * A los lados, la leyenda se ACOTA y trunca.
   */
  /*
   * `type: 'scroll'` en TODAS las posiciones.
   */
  const comun = {
    textStyle: { color: o.paleta.textoAtenuado },
    icon: 'roundRect' as const,
    type: 'scroll' as const,
    pageIconColor: o.paleta.textoAtenuado,
    pageTextStyle: { color: o.paleta.textoAtenuado },
  };
  const aLosLados = {
    ...comun,
    textStyle: { color: o.paleta.textoAtenuado, width: 96, overflow: 'truncate' as const },
  };
  const lado = mode === 'auto' ? 'abajo' : mode;

  switch (lado) {
    case 'arriba':
      return { legend: { ...comun, top: 0 }, margen: { bottom: 8, left: 8, right: 16, top: 36 } };
    case 'izquierda':
      return {
        legend: { ...aLosLados, left: 0, top: 'middle', orient: 'vertical' as const },
        margen: { bottom: 8, left: 130, right: 16, top: 24 },
      };
    case 'derecha':
      return {
        legend: { ...aLosLados, right: 0, top: 'middle', orient: 'vertical' as const },
        margen: { bottom: 8, left: 8, right: 130, top: 24 },
      };
    default:
      return { legend: { ...comun, bottom: 0 }, margen: { bottom: 32, left: 8, right: 16, top: 24 } };
  }
}

/**
 * Lo que comparten todos los graficos.
 *
 * `aria.enabled` hace que ECharts describa el grafico en el contenedor y `aria.decal.show` dibuja
 * un patron distinto sobre cada serie, para que el color no sea el unico medio de distinguirlas
 * (WCAG 1.4.1). El decal solo se activa con mas de una serie: con una sola no distingue nada.
 */
/*
 * El margen del area de dibujo, con todo lo que vive fuera de ella.
 *
 * `containLabel` reserva sitio para los rotulos del eje, pero no para la leyenda ni para los
 * titulos de los ejes: esos se suman aqui.
 */
function margenDe(o: OpcionesDeGrafico, deLaLeyenda: { top: number; bottom: number; left: number; right: number }) {
  return {
    ...deLaLeyenda,
    left: deLaLeyenda.left + (o.ejes?.tituloY ? 44 : 0),
    bottom: deLaLeyenda.bottom + (o.ejes?.tituloX ? 24 : 0),
  };
}

/**
 * La paleta, con los colores que cada serie tenga asignados.
 *
 * Se permuta el array que ECharts consume en vez de escribir `itemStyle.color` por serie: asi el
 * color llega igual a las barras, la leyenda, los decals y el tooltip. Una serie sin asignacion
 * conserva el color que le tocaba por orden.
 */
function paletaDe(o: OpcionesDeGrafico): string[] {
  const elegidos = o.coloresDeSerie;
  if (!elegidos || elegidos.length === 0) return o.paleta.series;
  return o.paleta.series.map((porOrden, s) => {
    const indice = elegidos[s];
    return indice === undefined ? porOrden : (o.paleta.series[indice] ?? porOrden);
  });
}

const TRAZO_DE_REFERENCIA: Record<EstiloDeReferencia, 'solid' | 'dashed' | 'dotted'> = {
  solida: 'solid',
  discontinua: 'dashed',
  punteada: 'dotted',
};

/**
 * Las lineas de referencia, como `markLine` de la primera serie.
 *
 * En una serie existente y no en una propia, que apareceria en la leyenda como un dato mas;
 * `silent: true` por lo mismo. El eje al que se anclan lo decide `horizontal`.
 */
function referenciasDe(o: OpcionesDeGrafico, horizontal = false) {
  const lineas = (o.referencias ?? []).slice(0, MAX_REFERENCIAS);
  if (lineas.length === 0) return {};

  return {
    markLine: {
      silent: true,
      symbol: 'none' as const,
      // `emphasis` apagado: sin esto, pasar cerca engorda la raya como si fuera seleccionable.
      emphasis: { disabled: true },
      data: lineas.map((linea) => ({
        [horizontal ? 'xAxis' : 'yAxis']: linea.valor,
        lineStyle: {
          color: colorDeRol(o, linea.color),
          type: TRAZO_DE_REFERENCIA[linea.estilo ?? 'discontinua'],
          width: 2,
        },
        label: {
          show: linea.etiqueta !== undefined && linea.etiqueta !== '',
          formatter: linea.etiqueta ?? '',
          position: horizontal ? ('end' as const) : ('insideEndTop' as const),
          color: colorDeRol(o, linea.color),
          fontSize: 11,
        },
      })),
    },
  };
}

/**
 * Un rol del tema a un color concreto, dentro del grafico.
 *
 * El grafico es una funcion pura y no lee variables CSS: trabaja con lo que la paleta le pasa.
 * `primario` y `error` son sus dos primeros colores de serie; el resto cae al color de texto.
 */
function colorDeRol(o: OpcionesDeGrafico, color: LineaDeReferencia['color']): string {
  switch (color) {
    case 'primario':
      return o.paleta.series[0] ?? o.paleta.texto;
    case 'error':
      return o.paleta.series[1] ?? o.paleta.texto;
    case 'atenuado':
      return o.paleta.textoAtenuado;
    default:
      return o.paleta.texto;
  }
}

function nucleo(o: OpcionesDeGrafico, conDecal: boolean) {
  return {
    aria: {
      enabled: true,
      decal: { show: conDecal },
      label: {
        enabled: true,
        general: {
          withTitle: o.dimension
            ? `Grafico: ${o.titulo}, por ${o.dimension}.`
            : `Grafico: ${o.titulo}.`,
        },
      },
    },
    color: paletaDe(o),
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { color: o.paleta.texto },
  };
}

/** Lo comun a los graficos CON ejes. */
/**
 * Empuja hacia dentro las cifras de los puntos que tocan el borde.
 *
 * Con `boundaryGap: false` el primer punto cae sobre el eje y su cifra pisa el rotulo de la
 * escala. Ampliar el margen no sirve —`containLabel` lo recalcula— asi que se mueve la etiqueta
 * por su indice con `labelLayout`. Solo la primera y la ultima caen fuera del area.
 */
function desplazarEtiquetasDelBorde(o: OpcionesDeGrafico) {
  if (etiquetasNormalizadas(o.etiquetasDeDato).mostrar !== true) return {};
  const ultimo = o.vm.points.length - 1;
  return {
    labelLayout: (p: { dataIndex: number }) => {
      if (p.dataIndex === 0) return { dx: 16 };
      if (p.dataIndex === ultimo) return { dx: -16 };
      return {};
    },
  };
}

function base(o: OpcionesDeGrafico) {
  const { legend, margen } = leyendaDe(o);
  return {
    ...nucleo(o, o.vm.series.length > 1),
    /*
     * El margen inferior reserva sitio para la leyenda cuando la hay.
     */
    grid: { ...margenDe(o, margen), containLabel: true },
    tooltip: tooltipDe(o),
    legend,
  };
}

/** La etiqueta sobre cada barra o punto. */
const POSICION_ECHARTS: Record<string, string | undefined> = {
  auto: undefined,
  encima: 'top',
  debajo: 'bottom',
  dentro: 'inside',
};

/** Los indices del maximo y el minimo de una serie. */
function extremosDe(o: OpcionesDeGrafico, s: number): Set<number> {
  let masAlto: number | undefined;
  let masBajo: number | undefined;
  o.vm.points.forEach((punto, i) => {
    const valor = punto.values[s];
    if (valor === null || valor === undefined) return;
    if (masAlto === undefined || valor > (o.vm.points[masAlto]?.values[s] ?? 0)) masAlto = i;
    if (masBajo === undefined || valor < (o.vm.points[masBajo]?.values[s] ?? 0)) masBajo = i;
  });
  return new Set([masAlto, masBajo].filter((i): i is number => i !== undefined));
}

const etiquetaDeSerie = (o: OpcionesDeGrafico, s: number, posicion: string) => {
  const config: ConfiguracionDeEtiquetas = etiquetasNormalizadas(o.etiquetasDeDato);
  if (config.mostrar !== true) return { show: false };

  const elegida = POSICION_ECHARTS[config.posicion ?? 'auto'] ?? posicion;
  const extremos = config.soloExtremos ? extremosDe(o, s) : undefined;

  return {
    show: true,
    position: elegida,
    color: o.paleta.texto,
    fontSize: 11,
    /*
     * «Solo los extremos» se resuelve en el FORMATTER, devolviendo cadena vacia.
     */
    formatter: (p: { value: number; dataIndex: number }) => {
      if (extremos && !extremos.has(p.dataIndex)) return '';
      return o.formatear ? o.formatear(p.value, s) : String(p.value);
    },
  };
};

const ejeCategoria = (o: OpcionesDeGrafico) => ({
  type: 'category' as const,
  show: o.ejes?.mostrarX !== false,
  data: o.vm.points.map((p) => p.label),
  axisLabel: {
    color: o.paleta.textoAtenuado,
  /*
   * Girados, los rotulos se dejan de esconder.
   *
   * `hideOverlap` es lo correcto en horizontal, pero esconde sin avisar; quien gira los rotulos
   * lo hace para verlos todos.
   */
    hideOverlap: !o.ejes?.rotarX,
    ...(o.ejes?.rotarX ? { rotate: o.ejes.rotarX } : {}),
  },
  axisLine: { lineStyle: { color: o.paleta.linea } },
  axisTick: { show: false },
  /*
   * El titulo del eje se pone A MANO o no se pone.
   */
  ...(o.ejes?.tituloX
    ? {
        name: o.ejes.tituloX,
        nameLocation: 'middle' as const,
        nameGap: 28,
        nameTextStyle: { color: o.paleta.textoAtenuado },
      }
    : {}),
  /*
   * El nombre de la dimension NO se rotula en el eje.
   */
});

const ejeValor = (o: OpcionesDeGrafico) => ({
  type: 'value' as const,
  show: o.ejes?.mostrarY !== false,
  /*
   * Los limites, en orden de quien manda: el 100 % los impone (0 a 100), luego lo escrito a
   * mano, y si no hay nada, ECharts.
   */
  ...(o.apilado === 'porcentaje'
    ? { max: 100, min: 0 }
    : {
        ...(o.ejes?.minimoY === undefined ? {} : { min: o.ejes.minimoY }),
        ...(o.ejes?.maximoY === undefined ? {} : { max: o.ejes.maximoY }),
      }),
  axisLabel: {
    color: o.paleta.textoAtenuado,
    ...(o.apilado === 'porcentaje' ? { formatter: '{value} %' } : {}),
  },
  splitLine: {
    show: o.ejes?.cuadricula !== false,
    lineStyle: { color: o.paleta.linea, type: 'dashed' as const },
  },
  /*
   * El eje empieza en cero salvo que alguien decida lo contrario.
   *
   * `scale: true` de ECharts ajusta el minimo a los datos, y con eso una diferencia del 2 % entre
   * dos barras parece el triple.
   */
  scale: o.ejes?.desdeCero === false,
  /*
   * El titulo del eje de valores va rotado y a media altura: arriba, que es donde ECharts lo pone
   * por omision, se dibuja encima del rotulo mas alto de la escala.
   */
  ...(o.ejes?.tituloY
    ? {
        name: o.ejes.tituloY,
        nameLocation: 'middle' as const,
        nameRotate: 90,
        nameGap: 44,
        nameTextStyle: { color: o.paleta.textoAtenuado },
      }
    : {}),
});

/** Las series de un grafico de barras, verticales u horizontales. */
/**
 * Los datos de una serie, con el color que le toque a cada barra por su valor.
 *
 * Devuelve el array de numeros tal cual salvo que haya reglas y alguna case: ECharts consume los
 * numeros sueltos mas rapido que los objetos. Al 100 % la regla se evalua sobre el valor ORIGINAL
 * y no sobre la parte, porque habla de casos y no de cuanto ocupa la barra.
 */
function barrasConColor(o: OpcionesDeGrafico, datos: (number | null)[], s: number) {
  if (!o.condicional || o.condicional.reglas.length === 0) return datos;
  const medida = o.vm.series[s];

  let alguna = false;
  const conColor = datos.map((valor, i) => {
    const original = o.vm.points[i]?.values[s] ?? null;
    const color = colorCondicional(o.condicional, original, medida);
    if (color === undefined) return valor;
    alguna = true;
    return { value: valor, itemStyle: { color: colorDeRol(o, color) } };
  });
  return alguna ? conColor : datos;
}

function seriesDeBarras(o: OpcionesDeGrafico, horizontal: boolean) {
  const datos = valoresApilados(o);
  const apilada = o.apilado && o.apilado !== 'ninguno';

  return o.vm.series.map((nombre, s) => ({
    name: nombre,
    type: 'bar',
    data: barrasConColor(o, datos[s] ?? [], s),
    ...pilaDe(o),
    /*
     * La esquina redondeada solo en la barra SUELTA.
     */
    itemStyle: apilada
      ? {}
      : { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    barMaxWidth: 48,
    // Apilada, la cifra va DENTRO del segmento: encima se dibujaria sobre el segmento siguiente.
    label: etiquetaDeSerie(o, s, apilada ? 'inside' : horizontal ? 'right' : 'top'),
    // Las referencias cuelgan de la PRIMERA serie: son del grafico, no de una medida, y en una
    // serie cualquiera desaparecerian al ocultar esa medida desde la leyenda.
    ...(s === 0 ? referenciasDe(o, horizontal) : {}),
    emphasis: { focus: 'series' },
  }));
}

/** Columnas verticales. Una serie por medida mapeada. */
export function opcionesDeBarras(o: OpcionesDeGrafico): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: ejeCategoria(o),
    yAxis: ejeValor(o),
    series: seriesDeBarras(o, false),
  };
}

/**
 * Barras horizontales.
 *
 * El mismo objeto que las columnas con los ejes intercambiados; cual es la categoria y cual el
 * valor lo decide quien construye, no ECharts.
 */
export function opcionesDeBarrasHorizontales(o: OpcionesDeGrafico): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: ejeValor(o),
    yAxis: {
      ...ejeCategoria(o),
      /*
       * Se invierte el eje de categorias: ECharts numera el vertical de abajo arriba, asi que sin
       * esto la primera categoria del modelo sale abajo y la lista se lee al reves.
       */
      inverse: true,
    },
    series: seriesDeBarras(o, true),
  };
}

/** Area. Es una linea con el relleno debajo. */
export function opcionesDeArea(o: OpcionesDeGrafico): Record<string, unknown> {
  const datos = valoresApilados(o);
  return {
    ...base(o),
    xAxis: { ...ejeCategoria(o), boundaryGap: false },
    yAxis: ejeValor(o),
    series: o.vm.series.map((nombre, s) => ({
      name: nombre,
      type: 'line',
      data: datos[s] ?? [],
      ...pilaDe(o),
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2 },
      /*
       * Sin apilar, el relleno va semitransparente: con varias areas opacas la de delante tapa a
       * las de atras. Apiladas no se solapan y el relleno solido hace legible la composicion.
       */
      areaStyle: o.apilado && o.apilado !== 'ninguno' ? {} : { opacity: 0.25 },
      label: etiquetaDeSerie(o, s, 'top'),
      ...desplazarEtiquetasDelBorde(o),
      ...(s === 0 ? referenciasDe(o) : {}),
      emphasis: { focus: 'series' },
    })),
  };
}

/** Lineas. `smooth` desactivado: una curva inventa valores entre dos puntos medidos. */
export function opcionesDeLineas(o: OpcionesDeGrafico): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: { ...ejeCategoria(o), boundaryGap: false },
    yAxis: ejeValor(o),
    series: o.vm.series.map((nombre, s) => ({
      name: nombre,
      type: 'line',
      data: o.vm.points.map((p) => p.values[s] ?? 0),
      smooth: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      label: etiquetaDeSerie(o, s, 'top'),
      ...desplazarEtiquetasDelBorde(o),
      ...(s === 0 ? referenciasDe(o) : {}),
      emphasis: { focus: 'series' },
    })),
  };
}

/* ── Circular: pastel y dona ──────────────────────────────────────────────────────────────── */

/**
 * Las porciones que se dibujan.
 *
 * Un valor nulo se DESCARTA, no se dibuja como cero: `null` es «no hay respuesta», y una porcion
 * de cero afirmaria que la categoria no aporto nada y alteraria el total del que sale cada parte.
 */
function porcionesDe(o: OpcionesDeGrafico): { name: string; value: number }[] {
  const porciones = o.vm.points
    .map((p) => ({ name: p.label, valor: p.values[0] ?? null }))
    .filter((p): p is { name: string; valor: number } => p.valor !== null)
    .map((p) => ({ name: p.name, value: p.valor }));

  // Ordenadas de mayor a menor por defecto: dos areas parecidas solo se distinguen si estan una
  // al lado de la otra, y ese es justo el caso en el que un circular se lee mal.
  return o.circular?.ordenar === false ? porciones : [...porciones].sort((a, b) => b.value - a.value);
}

/**
 * La etiqueta de una porcion, con el porcentaje calculado aqui y no con el `{d}` de ECharts.
 *
 * `{d}` sale con dos decimales y no cabe en una tarjeta estrecha.
 */
const etiquetaDePorcion = (
  mode: EtiquetaCircular,
  formatear: (n: number) => string,
  total: number,
) => {
  const parte = (valor: number) => (total === 0 ? '—' : `${((valor / total) * 100).toFixed(1)} %`);
  return (p: { name: string; value: number }) => {
    switch (mode) {
      case 'categoria':
        return p.name;
      case 'valor':
        return formatear(p.value);
      case 'porcentaje':
        return parte(p.value);
      case 'categoria-porcentaje':
        return `${p.name}: ${parte(p.value)}`;
      default:
        return '';
    }
  };
};

/** Cuanto circulo queda, segun lo que ocupe la etiqueta que vive fuera de el. */
const RADIO_EXTERIOR: Record<EtiquetaCircular, string> = {
  ninguna: '72%',
  porcentaje: '62%',
  valor: '62%',
  categoria: '54%',
  'categoria-porcentaje': '50%',
};

/**
 * Pastel y dona — la proporcion, no la magnitud.
 *
 * Un solo constructor para los dos objetos del catalogo: el contrato de datos es identico y el
 * hueco del centro es una propiedad. Solo lee la primera medida, como fija `measures: { max: 1 }`.
 */
export function opcionesDeCircular(o: OpcionesDeGrafico): Record<string, unknown> {
  const c = o.circular ?? {};
  const hueco = Math.min(Math.max(c.radioInterior ?? 0, 0), MAX_RADIO_INTERIOR);
  const porciones = porcionesDe(o);
  const total = porciones.reduce((suma, p) => suma + p.value, 0);
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const mode: EtiquetaCircular = c.labels ?? 'porcentaje';

  /*
   * Aqui la leyenda distingue CATEGORIAS, no series: en un circular siempre hay una serie, asi
   * que `auto` la ocultaria siempre y un pastel sin leyenda es una rueda de colores sin nombre.
   */
  const { legend } = leyendaDe(o, porciones.length > 1);

  return {
    ...nucleo(o, porciones.length > 1),
    legend,
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
      // La cifra Y su parte del total: un porcentaje suelto no se puede auditar contra la tabla.
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/>${formatear(p.value)} (${p.percent} %)`,
    },
    /*
     * El total en el centro, solo si hay centro: con hueco cero la cifra caeria sobre las porciones.
     */
    ...(c.totalEnElCentro && hueco > 0
      ? {
          title: {
            text: formatear(total),
            subtext: 'Total',
            left: 'center',
            top: 'center',
            textStyle: { color: o.paleta.texto, fontSize: 20, fontWeight: 600 },
            subtextStyle: { color: o.paleta.textoAtenuado, fontSize: 12 },
          },
        }
      : {}),
    series: [
      {
        type: 'pie',
        name: o.vm.series[0] ?? o.titulo,
        /*
         * El radio exterior deja sitio a las etiquetas, que viven FUERA del circulo.
         *
         * Dentro habria que escribir sobre el color de la serie, que no tiene par de contraste
         * comprobado (4.3). Depende del modo de etiqueta porque «52.6 %» y «Q3: 31.4 %» no ocupan
         * lo mismo.
         */
        radius: [`${hueco}%`, RADIO_EXTERIOR[mode]],
        center: ['50%', '50%'],
        // Sin reordenar por su cuenta: el orden ya se decidio arriba, y con `false` ECharts
        // respeta el del modelo, que es el mismo que ve la tabla de datos adjunta.
        avoidLabelOverlap: true,
        itemStyle: { borderColor: o.paleta.superficie, borderWidth: 2 },
        label:
          mode === 'ninguna'
            ? { show: false }
            : {
                show: true,
                color: o.paleta.texto,
                fontSize: 11,
                formatter: etiquetaDePorcion(mode, formatear, total),
                /*
                 * Las etiquetas largas se alinean al borde de la tarjeta y no a la porcion: asi
                 * todas arrancan en el mismo sitio y ECharts estira la guia hasta ellas.
                 */
                ...(mode === 'categoria' || mode === 'categoria-porcentaje'
                  ? { alignTo: 'edge' as const, edgeDistance: 2 }
                  : {}),
              },
        labelLine: { show: mode !== 'ninguna', lineStyle: { color: o.paleta.linea } },
        data: porciones,
        emphasis: { focus: 'self' },
      },
    ],
  };
}

/* ── Medidor (tacometro) ───────────────────────────────────────────────────────────────────── */

/**
 * El siguiente numero «redondo» por encima de `n`, a 1, 2, 2,5 o 5 por decada.
 *
 * La escala de un medidor no puede salir del maximo de los datos: cambiaria con cada lectura y
 * la misma aguja en el mismo sitio significaria dos cifras distintas.
 */
export function escalaBonita(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const decada = 10 ** Math.floor(Math.log10(n));
  for (const paso of [1, 2, 2.5, 5, 10]) {
    if (n <= paso * decada) return paso * decada;
  }
  return 10 * decada;
}

/**
 * Medidor — una cifra contra su meta.
 *
 * El objetivo puede venir del dataset (la segunda medida) o fijarse en la presentacion. La medida
 * manda: un numero escrito en la configuracion no se actualiza y el del dataset si.
 */
/**
 * La escala de un medidor: de donde a donde llega el arco.
 *
 * Vive fuera del constructor para que el respaldo accesible diga la misma escala que la aguja.
 */
export function escalaDelMedidor(
  medidor: ConfiguracionDeMedidor | undefined,
  valor: number | null,
  objetivo: number | null,
): { minimo: number; maximo: number } {
  const m = medidor ?? {};
  const minimo = m.minimo ?? 0;
  return {
    minimo,
    maximo: m.maximo ?? escalaBonita(Math.max(valor ?? 0, objetivo ?? 0, minimo + 1) * 1.1),
  };
}

export function opcionesDeMedidor(o: OpcionesDeGrafico): Record<string, unknown> {
  const m = o.medidor ?? {};
  const punto = o.vm.points[0];
  const valor = punto?.values[0] ?? null;
  const objetivo = punto?.values[1] ?? m.objetivo ?? null;

  const { minimo, maximo } = escalaDelMedidor(m, valor, objetivo);
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const color = o.paleta.series[0] ?? o.paleta.texto;

  const anillo = {
    type: 'gauge' as const,
    min: minimo,
    max: maximo,
    startAngle: 210,
    endAngle: -30,
    center: ['50%', '58%'],
    radius: '92%',
  };

  return {
    ...nucleo(o, false),
    tooltip: { show: false },
    series: [
      {
        ...anillo,
        name: o.titulo,
        progress: { show: true, width: 16, itemStyle: { color } },
        axisLine: { lineStyle: { width: 16, color: [[1, o.paleta.linea]] } },
        pointer: { width: 5, length: '62%', itemStyle: { color } },
        anchor: { show: true, size: 12, itemStyle: { color } },
        axisTick: { show: false },
        splitLine: { show: false },
        /*
         * Solo los extremos van rotulados: `splitNumber: 1` deja el minimo y el maximo, que son
         * los que hacen que el angulo signifique algo. Con la escala entera los numeros se pisan.
         */
        splitNumber: 1,
        axisLabel: {
          distance: -30,
          color: o.paleta.textoAtenuado,
          fontSize: 11,
          formatter: (n: number) => formatear(n),
        },
        /*
         * La cifra, debajo de la aguja: un angulo no es un numero.
         */
        detail:
          m.mostrarValor === false
            ? { show: false }
            : {
                valueAnimation: false,
                offsetCenter: [0, '32%'],
                color: o.paleta.texto,
                fontSize: 22,
                fontWeight: 600,
                formatter: (n: number) => (valor === null ? '—' : formatear(n)),
              },
        title: { show: false },
        data: [{ value: valor ?? minimo }],
      },
      /*
       * El objetivo, como una marca sobre el arco: una serie aparte con solo su puntero.
       *
       * Como segundo `data` de la misma serie saldrian dos agujas iguales y no habria forma de
       * saber cual es el valor y cual la meta (1.4.1).
       */
      ...(objetivo === null
        ? []
        : [
            {
              ...anillo,
              name: 'Objetivo',
              progress: { show: false },
              axisLine: { show: false },
              axisTick: { show: false },
              splitLine: { show: false },
              axisLabel: { show: false },
              detail: { show: false },
              title: { show: false },
              anchor: { show: false },
              pointer: {
                icon: 'rect',
                width: 3,
                length: '18%',
                offsetCenter: [0, '-82%'],
                itemStyle: { color: o.paleta.texto },
              },
              silent: true,
              data: [{ value: objetivo }],
            },
          ]),
    ],
  };
}

/* ── Combinado de columnas y lineas ────────────────────────────────────────────────────────── */

/**
 * El eje de la derecha: la misma escala de valores, sin repetir la cuadricula y con su propio
 * titulo (`tituloY2`). Todo lo demas se hereda para que los dos ejes se lean igual.
 */
const ejeValorSecundario = (o: OpcionesDeGrafico) => ({
  ...ejeValor(o),
  position: 'right' as const,
  splitLine: { show: false },
  ...(o.ejes?.tituloY2
    ? {
        name: o.ejes.tituloY2,
        nameLocation: 'middle' as const,
        nameRotate: 90,
        nameGap: 44,
        nameTextStyle: { color: o.paleta.textoAtenuado },
      }
    : { name: undefined }),
});

/**
 * Combinado: unas medidas como columnas y otras como linea.
 *
 * Cuales van de cada forma lo dice el MAPEO, con un pozo para cada una, no una opcion del panel.
 * `seriesDeColumna` es cuantas series iniciales son columnas; el resto son lineas.
 */
export function opcionesDeCombinado(o: OpcionesDeGrafico): Record<string, unknown> {
  const columnas = Math.min(Math.max(o.seriesDeColumna ?? 1, 0), o.vm.series.length);
  const dos = o.combinado?.ejeSecundario === true;

  return {
    ...base(o),
    xAxis: ejeCategoria(o),
    yAxis: dos ? [ejeValor(o), ejeValorSecundario(o)] : ejeValor(o),
    series: o.vm.series.map((nombre, s) => {
      const esColumna = s < columnas;
      return {
        name: nombre,
        type: esColumna ? 'bar' : 'line',
        data: o.vm.points.map((p) => p.values[s] ?? null),
        // Solo las lineas se van al segundo eje: las columnas son la referencia y se quedan en el
        // de la izquierda. Al reves, la magnitud principal cambiaria de escala sin avisar.
        ...(dos && !esColumna ? { yAxisIndex: 1 } : {}),
        ...(esColumna
          ? { barMaxWidth: 48, itemStyle: { borderRadius: [4, 4, 0, 0] } }
          : {
              smooth: false,
              symbol: 'circle' as const,
              symbolSize: 7,
              lineStyle: { width: 2.5 },
              /*
               * La linea se dibuja por encima de las columnas: por omision ECharts las apila en
               * el orden en que llegan y la linea queda tapada.
               */
              z: 3,
            }),
        label: etiquetaDeSerie(o, s, 'top'),
        ...(s === 0 ? referenciasDe(o) : {}),
        emphasis: { focus: 'series' },
      };
    }),
  };
}

/* ── Dispersion ────────────────────────────────────────────────────────────────────────────── */

/**
 * Dispersion: dos medidas, una contra la otra.
 *
 * Es el unico objeto donde la dimension no reparte el eje: cada categoria es un punto y los dos
 * ejes son medidas. La tercera medida, si la hay, es el TAMANO del punto, repartido entre un
 * minimo y un maximo — el area de un circulo crece con el cuadrado del radio.
 */
export function opcionesDeDispersion(o: OpcionesDeGrafico): Record<string, unknown> {
  const conTamano = o.vm.series.length > 2;
  const tamanos = conTamano
    ? o.vm.points.map((p) => p.values[2]).filter((v): v is number => v !== null)
    : [];
  const maxTamano = Math.max(1, ...tamanos);

  const { legend, margen } = leyendaDe(o, false);
  const formatear = (n: number, s: number) => o.formatear?.(n, s) ?? String(n);

  /*
   * Se reserva alto por el radio del punto mas grande: `scale` ajusta el eje a los valores, pero
   * el eje no sabe nada del tamano del simbolo.
   */
  const holgura = (conTamano ? TAMANO_MAXIMO : 12) / 2 + (o.etiquetasDeDato ? 14 : 0);

  return {
    ...nucleo(o, false),
    legend,
    grid: { ...margenDe(o, { ...margen, top: margen.top + holgura }), containLabel: true },
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
      /*
       * El tooltip nombra las MEDIDAS, no «x» e «y»: en una dispersion no hay rotulo de categoria
       * en el eje que ate cada numero a lo que mide.
       */
      formatter: (p: { name: string; value: (number | null)[] }) => {
        const [x, y] = p.value;
        const filas = [
          `${o.vm.series[0] ?? 'X'}: ${formatear(Number(x), 0)}`,
          `${o.vm.series[1] ?? 'Y'}: ${formatear(Number(y), 1)}`,
        ];
        return [p.name, ...filas].join('<br/>');
      },
    },
    xAxis: {
      ...ejeValor(o),
      // Los dos ejes llevan cuadricula: sin las verticales, situar un punto en el eje horizontal
      // obliga a seguirlo con el dedo hasta abajo.
      splitLine: {
        show: o.ejes?.cuadricula !== false,
        lineStyle: { color: o.paleta.linea, type: 'dashed' as const },
      },
      show: o.ejes?.mostrarX !== false,
      /*
       * El titulo del eje horizontal va horizontal y debajo. `ejeValor` lo escribe rotado 90
       * grados porque en los demas graficos ese eje es el vertical.
       */
      ...(o.ejes?.tituloX
        ? {
            name: o.ejes.tituloX,
            nameLocation: 'middle' as const,
            nameRotate: 0,
            nameGap: 28,
            nameTextStyle: { color: o.paleta.textoAtenuado },
          }
        : { name: undefined }),
    },
    yAxis: ejeValor(o),
    series: [
      {
        type: 'scatter',
        name: o.titulo,
        /*
         * Cada punto es un objeto con `name`, no un array suelto: como array, el evento de clic
         * llega con `name` vacio y el filtrado cruzado no recibe la categoria.
         */
        data: o.vm.points.map((p) => ({
          name: p.label,
          value: [p.values[0], p.values[1], p.values[2] ?? null],
        })),
        symbolSize: conTamano
          ? (valores: (number | null)[]) =>
              TAMANO_MINIMO +
              (Number(valores[2] ?? 0) / maxTamano) * (TAMANO_MAXIMO - TAMANO_MINIMO)
          : 12,
        itemStyle: { opacity: 0.8 },
        ...referenciasDe(o),
        label: o.etiquetasDeDato
          ? {
              show: true,
              position: 'top' as const,
              color: o.paleta.texto,
              fontSize: 11,
              formatter: (p: { name: string }) => p.name,
            }
          : { show: false },
        emphasis: { focus: 'self' },
      },
    ],
  };
}

/** El punto mas pequeno sigue siendo visible, y el mas grande no tapa a sus vecinos. */
const TAMANO_MINIMO = 8;
const TAMANO_MAXIMO = 42;

/* ── Embudo ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Embudo — la caida entre etapas.
 *
 * No reordena por su cuenta: las etapas tienen un orden propio y ordenarlas por tamano lo
 * destruiria. Que la segunda sea mayor que la primera es una anomalia que hay que poder ver. El
 * orden de mayor a menor se pide en «Ordenar» y se aplica al modelo antes de llegar aqui.
 */
export function opcionesDeEmbudo(o: OpcionesDeGrafico): Record<string, unknown> {
  const etapas = o.vm.points
    .map((p) => ({ name: p.label, valor: p.values[0] }))
    .filter((p): p is { name: string; valor: number } => p.valor !== null);

  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const comparar: ComparacionDeEmbudo = o.embudo?.comparar ?? 'primero';
  const primero = etapas[0]?.valor ?? 0;

  /*
   * El porcentaje se calcula sobre la etapa que toque, con la division por cero cerrada: una
   * etapa de referencia en cero no da «caida infinita» sino una comparacion sin sentido.
   */
  const parte = (valor: number, indice: number) => {
    const base = comparar === 'anterior' ? (etapas[indice - 1]?.valor ?? valor) : primero;
    if (base === 0) return '—';
    return `${((valor / base) * 100).toFixed(1)} %`;
  };

  const { legend } = leyendaDe(o, etapas.length > 1);

  return {
    ...nucleo(o, etapas.length > 1),
    legend,
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
      formatter: (p: { name: string; value: number; dataIndex: number }) =>
        [
          p.name,
          formatear(p.value),
          comparar === 'ninguna'
            ? ''
            : `${comparar === 'anterior' ? 'De la etapa anterior' : 'De la primera etapa'}: ` +
              parte(p.value, p.dataIndex),
        ]
          .filter(Boolean)
          .join('<br/>'),
    },
    series: [
      {
        type: 'funnel',
        name: o.vm.series[0] ?? o.titulo,
        /*
         * El embudo se estrecha a la izquierda y deja la derecha para las etiquetas.
         *
         * Dentro, el texto caeria sobre el relleno de la serie, un color sin par de contraste
         * comprobado (4.3). Fuera va sobre la superficie de la tarjeta, que el tema si garantiza.
         */
        left: '2%',
        right: '42%',
        /*
         * Se reserva alto arriba y abajo: ECharts dibuja cada trapecio hasta el borde del area, y
         * pegada al borde del objeto la primera y la ultima etapa quedan cortadas.
         */
        top: 12,
        bottom: 12,
        // `sort: 'none'` conserva el orden del modelo. Ver el comentario de cabecera.
        sort: 'none' as const,
        gap: 2,
        minSize: '18%',
        itemStyle: { borderColor: o.paleta.superficie, borderWidth: 2 },
        label: {
          show: true,
          position: 'right' as const,
          color: o.paleta.texto,
          fontSize: 11,
          formatter: (p: { name: string; value: number; dataIndex: number }) =>
            comparar === 'ninguna'
              ? `${p.name}: ${formatear(p.value)}`
              : `${p.name}: ${parte(p.value, p.dataIndex)}`,
        },
        labelLine: { length: 12, lineStyle: { color: o.paleta.linea } },
        data: etapas.map((e) => ({ name: e.name, value: e.valor })),
        emphasis: { focus: 'self' },
      },
    ],
  };
}

/* ── Cascada ───────────────────────────────────────────────────────────────────────────────── */

/**
 * Cascada — de que se compone una diferencia.
 *
 * ECharts no tiene un tipo `waterfall`: son DOS series de barras apiladas, una invisible que hace
 * de zocalo y otra visible con la contribucion encima. El zocalo no puede aparecer en la leyenda,
 * en el tooltip ni al pasar el raton. La etiqueta lleva siempre el signo, porque el color no
 * puede ser el unico medio de distinguir subida de bajada (WCAG 1.4.1).
 */
export function opcionesDeCascada(o: OpcionesDeGrafico): Record<string, unknown> {
  const puntos = o.vm.points.map((p) => ({ label: p.label, valor: p.values[0] ?? 0 }));
  const conTotal = o.cascada?.mostrarTotal !== false;
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);

  /*
   * El zocalo de cada barra: donde acabo la anterior, o el suelo del tramo si el valor baja.
   *
   * Con valores negativos la barra visible cuelga desde el acumulado anterior, asi que el zocalo
   * es el acumulado ya restado.
   */
  const zocalos: number[] = [];
  const alturas: number[] = [];
  let acumulado = 0;
  for (const { valor } of puntos) {
    zocalos.push(valor >= 0 ? acumulado : acumulado + valor);
    alturas.push(Math.abs(valor));
    acumulado += valor;
  }

  const labels = [...puntos.map((p) => p.label), ...(conTotal ? ['Total'] : [])];
  if (conTotal) {
    zocalos.push(0);
    alturas.push(acumulado);
  }

  const colorDe = (indice: number) => {
    if (conTotal && indice === puntos.length) return o.paleta.series[0] ?? o.paleta.texto;
    const valor = puntos[indice]?.valor ?? 0;
    // La subida usa el color principal de la paleta y la bajada el de contraste, que en el tema
    // institucional son el azul y el rojo. Salen del tema, no se eligen aqui.
    return (valor >= 0 ? o.paleta.series[0] : o.paleta.series[1]) ?? o.paleta.texto;
  };

  return {
    /*
     * La base se construye con la leyenda ya oculta, no se oculta despues: apagarla tras `base(o)`
     * dejaria el margen que `leyendaDe` ya habia reservado para ella.
     */
    ...base({ ...o, leyenda: 'oculta' }),
    legend: { show: false },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
      formatter: (params: { name: string; dataIndex: number }[]) => {
        const p = params[0];
        if (!p) return '';
        const esTotal = conTotal && p.dataIndex === puntos.length;
        const valor = esTotal ? acumulado : (puntos[p.dataIndex]?.valor ?? 0);
        const signo = esTotal || valor < 0 ? '' : '+';
        return `${p.name}<br/>${signo}${formatear(valor)}`;
      },
    },
    xAxis: { ...ejeCategoria(o), data: labels },
    yAxis: ejeValor(o),
    series: [
      {
        // El zocalo: invisible, mudo y fuera de la leyenda. Solo empuja a la barra de arriba.
        name: 'zocalo',
        type: 'bar',
        stack: 'cascada',
        silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        data: zocalos,
      },
      {
        name: o.vm.series[0] ?? o.titulo,
        type: 'bar',
        stack: 'cascada',
        barMaxWidth: 56,
        ...referenciasDe(o),
        data: alturas.map((alto, i) => ({ value: alto, itemStyle: { color: colorDe(i) } })),
        label: {
          show: true,
          position: 'top' as const,
          color: o.paleta.texto,
          fontSize: 11,
          /*
           * El signo va en la etiqueta, siempre: el color distingue subida de bajada, pero no
           * puede ser el unico medio de transmitir esa informacion (WCAG 1.4.1).
           */
          formatter: (p: { dataIndex: number }) => {
            const esTotal = conTotal && p.dataIndex === puntos.length;
            const valor = esTotal ? acumulado : (puntos[p.dataIndex]?.valor ?? 0);
            return `${esTotal || valor < 0 ? '' : '+'}${formatear(valor)}`;
          },
        },
      },
    ],
  };
}

/* ── Mapa de arbol ─────────────────────────────────────────────────────────────────────────── */

/**
 * Mapa de arbol — la composicion cuando hay demasiadas partes para un circular.
 *
 * Un rectangulo conserva dos dimensiones donde escribir el nombre; una porcion fina, no. Con dos
 * dimensiones dibuja dos niveles: el primero agrupa y el segundo reparte dentro.
 */
export function opcionesDeMapaDeArbol(o: OpcionesDeGrafico): Record<string, unknown> {
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);

  /*
   * Las etiquetas del modelo vienen compuestas con « / » cuando hay dos dimensiones, y aqui hay
   * que deshacerlo: el primer trozo es el grupo y el segundo la hoja.
   */
  const raices = new Map<string, { name: string; value: number }[]>();
  let jerarquico = false;
  for (const punto of o.vm.points) {
    const valor = punto.values[0];
    // Un nulo no es un rectangulo de area cero: es «no hay respuesta», y no se dibuja.
    if (valor === null || valor === undefined) continue;
    const [grupo = punto.label, hoja] = punto.label.split(' / ');
    if (hoja !== undefined) jerarquico = true;
    const hijos = raices.get(grupo) ?? [];
    hijos.push({ name: hoja ?? grupo, value: valor });
    raices.set(grupo, hijos);
  }

  const datos = [...raices.entries()].map(([grupo, hijos]) =>
    jerarquico ? { name: grupo, children: hijos } : { name: grupo, value: hijos[0]?.value ?? 0 },
  );

  return {
    ...nucleo(o, false),
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
      formatter: (p: { name: string; value: number }) => `${p.name}<br/>${formatear(p.value)}`,
    },
    series: [
      {
        type: 'treemap',
        name: o.titulo,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        /*
         * Sin barra de migas ni zoom por rueda: las dos dan al objeto estado propio, y el estado
         * de lo que se ve vive en la URL (4.11).
         */
        breadcrumb: { show: false },
        roam: false,
        nodeClick: false as const,
        // Un solo nivel visible aunque haya dos: el segundo se dibuja DENTRO del primero, que es
        // justo lo que hace legible la jerarquia sin tener que entrar en ella.
        leafDepth: jerarquico ? 2 : 1,
        itemStyle: { borderColor: o.paleta.superficie, borderWidth: 2, gapWidth: 2 },
        label: {
          show: true,
          /*
           * El blanco fijado a mano, unica excepcion del repositorio.
           *
           * En un mapa de arbol el rectangulo es el dato y no hay «fuera» donde poner la etiqueta.
           * Los ocho colores de serie son saturados por construccion —la puerta de contraste lo
           * comprueba— y el blanco es el unico valor que contrasta con todos.
           */
          color: '#fff',
          fontSize: 12,
          formatter: (p: { name: string; value: number }) =>
            o.etiquetasDeDato ? `${p.name}\n${formatear(p.value)}` : p.name,
        },
        upperLabel: jerarquico
          ? { show: true, height: 22, color: '#fff', fontSize: 11 }
          : { show: false },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 2 } },
          { itemStyle: { borderWidth: 2, gapWidth: 1, borderColorSaturation: 0.5 } },
        ],
        data: datos,
      },
    ],
  };
}

export type TipoDeGrafico =
  | 'barras'
  | 'lineas'
  | 'barras-horizontales'
  | 'area'
  | 'circular'
  | 'combinado'
  | 'dispersion'
  | 'embudo'
  | 'cascada'
  | 'mapa-de-arbol'
  | 'medidor';

const CONSTRUCTORES: Record<TipoDeGrafico, (o: OpcionesDeGrafico) => Record<string, unknown>> = {
  barras: opcionesDeBarras,
  'barras-horizontales': opcionesDeBarrasHorizontales,
  lineas: opcionesDeLineas,
  area: opcionesDeArea,
  circular: opcionesDeCircular,
  combinado: opcionesDeCombinado,
  dispersion: opcionesDeDispersion,
  embudo: opcionesDeEmbudo,
  cascada: opcionesDeCascada,
  'mapa-de-arbol': opcionesDeMapaDeArbol,
  medidor: opcionesDeMedidor,
};

/**
 * Un mapa y no una cadena de ternarios: con `Record<TipoDeGrafico, ...>`, anadir un tipo al union
 * sin escribir su constructor es un error de compilacion.
 */
export function opcionesDe(tipo: TipoDeGrafico, o: OpcionesDeGrafico): Record<string, unknown> {
  return (CONSTRUCTORES[tipo] ?? opcionesDeBarras)(o);
}

/**
 * Umbral a partir del cual conviene Canvas.
 *
 * Canvas es el renderizador por defecto porque aguanta volumen e interaccion. Por debajo del
 * umbral un SVG no cuesta nada y se puede seleccionar e inspeccionar; y al IMPRIMIR siempre se
 * usa SVG, porque un canvas impreso es un mapa de bits a la resolucion de la pantalla.
 */
export const UMBRAL_DE_ELEMENTOS = 400;

export function elementosDe(vm: CategoricalViewModel): number {
  return vm.points.length * Math.max(1, vm.series.length);
}
