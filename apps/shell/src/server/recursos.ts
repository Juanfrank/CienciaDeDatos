import { initialCatalog } from '@app/ui-components';
import type { ObjectCategory } from '@app/ui-components';
import type { ResourceRow } from '../components/admin/ResourceList';
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

/** Cuantas instancias de cada objeto hay colocadas hoy, por todos los modulos. */
async function usesByObject(): Promise<Map<string, number>> {
  const cuenta = new Map<string, number>();
  for (const modulo of await modules.list()) {
    for (const pagina of modulo.pages) {
      for (const item of pagina.items) {
        cuenta.set(item.instance.objectId, (cuenta.get(item.instance.objectId) ?? 0) + 1);
      }
    }
  }
  return cuenta;
}

export async function resourcesOf(familia: Familia): Promise<ResourceRow[]> {
  const categorias = FAMILIAS[familia] as readonly ObjectCategory[];
  const usos = await usesByObject();

  return initialCatalog
    .filter((o) => categorias.includes(o.category))
    .map((o) => {
      const ultima = o.versions[o.versions.length - 1];
      return {
        id: o.objectId,
        name: o.name,
        description: o.description,
        current: ultima?.version ?? '—',
        uses: usos.get(o.objectId) ?? 0,
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
