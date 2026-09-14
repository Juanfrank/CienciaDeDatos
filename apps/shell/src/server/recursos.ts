import { initialCatalog, latestVersion } from '@app/ui-components';
import type { ObjectCategory } from '@app/ui-components';
import type { ModuleDefinition } from '@app/module-model';
import type { ResourceRow } from '../components/admin/ResourceList';
import { disabledResources } from './catalogo';
import { modules } from './moduleStore';

/**
 * Los recursos que un modulo puede colocar, leidos del repositorio de objetos.
 *
 * No hay un registro aparte para administrarlos: el catalogo YA es el registro, con sus versiones,
 * su changelog y su politica de retirada (4.5). Un segundo registro seria una segunda lista que
 * describe lo mismo, y acabaria discrepando.
 */

/** Las familias del panel, y que categorias del catalogo caen en cada una. */
export const FAMILIAS = {
  visualizaciones: ['grafico', 'tabla', 'indicador', 'filtro', 'mapa'],
  elementos: ['elemento'],
  contenedores: ['contenedor'],
  complementos: ['complemento'],
} as const satisfies Record<string, readonly ObjectCategory[]>;

export type Familia = keyof typeof FAMILIAS;

/**
 * Donde esta colocado cada objeto, por modulo y por VERSION.
 *
 * El contador de antes decia «12 usos» y ahi se acababa. Con eso no se puede decidir nada: doce
 * usos repartidos entre dos modulos que ya corren la ultima version no son lo mismo que doce en
 * nueve modulos anclados a una version que se retira el mes que viene, y la pantalla los dibujaba
 * igual. Retirar algo sin saber quien lo usa es apagar una luz sin mirar quien esta en la sala.
 */
export interface UsoEnModulo {
  moduleId: string;
  slug: string;
  name: string;
  status: ModuleDefinition['status'];
  /** Version del objeto que fija ESTE modulo, y cuantas instancias tiene de ella. */
  version: string;
  instancias: number;
  /** Si la version que fija ya no es la ultima publicada. */
  atrasada: boolean;
}

export interface UsoDeObjeto {
  total: number;
  /** Cuantos modulos distintos, que es lo que se lee en la tabla. */
  modulos: number;
  /** Cuantos estan anclados a una version que no es la ultima. */
  atrasados: number;
  detalle: UsoEnModulo[];
}

/** Todas las instancias de todos los modulos, agrupadas por objeto y version. */
export async function usoPorObjeto(): Promise<Map<string, UsoDeObjeto>> {
  const ultimaDe = new Map(
    initialCatalog.map((o) => [o.objectId, latestVersion(o) ?? ''] as const),
  );
  const porObjeto = new Map<string, Map<string, UsoEnModulo>>();

  for (const modulo of await modules.list()) {
    for (const pagina of modulo.pages) {
      for (const item of pagina.items) {
        const { objectId, version } = item.instance;
        const porVersion = porObjeto.get(objectId) ?? new Map<string, UsoEnModulo>();
        // La clave es modulo + version: un mismo modulo puede tener dos instancias del mismo
        // objeto ancladas a versiones distintas, y esa es justo la fila que hay que ver.
        const clave = `${modulo.moduleId}@${version}`;
        const previo = porVersion.get(clave);
        porVersion.set(clave, {
          moduleId: modulo.moduleId,
          slug: modulo.slug,
          name: modulo.name,
          status: modulo.status,
          version,
          instancias: (previo?.instancias ?? 0) + 1,
          atrasada: version !== ultimaDe.get(objectId),
        });
        porObjeto.set(objectId, porVersion);
      }
    }
  }

  return new Map(
    [...porObjeto].map(([objectId, porVersion]) => {
      const detalle = [...porVersion.values()].sort(
        (a, b) => a.name.localeCompare(b.name, 'es') || a.version.localeCompare(b.version),
      );
      return [
        objectId,
        {
          total: detalle.reduce((n, d) => n + d.instancias, 0),
          modulos: new Set(detalle.map((d) => d.moduleId)).size,
          atrasados: new Set(detalle.filter((d) => d.atrasada).map((d) => d.moduleId)).size,
          detalle,
        },
      ];
    }),
  );
}

export async function resourcesOf(familia: Familia): Promise<ResourceRow[]> {
  const categorias = FAMILIAS[familia] as readonly ObjectCategory[];
  const [usos, deshabilitados] = await Promise.all([usoPorObjeto(), disabledResources()]);

  return initialCatalog
    .filter((o) => categorias.includes(o.category))
    .map((o) => {
      const ultima = o.versions[o.versions.length - 1];
      return {
        id: o.objectId,
        name: o.name,
        description: o.description,
        current: ultima?.version ?? '—',
        uses: usos.get(o.objectId)?.total ?? 0,
        modulos: usos.get(o.objectId)?.modulos ?? 0,
        atrasados: usos.get(o.objectId)?.atrasados ?? 0,
        ...(deshabilitados.has(o.objectId) ? { disabled: true } : {}),
        versions: o.versions.map((v) => ({
          version: v.version,
          publishedAt: v.publishedAt,
          changelog: v.changelog,
          reviewedBy: v.certification.reviewedBy,
          ...(v.deprecation
            ? {
                deprecation: {
                  since: v.deprecation.removeAfter,
                  reason: v.deprecation.reason,
                  ...(v.deprecation.replacedBy ? { replacement: v.deprecation.replacedBy } : {}),
                },
              }
            : {}),
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Un recurso concreto con su uso, para la pantalla de «donde se usa». */
export async function usoDe(objectId: string): Promise<{
  objeto: (typeof initialCatalog)[number];
  ultima: string;
  uso: UsoDeObjeto;
} | null> {
  const objeto = initialCatalog.find((o) => o.objectId === objectId);
  if (!objeto) return null;
  const uso = (await usoPorObjeto()).get(objectId);
  return {
    objeto,
    ultima: latestVersion(objeto) ?? '',
    uso: uso ?? { total: 0, modulos: 0, atrasados: 0, detalle: [] },
  };
}

/**
 * La vuelta del uso: que objetos tiene UN modulo, y con que version cada uno.
 *
 * `usoPorObjeto` responde «donde esta este objeto»; esta responde «que hay dentro de este modulo».
 * Son la misma informacion leida por el otro extremo, y hacen falta las dos porque las dos
 * preguntas se hacen desde pantallas distintas: una desde el catalogo, al ir a retirar algo, y
 * otra desde la lista de modulos, al preguntarse por que uno no se parece a los demas.
 */
export interface ObjetoEnModulo {
  objectId: string;
  /** El nombre del catalogo, no el titulo que le puso quien lo coloco. */
  name: string;
  category: ObjectCategory;
  version: string;
  ultima: string;
  atrasada: boolean;
  instancias: number;
  /** Si el objeto ya no esta en el catalogo: la version fijada no se puede resolver. */
  desconocido: boolean;
}

export function objectsOfModule(modulo: ModuleDefinition): ObjetoEnModulo[] {
  const porClave = new Map<string, ObjetoEnModulo>();

  for (const pagina of modulo.pages) {
    for (const item of pagina.items) {
      const { objectId, version } = item.instance;
      const clave = `${objectId}@${version}`;
      const previo = porClave.get(clave);
      if (previo) {
        porClave.set(clave, { ...previo, instancias: previo.instancias + 1 });
        continue;
      }
      const definicion = initialCatalog.find((o) => o.objectId === objectId);
      const ultima = definicion ? (latestVersion(definicion) ?? '') : '';
      porClave.set(clave, {
        objectId,
        name: definicion?.name ?? objectId,
        // Un objeto que ya no esta en el catalogo no tiene categoria; se le da la mas neutra para
        // que la fila se pueda dibujar, y `desconocido` es lo que dice la verdad.
        category: definicion?.category ?? 'elemento',
        version,
        ultima,
        // Sin definicion no se puede saber si esta atrasada, y decir que si seria ofrecer un
        // «subir a la ultima» que no lleva a ninguna parte.
        atrasada: definicion !== undefined && version !== ultima,
        instancias: 1,
        desconocido: definicion === undefined,
      });
    }
  }

  return [...porClave.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'es') || a.version.localeCompare(b.version),
  );
}
