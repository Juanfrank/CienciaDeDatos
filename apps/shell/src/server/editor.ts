import type { Agregacion, GranoDeDataset } from '@app/data-contracts';
import { defaultRegistry } from '@app/caching';
import type {
  ClaveDePresentacion,
  NombreDeIcono,
  ObjectCategory,
  PozoDeCampos,
} from '@app/ui-components';
import { fieldKey } from '@app/ui-components';
import { objectRegistry } from './contexto';
import { agregacionesDeclaradas, columnasDisponiblesDe } from './datos';

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
  /** Lo declara el objeto: la tienda y la tarjeta leen del mismo sitio. */
  icono: NombreDeIcono;
  version: string;
  attachable: boolean;
  dimensiones: { min: number; max: number };
  medidas: { min: number; max: number };
  /** Claves de presentacion que ESTA version admite. El editor solo ofrece estas. */
  presentacion: ClaveDePresentacion[];
  /** Ranuras con nombre. Vacio si el objeto no las declara: el editor usa las genericas. */
  pozos: PozoDeCampos[];
  notas?: string;
}

export interface DatasetDePaleta {
  datasetId: string;
  description: string;
  /** Claves 'Tabla.Campo' que este dataset trae y el esquema sigue reconociendo. */
  dimensiones: string[];
  medidas: string[];
  /** Tipo de cada columna. Decide que selectores tienen sentido sobre cada dimension. */
  tipos: Record<string, string>;
  /**
   * Como declara el esquema que se resume cada medida, y a que grano quedaron las filas.
   *
   * Los dos viajan al panel para que el desplegable del chiclet parta del operador DECLARADO y no
   * de `suma`, y para que quien edita vea el grano del dataset que esta eligiendo. El editor no
   * consulta el esquema por su cuenta: llega resuelto, como todo lo demas.
   */
  agregaciones: Record<string, Agregacion>;
  grain: GranoDeDataset;
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
      icono: definicion.icono,
      name: definicion.name,
      description: definicion.description,
      category: definicion.category,
      version: version.version,
      attachable: definicion.attachable ?? false,
      dimensiones: version.dataContract.dimensions,
      medidas: version.dataContract.measures,
      presentacion: version.presentation,
      pozos: version.dataContract.pozos ?? [],
      ...(version.dataContract.notes ? { notas: version.dataContract.notes } : {}),
    };
  });

  const datasets: DatasetDePaleta[] = [];
  const declaradas = await agregacionesDeclaradas();
  for (const declarado of defaultRegistry.datasets) {
    /*
     * Un MAPA de nombre a tipo, no un conjunto de nombres.
     *
     * El tipo hace falta aqui para que el editor pueda ofrecer el selector que corresponde a cada
     * dimension del panel de filtros: un calendario sobre una fecha, pastillas sobre un texto.
     * Preguntarlo al dibujar seria tarde, porque para entonces ya se eligio.
     */
    const disponibles = new Map(
      (await columnasDisponiblesDe(declarado.datasetId)).map((c) => [c.name, c.type]),
    );
    datasets.push({
      datasetId: declarado.datasetId,
      description: declarado.description,
      dimensiones: (declarado.query.dimensions ?? []).map(fieldKey).filter((c) => disponibles.has(c)),
      medidas: (declarado.query.measures ?? []).filter((m) => disponibles.has(m)),
      tipos: Object.fromEntries(disponibles),
      agregaciones: Object.fromEntries(
        (declarado.query.measures ?? [])
          .map((m) => [m, declaradas.get(m)] as const)
          .filter((par): par is [string, Agregacion] => par[1] !== undefined),
      ),
      grain: declarado.grain,
    });
  }

  return { objetos, datasets };
}
