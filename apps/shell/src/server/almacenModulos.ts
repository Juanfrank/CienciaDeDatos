import type { ModuleDefinition } from '@app/module-model';
import { escribir, leer } from './almacenCompartido';
import { modulosDemo } from './modulos';

/** Almacen de definiciones de modulo — secciones 4.1 y 4.2. */
export interface ModuleStore {
  list(): Promise<ModuleDefinition[]>;
  get(moduleId: string): Promise<ModuleDefinition | undefined>;
  bySlug(slug: string): Promise<ModuleDefinition | undefined>;
  save(module: ModuleDefinition): Promise<void>;
  remove(moduleId: string): Promise<boolean>;
}

export const CLAVE_MODULOS = 'app:modulos';

const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

export class StoreModuleRepository implements ModuleStore {
  private async todos(): Promise<ModuleDefinition[]> {
    // Igual que el gobierno: sin nada guardado se devuelve la semilla SIN persistirla, para no
    // meter una escritura en el camino de lectura.
    return (await leer<ModuleDefinition[]>(CLAVE_MODULOS)) ?? clonar(modulosDemo);
  }

  private async guardarTodos(modulos: ModuleDefinition[]): Promise<void> {
    await escribir(CLAVE_MODULOS, modulos);
  }

  async list(): Promise<ModuleDefinition[]> {
    return this.todos();
  }

  async get(moduleId: string): Promise<ModuleDefinition | undefined> {
    return (await this.todos()).find((m) => m.moduleId === moduleId);
  }

  async bySlug(slug: string): Promise<ModuleDefinition | undefined> {
    return (await this.todos()).find((m) => m.slug === slug);
  }

  async save(module: ModuleDefinition): Promise<void> {
    const actuales = await this.todos();
    await this.guardarTodos([
      ...actuales.filter((m) => m.moduleId !== module.moduleId),
      clonar(module),
    ]);
  }

  async remove(moduleId: string): Promise<boolean> {
    const actuales = await this.todos();
    const quedan = actuales.filter((m) => m.moduleId !== moduleId);
    if (quedan.length === actuales.length) return false;
    await this.guardarTodos(quedan);
    return true;
  }
}

export const modulos: ModuleStore = new StoreModuleRepository();
