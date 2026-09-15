# El primer Administrador de un despliegue

> Procedimiento operativo. Lo ejecuta una persona desde la maquina, no la aplicacion.
> Es la situacion inversa a `acceso-de-emergencia.md`, y comparte con ella la pregunta de fondo:
> quien puede crear el acceso cuando todavia no hay acceso.

## Que problema resuelve

Un despliegue nuevo arranca **sin ninguna cuenta local**. Es deliberado: la unica que habia antes
era la de demostracion, y lo que sembraba era una clave publica —esta en el repositorio— para toda
la institucion. Cerrarla fue lo correcto, pero deja la puerta sin llave y sin cerradura:

- El rol Administrador se resuelve del gobierno, y el gobierno se administra desde `/admin`.
- `/admin` exige ser Administrador **y poder entrar**.
- Si nadie puede entrar, nadie puede nombrar a nadie.

Con Azure AD configurado esto no ocurre: quien ya figura en el gobierno entra con su identidad
corporativa. Este procedimiento es para el otro caso —el primer arranque, o un entorno sin
federacion todavia—, donde hace falta una cuenta local para empezar.

## Por que un comando y no una ruta

Lo habitual seria una pagina de instalacion en `/setup` que se autodeshabilita. No se hizo, y la
diferencia es el punto entero: **una ruta de arranque es una puerta que queda abierta para siempre
y de la que hay que acordarse de cerrar**. Basta con que el estado que la deshabilita se pierda
—una base recreada, un volumen que no se monto, un despliegue desde cero sobre datos viejos— para
que vuelva a estar abierta, y una ruta que concede el rol Administrador sin autenticar es lo
primero que se busca al atacar la aplicacion.

Un comando no tiene ese problema porque no esta expuesto: solo lo ejecuta quien ya esta dentro de
la maquina, y ese acceso ya esta gobernado por Azure, con sus propios controles y su propia
auditoria. Es exactamente la autoridad que hace falta para conceder el primer acceso, y no mas.

## Lo que el comando NO hace

- **No concede el rol.** `userId` tiene que ser alguien que YA figure en el gobierno como
  Administrador de algun equipo; si no, se niega. Conceder el rol y el acceso a la vez convertiria
  un comando de arranque en una forma de fabricar autoridad, y quien administra la maquina no es
  necesariamente quien decide quien gobierna la institucion.
- **No crea una segunda cuenta.** Se niega a ejecutarse si ya existe **alguna** credencial local.
  Sin esa negativa, esto seria una forma de crear administradores en una institucion que ya
  funciona, sin pasar por el gobierno y sin que conste quien lo pidio. Para dar acceso a alguien
  mas existe `/admin/accounts`; para recuperar el acceso perdido, el acceso de emergencia.
- **No guarda la contrasena.** Se genera al azar, se imprime una vez y lo unico que queda
  almacenado es su hash.

## Procedimiento

1. **Comprobar que la persona ya esta en el gobierno** con rol `administrador` en algun equipo. Si
   no lo esta, esto no se arregla aqui: se arregla en el almacen de gobierno, que es donde vive esa
   decision.

2. **Ejecutar el comando** en la maquina del despliegue, con la MISMA `AUTH_PEPPER` con la que
   corre la aplicacion —con otra, el hash no verificaria al iniciar sesion y la cuenta quedaria
   creada e inservible, que es peor que no crearla— y el mismo `CACHE_DIR`:

   ```
   CACHE_DIR=/ruta/al/almacen AUTH_PEPPER=... npm run crear-administrador -- u-admin
   ```

3. **Guardar lo que imprime.** Salen tres datos y salen una sola vez:

   ```
     Correo:     u-admin@poderjudicial.gob.do
     Contrasena: <aleatoria>
     TOTP:       <secreto en base32>
   ```

   La contrasena es de `randomBytes` y esta en base64url para que se pueda dictar por telefono sin
   confundir caracteres: es lo que va a pasar la primera vez, porque todavia no hay correo
   configurado. Si se pierde, no hay forma de recuperarla —hay que borrar la credencial y volver a
   empezar—.

4. **Dar de alta el TOTP** en la aplicacion de segundo factor antes de cerrar la terminal. Es
   obligatorio: las cuentas locales no heredan el MFA centralizado de Azure AD, y la primera menos
   que ninguna puede saltarselo.

5. **Entrar por la aplicacion** y comprobar que el panel responde. La creacion consta en la
   auditoria de configuracion con `sistema` como actor —no hay todavia una persona identificada que
   lo pidiera, y atribuirselo al propio administrador que se esta creando diria que se concedio el
   acceso a si mismo, que es justo lo que no paso—.

6. **Cambiar la contrasena** desde el perfil. La que imprimio el comando ha pasado por una terminal
   y probablemente por el historial de alguien.

## Despues

- **Nombrar a un segundo Administrador** desde `/admin/teams`. Con uno solo, cualquier baja es la
  emergencia que describe `acceso-de-emergencia.md`.
- **Dejar la cuenta local documentada como tal** en `/admin/accounts`. Segun 4.7.2 las cuentas
  locales son la excepcion y conviene que se vea cual es y por que existe.
- **Retirarla cuando Azure AD este configurado**, si se creo solo para arrancar. Una credencial
  permanente con todos los permisos es un objetivo permanente.
