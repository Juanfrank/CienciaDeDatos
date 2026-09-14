import Link from 'next/link';
import type { MessageKey, Translator } from '@app/i18n';
import { SectionIndex } from '../../../src/components/admin/SectionIndex';
import { sectionOf } from '../../../src/components/admin/sections';
import { ModuleObjects } from '../../../src/components/admin/ModuleObjects';
import { modules } from '../../../src/server/moduleStore';
import { getGeneralTree } from '../../../src/server/context';
import { objectsOfModule } from '../../../src/server/recursos';
import {
  looseModules,
  organizationRows,
  type FilaCarpeta,
  type FilaOrganizacion,
} from '../../../src/server/organizacion';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, MessageKey> = {
  borrador: 'admin.modules.status.draft',
  'pendiente-de-aprobacion': 'admin.modules.status.pending',
  publicado: 'admin.modules.status.published',
};

/** Sangria de un nivel del arbol, en la primera columna. */
const SANGRIA = (profundidad: number) => ({ paddingInlineStart: `${profundidad * 1.5}rem` });

/**
 * Los modulos ANIDADOS en sus carpetas — secciones 4.1, 4.2 y 4.10.6.
 *
 * Estaban en una lista plana ordenada por nombre, y eso borra lo unico que explica el acceso: un
 * modulo hereda el ambito de la carpeta que lo contiene, asi que dos modulos contiguos en esa
 * lista podian verlos audiencias distintas sin que nada en pantalla lo dijera. Ahora la tabla es
 * el arbol, y cada carpeta lleva su ambito al lado con el enlace para configurarlo.
 */
export default async function ModulosPage() {
  const seccion = sectionOf('/admin/modules');
  const [t, definiciones, arbol] = await Promise.all([
    translator(),
    modules.list(),
    getGeneralTree(),
  ]);

  const porId = new Map(definiciones.map((m) => [m.moduleId, m]));
  const filas = organizationRows(arbol, porId);
  const sueltos = looseModules(arbol, porId);
  const esperando = definiciones.filter((m) => m.status === 'pendiente-de-aprobacion');

  return (
    <section>
      <h2>{t('admin.modules.title')}</h2>
      <p className="muted-text">{seccion?.desc}</p>

      <SectionIndex sections={seccion?.hijas ?? []} />

      {/*
        Lo que espera una decision va PRIMERO y aparte.
        En un arbol, un modulo propuesto hace tres semanas queda enterrado en una subcarpeta y no
        lo ve nadie — igual que pasaba en la lista ordenada por nombre.
      */}
      {esperando.length > 0 ? (
        <div className="notice-atencion" data-testid="modulos-esperando">
          {t('admin.modules.awaiting', {
            n: esperando.length,
            nombres: t.lista(esperando.map((m) => m.name)),
          })}{' '}
          <Link href="/admin/modules/pending" data-testid="ir-a-pendientes">
            {t('admin.review.go')}
          </Link>
        </div>
      ) : null}

      <h3>{t('admin.modules.current', { n: definiciones.length })}</h3>
      <p className="muted-text">{t('admin.modules.tree.intro')}</p>

      <div className="container-table">
        <table className="tabla" data-testid="tabla-modulos">
          <thead>
            <tr>
              <th scope="col">{t('admin.modules.column.module')}</th>
              <th scope="col">{t('admin.modules.column.status')}</th>
              <th scope="col">{t('admin.modules.column.version')}</th>
              <th scope="col">{t('admin.modules.column.pages')}</th>
              <th scope="col">{t('admin.modules.column.objects')}</th>
              <th scope="col">{t('admin.modules.column.author')}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <Fila key={`${fila.tipo}-${fila.id}`} fila={fila} t={t} />
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Lo que el arbol no coloca. Un borrador recien creado entra en la organizacion general al
        publicarse, asi que hasta entonces no cuelga de ninguna carpeta: sin esta tabla habria
        desaparecido de la pantalla justo al pasar de lista plana a arbol.
      */}
      {sueltos.length > 0 ? (
        <>
          <h3>{t('admin.modules.loose', { n: sueltos.length })}</h3>
          <p className="muted-text">{t('admin.modules.loose.intro')}</p>
          <div className="container-table">
            <table className="tabla" data-testid="tabla-modulos-sueltos">
              <thead>
                <tr>
                  <th scope="col">{t('admin.modules.column.module')}</th>
                  <th scope="col">{t('admin.modules.column.status')}</th>
                  <th scope="col">{t('admin.modules.column.version')}</th>
                  <th scope="col">{t('admin.modules.column.pages')}</th>
                  <th scope="col">{t('admin.modules.column.objects')}</th>
                  <th scope="col">{t('admin.modules.column.author')}</th>
                </tr>
              </thead>
              <tbody>
                {sueltos.map((m) => (
                  <Fila
                    key={m.moduleId}
                    fila={{ tipo: 'modulo', id: m.moduleId, profundidad: 0, modulo: m }}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="muted-text">
        {t('admin.modules.footer')} <Link href="/editor">{t('admin.modules.footer.link')}</Link>
      </p>
    </section>
  );
}

function Fila({ fila, t }: { fila: FilaOrganizacion; t: Translator }) {
  if (fila.tipo === 'carpeta') return <Carpeta fila={fila} t={t} />;

  const m = fila.modulo;
  return (
    <tr data-testid={`modulo-${m.slug}`} data-depth={fila.profundidad}>
      <th scope="row" style={SANGRIA(fila.profundidad)}>
        <Link href={`/editor/${m.slug}`}>{m.name}</Link>
        <span className="muted-text"> /m/{m.slug}</span>
      </th>
      <td>{ESTADO[m.status] ? t(ESTADO[m.status] as MessageKey) : m.status}</td>
      <td>
        {/* La version es el enlace a lo que hubo antes: es la pregunta que se hace mirando ese
            numero. */}
        <Link href={`/admin/modules/${m.slug}/history`} data-testid={`history-${m.slug}`}>
          v{m.version}
        </Link>
      </td>
      <td>{m.pages.length}</td>
      <td>
        <ModuleObjects slug={m.slug} objetos={objectsOfModule(m)} t={t} />
      </td>
      <td>{m.ownerUserId ?? '—'}</td>
    </tr>
  );
}

/**
 * Una carpeta, con sus permisos al lado.
 *
 * El ambito de la carpeta es lo que decide quien ve los modulos que contiene (4.10.6), asi que se
 * configura DESDE aqui y no en otra pantalla: mirando el arbol es cuando alguien se pregunta por
 * que ese modulo lo ve quien lo ve. El enlace lleva al editor de ambitos con la carpeta ya
 * elegida — un camino, no dos, para que la puerta de `wouldExpand` y la auditoria sigan siendo
 * las mismas.
 */
function Carpeta({ fila, t }: { fila: FilaCarpeta; t: Translator }) {
  const restricciones = fila.scope?.restrictions ?? [];

  return (
    <tr className="fila-carpeta" data-testid={`carpeta-${fila.id}`} data-depth={fila.profundidad}>
      <th scope="row" colSpan={4} style={SANGRIA(fila.profundidad)}>
        <span className="fila-carpeta__nombre">{fila.nombre}</span>{' '}
        <span className="muted-text">{t('admin.modules.folder.count', { n: fila.modulos })}</span>
      </th>
      <td data-testid={`carpeta-${fila.id}-ambito`}>
        {restricciones.length === 0 ? (
          <span className="muted-text">{t('admin.modules.folder.inherits')}</span>
        ) : (
          <span className="insignia">
            {t('admin.modules.folder.restricts', {
              cuales: t.lista(restricciones.map((r) => `${r.dimension.table}.${r.dimension.field}`)),
            })}
          </span>
        )}
      </td>
      <td>
        <Link
          href={`/admin/scopes?destino=${encodeURIComponent(fila.id)}`}
          data-testid={`permisos-${fila.id}`}
        >
          {t('admin.modules.folder.configure')}
        </Link>
      </td>
    </tr>
  );
}
