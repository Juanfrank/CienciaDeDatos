import type { ModuleDefinition, ModulePage } from './ModuleDefinition';
import type { GridPosition } from './grid';

/**
 * Personalizacion por usuario final — seccion 4.6.
 *
 * "Personalizacion limitada a la capa de PRESENTACION (campos visibles dentro de una
 * perspectiva aprobada, orden, layout) — NUNCA a la logica de calculo de la metrica."
 *
 * Ese limite es la razon de ser de este modulo y esta expresado en el TIPO, no en un comentario:
 * `UserPersonalization` no tiene forma de tocar `binding.measures` ni `binding.datasetId`. Una
 * personalizacion no puede cambiar que mide un indicador, solo como se ve.
 */
export interface UserPersonalization {
  userId: string;
  moduleId: string;
  /** Objetos que la persona decidio ocultar de su vista. */
  hiddenItemIds: string[];
  /** Reposicionamiento propio. No puede anadir objetos que el modulo no tenga. */
  positionOverrides: Record<string, GridPosition>;
  /** Orden propio de las columnas de una tabla, por instancia. */
  columnOrder?: Record<string, string[]>;
  updatedAt: string;
}

/**
 * Aplica la personalizacion sobre la definicion institucional.
 *
 * Nunca muta el original: devuelve una vista derivada. La definicion institucional sigue siendo
 * la fuente de verdad y cualquiera puede volver a ella descartando su personalizacion.
 */
export function applyPersonalization(
  module: ModuleDefinition,
  personalization: UserPersonalization | undefined,
): { module: ModuleDefinition; isPersonalized: boolean } {
  if (!personalization) return { module, isPersonalized: false };

  const ocultos = new Set(personalization.hiddenItemIds);
  const pages: ModulePage[] = module.pages.map((page) => ({
    ...page,
    items: page.items
      .filter((item) => !ocultos.has(item.id))
      .map((item) => {
        const posicion = personalization.positionOverrides[item.id];
        // El binding se copia tal cual: la personalizacion no puede tocarlo.
        return posicion ? { ...item, position: posicion } : item;
      }),
  }));

  const cambio =
    personalization.hiddenItemIds.length > 0 ||
    Object.keys(personalization.positionOverrides).length > 0 ||
    Object.keys(personalization.columnOrder ?? {}).length > 0;

  return { module: { ...module, pages }, isPersonalized: cambio };
}

/**
 * Comprueba que una personalizacion no intenta alterar la logica de calculo.
 *
 * La forma del tipo ya lo impide en TypeScript, pero una personalizacion llega desde la red y
 * puede traer campos de mas. Esta funcion es la comprobacion en ejecucion equivalente: si
 * alguien envia `binding` o `measures` dentro de una personalizacion, se rechaza en vez de
 * ignorarse en silencio.
 */
export function assertPersonalizationIsPresentationOnly(raw: Record<string, unknown>): void {
  const prohibidos = ['binding', 'measures', 'dimensions', 'datasetId', 'version', 'objectId'];
  const encontrados = prohibidos.filter((campo) => campo in raw);
  if (encontrados.length > 0) {
    throw new Error(
      `Una personalizacion no puede alterar ${encontrados.join(', ')}: la personalizacion se ` +
        `limita a la capa de presentacion, nunca a la logica de calculo de la metrica (4.6).`,
    );
  }
}

/**
 * Etiqueta que distingue visualmente una vista personalizada de la institucional oficial.
 *
 * La seccion 4.6 pide esa distincion "incluida al exportar/compartir": por eso es un dato del
 * modelo y no un detalle de estilo de una pantalla concreta.
 */
export interface ViewProvenance {
  isPersonalized: boolean;
  label: string;
}

export function describeProvenance(isPersonalized: boolean): ViewProvenance {
  return {
    isPersonalized,
    label: isPersonalized
      ? 'Vista personalizada — no es la vista institucional oficial'
      : 'Vista institucional oficial',
  };
}
