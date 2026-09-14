'use client';

import { createContext, useContext, useMemo } from 'react';
import type { QueryResult } from '@app/data-contracts';
import {
  applyVisualFilter,
  attachmentOf,
  footerText,
  measureFormatter,
  paginate,
  paginationKey,
  visualFilterKey,
  visualFilterOptions,
  type PaginationView,
  type PaginationLegend,
} from '@app/ui-components';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { SerializedObject } from '../server/serialize';

/**
 * Lo que los tres complementos de vista anaden alrededor de un objeto.
 *
 * Se calcula UNA VEZ, en `ModuleObject`, y viaja por contexto en vez de por propiedades. No es
 * comodidad: el marco comun —`Frame`— lo dibuja cualquiera de los dieciseis renderizadores, y
 * pasarlo de mano en mano significaria tocarlos todos y confiar en que ninguno se olvide. Por
 * contexto, un objeto nuevo hereda los complementos por el hecho de usar el marco.
 *
 * El contexto se declara con valor vacio a proposito: un objeto dibujado fuera de `ModuleObject`
 * —la vista previa del editor, por ejemplo— no se rompe, sencillamente no tiene complementos.
 */
export interface ObjectViewChrome {
  filtro?: {
    fieldName: string;
    opciones: string[];
    valores: string[];
    clave: string;
  };
  paginado?: {
    vista: PaginationView;
    selector: boolean;
    coletilla: PaginationLegend;
    clave: string;
  };
  /** El pie, con sus referencias `{{n}}` ya resueltas. */
  pie?: string;
}

const Contexto = createContext<ObjectViewChrome>({});

export const useObjectChrome = (): ObjectViewChrome => useContext(Contexto);

export function ObjectChromeProvider({
  value,
  children,
}: {
  value: ObjectViewChrome;
  children: React.ReactNode;
}) {
  return <Contexto.Provider value={value}>{children}</Contexto.Provider>;
}

/**
 * El resultado que el objeto tiene que dibujar, y el cromo que lo acompana.
 *
 * El ORDEN importa y es el unico que no miente: primero se filtra y despues se pagina. Al reves,
 * la pagina 3 de un objeto se quedaria vacia al filtrar y el selector seguiria diciendo que hay
 * cinco paginas.
 *
 * El pie se resuelve sobre lo filtrado pero SIN paginar: un «Total: 1.234» que cambiara al pasar
 * de pagina no es un total, y contradiria a la coletilla que tiene justo al lado.
 */
export function useObjectView(objeto: SerializedObject): {
  result: QueryResult | undefined;
  chrome: ObjectViewChrome;
} {
  const { searchParams } = useUrlFilters();
  const { instance, result, aggregations } = objeto;

  // La dependencia es la CADENA de la query, no el objeto: `useSearchParams` devuelve una
  // instancia nueva en cada render y compararla por identidad recalcularia siempre.
  const query = searchParams.toString();

  return useMemo(() => {
    if (!result) return { result, chrome: {} };

    const chrome: ObjectViewChrome = {};
    let visto = result;

    const params = new URLSearchParams(query);

    const filtro = attachmentOf(instance, 'filtro-de-visualizacion');
    if (filtro) {
      const clave = visualFilterKey(instance.instanceId);
      const valores = params.getAll(clave);
      chrome.filtro = {
        fieldName: filtro.fieldName,
        // Las opciones salen del resultado SIN filtrar: calculadas sobre lo ya filtrado, elegir
        // un valor dejaria una lista de un solo elemento y no habria forma de volver.
        opciones: visualFilterOptions(result, filtro.fieldName),
        valores,
        clave,
      };
      visto = applyVisualFilter(visto, filtro.fieldName, valores);
    }

    const pie = attachmentOf(instance, 'pie-de-pagina');
    if (pie) {
      chrome.pie = footerText(pie.texto, instance, visto, aggregations, (medida, valor) =>
        valor === null ? '—' : measureFormatter(instance.presentacion, medida)(valor),
      );
    }

    const paginado = attachmentOf(instance, 'paginado');
    if (paginado) {
      const clave = paginationKey(instance.instanceId);
      const pedida = Number(params.get(clave) ?? '1');
      const { result: pagina, vista } = paginate(
        visto,
        instance.binding.dimensions,
        paginado.porPagina,
        Number.isFinite(pedida) ? pedida : 1,
      );
      visto = pagina;
      chrome.paginado = {
        vista,
        selector: paginado.selector !== false,
        coletilla: paginado.coletilla ?? 'ninguna',
        clave,
      };
    }

    return { result: visto, chrome };
  }, [instance, result, aggregations, query]);
}
