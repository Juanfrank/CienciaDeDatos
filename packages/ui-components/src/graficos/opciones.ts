import type { ConfiguracionDeEjes, ModoDeLeyenda } from '../presentacion/contrato';
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
  leyenda?: ModoDeLeyenda;
  /** La cifra sobre cada barra o punto. */
  etiquetasDeDato?: boolean;
  ejes?: ConfiguracionDeEjes;
  /**
   * Como formatear una cifra de la serie `s`.
   *
   * Lo inyecta quien dibuja, ya resuelto contra el formato de cada medida. Aqui no se puede
   * deducir: este modulo no conoce la presentacion de la instancia, y lo importante es que la
   * etiqueta sobre la barra diga exactamente lo mismo que la tabla de datos adjunta — con otro
   * formateador, el mismo numero saldria «2,216» en un sitio y «2216» en el otro.
   */
  formatear?: (valor: number, serie: number) => string;
}

/**
 * Donde poner la leyenda, resuelto.
 *
 * `auto` la ensena solo con mas de una serie: con una sola no distingue nada y se come el alto.
 * Devuelve tambien cuanto margen hay que reservarle, porque `containLabel` de ECharts cuenta los
 * rotulos del eje pero NO la leyenda — sin reservar, se dibuja encima de los nombres de las
 * categorias y quedan ilegibles los dos.
 */
function leyendaDe(o: OpcionesDeGrafico) {
  const varias = o.vm.series.length > 1;
  const modo: ModoDeLeyenda = o.leyenda ?? 'auto';
  const visible = modo === 'auto' ? varias : modo !== 'oculta';
  if (!visible) return { legend: { show: false }, margen: { bottom: 8, left: 8, right: 16, top: 24 } };

  /*
   * A los lados, la leyenda se ACOTA y trunca.
   *
   * Sin acotar, «CasosIngresados» se salia del objeto y quedaba cortado a media palabra por el
   * borde — que se lee como un fallo de dibujo, no como un nombre largo. Con `width` y
   * `overflow: truncate`, ECharts corta con puntos suspensivos y el nombre entero sigue en el
   * tooltip de la propia leyenda.
   */
  const comun = { textStyle: { color: o.paleta.textoAtenuado }, icon: 'roundRect' as const };
  const aLosLados = {
    ...comun,
    type: 'scroll' as const,
    textStyle: { color: o.paleta.textoAtenuado, width: 96, overflow: 'truncate' as const },
  };
  const lado = modo === 'auto' ? 'abajo' : modo;

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
/*
 * El margen del area de dibujo, con TODO lo que vive fuera de ella.
 *
 * `containLabel` de ECharts reserva sitio para los rotulos del eje, pero no para la leyenda ni
 * para los TITULOS de los ejes. Sin sumarlos, el titulo del eje de valores se dibujaba 44 px a la
 * izquierda de la linea del eje — o sea, fuera de la tarjeta, invisible. Un titulo que se
 * configura y no aparece es peor que no ofrecerlo.
 */
function margenDe(o: OpcionesDeGrafico, deLaLeyenda: { top: number; bottom: number; left: number; right: number }) {
  return {
    ...deLaLeyenda,
    left: deLaLeyenda.left + (o.ejes?.tituloY ? 44 : 0),
    bottom: deLaLeyenda.bottom + (o.ejes?.tituloX ? 24 : 0),
  };
}

function base(o: OpcionesDeGrafico) {
  const variasSeries = o.vm.series.length > 1;
  const { legend, margen } = leyendaDe(o);
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
    grid: { ...margenDe(o, margen), containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: o.paleta.superficieElevada,
      borderWidth: 0,
      textStyle: { color: o.paleta.texto },
      extraCssText: 'box-shadow: none;',
    },
    legend,
  };
}

/**
 * La etiqueta sobre cada barra o punto.
 *
 * Se formatea con el formateador de SU medida. Sin eso, la cifra sobre la barra saldria en crudo
 * —«2216»— mientras la tabla de datos adjunta dice «2,216 casos», y el mismo numero en la misma
 * tarjeta se leeria de dos formas.
 */
const etiquetaDeSerie = (o: OpcionesDeGrafico, s: number, posicion: string) =>
  o.etiquetasDeDato
    ? {
        show: true,
        position: posicion,
        color: o.paleta.texto,
        fontSize: 11,
        formatter: (p: { value: number }) =>
          o.formatear ? o.formatear(p.value, s) : String(p.value),
      }
    : { show: false };

const ejeCategoria = (o: OpcionesDeGrafico) => ({
  type: 'category' as const,
  show: o.ejes?.mostrarX !== false,
  data: o.vm.points.map((p) => p.label),
  axisLabel: { color: o.paleta.textoAtenuado, hideOverlap: true },
  axisLine: { lineStyle: { color: o.paleta.linea } },
  axisTick: { show: false },
  /*
   * El titulo del eje se pone A MANO o no se pone.
   *
   * Con `DimTribunal.Distrito` en un objeto de 400 px, ECharts lo recortaba a una letra suelta al
   * borde del grafico: ruido que ademas parecia un fallo. Ahora quien edita escribe «Distrito» si
   * hace falta, y si no lo escribe no sale nada.
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
   *
   * Con `DimTribunal.Distrito` en un objeto de 400 px, ECharts lo recortaba a una letra suelta
   * —"D"— al borde del grafico: ruido que ademas parecia un fallo. El titulo del objeto ya dice
   * de que va, y la dimension exacta viaja en la descripcion accesible, que es donde hace falta.
   */
});

const ejeValor = (o: OpcionesDeGrafico) => ({
  type: 'value' as const,
  show: o.ejes?.mostrarY !== false,
  axisLabel: { color: o.paleta.textoAtenuado },
  splitLine: {
    show: o.ejes?.cuadricula !== false,
    lineStyle: { color: o.paleta.linea, type: 'dashed' as const },
  },
  /*
   * El eje empieza en cero salvo que alguien decida lo contrario.
   *
   * `scale: true` de ECharts es lo contrario: ajusta el minimo a los datos, y con eso una
   * diferencia del 2 % entre dos barras parece el triple. Que sea una decision explicita y no el
   * comportamiento por omision es la diferencia entre un grafico y un grafico enganoso.
   */
  scale: o.ejes?.desdeCero === false,
  /*
   * El titulo del eje de valores va ROTADO y a media altura, no arriba.
   *
   * Arriba —que es donde ECharts lo pone por omision en un eje de valores— se dibujaba justo
   * encima del rotulo mas alto, «2,500», y los dos quedaban ilegibles. Rotado en el margen
   * izquierdo es ademas donde lo pone cualquier herramienta de informes.
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
      label: etiquetaDeSerie(o, s, 'top'),
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
