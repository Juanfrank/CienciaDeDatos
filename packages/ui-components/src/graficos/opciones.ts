import type { ConfiguracionDeEjes, ModoDeApilado, ModoDeLeyenda } from '../presentacion/contrato';
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
  apilado?: ModoDeApilado;
}

/* ── Apilado ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Los valores que se dibujan, segun el modo de apilado.
 *
 * En `porcentaje` NO se le pasan a ECharts los valores originales: se convierten a su parte del
 * total de la categoria. ECharts no sabe apilar al 100 % por su cuenta —lo que ofrece es `stack`,
 * que suma—, asi que el reparto se hace aqui.
 *
 * Un total de cero deja todas las partes en cero y no en `NaN`: dividir por cero pintaria el
 * grafico vacio sin decir por que, y «no hubo casos» es una respuesta legitima que hay que poder
 * dibujar.
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

/**
 * El tooltip de un grafico al 100 %.
 *
 * Ensena el porcentaje Y la cifra original. Solo el porcentaje esconderia la magnitud —dos
 * categorias con el mismo reparto pueden ser 12 casos y 12.000— y solo la cifra contradiria lo que
 * se ve dibujado.
 */
function tooltipDe(o: OpcionesDeGrafico) {
  const comun = {
    trigger: 'axis' as const,
    backgroundColor: o.paleta.superficieElevada,
    borderWidth: 0,
    textStyle: { color: o.paleta.texto },
    extraCssText: 'box-shadow: none;',
  };
  if (o.apilado !== 'porcentaje') return comun;

  return {
    ...comun,
    formatter: (params: { name: string; seriesName: string; value: number; dataIndex: number }[]) => {
      const punto = params[0];
      if (!punto) return '';
      const filas = params.map((p) => {
        const crudo = o.vm.points[p.dataIndex]?.values[o.vm.series.indexOf(p.seriesName)] ?? null;
        const cifra = crudo === null ? '—' : (o.formatear?.(crudo, o.vm.series.indexOf(p.seriesName)) ?? String(crudo));
        return `${p.seriesName}: ${p.value.toFixed(1)} % (${cifra})`;
      });
      return [punto.name, ...filas].join('<br/>');
    },
  };
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
  /*
   * `type: 'scroll'` en TODAS las posiciones.
   *
   * Con tres series y una tarjeta estrecha, la leyenda inferior se salia por el lado derecho y el
   * ultimo nombre quedaba cortado. Desplazable, ECharts pagina y pone flechas en vez de recortar.
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
    tooltip: tooltipDe(o),
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
  // Al 100 % el eje va de 0 a 100 y con el simbolo puesto: sin el, la escala parece de unidades
  // y el grafico se lee como si midiera casos.
  ...(o.apilado === 'porcentaje' ? { max: 100, min: 0 } : {}),
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

/**
 * Las series de un grafico de barras, verticales u horizontales.
 *
 * Se factoriza porque columnas y barras solo se diferencian en que ejes intercambian y hacia donde
 * redondea la esquina: con dos copias, anadir el apilado significaria acordarse de los dos sitios.
 */
function seriesDeBarras(o: OpcionesDeGrafico, horizontal: boolean) {
  const datos = valoresApilados(o);
  const apilada = o.apilado && o.apilado !== 'ninguno';

  return o.vm.series.map((nombre, s) => ({
    name: nombre,
    type: 'bar',
    data: datos[s] ?? [],
    ...pilaDe(o),
    /*
     * La esquina redondeada solo en la barra SUELTA.
     *
     * Apiladas, redondear cada segmento dibuja muescas entre uno y otro y la pila deja de leerse
     * como un total: parecen trozos sueltos que casualmente estan pegados.
     */
    itemStyle: apilada
      ? {}
      : { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    barMaxWidth: 48,
    // Apilada, la cifra va DENTRO del segmento: encima se dibujaria sobre el segmento siguiente.
    label: etiquetaDeSerie(o, s, apilada ? 'inside' : horizontal ? 'right' : 'top'),
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
 * Barras horizontales — el «grafico de barras» de verdad.
 *
 * No es un capricho de estilo: con nombres de categoria largos —«Juzgado de Primera Instancia de
 * Santiago»— las columnas obligan a girar los rotulos o a recortarlos, y en horizontal caben
 * enteros. Es el caso normal cuando la dimension son tribunales o materias.
 *
 * Es el MISMO objeto con los ejes intercambiados; lo unico que no se intercambia es cual es la
 * categoria y cual el valor, y eso lo decide quien construye, no ECharts.
 */
export function opcionesDeBarrasHorizontales(o: OpcionesDeGrafico): Record<string, unknown> {
  return {
    ...base(o),
    xAxis: ejeValor(o),
    yAxis: {
      ...ejeCategoria(o),
      /*
       * Se invierte el eje de categorias.
       *
       * ECharts numera el eje vertical de abajo arriba, asi que sin esto la primera categoria del
       * modelo sale ABAJO y la lista se lee al reves de como se ordeno — justo lo que rompe el
       * «ordenar por valor descendente» que se acaba de anadir.
       */
      inverse: true,
    },
    series: seriesDeBarras(o, true),
  };
}

/**
 * Area. Es una linea con el relleno debajo.
 *
 * Sirve para lo que la linea no: cuando importa el VOLUMEN acumulado y no solo la trayectoria.
 * Apilada responde ademas a «de que se compone ese total a lo largo del tiempo», que con lineas
 * sueltas hay que sumar de cabeza.
 */
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
       * Sin apilar, el relleno va semitransparente.
       *
       * Con varias areas opacas, la de delante tapa a las de atras y las de atras dejan de
       * existir. Apiladas no se solapan —cada una ocupa su banda— y ahi el relleno solido es lo
       * que hace legible la composicion.
       */
      areaStyle: o.apilado && o.apilado !== 'ninguno' ? {} : { opacity: 0.25 },
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

export type TipoDeGrafico = 'barras' | 'lineas' | 'barras-horizontales' | 'area';

const CONSTRUCTORES: Record<TipoDeGrafico, (o: OpcionesDeGrafico) => Record<string, unknown>> = {
  barras: opcionesDeBarras,
  'barras-horizontales': opcionesDeBarrasHorizontales,
  lineas: opcionesDeLineas,
  area: opcionesDeArea,
};

/**
 * Un mapa y no una cadena de ternarios.
 *
 * Con `Record<TipoDeGrafico, ...>`, anadir un tipo al union sin escribir su constructor es un
 * error de compilacion. Con ternarios, el tipo nuevo caeria en silencio en el `else` y se
 * dibujaria como columnas — un fallo que no revienta y que solo se ve mirando la pantalla.
 */
export function opcionesDe(tipo: TipoDeGrafico, o: OpcionesDeGrafico): Record<string, unknown> {
  return (CONSTRUCTORES[tipo] ?? opcionesDeBarras)(o);
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
