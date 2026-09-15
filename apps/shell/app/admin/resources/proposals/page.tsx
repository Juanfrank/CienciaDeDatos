import Link from 'next/link';
import { initialCatalog } from '@app/ui-components';
import type { MessageKey } from '@app/i18n';
import { listProposals } from '../../../../src/server/catalogo';
import { listUsers } from '../../../../src/server/context';
import { translator } from '../../../../src/server/locale';
import { ProposalForm } from '../../../../src/components/admin/ProposalForm';
import { ProposalActions } from '../../../../src/components/admin/ProposalActions';
import { paginaDeAdmin } from '../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * Propuestas sobre el catalogo de objetos — seccion 4.5.
 *
 * El catalogo es CODIGO, y eso no es un accidente: cada version declara pruebas en verde y
 * revision por pares, y no se puede afirmar ninguna de las dos cosas sobre algo que alguien acaba
 * de teclear en un formulario. Por eso el permiso del Colaborador es «proponer objetos al
 * repositorio» y no «crear objetos».
 *
 * Lo que esta pantalla gobierna, entonces, es la DECISION: quien propuso que version, que cambia,
 * y si se certifica o se devuelve con motivo. El codigo sigue llegando por el repositorio.
 */
export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const query = await searchParams;
  const preseleccion = typeof query['objeto'] === 'string' ? query['objeto'] : '';

  const [propuestas, personas, t] = await Promise.all([
    listProposals(),
    listUsers(),
    translator(),
  ]);
  const nombreDe = (id: string) => personas.find((u) => u.userId === id)?.displayName ?? id;

  return (
    <section>
      <h2>{t('admin.proposals.title')}</h2>
      <p className="muted-text">{t('admin.proposals.intro')}</p>

      <p>
        <Link href="/admin/resources">← {t('admin.resources.title')}</Link>
      </p>

      <ProposalForm
        objetos={initialCatalog.map((o) => ({ id: o.objectId, name: o.name }))}
        preseleccion={preseleccion}
        etiquetas={{
          titulo: t('admin.proposals.new'),
          objeto: t('admin.proposals.field.object'),
          version: t('admin.proposals.field.version'),
          resumen: t('admin.proposals.field.summary'),
          enviar: t('admin.proposals.submit'),
        }}
      />

      {propuestas.length === 0 ? (
        <p className="muted-text" data-testid="proposals-empty">
          {t('admin.proposals.empty')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="proposals-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.proposals.column.object')}</th>
                <th scope="col">{t('admin.resources.column.version')}</th>
                <th scope="col">{t('admin.proposals.column.change')}</th>
                <th scope="col">{t('admin.proposals.column.who')}</th>
                <th scope="col">{t('admin.resources.column.state')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {propuestas.map((p) => (
                <tr key={p.id} data-testid={`propuesta-${p.id}`}>
                  <th scope="row">
                    {initialCatalog.find((o) => o.objectId === p.objectId)?.name ?? p.objectId}
                  </th>
                  <td>v{p.version}</td>
                  <td>
                    {p.summary}
                    {p.motivo ? (
                      <p className="muted-text" data-testid={`propuesta-${p.id}-motivo`}>
                        {p.motivo}
                      </p>
                    ) : null}
                  </td>
                  <td>{nombreDe(p.proposedBy)}</td>
                  <td data-testid={`propuesta-${p.id}-estado`}>
                    {t(`admin.proposals.status.${p.status}` as MessageKey)}
                  </td>
                  <td>
                    {p.status === 'pendiente' ? (
                      <ProposalActions
                        id={p.id}
                        etiquetas={{
                          aprobar: t('admin.proposals.approve'),
                          devolver: t('admin.proposals.return'),
                          motivo: t('admin.review.reason'),
                          cancelar: t('action.cancel'),
                        }}
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
      )}
    </section>
  );
}
