import { KEY_INSTALLATION, leer, mutar } from './almacenCompartido';

/**
 * Distingue un despliegue NUEVO de uno que perdio su estado.
 *
 * El gobierno y los modulos caen a la semilla cuando no hay nada guardado, y eso es correcto: un
 * despliegue recien hecho tiene que poder arrancar. Pero significa que si el almacen se pierde,
 * la aplicacion **no falla**: vuelve a los datos de demostracion y parece sana. Ese es el modo de
 * fallo mas peligroso que tiene esta aplicacion, porque una contingencia que nadie dispara no
 * sirve de nada — y nadie la dispara si nada avisa.
 *
 * El centinela lo escribe la primera vez que alguien guarda gobierno o modulos, o sea la primera
 * vez que este despliegue deja de depender de la semilla. A partir de ahi, encontrarlo sin
 * encontrar lo que ampara solo puede querer decir una cosa.
 *
 * LO QUE ESTO NO PUEDE VER: si el almacen desaparece ENTERO, el centinela se va con el y lo que
 * queda es indistinguible de un despliegue nuevo. Desde dentro no hay forma de saberlo, porque no
 * queda nada desde donde mirar. Eso lo cubre el procedimiento —`docs/operations/contingencia.md`—
 * y no el codigo. Lo que si caza, y es el caso frecuente, es la perdida PARCIAL: un borrado
 * dirigido, una migracion a medias, un despliegue que se llevo una clave por delante.
 */

export interface InstallationMark {
  /** Identificador de esta instalacion. No es un secreto: solo distingue una de otra. */
  id: string;
  since: string;
  /**
   * Las claves que este despliegue llego a escribir alguna vez.
   *
   * Se guarda la lista y no un simple «ya arranco» porque cada ancla cae a la semilla por su
   * cuenta: un despliegue donde alguien toco el gobierno y nunca los modulos tiene `app:modulos`
   * ausente con toda legitimidad. Con un centinela unico eso se leia como estado perdido, que es
   * una falsa alarma — y una guarda que grita sin motivo es una guarda que se acaba apagando.
   */
  anchors: string[];
}

export type StateStatus = 'en-marcha' | 'nueva' | 'estado-perdido';

export interface StateReport {
  status: StateStatus;
  /** Las claves ancla que se esperaban y no estan. Vacio salvo en `estado-perdido`. */
  missing: string[];
}

/**
 * Deja constancia de que este despliegue ya tiene estado propio. Idempotente.
 *
 * Se invoca desde las escrituras de gobierno y de modulos, que son las que hacen que la semilla
 * deje de ser la verdad. No se escribe al LEER: eso metia una escritura en el camino mas
 * concurrido, que es la razon por la que la caida a la semilla no se persiste.
 */
export async function markInstalled(anchor: string): Promise<void> {
  // Bajo turno: dos escrituras simultaneas de anclas distintas se pisarian la lista igual que se
  // pisarian el gobierno, y la que perdiera dejaria su ancla sin amparo.
  await mutar<InstallationMark>(KEY_INSTALLATION, (actual) => {
    const marca = actual ?? {
      id: `inst-${Date.now().toString(36)}`,
      since: new Date().toISOString(),
      anchors: [],
    };
    return marca.anchors.includes(anchor)
      ? marca
      : { ...marca, anchors: [...marca.anchors, anchor] };
  });
}

/** Que le paso al estado de este despliegue. */
export async function stateStatus(): Promise<StateReport> {
  const marca = await leer<InstallationMark>(KEY_INSTALLATION);
  // Sin centinela, faltar es lo normal: nadie ha guardado nada todavia.
  if (!marca) return { status: 'nueva', missing: [] };

  const missing: string[] = [];
  for (const clave of marca.anchors) {
    if ((await leer<unknown>(clave)) === undefined) missing.push(clave);
  }

  return missing.length === 0
    ? { status: 'en-marcha', missing: [] }
    : { status: 'estado-perdido', missing };
}
