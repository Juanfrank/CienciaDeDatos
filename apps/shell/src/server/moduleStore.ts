import type { ModuleDefinition } from '@app/module-model';
import { write, leer } from './almacenCompartido';
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

export const KEY_MODULES = 'app:modulos';
export const KEY_HISTORY = 'app:modulos:historial';

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

export class StoreModuleRepository implements ModuleStore {
  private async all(): Promise<ModuleDefinition[]> {
    // Igual que el gobierno: sin nada guardado se devuelve la semilla SIN persistirla, para no
    // meter una escritura en el camino de lectura.
    return (await leer<ModuleDefinition[]>(KEY_MODULES)) ?? clonar(demoModules);
  }

  private async guardarTodos(modules: ModuleDefinition[]): Promise<void> {
    await write(KEY_MODULES, modules);
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
    const actuales = await this.all();
    await this.guardarTodos([
      ...actuales.filter((m) => m.moduleId !== module.moduleId),
      clonar(module),
    ]);
  }

  async remove(moduleId: string): Promise<boolean> {
    const actuales = await this.all();
    const quedan = actuales.filter((m) => m.moduleId !== moduleId);
    if (quedan.length === actuales.length) return false;
    await this.guardarTodos(quedan);
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
    const actuales = (await leer<PublishedVersion[]>(KEY_HISTORY)) ?? [];
    // Misma version del mismo modulo dos veces: es un reintento, no una publicacion nueva.
    const yaEsta = actuales.some(
      (v) => v.moduleId === entrada.moduleId && v.version === entrada.version,
    );
    if (yaEsta) return;
    await write(KEY_HISTORY, [...actuales, clonar(entrada)]);
  }

  async history(moduleId: string): Promise<PublishedVersion[]> {
    const actuales = (await leer<PublishedVersion[]>(KEY_HISTORY)) ?? [];
    return actuales.filter((v) => v.moduleId === moduleId).sort((a, b) => b.version - a.version);
  }
}

export const modules: ModuleStore = new StoreModuleRepository();
