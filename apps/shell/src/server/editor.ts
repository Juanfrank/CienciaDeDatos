import type { Agregacion, GranoDeDataset } from '@app/data-contracts';
import { defaultRegistry } from '@app/caching';
import type {
  ClaveDePresentacion,
  FamiliaDeObjeto,
  NombreDeIcono,
  ObjectCategory,
  PozoDeCampos,
} from '@app/ui-components';
import { fieldKey } from '@app/ui-components';
import { objectRegistry } from './contexto';
import { agregacionesDeclaradas, columnasDisponiblesDe } from './datos';

/** Paleta del editor de modulos — seccion 4.2. */

export interface ObjetoDePaleta {
  objectId: string;
  name: string;
  description: string;
  category: ObjectCategory;
  /** Lo declara el objeto: la tienda y la tarjeta leen del mismo sitio. */
  icono: NombreDeIcono;
  /** A que pregunta responde. La paleta agrupa por esto; los elementos no la traen. */
  family?: FamiliaDeObjeto;
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
  /** Como declara el esquema que se resume cada medida, y a que grano quedaron las filas. */
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
      ...(definicion.family ? { family: definicion.family } : {}),
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
