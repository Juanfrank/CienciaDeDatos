import type { AccessScope } from './AccessScope';

/** Roles de aplicacion — exactamente tres, no configurables (4.10.1). */
export type AppRole = 'administrador' | 'colaborador' | 'visor';

export const APP_ROLES: readonly AppRole[] = ['administrador', 'colaborador', 'visor'];

export interface TeamMember {
  userId: string;
  role: AppRole;
}

/** Equipo — seccion 4.10.2. */
export interface Team {
  id: string;
  name: string;
  /**
   * Nodos concedidos del arbol general: carpetas completas (con todo lo que contengan)
   * y/o modulos individuales sueltos. Conceder una carpeta es conceder todo su contenido.
   */
  grantedNodes: string[];
  members: TeamMember[];
  /** Ambito general del equipo (4.10.3). */
  defaultScope: AccessScope;
  /** Overrides de ambito especificos por modulo (4.10.3). */
  moduleScopeOverrides: Record<string, AccessScope>;
  /**
   * Paquete visual asignado (4.1.3). Si es undefined, el equipo ve la organizacion general
   * tal cual, limitada a grantedNodes.
   */
  assignedPackageId?: string;
}

/** Usuario en el modelo de gobierno. */
export interface GovernedUser {
  userId: string;
  /**
   * Como se llama y como se le escribe.
   *
   * Viven aqui y no en la capa de credenciales porque son datos del DIRECTORIO, no del metodo de
   * acceso: la misma persona entra hoy con contrasena local y manana con Azure AD, y se sigue
   * llamando igual. Son opcionales: un directorio que no los traiga deja la cabecera mostrando el
   * identificador, que es lo que se mostraba antes.
   */
  displayName?: string;
  mail?: string;
  personalScope?: AccessScope;
  personalModuleScopeOverrides?: Record<string, AccessScope>;
  /**
   * Excepcion documentada de 4.10.2: un Administrador puede configurar que los equipos de
   * un usuario se combinen por union en vez de por seleccion activa. Es configuracion
   * explicita y visible, nunca el comportamiento por defecto.
   */
  combineTeamsByUnion?: boolean;
}

/** Rol del usuario en un equipo, o undefined si no es miembro. */
export function roleInTeam(team: Team, userId: string): AppRole | undefined {
  return team.members.find((m) => m.userId === userId)?.role;
}

export function isMember(team: Team, userId: string): boolean {
  return roleInTeam(team, userId) !== undefined;
}
