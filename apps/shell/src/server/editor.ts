import type { Aggregation, DatasetGrain } from '@app/data-contracts';
import { defaultRegistry } from '@app/caching';
import type {
  PresentationKey,
  ObjectFamily,
  IconName,
  ObjectCategory,
  FieldWell,
} from '@app/ui-components';
import { fieldKey } from '@app/ui-components';
import { objectRegistry } from './context';
import { declaredAggregations, columnasDisponiblesDe } from './data';

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
  presentacion: PresentationKey[];
  /** Ranuras con nombre. Vacio si el objeto no las declara: el editor usa las genericas. */
  wells: FieldWell[];
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
  datasets: PaletteDataset[];
}

export async function editorPalette(): Promise<EditorPalette> {
  const objetos: PaletteObject[] = objectRegistry.list().map((definicion) => {
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
      presentacion: version.presentation,
      wells: version.dataContract.wells ?? [],
      ...(version.dataContract.notes ? { notas: version.dataContract.notes } : {}),
    };
  });

  const datasets: PaletteDataset[] = [];
  const declared = await declaredAggregations();
  for (const declarado of defaultRegistry.datasets) {
    /*
     * Un MAPA de nombre a tipo, no un conjunto de nombres.
     */
    const disponibles = new Map(
      (await columnasDisponiblesDe(declarado.datasetId)).map((c) => [c.name, c.type]),
    );
    datasets.push({
      datasetId: declarado.datasetId,
      description: declarado.description,
      dimensiones: (declarado.query.dimensions ?? []).map(fieldKey).filter((c) => disponibles.has(c)),
      medidas: (declarado.query.measures ?? []).filter((m) => disponibles.has(m)),
      kinds: Object.fromEntries(disponibles),
      aggregations: Object.fromEntries(
        (declarado.query.measures ?? [])
          .map((m) => [m, declared.get(m)] as const)
          .filter((pair): pair is [string, Aggregation] => pair[1] !== undefined),
      ),
      grain: declarado.grain,
    });
  }

  return { objetos, datasets };
}
