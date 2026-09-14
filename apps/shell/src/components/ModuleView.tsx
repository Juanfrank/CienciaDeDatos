'use client';

import { useUrlFilters } from '../hooks/useUrlFilters';
import { CreateNotice, type WatchableObject } from './CreateNotice';
import { Export } from './Export';
import { Embed } from './Embed';
import { ProvenanceBadge } from './ProvenanceBadge';
import { Ask } from './Ask';
import { Bookmarks } from './Bookmarks';
import { MyView } from './MyView';
import { ModuleObject } from './ModuleObject';
import { Grid } from './Grid';
import type { SerializedObject } from '../server/serialize';

/** Interruptor de la consulta en lenguaje natural (4.9). */
const VISIBLE_QUERY = false;

/** Vista de un modulo. */
export function ModuleView({
  objetos,
  provenance,
  insignias,
  moduleSlug,
  pageSlug,
  embedded = false,
}: {
  objetos: SerializedObject[];
  provenance: { isPersonalized: boolean; label: string };
  /** Las insignias de procedencia y ambito, ya renderizadas en el servidor. */
  insignias?: React.ReactNode;
  moduleSlug: string;
  pageSlug?: string;
  /** true cuando la vista se dibuja dentro del portal de otra institucion (4.9). */
  embedded?: boolean;
}) {
  const { toggle, clearAll, searchParams } = useUrlFilters();
  const filtersHas = [...searchParams.keys()].length > 0;

  const items = objetos.map((o) => ({ id: o.itemId, position: o.position }));

  // Solo se puede vigilar lo que tiene una cifra. Un segmentador mapea dimensiones y ninguna
  // medida: ofrecerlo daria una alerta que no puede dispararse nunca.
  const vigilables: WatchableObject[] = objetos
    .filter((o) => o.instance.binding.measures.length > 0 && o.result)
    .map((o) => ({
      instanceId: o.instance.instanceId,
      titulo: o.titulo,
      measures: o.instance.binding.measures,
    }));

  const byId = new Map(objetos.map((o) => [o.itemId, o]));

  return (
    <>
      {/*
        La consulta en lenguaje natural queda FUERA de la vista mientras no responda de verdad.

        El campo esta construido y su ruta funciona, pero lo que devuelve todavia no es una
        respuesta util, y un campo de busqueda visible es una promesa: quien lo ve escribe en el.
        Se retira de la pagina, no del repositorio — `VISIBLE_QUERY` es lo unico que hay que
        cambiar cuando la funcionalidad este.
      */}
      {VISIBLE_QUERY && !embedded ? <Ask moduleSlug={moduleSlug} /> : null}

      {/*
        Una sola fila: de donde salen los datos, y que se puede hacer con ellos.

        Las insignias dicen que se esta viendo y los iconos que se puede hacer con ello. Estaban
        en dos lineas seguidas, cada una con su propio ritmo vertical, para tres elementos y cinco
        botones; en una sola fila con la divisoria debajo se lee como lo que es, la cabecera de
        los datos.

        `role="toolbar"` envuelve SOLO los botones, no las insignias: una barra de herramientas se
        anuncia por su numero de elementos, y meter dentro dos etiquetas que no se pulsan la
        convierte en un grupo de siete cosas de las que dos no hacen nada.
      */}
      {embedded ? null : (
        <div className="module-bar">
          {insignias}

          <div className="module-bar__actions" role="toolbar" aria-label="Acciones del modulo">
            <MyView moduleSlug={moduleSlug} personalizada={provenance.isPersonalized} />
            <Bookmarks moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            <Export moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            <CreateNotice
              moduleSlug={moduleSlug}
              {...(pageSlug ? { pageSlug } : {})}
              vigilables={vigilables}
            />
            <Embed moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
          </div>

          {filtersHas ? (
            <button
              type="button"
              className="boton-enlace module-bar__clear"
              data-testid="clear-filters"
              onClick={clearAll}
            >
              Limpiar todos los filtros
            </button>
          ) : null}
        </div>
      )}

      {/*
        Dentro de un portal ajeno no hay cabecera de modulo donde ponerla, asi que la procedencia
        se dibuja aqui. Es lo unico de esta barra que sobrevive a la incrustacion: 4.6 pide que se
        sepa siempre si lo que se ve es la vista institucional.
      */}
      {embedded ? (
        <div className="status-bar">
          <ProvenanceBadge provenance={provenance} />
        </div>
      ) : null}

      <Grid items={items}>
        {(id) => {
          const objeto = byId.get(id);
          if (!objeto) return null;
          return <ModuleObject objeto={objeto} onFiltrar={toggle} />;
        }}
      </Grid>
    </>
  );
}
