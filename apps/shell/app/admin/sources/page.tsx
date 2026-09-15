import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat } from '@app/observability';
import { activeScheme } from '../../../src/server/admin';
import { activeConnector, cacheL2 } from '../../../src/server/context';
import { translator } from '../../../src/server/locale';
import { paginaDeAdmin } from '../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * De donde salen los datos y si esta alcanzable — secciones 2.2, 6.4 y 7.
 *
 * Lo que se ve aqui lo escribio la TAREA de poblacion, no una consulta que lance esta pantalla. El
 * principio 2 dice que solo el poblador llama al conector, y el panel de administracion es justo
 * donde seria tentador saltarselo para «probar la conexion».
 */
export default async function OrigenesPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const [t, connector, schema, latido] = await Promise.all([
    translator(),
    activeConnector(),
    activeScheme(),
    cacheL2
      .get<PopulatorHeartbeat>(POPULATOR_HEARTBEAT_KEY)
      .then((e) => e?.value ?? null)
      .catch(() => null),
  ]);

  return (
    <section>
      <h2>{t('admin.sources.title')}</h2>
      <p className="muted-text">{t('admin.sources.intro')}</p>

      <div className="tarjetas" data-testid="resumen-origenes">
        <div className="tarjeta">
          <span className="card__value" data-testid="conector-activo">
            {connector}
          </span>
          <span className="card__label">{t('admin.sources.connector')}</span>
        </div>
        <div className={`tarjeta ${latido?.connectorReachable === false ? 'alert-card' : ''}`}>
          <span className="card__value" data-testid="conector-alcanzable">
            {latido === null
              ? '—'
              : t(latido.connectorReachable ? 'admin.sources.yes' : 'admin.sources.no')}
          </span>
          <span className="card__label">{t('admin.sources.answered')}</span>
        </div>
        <div className="tarjeta">
          <span className="card__value" data-testid="datasets-poblados">
            {latido?.datasets.filter((d) => d.outcome === 'ok').length ?? 0}
          </span>
          <span className="card__label">{t('admin.sources.inCache')}</span>
        </div>
      </div>

      <h3>{t('admin.sources.lastPopulation')}</h3>
      {latido === null ? (
        /*
         * Sin latido no se concluye que el origen este caido: puede ser que la tarea no haya
         * corrido todavia. Decir «caido» aqui mandaria a revisar la red cuando falta una ejecucion.
         */
        <p className="muted-text" data-testid="sin-latido">
          {t('admin.sources.noHeartbeat')}
        </p>
      ) : (
        <>
          <p className="muted-text" data-testid="latido">
            {t('admin.sources.heartbeat', {
              fecha: t.fecha(latido.finishedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
              conector: latido.connector,
            })}{' '}
            {latido.lastFullSuccessAt
              ? t('admin.sources.heartbeat.complete', {
                  fecha: t.fecha(latido.lastFullSuccessAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })
              : t('admin.sources.heartbeat.noCompleteRun')}
          </p>
          <table className="tabla" data-testid="tabla-datasets">
            <thead>
              <tr>
                <th scope="col">{t('admin.sources.column.dataset')}</th>
                <th scope="col">{t('admin.sources.column.result')}</th>
                <th scope="col">{t('admin.sources.column.rows')}</th>
                <th scope="col">{t('admin.sources.column.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {latido.datasets.map((d) => (
                <tr key={d.datasetId} data-testid={`dataset-${d.datasetId}`}>
                  <th scope="row">{d.datasetId}</th>
                  <td>
                    {d.outcome === 'ok'
                      ? t('admin.sources.populated')
                      : t('admin.sources.failure', {
                          motivo: d.error ?? t('admin.sources.noDetail'),
                        })}
                  </td>
                  <td>{d.rowCount === undefined ? '—' : t.numero(d.rowCount)}</td>
                  <td>{t.numero(d.durationMs)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3>{t('admin.sources.schema')}</h3>
      {schema === null ? (
        <p className="muted-text" data-testid="sin-esquema">
          {t('admin.sources.noSchema')}
        </p>
      ) : (
        <>
          <p className="muted-text" data-testid="esquema-fecha">
            {t('admin.sources.schemaDate', {
              fecha: t.fecha(schema.fetchedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </p>
          <ul className="resource-list" data-testid="tablas-esquema">
            {schema.tables.map((tabla) => (
              <li key={tabla.name} className="resource" data-testid={`tabla-${tabla.name}`}>
                <div className="resource__head">
                  <h4 className="resource__name">{tabla.name}</h4>
                  <span className="muted-text">
                    {t('admin.sources.fields', { n: tabla.fields.length })}
                  </span>
                </div>
                <p className="muted-text">
                  {tabla.fields
                    .filter((f) => !f.isMeasure)
                    .map((f) => (f.isKey ? `${f.name} (${t('admin.sources.key')})` : f.name))
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>

          <h4>{t('admin.sources.measures', { n: schema.measures.length })}</h4>
          <table className="tabla" data-testid="tabla-medidas">
            <thead>
              <tr>
                <th scope="col">{t('admin.sources.column.measure')}</th>
                <th scope="col">{t('admin.sources.column.table')}</th>
                <th scope="col">{t('admin.sources.column.aggregation')}</th>
              </tr>
            </thead>
            <tbody>
              {schema.measures.map((m) => (
                <tr key={`${m.table}.${m.name}`} data-testid={`medida-${m.name}`}>
                  <th scope="row">{m.name}</th>
                  <td>{m.table}</td>
                  <td>{m.aggregation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
