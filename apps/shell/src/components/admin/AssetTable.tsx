import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Translator } from '@app/i18n';
import type { AssetRow } from '../../server/recursos';
import { ResourceActions } from './ResourceActions';
import { TablaBuscable } from './TablaBuscable';

/**
 * Los recursos que NO son objetos, en tabla — seccion 4.5.
 *
 * Era una rejilla de fichas, que para elegir un icono esta bien y para gobernarlo no: no cabe
 * «quien lo usa», no cabe el estado, y no hay donde poner una accion sin inventar un menu. Lo que
 * cambia respecto de `ResourceList` es lo que estos recursos NO tienen —version, changelog,
 * revision por pares—, y por eso no comparten componente: tres columnas diciendo «—» serian una
 * tabla mintiendo sobre lo que hay detras.
 */
export function AssetTable({
  familia,
  filas,
  t,
  vista,
}: {
  /** Sufijo de los identificadores de prueba: `iconos`, `imagenes`, `geometrias`. */
  familia: string;
  filas: AssetRow[];
  t: Translator;
  /** Como se ve el recurso. Un catalogo de iconos que no ensena los iconos no sirve de nada. */
  vista: (fila: AssetRow) => ReactNode;
}) {
  if (filas.length === 0) {
    return (
      <p className="muted-text" data-testid={`sin-${familia}`}>
        {t('admin.resources.empty')}
      </p>
    );
  }

  return (
    <TablaBuscable
      testid={`tabla-${familia}`}
      filas={filas.map((fila) => ({ id: fila.id, texto: fila.nombre }))}
      cabecera={
        <thead>
          <tr>
            <th scope="col">{t('admin.resources.column.resource')}</th>
            <th scope="col">{t('admin.resources.column.usage')}</th>
            <th scope="col">{t('admin.resources.column.state')}</th>
            <th scope="col">{t('admin.resources.column.actions')}</th>
          </tr>
        </thead>
      }
    >
      {filas.map((fila) => (
            <tr key={fila.id} data-testid={`asset-${fila.nombre}`}>
              <th scope="row">
                <span className="asset__vista">
                  {vista(fila)}
                  <code>{fila.nombre}</code>
                </span>
              </th>

              <td data-testid={`asset-${fila.nombre}-usos`}>
                <Usos fila={fila} t={t} />
              </td>

              <td data-testid={`asset-${fila.nombre}-estado`}>
                <Estado fila={fila} t={t} />
              </td>

              <td>
                {/*
                  Solo lo que el editor ofrece se puede deshabilitar. Sobre el cromo —el sandwich
                  del menu, el chevron de un desplegable— el interruptor no apagaria nada: esos
                  iconos no salen en ningun desplegable que alguien pueda usar.
                */}
                {fila.seleccionable ? (
                  <ResourceActions
                    id={fila.id}
                    disabled={fila.disabled}
                    etiquetas={{
                      editar: t('admin.resources.action.edit'),
                      deshabilitar: t('admin.resources.action.disable'),
                      habilitar: t('admin.resources.action.enable'),
                    }}
                  />
                ) : (
                  <span className="muted-text">—</span>
                )}
              </td>
            </tr>
      ))}
    </TablaBuscable>
  );
}

/**
 * El estado del recurso: deshabilitado, vigente o cromo.
 *
 * Aparte y con nombre, no como un ternario anidado dentro de la fila. Tres ramas en el JSX se
 * leen peor que una funcion, y ademas la del medio colapsa en una linea —`) : seleccionable ? (`—
 * que el trinquete de cadenas sueltas cuenta como texto de pantalla.
 */
function Estado({ fila, t }: { fila: AssetRow; t: Translator }) {
  if (fila.disabled) {
    return <span className="insignia badge--error">{t('admin.resources.action.disable')}</span>;
  }
  if (fila.seleccionable) {
    return <span className="muted-text">{t('admin.resources.state.active')}</span>;
  }
  return <span className="muted-text">{t('admin.assets.state.chrome')}</span>;
}

/**
 * Quien usa el recurso, separado en dos.
 *
 * El catalogo y los modulos no se suman en un numero: son dos cosas distintas de decidir. Que un
 * icono sea el que llevan cuatro objetos del catalogo se arregla cambiando el catalogo; que
 * nueve modulos lo hayan elegido a mano se arregla hablando con nueve personas.
 */
function Usos({ fila, t }: { fila: AssetRow; t: Translator }) {
  if (fila.uso.total === 0) {
    return <span className="muted-text">{t('admin.resources.usage.none')}</span>;
  }

  return (
    <details data-testid={`asset-${fila.nombre}-detalle`}>
      <summary>{t('admin.assets.usage.total', { n: fila.uso.total })}</summary>
      <ul className="simple-list">
        {fila.uso.catalogo.length > 0 ? (
          <li>
            {t('admin.assets.usage.catalog', {
              n: fila.uso.catalogo.length,
              cuales: t.lista(fila.uso.catalogo),
            })}
          </li>
        ) : null}
        {fila.uso.modulos.map((m) => (
          <li key={m.moduleId}>
            <Link href={`/editor/${m.slug}`}>{m.name}</Link>{' '}
            <span className="muted-text">
              {t('admin.assets.usage.instances', { n: m.instancias })}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
