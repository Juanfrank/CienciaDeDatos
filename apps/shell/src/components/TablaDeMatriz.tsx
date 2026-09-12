'use client';

import { useMemo, useState } from 'react';
import {
  type Direccion,
  type MatrizJerarquica,
  type NodoDeMatriz,
  type ObjectInstance,
  compararValores,
  filasVisibles,
  formateadorDe,
  hojas,
  ordenarNodos,
  rutaClave,
} from '@app/ui-components';
import { Icono } from './iconos/Icono';

/**
 * El cuerpo de la matriz: jerarquia, colapso y orden.
 *
 * Vive fuera de `objetos.tsx` porque necesita ESTADO —que esta plegado y por que columna se
 * ordena— y los demas objetos son funciones puras de sus props. Mezclarlo alli habria obligado a
 * convertir el modulo entero en cliente.
 *
 * El estado es de la VISTA y no de la instancia a proposito: plegar un grupo para mirar algo no
 * es editar el modulo, y guardarlo haria que un gesto de lectura ensuciara lo publicado. Se pierde
 * al recargar, que es lo que uno espera de haber plegado una fila.
 */

const alternar = (conjunto: ReadonlySet<string>, clave: string): Set<string> => {
  const siguiente = new Set(conjunto);
  if (siguiente.has(clave)) siguiente.delete(clave);
  else siguiente.add(clave);
  return siguiente;
};

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

  const formatear = formateadorDe(instance.presentacion?.formato);
  const columnas = useMemo(() => hojas(vm.columnas, plegadasColumna), [vm, plegadasColumna]);

  /*
   * El orden se aplica ENTRE HERMANOS, no sobre la tabla entera.
   *
   * Ordenar todas las filas por una columna repartiria los hijos de un distrito entre otros
   * distritos y la jerarquia dejaria de significar nada. Ordenando cada nivel por separado,
   * «mayor total primero» ordena los distritos entre si y, dentro de cada uno, sus materias.
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
              onPlegar={() => setPlegadas((p) => alternar(p, rutaClave(nodo.ruta)))}
            />
          ))}
          <tr className="tabla__fila-total">
            <th scope="row">Total</th>
            {columnas.map((columna) =>
              vm.medidas.map((medida, i) => (
                <td key={`${rutaClave(columna.ruta)}-${medida}`} className="es-numero es-total">
                  {formatear(vm.valor([], columna.ruta, i))}
                </td>
              )),
            )}
            {vm.medidas.map((medida, i) => (
              <td key={`gt-${medida}`} className="es-numero es-total">
                {formatear(vm.valor([], [], i))}
              </td>
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
  onPlegar,
}: {
  nodo: NodoDeMatriz;
  vm: MatrizJerarquica;
  columnas: NodoDeMatriz[];
  plegada: boolean;
  formatear: (n: number | null) => string;
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
          <td key={`${rutaClave(columna.ruta)}-${medida}`} className="es-numero">
            {formatear(vm.valor(nodo.ruta, columna.ruta, i))}
          </td>
        )),
      )}
      {vm.medidas.map((medida, i) => (
        <td key={`t-${medida}`} className="es-numero es-total">
          {formatear(vm.valor(nodo.ruta, [], i))}
        </td>
      ))}
    </tr>
  );
}
