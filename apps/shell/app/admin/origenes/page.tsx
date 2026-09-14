import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat } from '@app/observability';
import { activeScheme } from '../../../src/server/admin';
import { activeConnector, cacheL2 } from '../../../src/server/context';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * De donde salen los datos y si esta alcanzable — secciones 2.2, 6.4 y 7.
 *
 * Lo que se ve aqui lo escribio la TAREA de poblacion, no una consulta que lance esta pantalla. El
 * principio 2 dice que solo el poblador llama al conector, y el panel de administracion es justo
 * donde seria tentador saltarselo para «probar la conexion».
 */
export default async function OrigenesPage() {
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
      <h2>{t('admin.origenes.titulo')}</h2>
      <p className="muted-text">{t('admin.origenes.intro')}</p>

      <div className="tarjetas" data-testid="resumen-origenes">
        <div className="tarjeta">
          <span className="card__value" data-testid="conector-activo">
            {connector}
          </span>
          <span className="card__label">{t('admin.origenes.conector')}</span>
        </div>
        <div className={`tarjeta ${latido?.connectorReachable === false ? 'alert-card' : ''}`}>
          <span className="card__value" data-testid="conector-alcanzable">
            {latido === null
              ? '—'
              : t(latido.connectorReachable ? 'admin.origenes.si' : 'admin.origenes.no')}
          </span>
          <span className="card__label">{t('admin.origenes.respondio')}</span>
        </div>
        <div className="tarjeta">
          <span className="card__value" data-testid="datasets-poblados">
            {latido?.datasets.filter((d) => d.outcome === 'ok').length ?? 0}
          </span>
          <span className="card__label">{t('admin.origenes.enCache')}</span>
        </div>
      </div>

      <h3>{t('admin.origenes.ultimaPoblacion')}</h3>
      {latido === null ? (
        /*
         * Sin latido no se concluye que el origen este caido: puede ser que la tarea no haya
         * corrido todavia. Decir «caido» aqui mandaria a revisar la red cuando falta una ejecucion.
         */
        <p className="muted-text" data-testid="sin-latido">
          {t('admin.origenes.sinLatido')}
        </p>
      ) : (
        <>
          <p className="muted-text" data-testid="latido">
            {t('admin.origenes.latido', {
              fecha: t.fecha(latido.finishedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
              conector: latido.connector,
            })}{' '}
            {latido.lastFullSuccessAt
              ? t('admin.origenes.latido.completa', {
                  fecha: t.fecha(latido.lastFullSuccessAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })
              : t('admin.origenes.latido.sinCompleta')}
          </p>
          <table className="tabla" data-testid="tabla-datasets">
            <thead>
              <tr>
                <th scope="col">{t('admin.origenes.columna.dataset')}</th>
                <th scope="col">{t('admin.origenes.columna.resultado')}</th>
                <th scope="col">{t('admin.origenes.columna.filas')}</th>
                <th scope="col">{t('admin.origenes.columna.duracion')}</th>
              </tr>
            </thead>
            <tbody>
              {latido.datasets.map((d) => (
                <tr key={d.datasetId} data-testid={`dataset-${d.datasetId}`}>
                  <th scope="row">{d.datasetId}</th>
                  <td>
                    {d.outcome === 'ok'
                      ? t('admin.origenes.poblado')
                      : t('admin.origenes.fallo', {
                          motivo: d.error ?? t('admin.origenes.sinDetalle'),
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

      <h3>{t('admin.origenes.esquema')}</h3>
      {schema === null ? (
        <p className="muted-text" data-testid="sin-esquema">
          {t('admin.origenes.sinEsquema')}
        </p>
      ) : (
        <>
          <p className="muted-text" data-testid="esquema-fecha">
            {t('admin.origenes.esquemaFecha', {
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
                    {t('admin.origenes.campos', { n: tabla.fields.length })}
                  </span>
                </div>
                <p className="muted-text">
                  {tabla.fields
                    .filter((f) => !f.isMeasure)
                    .map((f) => (f.isKey ? `${f.name} (${t('admin.origenes.clave')})` : f.name))
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>

          <h4>{t('admin.origenes.medidas', { n: schema.measures.length })}</h4>
          <table className="tabla" data-testid="tabla-medidas">
            <thead>
              <tr>
                <th scope="col">{t('admin.origenes.columna.medida')}</th>
                <th scope="col">{t('admin.origenes.columna.tabla')}</th>
                <th scope="col">{t('admin.origenes.columna.agregacion')}</th>
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
