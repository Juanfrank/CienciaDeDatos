# ADR-005: Argon2id con pepper en Key Vault, y TOTP obligatorio

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Contexto del contrato de ingenieria:** Seccion 4.7.2 — credenciales locales como metodo secundario coexistente.

## Contexto

Las cuentas locales no heredan el MFA ni el acceso condicional que Azure AD gestiona centralmente. Esa ausencia de gobernanza tiene que compensarse en la aplicacion, no dejarse como hueco.

## Decision

Hash **Argon2id** via `@node-rs/argon2`, con sal unica por usuario y un *pepper* a nivel de aplicacion guardado en **Key Vault**, nunca en el registro del usuario. Segundo factor **TOTP** obligatorio via `otpauth`.

## Consecuencias

- `@node-rs/argon2` es un modulo nativo: los Route Handlers de autenticacion deben declarar `export const runtime = 'nodejs'`, no Edge.
- El *pepper* en Key Vault implica que un volcado de la base de identidad, por si solo, no permite atacar los hashes offline.
- TOTP se trata como obligatorio, no opcional, para cualquier cuenta local con acceso a datos sujetos a RLS restringido.
