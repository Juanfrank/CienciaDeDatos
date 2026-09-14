'use client';

import { useMemo, useState } from 'react';
import {
  type Direction,
  type HierarchicalMatrix,
  type MatrixNode,
  type ObjectInstance,
  compareValues,
  conditionalColor,
  estiloDeTexto,
  visibleRows,
  measureFormatter,
  leaves,
  sortNodes,
  pathKey,
  type ConditionalFormat,
} from '@app/ui-components';
import { Icon } from './icons/Icon';

/** El cuerpo de la matriz: jerarquia, colapso y orden. */

const toggle = (conjunto: ReadonlySet<string>, clave: string): Set<string> => {
  const siguiente = new Set(conjunto);
  if (siguiente.has(clave)) siguiente.delete(clave);
  else siguiente.add(clave);
  return siguiente;
};

/** Una celda de cifra, con su formato y su color por valor. */
function FigureCell({
  valor,
  medida,
  formatear,
  condicional,
  total,
}: {
  valor: number | null;
  medida: string;
  formatear: (n: number | null) => string;
  condicional?: ConditionalFormat;
  total?: boolean;
}) {
  const color = valor === null ? undefined : conditionalColor(condicional, valor, medida);
  return (
    <td
      className={total ? 'is-number is-total' : 'is-number'}
      style={color ? estiloDeTexto({ color }) : undefined}
    >
      {formatear(valor)}
    </td>
  );
}

/** Identifica una columna ordenable: la ruta de la hoja mas el indice de medida. */
const sortKey = (path: readonly string[], medida: number): string =>
  `${pathKey(path)}#${medida}`;

export function MatrixTable({
  vm,
  titulo,
  instance,
}: {
  vm: HierarchicalMatrix;
  titulo: string;
  instance: ObjectInstance;
}) {
  const [plegadas, setPlegadas] = useState<ReadonlySet<string>>(new Set());
  const [plegadasColumna, setPlegadasColumna] = useState<ReadonlySet<string>>(new Set());
  const [orden, setOrden] = useState<{ por: string | null; direction: Direction }>({
    por: null,
    direction: 'asc',
  });

  // Un formateador por medida: la matriz puede llevar hasta cuatro, cada una con su formato.
  const formatear = useMemo(
    () => vm.medidas.map((m) => measureFormatter(instance.presentacion, m)),
    [vm.medidas, instance.presentacion],
  );
  const gridColumns = useMemo(() => leaves(vm.gridColumns, plegadasColumna), [vm, plegadasColumna]);
  const condicional = instance.presentacion?.condicional;

  /*
   * El orden se aplica ENTRE HERMANOS, no sobre la tabla entera.
   */
  const arbol = useMemo(() => {
    if (orden.por === null) return vm.dataRows;
    const [rutaColumna = '', medida = '0'] = orden.por.split('#');
    const path = rutaColumna === '' ? [] : rutaColumna.split('||');
    const i = Number(medida);
    return sortNodes(vm.dataRows, (a, b) =>
      compareValues(vm.valor(a.path, path, i), vm.valor(b.path, path, i), orden.direction),
    );
  }, [vm, orden]);

  const dataRows = useMemo(() => visibleRows(arbol, plegadas), [arbol, plegadas]);

  const alOrdenarPor = (clave: string | null) =>
    setOrden((o) =>
      o.por === clave ? { por: clave, direction: o.direction === 'asc' ? 'desc' : 'asc' } : { por: clave, direction: 'asc' },
    );

  const heading = (clave: string | null, content: string, prueba: string) => {
    const activo = orden.por === clave;
    return (
      <button
        type="button"
        className="table__sort"
        // El estado del orden se anuncia con `aria-sort` en la celda, que es donde un lector de
        // pantalla lo busca; aqui basta con que el boton diga que hace.
        data-testid={prueba}
        onClick={() => alOrdenarPor(clave)}
      >
        <span>{content}</span>
        <span className="table__flecha" aria-hidden="true">
          {activo ? (orden.direction === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    );
  };

  const ariaDirection = (clave: string | null) =>
    orden.por === clave ? (orden.direction === 'asc' ? 'ascending' : 'descending') : 'none';

  const withMeasure = (etiqueta: string, medida: string) =>
    vm.medidas.length > 1 ? `${etiqueta} · ${medida}` : etiqueta;

  return (
    <div className="container-table" tabIndex={0} role="region" aria-label={titulo}>
      <table className="tabla matrix-table" data-testid="matriz">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaDirection(null)} className="table__esquina">
              {heading(null, vm.rowLevels.join(' / ') || 'Total', 'matrix-sort-rows')}
            </th>
            {gridColumns.map((column) =>
              vm.medidas.map((medida, i) => {
                const clave = sortKey(column.path, i);
                const collapsible = column.hijos.length > 0;
                return (
                  <th key={clave} scope="col" aria-sort={ariaDirection(clave)}>
                    <span className="table__heading">
                      {collapsible ? (
                        <button
                          type="button"
                          className="table__collapse"
                          aria-expanded={!plegadasColumna.has(pathKey(column.path))}
                          aria-label={`Desplegar ${column.etiqueta}`}
                          data-testid={`matrix-collapse-col-${pathKey(column.path)}`}
                          onClick={() =>
                            setPlegadasColumna((c) => toggle(c, pathKey(column.path)))
                          }
                        >
                          <Icon nombre="chevron-abajo" tamano={12} />
                        </button>
                      ) : null}
                      {heading(
                        clave,
                        withMeasure(column.etiqueta || 'Total', medida),
                        `matrix-sort-${pathKey(column.path)}-${i}`,
                      )}
                    </span>
                  </th>
                );
              }),
            )}
            {vm.medidas.map((medida, i) => (
              <th key={`total-${medida}`} scope="col" aria-sort={ariaDirection(sortKey([], i))}>
                {heading(sortKey([], i), withMeasure('Total', medida), `matrix-sort-total-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((node) => (
            <MatrixRow
              key={pathKey(node.path)}
              node={node}
              vm={vm}
              gridColumns={gridColumns}
              collapsed={plegadas.has(pathKey(node.path))}
              formatear={formatear}
              {...(condicional ? { condicional } : {})}
              onPlegar={() => setPlegadas((p) => toggle(p, pathKey(node.path)))}
            />
          ))}
          <tr className="table__total-row">
            <th scope="row">Total</th>
            {gridColumns.map((column) =>
              vm.medidas.map((medida, i) => (
                <FigureCell
                  key={`${pathKey(column.path)}-${medida}`}
                  valor={vm.valor([], column.path, i)}
                  medida={medida}
                  formatear={formatear[i] ?? String}
                  {...(condicional ? { condicional } : {})}
                  total
                />
              )),
            )}
            {vm.medidas.map((medida, i) => (
              <FigureCell
                key={`gt-${medida}`}
                valor={vm.valor([], [], i)}
                medida={medida}
                formatear={formatear[i] ?? String}
                {...(condicional ? { condicional } : {})}
                total
              />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MatrixRow({
  node,
  vm,
  gridColumns,
  collapsed,
  formatear,
  condicional,
  onPlegar,
}: {
  node: MatrixNode;
  vm: HierarchicalMatrix;
  gridColumns: MatrixNode[];
  collapsed: boolean;
  formatear: ((n: number | null) => string)[];
  condicional?: ConditionalFormat;
  onPlegar: () => void;
}) {
  const tieneHijos = node.hijos.length > 0;
  return (
    <tr data-level={node.nivel} data-testid={`matrix-row-${pathKey(node.path)}`}>
      {/*
        La sangria va en el `padding` y no con espacios: un lector de pantalla no los pronuncia, y
        el nivel viaja ademas en `data-nivel` y en `aria-expanded`, que es donde si se anuncia.
      */}
      <th scope="row" style={{ paddingLeft: `${8 + node.nivel * 16}px` }}>
        <span className="table__heading">
          {tieneHijos ? (
            <button
              type="button"
              className="table__collapse"
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? 'Desplegar' : 'Plegar'} ${node.etiqueta}`}
              data-testid={`matrix-collapse-${pathKey(node.path)}`}
              onClick={onPlegar}
            >
              <Icon nombre="chevron-abajo" tamano={12} />
            </button>
          ) : (
            <span className="table__collapse table__collapse-empty" aria-hidden="true" />
          )}
          {node.etiqueta}
        </span>
      </th>
      {gridColumns.map((column) =>
        vm.medidas.map((medida, i) => (
          <FigureCell
            key={`${pathKey(column.path)}-${medida}`}
            valor={vm.valor(node.path, column.path, i)}
            medida={medida}
            formatear={formatear[i] ?? String}
            {...(condicional ? { condicional } : {})}
          />
        )),
      )}
      {vm.medidas.map((medida, i) => (
        <FigureCell
          key={`t-${medida}`}
          valor={vm.valor(node.path, [], i)}
          medida={medida}
          formatear={formatear[i] ?? String}
          {...(condicional ? { condicional } : {})}
          total
        />
      ))}
    </tr>
  );
}
