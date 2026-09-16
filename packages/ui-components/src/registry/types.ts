import type { Aggregation, DatasetGrain, FieldRef } from '@app/data-contracts';
import type { PresentationKey, ObjectPresentation } from '../presentation/contract';
import type { IconName } from '../presentation/icons';
import type { ContainerSettings, ContainerId } from '../presentation/containers';
import type { ElementSettings, ElementId } from '../presentation/elements';
import type { FiltersPanelSettings, PickerKind } from '../presentation/filtersPanel';
import type { SlotAssignment, FieldSlot } from '../presentation/wells';

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
  | 'contenedor'
  /**
   * Navega entre las paginas de un modulo. No se COLOCA en el lienzo.
   *
   * Es la unica categoria que no se arrastra a una pagina, y con motivo: lo que navega es el
   * modulo, no una pagina suya. Puesto dentro de una habria que ponerlo en todas, mantenerlo igual
   * en todas, y la primera que se quedara sin el seria un callejon sin salida. Se elige en la
   * configuracion del modulo y se dibuja alrededor de cualquier pagina que se abra.
   */
  | 'navegacion';

/**
 * A que PREGUNTA responde un objeto: comparar, ver la evolucion, repartir un total.
 *
 * Distinta de `category`, que dice de que tipo es. La paleta agrupa por familia, de modo que
 * se elige por lo que se quiere contar y no por el nombre del objeto.
 */
export const OBJECT_FAMILIES = [
  'comparison',
  'trend',
  'proportion',
  'relation',
  'distribution',
  'value',
  'detail',
  'location',
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
  /**
   * El grano que el objeto NECESITA del dataset.
   *
   * Solo lo declaran los que reparten OBSERVACIONES —un histograma, un diagrama de caja—: sobre un
   * dataset preagregado repartirian grupos, y la forma que dibujarian seria la de los grupos. No es
   * un matiz de precision como el de las agregaciones: el objeto entero diria otra cosa.
   *
   * Ausente significa que da igual, que es el caso de casi todos: una barra con la suma de un
   * grupo es la misma suma venga de donde venga.
   */
  grain?: DatasetGrain;
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
   * `MIN_PRESENTATION` entera.
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
 * Filtro de visualizacion: acota SOLO este objeto, por uno de los campos que el mismo mapea.
 *
 * Es distinto del filtrado cruzado y de los objetos de filtro, y la diferencia importa: aquellos
 * mueven la pagina entera, este solo su anfitrion. De ahi que su seleccion viaje en la URL con el
 * `instanceId` delante (`f.<instanceId>`) en vez de con la clave del campo: dos objetos filtrados
 * por la misma dimension tienen que poder estar en valores distintos, que es justo lo que se pide
 * al filtrar una visual sola.
 *
 * El campo base se elige entre los que el anfitrion YA mapea. Uno cualquiera del dataset lo
 * convertiria en un filtro general disfrazado de complemento, y ademas podria acotar por algo que
 * el objeto no ensena — un filtro cuyo efecto no se ve es un filtro que nadie entiende.
 */
export interface VisualFilterAttachment extends AttachedObjectBase {
  objectId: 'filtro-de-visualizacion';
  /** `Tabla.Campo` de una dimension mapeada, o el nombre de una medida mapeada. */
  fieldName: string;
  /** Como se elige el valor. Sin decirlo, el que corresponda al tipo del campo. */
  tipo?: PickerKind;
}

/**
 * Pie de pagina del objeto: una nota, fija o con cifras dentro.
 *
 * Las cifras se referencian por el ORDEN DE MAPEO y no por su nombre: `{{1}}` es la primera medida
 * mapeada. Es a proposito — el nombre de una medida puede cambiar en el esquema, y un pie que la
 * nombrara se quedaria escribiendo una columna que ya no existe. El orden lo fija quien configura
 * el objeto, y mientras no lo cambie el pie sigue diciendo lo mismo.
 */
export interface FooterAttachment extends AttachedObjectBase {
  objectId: 'pie-de-pagina';
  /** El texto. `{{1}}`, `{{2}}`… se sustituyen por el resultado de la medida en esa posicion. */
  texto: string;
}

/** Donde va la coletilla de «Registros del N al N. Total N», si va. */
export const PAGINATION_LEGENDS = ['ninguna', 'arriba', 'abajo'] as const;

export type PaginationLegend = (typeof PAGINATION_LEGENDS)[number];

/**
 * Paginado: parte lo que el objeto ensena en paginas del tamano que se elija.
 *
 * Existe porque el alto de un objeto NO depende de su contenido (esa regla se comprueba en
 * `shell.spec.ts`): una tabla de cuatrocientas filas dentro de una caja de cuatro filas se
 * desplaza, y desplazarse no deja ver cuanto falta. El paginado si lo dice.
 */
export interface PaginationAttachment extends AttachedObjectBase {
  objectId: 'paginado';
  /** Cuantos registros —o categorias— por pagina. */
  porPagina: number;
  /** El selector con botones de anterior y siguiente. Sin el, el paginado no se puede recorrer. */
  selector?: boolean;
  /** «Registros del N al N. Total N», y donde. */
  coletilla?: PaginationLegend;
}

/**
 * Instancia de un objeto adjuntado.
 *
 * Union discriminada y no una bolsa generica: cada complemento tiene configuracion propia y
 * obligatoria, y asi falta se detecta al guardar y no al dibujar.
 */
export type AttachedObjectInstance =
  | TooltipAttachment
  | TablePopupAttachment
  | VisualFilterAttachment
  | FooterAttachment
  | PaginationAttachment;

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
    slots?: SlotAssignment;
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
  presentation?: ObjectPresentation;
  /**
   * Configuracion propia del tipo de objeto, discriminada por `objectId`.
   *
   * `presentacion` es como SE VE un objeto; esto es que HACE. Un icono es presentacion; que una
   * fecha se filtre con calendario o con rango no lo es.
   */
  settings?: ObjectSettings;
  /**
   * A donde se puede saltar desde este objeto llevando el contexto de filtros (4.4).
   *
   * Es una LISTA y no un destino unico porque una misma cifra suele tener mas de un detalle
   * detras —las audiencias de ese distrito, los casos de esa materia— y obligar a elegir uno
   * dejaria el otro sin camino. Vacia o ausente: el objeto no ofrece salto.
   *
   * Se declara en la INSTANCIA y no en el objeto publicado: a donde lleva una cifra depende de
   * que modulos existan al lado, no de que clase de objeto la dibuja.
   */
  drillThrough?: DrillThroughTarget[];
}

/**
 * Destino de drill-through declarado en un objeto del modulo — seccion 4.4.
 *
 * Vive aqui, con `ObjectInstance`, y no con el resto de la interaccion: es un campo de la
 * instancia, y el paquete que define la instancia no puede depender del que define el modulo sin
 * cerrar un ciclo. `drillThroughUrl`, que es quien lo convierte en una direccion, si vive alla.
 */
export interface DrillThroughTarget {
  /** Modulo al que se navega. */
  moduleSlug: string;
  pageSlug?: string;
  /**
   * Dimensiones cuyo valor se lleva al destino. Si se omite, se llevan todos los filtros
   * activos. Acotarlo es lo habitual: llevarlo todo suele arrastrar filtros sin sentido alla.
   */
  carryDimensions?: string[];
  /** Como se lee la entrada en el menu. Sin el, el nombre del modulo destino. */
  label?: string;
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
/**
 * Si un objeto se COLOCA en la rejilla de una pagina.
 *
 * Tres clases de objeto no se colocan, y por motivos distintos: un complemento se ADJUNTA a otro
 * objeto, y un navegador de pagina se elige en la configuracion del MODULO porque lo que navega es
 * el modulo entero. La regla vive aqui, en una funcion, y no repetida en la paleta y en la prueba
 * que recorre el catalogo: repetida, el dia que entre una cuarta clase una de las dos se enterara
 * y la otra no.
 */
export const placeable = (definicion: {
  attachable?: boolean;
  category: ObjectCategory;
}): boolean => definicion.attachable !== true && definicion.category !== 'navegacion';

export const notConsumesData = (contrato: ObjectDataContract): boolean =>
  contrato.dimensions.max === 0 && contrato.measures.max === 0;
