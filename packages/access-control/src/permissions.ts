import type { AppRole } from './Team';

/** Matriz de permisos por rol — seccion 4.10.1. */

export type Capability =
  | 'ver-modulos-de-sus-equipos'
  | 'personalizar-su-vista'
  | 'crear-editar-modulos-borrador'
  | 'proponer-objetos-al-repositorio'
  | 'publicar-modulo-institucional'
  | 'gestionar-equipos'
  | 'gestionar-usuarios-y-roles'
  | 'configurar-ambitos'
  | 'ver-panel-auditoria'
  | 'reorganizar-arbol-general'
  | 'gestionar-paquetes-visuales'
  | 'gestionar-temas'
  | 'borrar-definitivamente';

const MATRIX: Record<Capability, readonly AppRole[]> = {
  'ver-modulos-de-sus-equipos': ['administrador', 'colaborador', 'visor'],
  'personalizar-su-vista': ['administrador', 'colaborador', 'visor'],
  'crear-editar-modulos-borrador': ['administrador', 'colaborador'],
  // Colaborador puede proponer, pero la propuesta pasa por certificacion (4.5).
  'proponer-objetos-al-repositorio': ['administrador', 'colaborador'],
  // Colaborador solo propone; la publicacion institucional la aprueba un Administrador.
  'publicar-modulo-institucional': ['administrador'],
  'gestionar-equipos': ['administrador'],
  'gestionar-usuarios-y-roles': ['administrador'],
  'configurar-ambitos': ['administrador'],
  'ver-panel-auditoria': ['administrador'],
  // 4.1.2: mover un nodo es un cambio ESTRUCTURAL que puede cambiar el ambito de datos de un
  // modulo, asi que esta reservado a Administrador aunque "mover" suene a algo cosmetico.
  'reorganizar-arbol-general': ['administrador'],
  'gestionar-paquetes-visuales': ['administrador'],
  // Un tema cambia el color de TODA la institucion, y el contraste que 4.9 exige sale de el.
  'gestionar-temas': ['administrador'],
  'borrar-definitivamente': ['administrador'],
};

/**
 * Las capacidades en el orden en que se explican, no alfabetico.
 *
 * Va de lo que puede todo el mundo a lo que solo puede un Administrador, porque asi la matriz se
 * lee como una escalera y la separacion de 4.10.1 —el Colaborador propone, el Administrador
 * publica— cae donde se ve. Ordenarla por nombre la convierte en una lista de la compra.
 *
 * Sale de `MATRIX`, no de una lista escrita a mano: una capacidad nueva aparece aqui sola. Lo
 * unico que hace falta declarar aparte es donde ponerla.
 */
const ORDEN: readonly Capability[] = [
  'ver-modulos-de-sus-equipos',
  'personalizar-su-vista',
  'crear-editar-modulos-borrador',
  'proponer-objetos-al-repositorio',
  'publicar-modulo-institucional',
  'reorganizar-arbol-general',
  'gestionar-paquetes-visuales',
  'gestionar-temas',
  'gestionar-equipos',
  'gestionar-usuarios-y-roles',
  'configurar-ambitos',
  'ver-panel-auditoria',
  'borrar-definitivamente',
];

export const CAPABILITIES: readonly Capability[] = [
  ...ORDEN,
  // Una capacidad que se anada a `MATRIX` y no a `ORDEN` sale igualmente, al final: es mejor que
  // se vea sin orden a que desaparezca de la matriz sin que nadie lo note.
  ...(Object.keys(MATRIX) as Capability[]).filter((c) => !ORDEN.includes(c)),
];

/** Los roles que pueden una capacidad, para poder DIBUJAR la matriz de 4.10.1. */
export function rolesThatCan(capability: Capability): readonly AppRole[] {
  return MATRIX[capability];
}

export function can(role: AppRole, capability: Capability): boolean {
  return MATRIX[capability].includes(role);
}

export interface PermissionDenial {
  capability: Capability;
  role: AppRole;
  reason: string;
}

export function denial(role: AppRole, capability: Capability): PermissionDenial {
  return {
    capability,
    role,
    reason: `El rol '${role}' no puede '${capability}'. Permitido para: ${MATRIX[capability].join(', ')}.`,
  };
}

/** Comprobacion que debe ejecutarse en el BACKEND, no solo ocultando botones. */
export function assertCan(role: AppRole, capability: Capability): void {
  if (!can(role, capability)) {
    const d = denial(role, capability);
    throw new PermissionError(d);
  }
}

export class PermissionError extends Error {
  constructor(readonly denial: PermissionDenial) {
    super(denial.reason);
    this.name = 'PermissionError';
  }
}

/** Capacidades de un rol, para que la interfaz oculte lo que no aplica. */
export function capabilitiesOf(role: AppRole): Capability[] {
  return (Object.keys(MATRIX) as Capability[]).filter((c) => can(role, c));
}
