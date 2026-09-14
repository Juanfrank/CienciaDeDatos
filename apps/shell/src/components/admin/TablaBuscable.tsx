'use client';

import { Children, useId, useState } from 'react';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';

/**
 * Un buscador por texto para una tabla larga — seccion 4.10.8.
 *
 * Con cincuenta iconos o veinte modulos, encontrar uno es recorrer la tabla con el dedo. El
 * buscador no ordena ni pagina: filtra, que es lo unico que hace falta cuando ya se sabe lo que
 * se busca.
 *
 * El montaje es el mismo que en `ArbolPlegable` y por la misma razon: las filas se dibujan en el
 * SERVIDOR —llevan traductor y datos del almacen— y el filtro es de cliente. Lo unico que cruza
 * la frontera es texto plano, y las filas pasan como `children` sin enterarse de nada.
 */
export interface FilaBuscable {
  id: string;
  /** Todo lo que se puede escribir para dar con esta fila, en una cadena. */
  texto: string;
}

/**
 * Compara sin acentos y sin mayusculas.
 *
 * Quien busca «composicion» tiene que encontrar «Composición»: en esta institucion los nombres
 * llevan acentos y los teclados de busqueda rapida no. `NFD` separa la letra de su tilde y el
 * rango la borra.
 */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function TablaBuscable({
  filas,
  cabecera,
  children,
  testid,
  /** Debajo de cuantas filas no se ofrece: buscar entre cuatro cosas es mas trabajo que mirarlas. */
  desde = 8,
}: {
  filas: FilaBuscable[];
  cabecera: React.ReactNode;
  children: React.ReactNode;
  testid: string;
  desde?: number;
}) {
  const t = useTranslator();
  const [consulta, setConsulta] = useState('');
  const id = useId();
  const hijas = Children.toArray(children);

  const buscado = normalizar(consulta.trim());
  const casa = (fila: FilaBuscable) => buscado === '' || normalizar(fila.texto).includes(buscado);
  const visibles = filas.filter(casa).length;

  return (
    <>
      {filas.length >= desde ? (
        <p className="buscador">
          <label className="buscador__campo" htmlFor={`${id}-buscar`}>
            <Icon nombre="lupa" tamano={16} />
            <input
              id={`${id}-buscar`}
              type="search"
              value={consulta}
              placeholder={t('admin.search.placeholder')}
              data-testid={`buscar-${testid}`}
              onChange={(e) => setConsulta(e.target.value)}
            />
          </label>
          {/*
            Cuantas quedan, siempre y en una region viva: sin esto, filtrar hasta cero deja una
            tabla vacia sin explicacion y parece que la pantalla se rompio.
          */}
          <span className="muted-text" role="status" data-testid={`resultados-${testid}`}>
            {t('admin.search.results', { n: visibles, total: filas.length })}
          </span>
        </p>
      ) : null}

      <div className="container-table">
        <table className="tabla" data-testid={testid}>
          {cabecera}
          <tbody>{filas.map((fila, i) => (casa(fila) ? hijas[i] : null))}</tbody>
        </table>
      </div>

      {visibles === 0 ? (
        <p className="muted-text" data-testid={`sin-resultados-${testid}`}>
          {t('admin.search.empty', { consulta: consulta.trim() })}
        </p>
      ) : null}
    </>
  );
}
