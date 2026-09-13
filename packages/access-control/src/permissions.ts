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
  | 'borrar-definitivamente';

const MATRIZ: Record<Capability, readonly AppRole[]> = {
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
  'borrar-definitivamente': ['administrador'],
};

export function can(role: AppRole, capability: Capability): boolean {
  return MATRIZ[capability].includes(role);
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
    reason: `El rol '${role}' no puede '${capability}'. Permitido para: ${MATRIZ[capability].join(', ')}.`,
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
  return (Object.keys(MATRIZ) as Capability[]).filter((c) => can(role, c));
}
