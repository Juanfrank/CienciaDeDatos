import type { FieldRef } from '@app/data-contracts';
import type { ClaveDePresentacion, PresentacionDeObjeto } from '../presentacion/contrato';
import type { ConfiguracionDePanelDeFiltros } from '../presentacion/panelDeFiltros';
import type { AsignacionDeRanuras, RanuraDeCampos } from '../presentacion/pozos';

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
  /**
   * Las ranuras CON NOMBRE, en el orden en que el objeto consume sus campos.
   *
   * Opcional: un objeto que no las declare se edita con los rotulos genericos de siempre
   * (`pozosPorDefecto`). Declararlas no cambia el modelo de datos —siguen siendo los mismos dos
   * arrays ordenados—, solo hace que el editor diga «Eje X» donde antes decia «dimension 1».
   *
   * La suma de los `max` de cada tipo tiene que cuadrar con el maximo del contrato, y hay una
   * prueba del catalogo que lo comprueba: un pozo que prometiera mas de lo que el objeto admite
   * dejaria guardar un mapeo que la validacion rechaza despues.
   */
  pozos?: RanuraDeCampos[];
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
   * Que claves de presentacion admite esta version.
   *
   * Se declara como dato, igual que el contrato de datos y por el mismo motivo: el editor tiene
   * que poder ofrecer SOLO lo que el objeto entiende, y la validacion rechazar lo demas antes de
   * guardar. Una tabla que aceptara `leyenda` porque nadie lo comprueba guardaria una opcion que
   * no hace nada, y esa es la clase de configuracion que luego nadie se atreve a borrar.
   *
   * Tiene que incluir `PRESENTACION_MINIMA` entera. Hay una prueba que lo comprueba sobre todo el
   * catalogo, asi que un objeto nuevo no se puede publicar sin las cuatro basicas.
   */
  presentation: ClaveDePresentacion[];
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
    /**
     * Las columnas que el objeto necesita, en el orden en que se declaran sus ranuras.
     *
     * Se DERIVAN de `ranuras` y se guardan junto a ellas. Siguen aqui porque son lo que leen el
     * lector del cache, la validacion de esquema, la proyeccion y la exportacion: cambiar eso
     * habria obligado a tocar todo el camino de lectura para no ganar nada.
     */
    dimensions: FieldRef[];
    measures: string[];
    /**
     * A QUE RANURA pertenece cada campo. Es la fuente de verdad del mapeo.
     *
     * Antes el reparto lo decidia el orden del array, y eso impedia llenar una ranura sin llenar
     * antes las anteriores: en un grafico de barras no habia forma de poner solo la serie, porque
     * el primer campo caia siempre en el eje X.
     *
     * Opcional para que lo guardado antes de esto siga abriendose: sin el mapa se deduce del
     * orden, que es exactamente como se guardo.
     */
    ranuras?: AsignacionDeRanuras;
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
  /**
   * Como se presenta este objeto: icono, acento, resaltado, subtitulo, formato.
   *
   * Es configuracion de la INSTANCIA y no del objeto: dos tarjetas KPI del mismo tipo pueden
   * llevar iconos y acentos distintos sin publicar dos objetos. Eso es justo lo que permite armar
   * visuales parecidas desde el editor sin escribir codigo.
   */
  presentacion?: PresentacionDeObjeto;
  /**
   * Configuracion PROPIA del tipo de objeto.
   *
   * Union discriminada por `objectId`, igual que los complementos y por el mismo motivo: cada
   * tipo tiene su configuracion obligatoria y con una bolsa generica el error solo aparece al
   * dibujar. 4.2 pide justo lo contrario — validar antes de guardar.
   *
   * `presentacion` es como SE VE un objeto y esto es que HACE. Un icono es presentacion; que la
   * dimension de fecha se filtre con un calendario o con un rango no lo es: cambia lo que el
   * objeto ofrece hacer.
   */
  configuracion?: ConfiguracionDeObjeto;
}

/** Configuracion especifica de un tipo de objeto. Anadir un tipo anade un miembro aqui. */
export type ConfiguracionDeObjeto = {
  objectId: 'panel-de-filtros';
} & ConfiguracionDePanelDeFiltros;
