import type { ModuleDefinition } from '@app/module-model';
import { migrateDefinition } from '@app/module-model';
import { KEY_HISTORY, KEY_MODULES, mutar, leer } from './almacenCompartido';
import { markInstalled } from './installation';
import { demoModules } from './modules';

/**
 * Una version publicada, tal y como se publico.
 *
 * Es una FOTO completa de la definicion, no un diff. Un diff hay que saber contra que aplicarlo,
 * y en cuanto falta un eslabon de la cadena deja de poder reconstruirse; una foto se lee sola
 * diez anos despues. Pesan poco —una definicion son objetos y posiciones, no datos— y el volumen
 * lo acota que solo se guarda al PUBLICAR, que es un acto deliberado de una persona.
 */
export interface PublishedVersion {
  moduleId: string;
  version: number;
  publishedAt: string;
  /** Quien pulso publicar. El autor del contenido puede ser otro: lo dice la auditoria. */
  publishedBy: string;
  /** De que version se restauro, si esta publicacion fue una vuelta atras. */
  restoredFrom?: number;
  definition: ModuleDefinition;
}

/** Almacen de definiciones de modulo — secciones 4.1 y 4.2. */
export interface ModuleStore {
  list(): Promise<ModuleDefinition[]>;
  get(moduleId: string): Promise<ModuleDefinition | undefined>;
  bySlug(slug: string): Promise<ModuleDefinition | undefined>;
  save(module: ModuleDefinition): Promise<void>;
  remove(moduleId: string): Promise<boolean>;
  /** Anade una version al historial. Solo se llama al publicar. */
  versionRecord(entrada: PublishedVersion): Promise<void>;
  /** El historial de un modulo, de la version mas nueva a la mas vieja. */
  history(moduleId: string): Promise<PublishedVersion[]>;
}

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

/**
 * La version con la que nacio cada modulo publicado de la semilla.
 *
 * El historial solo se escribia al PUBLICAR, y los modulos de la semilla no pasan por ahi: nacen
 * ya publicados en la version 1. El resultado era un historial que empezaba en la v2 —o vacio,
 * si nadie habia vuelto a publicar— y una pantalla que decia «no hay versiones» de un modulo que
 * llevaba meses sirviendose. Lo que estuvo publicado tiene que constar, lo haya publicado una
 * persona o la semilla.
 *
 * `publishedBy` es el sistema y no una persona: nadie pulso publicar, y poner ahi al primer
 * Administrador seria atribuirle un acto que no hizo.
 */
export const SEMILLA = 'sistema';

const demoHistory = (): PublishedVersion[] =>
  demoModules
    .filter((m) => m.status === 'publicado')
    .map((m) => ({
      moduleId: m.moduleId,
      version: m.version,
      publishedAt: m.updatedAt,
      publishedBy: SEMILLA,
      definition: clonar(m),
    }));

export class StoreModuleRepository implements ModuleStore {
  private async all(): Promise<ModuleDefinition[]> {
    // Igual que el gobierno: sin nada guardado se devuelve la semilla SIN persistirla, para no
    // meter una escritura en el camino de lectura.
    const guardados = (await leer<ModuleDefinition[]>(KEY_MODULES)) ?? clonar(demoModules);

    /*
     * La migracion de claves va AQUI, en el camino de lectura — apartado 2.11.
     *
     * Las definiciones se guardan como JSON, asi que renombrar una propiedad en el tipo deja de
     * leer lo que ya esta escrito sin que el compilador diga nada: el JSON es `unknown` para el.
     * Lo que se ve es un modulo que pierde su formato, no un error.
     *
     * Al leer y no en un comando de una vez: un comando hay que acordarse de ejecutarlo en cada
     * entorno, y el que se olvide se descubre cuando alguien abre un modulo. Es idempotente, asi
     * que se queda puesto para siempre en vez de borrarse «cuando ya no haga falta», que es una
     * fecha que nadie decide.
     */
    return guardados.map((m) => migrateDefinition(m));
  }

  /**
   * Cambia la lista entera bajo turno.
   *
   * Los modulos son UN valor en el almacen, asi que dos ediciones simultaneas de modulos
   * DISTINTOS se pisan igual que dos del mismo: cada una lee la lista, cambia lo suyo y la
   * escribe entera. Con el autoguardado del editor esto no es hipotetico —basta con dos
   * personas editando a la vez— y lo que se pierde no es un campo, es el modulo entero de quien
   * escribio primero.
   */
  private async cambiarTodos(
    cambio: (actuales: ModuleDefinition[]) => ModuleDefinition[],
  ): Promise<void> {
    await mutar<ModuleDefinition[]>(KEY_MODULES, (guardados) =>
      cambio(guardados ?? clonar(demoModules)),
    );
    await markInstalled(KEY_MODULES);
  }

  async list(): Promise<ModuleDefinition[]> {
    return this.all();
  }

  async get(moduleId: string): Promise<ModuleDefinition | undefined> {
    return (await this.all()).find((m) => m.moduleId === moduleId);
  }

  async bySlug(slug: string): Promise<ModuleDefinition | undefined> {
    return (await this.all()).find((m) => m.slug === slug);
  }

  async save(module: ModuleDefinition): Promise<void> {
    await this.cambiarTodos((actuales) => [
      ...actuales.filter((m) => m.moduleId !== module.moduleId),
      clonar(module),
    ]);
  }

  async remove(moduleId: string): Promise<boolean> {
    // El «existia?» se decide DENTRO del turno: fuera, entre mirar y borrar cabe otra escritura
    // y se responderia sobre una lista que ya no es la que se borro.
    let borrado = false;
    await this.cambiarTodos((actuales) => {
      const quedan = actuales.filter((m) => m.moduleId !== moduleId);
      borrado = quedan.length !== actuales.length;
      return quedan;
    });
    if (!borrado) return false;
    // El historial NO se borra con el modulo. Es el registro de lo que estuvo publicado, y sirve
    // justamente para responder «que veia la gente entonces» cuando el modulo ya no esta.
    return true;
  }

  /**
   * El historial es de SOLO ANADIR.
   *
   * `save()` reemplaza la definicion vigente, que es lo que tiene que hacer. Lo que faltaba es
   * que la version anterior sobreviviera a ese reemplazo: `version: modulo.version + 1` contaba
   * publicaciones y no guardaba ninguna, asi que la aplicacion decia versionar —el principio 8 y
   * la seccion 4.5 dicen que un objeto publicado nunca se modifica, se publica otra version— y
   * lo que hacia era sobrescribir con un contador al lado.
   */
  async versionRecord(entrada: PublishedVersion): Promise<void> {
    await mutar<PublishedVersion[]>(KEY_HISTORY, (guardadas) => {
      const actuales = guardadas ?? demoHistory();
      // Misma version del mismo modulo dos veces: es un reintento, no una publicacion nueva.
      // La comprobacion va dentro del turno; fuera, dos reintentos simultaneos la pasaban los
      // dos y el historial —que es de solo anadir— acababa con la misma version repetida.
      const yaEsta = actuales.some(
        (v) => v.moduleId === entrada.moduleId && v.version === entrada.version,
      );
      return yaEsta ? actuales : [...actuales, clonar(entrada)];
    });
  }

  async history(moduleId: string): Promise<PublishedVersion[]> {
    // Sin nada guardado se devuelve la semilla SIN persistirla, igual que `all()`: una lectura
    // que escribe convierte abrir una pantalla en un cambio de estado.
    const actuales = (await leer<PublishedVersion[]>(KEY_HISTORY)) ?? demoHistory();
    return actuales
      .filter((v) => v.moduleId === moduleId)
      /*
       * El historial tambien migra, y por una razon mas fuerte que la lista: de aqui sale lo que
       * se RESTAURA. Sin esto, volver a una version de antes del renombrado devolveria el modulo
       * a la forma vieja y lo dejaria sin formato justo despues de restaurarlo.
       */
      .map((v) => ({ ...v, definition: migrateDefinition(v.definition) }))
      .sort((a, b) => b.version - a.version);
  }
}

export const modules: ModuleStore = new StoreModuleRepository();
