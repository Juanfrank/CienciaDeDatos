'use client';

import { fieldKey, toSlicerOptions } from '@app/ui-components';
import type { QueryResult } from '@app/data-contracts';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { CrearAviso, type ObjetoVigilable } from './CrearAviso';
import { Exportar } from './Exportar';
import { Incrustar } from './Incrustar';
import { Preguntar } from './Preguntar';
import { Marcadores } from './Marcadores';
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
 * Vista de un modulo.
 *
 * Recibe objetos YA cargados y YA filtrados en el servidor. Este componente no pide datos ni
 * conoce el cache: solo decide que objeto dibuja cada instancia y propaga el filtrado cruzado.
 */
export function VistaModulo({
  objetos,
  provenance,
  moduleSlug,
  pageSlug,
  incrustado = false,
}: {
  objetos: ObjetoSerializado[];
  provenance: { isPersonalized: boolean; label: string };
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
      {incrustado ? null : <Preguntar moduleSlug={moduleSlug} />}

      <div className="barra-estado">
        <span
          className={`insignia ${provenance.isPersonalized ? 'insignia--personalizada' : 'insignia--oficial'}`}
          data-testid="procedencia"
        >
          {provenance.label}
        </span>
        {hayFiltros ? (
          <button type="button" className="boton-enlace" data-testid="limpiar-filtros" onClick={limpiarTodo}>
            Limpiar todos los filtros
          </button>
        ) : null}
        {incrustado ? null : (
          <>
            <Marcadores moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            <Exportar
              moduleSlug={moduleSlug}
              {...(pageSlug ? { pageSlug } : {})}
              isPersonalized={provenance.isPersonalized}
            />
            <CrearAviso
              moduleSlug={moduleSlug}
              {...(pageSlug ? { pageSlug } : {})}
              vigilables={vigilables}
            />
            <Incrustar moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
          </>
        )}
      </div>

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
