'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Aggregation, QueryResult } from '@app/data-contracts';
import { Icon } from './icons/Icon';
import {
  aggregateBy,
  attachmentOf,
  breakdownOf,
  defaultPicker,
  fieldKey,
  paginationLegend,
  projectObject,
  type ObjectInstance,
  type PickerKind,
  type SelectorEfectivo,
} from '@app/ui-components';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useTranslator } from './Locale';
import { FieldPicker } from './FiltersPanel';
import type { ObjectViewChrome } from './ObjectView';

/** Objetos adjuntados — complementos de un objeto, nunca objetos independientes. */

const formatCell = (cell: unknown): string =>
  typeof cell === 'number' ? new Intl.NumberFormat('es-DO').format(cell) : String(cell ?? '');

/** Tooltip explicativo. */
export function TooltipExplicativo({ content, titulo }: { content: string; titulo: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const [sitio, setSitio] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    const clickTo = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', clickTo);
    return () => document.removeEventListener('keydown', clickTo);
  }, [visible]);

  /*
   * El globo se coloca FUERA de la tarjeta que explica.
   */
  useEffect(() => {
    if (!visible) return;

    const colocar = () => {
      const el = button.current;
      const card = el?.closest('.objeto');
      if (!el || !card) return;

      const icono = el.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      const ancho = 260;
      const hole = 12;

      /*
       * Se prefiere el lado que NO cae sobre otra tarjeta.
       */
      const otras = Array.from(document.querySelectorAll('.objeto')).filter((o) => o !== card);
      const tapa = (izquierda: number) =>
        otras.filter((o) => {
          const r = o.getBoundingClientRect();
          return !(izquierda + ancho <= r.left || izquierda >= r.right);
        }).length;

      const derecha = box.right + hole;
      const izquierda = box.left - hole - ancho;
      const rightFits = derecha + ancho <= window.innerWidth;
      const leftFits = izquierda >= 0;

      if (rightFits && leftFits) {
        const elegida = tapa(derecha) <= tapa(izquierda) ? derecha : izquierda;
        setSitio({ top: icono.top, left: elegida });
      } else if (rightFits) {
        setSitio({ top: icono.top, left: derecha });
      } else if (leftFits) {
        setSitio({ top: icono.top, left: izquierda });
      } else {
        // Sin sitio a los lados: debajo de la tarjeta entera, no encima de su contenido.
        setSitio({ top: box.bottom + hole, left: Math.max(hole, box.left) });
      }
    };

    colocar();
    window.addEventListener('scroll', colocar, true);
    window.addEventListener('resize', colocar);
    return () => {
      window.removeEventListener('scroll', colocar, true);
      window.removeEventListener('resize', colocar);
    };
  }, [visible]);

  return (
    <span
      className="complemento"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        ref={button}
        className="addon__icon"
        aria-describedby={visible ? id : undefined}
        aria-label={`Que muestra «${titulo}»`}
        data-testid={`icon-tooltip-${titulo}`}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        // Con el dedo no hay «pasar por encima»: el toque lo abre y lo vuelve a cerrar.
        onClick={() => setVisible((v) => !v)}
      >
        <Icon nombre="informacion" tamano={18} />
      </button>
      {visible ? (
        <span
          role="tooltip"
          id={id}
          className="addon__tooltip"
          data-testid={`tooltip-${titulo}`}
          style={sitio ? { top: `${sitio.top}px`, left: `${sitio.left}px` } : { visibility: 'hidden' }}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

/** Tabla de datos emergente. */
export function DataTable({
  instance,
  result,
  titulo,
  scope,
  aggregations,
}: {
  instance: ObjectInstance;
  result: QueryResult;
  titulo: string;
  scope: 'objeto' | 'subobjeto';
  aggregations: Aggregation[];
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [selection, setSeleccion] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  const close = () => {
    setAbierto(false);
    setSeleccion(null);
  };

  const dimensiones = instance.binding.dimensions;
  const categories =
    scope === 'subobjeto'
      ? aggregateBy(result, dimensiones, instance.binding.measures, aggregations).rows
      : [];

  // Con alcance de objeto se muestran las filas de ORIGEN, sin agregar: lo interesante del
  // emergente es precisamente lo que el objeto no ensena. Con alcance de subobjeto, lo mismo
  // pero acotado a la categoria elegida.
  const dataRows = selection ? breakdownOf(result, selection) : result;
  const projection = projectObject(instance, result, aggregations);

  const selectionLabel = selection ? Object.values(selection).join(' / ') : null;

  return (
    <>
      <button
        type="button"
        className="addon__icon"
        aria-label={`Ver los datos de origen de «${titulo}»`}
        data-testid={`data-table-open-${titulo}`}
        onClick={() => setAbierto(true)}
      >
        <Icon nombre="datos" tamano={18} />
      </button>

      <dialog
        ref={dialogo}
        className="emergente width-popover"
        data-testid={`data-table-${titulo}`}
        aria-label={`Datos de origen de ${titulo}`}
        // Escape y el clic en el fondo cierran el dialogo nativo por su cuenta; sin esto el
        // estado de React se quedaria diciendo que sigue abierto.
        onClose={close}
      >
        <div className="popover__header">
          <h2>Datos de origen — {titulo}</h2>
          <button type="button" className="button-link" onClick={close} data-testid="table-data-close">
            Cerrar
          </button>
        </div>

        {scope === 'subobjeto' && !selection ? (
          <>
            <p className="muted-text">
              Elija una categoria para ver las dataRows que hay detras de su cifra.
            </p>
            <div className="container-table" tabIndex={0} role="region" aria-label="Categorias">
              <table className="tabla">
                <thead>
                  <tr>
                    {projection.columns.map((c) => (
                      <th key={c.name} scope="col">
                        {c.name}
                      </th>
                    ))}
                    <th scope="col">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((categoria) => {
                    const clave = categoria.labels.join(' / ');
                    return (
                      <tr key={clave}>
                        <td>{clave}</td>
                        {categoria.values.map((v, i) => (
                          <td key={i} className="is-number">
                            {formatCell(v)}
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="button-link"
                            data-testid={`drill-${clave}`}
                            onClick={() =>
                              setSeleccion(
                                Object.fromEntries(
                                  dimensiones.map((d, i) => [fieldKey(d), categoria.labels[i] ?? '']),
                                ),
                              )
                            }
                          >
                            Ver dataRows
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="muted-text" data-testid="data-table-resumen">
              {selectionLabel
                ? `${dataRows.rows.length} fila(s) detras de ${selectionLabel}.`
                : `${dataRows.rows.length} fila(s) de origen de este objeto.`}
            </p>
            {selectionLabel ? (
              <button
                type="button"
                className="button-link"
                data-testid="data-table-volver"
                onClick={() => setSeleccion(null)}
              >
                Volver a las categorias
              </button>
            ) : null}
            <div className="container-table" tabIndex={0} role="region" aria-label="Filas de origen">
              <table className="tabla" data-testid="table-data-rows">
                <thead>
                  <tr>
                    {dataRows.columns.map((c) => (
                      <th key={c.name} scope="col">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.rows.map((fila, i) => (
                    <tr key={i}>
                      {fila.map((cell, j) => (
                        <td key={j} className={typeof cell === 'number' ? 'is-number' : ''}>
                          {formatCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

/**
 * Filtro de visualizacion: acota SOLO su anfitrion.
 *
 * Va en un emergente y no suelto en la cabecera por sitio: la tarjeta mas pequena de la rejilla
 * mide cuatro columnas, y un desplegable ahi dentro se come el titulo. El icono dice que el objeto
 * se puede acotar, y se marca cuando ESTA acotado — un filtro puesto que no se ve deja a quien
 * mira leyendo una cifra recortada como si fuera la entera.
 *
 * Los controles son los MISMOS que los del panel de filtros —`FieldPicker`, importado, no
 * copiado—: si tuviera los suyos, elegir un valor se comportaria distinto segun desde donde se
 * eligiera, y nadie lo habria decidido.
 */
export function VisualFilter({
  titulo,
  filtro,
  columnKind,
  tipo,
  opciones,
}: {
  titulo: string;
  filtro: { fieldName: string; valores: string[]; clave: string };
  /** El tipo de la columna, para elegir selector cuando el complemento no lo dice. */
  columnKind: string;
  tipo?: PickerKind;
  opciones: string[];
}) {
  const t = useTranslator();
  const dialogo = useRef<HTMLDialogElement>(null);
  const { toggle, fijar, clearField } = useUrlFilters();
  const puesto = filtro.valores.length > 0;

  const picker: SelectorEfectivo = {
    fieldName: filtro.fieldName,
    tipo: tipo ?? defaultPicker(columnKind),
    etiqueta: filtro.fieldName.split('.').slice(-1)[0] ?? filtro.fieldName,
  };

  return (
    <>
      <button
        type="button"
        className="addon__icon"
        data-puesto={puesto ? 'si' : 'no'}
        aria-label={
          puesto
            ? `Filtrar «${titulo}» — ${filtro.valores.length} valor(es) elegidos`
            : `Filtrar «${titulo}»`
        }
        data-testid={`visual-filter-open-${titulo}`}
        onClick={() => dialogo.current?.showModal()}
      >
        <Icon nombre="filtro" tamano={18} />
      </button>

      <dialog
        ref={dialogo}
        className="emergente"
        aria-label={`Filtrar ${titulo}`}
        data-testid={`visual-filter-${titulo}`}
      >
        <div className="popover__header">
          <h2>Filtrar — {titulo}</h2>
          <button
            type="button"
            className="button-link"
            data-testid="visual-filter-close"
            onClick={() => dialogo.current?.close()}
          >
            {t('action.close')}
          </button>
        </div>

        <p className="muted-text">{t('addon.filter.note')}</p>

        <div data-testid={`visual-filter-picker-${titulo}`}>
          <FieldPicker
            picker={picker}
            opciones={opciones}
            valores={filtro.valores}
            desde=""
            hasta=""
            onAlternar={(valor) => toggle(filtro.clave, valor)}
            onFijar={(valor) => fijar(filtro.clave, valor)}
            /*
              El rango de fechas NO entra aqui, y la validacion lo rechaza antes de guardarlo. Es
              deliberado: `applyVisualFilter` compara por valor, asi que un «desde/hasta» quedaria
              escrito en la URL sin acotar nada — un control que no hace nada es peor que no tenerlo.
            */
            onFijarFecha={() => undefined}
            onLimpiar={() => clearField(filtro.clave)}
          />
        </div>
      </dialog>
    </>
  );
}

/**
 * El selector de pagina y su coletilla.
 *
 * Los botones llevan rotulo ademas de flecha, y el estado dice en que pagina se esta: un par de
 * flechas sueltas no dicen si quedan dos paginas o veinte, que es justamente lo que el paginado
 * existe para decir.
 */
export function Pagination({
  titulo,
  paginado,
}: {
  titulo: string;
  paginado: NonNullable<ObjectViewChrome['paginado']>;
}) {
  const t = useTranslator();
  const { fijar } = useUrlFilters();
  const { vista, clave } = paginado;
  const ir = (pagina: number) => fijar(clave, pagina > 1 ? String(pagina) : '');

  return (
    <div className="object__paginado" data-testid={`pagination-${titulo}`}>
      {paginado.selector ? (
        <div className="paginado__selector">
          <button
            type="button"
            className="boton-contorno"
            disabled={vista.pagina <= 1}
            aria-label={`Pagina anterior de «${titulo}»`}
            data-testid={`pagination-previous-${titulo}`}
            onClick={() => ir(vista.pagina - 1)}
          >
            {t('addon.page.previous')}
          </button>
          <span className="paginado__estado" data-testid={`pagination-state-${titulo}`}>
            Pagina {vista.pagina} de {vista.paginas}
          </span>
          <button
            type="button"
            className="boton-contorno"
            disabled={vista.pagina >= vista.paginas}
            aria-label={`Pagina siguiente de «${titulo}»`}
            data-testid={`pagination-next-${titulo}`}
            onClick={() => ir(vista.pagina + 1)}
          >
            {t('addon.page.next')}
          </button>
        </div>
      ) : null}
      {paginado.coletilla === 'abajo' ? (
        <p className="paginado__coletilla" data-testid={`pagination-legend-${titulo}`}>
          {paginationLegend(vista)}
        </p>
      ) : null}
    </div>
  );
}

/** Los complementos de un objeto, para la cabecera de su marco. */
export function Addons({
  instance,
  result,
  titulo,
  aggregations,
}: {
  instance: ObjectInstance;
  result: QueryResult;
  titulo: string;
  aggregations: Aggregation[];
}) {
  const tooltip = attachmentOf(instance, 'tooltip-explicativo');
  const tabla = attachmentOf(instance, 'tabla-de-datos');

  if (!tooltip && !tabla) return null;

  return (
    <span className="complementos">
      {tooltip ? <TooltipExplicativo content={tooltip.text} titulo={titulo} /> : null}
      {tabla ? (
        <DataTable
          instance={instance}
          result={result}
          titulo={titulo}
          scope={tabla.scope}
          aggregations={aggregations}
        />
      ) : null}
    </span>
  );
}
