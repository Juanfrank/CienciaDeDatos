import { POPULATOR_HEARTBEAT_KEY, type PopulatorHeartbeat, summarizeHeartbeat } from './heartbeat';

/** Endpoint de salud — seccion 7. */

export type HealthStatus = 'ok' | 'degradado' | 'caido';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  detail?: string;
}

export interface HealthReport {
  status: HealthStatus;
  checkedAt: string;
  /** Conector configurado como activo, leido de App Configuration. */
  configuredConnector: string;
  checks: HealthCheckResult[];
}

export interface HealthProbeInput {
  /** Conector activo segun App Configuration. Es un valor de configuracion, no una instancia. */
  configuredConnector: string;
  /** Conectividad al Storage Account del cache (6.2). */
  cacheStoreReachable: boolean;
  /** Conectividad a la base de identidad: sin ella no hay sesion ni autorizacion. */
  identityDbReachable: boolean;
  /** Latido del job (6.4). null si nunca se ha ejecutado o no se pudo leer. */
  heartbeat: PopulatorHeartbeat | null;
  /** Antiguedad maxima tolerada del latido antes de considerar el job atrasado. */
  maxHeartbeatAgeMs?: number;
  now?: () => number;
}

const PEOR: Record<HealthStatus, number> = { ok: 0, degradado: 1, caido: 2 };

function peorDe(results: HealthCheckResult[]): HealthStatus {
  return results.reduce<HealthStatus>(
    (peor, r) => (PEOR[r.status] > PEOR[peor] ? r.status : peor),
    'ok',
  );
}

export function buildHealthReport(input: HealthProbeInput): HealthReport {
  const now = input.now ?? Date.now;
  const maxAge = input.maxHeartbeatAgeMs ?? 60 * 60 * 1000;
  const checks: HealthCheckResult[] = [];

  // Sin base de identidad no hay sesion ni resolucion de ambito: la aplicacion no puede servir.
  checks.push({
    name: 'base-de-identidad',
    status: input.identityDbReachable ? 'ok' : 'caido',
    ...(input.identityDbReachable ? {} : { detail: 'No se alcanza la base de identidad.' }),
  });

  // El Storage del cache caido es DEGRADADO, no caido: la aplicacion sigue sirviendo desde L1
  // el ultimo dato valido conocido (6.9). Marcarlo como caido haria que las sondas reiniciaran
  // instancias sanas justo cuando mas hacen falta.
  checks.push({
    name: 'cache-l2',
    status: input.cacheStoreReachable ? 'ok' : 'degradado',
    ...(input.cacheStoreReachable
      ? {}
      : { detail: 'Storage de cache inalcanzable; se sirve desde L1 el ultimo dato valido.' }),
  });

  if (!input.heartbeat) {
    checks.push({
      name: 'job-de-poblacion',
      status: 'degradado',
      detail: `Sin latido del job en el cache (clave ${POPULATOR_HEARTBEAT_KEY}).`,
    });
    checks.push({
      name: 'conector-de-datos',
      status: 'degradado',
      detail: 'Conectividad desconocida: el job aun no ha reportado una ejecucion.',
    });
  } else {
    const hb = input.heartbeat;
    const edad = now() - new Date(hb.finishedAt).getTime();
    const resumen = summarizeHeartbeat(hb);

    checks.push({
      name: 'job-de-poblacion',
      status: edad > maxAge ? 'degradado' : resumen.todosOk ? 'ok' : 'degradado',
      detail:
        edad > maxAge
          ? `Ultima ejecucion hace ${Math.round(edad / 60000)} min, por encima del umbral.`
          : resumen.todosOk
            ? `${resumen.total} datasets poblados sin fallo.`
            : `${resumen.fallidos} de ${resumen.total} datasets fallaron; se conserva la version anterior.`,
    });

    // La conectividad reportada es la que OBSERVO el job, no una prueba del proceso web.
    checks.push({
      name: 'conector-de-datos',
      status: hb.connectorReachable ? 'ok' : 'degradado',
      detail: hb.connectorReachable
        ? `Conector '${hb.connector}' alcanzable en la ultima ejecucion del job.`
        : `El job no alcanzo el conector '${hb.connector}' en su ultima ejecucion.`,
    });

    // Una discrepancia entre lo configurado y lo que el job uso significa que el job todavia
    // no ha recogido un cambio de conector: no es un fallo, pero hay que verlo.
    if (hb.connector !== input.configuredConnector) {
      checks.push({
        name: 'coherencia-de-conector',
        status: 'degradado',
        detail: `Configurado '${input.configuredConnector}' pero el job poblo con '${hb.connector}'. El job aun no ha recogido el cambio.`,
      });
    }
  }

  return {
    status: peorDe(checks),
    checkedAt: new Date(now()).toISOString(),
    configuredConnector: input.configuredConnector,
    checks,
  };
}
