'use client';

import { useRef } from 'react';
import Link from 'next/link';
import type { MessageKey } from '@app/i18n';
import type { ObjetoEnModulo } from '../../server/recursos';
import { BumpModule } from './BumpModule';
import { BumpTodos } from './BumpTodos';
import type { Subida } from './bump';
import { Icon } from '../icons/Icon';
import { useTranslator } from '../Locale';

/**
 * Que hay dentro de un modulo, sin salir de la lista — seccion 4.5.
 *
 * La celda dice un NUMERO y nada mas. Decia «3 objetos · 2 con version antigua» y, repetido en
 * veinte filas, convertia la columna en un parrafo que hay que leer entero para encontrar la fila
 * que importa. El numero se lee de un vistazo, el triangulo rojo avisa, y lo demas esta a un clic.
 *
 * Y a un clic hay un DIALOGO, no un desplegable. La tabla vive dentro de un contenedor que se
 * desplaza en horizontal, y un panel absoluto dentro de una celda se recorta contra ese
 * desbordamiento: la mitad del contenido quedaba fuera. `showModal()` lo saca a la capa superior
 * del navegador, que ademas trae gratis el cierre con Escape y la retencion del foco.
 */
export function ModuleObjects({ slug, objetos }: { slug: string; objetos: ObjetoEnModulo[] }) {
  const t = useTranslator();
  const dialogo = useRef<HTMLDialogElement>(null);

  if (objetos.length === 0) {
    return <span className="muted-text">—</span>;
  }

  const pendientes: Subida[] = objetos
    .filter((o) => o.atrasada)
    .map((o) => ({
      slug,
      objectId: o.objectId,
      nombre: o.name,
      desde: o.version,
      hasta: o.ultima,
    }));
  const atrasados = pendientes.length;
  const instancias = objetos.reduce((n, o) => n + o.instancias, 0);

  return (
    <>
      <button
        type="button"
        className="celda-numero"
        data-testid={`objetos-${slug}`}
        // El rotulo accesible SI lleva la frase: un lector de pantalla que solo oyera «3» no
        // sabria de que, y es la misma informacion que antes estaba escrita en la celda.
        aria-label={
          atrasados > 0
            ? `${t('admin.modules.objects.count', { n: objetos.length })}, ${t('admin.modules.objects.behind', { n: atrasados })}`
            : t('admin.modules.objects.count', { n: objetos.length })
        }
        onClick={() => dialogo.current?.showModal()}
      >
        {objetos.length}
        {atrasados > 0 ? (
          <span
            className="alerta-version"
            aria-hidden="true"
            data-testid={`objetos-atrasados-${slug}`}
          >
            <Icon nombre="aviso_triangulo" tamano={14} />
          </span>
        ) : null}
      </button>

      <dialog className="dialogo" ref={dialogo} data-testid={`objetos-dialogo-${slug}`}>
        <div className="dialogo__cabecera">
          <h2>{t('admin.modules.objects.title', { modulo: slug })}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid={`cerrar-objetos-${slug}`}
            onClick={() => dialogo.current?.close()}
          >
            {t('action.close')}
          </button>
        </div>

        <p className="muted-text">
          {t('admin.modules.objects.summary', { n: objetos.length, instancias })}
        </p>

        {/* Subirlos todos, arriba y una vez. Con ocho objetos atrasados, ocho gestos iguales son
            la clase de trabajo que se acaba no haciendo. */}
        <BumpTodos subidas={pendientes} testid={slug} />

        <div className="container-table">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">{t('admin.modules.objects.column.object')}</th>
                <th scope="col">{t('admin.modules.objects.column.version')}</th>
                <th scope="col">{t('admin.modules.objects.column.instances')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {objetos.map((o) => (
                <tr
                  key={`${o.objectId}@${o.version}`}
                  data-testid={`objeto-${slug}-${o.objectId}-${o.version}`}
                >
                  <th scope="row">
                    {/* El nombre lleva a donde mas se usa ese objeto: es la otra mitad de la
                        misma pregunta, leida desde el catalogo. */}
                    <Link href={`/admin/resources/usage/${o.objectId}`}>{o.name}</Link>{' '}
                    <span className="muted-text">
                      {t(CATEGORIA[o.category] ?? 'admin.modules.objects.category.other')}
                    </span>
                  </th>
                  <td>
                    v{o.version} <Vigencia objeto={o} />
                  </td>
                  <td>{o.instancias}</td>
                  <td>
                    {o.atrasada ? (
                      <BumpModule
                        slug={slug}
                        objectId={o.objectId}
                        nombre={o.name}
                        desde={o.version}
                        hasta={o.ultima}
                      />
                    ) : (
                      <span className="muted-text">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  );
}

/**
 * Si la version fijada es la ultima, una vieja, o de un objeto que ya no existe.
 *
 * Con nombre y no como ternario anidado: la rama del medio se queda en una linea que el trinquete
 * de cadenas sueltas cuenta como prosa de pantalla.
 */
function Vigencia({ objeto }: { objeto: ObjetoEnModulo }) {
  const t = useTranslator();
  if (objeto.desconocido) {
    return <span className="insignia badge--error">{t('admin.modules.objects.unknown')}</span>;
  }
  if (objeto.atrasada) {
    return (
      <span className="insignia badge--error">
        {t('admin.modules.objects.latestIs', { version: objeto.ultima })}
      </span>
    );
  }
  return <span className="insignia">{t('admin.usage.latest')}</span>;
}

/** La categoria del catalogo, dicha en la lengua de quien mira. */
const CATEGORIA: Partial<Record<ObjetoEnModulo['category'], MessageKey>> = {
  grafico: 'admin.modules.objects.category.chart',
  tabla: 'admin.modules.objects.category.table',
  indicador: 'admin.modules.objects.category.indicator',
  filtro: 'admin.modules.objects.category.filter',
  mapa: 'admin.modules.objects.category.map',
  elemento: 'admin.modules.objects.category.element',
  contenedor: 'admin.modules.objects.category.container',
  complemento: 'admin.modules.objects.category.addon',
};
