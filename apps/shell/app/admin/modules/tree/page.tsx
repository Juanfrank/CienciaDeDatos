import Link from 'next/link';
import type { Translator } from '@app/i18n';
import { isFolder, type NavNode } from '@app/access-control';
import { sectionOf } from '../../../../src/components/admin/sections';
import { TreeActions, type DestinoPosible } from '../../../../src/components/admin/TreeActions';
import { FolderActions } from '../../../../src/components/admin/FolderActions';
import { Papelera } from '../../../../src/components/admin/Papelera';
import { CrearEnElArbol } from '../../../../src/components/admin/CrearEnElArbol';
import {
  ArbolPlegable,
  BotonPlegar,
  type FilaDelArbol,
} from '../../../../src/components/admin/ArbolPlegable';
import { folderRows, subfoldersOf, type FilaCarpeta } from '../../../../src/server/organizacion';
import { getManagedTree } from '../../../../src/server/context';
import { modules } from '../../../../src/server/moduleStore';
import { translator } from '../../../../src/server/locale';

export const dynamic = 'force-dynamic';

const SANGRIA = (profundidad: number) => ({ paddingInlineStart: `${profundidad * 1.5}rem` });

/** Las carpetas a las que se puede mover algo, con la sangria puesta. */
function destinos(nodos: NavNode[], t: Translator, profundidad = 0): DestinoPosible[] {
  const salida: DestinoPosible[] =
    profundidad === 0 ? [{ id: null, etiqueta: t('admin.tree.move.root') }] : [];
  for (const nodo of nodos) {
    if (!isFolder(nodo)) continue;
    salida.push({ id: nodo.id, etiqueta: `${'— '.repeat(profundidad)}${nodo.name}` });
    salida.push(...destinos(nodo.children, t, profundidad + 1));
  }
  return salida;
}

/**
 * La organizacion general, en TABLA de carpetas — secciones 4.1 y 4.10.8.
 *
 * Era un editor de arbol con sus propios botones: una lista de nodos que se seleccionaban, un
 * desplegable para mover y un boton de renombrar por fila. Dibujaba lo mismo que la tabla de
 * modulos pero con otra forma y otras acciones, asi que la misma pregunta —«donde vive esto y que
 * ambito hereda»— se contestaba distinto segun la pantalla desde la que se mirara.
 *
 * Aqui solo salen las CARPETAS, que es lo que esta pantalla gobierna: los modulos que cuelgan de
 * cada una estan en la tabla de modulos, con sus versiones y sus objetos. Lo que se anade frente a
 * aquella es lo que solo tiene una carpeta —renombrar y mandar a la papelera— y el recuento de lo
 * que se lleva consigo al moverla.
 */
export default async function TreePage() {
  const seccion = sectionOf('/admin/modules/tree');
  const [t, arbol, definiciones] = await Promise.all([
    translator(),
    getManagedTree(),
    modules.list(),
  ]);

  const porId = new Map(definiciones.map((m) => [m.moduleId, m]));
  const filas = folderRows(arbol.nodes, porId);
  const posibles = destinos(arbol.nodes, t);

  return (
    <section>
      <h2>{t('admin.tree.title')}</h2>
      <p className="muted-text">{seccion?.desc}</p>

      <CrearEnElArbol destinos={posibles} soloCarpeta />

      {filas.length === 0 ? (
        <p className="muted-text" data-testid="sin-carpetas">
          {t('admin.tree.empty')}
        </p>
      ) : (
        <ArbolPlegable
          filas={filas.map(
            (fila): FilaDelArbol => ({
              id: fila.id,
              tipo: fila.tipo,
              profundidad: fila.profundidad,
              padre: fila.padre,
              texto: fila.nombre,
            }),
          )}
          cabecera={<Cabecera t={t} />}
          testid="tabla-carpetas"
        >
          {filas.map((fila) => (
            <Fila
              key={fila.id}
              fila={fila}
              t={t}
              destinos={posibles}
              subcarpetas={subfoldersOf(arbol.nodes, fila.id)}
            />
          ))}
        </ArbolPlegable>
      )}

      <Papelera arbol={arbol} />
    </section>
  );
}

function Cabecera({ t }: { t: Translator }) {
  return (
    <thead>
      <tr>
        <th scope="col">{t('admin.tree.column.folder')}</th>
        <th scope="col">{t('admin.tree.column.scope')}</th>
        <th scope="col">{t('admin.tree.column.subfolders')}</th>
        <th scope="col">{t('admin.tree.column.modules')}</th>
        <th scope="col">{t('admin.resources.column.actions')}</th>
      </tr>
    </thead>
  );
}

function Fila({
  fila,
  t,
  destinos: posibles,
  subcarpetas,
}: {
  fila: FilaCarpeta;
  t: Translator;
  destinos: DestinoPosible[];
  subcarpetas: number;
}) {
  const restricciones = fila.scope?.restrictions ?? [];

  return (
    <tr
      className="fila-carpeta"
      data-testid={`carpeta-${fila.id}`}
      data-depth={fila.profundidad}
      data-hidden={fila.hidden ? 'si' : 'no'}
    >
      <th scope="row" style={SANGRIA(fila.profundidad)}>
        <BotonPlegar nodeId={fila.id} nombre={fila.nombre} />{' '}
        <span className="fila-carpeta__nombre">{fila.nombre}</span>
      </th>
      <td data-testid={`carpeta-${fila.id}-ambito`}>
        {/*
          El ambito es un ENLACE, no una etiqueta: leer que una carpeta restringe por distrito
          lleva siempre a la misma pregunta —con que valores—, y esa se responde en el editor de
          ambitos con la carpeta ya elegida.
        */}
        <Link href={`/admin/scopes?destino=${encodeURIComponent(fila.id)}`}>
          {restricciones.length === 0 ? (
            <span className="muted-text">{t('admin.modules.folder.inherits')}</span>
          ) : (
            <span className="insignia">
              {t('admin.modules.folder.restricts', {
                cuales: t.lista(
                  restricciones.map((r) => `${r.dimension.table}.${r.dimension.field}`),
                ),
              })}
            </span>
          )}
        </Link>
        {fila.hidden ? (
          <>
            {' '}
            <span className="insignia badge--error" title={t('admin.tree.hidden.explain')}>
              {t('admin.tree.hidden')}
            </span>
          </>
        ) : null}
      </td>
      <td>{subcarpetas}</td>
      <td>{fila.modulos}</td>
      <td>
        <span className="fila-acciones">
          <TreeActions
            nodeId={fila.id}
            nombre={fila.nombre}
            hidden={fila.hidden}
            indice={fila.indice}
            puedeSubir={fila.indice > 0}
            puedeBajar={fila.indice < fila.hermanos - 1}
            // Una carpeta no cabe dentro de si misma ni de una de sus hijas: la lista se recorta
            // antes de ofrecerla, en vez de dejar que la operacion lo rechace despues.
            destinos={posibles.filter((d) => d.id !== fila.id)}
            hrefConfigurar={`/admin/scopes?destino=${encodeURIComponent(fila.id)}`}
            hrefPermisos={`/admin/scopes?destino=${encodeURIComponent(fila.id)}`}
          />
          <FolderActions nodeId={fila.id} nombre={fila.nombre} modulos={fila.modulos} />
        </span>
      </td>
    </tr>
  );
}
