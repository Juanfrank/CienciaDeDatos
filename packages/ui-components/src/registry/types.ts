import type { FieldRef } from '@app/data-contracts';

/**
 * Repositorio de objetos visuales versionados — seccion 4.5.
 *
 * Cada objeto se publica con version MAYOR.MENOR.PARCHE, y cada instancia insertada en un
 * modulo FIJA la version exacta que usa. Esa fijacion es lo que garantiza el criterio de
 * aceptacion de la seccion 9: publicar una version nueva no altera retroactivamente
 * instancias ya desplegadas.
 */

export type ObjectCategory = 'grafico' | 'tabla' | 'indicador' | 'filtro' | 'mapa';

/**
 * Que necesita un objeto de un dataset para poder dibujarse.
 *
 * Se declara como dato para que el editor de modulos (4.2) pueda validar un mapeo ANTES de
 * guardarlo, en vez de descubrir en tiempo de render que el objeto recibio dos medidas cuando
 * solo admite una.
 */
export interface ObjectDataContract {
  dimensions: { min: number; max: number };
  measures: { min: number; max: number };
  /** Descripcion legible de que representa cada ranura, para la interfaz del editor. */
  notes?: string;
}

export interface ObjectCertification {
  /** Pruebas automatizadas en verde. Requisito de 4.5 para publicar. */
  testsPassed: boolean;
  /** Revision por pares. El documento la exige junto con las pruebas. */
  reviewedBy: string;
  reviewedAt: string;
}

/**
 * Politica de deprecacion (4.5): fecha limite y aviso activo a los modulos que usan una
 * version proxima a deprecarse.
 */
export interface DeprecationNotice {
  announcedAt: string;
  /** Fecha limite. Despues de ella la version deja de estar soportada. */
  removeAfter: string;
  /** Version que la sustituye, para que el aviso sea accionable y no solo una alarma. */
  replacedBy?: string;
  reason: string;
}

export interface ObjectVersion {
  version: string;
  publishedAt: string;
  /** Changelog OBLIGATORIO por version (4.5). El registro rechaza publicar sin el. */
  changelog: string;
  certification: ObjectCertification;
  dataContract: ObjectDataContract;
  deprecation?: DeprecationNotice;
}

export interface VisualObjectDefinition {
  objectId: string;
  name: string;
  description: string;
  category: ObjectCategory;
  versions: ObjectVersion[];
}

/**
 * Instancia de un objeto dentro de un modulo.
 *
 * `version` es la version EXACTA fijada, nunca un rango. Un rango reintroduciria por la puerta
 * de atras justo lo que 4.5 prohibe: que publicar altere lo ya desplegado.
 */
export interface ObjectInstance {
  instanceId: string;
  objectId: string;
  version: string;
  title?: string;
  /** Mapeo de ranuras a campos de la fuente activa. */
  binding: {
    datasetId: string;
    dimensions: FieldRef[];
    measures: string[];
  };
  /** Anulaciones de tema, limitadas al conjunto documentado de 4.3. */
  themeOverrides?: Record<string, string | string[]>;
}
