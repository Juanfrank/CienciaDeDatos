import type { ModuleDefinition, ModulePage } from './ModuleDefinition';
import type { GridPosition } from './grid';

/** Personalizacion por usuario final — seccion 4.6. */
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

/** Aplica la personalizacion sobre la definicion institucional. */
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
        const cellPosition = personalization.positionOverrides[item.id];
        // El binding se copia tal cual: la personalizacion no puede tocarlo.
        return cellPosition ? { ...item, position: cellPosition } : item;
      }),
  }));

  const cambio =
    personalization.hiddenItemIds.length > 0 ||
    Object.keys(personalization.positionOverrides).length > 0 ||
    Object.keys(personalization.columnOrder ?? {}).length > 0;

  return { module: { ...module, pages }, isPersonalized: cambio };
}

/** Comprueba que una personalizacion no intenta alterar la logica de calculo. */
export function assertPersonalizationIsPresentationOnly(raw: Record<string, unknown>): void {
  const prohibidos = ['binding', 'measures', 'dimensions', 'datasetId', 'version', 'objectId'];
  const encontrados = prohibidos.filter((fieldName) => fieldName in raw);
  if (encontrados.length > 0) {
    throw new Error(
      `Una personalizacion no puede alterar ${encontrados.join(', ')}: la personalizacion se ` +
        `limita a la capa de presentacion, nunca a la logica de calculo de la metrica (4.6).`,
    );
  }
}

/** Etiqueta que distingue visualmente una vista personalizada de la institucional oficial. */
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
