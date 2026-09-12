/**
 * Formato de numero — declarado, y por medida.
 *
 * Lo que habia eran tres interruptores sueltos: decimales, unidad y «compacto». Sirve para una
 * tarjeta y se queda corto en cuanto hay mas de una medida en el mismo objeto: una tabla con
 * casos y con dias de resolucion los formateaba igual, porque el formato era del OBJETO y no de
 * la medida. Y no habia forma de pedir un porcentaje, ni un negativo entre parentesis, ni un cero
 * dibujado como raya.
 *
 * Ahora hay cuatro tipos y una cadena personalizada. Los tres primeros cubren el 95 % de los
 * casos sin escribir nada; el cuarto es la valvula de escape, con la sintaxis que quien viene de
 * Power BI o de Excel ya conoce — no una inventada aqui.
 *
 * ---- La sintaxis de la cadena personalizada ----
 *
 * Es el subconjunto NUMERICO de las cadenas de formato personalizadas de Power BI, que a su vez
 * vienen de VBA. Se implementa lo que de verdad se usa para cifras:
 *
 *   `0`   digito o CERO. Si no hay digito en esa posicion, escribe un cero (rellena).
 *   `#`   digito o NADA. Si no hay digito en esa posicion, no escribe nada (no rellena).
 *   `.`   separador decimal. Los `0` y `#` a su derecha fijan cuantos decimales salen.
 *   `,`   entre marcadores de digito, separador de millares.
 *   `%`   multiplica por 100 y escribe el simbolo.
 *   `\\x`  el caracter siguiente, literal, aunque sea reservado.
 *   `"…"` texto literal.
 *   `;`   hasta TRES secciones: positivo ; negativo ; cero.
 *
 * Cualquier otro caracter se escribe tal cual, que es como se ponen «$», «RD$» o « dias».
 *
 * Dos decisiones sobre lo que NO se implementa, y por que:
 *
 * - **Fecha y hora, no.** Este formateador se aplica a MEDIDAS, y una medida es una cifra. Una
 *   dimension de fecha se formatea donde se dibuja la dimension, no aqui.
 * - **Notacion cientifica (`E+0`), no.** No aparece en un informe judicial, y admitirla obliga a
 *   mantener un camino que nadie ejercita — que es como se acumulan los caminos rotos.
 *
 * Una cadena que el formateador no entiende NO rompe el objeto: se avisa al validar y, al
 * dibujar, se cae al formato general. Un numero sin formatear se lee; un objeto en blanco, no.
 */

export const TIPOS_DE_FORMATO = ['general', 'entero', 'decimal', 'personalizado'] as const;
export type TipoDeFormato = (typeof TIPOS_DE_FORMATO)[number];

export interface FormatoDeNumero {
  tipo?: TipoDeFormato;
  /** Cuantos decimales, para los tipos que no son personalizados. */
  decimales?: number;
  /** Separador de millares. Por defecto si. */
  millares?: boolean;
  /** Sufijo corto: «casos», «%», «dias». */
  unidad?: string;
  /** 12.500 pasa a «12,5 mil». Util en una tarjeta, molesto en una tabla. */
  compacto?: boolean;
  /** Solo con `tipo: 'personalizado'`. */
  patron?: string;
}

/**
 * Formato por medida, con un renglon GENERAL que vale para las que no tengan el suyo.
 *
 * El general no es un valor por defecto copiado a cada medida: es una regla que se consulta
 * cuando la medida no dice nada. La diferencia importa — cambiar el general cambia todas las que
 * no se hayan tocado, que es lo que uno espera de «general».
 */
export interface FormatosDelObjeto {
  general?: FormatoDeNumero;
  porMedida?: Record<string, FormatoDeNumero>;
}

export function formatoDeMedida(
  formatos: FormatosDelObjeto | undefined,
  medida: string | undefined,
): FormatoDeNumero {
  if (!formatos) return {};
  const propio = medida ? formatos.porMedida?.[medida] : undefined;
  return propio ?? formatos.general ?? {};
}

/** Una seccion ya analizada: el esqueleto literal y cuanto relleno pide la cifra. */
interface Seccion {
  /** Los literales, con UN solo `#` marcando donde va la cifra entera. */
  patron: string;
  /** Cuantos `0` lleva la parte entera: es el relleno minimo por la izquierda. */
  enterosMin: number;
  decimalesMin: number;
  decimalesMax: number;
  millares: boolean;
  porcentaje: boolean;
}

/*
 * Los separadores se LEEN de la configuracion regional, no se escriben aqui.
 *
 * Escribirlos a mano fue el primer error: puse coma decimal y punto de millares —la convencion de
 * Espana— y `es-DO` usa justo la contraria. Los tipos generales van por `Intl` y el personalizado
 * no, asi que dos numeros del mismo informe salian con separadores distintos segun el formato que
 * llevaran. Preguntandolos, las dos vias coinciden por construccion.
 */
const partesDeEjemplo = new Intl.NumberFormat('es-DO').formatToParts(1234.5);
const SEP_MILLARES = partesDeEjemplo.find((x) => x.type === 'group')?.value ?? ',';
const SEP_DECIMAL = partesDeEjemplo.find((x) => x.type === 'decimal')?.value ?? '.';

const RESERVADOS = new Set(['0', '#', '.', ',', '%', '\\', '"', ';']);

/**
 * Analiza UNA seccion del patron.
 *
 * Devuelve el esqueleto con los literales en su sitio, y aparte cuantos decimales exige. El
 * analisis se hace una vez por formateador y no por numero: un informe puede dibujar miles de
 * celdas con el mismo formato.
 */
function analizar(texto: string): Seccion {
  const seccion: Seccion = {
    patron: '',
    enterosMin: 0,
    decimalesMin: 0,
    decimalesMax: 0,
    millares: false,
    porcentaje: false,
  };
  let enDecimales = false;
  let cifraPuesta = false;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i] ?? '';
    if (c === '\\') {
      // El siguiente va literal aunque sea reservado. Es como se escribe un «%» que no multiplica.
      const siguiente = texto[i + 1];
      if (siguiente !== undefined) {
        seccion.patron += siguiente;
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      const fin = texto.indexOf('"', i + 1);
      seccion.patron += fin === -1 ? texto.slice(i + 1) : texto.slice(i + 1, fin);
      i = fin === -1 ? texto.length : fin;
      continue;
    }
    if (c === '.') {
      enDecimales = true;
      continue;
    }
    if (c === '%') {
      seccion.porcentaje = true;
      seccion.patron += '%';
      continue;
    }
    if (c === ',') {
      // Solo cuenta como separador de millares entre marcadores de digito. Suelto, es un literal.
      const antes = texto[i - 1];
      const despues = texto[i + 1];
      if ((antes === '0' || antes === '#') && (despues === '0' || despues === '#')) {
        seccion.millares = true;
      } else {
        seccion.patron += ',';
      }
      continue;
    }
    if (c === '0' || c === '#') {
      if (enDecimales) {
        seccion.decimalesMax += 1;
        if (c === '0') seccion.decimalesMin = seccion.decimalesMax;
      } else {
        if (c === '0') seccion.enterosMin += 1;
        // UN solo marcador para toda la cifra. Uno por digito dejaba `####` en el esqueleto y
        // `aplicar` solo sustituia el primero: `0000` sobre 42 salia «42###».
        if (!cifraPuesta) {
          seccion.patron += '\u0000';
          cifraPuesta = true;
        }
      }
      continue;
    }
    if (!RESERVADOS.has(c)) seccion.patron += c;
  }

  return seccion;
}

/** Divide por `;` respetando lo escapado y lo entrecomillado. */
function secciones(patron: string): string[] {
  const partes: string[] = [];
  let actual = '';
  let enComillas = false;
  for (let i = 0; i < patron.length; i += 1) {
    const c = patron[i] ?? '';
    if (c === '\\') {
      actual += c + (patron[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (c === '"') enComillas = !enComillas;
    if (c === ';' && !enComillas) {
      partes.push(actual);
      actual = '';
      continue;
    }
    actual += c;
  }
  partes.push(actual);
  return partes;
}

const agrupar = (entero: string): string =>
  entero.replace(/\B(?=(\d{3})+(?!\d))/g, SEP_MILLARES);

/**
 * Aplica una seccion analizada a un numero ya en positivo.
 *
 * El separador decimal es la coma y el de millares el punto, que es la convencion de `es-DO`. No
 * se usa `Intl` aqui porque el patron ya dice exactamente cuantos decimales salen, y mezclar las
 * dos reglas produce redondeos que no coinciden con lo que la cadena pide.
 */
function aplicar(seccion: Seccion, valor: number): string {
  const n = seccion.porcentaje ? valor * 100 : valor;
  const fijado = n.toFixed(seccion.decimalesMax);
  const [crudo = '0', decimalesCrudos = ''] = fijado.split('.');

  // `0000` sobre 42 da «0042»: los ceros del patron rellenan por la izquierda.
  const enteroCrudo = crudo.padStart(seccion.enterosMin, '0');
  const entero = seccion.millares ? agrupar(enteroCrudo) : enteroCrudo;

  // Los decimales de mas alla del minimo se quitan si son ceros: es lo que distingue `#` de `0`.
  let decimales = decimalesCrudos;
  while (decimales.length > seccion.decimalesMin && decimales.endsWith('0')) {
    decimales = decimales.slice(0, -1);
  }

  const cifra = decimales.length > 0 ? `${entero}${SEP_DECIMAL}${decimales}` : entero;
  /*
   * Una seccion SIN marcador de digito es puro literal, y ahi no va ninguna cifra.
   *
   * Es lo que permite `#,##0;(#,##0);—`: el cero se dibuja como una raya y no como «0—». Es
   * tambien como se lee un informe contable — un cero real y un hueco tienen que distinguirse, y
   * ahi el cero es el que se marca.
   */
  if (!seccion.patron.includes('\u0000')) {
    return seccion.decimalesMax === 0 && seccion.enterosMin === 0
      ? seccion.patron
      : cifra + seccion.patron;
  }
  return seccion.patron.replace('\u0000', cifra);
}

export class PatronInvalidoError extends Error {
  constructor(readonly patron: string, readonly motivo: string) {
    super(`El patron '${patron}' no se puede usar: ${motivo}`);
    this.name = 'PatronInvalidoError';
  }
}

/** Por que un patron no vale. `null` si vale. */
export function problemaDelPatron(patron: string): string | null {
  if (!patron.trim()) return 'esta vacio.';
  if (secciones(patron).length > 3) {
    return 'tiene mas de tres secciones. Son, como mucho: positivo ; negativo ; cero.';
  }
  const sinMarcador = secciones(patron).every((s) => {
    const a = analizar(s);
    return !a.patron.includes('\u0000') && a.decimalesMax === 0;
  });
  if (sinMarcador) {
    return "no tiene ningun marcador de digito. Use '0' o '#' donde deba salir la cifra.";
  }
  return null;
}

/**
 * El formateador. Devuelve una funcion, no un texto: se analiza el patron UNA vez y se aplica a
 * cada celda, que en una tabla larga son miles.
 *
 * `null` es «no hay respuesta» y se dibuja como raya, nunca como cero.
 */
export function formateadorDeNumero(formato: FormatoDeNumero | undefined): (n: number | null) => string {
  const tipo = formato?.tipo ?? 'general';

  if (tipo === 'personalizado' && formato?.patron && !problemaDelPatron(formato.patron)) {
    const [positivo, negativo, cero] = secciones(formato.patron).map(analizar);
    // `secciones` siempre devuelve al menos una, pero el tipo no lo sabe: sin la guarda, el
    // formateador dependeria de un `!` que nadie vuelve a comprobar.
    if (positivo) {
      return (n) => {
        if (n === null) return '—';
        if (n === 0 && cero) return aplicar(cero, 0);
        if (n < 0 && negativo) return aplicar(negativo, Math.abs(n));
        if (n < 0) return `-${aplicar(positivo, Math.abs(n))}`;
        return aplicar(positivo, n);
      };
    }
  }

  /*
   * General, entero y decimal van por `Intl`, que resuelve la convencion local sin que nadie
   * tenga que escribirla. `general` no fija decimales: ensena los que el numero traiga, hasta
   * tres — es lo que se espera de «general», y lo que evita que un 0,5 salga como 1.
   */
  const decimales = tipo === 'entero' ? 0 : (formato?.decimales ?? (tipo === 'decimal' ? 2 : undefined));
  const compacto = formato?.compacto === true;
  const intl = new Intl.NumberFormat('es-DO', {
    ...(decimales === undefined
      ? { maximumFractionDigits: compacto ? 1 : 3 }
      : { minimumFractionDigits: decimales, maximumFractionDigits: decimales }),
    useGrouping: formato?.millares !== false,
    ...(compacto ? { notation: 'compact' as const, compactDisplay: 'short' as const } : {}),
  });
  const unidad = formato?.unidad ? ` ${formato.unidad}` : '';
  return (n) => (n === null ? '—' : `${intl.format(n)}${unidad}`);
}
