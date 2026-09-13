import { ResolvedorLocal, type ConsultaResuelta, type Vocabulario } from '@app/nl-query';
import { fieldKey } from '@app/ui-components';
import { cargarModulo } from './datos';
import { moduloServibleParaUsuario } from './cicloDeVida';

/** Cableado de la consulta en lenguaje natural (4.9). */

const resolutor = new ResolvedorLocal();

/** Etiqueta legible de una dimension: el campo, sin la tabla. */
const etiquetaDeDimension = (clave: string): string => clave.split('.').pop() ?? clave;

/** Cuantos valores distintos entran al vocabulario por dimension. */
const MAXIMO_VALORES = 200;

export async function vocabularioDe(
  moduleSlug: string,
  userId: string,
  teamId: string,
): Promise<Vocabulario | null> {
  const module = await moduloServibleParaUsuario(moduleSlug, userId);
  if (!module) return null;

  const cargado = await cargarModulo({ module, userId, teamId, requestedFilters: {} });
  if (!cargado) return null;

  const measures = new Map<string, string>();
  const dimensions = new Map<string, string>();
  const valores = new Map<string, Set<string>>();

  for (const objeto of cargado.objetos) {
    const { binding, title } = objeto.item.instance;

    for (const medida of binding.measures) {
      // La etiqueta legible es el titulo del objeto cuando solo mapea una medida: es como la
      // llama quien mira la pantalla, y por tanto como la va a escribir en la pregunta.
      const etiqueta = binding.measures.length === 1 && title ? title : medida;
      if (!measures.has(medida)) measures.set(medida, etiqueta);
    }

    // Las dimensiones mapeadas siempre entran, aunque el dataset no traiga su columna: sirven
    // para entender "por materia" aunque no haya ningun valor que ofrecer.
    for (const dim of binding.dimensions) {
      const clave = fieldKey(dim);
      if (!dimensions.has(clave)) dimensions.set(clave, etiquetaDeDimension(clave));
    }

    if (!objeto.result) continue;

    // Y ademas TODA columna no numerica del resultado, no solo las mapeadas. Quien mira el
    // modulo ve esas columnas en la tabla de origen y puede filtrar por ellas desde la URL, asi
    // que no poder preguntarlas seria una limitacion arbitraria. Los valores siguen saliendo de
    // filas YA filtradas por su ambito, que es lo que impide que esto revele nada.
    for (const [indice, column] of objeto.result.columns.entries()) {
      if (column.type === 'number') continue;
      if (!dimensions.has(column.name)) dimensions.set(column.name, etiquetaDeDimension(column.name));

      const conjunto = valores.get(column.name) ?? new Set<string>();
      for (const fila of objeto.result.rows) {
        if (conjunto.size >= MAXIMO_VALORES) break;
        conjunto.add(String(fila[indice]));
      }
      valores.set(column.name, conjunto);
    }
  }

  return {
    moduleSlug: module.slug,
    measures: [...measures].map(([clave, etiqueta]) => ({ clave, etiqueta })),
    dimensions: [...dimensions].map(([clave, etiqueta]) => ({ clave, etiqueta })),
    values: [...valores].flatMap(([dimension, conjunto]) =>
      [...conjunto].map((valor) => ({ dimension, valor })),
    ),
  };
}

export async function resolverPregunta(
  pregunta: string,
  moduleSlug: string,
  userId: string,
  teamId: string,
): Promise<{ consulta: ConsultaResuelta; vocabulario: Vocabulario } | null> {
  const vocabulario = await vocabularioDe(moduleSlug, userId, teamId);
  if (!vocabulario) return null;

  return { consulta: resolutor.resolver(pregunta, vocabulario), vocabulario };
}
