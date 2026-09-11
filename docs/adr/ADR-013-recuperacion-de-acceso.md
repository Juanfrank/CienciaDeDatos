# ADR-013: La recuperacion de acceso se implementa entera; lo que falta es el canal

- **Estado:** aceptada
- **Fecha:** 2026-09-11
- **Contexto del contrato de ingenieria:** Seccion 4.7.2 — "Bloqueo de cuenta tras un numero configurable de intentos fallidos, con backoff progresivo — **no bloqueo indefinido sin via de recuperacion**" y "Flujo de recuperacion de contrasena por correo verificado, con token de un solo uso y expiracion corta — nunca envio de la contrasena actual ni de una nueva por canal no verificado".

## Contexto

El bloqueo de cuenta estaba implementado y probado desde B.3. La via de salida, no: una cuenta local que acumulara cinco fallos se quedaba fuera hasta que expirara el bloqueo, y una contrasena olvidada no tenia ningun camino de vuelta. El contrato prohibe expresamente esa situacion.

El obstaculo es que la via que el contrato nombra —correo verificado— necesita un servicio de correo institucional que este entorno no tiene.

## Decision

**Se separa el flujo del transporte.** El flujo entero se implementa: token de 24 bytes aleatorios, guardado **hasheado** con Argon2id y pimienta, de un solo uso, con quince minutos de vida, que al canjearse aplica la politica de contrasenas, impide reutilizar las ultimas cinco, **desbloquea la cuenta** y **revoca las sesiones abiertas**. El transporte es un puerto, `IResetChannel`, con una sola implementacion: `CorreoInstitucionalNoDisponible`, que devuelve `false`.

**Se anaden DOS vias de recuperacion, no una**, porque resuelven problemas distintos:

| Via | Que hace | Para quien |
|---|---|---|
| Desbloquear | Pone el contador a cero, sin tocar la contrasena | Quien se equivoco de dedos y ya la recuerda |
| Restablecer | Emite un token de un solo uso | Quien la olvido |

**Mientras no haya correo, el restablecimiento es MEDIADO**: el Administrador lo tramita, la aplicacion le muestra el codigo, y el lo entrega a la persona por una via en la que haya verificado su identidad. La pantalla lo dice con esas palabras, y queda registrado quien lo tramito y por que canal.

## Alternativas descartadas

- **Entregar el token por la bandeja de avisos de la aplicacion.** No se puede leer sin entrar, y quien pide un restablecimiento es precisamente quien no puede.
- **Mostrar el token a quien lo pide en el formulario publico.** Convierte "he olvidado mi contrasena" en "dame acceso a esta cuenta". Peor que no tener recuperacion.
- **Enviar una contrasena temporal.** Lo prohibe 4.7.2 explicitamente, y ademas viaja por el mismo canal no verificado que el token, sin la ventaja de caducar.

La diferencia entre el flujo mediado y el de correo **no es el codigo**: es quien verifica la identidad. En el mediado responde una persona; en el de correo responde el control del buzon. Por eso el mediado no se presenta como equivalente.

## Consecuencias

- **`ISessionStore` gana `deleteAllFor(userId)`, y es obligatorio.** Sin el, cambiar una contrasena comprometida no echa de dentro a quien ya entro con ella, y el restablecimiento seria un gesto sin efecto. Un almacen que no sepa hacerlo no sirve para esta aplicacion, asi que el puerto no lo deja opcional. Sobre el almacen compartido —que es de clave-valor y no se puede recorrer— hace falta un indice por persona; en la base de identidad es un `DELETE ... WHERE userId = ?`.
- **Los restablecimientos van al MISMO log consolidado que los inicios de sesion** (seccion 7). Un restablecimiento es un evento de acceso: quien audite "como entro esta cuenta" tiene que verlo en la misma lista, no en otra que haya que acordarse de mirar.
- **Un token usado no se borra: se marca.** El rastro de que hubo un token y quedo invalidado es parte de lo que un auditor necesita.
- **Emitir un token nuevo invalida los vivos.** Dos tokens simultaneos duplican la ventana de robo sin dar nada a cambio.
- **El identificador del restablecimiento NO viaja en la URL.** Un identificador en la barra de direcciones acaba en el historial, en los logs del proxy y en el `Referer` de la siguiente peticion. Se escribe a mano.
- **No hay GET en `/api/restablecer`.** Un endpoint para comprobar si un resetId existe seria un oraculo para tantear tokens sin gastar intentos.
- **En el panel SI se distingue una cuenta inexistente**, al contrario que en el formulario de acceso. Quien pregunta es un Administrador autenticado mirando la lista de cuentas que ya tiene delante; la indistincion protege el formulario publico, no el panel.
- **No se puede "devolver una cuenta a su contrasena de siempre"** en las pruebas, porque la no reutilizacion lo impide. Las pruebas de navegador usan una contrasena distinta cada vez y no restauran; la comprobacion de la revocacion de sesiones, que exigiria restablecer una cuenta que las demas suites necesitan, se hace como prueba unitaria sobre el almacen real.
- **Queda escrito que el break-glass es un procedimiento, no codigo** (`docs/operacion/acceso-de-emergencia.md`), y que el hueco que lo hace necesario —el panel permite dejar la institucion sin ningun Administrador— es evitable en el codigo y esta anotado en la hoja de ruta.
