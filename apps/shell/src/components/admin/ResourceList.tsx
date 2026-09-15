import Link from 'next/link';
import type { Translator } from '@app/i18n';
import { ResourceActions } from './ResourceActions';
import { TablaBuscable } from './TablaBuscable';

/**
 * Los recursos de una familia, en TABLA.
 *
 * Es la misma pantalla para visualizaciones, elementos, contenedores y complementos: lo unico que
 * cambia es que familia del catalogo se le pasa. Cuatro pantallas identicas escritas cuatro veces
 * acaban divergiendo en la quinta.
 *
 * Era una lista de tarjetas, y una tarjeta se lee bien de una en una y mal de quince en quince:
 * para comparar «que version corre cada uno» habia que recorrerlas con el dedo. Una tabla pone la
 * misma pregunta en una columna, y deja sitio para las acciones sin inventar un menu.
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
  /** Cuantas instancias hay colocadas. Retirar algo que nadie usa no es lo mismo que retirarlo. */
  uses: number;
  /** En cuantos MODULOS distintos, que es la pregunta que se hace al retirar o al subir. */
  modulos: number;
  /** Cuantos de esos modulos estan anclados a una version que ya no es la ultima. */
  atrasados: number;
  /** Deshabilitado: sigue en los modulos que ya lo tienen, pero el editor no lo ofrece. */
  disabled?: boolean;
  /**
   * La institucion fijo con que formato nace este objeto al colocarlo.
   *
   * Se ensena en la tabla porque, sin decirlo, un objeto que sale de fabrica con la leyenda abajo
   * y otro que no son indistinguibles hasta que se coloca uno de cada.
   */
  predeterminado?: boolean;
}


/**
 * El estado de un recurso: deshabilitado, retirado o vigente.
 *
 * Aparte y no como un ternario anidado dentro de la fila: tres ramas metidas en el JSX se leen
 * peor que una funcion con nombre, y la del medio colapsa en una linea —`) : retirada ? (`— que
 * el trinquete de cadenas sueltas cuenta como texto de pantalla.
 */
function Estado({
  disabled,
  retirada,
  t,
}: {
  disabled: boolean;
  retirada: boolean;
  t: Translator;
}) {
  if (disabled) {
    return <span className="insignia badge--error">{t('admin.resources.action.disable')}</span>;
  }
  if (retirada) {
    return <span className="insignia">{t('admin.resources.state.deprecated')}</span>;
  }
  return <span className="muted-text">{t('admin.resources.state.active')}</span>;
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
  return (
    <>
      <p>
        {/*
          Proponer, no crear. El catalogo son artefactos certificados (4.5): lo que esta pantalla
          gobierna es la DECISION de certificar, no el codigo del objeto.
        */}
        <Link href="/admin/resources/proposals" className="pastilla" data-testid={`add-${familia}`}>
          {t('admin.resources.add')}
        </Link>
      </p>

      {rows.length === 0 ? (
        <p className="muted-text" data-testid={`sin-recursos-${familia}`}>
          {t('admin.resources.empty')}
        </p>
      ) : (
        <TablaBuscable
          testid={`recursos-${familia}`}
          filas={rows.map((r) => ({ id: r.id, texto: `${r.name} ${r.id} ${r.description}` }))}
          cabecera={
            <thead>
              <tr>
                <th scope="col">{t('admin.resources.column.resource')}</th>
                <th scope="col">{t('admin.resources.column.version')}</th>
                <th scope="col">{t('admin.resources.column.usage')}</th>
                <th scope="col">{t('admin.resources.column.state')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
          }
        >
          {rows.map((r) => {
                const retirada = r.versions.some((v) => v.deprecation !== undefined);
                return (
                  <tr key={r.id} data-testid={`recurso-${r.id}`}>
                    <th scope="row">
                      {r.name}
                      <p className="muted-text">{r.description}</p>
                    </th>

                    <td data-testid={`recurso-${r.id}-version`}>
                      {/*
                        El historial va PLEGADO y no en otra pagina: lo que se pregunta noventa
                        veces es «que version corre», y una vez «que cambio».
                      */}
                      <details data-testid={`recurso-${r.id}-historial`}>
                        <summary>v{r.current}</summary>
                        <ol className="resource__versions">
                          {[...r.versions].reverse().map((v) => (
                            <li key={v.version}>
                              <b>v{v.version}</b> · {t.fecha(v.publishedAt)} ·{' '}
                              {t('admin.resources.reviewedBy', { quien: v.reviewedBy })}
                              <p>{v.changelog}</p>
                              {v.deprecation ? (
                                <p
                                  className="notice-atencion"
                                  data-testid={`recurso-${r.id}-retirada`}
                                >
                                  {t('admin.resources.deprecated', {
                                    desde: v.deprecation.since,
                                    motivo: v.deprecation.reason,
                                  })}
                                  {v.deprecation.replacement
                                    ? ` ${t('admin.resources.replacement', {
                                        que: v.deprecation.replacement,
                                      })}`
                                    : ''}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </td>

                    <td data-testid={`recurso-${r.id}-usos`}>
                      {r.modulos === 0 ? (
                        <span className="muted-text">{t('admin.resources.usage.none')}</span>
                      ) : (
                        <>
                          <Link href={`/admin/resources/usage/${r.id}`}>
                            {t('admin.resources.usage.modules', { n: r.modulos })}
                          </Link>
                          {r.atrasados > 0 ? (
                            <p className="muted-text" data-testid={`recurso-${r.id}-atrasados`}>
                              {t('admin.resources.usage.behind', { n: r.atrasados })}
                            </p>
                          ) : null}
                        </>
                      )}
                    </td>

                    <td data-testid={`recurso-${r.id}-estado`}>
                      <Estado disabled={r.disabled === true} retirada={retirada} t={t} />
                      {r.predeterminado ? (
                        <p className="muted-text" data-testid={`recurso-${r.id}-predeterminado`}>
                          {t('admin.resources.state.customized')}
                        </p>
                      ) : null}
                    </td>

                    <td>
                      <ResourceActions
                        id={r.id}
                        disabled={r.disabled === true}
                        etiquetas={{
                          editar: t('admin.resources.action.edit'),
                          proponer: t('admin.resources.action.propose'),
                          deshabilitar: t('admin.resources.action.disable'),
                          habilitar: t('admin.resources.action.enable'),
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
        </TablaBuscable>
      )}

      <p className="muted-text">
        {t('admin.resources.footer')}{' '}
        <Link href="/admin/audit">{t('admin.resources.footer.link')}</Link>
      </p>
    </>
  );
}

