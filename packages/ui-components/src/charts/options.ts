import {
  MAX_RADIO_INTERIOR,
  MAX_REFERENCES,
  normalizedLabels,
  type PieSettings,
  type FunnelComparison,
  type WaterfallSettings,
  type ComboSettings,
  type FunnelSettings,
  type AxisSettings,
  type GaugeSettings,
  type ReferenceStyle,
  type LabelSettings,
  type TooltipSettings,
  type PieLabel,
  type DatumLabels,
  type ReferenceLine,
  type StackingMode,
  type LegendMode,
} from '../presentation/contract';
import { conditionalColor, type ConditionalFormat } from '../presentation/conditional';
import type { CategoricalViewModel } from '../registry/viewModel';

/**
 * Construccion de las opciones de Apache ECharts (4.2).
 *
 * Funciones puras: reciben el modelo de vista y la paleta y devuelven el objeto de opciones. No
 * tocan el DOM ni importan ECharts, asi que se prueban sin navegador. El montaje vive en el shell.
 */

export interface ChartPalette {
  /** Ocho colores de serie, del tema institucional. */
  series: string[];
  content: string;
  mutedText: string;
  line: string;
  superficie: string;
  superficieElevada: string;
}

export interface ChartOptions {
  vm: CategoricalViewModel;
  palette: ChartPalette;
  titulo: string;
  /** Nombre de la dimension del eje, para el rotulo accesible. */
  dimension?: string;
  legend?: LegendMode;
  /** La cifra sobre cada barra o punto. `true` es la forma anterior y se sigue admitiendo. */
  datumLabels?: DatumLabels;
  tooltip?: TooltipSettings;
  axes?: AxisSettings;
  /** Como formatear una cifra de la serie `s`. */
  formatear?: (valor: number, serie: number) => string;
  apilado?: StackingMode;
  circular?: PieSettings;
  combinado?: ComboSettings;
  references?: ReferenceLine[];
  seriesColors?: number[];
  conditional?: ConditionalFormat;
  embudo?: FunnelSettings;
  cascada?: WaterfallSettings;
  medidor?: GaugeSettings;
  /** Cuantas series iniciales son columnas, en un combinado. */
  columnSeries?: number;
}

/* ── Apilado ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Los valores que se dibujan, segun el modo de apilado.
 *
 * En `porcentaje` se convierten a su parte del total de la categoria: `stack` de ECharts suma,
 * no reparte. Un total de cero deja las partes en cero y no en `NaN`.
 */
function valueStacked(o: ChartOptions): (number | null)[][] {
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
const stackOf = (o: ChartOptions) => (o.apilado && o.apilado !== 'ninguno' ? { stack: 'total' } : {});

/** El tooltip de un grafico al 100 %. */
function tooltipOf(o: ChartOptions) {
  const common = {
    trigger: 'axis' as const,
    backgroundColor: o.palette.superficieElevada,
    borderWidth: 0,
    textStyle: { color: o.palette.content },
    extraCssText: 'box-shadow: none;',
  };

  const porcentaje = o.apilado === 'porcentaje';
  const withTotal = o.tooltip?.total === true;
  const ordenar = o.tooltip?.sortValue === true;
  // Sin nada que anadir, se deja el tooltip de ECharts: formatea igual y no cuesta nada.
  if (!porcentaje && !withTotal && !ordenar) return common;

  return {
    ...common,
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

      const dataRows = params.map((p) => {
        const crudo = crudoDe(p.seriesName, p.dataIndex);
        const figure = crudo === null ? '—' : formatear(crudo, p.seriesName);
        return {
          orden: crudo ?? Number.NEGATIVE_INFINITY,
          content: porcentaje
            ? `${p.seriesName}: ${p.value.toFixed(1)} % (${figure})`
            : `${p.seriesName}: ${figure}`,
        };
      });
      // Los nulos quedan al final: no compiten por «el mayor», porque no son un numero.
      if (ordenar) dataRows.sort((a, b) => b.orden - a.orden);

      const lineas = [punto.name, ...dataRows.map((f) => f.content)];
      if (withTotal) {
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
function legendOf(o: ChartOptions, hayQueDistinguir = o.vm.series.length > 1) {
  const several = hayQueDistinguir;
  const mode: LegendMode = o.legend ?? 'auto';
  const visible = mode === 'auto' ? several : mode !== 'oculta';
  if (!visible) return { legend: { show: false }, margin: { bottom: 8, left: 8, right: 16, top: 24 } };

  /*
   * A los lados, la leyenda se ACOTA y trunca.
   */
  /*
   * `type: 'scroll'` en TODAS las posiciones.
   */
  const common = {
    textStyle: { color: o.palette.mutedText },
    icon: 'roundRect' as const,
    type: 'scroll' as const,
    pageIconColor: o.palette.mutedText,
    pageTextStyle: { color: o.palette.mutedText },
  };
  const aLosLados = {
    ...common,
    textStyle: { color: o.palette.mutedText, width: 96, overflow: 'truncate' as const },
  };
  const lado = mode === 'auto' ? 'abajo' : mode;

  switch (lado) {
    case 'arriba':
      return { legend: { ...common, top: 0 }, margin: { bottom: 8, left: 8, right: 16, top: 36 } };
    case 'izquierda':
      return {
        legend: { ...aLosLados, left: 0, top: 'middle', orient: 'vertical' as const },
        margin: { bottom: 8, left: 130, right: 16, top: 24 },
      };
    case 'derecha':
      return {
        legend: { ...aLosLados, right: 0, top: 'middle', orient: 'vertical' as const },
        margin: { bottom: 8, left: 8, right: 130, top: 24 },
      };
    default:
      return { legend: { ...common, bottom: 0 }, margin: { bottom: 32, left: 8, right: 16, top: 24 } };
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
function marginOf(o: ChartOptions, legendThe: { top: number; bottom: number; left: number; right: number }) {
  return {
    ...legendThe,
    left: legendThe.left + (o.axes?.yTitle ? 44 : 0),
    bottom: legendThe.bottom + (o.axes?.xTitle ? 24 : 0),
  };
}

/**
 * La paleta, con los colores que cada serie tenga asignados.
 *
 * Se permuta el array que ECharts consume en vez de escribir `itemStyle.color` por serie: asi el
 * color llega igual a las barras, la leyenda, los decals y el tooltip. Una serie sin asignacion
 * conserva el color que le tocaba por orden.
 */
function paletteOf(o: ChartOptions): string[] {
  const elegidos = o.seriesColors;
  if (!elegidos || elegidos.length === 0) return o.palette.series;
  return o.palette.series.map((porOrden, s) => {
    const indice = elegidos[s];
    return indice === undefined ? porOrden : (o.palette.series[indice] ?? porOrden);
  });
}

const REFERENCE_STROKE: Record<ReferenceStyle, 'solid' | 'dashed' | 'dotted'> = {
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
function referencesOf(o: ChartOptions, horizontal = false) {
  const lineas = (o.references ?? []).slice(0, MAX_REFERENCES);
  if (lineas.length === 0) return {};

  return {
    markLine: {
      silent: true,
      symbol: 'none' as const,
      // `emphasis` apagado: sin esto, pasar cerca engorda la raya como si fuera seleccionable.
      emphasis: { disabled: true },
      data: lineas.map((line) => ({
        [horizontal ? 'xAxis' : 'yAxis']: line.valor,
        lineStyle: {
          color: roleColor(o, line.color),
          type: REFERENCE_STROKE[line.style ?? 'discontinua'],
          width: 2,
        },
        label: {
          show: line.etiqueta !== undefined && line.etiqueta !== '',
          formatter: line.etiqueta ?? '',
          position: horizontal ? ('end' as const) : ('insideEndTop' as const),
          color: roleColor(o, line.color),
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
function roleColor(o: ChartOptions, color: ReferenceLine['color']): string {
  switch (color) {
    case 'primario':
      return o.palette.series[0] ?? o.palette.content;
    case 'error':
      return o.palette.series[1] ?? o.palette.content;
    case 'atenuado':
      return o.palette.mutedText;
    default:
      return o.palette.content;
  }
}

function core(o: ChartOptions, conDecal: boolean) {
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
    color: paletteOf(o),
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { color: o.palette.content },
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
function shiftLabelBorder(o: ChartOptions) {
  if (normalizedLabels(o.datumLabels).mostrar !== true) return {};
  const last = o.vm.points.length - 1;
  return {
    labelLayout: (p: { dataIndex: number }) => {
      if (p.dataIndex === 0) return { dx: 16 };
      if (p.dataIndex === last) return { dx: -16 };
      return {};
    },
  };
}

/**
 * La barra para acercarse a un tramo del eje de categorias.
 *
 * Son DOS controles y hacen falta los dos: el `slider` es la barra visible de abajo, y el
 * `inside` deja arrastrar y hacer rueda sobre el propio grafico. Con solo el primero, el gesto
 * natural —arrastrar lo que se mira— no hace nada; con solo el segundo, nada en pantalla dice que
 * se esta viendo un tramo y no el total.
 *
 * Empieza mostrandolo TODO (0 a 100): un grafico que abre ya recortado esconde datos sin que
 * nadie lo haya pedido.
 */
const zoomOf = (o: ChartOptions) =>
  o.axes?.zoom === true
    ? {
        dataZoom: [
          {
            type: 'slider' as const,
            start: 0,
            end: 100,
            height: 18,
            bottom: 0,
            borderColor: o.palette.line,
            fillerColor: o.palette.superficieElevada,
            handleStyle: { color: o.palette.mutedText },
            textStyle: { color: o.palette.mutedText },
          },
          { type: 'inside' as const, start: 0, end: 100 },
        ],
      }
    : {};

function base(o: ChartOptions) {
  const { legend, margin } = legendOf(o);
  const zoom = zoomOf(o);
  // Se parte de lo que `marginOf` ya decidio —leyenda y titulo del eje X— y se le SUMA la barra.
  // Calculando sobre `margin` a secas, un grafico con titulo de eje y zoom habria perdido el
  // hueco del titulo.
  const margenes = marginOf(o, margin);
  return {
    ...core(o, o.vm.series.length > 1),
    /*
     * El margen inferior reserva sitio para la leyenda cuando la hay, y para la barra de zoom
     * cuando se pide: sin reservarlo, la barra se dibuja sobre los rotulos del eje.
     */
    grid: {
      ...margenes,
      ...(o.axes?.zoom === true ? { bottom: margenes.bottom + 26 } : {}),
      containLabel: true,
    },
    tooltip: tooltipOf(o),
    legend,
    ...zoom,
  };
}

/** La etiqueta sobre cada barra o punto. */
const ECHARTS_POSITION: Record<string, string | undefined> = {
  auto: undefined,
  encima: 'top',
  debajo: 'bottom',
  dentro: 'inside',
};

/** Los indices del maximo y el minimo de una serie. */
function endsOf(o: ChartOptions, s: number): Set<number> {
  let heightMore: number | undefined;
  let underMore: number | undefined;
  o.vm.points.forEach((punto, i) => {
    const valor = punto.values[s];
    if (valor === null || valor === undefined) return;
    if (heightMore === undefined || valor > (o.vm.points[heightMore]?.values[s] ?? 0)) heightMore = i;
    if (underMore === undefined || valor < (o.vm.points[underMore]?.values[s] ?? 0)) underMore = i;
  });
  return new Set([heightMore, underMore].filter((i): i is number => i !== undefined));
}

const seriesLabel = (o: ChartOptions, s: number, cellPosition: string) => {
  const config: LabelSettings = normalizedLabels(o.datumLabels);
  if (config.mostrar !== true) return { show: false };

  const elegida = ECHARTS_POSITION[config.cellPosition ?? 'auto'] ?? cellPosition;
  const ends = config.onlyEnds ? endsOf(o, s) : undefined;

  return {
    show: true,
    position: elegida,
    color: o.palette.content,
    fontSize: 11,
    /*
     * «Solo los extremos» se resuelve en el FORMATTER, devolviendo cadena vacia.
     */
    formatter: (p: { value: number; dataIndex: number }) => {
      if (ends && !ends.has(p.dataIndex)) return '';
      return o.formatear ? o.formatear(p.value, s) : String(p.value);
    },
  };
};

const axisCategory = (o: ChartOptions) => ({
  type: 'category' as const,
  show: o.axes?.showX !== false,
  data: o.vm.points.map((p) => p.label),
  axisLabel: {
    color: o.palette.mutedText,
  /*
   * Girados, los rotulos se dejan de esconder.
   *
   * `hideOverlap` es lo correcto en horizontal, pero esconde sin avisar; quien gira los rotulos
   * lo hace para verlos todos.
   */
    hideOverlap: !o.axes?.rotateX,
    ...(o.axes?.rotateX ? { rotate: o.axes.rotateX } : {}),
  },
  axisLine: { lineStyle: { color: o.palette.line } },
  axisTick: { show: false },
  /*
   * El titulo del eje se pone A MANO o no se pone.
   */
  ...(o.axes?.xTitle
    ? {
        name: o.axes.xTitle,
        nameLocation: 'middle' as const,
        nameGap: 28,
        nameTextStyle: { color: o.palette.mutedText },
      }
    : {}),
  /*
   * El nombre de la dimension NO se rotula en el eje.
   */
});

const valueAxis = (o: ChartOptions) => ({
  /*
   * Logaritmica cuando se pide, y NUNCA con un apilado de porcentaje.
   *
   * Un apilado al 100 % impone una escala de 0 a 100 y las series se suman sobre ella: repartida
   * en logaritmos, los tramos dejan de sumar el total que el propio grafico promete. Se ignora en
   * vez de dibujar una pila que no cuadra.
   */
  type:
    o.axes?.scale === 'logaritmica' && o.apilado !== 'porcentaje'
      ? ('log' as const)
      : ('value' as const),
  show: o.axes?.showY !== false,
  /*
   * Los limites, en orden de quien manda: el 100 % los impone (0 a 100), luego lo escrito a
   * mano, y si no hay nada, ECharts.
   */
  ...(o.apilado === 'porcentaje'
    ? { max: 100, min: 0 }
    : {
        ...(o.axes?.yMin === undefined ? {} : { min: o.axes.yMin }),
        ...(o.axes?.yMax === undefined ? {} : { max: o.axes.yMax }),
      }),
  axisLabel: {
    color: o.palette.mutedText,
    ...(o.apilado === 'porcentaje' ? { formatter: '{value} %' } : {}),
  },
  splitLine: {
    show: o.axes?.gridlines !== false,
    lineStyle: { color: o.palette.line, type: 'dashed' as const },
  },
  /*
   * El eje empieza en cero salvo que alguien decida lo contrario.
   *
   * `scale: true` de ECharts ajusta el minimo a los datos, y con eso una diferencia del 2 % entre
   * dos barras parece el triple.
   */
  scale: o.axes?.fromZero === false,
  /*
   * El titulo del eje de valores va rotado y a media altura: arriba, que es donde ECharts lo pone
   * por omision, se dibuja encima del rotulo mas alto de la escala.
   */
  ...(o.axes?.yTitle
    ? {
        name: o.axes.yTitle,
        nameLocation: 'middle' as const,
        nameRotate: 90,
        nameGap: 44,
        nameTextStyle: { color: o.palette.mutedText },
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
function colorBars(o: ChartOptions, datos: (number | null)[], s: number) {
  if (!o.conditional || o.conditional.rules.length === 0) return datos;
  const medida = o.vm.series[s];

  let alguna = false;
  const withColor = datos.map((valor, i) => {
    const original = o.vm.points[i]?.values[s] ?? null;
    const color = conditionalColor(o.conditional, original, medida);
    if (color === undefined) return valor;
    alguna = true;
    return { value: valor, itemStyle: { color: roleColor(o, color) } };
  });
  return alguna ? withColor : datos;
}

function barSeries(o: ChartOptions, horizontal: boolean) {
  const datos = valueStacked(o);
  const apilada = o.apilado && o.apilado !== 'ninguno';

  return o.vm.series.map((nombre, s) => ({
    name: nombre,
    type: 'bar',
    data: colorBars(o, datos[s] ?? [], s),
    ...stackOf(o),
    /*
     * La esquina redondeada solo en la barra SUELTA.
     */
    itemStyle: apilada
      ? {}
      : { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    barMaxWidth: 48,
    // Apilada, la cifra va DENTRO del segmento: encima se dibujaria sobre el segmento siguiente.
    label: seriesLabel(o, s, apilada ? 'inside' : horizontal ? 'right' : 'top'),
    // Las referencias cuelgan de la PRIMERA serie: son del grafico, no de una medida, y en una
    // serie cualquiera desaparecerian al ocultar esa medida desde la leyenda.
    ...(s === 0 ? referencesOf(o, horizontal) : {}),
    emphasis: { focus: 'series' },
  }));
}

/** Columnas verticales. Una serie por medida mapeada. */
export function barOptions(o: ChartOptions): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: axisCategory(o),
    yAxis: valueAxis(o),
    series: barSeries(o, false),
  };
}

/**
 * Barras horizontales.
 *
 * El mismo objeto que las columnas con los ejes intercambiados; cual es la categoria y cual el
 * valor lo decide quien construye, no ECharts.
 */
export function horizontalBarOptions(o: ChartOptions): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: valueAxis(o),
    yAxis: {
      ...axisCategory(o),
      /*
       * Se invierte el eje de categorias: ECharts numera el vertical de abajo arriba, asi que sin
       * esto la primera categoria del modelo sale abajo y la lista se lee al reves.
       */
      inverse: true,
    },
    series: barSeries(o, true),
  };
}

/** Area. Es una linea con el relleno debajo. */
export function areaOptions(o: ChartOptions): Record<string, unknown> {
  const datos = valueStacked(o);
  return {
    ...base(o),
    xAxis: { ...axisCategory(o), boundaryGap: false },
    yAxis: valueAxis(o),
    series: o.vm.series.map((nombre, s) => ({
      name: nombre,
      type: 'line',
      data: datos[s] ?? [],
      ...stackOf(o),
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2 },
      /*
       * Sin apilar, el relleno va semitransparente: con varias areas opacas la de delante tapa a
       * las de atras. Apiladas no se solapan y el relleno solido hace legible la composicion.
       */
      areaStyle: o.apilado && o.apilado !== 'ninguno' ? {} : { opacity: 0.25 },
      label: seriesLabel(o, s, 'top'),
      ...shiftLabelBorder(o),
      ...(s === 0 ? referencesOf(o) : {}),
      emphasis: { focus: 'series' },
    })),
  };
}

/** Lineas. `smooth` desactivado: una curva inventa valores entre dos puntos medidos. */
export function lineOptions(o: ChartOptions): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: { ...axisCategory(o), boundaryGap: false },
    yAxis: valueAxis(o),
    series: o.vm.series.map((nombre, s) => ({
      name: nombre,
      type: 'line',
      data: o.vm.points.map((p) => p.values[s] ?? 0),
      smooth: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      label: seriesLabel(o, s, 'top'),
      ...shiftLabelBorder(o),
      ...(s === 0 ? referencesOf(o) : {}),
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
function slicesOf(o: ChartOptions): { name: string; value: number }[] {
  const slices = o.vm.points
    .map((p) => ({ name: p.label, valor: p.values[0] ?? null }))
    .filter((p): p is { name: string; valor: number } => p.valor !== null)
    .map((p) => ({ name: p.name, value: p.valor }));

  // Ordenadas de mayor a menor por defecto: dos areas parecidas solo se distinguen si estan una
  // al lado de la otra, y ese es justo el caso en el que un circular se lee mal.
  return o.circular?.ordenar === false ? slices : [...slices].sort((a, b) => b.value - a.value);
}

/**
 * La etiqueta de una porcion, con el porcentaje calculado aqui y no con el `{d}` de ECharts.
 *
 * `{d}` sale con dos decimales y no cabe en una tarjeta estrecha.
 */
const sliceLabel = (
  mode: PieLabel,
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
const RADIO_EXTERIOR: Record<PieLabel, string> = {
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
export function pieOptions(o: ChartOptions): Record<string, unknown> {
  const c = o.circular ?? {};
  const hole = Math.min(Math.max(c.radioInterior ?? 0, 0), MAX_RADIO_INTERIOR);
  const slices = slicesOf(o);
  const total = slices.reduce((suma, p) => suma + p.value, 0);
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const mode: PieLabel = c.labels ?? 'porcentaje';

  /*
   * Aqui la leyenda distingue CATEGORIAS, no series: en un circular siempre hay una serie, asi
   * que `auto` la ocultaria siempre y un pastel sin leyenda es una rueda de colores sin nombre.
   */
  const { legend } = legendOf(o, slices.length > 1);

  return {
    ...core(o, slices.length > 1),
    legend,
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.palette.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.palette.content },
      extraCssText: 'box-shadow: none;',
      // La cifra Y su parte del total: un porcentaje suelto no se puede auditar contra la tabla.
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/>${formatear(p.value)} (${p.percent} %)`,
    },
    /*
     * El total en el centro, solo si hay centro: con hueco cero la cifra caeria sobre las porciones.
     */
    ...(c.totalEnElCentro && hole > 0
      ? {
          title: {
            text: formatear(total),
            subtext: 'Total',
            left: 'center',
            top: 'center',
            textStyle: { color: o.palette.content, fontSize: 20, fontWeight: 600 },
            subtextStyle: { color: o.palette.mutedText, fontSize: 12 },
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
        radius: [`${hole}%`, RADIO_EXTERIOR[mode]],
        center: ['50%', '50%'],
        // Sin reordenar por su cuenta: el orden ya se decidio arriba, y con `false` ECharts
        // respeta el del modelo, que es el mismo que ve la tabla de datos adjunta.
        avoidLabelOverlap: true,
        itemStyle: { borderColor: o.palette.superficie, borderWidth: 2 },
        label:
          mode === 'ninguna'
            ? { show: false }
            : {
                show: true,
                color: o.palette.content,
                fontSize: 11,
                formatter: sliceLabel(mode, formatear, total),
                /*
                 * Las etiquetas largas se alinean al borde de la tarjeta y no a la porcion: asi
                 * todas arrancan en el mismo sitio y ECharts estira la guia hasta ellas.
                 */
                ...(mode === 'categoria' || mode === 'categoria-porcentaje'
                  ? { alignTo: 'edge' as const, edgeDistance: 2 }
                  : {}),
              },
        labelLine: { show: mode !== 'ninguna', lineStyle: { color: o.palette.line } },
        data: slices,
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
export function niceScale(n: number): number {
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
export function gaugeScale(
  medidor: GaugeSettings | undefined,
  valor: number | null,
  objetivo: number | null,
): { minimo: number; maximo: number } {
  const m = medidor ?? {};
  const minimo = m.minimo ?? 0;
  return {
    minimo,
    maximo: m.maximo ?? niceScale(Math.max(valor ?? 0, objetivo ?? 0, minimo + 1) * 1.1),
  };
}

export function gaugeOptions(o: ChartOptions): Record<string, unknown> {
  const m = o.medidor ?? {};
  const punto = o.vm.points[0];
  const valor = punto?.values[0] ?? null;
  const objetivo = punto?.values[1] ?? m.objetivo ?? null;

  const { minimo, maximo } = gaugeScale(m, valor, objetivo);
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const color = o.palette.series[0] ?? o.palette.content;

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
    ...core(o, false),
    tooltip: { show: false },
    series: [
      {
        ...anillo,
        name: o.titulo,
        progress: { show: true, width: 16, itemStyle: { color } },
        axisLine: { lineStyle: { width: 16, color: [[1, o.palette.line]] } },
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
          color: o.palette.mutedText,
          fontSize: 11,
          formatter: (n: number) => formatear(n),
        },
        /*
         * La cifra, debajo de la aguja: un angulo no es un numero.
         */
        detail:
          m.showValue === false
            ? { show: false }
            : {
                valueAnimation: false,
                offsetCenter: [0, '32%'],
                color: o.palette.content,
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
                itemStyle: { color: o.palette.content },
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
 * titulo (`y2Title`). Todo lo demas se hereda para que los dos ejes se lean igual.
 */
const axisValueSecondary = (o: ChartOptions) => ({
  ...valueAxis(o),
  position: 'right' as const,
  splitLine: { show: false },
  ...(o.axes?.y2Title
    ? {
        name: o.axes.y2Title,
        nameLocation: 'middle' as const,
        nameRotate: 90,
        nameGap: 44,
        nameTextStyle: { color: o.palette.mutedText },
      }
    : { name: undefined }),
});

/**
 * Combinado: unas medidas como columnas y otras como linea.
 *
 * Cuales van de cada forma lo dice el MAPEO, con un pozo para cada una, no una opcion del panel.
 * `columnSeries` es cuantas series iniciales son columnas; el resto son lineas.
 */
export function comboOptions(o: ChartOptions): Record<string, unknown> {
  const gridColumns = Math.min(Math.max(o.columnSeries ?? 1, 0), o.vm.series.length);
  const dos = o.combinado?.axisSecondary === true;

  return {
    ...base(o),
    xAxis: axisCategory(o),
    yAxis: dos ? [valueAxis(o), axisValueSecondary(o)] : valueAxis(o),
    series: o.vm.series.map((nombre, s) => {
      const isColumn = s < gridColumns;
      return {
        name: nombre,
        type: isColumn ? 'bar' : 'line',
        data: o.vm.points.map((p) => p.values[s] ?? null),
        // Solo las lineas se van al segundo eje: las columnas son la referencia y se quedan en el
        // de la izquierda. Al reves, la magnitud principal cambiaria de escala sin avisar.
        ...(dos && !isColumn ? { yAxisIndex: 1 } : {}),
        ...(isColumn
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
        label: seriesLabel(o, s, 'top'),
        ...(s === 0 ? referencesOf(o) : {}),
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
export function scatterOptions(o: ChartOptions): Record<string, unknown> {
  const withSize = o.vm.series.length > 2;
  const tamanos = withSize
    ? o.vm.points.map((p) => p.values[2]).filter((v): v is number => v !== null)
    : [];
  const maxSize = Math.max(1, ...tamanos);

  const { legend, margin } = legendOf(o, false);
  const formatear = (n: number, s: number) => o.formatear?.(n, s) ?? String(n);

  /*
   * Se reserva alto por el radio del punto mas grande: `scale` ajusta el eje a los valores, pero
   * el eje no sabe nada del tamano del simbolo.
   */
  const holgura = (withSize ? MAX_SIZE : 12) / 2 + (o.datumLabels ? 14 : 0);

  return {
    ...core(o, false),
    legend,
    grid: { ...marginOf(o, { ...margin, top: margin.top + holgura }), containLabel: true },
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.palette.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.palette.content },
      extraCssText: 'box-shadow: none;',
      /*
       * El tooltip nombra las MEDIDAS, no «x» e «y»: en una dispersion no hay rotulo de categoria
       * en el eje que ate cada numero a lo que mide.
       */
      formatter: (p: { name: string; value: (number | null)[] }) => {
        const [x, y] = p.value;
        const dataRows = [
          `${o.vm.series[0] ?? 'X'}: ${formatear(Number(x), 0)}`,
          `${o.vm.series[1] ?? 'Y'}: ${formatear(Number(y), 1)}`,
        ];
        return [p.name, ...dataRows].join('<br/>');
      },
    },
    xAxis: {
      ...valueAxis(o),
      // Los dos ejes llevan cuadricula: sin las verticales, situar un punto en el eje horizontal
      // obliga a seguirlo con el dedo hasta abajo.
      splitLine: {
        show: o.axes?.gridlines !== false,
        lineStyle: { color: o.palette.line, type: 'dashed' as const },
      },
      show: o.axes?.showX !== false,
      /*
       * El titulo del eje horizontal va horizontal y debajo. `valueAxis` lo escribe rotado 90
       * grados porque en los demas graficos ese eje es el vertical.
       */
      ...(o.axes?.xTitle
        ? {
            name: o.axes.xTitle,
            nameLocation: 'middle' as const,
            nameRotate: 0,
            nameGap: 28,
            nameTextStyle: { color: o.palette.mutedText },
          }
        : { name: undefined }),
    },
    yAxis: valueAxis(o),
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
        symbolSize: withSize
          ? (valores: (number | null)[]) =>
              MIN_SIZE +
              (Number(valores[2] ?? 0) / maxSize) * (MAX_SIZE - MIN_SIZE)
          : 12,
        itemStyle: { opacity: 0.8 },
        ...referencesOf(o),
        label: o.datumLabels
          ? {
              show: true,
              position: 'top' as const,
              color: o.palette.content,
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
const MIN_SIZE = 8;
const MAX_SIZE = 42;

/* ── Embudo ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Embudo — la caida entre etapas.
 *
 * No reordena por su cuenta: las etapas tienen un orden propio y ordenarlas por tamano lo
 * destruiria. Que la segunda sea mayor que la primera es una anomalia que hay que poder ver. El
 * orden de mayor a menor se pide en «Ordenar» y se aplica al modelo antes de llegar aqui.
 */
export function funnelOptions(o: ChartOptions): Record<string, unknown> {
  const etapas = o.vm.points
    .map((p) => ({ name: p.label, valor: p.values[0] }))
    .filter((p): p is { name: string; valor: number } => p.valor !== null);

  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const compare: FunnelComparison = o.embudo?.compare ?? 'primero';
  const primero = etapas[0]?.valor ?? 0;

  /*
   * El porcentaje se calcula sobre la etapa que toque, con la division por cero cerrada: una
   * etapa de referencia en cero no da «caida infinita» sino una comparacion sin sentido.
   */
  const parte = (valor: number, indice: number) => {
    const base = compare === 'anterior' ? (etapas[indice - 1]?.valor ?? valor) : primero;
    if (base === 0) return '—';
    return `${((valor / base) * 100).toFixed(1)} %`;
  };

  const { legend } = legendOf(o, etapas.length > 1);

  return {
    ...core(o, etapas.length > 1),
    legend,
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.palette.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.palette.content },
      extraCssText: 'box-shadow: none;',
      formatter: (p: { name: string; value: number; dataIndex: number }) =>
        [
          p.name,
          formatear(p.value),
          compare === 'ninguna'
            ? ''
            : `${compare === 'anterior' ? 'De la etapa anterior' : 'De la primera etapa'}: ` +
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
        itemStyle: { borderColor: o.palette.superficie, borderWidth: 2 },
        label: {
          show: true,
          position: 'right' as const,
          color: o.palette.content,
          fontSize: 11,
          formatter: (p: { name: string; value: number; dataIndex: number }) =>
            compare === 'ninguna'
              ? `${p.name}: ${formatear(p.value)}`
              : `${p.name}: ${parte(p.value, p.dataIndex)}`,
        },
        labelLine: { length: 12, lineStyle: { color: o.palette.line } },
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
export function waterfallOptions(o: ChartOptions): Record<string, unknown> {
  const puntos = o.vm.points.map((p) => ({ label: p.label, valor: p.values[0] ?? 0 }));
  const withTotal = o.cascada?.showTotal !== false;
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

  const labels = [...puntos.map((p) => p.label), ...(withTotal ? ['Total'] : [])];
  if (withTotal) {
    zocalos.push(0);
    alturas.push(acumulado);
  }

  const colorOf = (indice: number) => {
    if (withTotal && indice === puntos.length) return o.palette.series[0] ?? o.palette.content;
    const valor = puntos[indice]?.valor ?? 0;
    // La subida usa el color principal de la paleta y la bajada el de contraste, que en el tema
    // institucional son el azul y el rojo. Salen del tema, no se eligen aqui.
    return (valor >= 0 ? o.palette.series[0] : o.palette.series[1]) ?? o.palette.content;
  };

  return {
    /*
     * La base se construye con la leyenda ya oculta, no se oculta despues: apagarla tras `base(o)`
     * dejaria el margen que `legendOf` ya habia reservado para ella.
     */
    ...base({ ...o, legend: 'oculta' }),
    legend: { show: false },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: o.palette.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.palette.content },
      extraCssText: 'box-shadow: none;',
      formatter: (params: { name: string; dataIndex: number }[]) => {
        const p = params[0];
        if (!p) return '';
        const totalIs = withTotal && p.dataIndex === puntos.length;
        const valor = totalIs ? acumulado : (puntos[p.dataIndex]?.valor ?? 0);
        const signo = totalIs || valor < 0 ? '' : '+';
        return `${p.name}<br/>${signo}${formatear(valor)}`;
      },
    },
    xAxis: { ...axisCategory(o), data: labels },
    yAxis: valueAxis(o),
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
        ...referencesOf(o),
        data: alturas.map((alto, i) => ({ value: alto, itemStyle: { color: colorOf(i) } })),
        label: {
          show: true,
          position: 'top' as const,
          color: o.palette.content,
          fontSize: 11,
          /*
           * El signo va en la etiqueta, siempre: el color distingue subida de bajada, pero no
           * puede ser el unico medio de transmitir esa informacion (WCAG 1.4.1).
           */
          formatter: (p: { dataIndex: number }) => {
            const totalIs = withTotal && p.dataIndex === puntos.length;
            const valor = totalIs ? acumulado : (puntos[p.dataIndex]?.valor ?? 0);
            return `${totalIs || valor < 0 ? '' : '+'}${formatear(valor)}`;
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
export function treeMapOptions(o: ChartOptions): Record<string, unknown> {
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
    const [grupo = punto.label, sheet] = punto.label.split(' / ');
    if (sheet !== undefined) jerarquico = true;
    const hijos = raices.get(grupo) ?? [];
    hijos.push({ name: sheet ?? grupo, value: valor });
    raices.set(grupo, hijos);
  }

  const datos = [...raices.entries()].map(([grupo, hijos]) =>
    jerarquico ? { name: grupo, children: hijos } : { name: grupo, value: hijos[0]?.value ?? 0 },
  );

  return {
    ...core(o, false),
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: o.palette.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.palette.content },
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
        itemStyle: { borderColor: o.palette.superficie, borderWidth: 2, gapWidth: 2 },
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
            o.datumLabels ? `${p.name}\n${formatear(p.value)}` : p.name,
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

export type ChartKind =
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

const CONSTRUCTORES: Record<ChartKind, (o: ChartOptions) => Record<string, unknown>> = {
  barras: barOptions,
  'barras-horizontales': horizontalBarOptions,
  lineas: lineOptions,
  area: areaOptions,
  circular: pieOptions,
  combinado: comboOptions,
  dispersion: scatterOptions,
  embudo: funnelOptions,
  cascada: waterfallOptions,
  'mapa-de-arbol': treeMapOptions,
  medidor: gaugeOptions,
};

/**
 * Un mapa y no una cadena de ternarios: con `Record<ChartKind, ...>`, anadir un tipo al union
 * sin escribir su constructor es un error de compilacion.
 */
export function optionsOf(tipo: ChartKind, o: ChartOptions): Record<string, unknown> {
  return (CONSTRUCTORES[tipo] ?? barOptions)(o);
}

/**
 * Umbral a partir del cual conviene Canvas.
 *
 * Canvas es el renderizador por defecto porque aguanta volumen e interaccion. Por debajo del
 * umbral un SVG no cuesta nada y se puede seleccionar e inspeccionar; y al IMPRIMIR siempre se
 * usa SVG, porque un canvas impreso es un mapa de bits a la resolucion de la pantalla.
 */
export const ELEMENT_THRESHOLD = 400;

export function elementsOf(vm: CategoricalViewModel): number {
  return vm.points.length * Math.max(1, vm.series.length);
}
