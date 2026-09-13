'use client';

import { useMemo, useState } from 'react';
import {
  type Direction,
  type HierarchicalMatrix,
  type MatrixNode,
  type ObjectInstance,
  compareValues,
  colorCondicional,
  estiloDeTexto,
  visibleRows,
  formateadorDeMedida,
  leaves,
  sortNodes,
  pathKey,
  type ConditionalFormat,
} from '@app/ui-components';
import { Icono } from './iconos/Icono';

/** El cuerpo de la matriz: jerarquia, colapso y orden. */

const alternar = (conjunto: ReadonlySet<string>, clave: string): Set<string> => {
  const siguiente = new Set(conjunto);
  if (siguiente.has(clave)) siguiente.delete(clave);
  else siguiente.add(clave);
  return siguiente;
};

/** Una celda de cifra, con su formato y su color por valor. */
function CeldaDeCifra({
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
  const color = valor === null ? undefined : colorCondicional(condicional, valor, medida);
  return (
    <td
      className={total ? 'es-numero es-total' : 'es-numero'}
      style={color ? estiloDeTexto({ color }) : undefined}
    >
      {formatear(valor)}
    </td>
  );
}

/** Identifica una columna ordenable: la ruta de la hoja mas el indice de medida. */
const claveDeOrden = (path: readonly string[], medida: number): string =>
  `${pathKey(path)}#${medida}`;

export function TablaDeMatriz({
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
    () => vm.medidas.map((m) => formateadorDeMedida(instance.presentacion, m)),
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
        className="tabla__ordenar"
        // El estado del orden se anuncia con `aria-sort` en la celda, que es donde un lector de
        // pantalla lo busca; aqui basta con que el boton diga que hace.
        data-testid={prueba}
        onClick={() => alOrdenarPor(clave)}
      >
        <span>{content}</span>
        <span className="tabla__flecha" aria-hidden="true">
          {activo ? (orden.direction === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    );
  };

  const direccionAria = (clave: string | null) =>
    orden.por === clave ? (orden.direction === 'asc' ? 'ascending' : 'descending') : 'none';

  const conMedida = (etiqueta: string, medida: string) =>
    vm.medidas.length > 1 ? `${etiqueta} · ${medida}` : etiqueta;

  return (
    <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}>
      <table className="tabla tabla--matriz" data-testid="matriz">
        <thead>
          <tr>
            <th scope="col" aria-sort={direccionAria(null)} className="tabla__esquina">
              {heading(null, vm.rowLevels.join(' / ') || 'Total', 'matriz-ordenar-filas')}
            </th>
            {gridColumns.map((column) =>
              vm.medidas.map((medida, i) => {
                const clave = claveDeOrden(column.path, i);
                const plegable = column.hijos.length > 0;
                return (
                  <th key={clave} scope="col" aria-sort={direccionAria(clave)}>
                    <span className="tabla__encabezado">
                      {plegable ? (
                        <button
                          type="button"
                          className="tabla__plegar"
                          aria-expanded={!plegadasColumna.has(pathKey(column.path))}
                          aria-label={`Desplegar ${column.etiqueta}`}
                          data-testid={`matriz-plegar-col-${pathKey(column.path)}`}
                          onClick={() =>
                            setPlegadasColumna((c) => alternar(c, pathKey(column.path)))
                          }
                        >
                          <Icono nombre="chevron-abajo" tamano={12} />
                        </button>
                      ) : null}
                      {heading(
                        clave,
                        conMedida(column.etiqueta || 'Total', medida),
                        `matriz-ordenar-${pathKey(column.path)}-${i}`,
                      )}
                    </span>
                  </th>
                );
              }),
            )}
            {vm.medidas.map((medida, i) => (
              <th key={`total-${medida}`} scope="col" aria-sort={direccionAria(claveDeOrden([], i))}>
                {heading(claveDeOrden([], i), conMedida('Total', medida), `matriz-ordenar-total-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((node) => (
            <FilaDeMatriz
              key={pathKey(node.path)}
              node={node}
              vm={vm}
              gridColumns={gridColumns}
              collapsed={plegadas.has(pathKey(node.path))}
              formatear={formatear}
              {...(condicional ? { condicional } : {})}
              onPlegar={() => setPlegadas((p) => alternar(p, pathKey(node.path)))}
            />
          ))}
          <tr className="tabla__fila-total">
            <th scope="row">Total</th>
            {gridColumns.map((column) =>
              vm.medidas.map((medida, i) => (
                <CeldaDeCifra
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
              <CeldaDeCifra
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

function FilaDeMatriz({
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
    <tr data-nivel={node.nivel} data-testid={`matriz-fila-${pathKey(node.path)}`}>
      {/*
        La sangria va en el `padding` y no con espacios: un lector de pantalla no los pronuncia, y
        el nivel viaja ademas en `data-nivel` y en `aria-expanded`, que es donde si se anuncia.
      */}
      <th scope="row" style={{ paddingLeft: `${8 + node.nivel * 16}px` }}>
        <span className="tabla__encabezado">
          {tieneHijos ? (
            <button
              type="button"
              className="tabla__plegar"
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? 'Desplegar' : 'Plegar'} ${node.etiqueta}`}
              data-testid={`matriz-plegar-${pathKey(node.path)}`}
              onClick={onPlegar}
            >
              <Icono nombre="chevron-abajo" tamano={12} />
            </button>
          ) : (
            <span className="tabla__plegar tabla__plegar--vacio" aria-hidden="true" />
          )}
          {node.etiqueta}
        </span>
      </th>
      {gridColumns.map((column) =>
        vm.medidas.map((medida, i) => (
          <CeldaDeCifra
            key={`${pathKey(column.path)}-${medida}`}
            valor={vm.valor(node.path, column.path, i)}
            medida={medida}
            formatear={formatear[i] ?? String}
            {...(condicional ? { condicional } : {})}
          />
        )),
      )}
      {vm.medidas.map((medida, i) => (
        <CeldaDeCifra
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
