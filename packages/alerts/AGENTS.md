# packages/alerts — alertas y suscripciones

Avisos basados en datos (4.9): una condicion sobre una medida, evaluada en un calendario.

| Archivo | Que es |
|---|---|
| `types.ts` | Alerta, condicion y suscripcion |
| `evaluate.ts` | Si la condicion se cumple con los datos vigentes |
| `calendario.ts` | Cuando toca evaluar |
| `notificaciones.ts` | Como se entrega |
| `store.ts` | Persistencia |

## Reglas

- **La alerta se evalua sobre el cache**, con el ambito de quien la creo.
- **Una alerta que no puede evaluarse lo dice**; no se queda callada.

## Que NO hacer

- No enviar en la notificacion datos que quien la recibe no podria ver en la aplicacion.
- No evaluar en el camino de una peticion de persona.
