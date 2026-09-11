/**
 * Normalizacion de identidad — seccion 4.7.3 del contrato de ingenieria.
 *
 * La aplicacion soporta DOS mecanismos de inicio de sesion que COEXISTEN: Azure AD como
 * metodo principal y usuario/contraseña como metodo secundario. Ambos convergen en el mismo
 * modelo de identidad interno ANTES de llegar a IDataConnector, de modo que el resto de la
 * aplicacion —modulos, RLS, cache, auditoria— no necesita saber por cual de los dos entro la
 * persona usuaria.
 *
 * `authProvider` queda registrado en el principal SOLO para auditoria y para reglas de negocio
 * especificas, como el MFA obligatorio de las cuentas locales. NUNCA para dar acceso a datos
 * distintos por el solo hecho de haber entrado por un camino u otro.
 */

export type AuthProvider = 'azure-ad' | 'local';

export interface AuthenticatedPrincipal {
  userId: string;
  displayName: string;
  authProvider: AuthProvider;
  /**
   * Para azure-ad: userPrincipalName real. Para local: correo verificado de la cuenta,
   * usado con el mismo proposito aguas abajo (RLS, auditoria).
   */
  userPrincipalName: string;
  roles: string[];
  securityContext: Record<string, string | string[]>;
}

export interface IIdentityProvider {
  authenticate(credentials: unknown): Promise<AuthenticatedPrincipal>;
}

/**
 * Directorio institucional de roles y ambitos.
 *
 * Es la pieza que hace cumplir "los roles y el securityContext se resuelven con la misma
 * tabla de mapeo institucional, independientemente del proveedor" (4.7.3). Ambos proveedores
 * lo invocan; ninguno construye roles por su cuenta. Si algun dia un proveedor dejara de
 * usarlo, el sistema podria dar acceso distinto segun la puerta de entrada — exactamente lo
 * que la seccion 4.7.3 prohibe.
 */
export interface DirectoryEntry {
  userId: string;
  displayName: string;
  roles: string[];
  securityContext: Record<string, string | string[]>;
}

export interface IPrincipalDirectory {
  /** Resuelve por el identificador normalizado (userPrincipalName), no por el id del proveedor. */
  lookup(userPrincipalName: string): Promise<DirectoryEntry | null>;
}

/** Error generico de autenticacion. */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'credenciales-invalidas'
      | 'cuenta-bloqueada'
      | 'mfa-requerido'
      | 'mfa-invalido'
      | 'token-invalido'
      | 'sin-identidad-institucional',
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Ensambla el principal a partir de la entrada del directorio.
 *
 * Unico punto donde se construye un AuthenticatedPrincipal, para los dos proveedores. Que
 * ambos pasen por aqui es lo que garantiza que los dos caminos produzcan exactamente la misma
 * forma, sin ramas de codigo distintas aguas abajo.
 */
export function assemblePrincipal(
  entry: DirectoryEntry,
  authProvider: AuthProvider,
  userPrincipalName: string,
): AuthenticatedPrincipal {
  return {
    userId: entry.userId,
    displayName: entry.displayName,
    authProvider,
    userPrincipalName,
    roles: [...entry.roles],
    securityContext: { ...entry.securityContext },
  };
}
