/** Normalizacion de identidad — seccion 4.7.3 del contrato de ingenieria. */

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

/** Directorio institucional de roles y ambitos. */
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

/** Ensambla el principal a partir de la entrada del directorio. */
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
