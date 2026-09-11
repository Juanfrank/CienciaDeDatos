import type { NavNode } from './NavigationTree';

/**
 * Paquete visual — seccion 4.1.3.
 *
 * Reorganizacion PURAMENTE VISUAL de los modulos ya accesibles para un equipo, sin alterar
 * ni la organizacion general ni el ambito de acceso de nadie.
 *
 * Un paquete es una vista, no un permiso. Puede reagrupar en carpetas visuales distintas,
 * renombrar, reordenar u ocultar; nunca puede mostrar un modulo que la organizacion general
 * y el ambito resuelto no permitan ya para ese equipo.
 *
 * La resolucion de ambito efectivo (4.10.4) NUNCA consulta un paquete: camina siempre la
 * organizacion general. Eso es lo que garantiza que un paquete no pueda, ni por accidente,
 * ampliar el acceso de nadie.
 */
export interface ModulePackage {
  id: string;
  name: string;
  /**
   * Arbol de presentacion: usa los mismos moduleId que la organizacion general, pero puede
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
