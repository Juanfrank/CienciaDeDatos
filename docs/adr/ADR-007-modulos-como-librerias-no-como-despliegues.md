# ADR-007: Los modulos son librerias del monorepo, no artefactos de despliegue

- **Estado:** aceptada — **aprobada explicitamente por el responsable del proyecto el 2026-09-11**
- **Fecha:** 2026-09-10 (propuesta) / 2026-09-11 (aprobada)
- **Contexto del contrato de ingenieria:** Secciones 3.2 (estructura de carpetas obligatoria) y 3.4 (CI/CD por modulo).

## Contexto

La seccion 3.4 pide que un error de compilacion en un modulo no bloquee el despliegue de los demas. La lectura literal sugiere artefactos de despliegue separados por modulo, pero ADR-002 fija un contenedor unico de Next.js, donde eso no es posible.

## Decision

Cada modulo es un **proyecto de libreria de Nx**, ubicado exactamente en la ruta que exige la seccion 3.2 (`/apps/modules/modulo-<nombre>/`), consumido por el shell. El aislamiento operativo de la seccion 3.4 se logra con dos mecanismos combinados: `nx affected` en CI, y *feature flags* por modulo en Azure App Configuration.

## Consecuencias

- Se conserva la estructura de carpetas obligatoria y el contrato de modulo (`module.contract.ts`).
- Un modulo se puede **desactivar en produccion sin redeploy** mediante su feature flag, que es el efecto practico que persigue la seccion 3.4.
- **Costo aceptado y desviacion explicita:** un modulo cuya compilacion falla si bloquea el build del contenedor. La mitigacion es que `nx affected` detecta el fallo antes del build de imagen, y que el modulo roto se desactiva por flag mientras se corrige.
- **Esta es la desviacion mas significativa respecto del documento fuente y requiere aprobacion explicita en la revision del gate.**
