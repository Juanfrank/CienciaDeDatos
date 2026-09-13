# packages/observability — salud y auditoria

| Archivo | Que es |
|---|---|
| `health.ts` | Lo que responde `/health`, sin instanciar ningun conector |
| `heartbeat.ts` | Latido del job |
| `cacheMetrics.ts` | Aciertos, fallos y antiguedad del cache |
| `auditEvents.ts` | Formas de evento y la puerta `assertConfigChangeIsAuditable` |

## Reglas

- **`/health` no toca la fuente.** Informa del conector activo sin crearlo.
- **Una ampliacion de ambito sin justificacion no puede llegar al registro**: la puerta lanza.
  El panel de auditoria es inutil si la fila que mas importa esta vacia.
- **La auditoria destaca aparte** las ampliaciones y los movimientos de carpeta.

## Que NO hacer

- No registrar datos personales ni valores de dimension en un evento de auditoria.
- No usar el registro de auditoria como log de aplicacion.
