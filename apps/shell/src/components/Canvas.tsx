'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { CategoricalViewModel } from '@app/ui-components';
import {
  ELEMENT_THRESHOLD,
  elementsOf,
  optionsOf,
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
  presentacion?: ObjectPresentation;
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
  presentacion,
  formatear,
  columnSeries,
  onSeleccionar,
  onMontado,
}: PropsCanvas) {
  const contenedor = useRef<HTMLDivElement>(null);
  const grafico = useRef<import('echarts').ECharts | null>(null);

  /*
   * Los callbacks viajan por referencia mutable y NO por las dependencias del efecto.
   */
  const select = useRef(onSeleccionar);
  select.current = onSeleccionar;
  const montado = useRef(onMontado);
  montado.current = onMontado;

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
        ...(presentacion?.leyenda ? { leyenda: presentacion.leyenda } : {}),
        // Se pasa TAL CUAL: la forma anterior era un booleano y la nueva es un objeto, y quien
        // normaliza es el constructor de opciones, en una sola funcion pura.
        ...(presentacion?.etiquetasDeDato === undefined
          ? {}
          : { etiquetasDeDato: presentacion.etiquetasDeDato }),
        ...(presentacion?.tooltip ? { tooltip: presentacion.tooltip } : {}),
        ...(presentacion?.ejes ? { ejes: presentacion.ejes } : {}),
        ...(presentacion?.apilado ? { apilado: presentacion.apilado } : {}),
        ...(presentacion?.circular ? { circular: presentacion.circular } : {}),
        ...(presentacion?.medidor ? { medidor: presentacion.medidor } : {}),
        ...(presentacion?.combinado ? { combinado: presentacion.combinado } : {}),
        ...(presentacion?.embudo ? { embudo: presentacion.embudo } : {}),
        ...(presentacion?.cascada ? { cascada: presentacion.cascada } : {}),
        ...(presentacion?.referencias ? { referencias: presentacion.referencias } : {}),
        ...(presentacion?.coloresDeSerie ? { coloresDeSerie: presentacion.coloresDeSerie } : {}),
        ...(presentacion?.condicional ? { condicional: presentacion.condicional } : {}),
        ...(columnSeries === undefined ? {} : { columnSeries }),
        ...(formatear ? { formatear } : {}),
      }),
    // `formatear` se redefine en cada render del padre, asi que NO entra en las dependencias: lo
    // que de verdad decide como se formatea es la presentacion, y esa si esta.
    [tipo, vm, palette, titulo, dimension, presentacion, columnSeries],
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
