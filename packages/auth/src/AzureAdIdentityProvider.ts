import {
  type AuthenticatedPrincipal,
  AuthenticationError,
  type IIdentityProvider,
  type IPrincipalDirectory,
  assemblePrincipal,
} from './IIdentityProvider';
import type { IAuditLog } from './stores';

/** Proveedor de identidad Azure AD — seccion 4.7.1. */

export interface AzureAdCredentials {
  /** Token de acceso o de identidad recibido del cliente. */
  token: string;
  sourceIp?: string;
}

/** Reclamaciones que el backend necesita del token, ya validado. */
export interface ValidatedTokenClaims {
  oid: string;
  userPrincipalName: string;
  name?: string;
}

/** Validador de tokens, inyectable. */
export interface ITokenValidator {
  validate(token: string): Promise<ValidatedTokenClaims>;
}

export interface AzureAdIdentityProviderOptions {
  tokenValidator: ITokenValidator;
  directory: IPrincipalDirectory;
  auditLog: IAuditLog;
  now?: () => number;
}

export class AzureAdIdentityProvider implements IIdentityProvider {
  private readonly tokenValidator: ITokenValidator;
  private readonly directory: IPrincipalDirectory;
  private readonly auditLog: IAuditLog;
  private readonly now: () => number;

  constructor(options: AzureAdIdentityProviderOptions) {
    this.tokenValidator = options.tokenValidator;
    this.directory = options.directory;
    this.auditLog = options.auditLog;
    this.now = options.now ?? Date.now;
  }

  async authenticate(credentials: unknown): Promise<AuthenticatedPrincipal> {
    const { token, sourceIp } = credentials as AzureAdCredentials;

    let claims: ValidatedTokenClaims;
    try {
      claims = await this.tokenValidator.validate(token);
    } catch (error) {
      await this.audit('(token invalido)', 'fallo', 'token-invalido', sourceIp);
      throw new AuthenticationError(
        `Token de Azure AD invalido: ${error instanceof Error ? error.message : String(error)}`,
        'token-invalido',
      );
    }

    // El MISMO directorio institucional que usan las cuentas locales. No hay una tabla de
    // roles "de Azure AD" y otra "local": eso daria acceso distinto segun la puerta de entrada.
    const entry = await this.directory.lookup(claims.userPrincipalName);
    if (!entry) {
      await this.audit(claims.userPrincipalName, 'fallo', 'sin-identidad-institucional', sourceIp);
      throw new AuthenticationError(
        'La identidad no tiene roles ni ambito asignados en el directorio.',
        'sin-identidad-institucional',
      );
    }

    await this.audit(claims.userPrincipalName, 'exito', undefined, sourceIp, entry.userId);
    return assemblePrincipal(entry, 'azure-ad', claims.userPrincipalName);
  }

  private async audit(
    attemptedPrincipal: string,
    outcome: 'exito' | 'fallo',
    reason?: string,
    sourceIp?: string,
    userId?: string,
  ): Promise<void> {
    // Azure AD ya tiene sus logs nativos en Entra ID; se registra igualmente aqui, con el mismo
    // formato que las cuentas locales, para tener UNA sola vista de auditoria de acceso (7).
    await this.auditLog.recordLogin({
      timestamp: new Date(this.now()).toISOString(),
      authProvider: 'azure-ad',
      attemptedPrincipal,
      outcome,
      ...(reason ? { reason } : {}),
      ...(sourceIp ? { sourceIp } : {}),
      ...(userId ? { userId } : {}),
    });
  }
}
