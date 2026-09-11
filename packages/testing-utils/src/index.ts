/**
 * Utilidades compartidas de prueba.
 *
 * MARCADOR DE POSICION, reservado para helpers que sean genuinamente transversales
 * (por ejemplo, un reloj falso o un generador de identidades).
 *
 * Los fixtures del modelo de gobierno NO viven aqui: viven en el propio paquete que define
 * ese dominio (`@app/access-control`, exportados como `gobiernoFixtures`). Ponerlos aqui
 * creaba una dependencia circular —access-control probandose a si mismo a traves de un
 * paquete que depende de el— que el linter de limites rechaza con razon.
 */
export const PENDIENTE_DE_IMPLEMENTACION = 'Fase 2' as const;
