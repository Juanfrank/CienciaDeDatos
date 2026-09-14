import Link from 'next/link';
import type { Translator } from '@app/i18n';

/**
 * La lista de recursos de una familia, con su version y su historial.
 *
 * Es la misma pantalla para visualizaciones, elementos, contenedores y complementos: lo unico que
 * cambia es que familia del catalogo se le pasa. Cuatro pantallas identicas escritas cuatro veces
 * acaban divergiendo en la quinta.
 */

export interface ResourceVersion {
  version: string;
  publishedAt: string;
  changelog: string;
  reviewedBy: string;
  /** Si esta version esta marcada como retirada, con su motivo. */
  deprecation?: { since: string; reason: string; replacement?: string };
}

export interface ResourceRow {
  id: string;
  name: string;
  description: string;
  /** La ultima publicada, que es la que el editor ofrece. */
  current: string;
  versions: ResourceVersion[];
  /** Cuantos modulos la usan hoy. Retirar algo que nadie usa no es lo mismo que retirarlo. */
  uses: number;
}

export function ResourceList({
  rows,
  familia,
  t,
}: {
  rows: ResourceRow[];
  familia: string;
  t: Translator;
}) {
  if (rows.length === 0) {
    return (
      <p className="muted-text" data-testid={`sin-recursos-${familia}`}>
        {t('admin.resources.empty')}
      </p>
    );
  }

  return (
    <ul className="resource-list" data-testid={`recursos-${familia}`}>
      {rows.map((r) => (
        <li key={r.id} className="resource" data-testid={`recurso-${r.id}`}>
          <div className="resource__head">
            <h3 className="resource__name">{r.name}</h3>
            <span className="insignia" data-testid={`recurso-${r.id}-version`}>
              v{r.current}
            </span>
            <span className="muted-text" data-testid={`recurso-${r.id}-usos`}>
              {r.uses === 0 ? t('admin.resources.unused') : t('admin.resources.inUse', { n: r.uses })}
            </span>
          </div>
          <p className="muted-text">{r.description}</p>

          {/*
            El historial va PLEGADO y no en otra pagina: lo que se pregunta noventa veces es «que
            version corre», y una vez «que cambio». Un enlace mas obligaria a volver.
          */}
          <details data-testid={`recurso-${r.id}-historial`}>
            <summary>{t('admin.resources.history', { n: r.versions.length })}</summary>
            <ol className="resource__versions">
              {[...r.versions].reverse().map((v) => (
                <li key={v.version}>
                  <b>v{v.version}</b> · {t.fecha(v.publishedAt)} ·{' '}
                  {t('admin.resources.reviewedBy', { quien: v.reviewedBy })}
                  <p>{v.changelog}</p>
                  {v.deprecation ? (
                    <p className="notice-atencion" data-testid={`recurso-${r.id}-retirada`}>
                      {t('admin.resources.deprecated', {
                        desde: v.deprecation.since,
                        motivo: v.deprecation.reason,
                      })}
                      {v.deprecation.replacement
                        ? ` ${t('admin.resources.replacement', { que: v.deprecation.replacement })}`
                        : ''}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        </li>
      ))}
      <li className="muted-text">
        {t('admin.resources.footer')}{' '}
        <Link href="/admin/audit">{t('admin.resources.footer.link')}</Link>
      </li>
    </ul>
  );
}
