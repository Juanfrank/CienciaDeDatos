import type { Aggregation, FieldRef } from '@app/data-contracts';
import type { PresentationKey, ObjectPresentation } from '../presentation/contract';
import type { IconName } from '../presentation/icons';
import type { ContainerSettings, ContainerId } from '../presentation/containers';
import type { ElementSettings, ElementId } from '../presentation/elements';
import type { FiltersPanelSettings } from '../presentation/filtersPanel';
import type { AsignacionDeRanuras, FieldSlot } from '../presentation/wells';

/**
 * Repositorio de objetos visuales versionados (4.5).
 *
 * Cada objeto se publica con version MAYOR.MENOR.PARCHE y cada instancia fija la version
 * exacta que usa, de modo que publicar una version nueva no altera las ya desplegadas.
 */

/** `complemento` agrupa los objetos que se adjuntan a otro en vez de ocupar la rejilla. */
export type ObjectCategory =
  | 'grafico'
  | 'tabla'
  | 'indicador'
  | 'filtro'
  | 'mapa'
  | 'complemento'
  | 'elemento'
  | 'contenedor';

/**
 * A que PREGUNTA responde un objeto: comparar, ver la evolucion, repartir un total.
 *
 * Distinta de `category`, que dice de que tipo es. La paleta agrupa por familia, de modo que
 * se elige por lo que se quiere contar y no por el nombre del objeto.
 */
export const OBJECT_FAMILIES = [
  'comparacion',
  'evolucion',
  'proporcion',
  'relacion',
  'valor',
  'detalle',
  'ubicacion',
  'control',
] as const;
export type ObjectFamily = (typeof OBJECT_FAMILIES)[number];

/**
 * Que necesita un objeto de un dataset para dibujarse.
 *
 * Se declara como dato para que el editor valide un mapeo antes de guardarlo (4.2).
 */
export interface ObjectDataContract {
  dimensions: { min: number; max: number };
  measures: { min: number; max: number };
  /** Descripcion legible de que representa cada ranura, para la interfaz del editor. */
  notes?: string;
  /**
   * Ranuras con nombre, en el orden en que el objeto consume sus campos.
   *
   * Opcional: sin ellas el editor usa los rotulos genericos de `pozosPorDefecto`. La suma de
   * los `max` de cada tipo debe cuadrar con el maximo del contrato; el catalogo lo comprueba.
   */
  wells?: FieldSlot[];
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
  /**
   * Claves de presentacion que admite esta version.
   *
   * El editor solo ofrece estas y la validacion rechaza el resto. Debe incluir
   * `PRESENTACION_MINIMA` entera.
   */
  presentation: PresentationKey[];
  deprecation?: DeprecationNotice;
}

export interface VisualObjectDefinition {
  objectId: string;
  name: string;
  description: string;
  category: ObjectCategory;
  /** Icono con el que se reconoce el objeto. Lo declara el objeto, no sus consumidores. */
  icono: IconName;
  /**
   * A que pregunta responde. Obligatoria salvo en elementos, contenedores y complementos, que
   * no consumen datos; lo comprueba una prueba del catalogo.
   */
  family?: ObjectFamily;
  /** true si el objeto se adjunta a otro en vez de ocupar una celda de la rejilla. */
  attachable?: boolean;
  versions: ObjectVersion[];
}

/**
 * Alcance de un complemento de tabla de datos.
 *
 * - `objeto`: todas las filas que alimentan el objeto.
 * - `subobjeto`: solo las de la categoria elegida — la barra pulsada, la celda, la fila.
 */
export type AttachmentScope = 'objeto' | 'subobjeto';

interface AttachedObjectBase {
  instanceId: string;
  /** Version EXACTA, igual que en cualquier otra instancia (4.5). */
  version: string;
}

/**
 * Tooltip explicativo: que representa el objeto entero.
 *
 * No es el tooltip de eje ni el de un punto de datos, que pertenecen al objeto anfitrion.
 */
export interface TooltipAttachment extends AttachedObjectBase {
  objectId: 'tooltip-explicativo';
  text: string;
}

/** Tabla de datos emergente con los datos de origen del objeto anfitrion. */
export interface TablePopupAttachment extends AttachedObjectBase {
  objectId: 'tabla-de-datos';
  scope: AttachmentScope;
}

/**
 * Instancia de un objeto adjuntado.
 *
 * Union discriminada y no una bolsa generica: cada complemento tiene configuracion propia y
 * obligatoria, y asi falta se detecta al guardar y no al dibujar.
 */
export type AttachedObjectInstance = TooltipAttachment | TablePopupAttachment;

/**
 * Instancia de un objeto dentro de un modulo.
 *
 * `version` es exacta, nunca un rango: un rango dejaria que publicar alterase lo desplegado.
 */
export interface ObjectInstance {
  instanceId: string;
  objectId: string;
  version: string;
  title?: string;
  /** Mapeo de ranuras a campos de la fuente activa. */
  binding: {
    datasetId: string;
    /**
     * Columnas que el objeto necesita, en el orden de sus ranuras.
     *
     * Se derivan de `ranuras` y se guardan junto a ellas porque son lo que leen el lector del
     * cache, la validacion de esquema, la proyeccion y la exportacion.
     */
    dimensions: FieldRef[];
    measures: string[];
    /**
     * A que ranura pertenece cada campo. Es la fuente de verdad del mapeo.
     *
     * Opcional: sin el mapa el reparto se deduce del orden del array, que es como se guardaba
     * antes de que existiera.
     */
    slots?: AsignacionDeRanuras;
    /**
     * Agregacion por medida, solo cuando difiere de la que declara el esquema. Lo no dicho se
     * resuelve contra el esquema en cada lectura.
     */
    aggregations?: Record<string, Aggregation>;
  };
  /**
   * Objetos adjuntados a este, anidados: un complemento no existe sin su anfitrion ni le
   * sobrevive.
   */
  attachments?: AttachedObjectInstance[];
  /** Anulaciones de tema, limitadas al conjunto documentado de 4.3. */
  themeOverrides?: Record<string, string | string[]>;
  /**
   * Como se presenta esta INSTANCIA: icono, acento, resaltado, subtitulo, formato.
   *
   * De la instancia y no del objeto, para que dos tarjetas del mismo tipo puedan verse distinto
   * sin publicar dos objetos.
   */
  presentacion?: ObjectPresentation;
  /**
   * Configuracion propia del tipo de objeto, discriminada por `objectId`.
   *
   * `presentacion` es como SE VE un objeto; esto es que HACE. Un icono es presentacion; que una
   * fecha se filtre con calendario o con rango no lo es.
   */
  settings?: ObjectSettings;
}

/** Configuracion especifica de un tipo de objeto. Anadir un tipo anade un miembro aqui. */
export type ObjectSettings =
  | ({ objectId: 'panel-de-filtros' } & FiltersPanelSettings)
  | ({ objectId: ElementId } & ElementSettings)
  | ({ objectId: ContainerId } & ContainerSettings);

/**
 * Si un objeto no necesita ningun dataset.
 *
 * Se deduce del contrato —cero dimensiones y cero medidas— en vez de un campo aparte, que seria
 * una segunda fuente de verdad. Lo consultan la validacion de modulo, la lista de datasets
 * consumidos y el lector del cache.
 */
export const noConsumeDatos = (contrato: ObjectDataContract): boolean =>
  contrato.dimensions.max === 0 && contrato.measures.max === 0;
