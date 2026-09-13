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

/**
 * Monta un grafico de Apache ECharts sobre un contenedor.
 *
 * Este modulo es el UNICO que importa ECharts, y se carga de forma diferida: quien abre un
 * modulo sin graficos —una tabla, un KPI— no descarga la libreria. Es lo que pide el pliego al
 * hablar de carga diferida, y aqui se nota, porque ECharts pesa mas que el resto de la
 * aplicacion junta.
 *
 * RENDERIZADOR. Canvas por defecto, como pide el pliego: aguanta volumen e interaccion sin
 * degradarse. SVG en dos casos concretos, no por gusto:
 *
 *  1. AL IMPRIMIR. Un canvas impreso es un mapa de bits a la resolucion de la pantalla, o sea
 *     borroso; un SVG sale nitido a cualquier tamano.
 *  2. CON POCOS ELEMENTOS. Por debajo del umbral un SVG no cuesta nada y trae ventajas —se
 *     inspecciona, se selecciona—, asi que rasterizar no aporta.
 *
 * ACCESIBILIDAD. `aria.enabled` hace que ECharts describa el grafico en el contenedor y
 * `aria.decal.show` dibuja un patron distinto sobre cada serie, para que el color no sea el
 * unico medio de transmitir la informacion (WCAG 1.4.1). Lo que NO resuelve ECharts es la
 * interaccion por teclado: de eso se ocupa el respaldo en DOM que envuelve a este componente.
 */

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
   *
   * Es lo que permite que el grafico se cree UNA vez. Ponerlos en las dependencias obligaria a
   * rehacerlo en cada render —el padre los redefine cada vez— y eso no solo cuesta: entre que
   * se destruye y se vuelve a crear, el manejador de clic desaparece y el filtrado cruzado deja
   * de responder sin que nada falle de forma visible.
   */
  const seleccionar = useRef(onSeleccionar);
  seleccionar.current = onSeleccionar;
  const montado = useRef(onMontado);
  montado.current = onMontado;

  /*
   * Las opciones se comparan por CONTENIDO, no por identidad.
   *
   * `vm` es un objeto nuevo en cada render del padre, asi que depender de su identidad equivale
   * a no memorizar nada. Serializar es barato al lado de reconstruir el grafico.
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
   *
   * Antes se montaba con `JSON.parse(clave)`, y eso borraba en silencio todos los `formatter`
   * —que son funciones y `JSON.stringify` los omite—. La consecuencia no se veia como un fallo:
   * el grafico salia entero y con datos correctos, solo que la cifra sobre cada barra aparecia
   * en crudo —«2216»— mientras la tabla de datos adjunta decia «2,216», y el tooltip del 100 %
   * nunca enseno la cifra original. Las pruebas unitarias no podian encontrarlo porque llaman al
   * constructor de opciones directamente, donde la funcion si esta.
   *
   * La cadena sigue existiendo, pero solo como CLAVE para saber si algo cambio: comparar por
   * contenido es lo que evita rehacer el grafico en cada render del padre.
   */
  const opcionesVigentes = useRef(opciones);
  opcionesVigentes.current = opciones;

  // Creacion y destruccion: una sola vez mientras el tipo de renderizador no cambie.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    let cancelado = false;
    let observador: ResizeObserver | null = null;
    let paraImprimir: MediaQueryList | null = null;
    let alImprimir: ((e: MediaQueryListEvent) => void) | null = null;

    void (async () => {
      const echarts = await import('echarts');
      if (cancelado) return;

      const montar = (renderer: 'canvas' | 'svg') => {
        grafico.current?.dispose();
        const instancia = echarts.init(nodo, null, { renderer });
        instancia.setOption(opcionesVigentes.current);
        instancia.on('click', (evento: { name?: string }) => {
          if (evento.name) seleccionar.current?.(evento.name);
        });
        grafico.current = instancia;
      };

      montar(porDefecto);
      montado.current?.();

      observador = new ResizeObserver(() => grafico.current?.resize());
      observador.observe(nodo);

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
   *
   * Depende de `clave` —la comparacion por contenido— y lee `opcionesVigentes`, que es el objeto
   * con sus funciones intactas. Depender del objeto seria no memorizar nada, y pasar la cadena
   * volveria a perder los formateadores.
   */
  useEffect(() => {
    grafico.current?.setOption(opcionesVigentes.current, true);
  }, [clave]);

  return <div ref={contenedor} className="grafico__lienzo" data-testid="grafico-lienzo" />;
}
