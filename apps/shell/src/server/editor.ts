import { defaultRegistry } from '@app/caching';
import type { ObjectCategory } from '@app/ui-components';
import { fieldKey } from '@app/ui-components';
import { objectRegistry } from './contexto';
import { columnasDisponiblesDe } from './datos';

/**
 * Paleta del editor de modulos — seccion 4.2.
 *
 * Dos listas y nada mas: los objetos prediseñados que se pueden colocar, y los campos contra los
 * que se pueden enlazar. Lo que NO hay, y es el punto de la seccion, es una caja de texto donde
 * escribir una consulta: "los objetos se enlazan UNICAMENTE contra IDataConnector, nunca contra
 * una fuente ad hoc", que en esta arquitectura significa contra un datasetId del registro.
 *
 * Los campos salen del registro de datasets intersecado con el esquema que el job dejo en el
 * cache. Ni el editor ni ninguna otra parte del proceso web invoca al conector (principio 2).
 */

export interface ObjetoDePaleta {
  objectId: string;
  name: string;
  description: string;
  category: ObjectCategory;
  version: string;
  attachable: boolean;
  dimensiones: { min: number; max: number };
  medidas: { min: number; max: number };
  notas?: string;
}

export interface DatasetDePaleta {
  datasetId: string;
  description: string;
  /** Claves 'Tabla.Campo' que este dataset trae y el esquema sigue reconociendo. */
  dimensiones: string[];
  medidas: string[];
}

export interface PaletaDelEditor {
  objetos: ObjetoDePaleta[];
  datasets: DatasetDePaleta[];
}

export async function paletaDelEditor(): Promise<PaletaDelEditor> {
  const objetos: ObjetoDePaleta[] = objectRegistry.list().map((definicion) => {
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
      name: definicion.name,
      description: definicion.description,
      category: definicion.category,
      version: version.version,
      attachable: definicion.attachable ?? false,
      dimensiones: version.dataContract.dimensions,
      medidas: version.dataContract.measures,
      ...(version.dataContract.notes ? { notas: version.dataContract.notes } : {}),
    };
  });

  const datasets: DatasetDePaleta[] = [];
  for (const declarado of defaultRegistry.datasets) {
    const disponibles = new Set(await columnasDisponiblesDe(declarado.datasetId));
    datasets.push({
      datasetId: declarado.datasetId,
      description: declarado.description,
      dimensiones: (declarado.query.dimensions ?? []).map(fieldKey).filter((c) => disponibles.has(c)),
      medidas: (declarado.query.measures ?? []).filter((m) => disponibles.has(m)),
    });
  }

  return { objetos, datasets };
}
