/** Formato de numero — declarado, y por medida. */

export const TIPOS_DE_FORMATO = [
  'general',
  'entero',
  'decimal',
  'porcentaje',
  'moneda',
  'personalizado',
] as const;
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
  /** Simbolo de la moneda. Solo con `tipo: 'moneda'`. */
  simbolo?: string;
}

/** Formato por medida, con un renglon GENERAL que vale para las que no tengan el suyo. */
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
 */
const partesDeEjemplo = new Intl.NumberFormat('es-DO').formatToParts(1234.5);
const SEP_MILLARES = partesDeEjemplo.find((x) => x.type === 'group')?.value ?? ',';
const SEP_DECIMAL = partesDeEjemplo.find((x) => x.type === 'decimal')?.value ?? '.';

const RESERVADOS = new Set(['0', '#', '.', ',', '%', '\\', '"', ';']);

/** Analiza UNA seccion del patron. */
function analizar(content: string): Seccion {
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

  for (let i = 0; i < content.length; i += 1) {
    const c = content[i] ?? '';
    if (c === '\\') {
      // El siguiente va literal aunque sea reservado. Es como se escribe un «%» que no multiplica.
      const siguiente = content[i + 1];
      if (siguiente !== undefined) {
        seccion.patron += siguiente;
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      const fin = content.indexOf('"', i + 1);
      seccion.patron += fin === -1 ? content.slice(i + 1) : content.slice(i + 1, fin);
      i = fin === -1 ? content.length : fin;
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
      const before = content[i - 1];
      const after = content[i + 1];
      if ((before === '0' || before === '#') && (after === '0' || after === '#')) {
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

/** Aplica una seccion analizada a un numero ya en positivo. */
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

  const figure = decimales.length > 0 ? `${entero}${SEP_DECIMAL}${decimales}` : entero;
  /*
   * Una seccion SIN marcador de digito es puro literal, y ahi no va ninguna cifra.
   */
  if (!seccion.patron.includes('\u0000')) {
    return seccion.decimalesMax === 0 && seccion.enterosMin === 0
      ? seccion.patron
      : figure + seccion.patron;
  }
  return seccion.patron.replace('\u0000', figure);
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
   * Los tipos sin cadena van por `Intl`, que resuelve la convencion local sin que nadie tenga que
   * escribirla. `general` no fija decimales: ensena los que el numero traiga, hasta tres — es lo
   * que se espera de «general», y lo que evita que un 0,5 salga como 1.
   */
  const decimales =
    tipo === 'entero'
      ? 0
      : (formato?.decimales ?? (tipo === 'decimal' || tipo === 'moneda' ? 2 : tipo === 'porcentaje' ? 1 : undefined));
  const compacto = formato?.compacto === true;
  const intl = new Intl.NumberFormat('es-DO', {
    ...(decimales === undefined
      ? { maximumFractionDigits: compacto ? 1 : 3 }
      : { minimumFractionDigits: decimales, maximumFractionDigits: decimales }),
    useGrouping: formato?.millares !== false,
    ...(compacto ? { notation: 'compact' as const, compactDisplay: 'short' as const } : {}),
  });
  const unidad = formato?.unidad ? ` ${formato.unidad}` : '';
  const prefijo = tipo === 'moneda' ? `${formato?.simbolo ?? 'RD$'} ` : '';
  const sufijo = tipo === 'porcentaje' ? '%' : '';
  return (n) => (n === null ? '—' : `${prefijo}${intl.format(n)}${sufijo}${unidad}`);
}
