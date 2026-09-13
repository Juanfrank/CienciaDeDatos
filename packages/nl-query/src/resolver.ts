import type {
  ConsultaResuelta,
  INaturalLanguageResolver,
  Intencion,
  Vocabulario,
} from './types';

/** Resolutor local y determinista. */

/** Quita acentos y mayusculas: "penal" y "Penál" son la misma palabra para quien pregunta. */
export function normalizar(content: string): string {
  return content
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Palabras sin contenido, que no se cuentan como "no entendidas". */
const VACIAS = new Set(
  [
    'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas', 'en', 'por', 'para',
    'con', 'y', 'o', 'a', 'al', 'que', 'hay', 'son', 'es', 'me', 'muestra', 'muestrame',
    'dame', 'ver', 'quiero', 'saber', 'cual', 'cuales', 'como', 'donde', 'segun', 'sobre',
    'total', 'totales', 'cantidad', 'numero',
    // Interrogativos y verbos de conteo: son la forma normal de preguntar, no ruido.
    'cuantos', 'cuantas', 'cuanto', 'cuanta', 'hubo', 'existen', 'tenemos', 'tengo',
    'registrados', 'registradas', 'suma', 'sumar', 'contar', 'cuenta',
  ].map(normalizar),
);

const PALABRAS_DESGLOSE = new Set(['por', 'segun', 'desglosado', 'desglose', 'cada', 'agrupado']);
const PALABRAS_RANKING = new Set(['top', 'mayores', 'mayor', 'principales', 'primeros', 'ranking']);

const tokenizar = (content: string): string[] =>
  normalizar(content)
    .replace(/[¿?¡!.,;:()"']/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

/** Todas las secuencias de hasta `max` palabras, de la mas larga a la mas corta. */
function ngramas(tokens: string[], max = 4): { content: string; desde: number; hasta: number }[] {
  const salida: { content: string; desde: number; hasta: number }[] = [];
  for (let n = Math.min(max, tokens.length); n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      salida.push({ content: tokens.slice(i, i + n).join(' '), desde: i, hasta: i + n - 1 });
    }
  }
  return salida;
}

interface Candidato {
  tipo: 'measure' | 'dimension' | 'valor';
  clave: string;
  valor?: string;
  desde: number;
  hasta: number;
}

export class ResolvedorLocal implements INaturalLanguageResolver {
  resolver(pregunta: string, vocabulario: Vocabulario): ConsultaResuelta {
    const tokens = tokenizar(pregunta);
    const consumido = new Array<boolean>(tokens.length).fill(false);
    const candidatos: Candidato[] = [];

    // Se recorren los n-gramas de mas largo a mas corto: "distrito norte" tiene que ganarle a
    // "norte" suelto, o un valor compuesto se reconoceria a medias.
    for (const gram of ngramas(tokens)) {
      if (consumido.slice(gram.desde, gram.hasta + 1).some(Boolean)) continue;

      const encontrado = this.search(gram.content, vocabulario);
      if (!encontrado) continue;

      candidatos.push({ ...encontrado, desde: gram.desde, hasta: gram.hasta });
      for (let i = gram.desde; i <= gram.hasta; i++) consumido[i] = true;
    }

    const filtros: Record<string, string[]> = {};
    for (const c of candidatos.filter((x) => x.tipo === 'valor')) {
      if (c.valor === undefined) continue;
      (filtros[c.clave] ??= []).push(c.valor);
    }

    const measure = candidatos.find((c) => c.tipo === 'measure')?.clave;
    const dimensionMencionada = candidatos.find((c) => c.tipo === 'dimension')?.clave;

    const restantes = tokens.filter((t, i) => !consumido[i]);
    const palabras = new Set(restantes);
    const intencion: Intencion = [...palabras].some((p) => PALABRAS_RANKING.has(p))
      ? 'ranking'
      : [...palabras].some((p) => PALABRAS_DESGLOSE.has(p)) && dimensionMencionada
        ? 'desglose'
        : dimensionMencionada
          ? 'desglose'
          : 'total';

    const limite = intencion === 'ranking' ? this.numeroEn(restantes) : undefined;

    // Las palabras de intencion y las vacias no son "no entendidas": se usaron para decidir.
    const noEntendido = restantes.filter(
      (t) =>
        !VACIAS.has(t) &&
        !PALABRAS_DESGLOSE.has(t) &&
        !PALABRAS_RANKING.has(t) &&
        !/^\d+$/.test(t),
    );

    const resoluble = measure !== undefined || Object.keys(filtros).length > 0;

    return {
      intencion,
      ...(measure ? { measure } : {}),
      ...(dimensionMencionada ? { groupBy: dimensionMencionada } : {}),
      filters: filtros,
      ...(limite !== undefined ? { limite } : {}),
      noEntendido,
      explicacion: this.explicar(vocabulario, measure, dimensionMencionada, filtros, intencion),
      resoluble,
    };
  }

  private numeroEn(tokens: string[]): number | undefined {
    const n = tokens.map((t) => Number(t)).find((v) => Number.isInteger(v) && v > 0);
    return n;
  }

  private search(
    content: string,
    vocabulario: Vocabulario,
  ): { tipo: Candidato['tipo']; clave: string; valor?: string } | undefined {
    for (const valor of vocabulario.values) {
      if (normalizar(valor.valor) === content) {
        return { tipo: 'valor', clave: valor.dimension, valor: valor.valor };
      }
    }
    for (const medida of vocabulario.measures) {
      if (normalizar(medida.etiqueta) === content || normalizar(medida.clave) === content) {
        return { tipo: 'measure', clave: medida.clave };
      }
    }
    for (const dim of vocabulario.dimensions) {
      if (normalizar(dim.etiqueta) === content || normalizar(dim.clave) === content) {
        return { tipo: 'dimension', clave: dim.clave };
      }
    }
    return undefined;
  }

  private explicar(
    vocabulario: Vocabulario,
    measure: string | undefined,
    groupBy: string | undefined,
    filtros: Record<string, string[]>,
    intencion: Intencion,
  ): string {
    const nombreDe = (clave: string, lista: Vocabulario['measures']) =>
      lista.find((t) => t.clave === clave)?.etiqueta ?? clave;

    const partes: string[] = [];
    if (measure) partes.push(nombreDe(measure, vocabulario.measures));
    if (groupBy) {
      partes.push(
        `${intencion === 'ranking' ? 'ordenado por' : 'por'} ${nombreDe(groupBy, vocabulario.dimensions)}`,
      );
    }

    const entradas = Object.entries(filtros);
    if (entradas.length > 0) {
      partes.push(
        `filtrado a ${entradas
          .map(([d, v]) => `${nombreDe(d, vocabulario.dimensions)} = ${v.join(', ')}`)
          .join(' y ')}`,
      );
    }

    return partes.length === 0 ? 'No se reconocio nada de la pregunta.' : partes.join(', ');
  }
}

/** URL que responde a la consulta — seccion 4.11. */
export function urlDeConsulta(moduleSlug: string, consulta: ConsultaResuelta): string {
  const params = new URLSearchParams();
  for (const [fieldName, valores] of Object.entries(consulta.filters)) {
    for (const v of valores) params.append(fieldName, v);
  }
  const cadena = params.toString();
  return cadena ? `/m/${moduleSlug}?${cadena}` : `/m/${moduleSlug}`;
}
