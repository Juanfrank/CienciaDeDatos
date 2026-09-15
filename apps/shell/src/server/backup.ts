import { createHash } from 'node:crypto';
import { migrateDefinition } from '@app/module-model';
import type { CacheEntry } from '@app/caching';
import { cacheL2 } from './almacenCompartido';

/**
 * Respaldo y restauracion del estado autoritativo — contingencia contra desastres.
 *
 * El gobierno de esta aplicacion —quien ve que, que modulos hay, que se publico y cuando, que
 * cambio y quien lo autorizo— no se puede reconstruir. Los datasets del cache si: son una copia
 * de la fuente y el job los vuelve a traer. El gobierno lo escribio una persona decidiendo.
 *
 * De ahi que lo que se respalda y lo que no sea una decision DECLARADA, clave por clave, y no el
 * resultado de copiar un directorio. Copiar el directorio entero se llevaria las sesiones y los
 * tokens de un solo uso, y restaurarlo los devolveria a la vida: sesiones que alguien revoco y
 * enlaces de restablecimiento ya gastados. Un respaldo que hace eso no es una red de seguridad,
 * es un agujero con fecha.
 */

export type BackupClass = 'respaldar' | 'no-respaldar';

export interface ClassifiedPrefix {
  /** Prefijo de clave en el almacen. El mas LARGO que case es el que manda. */
  prefix: string;
  kind: BackupClass;
  /** Por que. Sale en el informe de restauracion cuando algo se rechaza. */
  reason: string;
}

/**
 * Cada prefijo del almacen, con su clase y su motivo.
 *
 * Es la unica fuente de verdad: de aqui leen el volcado, la restauracion y la guarda de
 * cobertura de `tools/coherence`. Una clave nueva que no case con ningun prefijo no se respalda
 * en silencio — enrojece la guarda, que es lo que evita que esta tabla envejezca.
 */
export const CLASSES: ClassifiedPrefix[] = [
  {
    prefix: 'app:gobierno',
    kind: 'respaldar',
    reason: 'El arbol, los equipos, los ambitos y los paquetes. Nadie puede rehacerlo.',
  },
  {
    prefix: 'app:modulos:historial',
    kind: 'respaldar',
    reason: 'Foto completa de cada version publicada: es el registro de que se veia entonces.',
  },
  {
    prefix: 'app:modulos',
    kind: 'respaldar',
    reason: 'Las definiciones vigentes, con sus paginas, objetos y filtros.',
  },
  {
    prefix: 'app:auditoria',
    kind: 'respaldar',
    reason: 'Cambios de configuracion con su actor y su justificacion (seccion 7).',
  },
  {
    prefix: 'app:catalogo:gobierno',
    kind: 'respaldar',
    reason: 'Objetos retirados, propuestas decididas y la presentacion por defecto.',
  },
  {
    prefix: 'app:incrustaciones',
    kind: 'respaldar',
    reason: 'Perderla revive codigos revocados y borra la trazabilidad de 4.9.',
  },
  { prefix: 'app:marcadores', kind: 'respaldar', reason: 'Marcadores propios y compartidos.' },
  {
    prefix: 'app:personalizacion:',
    kind: 'respaldar',
    reason: 'Una clave por persona y modulo (4.6); por eso el respaldo enumera por prefijo.',
  },
  { prefix: 'app:instalacion', kind: 'respaldar', reason: 'El centinela que distingue un despliegue nuevo de uno que perdio el estado.' },
  { prefix: 'alerts:rules', kind: 'respaldar', reason: 'Reglas de alerta escritas por personas.' },
  {
    prefix: 'alerts:subscriptions',
    kind: 'respaldar',
    reason: 'Envios programados que alguien configuro.',
  },
  {
    prefix: 'auth:auditoria-login',
    kind: 'respaldar',
    reason: 'Rastro de acceso consolidado (seccion 7).',
  },

  /*
   * Y lo que NO vuelve. El motivo importa tanto como la clase: quien lea esta tabla dentro de
   * tres anos tiene que poder decidir si sigue valiendo.
   */
  {
    prefix: 'auth:credencial:',
    kind: 'no-respaldar',
    reason:
      'Lleva el secreto TOTP en claro: un respaldo con esto seria el segundo factor de toda la ' +
      'institucion en un archivo. Se recupera con `npm run crear-administrador` y el ' +
      'restablecimiento mediado.',
  },
  {
    prefix: 'auth:sesiones-de:',
    kind: 'no-respaldar',
    reason: 'Indice de sesiones: devolverlo resucita sesiones que alguien revoco.',
  },
  {
    prefix: 'auth:sesion:',
    kind: 'no-respaldar',
    reason: 'Una sesion restaurada es una sesion revocada que vuelve a valer.',
  },
  {
    prefix: 'auth:reset-indice:',
    kind: 'no-respaldar',
    reason: 'Indice de restablecimientos; sigue a los tokens.',
  },
  {
    prefix: 'auth:reset:',
    kind: 'no-respaldar',
    reason: 'Token de un solo uso: restaurarlo devuelve la vida a uno ya gastado.',
  },
  {
    prefix: 'auth:credenciales-sembradas',
    kind: 'no-respaldar',
    reason: 'Centinela idempotente de la siembra de demostracion.',
  },
  {
    prefix: 'alerts:states',
    kind: 'no-respaldar',
    reason: 'Se recalcula; lo unico que cuesta perderlo es una re-notificacion.',
  },
  {
    prefix: 'alerts:inbox:',
    kind: 'no-respaldar',
    reason: 'Bandeja de avisos ya entregados, que ademas se trunca sola.',
  },
  {
    prefix: 'alerts:last-heartbeat',
    kind: 'no-respaldar',
    reason: 'Centinela del ultimo latido evaluado.',
  },
  {
    prefix: 'export:',
    kind: 'no-respaldar',
    reason: 'Artefactos con plazo de una hora, y son datos judiciales ya filtrados (5.3).',
  },
  {
    prefix: 'config:',
    kind: 'no-respaldar',
    reason: 'Ultima foto buena de App Configuration: se repuebla de la fuente.',
  },
  { prefix: 'ops:', kind: 'no-respaldar', reason: 'Latido y esquema: los escribe el job.' },
  { prefix: 'ds:', kind: 'no-respaldar', reason: 'Datasets: los repuebla el job desde la fuente.' },
];

/** La clase de una clave, por el prefijo MAS LARGO que case. */
export function classOf(key: string): ClassifiedPrefix | undefined {
  return CLASSES.filter((c) => key.startsWith(c.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
}

export interface BackupManifest {
  /** Version del formato. Un respaldo de otra version se rechaza en vez de leerse a medias. */
  format: 1;
  takenAt: string;
  keys: number;
  /** Cuantas claves aporto cada prefijo. Es lo que se lee de un vistazo antes de restaurar. */
  byPrefix: Record<string, number>;
  checksum: string;
}

export interface Backup {
  manifest: BackupManifest;
  entries: Record<string, CacheEntry<unknown>>;
}

const FORMAT: BackupManifest['format'] = 1;

/**
 * Suma estable del contenido: las claves se ordenan antes de serializar.
 *
 * Se exporta para que la prueba use ESTA y no una copia. Una prueba que reimplementa el algoritmo
 * comprueba que dos copias coinciden entre si, que es lo unico que no hace falta demostrar.
 */
export function checksumOf(entries: Record<string, CacheEntry<unknown>>): string {
  // Un array ordenado de pares, serializado de una vez: sin separadores que inventar ni
  // caracteres de control en el codigo fuente, y sin ambiguedad entre clave y contenido.
  const pares = Object.keys(entries)
    .sort()
    .map((clave) => [clave, entries[clave]]);
  return createHash('sha256').update(JSON.stringify(pares)).digest('hex');
}

/** Vuelca el estado autoritativo. No toca nada: solo lee. */
export async function backupState(): Promise<Backup> {
  const entries: Record<string, CacheEntry<unknown>> = {};
  const byPrefix: Record<string, number> = {};

  for (const { prefix, kind } of CLASSES) {
    if (kind !== 'respaldar') continue;
    let cuantas = 0;
    for (const key of await cacheL2.keysByPrefix(prefix)) {
      // Una clave puede casar con dos prefijos —`app:modulos` y `app:modulos:historial`— y el
      // que manda es el mas largo. Sin esto, el historial se contaria dos veces.
      if (classOf(key)?.prefix !== prefix) continue;
      const entrada = await cacheL2.get<unknown>(key);
      if (!entrada) continue;
      entries[key] = entrada;
      cuantas += 1;
    }
    byPrefix[prefix] = cuantas;
  }

  return {
    manifest: {
      format: FORMAT,
      takenAt: new Date().toISOString(),
      keys: Object.keys(entries).length,
      byPrefix,
      checksum: checksumOf(entries),
    },
    entries,
  };
}

export interface RestoreReport {
  applied: boolean;
  written: string[];
  rejected: { key: string; reason: string }[];
}

/** El respaldo no se puede leer. Se distingue para que el comando no lo confunda con un fallo. */
export class UnreadableBackup extends Error {}

export interface RestoreOptions {
  /** En seco por defecto: dice que haria sin escribir nada. */
  apply?: boolean;
}

/**
 * Devuelve el estado guardado al almacen.
 *
 * Rechaza toda clave cuya clase sea `no-respaldar` aunque venga en el archivo — la exclusion es
 * una REGLA, no un descuido de quien volco: un respaldo editado a mano no puede resucitar una
 * sesion revocada. Y rechaza la que no case con ningun prefijo: si nadie la clasifico, nadie
 * decidio que fuera segura de devolver.
 */
export async function restoreState(
  backup: Backup,
  options: RestoreOptions = {},
): Promise<RestoreReport> {
  if (backup?.manifest?.format !== FORMAT) {
    throw new UnreadableBackup(
      `Formato de respaldo '${String(backup?.manifest?.format)}'; esta version lee el ${FORMAT}.`,
    );
  }
  if (checksumOf(backup.entries) !== backup.manifest.checksum) {
    // Antes de escribir, no despues: media restauracion es peor que ninguna.
    throw new UnreadableBackup('La suma de comprobacion no cuadra: el respaldo esta alterado.');
  }

  const written: string[] = [];
  const rejected: { key: string; reason: string }[] = [];

  for (const key of Object.keys(backup.entries).sort()) {
    const clase = classOf(key);
    if (!clase) {
      rejected.push({ key, reason: 'Sin clasificar: nadie decidio que fuera seguro devolverla.' });
      continue;
    }
    if (clase.kind !== 'respaldar') {
      rejected.push({ key, reason: clase.reason });
      continue;
    }
    written.push(key);
  }

  if (options.apply) {
    for (const key of written) {
      await cacheL2.set(key, migrated(key, backup.entries[key] as CacheEntry<unknown>));
    }
  }

  return { applied: Boolean(options.apply), written, rejected };
}

/**
 * La migracion de claves renombradas, al restaurar.
 *
 * Es la misma que `moduleStore` aplica al leer, y por el mismo motivo: un respaldo de hace un ano
 * trae las definiciones con los nombres de entonces. Sin esto, restaurar devolveria modulos que
 * la aplicacion lee a medias —sin formato y sin que nada falle—, que es justo el modo de fallo
 * del que va el apartado 2.11.
 */
function migrated(key: string, entry: CacheEntry<unknown>): CacheEntry<unknown> {
  if (key === 'app:modulos' && Array.isArray(entry.value)) {
    return { ...entry, value: entry.value.map((m) => migrateDefinition(m)) };
  }
  if (key === 'app:modulos:historial' && Array.isArray(entry.value)) {
    return {
      ...entry,
      value: entry.value.map((v) => {
        const version = v as { definition?: unknown };
        return version?.definition
          ? { ...version, definition: migrateDefinition(version.definition) }
          : version;
      }),
    };
  }
  return entry;
}
