'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type {
  CategoricalViewModel,
  ChartPalette,
  ObjectPresentation,
  ChartKind,
} from '@app/ui-components';

/** Un grafico: el lienzo de ECharts MAS el respaldo en DOM. */

const Canvas = dynamic(() => import('./Canvas'), {
  ssr: false,
  // Sin marcador de carga: mientras ECharts llega se ve el respaldo, que ya es el grafico.
  loading: () => null,
});

export function Chart({
  instanceId,
  tipo,
  vm,
  titulo,
  dimension,
  presentation,
  formatear,
  columnSeries,
  onSeleccionar,
  children,
}: {
  /** Identifica ESTE grafico en la pagina. Un modulo lleva varios. */
  instanceId: string;
  tipo: ChartKind;
  vm: CategoricalViewModel;
  titulo: string;
  dimension?: string;
  /** Leyenda, etiquetas de dato, ejes y orden — lo que el editor configura. */
  presentation?: ObjectPresentation;
  /** Formatea una cifra de la serie `s` con el formato de SU medida. */
  formatear?: (valor: number, serie: number) => string;
  /** Solo el combinado: cuantas series iniciales son columnas. */
  columnSeries?: number;
  onSeleccionar?: (categoria: string) => void;
  /** El respaldo: las barras en HTML, con sus botones. */
  children: React.ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  const [palette, setPaleta] = useState<ChartPalette | null>(null);

  /*
   * Los colores se leen de las variables CSS del tema, ya resueltas por el navegador.
   */
  useEffect(() => {
    /*
     * Se lee de `body`, que es donde el layout inyecta el tema — NO de `documentElement`.
     */
    const style = getComputedStyle(document.body);
    const v = (nombre: string) => style.getPropertyValue(nombre).trim();

    setPaleta({
      series: Array.from({ length: 8 }, (_, i) => v(`--md-sys-color-categorical-${i}`)),
      content: v('--md-sys-color-on-surface'),
      mutedText: v('--md-sys-color-on-surface-variant'),
      line: v('--md-sys-color-outline-variant'),
      superficie: v('--md-sys-color-surface'),
      superficieElevada: v('--md-sys-color-surface-container-high'),
    });
  }, []);

  const alMontar = useCallback(() => setMontado(true), []);

  return (
    <figure
      className="grafico"
      data-testid={`chart-${instanceId}`}
      data-montado={montado ? 'si' : 'no'}
    >
      {palette ? (
        <Canvas
          tipo={tipo}
          vm={vm}
          palette={palette}
          titulo={titulo}
          {...(dimension ? { dimension } : {})}
          {...(presentation ? { presentation } : {})}
          {...(formatear ? { formatear } : {})}
          {...(columnSeries === undefined ? {} : { columnSeries })}
          {...(onSeleccionar ? { onSeleccionar } : {})}
          onMontado={alMontar}
        />
      ) : null}

      <div className="chart__fallback" data-testid="fallback-chart">
        {/*
          Se anuncia para que quien llegue aqui con el tabulador sepa donde esta: desde fuera,
          los botones de las categorias no se ven, y sin este rotulo aparecerian de la nada.
        */}
        {montado ? (
          <p className="chart__title-fallback">{titulo}: valores y filtrado por categoria</p>
        ) : null}
        {children}
      </div>
    </figure>
  );
}
