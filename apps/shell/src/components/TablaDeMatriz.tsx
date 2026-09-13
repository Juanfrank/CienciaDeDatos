'use client';

import { useMemo, useState } from 'react';
import {
  type Direccion,
  type MatrizJerarquica,
  type NodoDeMatriz,
  type ObjectInstance,
  compararValores,
  colorCondicional,
  estiloDeTexto,
  filasVisibles,
  formateadorDeMedida,
  hojas,
  ordenarNodos,
  rutaClave,
  type FormatoCondicional,
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
  condicional?: FormatoCondicional;
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
const claveDeOrden = (ruta: readonly string[], medida: number): string =>
  `${rutaClave(ruta)}#${medida}`;

export function TablaDeMatriz({
  vm,
  titulo,
  instance,
}: {
  vm: MatrizJerarquica;
  titulo: string;
  instance: ObjectInstance;
}) {
  const [plegadas, setPlegadas] = useState<ReadonlySet<string>>(new Set());
  const [plegadasColumna, setPlegadasColumna] = useState<ReadonlySet<string>>(new Set());
  const [orden, setOrden] = useState<{ por: string | null; direccion: Direccion }>({
    por: null,
    direccion: 'asc',
  });

  // Un formateador por medida: la matriz puede llevar hasta cuatro, cada una con su formato.
  const formatear = useMemo(
    () => vm.medidas.map((m) => formateadorDeMedida(instance.presentacion, m)),
    [vm.medidas, instance.presentacion],
  );
  const columnas = useMemo(() => hojas(vm.columnas, plegadasColumna), [vm, plegadasColumna]);
  const condicional = instance.presentacion?.condicional;

  /*
   * El orden se aplica ENTRE HERMANOS, no sobre la tabla entera.
   */
  const arbol = useMemo(() => {
    if (orden.por === null) return vm.filas;
    const [rutaColumna = '', medida = '0'] = orden.por.split('#');
    const ruta = rutaColumna === '' ? [] : rutaColumna.split('||');
    const i = Number(medida);
    return ordenarNodos(vm.filas, (a, b) =>
      compararValores(vm.valor(a.ruta, ruta, i), vm.valor(b.ruta, ruta, i), orden.direccion),
    );
  }, [vm, orden]);

  const filas = useMemo(() => filasVisibles(arbol, plegadas), [arbol, plegadas]);

  const alOrdenarPor = (clave: string | null) =>
    setOrden((o) =>
      o.por === clave ? { por: clave, direccion: o.direccion === 'asc' ? 'desc' : 'asc' } : { por: clave, direccion: 'asc' },
    );

  const encabezado = (clave: string | null, texto: string, prueba: string) => {
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
        <span>{texto}</span>
        <span className="tabla__flecha" aria-hidden="true">
          {activo ? (orden.direccion === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    );
  };

  const direccionAria = (clave: string | null) =>
    orden.por === clave ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none';

  const conMedida = (etiqueta: string, medida: string) =>
    vm.medidas.length > 1 ? `${etiqueta} · ${medida}` : etiqueta;

  return (
    <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}>
      <table className="tabla tabla--matriz" data-testid="matriz">
        <thead>
          <tr>
            <th scope="col" aria-sort={direccionAria(null)} className="tabla__esquina">
              {encabezado(null, vm.nivelesDeFila.join(' / ') || 'Total', 'matriz-ordenar-filas')}
            </th>
            {columnas.map((columna) =>
              vm.medidas.map((medida, i) => {
                const clave = claveDeOrden(columna.ruta, i);
                const plegable = columna.hijos.length > 0;
                return (
                  <th key={clave} scope="col" aria-sort={direccionAria(clave)}>
                    <span className="tabla__encabezado">
                      {plegable ? (
                        <button
                          type="button"
                          className="tabla__plegar"
                          aria-expanded={!plegadasColumna.has(rutaClave(columna.ruta))}
                          aria-label={`Desplegar ${columna.etiqueta}`}
                          data-testid={`matriz-plegar-col-${rutaClave(columna.ruta)}`}
                          onClick={() =>
                            setPlegadasColumna((c) => alternar(c, rutaClave(columna.ruta)))
                          }
                        >
                          <Icono nombre="chevron-abajo" tamano={12} />
                        </button>
                      ) : null}
                      {encabezado(
                        clave,
                        conMedida(columna.etiqueta || 'Total', medida),
                        `matriz-ordenar-${rutaClave(columna.ruta)}-${i}`,
                      )}
                    </span>
                  </th>
                );
              }),
            )}
            {vm.medidas.map((medida, i) => (
              <th key={`total-${medida}`} scope="col" aria-sort={direccionAria(claveDeOrden([], i))}>
                {encabezado(claveDeOrden([], i), conMedida('Total', medida), `matriz-ordenar-total-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((nodo) => (
            <FilaDeMatriz
              key={rutaClave(nodo.ruta)}
              nodo={nodo}
              vm={vm}
              columnas={columnas}
              plegada={plegadas.has(rutaClave(nodo.ruta))}
              formatear={formatear}
              {...(condicional ? { condicional } : {})}
              onPlegar={() => setPlegadas((p) => alternar(p, rutaClave(nodo.ruta)))}
            />
          ))}
          <tr className="tabla__fila-total">
            <th scope="row">Total</th>
            {columnas.map((columna) =>
              vm.medidas.map((medida, i) => (
                <CeldaDeCifra
                  key={`${rutaClave(columna.ruta)}-${medida}`}
                  valor={vm.valor([], columna.ruta, i)}
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
  nodo,
  vm,
  columnas,
  plegada,
  formatear,
  condicional,
  onPlegar,
}: {
  nodo: NodoDeMatriz;
  vm: MatrizJerarquica;
  columnas: NodoDeMatriz[];
  plegada: boolean;
  formatear: ((n: number | null) => string)[];
  condicional?: FormatoCondicional;
  onPlegar: () => void;
}) {
  const tieneHijos = nodo.hijos.length > 0;
  return (
    <tr data-nivel={nodo.nivel} data-testid={`matriz-fila-${rutaClave(nodo.ruta)}`}>
      {/*
        La sangria va en el `padding` y no con espacios: un lector de pantalla no los pronuncia, y
        el nivel viaja ademas en `data-nivel` y en `aria-expanded`, que es donde si se anuncia.
      */}
      <th scope="row" style={{ paddingLeft: `${8 + nodo.nivel * 16}px` }}>
        <span className="tabla__encabezado">
          {tieneHijos ? (
            <button
              type="button"
              className="tabla__plegar"
              aria-expanded={!plegada}
              aria-label={`${plegada ? 'Desplegar' : 'Plegar'} ${nodo.etiqueta}`}
              data-testid={`matriz-plegar-${rutaClave(nodo.ruta)}`}
              onClick={onPlegar}
            >
              <Icono nombre="chevron-abajo" tamano={12} />
            </button>
          ) : (
            <span className="tabla__plegar tabla__plegar--vacio" aria-hidden="true" />
          )}
          {nodo.etiqueta}
        </span>
      </th>
      {columnas.map((columna) =>
        vm.medidas.map((medida, i) => (
          <CeldaDeCifra
            key={`${rutaClave(columna.ruta)}-${medida}`}
            valor={vm.valor(nodo.ruta, columna.ruta, i)}
            medida={medida}
            formatear={formatear[i] ?? String}
            {...(condicional ? { condicional } : {})}
          />
        )),
      )}
      {vm.medidas.map((medida, i) => (
        <CeldaDeCifra
          key={`t-${medida}`}
          valor={vm.valor(nodo.ruta, [], i)}
          medida={medida}
          formatear={formatear[i] ?? String}
          {...(condicional ? { condicional } : {})}
          total
        />
      ))}
    </tr>
  );
}
