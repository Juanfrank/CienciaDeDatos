/**
 * Autenticacion — seccion 4.7 del contrato de ingenieria.
 *
 * Dos mecanismos de inicio de sesion que COEXISTEN —Azure AD como principal, credenciales
 * locales como secundario— convergiendo en el mismo modelo de identidad interno antes de
 * llegar a cualquier conector. Ningun modulo, conector o regla de RLS ramifica su
 * comportamiento segun por cual de las dos entro la persona usuaria.
 */
export {
  AzureAdIdentityProvider,
  type AzureAdCredentials,
  type AzureAdIdentityProviderOptions,
  type ITokenValidator,
  type ValidatedTokenClaims,
} from './AzureAdIdentityProvider';
export {
  AuthenticationError,
  assemblePrincipal,
  type AuthProvider,
  type AuthenticatedPrincipal,
  type DirectoryEntry,
  type IIdentityProvider,
  type IPrincipalDirectory,
} from './IIdentityProvider';
export {
  LocalIdentityProvider,
  type LocalCredentials,
  type LocalIdentityProviderOptions,
} from './LocalIdentityProvider';
export { SessionService, type SessionServiceOptions } from './session';
export {
  DEFAULT_LOCKOUT_POLICY,
  DEFAULT_PASSWORD_POLICY,
  checkPasswordPolicy,
  lockDurationMs,
  type LockoutPolicy,
  type PasswordPolicy,
  type PolicyViolation,
} from './passwordPolicy';
export {
  InMemoryAuditLog,
  InMemoryLocalIdentityStore,
  InMemorySessionStore,
  type AppSession,
  type IAuditLog,
  type ILocalIdentityStore,
  type ISessionStore,
  type LocalCredentialRecord,
  type LoginAuditEvent,
} from './stores';
