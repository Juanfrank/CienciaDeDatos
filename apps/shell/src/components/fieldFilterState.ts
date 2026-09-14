import type { FieldFilter, QueryResult } from '@app/data-contracts';
import type { ValueCount } from '@app/ui-components';

/**
 * El estado de un filtro de campo: como se lee de la URL, como se escribe y de donde salen sus
 * valores.
 *
 * Vive APARTE de los componentes, y sin una sola linea de React, por dos razones. La primera es
 * que se prueba con una query string de entrada y otra de salida, sin montar nada. La segunda es
 * que lo usan el panel de filtros, la seccion del navegador lateral y el complemento que acota una
 * visual sola: teniendolo dentro del panel, los otros dos tendrian que importar el componente que
 * dibujan, y el grafo de importaciones se cerraria sobre si mismo.
 */

/**
 * Lo que se pide sobre un campo, sin decir sobre cual.
 *
 * Es `FieldFilter` sin su `field` a proposito: el selector no sabe —ni tiene por que— con que
 * clave se escribe en la URL. En el panel es el nombre del campo; en el complemento que acota una
 * visual sola, `f.<instanceId>`. Quien lo dibuja traduce; el selector solo dice que se pidio.
 */
export type EstadoDeCampo = Omit<FieldFilter, 'field'>;

export const SIN_NADA: EstadoDeCampo = { incluye: [], excluye: [] };

/** Los sufijos con los que cada operador viaja en la URL, ya aplicados a un campo. */
const CLAVES = (fieldName: string) => ({
  incluye: fieldName,
  excluye: `${fieldName}.no`,
  contiene: `${fieldName}.contiene`,
  empieza: `${fieldName}.empieza`,
  desde: `${fieldName}.desde`,
  hasta: `${fieldName}.hasta`,
  vacio: `${fieldName}.vacio`,
});

/** Lee de la query lo que hay puesto sobre un campo. */
export function estadoDe(
  params: URLSearchParams,
  fieldName: string,
): EstadoDeCampo {
  const k = CLAVES(fieldName);
  const uno = (clave: string) => params.get(clave) ?? undefined;
  const vacio = uno(k.vacio);
  return {
    incluye: params.getAll(k.incluye),
    excluye: params.getAll(k.excluye),
    ...(uno(k.contiene) !== undefined ? { contiene: uno(k.contiene) } : {}),
    ...(uno(k.empieza) !== undefined ? { empieza: uno(k.empieza) } : {}),
    ...(uno(k.desde) !== undefined ? { desde: uno(k.desde) } : {}),
    ...(uno(k.hasta) !== undefined ? { hasta: uno(k.hasta) } : {}),
    ...(vacio === "si" || vacio === "no" ? { vacio: vacio === "si" } : {}),
  };
}

/**
 * Escribe el estado entero de un campo, BORRANDO antes lo que hubiera.
 *
 * Se reescribe completo y no por partes porque el estado es una sola cosa: cambiar de «es» a «no
 * es» tiene que quitar lo anterior. Escribiendo solo lo nuevo, la URL acabaria pidiendo las dos
 * cosas a la vez y el resultado seria vacio sin que nada en pantalla lo explicara.
 */
export function escribirEstado(
  params: URLSearchParams,
  fieldName: string,
  estado: EstadoDeCampo,
): void {
  const k = CLAVES(fieldName);
  for (const clave of Object.values(k)) params.delete(clave);

  for (const v of estado.incluye) params.append(k.incluye, v);
  for (const v of estado.excluye) params.append(k.excluye, v);
  if (estado.contiene) params.set(k.contiene, estado.contiene);
  if (estado.empieza) params.set(k.empieza, estado.empieza);
  if (estado.desde) params.set(k.desde, estado.desde);
  if (estado.hasta) params.set(k.hasta, estado.hasta);
  if (estado.vacio !== undefined) params.set(k.vacio, estado.vacio ? "si" : "no");
}

/** true si no se pidio nada sobre el campo. */
export const sinNada = (estado: EstadoDeCampo): boolean =>
  estado.incluye.length === 0 &&
  estado.excluye.length === 0 &&
  estado.contiene === undefined &&
  estado.empieza === undefined &&
  estado.desde === undefined &&
  estado.hasta === undefined &&
  estado.vacio === undefined;

/**
 * Los valores distintos de una columna, CON cuantas filas hay detras de cada uno.
 *
 * Salen del dataset ya recortado por el ambito, asi que el recuento tampoco cuenta lo que quien
 * mira no puede ver — un recuento que incluyera filas fuera de su alcance seria una filtracion de
 * datos por la puerta de atras.
 */
export function valueStats(result: QueryResult, fieldName: string): ValueCount[] {
  const i = result.columns.findIndex((c) => c.name === fieldName);
  if (i < 0) return [];
  const cuenta = new Map<string, number>();
  for (const row of result.rows) {
    const valor = row[i];
    if (valor === null || valor === undefined) continue;
    const clave = String(valor);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return [...cuenta.entries()].map(([valor, recuento]) => ({ valor, recuento }));
}

/** Solo los valores, para quien no necesita el recuento. */
export const optionsOf = (result: QueryResult, fieldName: string): string[] =>
  valueStats(result, fieldName).map((v) => v.valor);

