'use client';

import { useMemo, useState } from 'react';
import type { QueryResult } from '@app/data-contracts';
import {
  type Direction,
  type ConditionalFormat,
  conditionalColor,
  compareValues,
  estiloDeTexto,
} from '@app/ui-components';

/** Una tabla que se ordena pulsando su encabezado. */

/** Texto o cifra, cada uno con su comparacion. Mezclarlos ordena por la representacion, no por el valor. */
const compare = (a: unknown, b: unknown, direction: Direction): number => {
  if (typeof a === 'number' || typeof b === 'number') {
    return compareValues(
      typeof a === 'number' ? a : null,
      typeof b === 'number' ? b : null,
      direction,
    );
  }
  const cmp = String(a ?? '').localeCompare(String(b ?? ''), 'es');
  return direction === 'asc' ? cmp : -cmp;
};

export function SortableTable({
  projected,
  titulo,
  formatColumn,
  condicional,
}: {
  projected: QueryResult;
  titulo: string;
  /** Un formateador POR COLUMNA: cada medida puede tener el suyo. */
  formatColumn: (nombre: string) => (n: number | null) => string;
  /** Reglas de color por valor. La celda que se sale es lo que se busca en una tabla. */
  condicional?: ConditionalFormat;
}) {
  const [orden, setOrden] = useState<{ column: number; direction: Direction } | null>(null);

  // Se resuelve una vez por columna y no por celda: en una tabla larga son miles de llamadas.
  const formateadores = useMemo(
    () => projected.columns.map((c) => formatColumn(c.name)),
    [projected.columns, formatColumn],
  );

  const dataRows = useMemo(() => {
    if (!orden) return projected.rows;
    // Copia antes de ordenar: `sort` muta, y `proyectado.rows` viene del servidor por referencia.
    return [...projected.rows].sort((a, b) =>
      compare(a[orden.column], b[orden.column], orden.direction),
    );
  }, [projected.rows, orden]);

  const alPulsar = (column: number) =>
    setOrden((o) =>
      o?.column === column
        ? { column, direction: o.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' },
    );

  return (
    <div className="container-table" tabIndex={0} role="region" aria-label={titulo}>
      <table className="tabla" data-testid="tabla">
        <thead>
          <tr>
            {projected.columns.map((c, i) => {
              const activa = orden?.column === i;
              return (
                <th
                  key={c.name}
                  scope="col"
                  // `aria-sort` es donde un lector de pantalla busca el estado del orden. Va en la
                  // celda y no en el boton: el criterio lo pide sobre el encabezado.
                  aria-sort={activa ? (orden.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="table__sort"
                    data-testid={`sort-${c.name}`}
                    onClick={() => alPulsar(i)}
                  >
                    <span>{c.name}</span>
                    <span className="table__flecha" aria-hidden="true">
                      {activa ? (orden.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((fila, i) => (
            <tr key={i}>
              {fila.map((cell, j) => {
                const isFigure = typeof cell === 'number';
                /*
                 * El color se calcula POR CELDA, que es el unico sitio donde se puede: depende del
                 * valor. Lo que no se recalcula por celda es el formateador, que ya sale resuelto
                 * por columna — en una tabla larga eso son miles de llamadas.
                 */
                const color = isFigure
                  ? conditionalColor(condicional, cell, projected.columns[j]?.name)
                  : undefined;
                return (
                  <td
                    key={j}
                    className={isFigure ? 'is-number' : ''}
                    style={color ? estiloDeTexto({ color }) : undefined}
                  >
                    {isFigure ? (formateadores[j] ?? String)(cell) : String(cell ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
