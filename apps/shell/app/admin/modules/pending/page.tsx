import Link from 'next/link';
import { listUsers } from '../../../../src/server/context';
import { actorDe, pendingReviews } from '../../../../src/server/cicloDeVida';
import { pageSessionRequire } from '../../../../src/server/session';
import { ReviewActions } from '../../../../src/components/admin/ReviewActions';
import type { ModuleDiff } from '@app/module-model';
import { translator } from '../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/** Cuanto lleva esperando, en palabras. Un ISO no dice si son horas o semanas. */
function hace(desde: string): string {
  const ms = Date.now() - new Date(desde).getTime();
  const horas = Math.floor(ms / 3_600_000);
  if (horas < 1) return 'hace menos de una hora';
  if (horas < 24) return `hace ${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} dia${dias === 1 ? '' : 's'}`;
}

/**
 * La cola de revision — seccion 4.1.
 *
 * Estaba en `/editor`, mezclada con los borradores propios de quien miraba: para revisar una
 * propuesta habia que reconocerla entre los suyos, abrirla y acordarse de como estaba antes.
 * Aqui esta sola, con quien la propuso, cuanto lleva esperando y QUE cambia respecto a lo que
 * hay publicado. Aprobar sin ver el cambio es firmar en blanco.
 */

/**
 * El cambio, en palabras.
 *
 * Vive aparte y no como un ternario anidado dentro de la lista: tres ramas metidas en el JSX se
 * leen peor que una funcion con nombre, y ademas la del medio colapsaba en una linea
 * —`) : diff.identical ? (`— que el trinquete de cadenas sueltas contaba como texto de pantalla.
 */
function Changes({
  slug,
  diff,
  t,
}: {
  slug: string;
  diff: ModuleDiff | undefined;
  t: Awaited<ReturnType<typeof translator>>;
}) {
  if (diff === undefined) {
    return (
      <div data-testid={`pending-diff-${slug}`}>
        <p className="muted-text">{t('admin.review.first')}</p>
      </div>
    );
  }
  if (diff.identical) {
    return (
      <div data-testid={`pending-diff-${slug}`}>
        <p className="muted-text">{t('admin.review.identical')}</p>
      </div>
    );
  }
  return (
    <div data-testid={`pending-diff-${slug}`}>
          <ul>
            {diff.renamed ? (
              <li>
                {t('admin.review.renamed', {
                  de: diff.renamed.from,
                  a: diff.renamed.to,
                })}
              </li>
            ) : null}
            {diff.addedPages.map((p) => (
              <li key={`p+${p}`}>{t('admin.review.pageAdded', { nombre: p })}</li>
            ))}
            {diff.removedPages.map((p) => (
              <li key={`p-${p}`}>{t('admin.review.pageRemoved', { nombre: p })}</li>
            ))}
            {diff.addedObjects.map((o) => (
              <li key={`o+${o.id}`}>
                {t('admin.review.objectAdded', { titulo: o.title })}{' '}
                <span className="muted-text">({o.pageName})</span>
              </li>
            ))}
            {diff.removedObjects.map((o) => (
              <li key={`o-${o.id}`}>
                {t('admin.review.objectRemoved', { titulo: o.title })}{' '}
                <span className="muted-text">({o.pageName})</span>
              </li>
            ))}
            {diff.changedObjects.map((o) => (
              <li key={`o~${o.id}`}>
                {t('admin.review.objectChanged', { titulo: o.title })}{' '}
                <span className="muted-text">({o.pageName})</span>
              </li>
            ))}
          </ul>
    </div>
  );
}

export default async function PendingPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const sesion = await pageSessionRequire();
  const actor = await actorDe(sesion);
  const [pendientes, personas, t] = await Promise.all([
    pendingReviews(actor),
    listUsers(),
    translator(),
  ]);
  const nombreDe = (id: string) => personas.find((u) => u.userId === id)?.displayName ?? id;

  return (
    <section>
      <h2>{t('admin.review.title')}</h2>
      <p className="muted-text">{t('admin.review.intro')}</p>

      <p>
        <Link href="/admin/modules">← {t('admin.modules.title')}</Link>
      </p>

      {pendientes.length === 0 ? (
        <p className="aviso notice-ok" data-testid="pending-empty">
          {t('admin.review.empty')}
        </p>
      ) : (
        <ul className="registro" data-testid="pending-list">
          {pendientes.map(({ module, proposedBy, proposedAt, diff, locks }) => (
            <li key={module.moduleId} className="log__row" data-testid={`pending-${module.slug}`}>
              <div>
                <h3>
                  <Link href={`/editor/${module.slug}`}>{module.name}</Link>{' '}
                  <span className="muted-text">/m/{module.slug}</span>
                </h3>
                <p className="muted-text">
                  {proposedBy
                    ? t('admin.review.proposedBy', { quien: nombreDe(proposedBy) })
                    : t('admin.review.proposed')}
                  {proposedAt ? `, ${hace(proposedAt)}` : ''}
                </p>

                {locks.length > 0 ? (
                  <p className="aviso notice-error" data-testid={`pending-locks-${module.slug}`}>
                    {t('admin.review.locked', {
                      detalle: locks.map((b) => b.detail).join(' · '),
                    })}
                  </p>
                ) : null}

                {/*
                  El cambio, en palabras. Lo que se puede decir sin conocer la forma de cada
                  objeto del catalogo es CUAL cambio, no que propiedad: decirlo asi siempre es
                  cierto, y el enlace al modulo ensena el resto.
                */}
                <Changes slug={module.slug} diff={diff} t={t} />

                <ReviewActions slug={module.slug} publicable={locks.length === 0} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
