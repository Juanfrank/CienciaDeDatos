import { hexFromArgb } from '@material/material-color-utilities';
import {
  type EsquemaMaterial,
  type ModoDeColor,
  type OrigenDelTema,
  esquemaDe,
  paletasDe,
} from './material3';

/**
 * El resto del sistema de Material Design 3: tipografia, forma, elevacion y capas de estado.
 *
 * El color es la parte de MD3 que mas se nota, pero no es la que mas ordena. Lo que de verdad
 * hace que una interfaz se lea como un sistema son las OTRAS tres escalas, porque eliminan las
 * decisiones sueltas: un radio no es "12 px porque quedaba bien", es `medium`; un texto no es
 * "14 px en gris", es `body-medium` sobre `on-surface-variant`.
 */

/**
 * Escala tipografica de MD3: cinco familias de rol, tres tamanos cada una.
 *
 * `display` para cifras que dominan una pantalla, `headline` para titulos de region, `title`
 * para encabezados de tarjeta y tabla, `body` para prosa, `label` para controles. La regla que
 * evita el desorden es que un rol NO se elige por tamano sino por funcion; si un titulo queda
 * grande, se baja de rol, no se le cambia el tamano.
 */
export interface EstiloTipografico {
  size: string;
  lineHeight: string;
  weight: number;
  tracking: string;
}

export type RolTipografico =
  | 'display-large' | 'display-medium' | 'display-small'
  | 'headline-large' | 'headline-medium' | 'headline-small'
  | 'title-large' | 'title-medium' | 'title-small'
  | 'body-large' | 'body-medium' | 'body-small'
  | 'label-large' | 'label-medium' | 'label-small';

export const TIPOGRAFIA: Record<RolTipografico, EstiloTipografico> = {
  'display-large': { size: '3.5625rem', lineHeight: '4rem', weight: 400, tracking: '-0.015625rem' },
  'display-medium': { size: '2.8125rem', lineHeight: '3.25rem', weight: 400, tracking: '0' },
  'display-small': { size: '2.25rem', lineHeight: '2.75rem', weight: 400, tracking: '0' },

  'headline-large': { size: '2rem', lineHeight: '2.5rem', weight: 400, tracking: '0' },
  'headline-medium': { size: '1.75rem', lineHeight: '2.25rem', weight: 400, tracking: '0' },
  'headline-small': { size: '1.5rem', lineHeight: '2rem', weight: 400, tracking: '0' },

  'title-large': { size: '1.375rem', lineHeight: '1.75rem', weight: 400, tracking: '0' },
  'title-medium': { size: '1rem', lineHeight: '1.5rem', weight: 500, tracking: '0.009375rem' },
  'title-small': { size: '0.875rem', lineHeight: '1.25rem', weight: 500, tracking: '0.00625rem' },

  'body-large': { size: '1rem', lineHeight: '1.5rem', weight: 400, tracking: '0.03125rem' },
  'body-medium': { size: '0.875rem', lineHeight: '1.25rem', weight: 400, tracking: '0.015625rem' },
  'body-small': { size: '0.75rem', lineHeight: '1rem', weight: 400, tracking: '0.025rem' },

  'label-large': { size: '0.875rem', lineHeight: '1.25rem', weight: 500, tracking: '0.00625rem' },
  'label-medium': { size: '0.75rem', lineHeight: '1rem', weight: 500, tracking: '0.03125rem' },
  'label-small': { size: '0.6875rem', lineHeight: '1rem', weight: 500, tracking: '0.03125rem' },
};

/** Escala de forma. `full` es una pastilla; el valor grande deja que el borde lo resuelva. */
export const FORMA = {
  none: '0',
  'extra-small': '4px',
  small: '8px',
  medium: '12px',
  large: '16px',
  'extra-large': '28px',
  full: '9999px',
} as const;

/**
 * Elevacion: seis niveles, cada uno con su sombra.
 *
 * En MD3 la elevacion es sobre todo un TONO de superficie —de ahi los `surfaceContainer`— y la
 * sombra solo acompana. Por eso las sombras de aqui son mas suaves que las de Material 2: si se
 * usan para hacer todo el trabajo, una pantalla con seis tarjetas parece un relieve.
 */
export const ELEVACION = {
  0: 'none',
  1: '0 1px 2px 0 rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15)',
  2: '0 1px 2px 0 rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15)',
  3: '0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px 0 rgba(0,0,0,.30)',
  4: '0 6px 10px 4px rgba(0,0,0,.15), 0 2px 3px 0 rgba(0,0,0,.30)',
  5: '0 8px 12px 6px rgba(0,0,0,.15), 0 4px 4px 0 rgba(0,0,0,.30)',
} as const;

/**
 * Opacidad de las capas de estado.
 *
 * Un control de MD3 no cambia de color al pasar el raton: se le superpone una capa del color de
 * SU contenido con esta opacidad. Por eso un boton relleno y uno de texto reaccionan igual sin
 * declarar dos juegos de colores, y por eso no hace falta un token de "azul un poco mas oscuro".
 */
export const ESTADO = { hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16, disabled: 0.38 } as const;

/** Duraciones y curvas de movimiento. */
export const MOVIMIENTO = {
  'duration-short': '150ms',
  'duration-medium': '250ms',
  'duration-long': '400ms',
  'easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
  'easing-decelerate': 'cubic-bezier(0, 0, 0, 1)',
} as const;

/**
 * Paleta categorica para series de datos, derivada de las paletas tonales.
 *
 * No son colores elegidos aparte: son tonos de las paletas del propio tema, lo que hace que un
 * grafico pertenezca a la misma familia visual que el resto de la aplicacion. Se alternan matices
 * distintos ANTES de repetir familia, para que dos series contiguas nunca sean dos tonos del
 * mismo color — que es como se pierde la distincion al imprimir en gris.
 *
 * Ocho valores: mas alla de ocho categorias un grafico deja de leerse por color, y para eso
 * estan los patrones (`decal`) que ECharts dibuja encima.
 */
/**
 * Tonos de la paleta categorica, por modo.
 *
 * No son arbitrarios: son los tonos que alcanzan 3:1 contra la superficie de su modo, con margen.
 * En claro, el tono 60 da 3.01 —justo en el limite— asi que la banda segura acaba en 55; en
 * oscuro empieza en 55. Salirse de ahi produce una serie que se pierde contra el fondo, y hay
 * una prueba que lo comprueba para las ocho.
 *
 * El orden alterna FAMILIA antes que tono, para que dos series contiguas nunca sean dos tonos
 * del mismo color — que es como se pierde la distincion al imprimir en gris.
 */
const TONOS_CATEGORICOS: Record<ModoDeColor, [keyof ReturnType<typeof paletasDe>, number][]> = {
  claro: [
    ['primary', 40], ['tertiary', 40], ['secondary', 40],
    ['primary', 25], ['tertiary', 25], ['secondary', 25],
    ['primary', 55], ['tertiary', 55],
  ],
  oscuro: [
    ['primary', 80], ['tertiary', 80], ['secondary', 80],
    ['primary', 65], ['tertiary', 65], ['secondary', 65],
    ['primary', 90], ['tertiary', 90],
  ],
};

/**
 * Paleta categorica para series de datos, derivada de las paletas tonales.
 *
 * No son colores elegidos aparte: son tonos de las paletas del propio tema, lo que hace que un
 * grafico pertenezca a la misma familia visual que el resto de la aplicacion.
 *
 * Ocho valores: mas alla de ocho categorias un grafico deja de leerse por color, y para eso
 * estan los patrones (`decal`) que ECharts dibuja encima.
 */
export function categoricaDe(origen: OrigenDelTema, modo: ModoDeColor): string[] {
  const p = paletasDe(origen);
  return TONOS_CATEGORICOS[modo].map(([familia, tono]) => hexFromArgb(p[familia].tone(tono)));
}

export interface TemaMaterial {
  modo: ModoDeColor;
  color: EsquemaMaterial;
  categorical: string[];
  typography: Record<RolTipografico, EstiloTipografico>;
  shape: typeof FORMA;
  elevation: typeof ELEVACION;
  state: typeof ESTADO;
  motion: typeof MOVIMIENTO;
  font: { sans: string; mono: string };
}

export function temaMaterial(
  origen: OrigenDelTema,
  modo: ModoDeColor,
  fuentes: { sans: string; mono: string },
): TemaMaterial {
  return {
    modo,
    color: esquemaDe(origen, modo),
    categorical: categoricaDe(origen, modo),
    typography: TIPOGRAFIA,
    shape: FORMA,
    elevation: ELEVACION,
    state: ESTADO,
    motion: MOVIMIENTO,
    font: fuentes,
  };
}

/**
 * Variables CSS con los nombres de MD3 (`--md-sys-*`).
 *
 * Se conserva el prefijo de la especificacion a proposito: quien conozca Material encuentra lo
 * que busca sin leer este archivo, y quien lea una hoja de estilo sabe que `--md-sys-color-*`
 * viene de un sistema y no de una decision suelta.
 */
export function variablesMaterial(tema: TemaMaterial): Record<string, string> {
  const vars: Record<string, string> = {};
  const guion = (rol: string) => rol.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  for (const [rol, valor] of Object.entries(tema.color)) {
    vars[`--md-sys-color-${guion(rol)}`] = valor;
  }
  tema.categorical.forEach((color, i) => {
    vars[`--md-sys-color-categorical-${i}`] = color;
  });

  for (const [rol, estilo] of Object.entries(tema.typography)) {
    vars[`--md-sys-typescale-${rol}-size`] = estilo.size;
    vars[`--md-sys-typescale-${rol}-line-height`] = estilo.lineHeight;
    vars[`--md-sys-typescale-${rol}-weight`] = String(estilo.weight);
    vars[`--md-sys-typescale-${rol}-tracking`] = estilo.tracking;
    /*
     * Y el rol COMPLETO, valido como abreviatura `font:`.
     *
     * La hoja de estilo lo escribe en trece sitios —`font: var(--md-sys-typescale-title-large)`—
     * y esta variable no existia: `font` con un valor vacio es una declaracion invalida, asi que
     * el navegador la descartaba entera y esos trece rotulos se quedaban con el tamano heredado.
     * No fallaba nada visible, que es por lo que duro: un titulo con el tamano del cuerpo parece
     * una decision de diseno.
     *
     * El orden es el que exige la abreviatura: grosor, tamano/interlineado y familia. El
     * interletrado NO va dentro —no forma parte de `font`— y quien lo necesite sigue teniendo
     * `--md-sys-typescale-<rol>-tracking`.
     */
    vars[`--md-sys-typescale-${rol}`] =
      `${estilo.weight} ${estilo.size}/${estilo.lineHeight} ${tema.font.sans}`;
  }

  for (const [nombre, valor] of Object.entries(tema.shape)) {
    vars[`--md-sys-shape-corner-${nombre}`] = valor;
  }
  for (const [nivel, sombra] of Object.entries(tema.elevation)) {
    vars[`--md-sys-elevation-${nivel}`] = sombra;
  }
  for (const [nombre, valor] of Object.entries(tema.state)) {
    vars[`--md-sys-state-${nombre}-opacity`] = String(valor);
  }
  for (const [nombre, valor] of Object.entries(tema.motion)) {
    vars[`--md-sys-motion-${nombre}`] = valor;
  }

  vars['--md-ref-typeface-plain'] = tema.font.sans;
  vars['--md-ref-typeface-mono'] = tema.font.mono;

  return vars;
}
