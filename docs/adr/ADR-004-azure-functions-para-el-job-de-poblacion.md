# ADR-004: Azure Functions en plan Consumo para el job de poblacion de cache

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Contexto del contrato de ingenieria:** Seccion 6.4 — ofrece explicitamente dos opciones: Azure Functions con Timer Trigger, o un WebJob del propio App Service.

## Contexto

El job de poblacion debe correr desacoplado del ciclo de vida de cualquier solicitud HTTP, y el criterio de costo de la seccion 5 desaconseja sumar recursos de computo nuevos. La seccion 6.4 sugiere un WebJob precisamente para evitarlo.

## Decision

Se usa un **Azure Function App en plan Consumo**, compartiendo el Storage Account ya provisionado.

## Consecuencias

- **El WebJob no es viable**: los WebJobs continuos no estan soportados en App Service Linux con despliegue por contenedor, que es lo que fija ADR-002. Esta es una desviacion de la sugerencia del documento forzada por la plataforma, no una preferencia.
- El plan Consumo cobra por ejecucion: en reposo el costo tiende a cero, lo que respeta el criterio de la seccion 5.
- Alternativa descartada: un planificador dentro del propio contenedor con *lease* de blob como cerrojo de instancia unica. Evita el recurso nuevo, pero vuelve a acoplar la poblacion al ciclo de vida del proceso web, que es justo lo que la seccion 6.4 separa.
- El Function App es el unico proyecto autorizado a importar `@app/data-contracts-server`.
