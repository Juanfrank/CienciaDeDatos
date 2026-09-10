# ADR-003: Azure SQL dedicada para identidad y gobierno

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Contexto del contrato de ingenieria:** Secciones 4.7.2 (almacen de identidades local), 4.10.7 (almacenamiento del modelo de gobierno), 6.7 (sesion sin Redis).

## Contexto

El modelo de identidad local, roles, equipos, arbol de navegacion, paquetes visuales, ambitos de acceso, sesion y auditoria necesitan un almacen transaccional separado del Data Warehouse y fuera del alcance de `SqlDataConnector`.

## Decision

Se usa una base **Azure SQL dedicada**, con acceso via Prisma (`provider = "sqlserver"`) y migraciones versionadas.

## Consecuencias

- Es el motor cuyo RLS nativo (`CREATE SECURITY POLICY`) contemplan las secciones 4.7.4 y 4.10.5 para el camino `Sql`, asi que no introduce un segundo dialecto en el sistema.
- El aislamiento respecto del Data Warehouse se hace con **identidades distintas**: la Managed Identity que usa `SqlDataConnector` no recibe permiso alguno sobre esta base. El aislamiento no depende de disciplina de codigo.
- La sesion vive aqui y no en Redis, lo que permite cambiar el equipo activo del lado servidor sin reemitir credenciales (ver ADR-006).
