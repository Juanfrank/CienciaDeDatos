'use client';

import { fieldKey, toSlicerOptions } from '@app/ui-components';
import type { QueryResult } from '@app/data-contracts';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { CrearAviso, type ObjetoVigilable } from './CrearAviso';
import { Exportar } from './Exportar';
import { Incrustar } from './Incrustar';
import { InsigniaDeProcedencia } from './InsigniaDeProcedencia';
import { Preguntar } from './Preguntar';
import { Marcadores } from './Marcadores';
import { PanelDeFiltros } from './PanelDeFiltros';
import { MiVista } from './MiVista';
import { Rejilla } from './Rejilla';
import { Segmentador } from './Segmentador';
import {
  Barras,
  Lineas,
  Matriz,
  ObjetoGenerandose,
  ObjetoNoDisponible,
  ObjetoRoto,
  Tabla,
  TarjetaKpi,
} from './objetos';
import type { ObjetoSerializado } from '../server/serializar';

/**
 * Interruptor de la consulta en lenguaje natural (4.9).
 *
 * Una constante y no una variable de entorno a proposito: no es algo que se configure por
 * despliegue, es una funcionalidad a medio hacer. Cuando responda, esto pasa a `true` y se borra.
 */
const CONSULTA_VISIBLE = false;

/**
 * Vista de un modulo.
 *
 * Recibe objetos YA cargados y YA filtrados en el servidor. Este componente no pide datos ni
 * conoce el cache: solo decide que objeto dibuja cada instancia y propaga el filtrado cruzado.
 */
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
  /**
   * Las insignias de procedencia y ambito, ya renderizadas en el servidor.
   *
   * Llegan como prop y no se construyen aqui porque salen de datos que solo tiene la pagina —el
   * ambito efectivo con el que se cargo el modulo—, y porque asi comparten fila con los iconos
   * sin que este componente tenga que saber calcularlas. Next permite pasar JSX del servidor a un
   * componente de cliente: lo que viaja es el arbol ya pintado, no el codigo que lo pinta.
   */
  insignias?: React.ReactNode;
  moduleSlug: string;
  pageSlug?: string;
  /**
   * true cuando la vista se dibuja dentro del portal de otra institucion (4.9).
   *
   * Oculta los controles que sacan de la vista o escriben —marcadores, exportar, avisarme—:
   * dentro de un iframe de 640 pixeles no llevan a ningun sitio util. Lo que SI se conserva es
   * la insignia de procedencia (4.6) y el filtrado cruzado, que se queda dentro del marco
   * porque vive en la query string.
   */
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

  const porId = new Map(objetos.map((o) => [o.itemId, o]));

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
      {incrustado ? (
        <div className="barra-estado">
          <InsigniaDeProcedencia provenance={provenance} />
        </div>
      ) : null}

      <Rejilla items={items}>
        {(id) => {
          const objeto = porId.get(id);
          if (!objeto) return null;
          return <Objeto objeto={objeto} onFiltrar={alternar} />;
        }}
      </Rejilla>
    </>
  );
}

function Objeto({
  objeto,
  onFiltrar,
}: {
  objeto: ObjetoSerializado;
  onFiltrar: (campo: string, valor: string) => void;
}) {
  const titulo = objeto.titulo;

  if (objeto.unresolvedObject || objeto.problems.length > 0) {
    return (
      <ObjetoRoto
        titulo={titulo}
        problems={objeto.problems}
        {...(objeto.unresolvedObject ? { unresolvedObject: objeto.unresolvedObject } : {})}
      />
    );
  }

  if (!objeto.result) return <ObjetoGenerandose titulo={titulo} />;

  const result = objeto.result as QueryResult;
  const props = { titulo, result, instance: objeto.instance, onFiltrar };

  switch (objeto.instance.objectId) {
    case 'tarjeta-kpi':
      return <TarjetaKpi {...props} />;
    case 'barras':
      return <Barras {...props} />;
    case 'lineas':
      return <Lineas {...props} />;
    case 'tabla':
      return <Tabla {...props} />;
    case 'matriz':
      return <Matriz {...props} />;
    case 'panel-de-filtros':
      return <PanelDeFiltros titulo={titulo} instance={objeto.instance} result={result} />;
    case 'segmentador': {
      const dimension = objeto.instance.binding.dimensions[0];
      if (!dimension) return <ObjetoRoto titulo={titulo} problems={[]} />;
      return (
        <Segmentador
          titulo={titulo}
          campo={fieldKey(dimension)}
          opciones={toSlicerOptions(result, dimension)}
          instance={objeto.instance}
          result={result}
        />
      );
    }
    default:
      return <ObjetoNoDisponible titulo={titulo} objectId={objeto.instance.objectId} />;
  }
}
