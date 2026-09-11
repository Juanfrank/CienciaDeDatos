import {
  type AuthenticatedPrincipal,
  AuthenticationError,
  type IIdentityProvider,
  type IPrincipalDirectory,
  assemblePrincipal,
} from './IIdentityProvider';
import type { IAuditLog } from './stores';

/**
 * Proveedor de identidad Azure AD — seccion 4.7.1.
 *
 * Metodo PRINCIPAL, y el que debe ofrecerse primero en la pantalla de inicio de sesion:
 * hereda SSO, MFA y acceso condicional ya gestionados centralmente por la institucion.
 *
 * Se apoya en la autenticacion integrada de App Service (Easy Auth) como capa PERIMETRAL,
 * con validacion adicional del token en el backend. Las dos capas no son redundancia inutil:
 * Easy Auth protege el perimetro, pero el backend no debe confiar ciegamente en una cabecera
 * inyectada por la plataforma sin validar el token por su cuenta.
 */

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

/**
 * Validador de tokens, inyectable.
 *
 * En produccion valida firma, emisor, audiencia y expiracion contra las claves publicas del
 * tenant (MSAL / jwks). Se define como puerto para que la logica de normalizacion de identidad
 * sea probable sin un tenant real, y para que cambiar de libreria no toque este archivo.
 */
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
