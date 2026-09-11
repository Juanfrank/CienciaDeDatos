import type { FieldRef } from '@app/data-contracts';

/**
 * Repositorio de objetos visuales versionados — seccion 4.5.
 *
 * Cada objeto se publica con version MAYOR.MENOR.PARCHE, y cada instancia insertada en un
 * modulo FIJA la version exacta que usa. Esa fijacion es lo que garantiza el criterio de
 * aceptacion de la seccion 9: publicar una version nueva no altera retroactivamente
 * instancias ya desplegadas.
 */

/**
 * `complemento` es la categoria de los objetos ADJUNTABLES: no se colocan en la rejilla, se
 * adjuntan a otro objeto y complementan lo que ese objeto muestra. Un complemento suelto no
 * significa nada, y por eso el registro rechaza colocarlo como objeto independiente.
 */
export type ObjectCategory = 'grafico' | 'tabla' | 'indicador' | 'filtro' | 'mapa' | 'complemento';

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
  /**
   * true si el objeto se adjunta a otro en vez de ocupar una celda de la rejilla.
   *
   * Es una propiedad del objeto y no del sitio donde se use: asi el editor puede ofrecerlo en la
   * lista correcta, y la validacion puede rechazar los dos errores simetricos —colocar un
   * complemento como objeto suelto, y adjuntar un objeto que no es complemento.
   */
  attachable?: boolean;
  versions: ObjectVersion[];
}

/**
 * Alcance de un complemento de tabla de datos.
 *
 * - `objeto`: todas las filas que alimentan el objeto.
 * - `subobjeto`: solo las que hay detras de la categoria elegida — la barra que se pulso, la
 *   celda de la matriz, la fila de la tabla. Responde a "de que filas sale ESTE numero", que es
 *   justo la granularidad que el objeto agrego y dejo de mostrar.
 */
export type AttachmentScope = 'objeto' | 'subobjeto';

interface AttachedObjectBase {
  instanceId: string;
  /** Version EXACTA, igual que en cualquier otra instancia (4.5). */
  version: string;
}

/**
 * Tooltip explicativo.
 *
 * No es el tooltip de eje ni el de un punto de datos, que pertenecen al objeto anfitrion: es una
 * explicacion de lo que el objeto entero representa, para que quien lo mire por primera vez sepa
 * que esta viendo sin preguntarle a nadie.
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
 * Es una union discriminada y no un `Record<string, unknown>` de configuracion a proposito: cada
 * complemento tiene su propia configuracion OBLIGATORIA —un tooltip sin texto no es nada— y con
 * una bolsa generica ese error solo aparecería al dibujar. La seccion 4.2 pide justo lo
 * contrario: validar el mapeo antes de guardarlo. Añadir un complemento nuevo añade un miembro
 * aqui, que es el sitio donde se quiere sentir el cambio.
 */
export type AttachedObjectInstance = TooltipAttachment | TablePopupAttachment;

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
  /**
   * Objetos adjuntados a este.
   *
   * Van ANIDADOS y no como elementos sueltos de la rejilla con un puntero al anfitrion: asi un
   * complemento no puede existir sin el objeto al que complementa, ni sobrevivirle cuando se
   * borra. La relacion es estructural, no una convencion que haya que recordar mantener.
   */
  attachments?: AttachedObjectInstance[];
  /** Anulaciones de tema, limitadas al conjunto documentado de 4.3. */
  themeOverrides?: Record<string, string | string[]>;
}
