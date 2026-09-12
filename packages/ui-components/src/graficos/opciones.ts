import type { CategoricalViewModel } from '../registry/viewModel';

/**
 * Construccion de las opciones de Apache ECharts — seccion 4.2.
 *
 * Funciones PURAS: reciben el modelo de vista y la paleta, y devuelven el objeto de opciones.
 * No tocan el DOM ni importan ECharts, y por eso se pueden probar sin navegador. Lo que monta
 * el grafico es otra cosa, en el shell.
 *
 * Esa separacion no es ceremonia: lo que hay que poder comprobar de un grafico es que los datos
 * y los rotulos que le llegan son los correctos, y eso es una comparacion de objetos. Que ECharts
 * dibuje bien un `bar` no es cosa de este repositorio.
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
}

/**
 * Lo que comparten todos los graficos.
 *
 * `aria.enabled` hace que ECharts genere una descripcion del grafico y la ponga en el
 * contenedor; `aria.decal.show` dibuja un PATRON distinto sobre cada serie. Lo segundo es lo que
 * cumple el criterio de WCAG 1.4.1: el color no puede ser el unico medio de transmitir
 * informacion, y con ocho series eso deja de ser una formalidad — al imprimir en gris, o para
 * quien no distingue rojo y verde, el patron es lo unico que separa una serie de otra.
 *
 * Pero SOLO con mas de una serie. Con una sola no hay nada que distinguir del color: el trazado
 * no transmite ninguna informacion y la unica consecuencia es una barra rayada que se lee como
 * ruido. 1.4.1 pide que el color no sea el UNICO medio de distinguir cosas; donde no hay cosas
 * que distinguir, no hay nada que cumplir.
 */
function base(o: OpcionesDeGrafico) {
  const variasSeries = o.vm.series.length > 1;
  return {
    aria: {
      enabled: true,
      decal: { show: variasSeries },
      label: {
        enabled: true,
        general: {
          withTitle: o.dimension
            ? `Grafico: ${o.titulo}, por ${o.dimension}.`
            : `Grafico: ${o.titulo}.`,
        },
      },
    },
    color: o.paleta.series,
    backgroundColor: 'transparent',
    animation: false,
    textStyle: { color: o.paleta.texto },
    /*
     * El margen inferior reserva sitio para la leyenda cuando la hay.
     *
     * `containLabel` cuenta los rotulos del eje, pero NO la leyenda, que se posiciona sobre el
     * contenedor entero. Con el margen fijo, la leyenda se dibujaba encima de los nombres de las
     * categorias y ambos quedaban ilegibles.
     */
    grid: { left: 8, right: 16, top: 24, bottom: variasSeries ? 32 : 8, containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
    },
    legend: variasSeries
      ? { bottom: 0, textStyle: { color: o.paleta.textoAtenuado }, icon: 'roundRect' }
      : { show: false },
  };
}

const ejeCategoria = (o: OpcionesDeGrafico) => ({
  type: 'category' as const,
  data: o.vm.points.map((p) => p.label),
  axisLabel: { color: o.paleta.textoAtenuado, hideOverlap: true },
  axisLine: { lineStyle: { color: o.paleta.linea } },
  axisTick: { show: false },
  /*
   * El nombre de la dimension NO se rotula en el eje.
   *
   * Con `DimTribunal.Distrito` en un objeto de 400 px, ECharts lo recortaba a una letra suelta
   * —"D"— al borde del grafico: ruido que ademas parecia un fallo. El titulo del objeto ya dice
   * de que va, y la dimension exacta viaja en la descripcion accesible, que es donde hace falta.
   */
});

const ejeValor = (o: OpcionesDeGrafico) => ({
  type: 'value' as const,
  axisLabel: { color: o.paleta.textoAtenuado },
  splitLine: { lineStyle: { color: o.paleta.linea, type: 'dashed' as const } },
});

/** Barras verticales. Una serie por medida mapeada. */
export function opcionesDeBarras(o: OpcionesDeGrafico): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: ejeCategoria(o),
    yAxis: ejeValor(o),
    series: o.vm.series.map((nombre, s) => ({
      name: nombre,
      type: 'bar',
      data: o.vm.points.map((p) => p.values[s] ?? 0),
      // Barras con la esquina redondeada arriba: es la forma `extra-small` de MD3 aplicada al
      // dato, para que el grafico no parezca de otra aplicacion.
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 48,
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
      emphasis: { focus: 'series' },
    })),
  };
}

export type TipoDeGrafico = 'barras' | 'lineas';

export function opcionesDe(tipo: TipoDeGrafico, o: OpcionesDeGrafico): Record<string, unknown> {
  return tipo === 'lineas' ? opcionesDeLineas(o) : opcionesDeBarras(o);
}

/**
 * Umbral a partir del cual conviene Canvas.
 *
 * Canvas es el renderizador POR DEFECTO, como pide el pliego, porque aguanta volumen y
 * interaccion sin degradarse. SVG se reserva para el caso en el que "resulta tecnicamente
 * conveniente", y ese caso tiene un nombre concreto: IMPRIMIR. Un canvas impreso es un mapa de
 * bits a la resolucion de la pantalla, es decir, borroso; un SVG sale nitido a cualquier tamano.
 *
 * El numero existe para el caso contrario: por debajo de el, un SVG no cuesta nada y trae
 * ventajas —se puede seleccionar, se inspecciona en las herramientas del navegador—, asi que no
 * hay motivo para rasterizar. Por encima, cada elemento del SVG es un nodo del DOM y el
 * navegador se ahoga.
 */
export const UMBRAL_DE_ELEMENTOS = 400;

export function elementosDe(vm: CategoricalViewModel): number {
  return vm.points.length * Math.max(1, vm.series.length);
}
