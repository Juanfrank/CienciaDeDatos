import type { Aggregation, DatasetGrain } from '@app/data-contracts';
import { defaultRegistry } from '@app/caching';
import type {
  PresentationKey,
  ObjectFamily,
  IconName,
  ObjectCategory,
  FieldWell,
} from '@app/ui-components';
import type { ObjectPresentation } from '@app/ui-components';
import { OBJECT_ICONS, fieldKey } from '@app/ui-components';
import { objectRegistry } from './context';
import { modules } from './moduleStore';
import { ICON_PREFIX, defaultPresentations, disabledResources } from './catalogo';
import { declaredAggregations, availableColumnsOf } from './data';

/** Paleta del editor de modulos — seccion 4.2. */

export interface PaletteObject {
  objectId: string;
  name: string;
  description: string;
  category: ObjectCategory;
  /** Lo declara el objeto: la tienda y la tarjeta leen del mismo sitio. */
  icono: IconName;
  /** A que pregunta responde. La paleta agrupa por esto; los elementos no la traen. */
  family?: ObjectFamily;
  version: string;
  attachable: boolean;
  dimensiones: { min: number; max: number };
  medidas: { min: number; max: number };
  /** Claves de presentacion que ESTA version admite. El editor solo ofrece estas. */
  presentation: PresentationKey[];
  /** Ranuras con nombre. Vacio si el objeto no las declara: el editor usa las genericas. */
  wells: FieldWell[];
  /**
   * Con que presentacion nace este objeto al colocarlo, si la institucion fijo una.
   *
   * Viaja con la paleta y no se pide aparte porque es parte de lo que el editor necesita para
   * colocar: pedirla en otra llamada abriria la ventana en la que un objeto nace con el
   * predeterminado viejo porque la segunda respuesta todavia no habia llegado.
   */
  defaultPresentation?: ObjectPresentation;
  notas?: string;
}

export interface PaletteDataset {
  datasetId: string;
  description: string;
  /** Claves 'Tabla.Campo' que este dataset trae y el esquema sigue reconociendo. */
  dimensiones: string[];
  medidas: string[];
  /** Tipo de cada columna. Decide que selectores tienen sentido sobre cada dimension. */
  kinds: Record<string, string>;
  /** Como declara el esquema que se resume cada medida, y a que grano quedaron las filas. */
  aggregations: Record<string, Aggregation>;
  grain: DatasetGrain;
}

export interface EditorPalette {
  objetos: PaletteObject[];
  /**
   * Los modulos a los que un salto puede apuntar, de slug a nombre (4.4).
   *
   * Es una lista para ELEGIR, no una comprobacion de acceso: aqui se declara a donde lleva el
   * salto, y quien lo sigue es otra persona con otro ambito. Quien decide si se le ofrece o no es
   * el camino de lectura, cuando alguien abra el modulo.
   *
   * Se ofrecen todos los que existen, incluidos los borradores: un modulo se suele montar junto
   * con el detalle al que salta, y exigir que el destino ya este publicado obligaria a publicar
   * primero y volver despues a declarar el salto.
   */
  modulos: { slug: string; name: string }[];
  /*
   * Los iconos que el editor puede ofrecer.
   *
   * Viajan desde el servidor y no se leen de `OBJECT_ICONS` en el componente porque el panel de
   * administracion puede deshabilitar uno, y una lista escrita en el cliente no se entera. Es la
   * misma razon por la que los objetos deshabilitados salen ya filtrados de aqui.
   */
  iconos: IconName[];
  datasets: PaletteDataset[];
}

export async function editorPalette(): Promise<EditorPalette> {
  /*
   * Lo deshabilitado no se ofrece.
   *
   * `disabledResources` existia, la tabla de recursos lo dibujaba y el boton lo escribia, pero la
   * paleta no lo consultaba: deshabilitar un objeto cambiaba una insignia en el panel y nada mas.
   * Un interruptor que no apaga nada es peor que no tener interruptor, porque quien lo pulsa se
   * queda creyendo que ya esta.
   */
  const deshabilitados = await disabledResources();
  const predeterminados = await defaultPresentations();

  const objetos: PaletteObject[] = objectRegistry
    .list()
    .filter((definicion) => !deshabilitados.has(definicion.objectId))
    .map((definicion) => {
      // La ultima version publicada: un objeto nuevo se coloca en la mas reciente, no en la que
      // estuviera escrita en otro modulo.
      const version = objectRegistry.latest(definicion.objectId);
      if (!version) {
        throw new Error(
          `El objeto '${definicion.objectId}' esta en el catalogo sin ninguna version publicada. ` +
            `Es un fallo del catalogo, no algo que el editor deba dibujar a medias.`,
        );
      }
      return {
        objectId: definicion.objectId,
        icono: definicion.icono,
        ...(definicion.family ? { family: definicion.family } : {}),
        name: definicion.name,
        description: definicion.description,
        category: definicion.category,
        version: version.version,
        attachable: definicion.attachable ?? false,
        dimensiones: version.dataContract.dimensions,
        medidas: version.dataContract.measures,
        presentation: version.presentation,
        wells: version.dataContract.wells ?? [],
        ...(predeterminados[definicion.objectId]
          ? { defaultPresentation: predeterminados[definicion.objectId] }
          : {}),
        ...(version.dataContract.notes ? { notas: version.dataContract.notes } : {}),
      };
    });

  const datasets: PaletteDataset[] = [];
  const declared = await declaredAggregations();
  for (const declarado of defaultRegistry.datasets) {
    /*
     * Un MAPA de nombre a tipo, no un conjunto de nombres.
     */
    const available = new Map(
      (await availableColumnsOf(declarado.datasetId)).map((c) => [c.name, c.type]),
    );
    datasets.push({
      datasetId: declarado.datasetId,
      description: declarado.description,
      dimensiones: (declarado.query.dimensions ?? []).map(fieldKey).filter((c) => available.has(c)),
      medidas: (declarado.query.measures ?? []).filter((m) => available.has(m)),
      kinds: Object.fromEntries(available),
      aggregations: Object.fromEntries(
        (declarado.query.measures ?? [])
          .map((m) => [m, declared.get(m)] as const)
          .filter((pair): pair is [string, Aggregation] => pair[1] !== undefined),
      ),
      grain: declarado.grain,
    });
  }

  // Deshabilitar un icono no retira el que ya esta puesto en un modulo —eso seria romper, no
  // retirar—: deja de ofrecerse para elegir uno nuevo, igual que con los objetos.
  const iconos = OBJECT_ICONS.filter((nombre) => !deshabilitados.has(`${ICON_PREFIX}${nombre}`));

  const modulos = (await modules.list())
    .map((m) => ({ slug: m.slug, name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return { objetos, datasets, iconos, modulos };
}
