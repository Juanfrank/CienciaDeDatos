import type { ClaveDePresentacion } from '@app/ui-components';

/**
 * Que testid identifica el control de cada clave.
 *
 * Vive aparte del panel y de las pruebas porque la comparten DOS: la unitaria comprueba que el
 * identificador existe de verdad en `Presentacion.tsx`, y la de navegador lo usa para abrir el
 * control. Con una sola tabla las dos hablan del mismo sitio, y una clave nueva sin control falla
 * en la unitaria antes de llegar al navegador.
 */
export const CONTROL_DE_CLAVE: Record<ClaveDePresentacion, string> = {
  icono: 'icono',
  acento: 'acento',
  resaltado: 'resaltado',
  colorDeResaltado: 'color-resaltado',
  mostrarTitulo: 'mostrar-titulo',
  mostrarIcono: 'mostrar-icono',
  subtitulo: 'subtitulo',
  etiqueta: 'etiqueta',
  textos: 'texto-titulo',
  formato: 'formato-general',
  formatos: 'medida',
  leyenda: 'leyenda',
  etiquetasDeDato: 'etiquetas',
  ejes: 'ejes',
  orden: 'orden-por',
  apilado: 'apilado',
  circular: 'circular',
  combinado: 'combinado',
  referencias: 'referencias',
  coloresDeSerie: 'colores',
  tooltip: 'tooltip',
  multiplos: 'multiplos',
  condicional: 'condicional',
  embudo: 'embudo',
  cascada: 'cascada',
  medidor: 'medidor',
};

/**
 * Controles que solo aparecen despues de encender otro.
 *
 * No es un descuido: el color del resaltado no significa nada mientras no haya resaltado, y
 * dibujarlo apagado al lado de su interruptor es un control que pide una decision que todavia no
 * toca. Lo que si seria un fallo es que no hubiera forma de llegar a el, y por eso la dependencia
 * se declara aqui: la prueba enciende el interruptor y comprueba que el control sale.
 *
 * El valor es el testid del interruptor, sin el prefijo de la instancia.
 */
export const ABRE_PRIMERO: Partial<Record<ClaveDePresentacion, string>> = {
  colorDeResaltado: 'resaltado',
};
