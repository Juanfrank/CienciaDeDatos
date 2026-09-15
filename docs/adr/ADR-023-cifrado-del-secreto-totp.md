# ADR-023: El secreto TOTP se cifra con una clave derivada de la pimienta, no con una pieza nueva

- **Estado:** aceptada
- **Fecha:** 2026-09-15
- **Contexto del contrato de ingenieria:** 4.7.2 exige segundo factor obligatorio para toda cuenta local, porque no heredan el MFA centralizado de Azure AD. No dice como se guarda el secreto.
- **Sustituye en parte a:** ADR-022, que dejo las credenciales fuera del respaldo apoyandose en que el secreto estaba en claro. El motivo de la exclusion cambia; la exclusion se mantiene.

## Contexto

`LocalCredentialRecord.totpSecret` se guardaba tal cual en el almacen compartido, pese a un comentario que prometia «cifrado en reposo». El secreto TOTP no es un dato de perfil: es una credencial completa y **permanente**. Quien lo lee genera codigos validos indefinidamente, sin dejar rastro, y el segundo factor deja de serlo para esa cuenta.

Y no se puede tratar como la contrasena. Un hash Argon2id sirve para verificar una contrasena porque basta con comparar; verificar un codigo TOTP exige el secreto **original** para recalcular la ventana. La unica proteccion disponible es cifrarlo con una clave que no viva junto a el.

Hasta aqui llegaba el estado del repositorio: el hueco estaba identificado y anotado en la hoja de ruta, con «una segunda pieza critica en el arranque» como coste asumido.

## Decision

**La clave de cifrado se DERIVA de `AUTH_PEPPER` con HKDF-SHA256, con una etiqueta propia.** No es una variable de entorno nueva, ni un secreto nuevo de Key Vault.

El argumento es el que esta casa ya aplico al token anti-CSRF: *una proteccion que se enciende con una variable de entorno es una proteccion que en algun entorno esta apagada*. Una clave separada seria opcional de hecho —ausente en desarrollo, ausente en el primer despliegue, ausente el dia que alguien copie la configuracion a medias— y el modo de fallo de esa ausencia es guardar en claro, que es exactamente lo que se viene a arreglar. Derivandola de la pimienta, el cifrado existe dondequiera que la autenticacion funcione.

La etiqueta de HKDF (`totp-secret-encryption/v1`) es lo que hace legitima la reutilizacion: la clave que cifra el segundo factor y la pimienta que sazona los hashes son independientes aunque nazcan del mismo secreto. Derivar subclaves separadas de un secreto maestro es para lo que HKDF existe.

**No empeora la custodia.** Perder la pimienta ya dejaba todos los hashes de contrasena sin verificar, asi que ya era la pieza sin la cual no se vuelve; el kit de recuperacion de `docs/operations/contingencia.md` sigue teniendo tres cosas y no cuatro.

**AES-256-GCM, con el correo de la cuenta como dato autenticado.** El sobre —`v1.<iv>.<tag>.<ciphertext>`— lleva un vector de inicializacion aleatorio por escritura, de modo que dos cuentas con el mismo secreto no se reconocen por su sobre. El correo va como AAD y no dentro: un sobre copiado de una cuenta a otra no descifra, aunque quien lo copie tenga escritura sobre el almacen.

**El cifrado vive en la frontera de la PERSISTENCIA, no en el dominio.** `LocalCredentialRecord.totpSecret` sigue siendo el secreto en claro, porque es lo que el proveedor necesita para verificar un codigo; quien decide como se escribe es la implementacion del puerto (`CredentialsStore`, en `apps/shell/src/server/identity.ts`). Un almacen que no cifre sigue siendo valido para pruebas y desarrollo, y el proveedor no se entera de nada.

**Un secreto ilegible LANZA; no se degrada a ausente.** Es la decision de la que cuelga todo lo demas. El proveedor exige el codigo cuando el secreto esta presente (`if (registro.totpSecret)`), asi que un descifrado fallido convertido en `undefined` seria una cuenta que entra con la contrasena sola. Falla cerrado: con la pimienta equivocada nadie entra, en vez de entrar todos sin segundo factor.

**El campo en disco se llama distinto.** `totpSecretCipher`, no `totpSecret`. Un registro escrito antes de este cambio se reconoce por traer el nombre viejo, y esa es la senal —inequivoca, no una heuristica sobre la forma de la cadena— que dispara su migracion.

**La migracion ocurre al leer, y ademas hay un comando.** El almacen reescribe cifrado cualquier registro que encuentre en claro, de modo que una cuenta que inicia sesion se pone al dia sola y nadie tiene que acordarse de nada. Una cuenta **dormida** no se lee nunca, y es precisamente la que mas tiempo pasaria en claro: `npm run cifrar-totp` las recorre todas por `keysByPrefix`, y es idempotente.

## Alternativas descartadas

- **Un secreto de cifrado propio en Key Vault (`TOTP_ENCRYPTION_KEY`).** Es lo ortodoxo y permite rotar el cifrado sin tocar los hashes. Se descarta por lo que pasa cuando falta: o la aplicacion no arranca —una cuarta pieza critica, mas superficie de fallo en el peor dia— o guarda en claro, que es el fallo que se viene a cerrar. La rotacion que compra es teorica: rotar la pimienta hoy ya invalida todas las contrasenas, asi que no hay nada que rotar por separado.
- **Cifrar con una clave por cuenta derivada de su contrasena.** Ataria el segundo factor al primero: cambiar la contrasena obligaria a volver a dar de alta el TOTP en el telefono, y un restablecimiento mediado dejaria la cuenta sin segundo factor justo en el momento en que mas se apoya uno en el.
- **Guardar el secreto en un almacen aparte del gobierno.** Es la separacion de verdad, y es exactamente lo que da la base de identidad de 1.4 cuando exista. Hoy solo habria un segundo directorio en el mismo disco local: la misma superficie, mas piezas.
- **Volver a meter las credenciales en el respaldo, ahora que el secreto va cifrado.** Mejoraria el RTO. Se mantiene fuera: el archivo seguiria llevando los hashes de contrasena y los sobres, y quien tenga ademas la pimienta —que viaja en el mismo kit de recuperacion— tendria la identidad local entera. Revisarlo tiene sentido el dia que la identidad viva en su propia base con su propia politica de respaldo.
- **Una ruta de administracion que dispare la migracion.** Mismo argumento que ADR-022 y que `crear-administrador`: una puerta de arranque que queda abierta para siempre.

## Consecuencias

- **`packages/auth` gana `totpCipher.ts`**, con `encryptTotpSecret`, `decryptTotpSecret` e `isEncryptedTotpSecret`. No depende de nada fuera de `node:crypto`.
- **`tools/coherence/credenciales.spec.ts` ata la puerta unica.** Un `write('auth:credencial:...')` en otro archivo compila, funciona y deja el segundo factor en claro en el disco, sin error ni prueba roja. La guarda exige que solo `identity.ts` nombre la clave, y fija ademas que el prefijo siga clasificado como `no-respaldar`, que es el unico cambio de una linea que convertiria el respaldo en un volcado de credenciales.
- **El despliegue no necesita ningun paso nuevo.** Ni variable, ni secreto, ni orden de arranque. Un almacen existente se migra solo; `npm run cifrar-totp` cierra las cuentas dormidas.
- **Un sobre de una version futura se rechaza nombrando su version**, en vez de confundirse con un secreto en claro y volver a cifrarse.
- **La pimienta pasa a ser necesaria tambien para LEER una credencial con segundo factor.** Antes bastaba para verificar la contrasena; ahora, sin ella, `findByEmail` lanza. Es el precio de que un volcado no valga, y esta dicho en el kit de recuperacion.
