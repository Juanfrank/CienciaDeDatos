'use client';

import { createContext, useContext, useMemo } from 'react';
import type { QueryResult } from '@app/data-contracts';
import {
  applyVisualFilter,
  attachmentOf,
  defaultPicker,
  footerText,
  measureFormatter,
  modesByDefault,
  paginate,
  paginationKey,
  visualFilterKey,
  type PaginationView,
  type PaginationLegend,
  type SelectorEfectivo,
  type ValueCount,
} from '@app/ui-components';
import { drillLinks, type DrillLink } from '@app/module-model';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { estadoDe, valueStats, type EstadoDeCampo } from './fieldFilterState';
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
    /** El selector, ya resuelto: su tipo, su rotulo y que formas de acotar ofrece. */
    picker: SelectorEfectivo;
    /** Los valores del campo con su recuento, del resultado SIN filtrar. */
    valores: ValueCount[];
    estado: EstadoDeCampo;
    /** La clave con la que su estado viaja en la URL. */
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
  /**
   * Los saltos que este objeto ofrece a quien mira, ya convertidos en direcciones (4.4).
   *
   * Solo los que alcanza: la lista de modulos alcanzables la decide el servidor y baja por
   * `DrillTargetsProvider`. Lo que viaja en cada direccion es el CONTEXTO DE FILTROS de ahora
   * mismo, porque en esta aplicacion el estado visible vive en la URL — pulsar una categoria ya la
   * deja escrita como filtro, y un segundo canal para «el valor que se pulso» seria una segunda
   * fuente de verdad sobre lo mismo.
   */
  saltos?: DrillLink[];
}

/**
 * Los modulos a los que los saltos de esta pagina pueden llevar a quien mira, de slug a nombre.
 *
 * Es de la PAGINA y no de cada objeto, asi que va en su propio contexto y lo pone `ModuleView` una
 * sola vez. Vacio por defecto: un objeto dibujado fuera de una vista de modulo —la vista previa
 * del editor— no ofrece saltos, que es lo correcto; ahi no se navega.
 */
const Destinos = createContext<Record<string, string>>({});

export const useDrillTargets = (): Record<string, string> => useContext(Destinos);

export function DrillTargetsProvider({
  value,
  children,
}: {
  value: Record<string, string>;
  children: React.ReactNode;
}) {
  return <Destinos.Provider value={value}>{children}</Destinos.Provider>;
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
  const alcanzables = useDrillTargets();
  const { instance, result, aggregations } = objeto;

  // La dependencia es la CADENA de la query, no el objeto: `useSearchParams` devuelve una
  // instancia nueva en cada render y compararla por identidad recalcularia siempre.
  const query = searchParams.toString();
  // Lo mismo con los destinos: es un objeto que baja por contexto y su identidad cambia en cada
  // dibujo de la vista, asi que la dependencia es su contenido.
  const destinos = JSON.stringify(alcanzables);

  return useMemo(() => {
    const params = new URLSearchParams(query);

    /*
     * Los saltos se calculan ANTES del corte por resultado.
     *
     * Un contenedor o un elemento no tiene `result` y sale por la rama de arriba; si los saltos se
     * calcularan despues, declarar uno sobre un contenedor lo guardaria y no lo dibujaria nunca,
     * que es la forma de fallar que no se nota.
     */
    const actuales: Record<string, string[]> = {};
    for (const clave of new Set(params.keys())) actuales[clave] = params.getAll(clave);
    const saltos = drillLinks(instance, actuales, JSON.parse(destinos) as Record<string, string>);
    const conSaltos = saltos.length > 0 ? { saltos } : {};

    if (!result) return { result, chrome: conSaltos };

    const chrome: ObjectViewChrome = { ...conSaltos };
    let visto = result;

    const filtro = attachmentOf(instance, 'filtro-de-visualizacion');
    if (filtro) {
      const clave = visualFilterKey(instance.instanceId);
      const estado = estadoDe(params, clave);
      const columnKind =
        result.columns.find((c) => c.name === filtro.fieldName)?.type ?? 'string';
      chrome.filtro = {
        picker: {
          fieldName: filtro.fieldName,
          tipo: filtro.tipo ?? defaultPicker(columnKind),
          etiqueta: filtro.fieldName.split('.').slice(-1)[0] ?? filtro.fieldName,
          // Las mismas formas de acotar que en el panel, decididas por el tipo de la columna.
          modos: modesByDefault(columnKind),
          // El filtro de visualizacion es un complemento de UN objeto y no se configura campo a
          // campo, asi que ofrece lo que su tipo admite: avanzado.
          nivel: 'avanzado' as const,
          orden: 'origen',
          recuento: false,
          todos: false,
          plegado: false,
        },
        // Los valores salen del resultado SIN filtrar: calculados sobre lo ya filtrado, elegir uno
        // dejaria una lista de un solo elemento y no habria forma de volver.
        valores: valueStats(result, filtro.fieldName),
        estado,
        clave,
      };
      visto = applyVisualFilter(visto, filtro.fieldName, estado);
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
  }, [instance, result, aggregations, query, destinos]);
}
