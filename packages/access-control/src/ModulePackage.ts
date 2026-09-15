import type { NavNode } from './NavigationTree';

/** Paquete visual — seccion 4.1.3. */
export interface ModulePackage {
  id: string;
  name: string;
  /**
   * Arbol de presentation: usa los mismos moduleId que la organizacion general, pero puede
   * agruparlos en carpetas distintas, con otro nombre/icono, y en otro orden.
   */
  visualTree: NavNode[];
}

/** Un nodo de un paquete que referencia algo no concedido o inexistente en el arbol general. */
export interface DanglingPackageNode {
  nodeId: string;
  moduleId: string;
  reason: 'fuera-de-lo-concedido' | 'no-existe-en-organizacion-general';
}
