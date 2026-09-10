# ADR-006: Sesion opaca en base de datos, no JWT autocontenido

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Contexto del contrato de ingenieria:** Secciones 6.7 (sesion sin Redis), 4.10.2 (equipo activo por sesion), y el criterio de aceptacion de cambiar de equipo activo sin cerrar sesion.

## Contexto

La sesion debe sobrevivir al escalado horizontal sin memoria local del proceso y sin Redis. Ademas, el **equipo activo** forma parte del estado de sesion y determina el ambito de datos efectivo.

## Decision

La cookie de sesion contiene un **identificador opaco**; el estado real (principal normalizado, equipo activo, expiracion) vive en una tabla de la base de identidad de ADR-003.

## Consecuencias

- Cambiar el equipo activo es un UPDATE del lado servidor: surte efecto de inmediato, sin reemitir credenciales ni cerrar sesion. Con un JWT autocontenido habria que reemitir el token y gestionar su revocacion.
- Revocar una sesion es borrar una fila, no esperar a que expire un token firmado.
- **Costo aceptado:** una lectura a la base por solicitud. Se mitiga con ARR affinity como complemento opcional, nunca como unica fuente de verdad: reciclar una instancia no debe eliminar la sesion de nadie.
