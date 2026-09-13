'use client';

import { useMemo, useState } from 'react';
import type { QueryResult } from '@app/data-contracts';
import {
  type Direccion,
  type FormatoCondicional,
  colorCondicional,
  compararValores,
  estiloDeTexto,
} from '@app/ui-components';

/** Una tabla que se ordena pulsando su encabezado. */

/** Texto o cifra, cada uno con su comparacion. Mezclarlos ordena por la representacion, no por el valor. */
const comparar = (a: unknown, b: unknown, direccion: Direccion): number => {
  if (typeof a === 'number' || typeof b === 'number') {
    return compararValores(
      typeof a === 'number' ? a : null,
      typeof b === 'number' ? b : null,
      direccion,
    );
  }
  const cmp = String(a ?? '').localeCompare(String(b ?? ''), 'es');
  return direccion === 'asc' ? cmp : -cmp;
};

export function TablaOrdenable({
  proyectado,
  titulo,
  formatearColumna,
  condicional,
}: {
  proyectado: QueryResult;
  titulo: string;
  /** Un formateador POR COLUMNA: cada medida puede tener el suyo. */
  formatearColumna: (nombre: string) => (n: number | null) => string;
  /** Reglas de color por valor. La celda que se sale es lo que se busca en una tabla. */
  condicional?: FormatoCondicional;
}) {
  const [orden, setOrden] = useState<{ columna: number; direccion: Direccion } | null>(null);

  // Se resuelve una vez por columna y no por celda: en una tabla larga son miles de llamadas.
  const formateadores = useMemo(
    () => proyectado.columns.map((c) => formatearColumna(c.name)),
    [proyectado.columns, formatearColumna],
  );

  const filas = useMemo(() => {
    if (!orden) return proyectado.rows;
    // Copia antes de ordenar: `sort` muta, y `proyectado.rows` viene del servidor por referencia.
    return [...proyectado.rows].sort((a, b) =>
      comparar(a[orden.columna], b[orden.columna], orden.direccion),
    );
  }, [proyectado.rows, orden]);

  const alPulsar = (columna: number) =>
    setOrden((o) =>
      o?.columna === columna
        ? { columna, direccion: o.direccion === 'asc' ? 'desc' : 'asc' }
        : { columna, direccion: 'asc' },
    );

  return (
    <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}>
      <table className="tabla" data-testid="tabla">
        <thead>
          <tr>
            {proyectado.columns.map((c, i) => {
              const activa = orden?.columna === i;
              return (
                <th
                  key={c.name}
                  scope="col"
                  // `aria-sort` es donde un lector de pantalla busca el estado del orden. Va en la
                  // celda y no en el boton: el criterio lo pide sobre el encabezado.
                  aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="tabla__ordenar"
                    data-testid={`ordenar-${c.name}`}
                    onClick={() => alPulsar(i)}
                  >
                    <span>{c.name}</span>
                    <span className="tabla__flecha" aria-hidden="true">
                      {activa ? (orden.direccion === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => {
                const esCifra = typeof celda === 'number';
                /*
                 * El color se calcula POR CELDA, que es el unico sitio donde se puede: depende del
                 * valor. Lo que no se recalcula por celda es el formateador, que ya sale resuelto
                 * por columna — en una tabla larga eso son miles de llamadas.
                 */
                const color = esCifra
                  ? colorCondicional(condicional, celda, proyectado.columns[j]?.name)
                  : undefined;
                return (
                  <td
                    key={j}
                    className={esCifra ? 'es-numero' : ''}
                    style={color ? estiloDeTexto({ color }) : undefined}
                  >
                    {esCifra ? (formateadores[j] ?? String)(celda) : String(celda ?? '')}
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
