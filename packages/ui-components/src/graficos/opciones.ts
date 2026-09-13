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
  /** La cifra sobre cada barra o punto. `true` es la forma anterior y se sigue admitiendo. */
  etiquetasDeDato?: EtiquetasDeDato;
  tooltip?: ConfiguracionDeTooltip;
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
  circular?: ConfiguracionCircular;
  combinado?: ConfiguracionDeCombinado;
  referencias?: LineaDeReferencia[];
  coloresDeSerie?: number[];
  embudo?: ConfiguracionDeEmbudo;
  cascada?: ConfiguracionDeCascada;
  medidor?: ConfiguracionDeMedidor;
  /**
   * Cuantas series iniciales son columnas, en un combinado.
   *
   * Sale del MAPEO —de cuantos campos hay en el pozo «Columnas»— y no de la presentacion: cual
   * es columna y cual es linea es una propiedad de los datos, no de como se ven.
   */
  seriesDeColumna?: number;
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
       *
       * Al 100 % ese valor es el porcentaje, no la cifra, y el total de una categoria seria
       * siempre 100. El modelo es de donde salieron los dos.
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
 * Donde poner la leyenda, resuelto.
 *
 * `auto` la ensena solo con mas de una serie: con una sola no distingue nada y se come el alto.
 * Devuelve tambien cuanto margen hay que reservarle, porque `containLabel` de ECharts cuenta los
 * rotulos del eje pero NO la leyenda — sin reservar, se dibuja encima de los nombres de las
 * categorias y quedan ilegibles los dos.
 */
function leyendaDe(o: OpcionesDeGrafico, hayQueDistinguir = o.vm.series.length > 1) {
  const varias = hayQueDistinguir;
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

/**
 * La paleta, con los colores que cada serie tenga asignados.
 *
 * Se permuta el array que ECharts consume en vez de escribir `itemStyle.color` en cada serie: asi
 * el color llega igual a las barras, a la leyenda, a los decals y al tooltip, sin que ninguno de
 * los cuatro pueda quedarse con el de antes. Una serie sin asignacion se queda con el color que
 * le tocaba por orden.
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
 * Las lineas de referencia, como `markLine` de la PRIMERA serie.
 *
 * Van en una serie y no en una serie propia porque una serie propia aparaceria en la leyenda y en
 * el tooltip como si fuera un dato mas, y una meta no es un dato medido. `silent: true` por lo
 * mismo: la raya no responde al raton.
 *
 * El eje al que se anclan depende de la orientacion, y eso lo decide quien construye: en unas
 * barras horizontales el eje de valores es el X, y anclarlas siempre al Y dibujaria la meta
 * atravesada.
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
 * El grafico no tiene acceso a las variables CSS —es una funcion pura— asi que trabaja con lo que
 * la paleta le pasa. `primario` y `error` son los dos roles que ya vienen resueltos en ella (el
 * primer color de serie y el segundo, que en el tema institucional son el azul y el rojo); el
 * resto cae al color de texto, que siempre contrasta con la superficie.
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

/**
 * Lo comun a los graficos CON ejes.
 *
 * El nucleo —aria, colores, animacion— lo comparten todos, tambien los que no tienen rejilla
 * (circular y medidor). Lo que separa a estos es exactamente la rejilla y un tooltip por eje:
 * meterlos en el nucleo obligaria a los otros a borrarlos, y borrar una opcion que el padre puso
 * es justo la forma de que una de ellas se cuele algun dia.
 */
/**
 * Empuja hacia dentro las cifras de los puntos que TOCAN el borde.
 *
 * En una linea, `boundaryGap: false` pone el primer punto justo sobre el eje —que es lo correcto
 * para una serie temporal— y su cifra, centrada encima, se dibujaba pisando el rotulo de la
 * escala: «400312» donde deberia leerse «400» y «312».
 *
 * Ampliar el margen del area no sirve: con `containLabel`, ECharts lo recalcula para que quepan
 * los rotulos y se come lo que se le anada. Lo que si funciona es mover ESA etiqueta, que es lo
 * que `labelLayout` permite hacer sabiendo su indice. Solo se mueven la primera y la ultima: son
 * las unicas que caen fuera del area.
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
const POSICION_ECHARTS: Record<string, string | undefined> = {
  auto: undefined,
  encima: 'top',
  debajo: 'bottom',
  dentro: 'inside',
};

/**
 * Los indices del maximo y el minimo de una serie.
 *
 * Son los dos puntos por los que se mira un grafico, y con veinte categorias son los dos unicos
 * que se pueden rotular sin que el resultado sea una maranha. Los nulos no compiten: «no hay
 * respuesta» no es un minimo.
 */
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
     *
     * La alternativa seria apagar la etiqueta punto a punto en los datos, y eso obliga a que cada
     * constructor convierta su array de valores en un array de objetos: cuatro sitios donde el
     * dato deja de ser un numero suelto, y cuatro oportunidades de que uno se quede atras.
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
     * Girados, se dejan de esconder.
     *
     * `hideOverlap` es lo correcto con los rotulos en horizontal —solapados no se lee ninguno—
     * pero esconde sin avisar: el grafico acaba ensenando una de cada tres categorias como si las
     * demas no existieran. Quien gira los rotulos lo hace justamente para verlas todas.
     */
    hideOverlap: !o.ejes?.rotarX,
    ...(o.ejes?.rotarX ? { rotate: o.ejes.rotarX } : {}),
  },
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
  /*
   * Los limites, en orden de quien manda.
   *
   * El 100 % los impone: el eje va de 0 a 100 porque eso es lo que el grafico mide, y dejar que
   * alguien lo cambie produciria un «100 %» que no llega al borde. Fuera de ahi manda lo que se
   * haya escrito a mano, y si no hay nada, ECharts.
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
 * Un valor NULO se DESCARTA, no se dibuja como cero. `null` significa «no hay respuesta» —una
 * medida ya calculada por la fuente que el objeto colapso—, y una porcion de tamano cero afirma
 * que esa categoria no aporto nada, que es una afirmacion distinta y probablemente falsa. En un
 * circular la consecuencia es peor que en una barra: el total del que todo lo demas es porcentaje
 * cambiaria segun lo que se invente aqui.
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
 * La etiqueta de una porcion, con el porcentaje calculado AQUI y no con el `{d}` de ECharts.
 *
 * `{d}` sale con dos decimales —«47.61 %»— y esos cuatro caracteres de mas son justo los que no
 * caben en una tarjeta estrecha: ECharts los recortaba a «47....», que se lee como un fallo de
 * dibujo. Un decimal dice lo mismo y cabe.
 */
const etiquetaDePorcion = (
  modo: EtiquetaCircular,
  formatear: (n: number) => string,
  total: number,
) => {
  const parte = (valor: number) => (total === 0 ? '—' : `${((valor / total) * 100).toFixed(1)} %`);
  return (p: { name: string; value: number }) => {
    switch (modo) {
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
 * Es el mismo constructor para los dos objetos del catalogo, y el hueco del centro es una
 * propiedad y no un objeto aparte: el contrato de datos es identico, asi que pasar de pastel a
 * dona no puede costar la configuracion entera. Que en el catalogo esten los dos por separado es
 * cosa de la PALETA —quien busca «dona» tiene que encontrarla por su nombre—, no del dibujo.
 *
 * Solo lee la PRIMERA medida. Un circular con dos medidas no es un circular: son dos, y el
 * contrato lo dice con `measures: { max: 1 }` en vez de dejar que el render elija en silencio.
 */
export function opcionesDeCircular(o: OpcionesDeGrafico): Record<string, unknown> {
  const c = o.circular ?? {};
  const hueco = Math.min(Math.max(c.radioInterior ?? 0, 0), MAX_RADIO_INTERIOR);
  const porciones = porcionesDe(o);
  const total = porciones.reduce((suma, p) => suma + p.value, 0);
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const modo: EtiquetaCircular = c.etiquetas ?? 'porcentaje';

  /*
   * Aqui la leyenda distingue CATEGORIAS, no series.
   *
   * `auto` mira cuantas series hay y en un circular siempre hay una, asi que se ocultaba siempre
   * —y sin leyenda, un pastel es una rueda de colores sin nombre—. Lo que hay que distinguir es
   * cada porcion, y eso es lo que se le pasa.
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
     * El total en el centro, solo si hay centro.
     *
     * Con hueco cero la cifra caeria encima de las porciones y taparia justo lo que el grafico
     * dibuja. No es una preferencia: sin anillo no hay hueco donde escribir.
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
         * Fuera y no dentro porque dentro habria que escribir sobre el color de la serie, y ese
         * color lo elige el tema: no hay par de contraste comprobado contra el, que es justo la
         * garantia que 4.3 no deja romper. Fuera, el texto va sobre la superficie de la tarjeta,
         * donde el contraste si esta comprobado.
         *
         * Y por eso el radio depende de LO QUE DIGA la etiqueta: «52.6 %» ocupa seis caracteres y
         * «Q3: 31.4 %» casi el doble. Con un radio fijo, el modo que lleva el nombre se recortaba
         * a «Q3: 31....», que no se lee como un nombre largo sino como un fallo de dibujo.
         */
        radius: [`${hueco}%`, RADIO_EXTERIOR[modo]],
        center: ['50%', '50%'],
        // Sin reordenar por su cuenta: el orden ya se decidio arriba, y con `false` ECharts
        // respeta el del modelo, que es el mismo que ve la tabla de datos adjunta.
        avoidLabelOverlap: true,
        itemStyle: { borderColor: o.paleta.superficie, borderWidth: 2 },
        label:
          modo === 'ninguna'
            ? { show: false }
            : {
                show: true,
                color: o.paleta.texto,
                fontSize: 11,
                formatter: etiquetaDePorcion(modo, formatear, total),
                /*
                 * Las etiquetas largas se alinean al BORDE de la tarjeta, no a la porcion.
                 *
                 * Con el radio ya reducido, «Q2: 25.4 %» seguia recortandose a la izquierda: cada
                 * etiqueta arranca donde acaba su linea guia y ahi ya no queda ancho. Alineadas al
                 * borde, todas empiezan en el mismo sitio —el maximo disponible— y ECharts estira
                 * la guia hasta ellas.
                 */
                ...(modo === 'categoria' || modo === 'categoria-porcentaje'
                  ? { alignTo: 'edge' as const, edgeDistance: 2 }
                  : {}),
              },
        labelLine: { show: modo !== 'ninguna', lineStyle: { color: o.paleta.linea } },
        data: porciones,
        emphasis: { focus: 'self' },
      },
    ],
  };
}

/* ── Medidor (tacometro) ───────────────────────────────────────────────────────────────────── */

/**
 * El siguiente numero «redondo» por encima de `n`.
 *
 * La escala de un medidor no puede salir del maximo de los datos: con 2.216 casos el arco
 * terminaria en 2.216, y manana con 2.220 terminaria en 2.220 — la misma aguja en el mismo sitio
 * para dos cifras distintas, y dos capturas que no se pueden comparar. Redondeando hacia arriba a
 * 1, 2, 2,5 o 5 por decada, la escala solo cambia cuando la magnitud cambia de verdad.
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
 * Responde a «cuanto llevamos de lo que teniamos que hacer», que es lo que un KPI no dice: la
 * tarjeta da el numero y la variacion contra el periodo anterior, pero no contra el OBJETIVO.
 *
 * El objetivo puede venir del dataset (la segunda medida) o fijarse a mano en la presentacion. La
 * medida manda: si el mapeo trae una, es la que se dibuja, porque un numero escrito en la
 * configuracion no se actualiza y el del dataset si.
 */
export function opcionesDeMedidor(o: OpcionesDeGrafico): Record<string, unknown> {
  const m = o.medidor ?? {};
  const punto = o.vm.points[0];
  const valor = punto?.values[0] ?? null;
  const objetivo = punto?.values[1] ?? m.objetivo ?? null;

  const minimo = m.minimo ?? 0;
  const maximo =
    m.maximo ?? escalaBonita(Math.max(valor ?? 0, objetivo ?? 0, minimo + 1) * 1.1);
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
         * Solo los extremos van rotulados.
         *
         * `splitNumber: 1` deja dos marcas —el minimo y el maximo— y esas son las que hacen que el
         * angulo signifique algo. Con la escala entera rotulada, en una tarjeta de dos filas los
         * numeros se pisan entre si y no se lee ninguno.
         */
        splitNumber: 1,
        axisLabel: {
          distance: -30,
          color: o.paleta.textoAtenuado,
          fontSize: 11,
          formatter: (n: number) => formatear(n),
        },
        /*
         * La cifra, debajo de la aguja.
         *
         * Un angulo no es un numero: sin esto, «a poco mas de la mitad» es todo lo que el objeto
         * comunica, y la cifra exacta habria que ir a buscarla a otro sitio.
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
       * El objetivo, como una marca sobre el arco y no como una segunda aguja.
       *
       * Es una serie aparte con SOLO su puntero: una raya fina en el angulo de la meta. Dibujarlo
       * como un segundo `data` de la misma serie pondria dos agujas iguales y no habria forma de
       * saber cual es el valor y cual la meta — que es exactamente el tipo de ambiguedad que
       * 1.4.1 no admite resolver solo con el color.
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
 * El eje de la derecha: la MISMA escala de valores, con dos diferencias.
 *
 * No repite la cuadricula —dos rejillas superpuestas a distinta altura convierten el fondo en
 * ruido— y su titulo sale de `tituloY2`. Todo lo demas se hereda para que los dos ejes se lean
 * igual: si uno empieza en cero y el otro no, la comparacion entre las dos series es un truco.
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
 * Cuales van de cada forma NO se decide aqui ni por una opcion del panel: lo dice el MAPEO, con
 * un pozo para cada una. Es lo que evita la pregunta imposible de «cual de las cuatro medidas es
 * la linea», y lo que hace que cambiar una medida de forma sea arrastrarla de un pozo al otro.
 *
 * `seriesDeColumna` es cuantas series iniciales son columnas; el resto son lineas. El render
 * garantiza ese orden al construir la lista de medidas, y por eso aqui basta un numero.
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
               * La linea se dibuja POR ENCIMA de las columnas.
               *
               * Por omision ECharts apila las series en el orden en que llegan, y la linea
               * quedaba tapada por las columnas justo en los puntos que importan.
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
 * Es el unico objeto donde la dimension NO reparte el eje: cada categoria es UN punto, y los dos
 * ejes son medidas. Responde a «se relacionan estas dos cifras», que ningun grafico de barras
 * puede contestar porque en todos ellos una de las dos es la escala.
 *
 * La tercera medida, si la hay, es el TAMANO del punto. Se reparte entre un minimo y un maximo
 * en vez de usar el valor crudo como radio: el area de un circulo crece con el cuadrado del
 * radio, asi que un valor cuatro veces mayor se veria dieciseis veces mas grande.
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
   * Se reserva alto por el RADIO del punto mas grande.
   *
   * `scale` ajusta el eje a los valores, pero el eje no sabe nada del tamano del simbolo: una
   * burbuja en el valor maximo se dibujaba medio cortada por el borde de arriba, con su etiqueta
   * fuera de la tarjeta. Los puntos son circulos, no marcas de un pixel, y el margen tiene que
   * contar con eso.
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
       * El tooltip nombra las MEDIDAS, no «x» e «y».
       *
       * Es lo unico que ata cada numero a lo que mide: en una dispersion no hay rotulo de
       * categoria en el eje que lo diga, como si lo hay en unas barras.
       */
      formatter: (p: { data: (number | string)[] }) => {
        const [x, y, , etiqueta] = p.data;
        const filas = [
          `${o.vm.series[0] ?? 'X'}: ${formatear(Number(x), 0)}`,
          `${o.vm.series[1] ?? 'Y'}: ${formatear(Number(y), 1)}`,
        ];
        return [String(etiqueta), ...filas].join('<br/>');
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
       * El titulo del eje horizontal va HORIZONTAL y debajo.
       *
       * `ejeValor` lo escribe rotado 90 grados porque en los demas graficos ese eje es el
       * vertical. Aqui los dos ejes son medidas, y heredar la rotacion dejaba «Ingresados» de
       * canto bajo el grafico, recortado a una letra suelta.
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
        // El cuarto elemento es la etiqueta del punto: viaja con el dato para que el tooltip y la
        // etiqueta la tengan sin volver a buscarla por indice.
        data: o.vm.points.map((p) => [p.values[0], p.values[1], p.values[2] ?? null, p.label]),
        symbolSize: conTamano
          ? (valores: (number | string)[]) =>
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
              formatter: (p: { data: (number | string)[] }) => String(p.data[3]),
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
 * No reordena POR SU CUENTA. Es la diferencia con un circular, y no es un detalle: las etapas de
 * un proceso tienen un orden propio —«ingresado», «admitido», «fallado»— y ordenarlas por tamano
 * lo destruiria. Que la segunda etapa sea mayor que la primera es una anomalia que hay que poder
 * VER, no un error de dibujo que haya que esconder ordenando.
 *
 * Quien quiera el embudo clasico —de mayor a menor— lo pide en «Ordenar», como en cualquier otro
 * objeto, y entonces el orden se aplica al MODELO antes de llegar aqui. Lo que no pasa es que se
 * ordene solo.
 */
export function opcionesDeEmbudo(o: OpcionesDeGrafico): Record<string, unknown> {
  const etapas = o.vm.points
    .map((p) => ({ name: p.label, valor: p.values[0] }))
    .filter((p): p is { name: string; valor: number } => p.valor !== null);

  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);
  const comparar: ComparacionDeEmbudo = o.embudo?.comparar ?? 'primero';
  const primero = etapas[0]?.valor ?? 0;

  /*
   * El porcentaje se calcula sobre la etapa que toque, y con la division por cero cerrada.
   *
   * Una etapa de referencia en cero no da «caida infinita»: da una comparacion sin sentido, y la
   * raya lo dice mejor que un numero inventado.
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
         * El embudo se estrecha a la IZQUIERDA del objeto y deja la derecha para las etiquetas.
         *
         * Centrado y con las etiquetas dentro, el texto cae sobre el relleno de la serie: un color
         * que elige el tema y contra el que no hay par de contraste comprobado (4.3). En azul
         * oscuro, «Q1: 29.4 %» quedaba casi ilegible. Fuera, el texto va sobre la superficie de la
         * tarjeta, que es justo la pareja que el tema si garantiza.
         */
        left: '2%',
        right: '42%',
        /*
         * Se reserva alto arriba y abajo, y NO se deja en cero.
         *
         * ECharts reparte el alto entre las etapas y dibuja cada trapecio hasta el borde del area.
         * Con el area pegada al borde del objeto, la primera y la ultima quedaban cortadas por la
         * mitad —con su etiqueta dentro— y parecia que faltaban etapas.
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
 * ECharts no tiene un tipo `waterfall`: se construye con DOS series de barras apiladas, una
 * invisible que hace de zocalo y otra visible con la contribucion encima. Es la tecnica estandar,
 * y lo que hay que cuidar es que el zocalo no aparezca en ningun sitio donde signifique algo: ni
 * en la leyenda, ni en el tooltip, ni al pasar el raton.
 *
 * El color distingue subidas de bajadas, y por eso la etiqueta lleva SIEMPRE el signo: con el
 * color como unico medio, una bajada y una subida serian indistinguibles al imprimir en gris o
 * para quien no separa rojo y verde (WCAG 1.4.1).
 */
export function opcionesDeCascada(o: OpcionesDeGrafico): Record<string, unknown> {
  const puntos = o.vm.points.map((p) => ({ label: p.label, valor: p.values[0] ?? 0 }));
  const conTotal = o.cascada?.mostrarTotal !== false;
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);

  /*
   * El zocalo de cada barra: donde acabo la anterior, o el suelo del tramo si el valor baja.
   *
   * Con valores negativos, la barra visible cuelga DESDE el acumulado anterior, asi que el zocalo
   * es el acumulado ya restado. Sin esa distincion, una bajada se dibujaba hacia arriba.
   */
  const zocalos: number[] = [];
  const alturas: number[] = [];
  let acumulado = 0;
  for (const { valor } of puntos) {
    zocalos.push(valor >= 0 ? acumulado : acumulado + valor);
    alturas.push(Math.abs(valor));
    acumulado += valor;
  }

  const etiquetas = [...puntos.map((p) => p.label), ...(conTotal ? ['Total'] : [])];
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
    ...base(o),
    // La leyenda no dice nada util aqui —hay una sola medida— y ademas nombraria el zocalo.
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
    xAxis: { ...ejeCategoria(o), data: etiquetas },
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
           * El SIGNO va en la etiqueta, siempre.
           *
           * El color ya distingue subida de bajada, pero el color no puede ser el unico medio de
           * transmitir la informacion: impreso en gris, o para quien no separa rojo y verde, «+180»
           * y «-180» serian la misma barra (WCAG 1.4.1).
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
 * Un circular con veinte porciones no se puede leer: las pequenas se vuelven hilos sin sitio para
 * su nombre. Un rectangulo, en cambio, sigue teniendo dos dimensiones donde escribir, y por eso
 * este es el objeto de la composicion con muchas categorias.
 *
 * Con DOS dimensiones dibuja dos niveles: el primero agrupa y el segundo reparte dentro. Es la
 * jerarquia, que es lo otro que un circular no puede hacer.
 */
export function opcionesDeMapaDeArbol(o: OpcionesDeGrafico): Record<string, unknown> {
  const formatear = (n: number) => o.formatear?.(n, 0) ?? String(n);

  /*
   * Las etiquetas del modelo vienen compuestas con « / » cuando hay dos dimensiones.
   *
   * Es lo que `toCategorical` hace para todos los objetos, y aqui es exactamente lo que hace
   * falta deshacer: el primer trozo es el grupo y el segundo la hoja.
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
         * Sin la barra de migas ni el zoom por rueda.
         *
         * Las dos convierten el objeto en un navegador con estado propio, y el estado de lo que se
         * ve vive en la URL (4.11): un zoom que no esta en la direccion no se comparte ni se marca,
         * y quien abriera el enlace veria otra cosa.
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
           * Aqui el blanco SI se fija a mano, y es la unica excepcion del repositorio.
           *
           * En un mapa de arbol el rectangulo ES el dato: no hay «fuera» donde poner la etiqueta,
           * como si lo hay en un circular o un embudo. Y los ocho colores de serie del tema son
           * saturados por construccion —la puerta de contraste lo comprueba—, asi que el blanco es
           * el unico valor que contrasta con todos ellos. Un rol del tema pensado para texto sobre
           * superficie no lo haria.
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
