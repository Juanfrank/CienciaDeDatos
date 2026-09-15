# packages/auth — identidad

Dos proveedores tras la misma interfaz: Azure AD para la institucion y credenciales locales para
quien no tiene cuenta corporativa (4.7).

| Archivo | Que es |
|---|---|
| `IIdentityProvider.ts` | La interfaz comun |
| `AzureAdIdentityProvider.ts` | Identidad corporativa |
| `LocalIdentityProvider.ts` | Correo, clave y segundo factor TOTP |
| `totpCipher.ts` | Cifrado en reposo del secreto TOTP |
| `passwordPolicy.ts` | Politica de clave |
| `passwordReset.ts` | Restablecimiento con caducidad y un solo uso |

## Reglas

- **La identidad se normaliza**: quien consume no sabe de que proveedor vino.
- **La pimienta (`AUTH_PEPPER`) se lee de configuracion.** En produccion la aplicacion se niega a
  arrancar sin ella en vez de usar el valor de desarrollo.
- **El secreto TOTP no se escribe nunca en claro.** En memoria va descifrado —verificar un codigo
  exige el secreto original—; al almacen llega en un sobre cuya clave se deriva de la pimienta. Un
  secreto que no se pueda descifrar LANZA: devolverlo ausente dejaria entrar sin segundo factor.
- **Un enlace de restablecimiento caduca y sirve una sola vez.**
- **El segundo factor no es opcional** en el proveedor local.

## Que NO hacer

- No registrar claves, hashes ni codigos TOTP en ningun log.
- No devolver mensajes que distingan «esa cuenta no existe» de «esa clave no es».
- No sortear el segundo factor con una bandera de desarrollo que pueda llegar a produccion.
