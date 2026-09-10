/**
 * Job de poblacion de cache (seccion 6.4).
 *
 * MARCADOR DE POSICION. Se implementa en el Entregable B.5.
 *
 * Es el UNICO proyecto del monorepo autorizado a importar `@app/data-contracts-server` y,
 * por tanto, el unico que invoca IDataConnector.query() (principio 2). Cuando se llene:
 *  - Timer Trigger que recorre el registro de datasets, cada uno con su propia recurrencia.
 *  - Queue Trigger para la repoblacion dirigida que origina el webhook de la seccion 4.8.
 *  - Refresco espaciado del SchemaDescriptor cacheado.
 *  - Ante fallo de la fuente, conserva la ultima version valida y registra en App Insights.
 */
export const PENDIENTE_DE_IMPLEMENTACION = 'Entregable B.5 — Fase de cimiento' as const;
