import type { PresentationKey } from '@app/ui-components';

/** Que testid identifica el control de cada clave. */
export const KEY_CONTROL: Record<PresentationKey, string> = {
  icono: 'icono',
  acento: 'acento',
  highlight: 'resaltado',
  highlightColor: 'color-resaltado',
  showTitle: 'mostrar-titulo',
  showIcon: 'mostrar-icono',
  subtitulo: 'subtitulo',
  etiqueta: 'etiqueta',
  textos: 'texto-titulo',
  formato: 'formato-general',
  formatos: 'medida',
  legend: 'leyenda',
  datumLabels: 'etiquetas',
  // El identificador de prueba NO se renombra con la clave: es otro contrato, el que tienen las
  // pruebas de navegador con el marcado, y moverlo aqui sin moverlo alli deja la seccion de los
  // ejes sin control que encontrar. La clave es `axes`; la seccion sigue siendo `…-ejes`.
  axes: 'ejes',
  orden: 'orden-por',
  apilado: 'apilado',
  circular: 'circular',
  combinado: 'combinado',
  references: 'referencias',
  seriesColors: 'colores',
  tooltip: 'tooltip',
  multiples: 'multiplos',
  conditional: 'condicional',
  embudo: 'embudo',
  cascada: 'cascada',
  medidor: 'medidor',
  histogram: 'histograma',
  boxplot: 'caja',
  heatmap: 'calor',
};

/** Controles que solo aparecen despues de encender otro. */
export const FIRST_OPENS: Partial<Record<PresentationKey, string>> = {
  highlightColor: 'resaltado',
};
