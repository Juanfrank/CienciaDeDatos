import {
  MAX_RADIO_INTERIOR,
  type ConfiguracionCircular,
  type ConfiguracionDeEjes,
  type ConfiguracionDeMedidor,
  type EtiquetaCircular,
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
  circular?: ConfiguracionCircular;
  medidor?: ConfiguracionDeMedidor;
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
    color: o.paleta.series,
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

export type TipoDeGrafico =
  | 'barras'
  | 'lineas'
  | 'barras-horizontales'
  | 'area'
  | 'circular'
  | 'medidor';

const CONSTRUCTORES: Record<TipoDeGrafico, (o: OpcionesDeGrafico) => Record<string, unknown>> = {
  barras: opcionesDeBarras,
  'barras-horizontales': opcionesDeBarrasHorizontales,
  lineas: opcionesDeLineas,
  area: opcionesDeArea,
  circular: opcionesDeCircular,
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
