'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { CategoricalViewModel } from '@app/ui-components';
import {
  UMBRAL_DE_ELEMENTOS,
  elementosDe,
  opcionesDe,
  type PaletaDeGrafico,
  type PresentacionDeObjeto,
  type TipoDeGrafico,
} from '@app/ui-components';

/** Monta un grafico de Apache ECharts sobre un contenedor. */

export interface LienzoProps {
  tipo: TipoDeGrafico;
  vm: CategoricalViewModel;
  paleta: PaletaDeGrafico;
  titulo: string;
  dimension?: string;
  presentacion?: PresentacionDeObjeto;
  formatear?: (valor: number, serie: number) => string;
  /** Solo el combinado: cuantas series iniciales son columnas. Sale del mapeo, no del formato. */
  seriesDeColumna?: number;
  /** Se invoca al pulsar una categoria, para el filtrado cruzado (4.4). */
  onSeleccionar?: (categoria: string) => void;
  /** Se avisa cuando el grafico esta montado, para ocultar el respaldo visual. */
  onMontado?: () => void;
}

export default function Lienzo({
  tipo,
  vm,
  paleta,
  titulo,
  dimension,
  presentacion,
  formatear,
  seriesDeColumna,
  onSeleccionar,
  onMontado,
}: LienzoProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const grafico = useRef<import('echarts').ECharts | null>(null);

  /*
   * Los callbacks viajan por referencia mutable y NO por las dependencias del efecto.
   */
  const seleccionar = useRef(onSeleccionar);
  seleccionar.current = onSeleccionar;
  const montado = useRef(onMontado);
  montado.current = onMontado;

  /*
   * Las opciones se comparan por CONTENIDO, no por identidad.
   */
  const opciones = useMemo(
    () =>
      opcionesDe(tipo, {
        vm,
        paleta,
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
        ...(seriesDeColumna === undefined ? {} : { seriesDeColumna }),
        ...(formatear ? { formatear } : {}),
      }),
    // `formatear` se redefine en cada render del padre, asi que NO entra en las dependencias: lo
    // que de verdad decide como se formatea es la presentacion, y esa si esta.
    [tipo, vm, paleta, titulo, dimension, presentacion, seriesDeColumna],
  );
  const clave = useMemo(() => JSON.stringify(opciones), [opciones]);
  const porDefecto: 'canvas' | 'svg' = elementosDe(vm) >= UMBRAL_DE_ELEMENTOS ? 'canvas' : 'svg';

  /*
   * Las opciones viajan por referencia, y se le entrega a ECharts el OBJETO, no la cadena.
   */
  const opcionesVigentes = useRef(opciones);
  opcionesVigentes.current = opciones;

  // Creacion y destruccion: una sola vez mientras el tipo de renderizador no cambie.
  useEffect(() => {
    const node = contenedor.current;
    if (!node) return;

    let cancelado = false;
    let observador: ResizeObserver | null = null;
    let paraImprimir: MediaQueryList | null = null;
    let alImprimir: ((e: MediaQueryListEvent) => void) | null = null;

    void (async () => {
      const echarts = await import('echarts');
      if (cancelado) return;

      const montar = (renderer: 'canvas' | 'svg') => {
        grafico.current?.dispose();
        const instancia = echarts.init(node, null, { renderer });
        instancia.setOption(opcionesVigentes.current);
        instancia.on('click', (evento: { name?: string }) => {
          if (evento.name) seleccionar.current?.(evento.name);
        });
        grafico.current = instancia;
      };

      montar(porDefecto);
      montado.current?.();

      observador = new ResizeObserver(() => grafico.current?.resize());
      observador.observe(node);

      // Al imprimir se rehace en SVG, y se vuelve al de pantalla al terminar.
      paraImprimir = window.matchMedia('print');
      alImprimir = (e) => montar(e.matches ? 'svg' : porDefecto);
      paraImprimir.addEventListener('change', alImprimir);
    })();

    return () => {
      cancelado = true;
      observador?.disconnect();
      if (paraImprimir && alImprimir) paraImprimir.removeEventListener('change', alImprimir);
      grafico.current?.dispose();
      grafico.current = null;
    };
  }, [porDefecto]);

  /*
   * Cambios de datos: se aplican sobre el grafico vivo.
   */
  useEffect(() => {
    grafico.current?.setOption(opcionesVigentes.current, true);
  }, [clave]);

  return <div ref={contenedor} className="grafico__lienzo" data-testid="grafico-lienzo" />;
}
