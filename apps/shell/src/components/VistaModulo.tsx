'use client';

import { fieldKey, toSlicerOptions } from '@app/ui-components';
import type { QueryResult } from '@app/data-contracts';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
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
}: {
  objetos: ObjetoSerializado[];
  provenance: { isPersonalized: boolean; label: string };
}) {
  const { alternar, limpiarTodo, searchParams } = useFiltrosDeUrl();
  const hayFiltros = [...searchParams.keys()].length > 0;

  const items = objetos.map((o) => ({ id: o.itemId, position: o.position }));

  const porId = new Map(objetos.map((o) => [o.itemId, o]));

  return (
    <>
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
        />
      );
    }
    default:
      return <ObjetoNoDisponible titulo={titulo} objectId={objeto.instance.objectId} />;
  }
}
