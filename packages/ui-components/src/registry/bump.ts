import type { PresentationKey } from '../presentation/contract';
import { classifyBump, compareVersions } from './semver';
import type { ObjectInstance, VisualObjectDefinition } from './types';

/**
 * Subir una instancia a otra version del objeto — seccion 4.5.
 *
 * La regla que lo ordena todo: **lo que ya estaba configurado se conserva; solo lo nuevo cae a su
 * valor por defecto**. Una instancia lleva anos con su acento, su formato y sus textos elegidos a
 * mano por alguien; subirla de version no puede ser una excusa para devolverla a la casilla de
 * salida. Lo unico que puede cambiar es lo que la version nueva ya no admite, y eso no se
 * descarta en silencio: se devuelve en la lista de `retiradas` para que quien sube lo lea ANTES
 * de confirmar.
 *
 * Lo que NO hace es rellenar las claves nuevas con un valor. Se quedan ausentes, y ausente es
 * precisamente como el dibujante aplica su valor por defecto: escribirlo aqui congelaria hoy un
 * defecto que manana cambia, y ademas haria imposible distinguir «nadie lo ha tocado» de «alguien
 * eligio justo el defecto».
 */

export interface BumpResult {
  /** La instancia ya subida. Es una copia: no se toca la original. */
  instance: ObjectInstance;
  /** Claves de presentacion que se conservan tal cual estaban. */
  preserved: PresentationKey[];
  /** Las que la version nueva ya no admite y por eso se quitan, con su valor anterior. */
  retiradas: { clave: PresentationKey; valor: unknown }[];
  /** Las que la version nueva anade y esta instancia no tenia: quedan en su valor por defecto. */
  nuevas: PresentationKey[];
}

export class BumpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BumpError';
  }
}

/** La version publicada mas alta de un objeto, que es la que el editor ofrece. */
export function latestVersion(definition: VisualObjectDefinition): string | undefined {
  return [...definition.versions].sort((a, b) => compareVersions(a.version, b.version)).at(-1)
    ?.version;
}

/**
 * Si subir de `desde` a `hasta` puede cambiar lo que se ve.
 *
 * Un salto de MAYOR es, por definicion, un cambio incompatible: el numero existe para decir eso.
 * Se devuelve aparte para que la interfaz pueda avisar con mas fuerza, no para impedirlo — hay
 * saltos de mayor que una instancia concreta absorbe sin enterarse.
 */
export function isMajorJump(desde: string, hasta: string): boolean {
  return classifyBump(desde, hasta) === 'mayor';
}

export function bumpInstance(
  instance: ObjectInstance,
  definition: VisualObjectDefinition,
  hasta: string,
): BumpResult {
  if (definition.objectId !== instance.objectId) {
    throw new BumpError(
      `La definicion es de '${definition.objectId}' y la instancia de '${instance.objectId}'.`,
    );
  }

  const destino = definition.versions.find((v) => v.version === hasta);
  if (!destino) {
    throw new BumpError(`El objeto '${instance.objectId}' no tiene la version '${hasta}'.`);
  }
  if (compareVersions(hasta, instance.version) < 0) {
    // Bajar de version es otra operacion, con otras preguntas: lo que la version vieja no admite
    // no se puede "conservar", y llamarlo bump escondería que se esta retrocediendo.
    throw new BumpError(
      `'${hasta}' es anterior a la version actual '${instance.version}'. Subir no es retroceder.`,
    );
  }

  const origen = definition.versions.find((v) => v.version === instance.version);
  const admiteDestino = new Set<PresentationKey>(destino.presentation);
  const admiteOrigen = new Set<PresentationKey>(origen?.presentation ?? []);

  const puestas = Object.entries(instance.presentation ?? {}) as [PresentationKey, unknown][];

  const preserved: PresentationKey[] = [];
  const retiradas: { clave: PresentationKey; valor: unknown }[] = [];
  const presentation: Record<string, unknown> = {};

  for (const [clave, valor] of puestas) {
    // Una clave sin valor no esta configurada: no hay nada que conservar ni que avisar.
    if (valor === undefined) continue;
    if (admiteDestino.has(clave)) {
      preserved.push(clave);
      presentation[clave] = valor;
    } else {
      retiradas.push({ clave, valor });
    }
  }

  // Nuevas: las que la version de destino anade y la de origen no tenia. No las que esta
  // instancia no habia configurado — esas ya estaban en su defecto y ahi siguen.
  const nuevas = [...admiteDestino].filter((c) => !admiteOrigen.has(c));

  const subida: ObjectInstance = {
    ...instance,
    version: hasta,
    ...(Object.keys(presentation).length > 0
      ? { presentation: presentation as ObjectInstance['presentation'] }
      : {}),
  };
  if (Object.keys(presentation).length === 0) delete subida.presentation;

  return { instance: subida, preserved, retiradas, nuevas };
}
