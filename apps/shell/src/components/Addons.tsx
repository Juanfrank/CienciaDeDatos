'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Aggregation, QueryResult } from '@app/data-contracts';
import { Icon } from './icons/Icon';
import {
  aggregateBy,
  attachmentOf,
  breakdownOf,
  fieldKey,
  projectObject,
  type ObjectInstance,
} from '@app/ui-components';

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
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
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
      const cabeDerecha = derecha + ancho <= window.innerWidth;
      const cabeIzquierda = izquierda >= 0;

      if (cabeDerecha && cabeIzquierda) {
        const elegida = tapa(derecha) <= tapa(izquierda) ? derecha : izquierda;
        setSitio({ top: icono.top, left: elegida });
      } else if (cabeDerecha) {
        setSitio({ top: icono.top, left: derecha });
      } else if (cabeIzquierda) {
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
  const [seleccion, setSeleccion] = useState<Record<string, string> | null>(null);

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
  const dataRows = seleccion ? breakdownOf(result, seleccion) : result;
  const projection = projectObject(instance, result, aggregations);

  const etiquetaSeleccion = seleccion ? Object.values(seleccion).join(' / ') : null;

  return (
    <>
      <button
        type="button"
        className="addon__icon"
        aria-label={`Ver los datos de origen de «${titulo}»`}
        data-testid={`data-table-abrir-${titulo}`}
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
          <h2>Data de source — {titulo}</h2>
          <button type="button" className="boton-enlace" onClick={close} data-testid="table-data-close">
            Cerrar
          </button>
        </div>

        {scope === 'subobjeto' && !seleccion ? (
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
                            className="boton-enlace"
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
              {etiquetaSeleccion
                ? `${dataRows.rows.length} fila(s) detras de ${etiquetaSeleccion}.`
                : `${dataRows.rows.length} fila(s) de origen de este objeto.`}
            </p>
            {etiquetaSeleccion ? (
              <button
                type="button"
                className="boton-enlace"
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
