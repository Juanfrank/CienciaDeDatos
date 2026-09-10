# ADR-001: Nx como herramienta de monorepo

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Contexto del contrato de ingenieria:** Seccion 3.1 — exige elegir entre Nx y Turborepo, documentar la decision, y no mezclar ambos.

## Contexto

La seccion 3.1 pide dos capacidades concretas: builds `affected` y **reglas de limites de modulo forzadas por herramienta, no por convencion**. La segunda es la que decide: es el mecanismo que impide que un modulo de negocio importe un driver de datos, y con el, el que hace verificable el criterio de aceptacion de que ningun modulo invoca `IDataConnector.query()`.

## Decision

Se usa **Nx**. Turborepo cubre `affected` con `--filter`, pero no tiene enforcement de limites nativo: exigiria añadir y mantener `eslint-plugin-boundaries` o `dependency-cruiser` como capa aparte. Nx trae `@nx/enforce-module-boundaries` con etiquetas por proyecto.

## Consecuencias

- Las etiquetas viven en el `project.json` de cada proyecto y las restricciones en `eslint.config.mjs`.
- Nx resuelve el grafo de dependencias por el **nombre de package.json** de cada proyecto, no solo por los alias de `tsconfig.base.json`. Por eso cada proyecto lleva su propio `package.json` y el repositorio usa npm workspaces; sin eso, `nx affected` no propaga entre proyectos.
- Se paga la complejidad de configuracion de Nx a cambio de que el limite arquitectonico mas importante del sistema sea un error de linter.
