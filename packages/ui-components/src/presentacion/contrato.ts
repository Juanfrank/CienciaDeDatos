import { esNombreDeIcono, type NombreDeIcono } from './iconos';

/**
 * El minimo de personalizacion que TODO objeto visual admite — seccion 4.2 y 4.3.
 *
 * El problema que resuelve: cada objeto habia crecido con las opciones que su autor necesito el
 * dia que lo escribio. La tarjeta KPI no podia llevar icono, las barras no podian ocultar la
 * leyenda, y nada tenia subtitulo. Desde el editor no se podia cambiar nada de eso, asi que
 * pedir «la misma tarjeta pero en rojo y con otro rotulo» significaba tocar codigo.
 *
 * La solucion NO es una bolsa de opciones libre. Una bolsa libre reintroduce lo que 4.3 cierra:
 * el color deja de salir de los roles del tema y la puerta de contraste ya no garantiza nada
 * sobre lo que se ve. Aqui se declara un conjunto CERRADO de claves, y cada una toma valores de
 * un conjunto cerrado tambien: el acento es un ROL del tema, no un color; el icono es un nombre
 * del catalogo, no una ruta SVG que alguien pegue.
 *
 * Lo que hace que esto sea un estandar y no una sugerencia esta en `catalog.spec.ts`: hay una
 * prueba que recorre TODAS las versiones de TODOS los objetos del catalogo y falla si alguna no
 * admite las cuatro claves basicas. Un objeto nuevo no se puede publicar sin ellas.
 */

/**
 * El acento es un ROL, no un color.
 *
 * `'rojo'` obligaria a elegir un rojo, y el elegido no tendria por que contrastar con la
 * superficie donde acabe ni seguir al tema oscuro. `'terciario'` lo resuelve el tema, que ya
 * tiene un par de contraste comprobado para cada rol.
 */
export const ACENTOS = ['primario', 'secundario', 'terciario', 'neutro'] as const;
export type AcentoDeObjeto = (typeof ACENTOS)[number];

export const MODOS_DE_LEYENDA = ['auto', 'siempre', 'nunca'] as const;
export type ModoDeLeyenda = (typeof MODOS_DE_LEYENDA)[number];

export interface FormatoNumerico {
  /** 0 a 4. Mas alla, la cifra deja de leerse y empieza a ser ruido de precision. */
  decimales?: number;
  /** Sufijo corto: «casos», «%», «dias». Ocho caracteres es una unidad; mas es una frase. */
  unidad?: string;
  /** 12.500 pasa a «12,5 mil». Util en una tarjeta, molesto en una tabla. */
  compacto?: boolean;
}

/**
 * ---- Texto: peso, estilo, alineacion y color ----
 *
 * El color es un ROL del tema, igual que el acento y por el mismo motivo. Es tentador ofrecer un
 * selector de color libre —es lo que pide cualquiera— y es justo lo que romperia 4.3: un color
 * elegido a mano no tiene par de contraste comprobado contra la superficie donde acabe, no sigue
 * al tema oscuro, y la puerta de contraste deja de garantizar nada sobre lo que se ve. Con roles
 * hay paleta de verdad —seis opciones con su muestra— y la garantia se conserva.
 *
 * `atenuado` no es «gris claro»: es `on-surface-variant`, que es el rol para el texto secundario y
 * viene con su propio par comprobado. La diferencia importa cuando alguien cambia el tema.
 */
export const COLORES_DE_TEXTO = [
  'predeterminado',
  'primario',
  'secundario',
  'terciario',
  'error',
  'atenuado',
] as const;
export type ColorDeTexto = (typeof COLORES_DE_TEXTO)[number];

export const ALINEACIONES = ['izquierda', 'centro', 'derecha'] as const;
export type Alineacion = (typeof ALINEACIONES)[number];

/** Solo donde hay alto que repartir: una celda de tabla o el cuerpo de una tarjeta. */
export const ALINEACIONES_VERTICALES = ['arriba', 'medio', 'abajo'] as const;
export type AlineacionVertical = (typeof ALINEACIONES_VERTICALES)[number];

export interface EstiloDeTexto {
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
  alineacion?: Alineacion;
  alineacionVertical?: AlineacionVertical;
  color?: ColorDeTexto;
}

/**
 * A QUE textos se les puede poner estilo. Conjunto cerrado, como todo lo demas.
 *
 * Abierto —«cualquier texto del objeto»— obligaria a cada objeto a inventarse sus propias claves,
 * y dos objetos acabarian llamando de forma distinta a lo mismo. Con tres destinos fijos, lo que
 * se configura en una tarjeta significa lo mismo en un grafico.
 */
export const DESTINOS_DE_TEXTO = ['titulo', 'subtitulo', 'cifra'] as const;
export type DestinoDeTexto = (typeof DESTINOS_DE_TEXTO)[number];

export type TextosDeObjeto = Partial<Record<DestinoDeTexto, EstiloDeTexto>>;

/** Variable CSS del rol, o nada para el color que ya tuviera el texto. */
const VARIABLE_DE_COLOR: Record<ColorDeTexto, string | null> = {
  predeterminado: null,
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

const ALINEACION_CSS: Record<Alineacion, string> = {
  izquierda: 'left',
  centro: 'center',
  derecha: 'right',
};

const VERTICAL_CSS: Record<AlineacionVertical, string> = {
  arriba: 'flex-start',
  medio: 'center',
  abajo: 'flex-end',
};

/**
 * El METODO COMUN: un estilo de texto a propiedades CSS.
 *
 * Una sola funcion para todos los objetos. Con cada uno traduciendo por su cuenta, «negrita» en
 * una tarjeta y «negrita» en una tabla acabarian siendo pesos distintos, que es exactamente el
 * tipo de deriva que el estandar minimo de personalizacion vino a cerrar.
 *
 * Devuelve un objeto de estilo y no clases porque las combinaciones son 2x2x2x3x3x6: como clases
 * serian cientos de reglas muertas para las que nadie usa.
 */
export function estiloDeTexto(estilo: EstiloDeTexto | undefined): Record<string, string> {
  if (!estilo) return {};
  const css: Record<string, string> = {};
  if (estilo.negrita) css['fontWeight'] = '700';
  if (estilo.cursiva) css['fontStyle'] = 'italic';
  if (estilo.subrayado) css['textDecoration'] = 'underline';
  if (estilo.alineacion) css['textAlign'] = ALINEACION_CSS[estilo.alineacion];
  if (estilo.alineacionVertical) css['justifyContent'] = VERTICAL_CSS[estilo.alineacionVertical];
  const color = estilo.color ? VARIABLE_DE_COLOR[estilo.color] : null;
  if (color) css['color'] = color;
  return css;
}

export interface PresentacionDeObjeto {
  /** Icono del catalogo, en la cabecera. Sin el, el objeto usa el de su tipo. */
  icono?: NombreDeIcono;
  /** Rol del tema que tine el icono y la linea de resaltado. */
  acento?: AcentoDeObjeto;
  /** Linea de color en el borde superior de la tarjeta. */
  resaltado?: boolean;
  /** Una linea bajo el titulo. Para la unidad, el periodo o la salvedad. */
  subtitulo?: string;
  formato?: FormatoNumerico;
  leyenda?: ModoDeLeyenda;
  /** La cifra encima de cada barra o punto. */
  etiquetasDeDato?: boolean;
  /** Peso, estilo, alineacion y color de los textos del objeto. */
  textos?: TextosDeObjeto;
}

export type ClaveDePresentacion = keyof PresentacionDeObjeto;

/**
 * Las cinco que no son negociables.
 *
 * Son las que no dependen de lo que el objeto dibuje: cualquier cosa que ocupe una celda tiene
 * cabecera, y por tanto puede llevar icono, acento, resaltado, subtitulo y estilo de texto.
 * `formato`, `leyenda` y `etiquetasDeDato` sí dependen —una tabla no tiene leyenda— y por eso
 * cada objeto declara si las admite.
 *
 * `textos` entra en el minimo, no en lo opcional: si cada objeto decidiera por su cuenta si deja
 * poner su titulo en negrita, la personalizacion volveria a depender de lo que el autor de cada
 * uno tuvo en mente el dia que lo escribio — que es exactamente lo que este estandar cerro.
 */
export const PRESENTACION_MINIMA: ClaveDePresentacion[] = [
  'icono',
  'acento',
  'resaltado',
  'subtitulo',
  'textos',
];

export interface ProblemaDePresentacion {
  clave: string;
  problema: string;
}

export const MAX_SUBTITULO = 80;
export const MAX_UNIDAD = 8;
export const MAX_DECIMALES = 4;

/**
 * Valida una presentacion contra lo que el objeto declara admitir.
 *
 * Devuelve diagnosticos en vez de lanzar, como todo lo demas de 4.2: el editor tiene que poder
 * dibujar el objeto con su problema senalado, no quedarse en blanco.
 */
export function validarPresentacion(
  presentacion: PresentacionDeObjeto | undefined,
  admitidas: ClaveDePresentacion[],
): ProblemaDePresentacion[] {
  if (!presentacion) return [];
  const problemas: ProblemaDePresentacion[] = [];
  const admite = new Set<string>(admitidas);

  for (const clave of Object.keys(presentacion)) {
    if (!admite.has(clave)) {
      problemas.push({
        clave,
        problema: `Este objeto no admite '${clave}'. Admite: ${admitidas.join(', ')}.`,
      });
    }
  }

  if (presentacion.icono !== undefined && !esNombreDeIcono(presentacion.icono)) {
    problemas.push({
      clave: 'icono',
      problema: `'${String(presentacion.icono)}' no es un icono del catalogo.`,
    });
  }

  if (
    presentacion.acento !== undefined &&
    !(ACENTOS as readonly string[]).includes(presentacion.acento)
  ) {
    problemas.push({
      clave: 'acento',
      problema: `'${String(presentacion.acento)}' no es un acento. Use: ${ACENTOS.join(', ')}.`,
    });
  }

  /*
   * Los estilos de texto, destino a destino.
   *
   * Se valida el vocabulario, no la combinacion: negrita y cursiva a la vez es feo y es una
   * decision de quien edita, no un error de configuracion. Lo que si es un error es un color que
   * no es un rol del tema, porque eso si rompe una garantia.
   */
  for (const [destino, estilo] of Object.entries(presentacion.textos ?? {})) {
    if (!(DESTINOS_DE_TEXTO as readonly string[]).includes(destino)) {
      problemas.push({
        clave: `textos.${destino}`,
        problema: `'${destino}' no es un texto configurable. Use: ${DESTINOS_DE_TEXTO.join(', ')}.`,
      });
      continue;
    }
    if (estilo.color !== undefined && !(COLORES_DE_TEXTO as readonly string[]).includes(estilo.color)) {
      problemas.push({
        clave: `textos.${destino}.color`,
        problema:
          `'${String(estilo.color)}' no es un color del tema. Use: ${COLORES_DE_TEXTO.join(', ')}. ` +
          `Un color suelto no tiene par de contraste comprobado y no sigue al tema oscuro (4.3).`,
      });
    }
    if (estilo.alineacion !== undefined && !(ALINEACIONES as readonly string[]).includes(estilo.alineacion)) {
      problemas.push({
        clave: `textos.${destino}.alineacion`,
        problema: `'${String(estilo.alineacion)}' no es una alineacion. Use: ${ALINEACIONES.join(', ')}.`,
      });
    }
    if (
      estilo.alineacionVertical !== undefined &&
      !(ALINEACIONES_VERTICALES as readonly string[]).includes(estilo.alineacionVertical)
    ) {
      problemas.push({
        clave: `textos.${destino}.alineacionVertical`,
        problema:
          `'${String(estilo.alineacionVertical)}' no es una alineacion vertical. ` +
          `Use: ${ALINEACIONES_VERTICALES.join(', ')}.`,
      });
    }
  }

  if (presentacion.subtitulo !== undefined && presentacion.subtitulo.length > MAX_SUBTITULO) {
    problemas.push({
      clave: 'subtitulo',
      problema: `El subtitulo pasa de ${MAX_SUBTITULO} caracteres. Es una linea, no un parrafo.`,
    });
  }

  if (
    presentacion.leyenda !== undefined &&
    !(MODOS_DE_LEYENDA as readonly string[]).includes(presentacion.leyenda)
  ) {
    problemas.push({
      clave: 'leyenda',
      problema: `'${String(presentacion.leyenda)}' no es un modo. Use: ${MODOS_DE_LEYENDA.join(', ')}.`,
    });
  }

  const { decimales, unidad } = presentacion.formato ?? {};
  if (decimales !== undefined && (!Number.isInteger(decimales) || decimales < 0 || decimales > MAX_DECIMALES)) {
    problemas.push({
      clave: 'formato.decimales',
      problema: `Los decimales van de 0 a ${MAX_DECIMALES}.`,
    });
  }
  if (unidad !== undefined && unidad.length > MAX_UNIDAD) {
    problemas.push({
      clave: 'formato.unidad',
      problema: `La unidad pasa de ${MAX_UNIDAD} caracteres. Es un sufijo, no una explicacion.`,
    });
  }

  return problemas;
}

/**
 * El formateador que sale de una presentacion.
 *
 * Existe para que la cifra salga IGUAL en los cuatro sitios donde aparece —la tarjeta, la
 * etiqueta del grafico, la tabla y el archivo exportado—. Cada uno tenia su propia llamada a
 * `Intl.NumberFormat` con sus propias opciones, asi que cambiar el formato en un sitio dejaba los
 * otros tres como estaban.
 */
/**
 * @returns un formateador que acepta `null` y lo dibuja como raya.
 *
 * `null` no es cero: es «no hay respuesta», que es lo que devuelve una medida ya calculada por la
 * fuente cuando el objeto la colapsa. Formatearla como 0 volveria a poner en pantalla un numero
 * que nadie calculo. La raya es el mismo signo que la matriz usa para una celda sin filas.
 */
export function formateadorDe(formato: FormatoNumerico | undefined): (n: number | null) => string {
  /*
   * En compacto, un decimal por defecto.
   *
   * Con la regla general —cero decimales salvo que se pidan— 12.500 salia como «13 k»: la
   * notacion compacta redondea sobre la cifra YA reducida, asi que cero decimales se come el
   * 40 % del rango entre un escalon y el siguiente. «12,5 k» es lo que hace util el compacto, y
   * es lo que se lee en cualquier tablero. Si alguien pide decimales explicitos, manda lo pedido.
   */
  const compacto = formato?.compacto === true;
  const decimales = formato?.decimales ?? (compacto ? 1 : 0);
  const intl = new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: compacto && formato?.decimales === undefined ? 0 : decimales,
    maximumFractionDigits: decimales,
    ...(compacto ? { notation: 'compact' as const, compactDisplay: 'short' as const } : {}),
  });
  const unidad = formato?.unidad ? ` ${formato.unidad}` : '';
  return (n: number | null) => (n === null ? '—' : `${intl.format(n)}${unidad}`);
}
