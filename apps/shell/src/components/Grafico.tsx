'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type {
  CategoricalViewModel,
  PaletaDeGrafico,
  PresentacionDeObjeto,
  TipoDeGrafico,
} from '@app/ui-components';

/**
 * Un grafico: el lienzo de ECharts MAS el respaldo en DOM.
 *
 * El respaldo no es un apano para navegadores viejos: es el camino accesible, y por eso NO
 * desaparece cuando ECharts monta. Un `<canvas>` es un mapa de bits — no hay nada dentro que un
 * lector de pantalla pueda recorrer ni que el tabulador pueda alcanzar—, asi que el filtrado
 * cruzado de 4.4 dejaria de existir para quien navega con teclado. Con el respaldo delante:
 *
 *  - SIN JavaScript se ve el respaldo, con sus barras y sus botones. La pagina sigue sirviendo.
 *  - CON JavaScript se ve el grafico, y el respaldo pasa a estar oculto VISUALMENTE pero sigue
 *    en el documento y sigue siendo alcanzable con el tabulador. Al recibir el foco se muestra,
 *    porque un control invisible que recibe el foco desorienta mas que uno que no existe.
 *
 * ECharts aporta ademas su capa `aria`, que describe el grafico, y los patrones `decal`, que
 * hacen que las series se distingan sin depender del color.
 */

const Lienzo = dynamic(() => import('./Lienzo'), {
  ssr: false,
  // Sin marcador de carga: mientras ECharts llega se ve el respaldo, que ya es el grafico.
  loading: () => null,
});

export function Grafico({
  instanceId,
  tipo,
  vm,
  titulo,
  dimension,
  presentacion,
  formatear,
  onSeleccionar,
  children,
}: {
  /** Identifica ESTE grafico en la pagina. Un modulo lleva varios. */
  instanceId: string;
  tipo: TipoDeGrafico;
  vm: CategoricalViewModel;
  titulo: string;
  dimension?: string;
  /** Leyenda, etiquetas de dato, ejes y orden — lo que el editor configura. */
  presentacion?: PresentacionDeObjeto;
  /** Formatea una cifra de la serie `s` con el formato de SU medida. */
  formatear?: (valor: number, serie: number) => string;
  onSeleccionar?: (categoria: string) => void;
  /** El respaldo: las barras en HTML, con sus botones. */
  children: React.ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  const [paleta, setPaleta] = useState<PaletaDeGrafico | null>(null);

  /*
   * Los colores se leen de las variables CSS del tema, ya resueltas por el navegador.
   *
   * Es lo que hace que el grafico pertenezca al mismo sistema que el resto: no hay una paleta
   * de ECharts que mantener al lado de la de Material Design. El dia que cambie el tema, cambia
   * el grafico, sin tocar esto.
   */
  useEffect(() => {
    /*
     * Se lee de `body`, que es donde el layout inyecta el tema — NO de `documentElement`.
     *
     * Leerlo de la raiz devolvia cadena vacia en las ocho series y en todos los textos, asi que
     * ECharts caia en su paleta por defecto: el grafico salia con los colores de la libreria y
     * nadie lo notaba, porque un grafico con colores plausibles no parece roto.
     */
    const estilo = getComputedStyle(document.body);
    const v = (nombre: string) => estilo.getPropertyValue(nombre).trim();

    setPaleta({
      series: Array.from({ length: 8 }, (_, i) => v(`--md-sys-color-categorical-${i}`)),
      texto: v('--md-sys-color-on-surface'),
      textoAtenuado: v('--md-sys-color-on-surface-variant'),
      linea: v('--md-sys-color-outline-variant'),
      superficie: v('--md-sys-color-surface'),
      superficieElevada: v('--md-sys-color-surface-container-high'),
    });
  }, []);

  const alMontar = useCallback(() => setMontado(true), []);

  return (
    <figure
      className="grafico"
      data-testid={`grafico-${instanceId}`}
      data-montado={montado ? 'si' : 'no'}
    >
      {paleta ? (
        <Lienzo
          tipo={tipo}
          vm={vm}
          paleta={paleta}
          titulo={titulo}
          {...(dimension ? { dimension } : {})}
          {...(presentacion ? { presentacion } : {})}
          {...(formatear ? { formatear } : {})}
          {...(onSeleccionar ? { onSeleccionar } : {})}
          onMontado={alMontar}
        />
      ) : null}

      <div className="grafico__respaldo" data-testid="grafico-respaldo">
        {/*
          Se anuncia para que quien llegue aqui con el tabulador sepa donde esta: desde fuera,
          los botones de las categorias no se ven, y sin este rotulo aparecerian de la nada.
        */}
        {montado ? (
          <p className="grafico__respaldo-titulo">{titulo}: valores y filtrado por categoria</p>
        ) : null}
        {children}
      </div>
    </figure>
  );
}
