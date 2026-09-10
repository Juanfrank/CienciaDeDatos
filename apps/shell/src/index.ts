/**
 * Shell de la aplicacion: navegacion, layout, autenticacion y la API propia (Route Handlers).
 *
 * MARCADOR DE POSICION. La aplicacion Next.js se scaffoldea en el Entregable B; aqui solo
 * se reserva el proyecto con sus etiquetas de limites ya aplicadas (`type:app`).
 *
 * Restriccion de limites que aplica a este proyecto y conviene tener presente al llenarlo:
 * el shell NO puede depender de `type:server-data`. El camino de lectura de una solicitud
 * de usuario se sirve exclusivamente desde el cache (6.3), y /health reporta el conector
 * activo leyendo el latido que deja el job de poblacion — sin instanciar conector alguno.
 */
export const PENDIENTE_DE_IMPLEMENTACION = 'Entregable B — Fase de cimiento' as const;
