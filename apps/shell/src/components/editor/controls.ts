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
  leyenda: 'leyenda',
  datumLabels: 'etiquetas',
  ejes: 'ejes',
  orden: 'orden-por',
  apilado: 'apilado',
  circular: 'circular',
  combinado: 'combinado',
  referencias: 'referencias',
  seriesColors: 'colores',
  tooltip: 'tooltip',
  multiplos: 'multiplos',
  condicional: 'condicional',
  embudo: 'embudo',
  cascada: 'cascada',
  medidor: 'medidor',
};

/** Controles que solo aparecen despues de encender otro. */
export const FIRST_OPENS: Partial<Record<PresentationKey, string>> = {
  highlightColor: 'resaltado',
};
