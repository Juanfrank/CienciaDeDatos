'use client';

import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { CrearAviso, type ObjetoVigilable } from './CrearAviso';
import { Exportar } from './Exportar';
import { Incrustar } from './Incrustar';
import { InsigniaDeProcedencia } from './InsigniaDeProcedencia';
import { Preguntar } from './Preguntar';
import { Marcadores } from './Marcadores';
import { MiVista } from './MiVista';
import { ObjetoDeModulo } from './ObjetoDeModulo';
import { Rejilla } from './Rejilla';
import type { ObjetoSerializado } from '../server/serializar';

/** Interruptor de la consulta en lenguaje natural (4.9). */
const CONSULTA_VISIBLE = false;

/** Vista de un modulo. */
export function VistaModulo({
  objetos,
  provenance,
  insignias,
  moduleSlug,
  pageSlug,
  incrustado = false,
}: {
  objetos: ObjetoSerializado[];
  provenance: { isPersonalized: boolean; label: string };
  /** Las insignias de procedencia y ambito, ya renderizadas en el servidor. */
  insignias?: React.ReactNode;
  moduleSlug: string;
  pageSlug?: string;
  /** true cuando la vista se dibuja dentro del portal de otra institucion (4.9). */
  incrustado?: boolean;
}) {
  const { alternar, limpiarTodo, searchParams } = useFiltrosDeUrl();
  const hayFiltros = [...searchParams.keys()].length > 0;

  const items = objetos.map((o) => ({ id: o.itemId, position: o.position }));

  // Solo se puede vigilar lo que tiene una cifra. Un segmentador mapea dimensiones y ninguna
  // medida: ofrecerlo daria una alerta que no puede dispararse nunca.
  const vigilables: ObjetoVigilable[] = objetos
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
        Se retira de la pagina, no del repositorio — `CONSULTA_VISIBLE` es lo unico que hay que
        cambiar cuando la funcionalidad este.
      */}
      {CONSULTA_VISIBLE && !incrustado ? <Preguntar moduleSlug={moduleSlug} /> : null}

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
      {incrustado ? null : (
        <div className="barra-modulo">
          {insignias}

          <div className="barra-modulo__acciones" role="toolbar" aria-label="Acciones del modulo">
            <MiVista moduleSlug={moduleSlug} personalizada={provenance.isPersonalized} />
            <Marcadores moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            <Exportar moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            <CrearAviso
              moduleSlug={moduleSlug}
              {...(pageSlug ? { pageSlug } : {})}
              vigilables={vigilables}
            />
            <Incrustar moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
          </div>

          {hayFiltros ? (
            <button
              type="button"
              className="boton-enlace barra-modulo__limpiar"
              data-testid="limpiar-filtros"
              onClick={limpiarTodo}
            >
              Limpiar all los filtros
            </button>
          ) : null}
        </div>
      )}

      {/*
        Dentro de un portal ajeno no hay cabecera de modulo donde ponerla, asi que la procedencia
        se dibuja aqui. Es lo unico de esta barra que sobrevive a la incrustacion: 4.6 pide que se
        sepa siempre si lo que se ve es la vista institucional.
      */}
      {incrustado ? (
        <div className="barra-estado">
          <InsigniaDeProcedencia provenance={provenance} />
        </div>
      ) : null}

      <Rejilla items={items}>
        {(id) => {
          const objeto = byId.get(id);
          if (!objeto) return null;
          return <ObjetoDeModulo objeto={objeto} onFiltrar={alternar} />;
        }}
      </Rejilla>
    </>
  );
}
