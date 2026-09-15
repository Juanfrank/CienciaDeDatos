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
3. ~~Un cambio de configuracion retira por error el rol Administrador a todo el mundo.~~
   **Ya no ocurre**: `wouldLeaveNoAdministrator` rechaza con 409 cualquier cambio que se lleve al
   ultimo Administrador —retirarle el rol, degradarlo, reescribir la membresia del equipo o
   borrar el equipo entero—. Quedan los casos 1 y 2, que no dependen del panel.

## Lo que NO se hace

- **No existe una cuenta de emergencia con contrasena guardada en un sobre.** Una credencial
  permanente con todos los permisos es un objetivo permanente, y su rotacion se olvida.
- **No hay una variable de entorno que salte el control de acceso.** Un `ADMIN_BYPASS=1` acaba
  puesto en algun entorno "temporalmente".
- **No hay un endpoint de rescate.** Cualquier ruta que conceda permisos sin autenticar es la
  puerta que se buscara primero al atacar la aplicacion.

La situacion inversa —un despliegue nuevo, donde todavia no hay ninguna cuenta local que pueda
entrar— no es una emergencia y no se resuelve por aqui: tiene su propio procedimiento en
`primer-administrador.md`.

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
   desde `/admin/accounts`.

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
   pasa por `changeRecord` y por tanto no esta en la auditoria de configuracion. Hay que
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
  aparezca escrita como tal en `/admin/accounts`.
- Revisar el log consolidado de inicios de sesion (seccion 7) de las horas previas y posteriores.

## Lo que el codigo ya impide, y lo que no

**Impide** que un cambio de configuracion deje la aplicacion sin ningun Administrador. Lo
comprueba `wouldLeaveNoAdministrator`, sobre el estado en que QUEDA el sistema y no sobre quien
propone el cambio, y cubre los cuatro caminos: retirar el rol, degradarlo, reescribir la
membresia del equipo y borrar el equipo. `/admin/teams` avisa ademas cuando solo hay uno.

**No impide** que quien administra deje de poder entrar por otro motivo: una cuenta bloqueada,
una cuenta de Azure AD desactivada, una baja. Esos son los casos 1 y 2, y para ellos existe este
procedimiento.

Hay una consecuencia que conviene conocer antes de reorganizar roles: **quien suelta el rol de
Administrador pierde el acceso al panel en el acto**, incluida la ruta que se lo devolveria. Si
queda otro Administrador, no es una emergencia —se lo restituye el—; si no queda ninguno, la
comprobacion no habria dejado hacer el cambio. Por eso los relevos se hacen nombrando primero y
retirando despues.

**Pendiente**: que la comprobacion verifique que el Administrador que queda puede AUTENTICARSE,
no solo que existe en el gobierno. Anotado en `docs/hoja-de-ruta.md`, apartado 2.6.
