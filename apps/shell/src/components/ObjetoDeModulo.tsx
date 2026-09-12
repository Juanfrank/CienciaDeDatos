'use client';

import type { QueryResult } from '@app/data-contracts';
import { fieldKey, toSlicerOptions } from '@app/ui-components';
import { PanelDeFiltros } from './PanelDeFiltros';
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
 * Que componente dibuja cada instancia.
 *
 * Vivia dentro de `VistaModulo` y sale de ahi para que el LIENZO DEL EDITOR use exactamente este
 * mismo codigo. Es lo que hace que la vista previa sea fiel: si el editor tuviera su propia
 * version, las dos divergirian en cuanto alguien anadiera un tipo de objeto —y el primero en
 * notarlo seria quien publicara algo que no se parece a lo que vio—.
 */

export function ObjetoDeModulo({
  objeto,
  onFiltrar,
}: {
  objeto: ObjetoSerializado;
  /**
   * Opcional a proposito: en la vista previa del editor no hay filtrado cruzado.
   *
   * Alli el bloque entero es un boton de seleccion, asi que un objeto que ademas filtrara haria
   * dos cosas distintas con el mismo gesto. Sin este callback, los objetos se dibujan igual pero
   * no ofrecen filtrar — que es justo lo que corresponde a una vista previa.
   */
  onFiltrar?: (campo: string, valor: string) => void;
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
  const props = {
    titulo,
    result,
    instance: objeto.instance,
    // Los objetos esperan un `onFiltrar`; sin filtrado cruzado se les pasa uno que no hace nada,
    // y ellos deciden no ofrecer el gesto por su cuenta cuando no hay dimension.
    onFiltrar: onFiltrar ?? (() => {}),
  };

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
