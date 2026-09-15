/** Autenticacion — seccion 4.7 del contrato de ingenieria. */
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
  TOLERANCIA_TOTP_POR_DEFECTO,
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
export {
  InstitutionalMailNotAvailable,
  DEFAULT_RESET_TTL_MS,
  PasswordResetError,
  PasswordResetService,
  type IResetChannel,
  type IResetStore,
  type IssuedResetToken,
  type PasswordResetServiceOptions,
  type ResetRecord,
} from './passwordReset';
