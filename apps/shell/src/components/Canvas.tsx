'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslator } from './Locale';
import type { CategoricalViewModel } from '@app/ui-components';
import {
  ELEMENT_THRESHOLD,
  elementsOf,
  optionsOf,
  type ChartOptions,
  type ChartPalette,
  type ObjectPresentation,
  type ChartKind,
} from '@app/ui-components';

/** Monta un grafico de Apache ECharts sobre un contenedor. */

export interface PropsCanvas {
  tipo: ChartKind;
  vm: CategoricalViewModel;
  palette: ChartPalette;
  titulo: string;
  dimension?: string;
  presentation?: ObjectPresentation;
  formatear?: (valor: number, serie: number) => string;
  /** Solo el combinado: cuantas series iniciales son columnas. Sale del mapeo, no del formato. */
  columnSeries?: number;
  /** Se invoca al pulsar una categoria, para el filtrado cruzado (4.4). */
  onSeleccionar?: (categoria: string) => void;
  /** Se avisa cuando el grafico esta montado, para ocultar el respaldo visual. */
  onMontado?: () => void;
}

export default function Canvas({
  tipo,
  vm,
  palette,
  titulo,
  dimension,
  presentation,
  formatear,
  columnSeries,
  onSeleccionar,
  onMontado,
}: PropsCanvas) {
  const t = useTranslator();
  const contenedor = useRef<HTMLDivElement>(null);
  const grafico = useRef<import('echarts').ECharts | null>(null);

  /*
   * Los callbacks viajan por referencia mutable y NO por las dependencias del efecto.
   */
  const select = useRef(onSeleccionar);
  select.current = onSeleccionar;
  const montado = useRef(onMontado);
  montado.current = onMontado;

  /**
   * Pasa una clave de la presentacion a las opciones del grafico, CON EL NOMBRE COMPROBADO.
   *
   * Antes eran doce lineas de la forma `...(presentation?.ejes ? { ejes: presentation.ejes } : {})`
   * y tenian un agujero: un objeto literal que lleva un `...` dentro NO recibe la comprobacion de
   * propiedades sobrantes de TypeScript. El dia que `ejes` paso a llamarse `axes` en las dos
   * puntas —el tipo de la presentacion y el de las opciones—, esta linea siguio compilando, y el
   * grafico se habria quedado sin ejes en silencio. Es exactamente el fallo del que va el
   * apartado 2.11: la clave vive en dos sitios y el compilador solo mira uno.
   *
   * Exigiendo que la clave este en LOS DOS tipos, el mismo renombrado no compila hasta hacerlo
   * entero.
   */
  const comun = <K extends keyof ChartOptions & keyof ObjectPresentation>(
    clave: K,
  ): Partial<ChartOptions> =>
    presentation?.[clave] === undefined
      ? {}
      : ({ [clave]: presentation[clave] } as Partial<ChartOptions>);

  /*
   * Las opciones se comparan por CONTENIDO, no por identidad.
   */
  const opciones = useMemo(
    () =>
      optionsOf(tipo, {
        vm,
        palette,
        titulo,
        ...(dimension ? { dimension } : {}),
        ...comun('legend'),
        // Se pasa TAL CUAL: la forma anterior era un booleano y la nueva es un objeto, y quien
        // normaliza es el constructor de opciones, en una sola funcion pura.
        ...comun('datumLabels'),
        ...comun('tooltip'),
        ...comun('axes'),
        ...comun('apilado'),
        ...comun('circular'),
        ...comun('medidor'),
        ...comun('combinado'),
        ...comun('embudo'),
        ...comun('cascada'),
        ...comun('histogram'),
        ...comun('boxplot'),
        ...comun('heatmap'),
        // Los rotulos de las capas que el grafico anade por su cuenta. El paquete de objetos es
        // puro y no lee el catalogo de mensajes: le llegan ya traducidos, como la paleta.
        layerLabels: { outliers: t('chart.layer.outliers'), mean: t('chart.layer.mean') },
        ...comun('references'),
        ...comun('seriesColors'),
        ...comun('conditional'),
        ...(columnSeries === undefined ? {} : { columnSeries }),
        ...(formatear ? { formatear } : {}),
      }),
    // `formatear` se redefine en cada render del padre, asi que NO entra en las dependencias: lo
    // que de verdad decide como se formatea es la presentacion, y esa si esta.
    [tipo, vm, palette, titulo, dimension, presentation, columnSeries, t],
  );
  const clave = useMemo(() => JSON.stringify(opciones), [opciones]);
  const porDefecto: 'canvas' | 'svg' = elementsOf(vm) >= ELEMENT_THRESHOLD ? 'canvas' : 'svg';

  /*
   * Las opciones viajan por referencia, y se le entrega a ECharts el OBJETO, no la cadena.
   */
  const activeOptions = useRef(opciones);
  activeOptions.current = opciones;

  // Creacion y destruccion: una sola vez mientras el tipo de renderizador no cambie.
  useEffect(() => {
    const node = contenedor.current;
    if (!node) return;

    let cancelado = false;
    let observador: ResizeObserver | null = null;
    let print: MediaQueryList | null = null;
    let printTo: ((e: MediaQueryListEvent) => void) | null = null;

    void (async () => {
      const echarts = await import('echarts');
      if (cancelado) return;

      const montar = (renderer: 'canvas' | 'svg') => {
        grafico.current?.dispose();
        const objectInstance = echarts.init(node, null, { renderer });
        objectInstance.setOption(activeOptions.current);
        /*
         * Solo el boton PRIMARIO filtra.
         *
         * ECharts emite su `click` con cualquier boton, asi que el boton derecho sobre una barra
         * filtraba el modulo: la URL cambiaba, la pagina se redibujaba y el menu contextual que
         * acababa de abrirse desaparecia antes de que nadie lo viera. Y filtrar con el boton
         * derecho no es lo que nadie espera en ninguna aplicacion.
         */
        objectInstance.on('click', (evento) => {
          const boton = (evento.event as { button?: number } | undefined)?.button;
          if (boton !== undefined && boton !== 0) return;
          if (evento.name) select.current?.(evento.name);
        });
        grafico.current = objectInstance;
      };

      montar(porDefecto);
      montado.current?.();

      observador = new ResizeObserver(() => grafico.current?.resize());
      observador.observe(node);

      // Al imprimir se rehace en SVG, y se vuelve al de pantalla al terminar.
      print = window.matchMedia('print');
      printTo = (e) => montar(e.matches ? 'svg' : porDefecto);
      print.addEventListener('change', printTo);
    })();

    return () => {
      cancelado = true;
      observador?.disconnect();
      if (print && printTo) print.removeEventListener('change', printTo);
      grafico.current?.dispose();
      grafico.current = null;
    };
  }, [porDefecto]);

  /*
   * Cambios de datos: se aplican sobre el grafico vivo.
   */
  useEffect(() => {
    grafico.current?.setOption(activeOptions.current, true);
  }, [clave]);

  return <div ref={contenedor} className="chart__canvas" data-testid="canvas-chart" />;
}
