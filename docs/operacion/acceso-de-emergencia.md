# Acceso de emergencia (break-glass)

> Procedimiento operativo. Lo ejecuta una persona, no el codigo. Lo que el codigo hace es
> **dejar rastro** de que se ejecuto.

## Que problema resuelve

La aplicacion esta disenada para que nadie tenga acceso por defecto: sin sesion no se entra, el
rol Administrador se resuelve del gobierno, y el gobierno se administra desde `/admin`, que
exige ser Administrador. Esa circularidad es correcta y tiene un fallo conocido:

**Si no queda ningun Administrador que pueda entrar, nadie puede nombrar a otro.**

Ocurre de tres formas realistas:

1. La unica persona con rol Administrador deja la institucion y su cuenta de Azure AD se
   desactiva antes de nombrar a nadie mas.
2. Azure AD deja de responder y ninguna de las personas que administran tiene cuenta local.
3. Un cambio de configuracion retira por error el rol Administrador a todo el mundo. El panel
   lo permite: la matriz de 4.10.1 comprueba el permiso de quien hace el cambio, no si el
   resultado deja a alguien dentro.

## Lo que NO se hace

- **No existe una cuenta de emergencia con contrasena guardada en un sobre.** Una credencial
  permanente con todos los permisos es un objetivo permanente, y su rotacion se olvida.
- **No hay una variable de entorno que salte el control de acceso.** Un `ADMIN_BYPASS=1` acaba
  puesto en algun entorno "temporalmente".
- **No hay un endpoint de rescate.** Cualquier ruta que conceda permisos sin autenticar es la
  puerta que se buscara primero al atacar la aplicacion.

El acceso de emergencia pasa por donde ya pasa el resto de la configuracion: **el almacen de
gobierno**. Quien tenga acceso a esa base de datos puede nombrar a un Administrador, y ese
acceso ya esta gobernado por Azure —con sus propios controles, su propia auditoria y su propio
conjunto de personas autorizadas— sin que esta aplicacion tenga que inventar nada.

## Procedimiento

Requisitos previos: dos personas. Quien ejecuta y quien atestigua. La segunda no es burocracia
—es lo que hace que el registro posterior no dependa de la palabra de una sola persona.

1. **Comprobar que hace falta.** Consultar el panel de cuentas locales o el almacen de gobierno
   y confirmar que ninguna persona con rol `administrador` puede iniciar sesion. Si alguna
   puede, esto no es una emergencia: es un desbloqueo o un restablecimiento normal, y se hace
   desde `/admin/cuentas`.

2. **Abrir un registro ANTES de tocar nada.** Ticket o entrada en el registro operativo, con:
   quien ejecuta, quien atestigua, por que, y la hora. Abrirlo despues convierte el
   procedimiento en algo que se justifica a posteriori.

3. **Acceder al almacen de identidad y gobierno** con una identidad de Azure autorizada para esa
   base de datos. En el entorno de desarrollo, el almacen compartido en disco (`CACHE_DIR`).

4. **Restituir un Administrador**, no crear una cuenta nueva: anadir el rol `administrador` a una
   persona que YA existe en el directorio y cuya identidad se puede verificar. Una cuenta creada
   durante una emergencia es una cuenta que nadie reconoce despues.

5. **Entrar por la aplicacion con esa persona** y comprobar que el panel responde.

6. **Registrar el cambio DENTRO de la aplicacion.** El cambio hecho en la base directamente no
   pasa por `registrarCambio` y por tanto no esta en la auditoria de configuracion. Hay que
   dejarlo: el primer acto del Administrador restituido es hacer un cambio equivalente desde el
   panel —por ejemplo, confirmar la membresia— para que la auditoria refleje quien administra
   desde cuando.

7. **Cerrar el registro** con lo que se hizo, y **revisar la causa**. Si fue el caso 3, el
   siguiente paso es tecnico, no operativo: ver "Pendiente" mas abajo.

## Despues

- Comprobar que hay **al menos dos personas** con rol Administrador. La emergencia ocurrio
  porque habia menos.
- Comprobar que **al menos una de ellas tiene cuenta local con TOTP**, para el caso 2. Es una de
  las pocas razones legitimas para que exista una cuenta local segun 4.7.2, y conviene que
  aparezca escrita como tal en `/admin/cuentas`.
- Revisar el log consolidado de inicios de sesion (seccion 7) de las horas previas y posteriores.

## Pendiente

El caso 3 —retirar el rol a todo el mundo desde el panel— **es evitable en el codigo** y hoy no
se evita: `cambiarMembresia` comprueba el permiso de quien hace el cambio, no el estado en que
queda el sistema. Una comprobacion de "no puedes dejar la institucion sin ningun Administrador"
pertenece al mismo sitio donde vive `wouldExpand`, y esta anotada en `docs/hoja-de-ruta.md`.

Mientras no exista, este procedimiento es la red de seguridad de ese fallo, y conviene que quien
administre lo sepa.
