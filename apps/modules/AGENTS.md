# apps/modules — modulos de negocio

Un modulo compone objetos del catalogo sobre una rejilla y los enlaza a datasets. No sabe de que
fuente vienen los datos, ni construye consultas.

## Limites

`type:module` solo puede importar `type:ui`, `type:contract-types`, `type:lib` y `type:util`. En
particular NO puede importar `type:server-data`, que es lo que habla con la fuente.

`sample-module/src/__boundary-fixture__/forbidden-import.ts` importa lo prohibido a proposito.
No es codigo muerto: `npm run verify:boundaries` lintea ese archivo y falla si el import deja de
ser un error. Es lo que garantiza que la regla sigue mordiendo despues de una migracion de
configuracion.

## Que NO hacer

- No borrar ni «arreglar» el fixture negativo.
- No importar nada de servidor, ni configuracion de conexion.
- No construir una consulta: se declara un `datasetId` y un mapeo de ranuras.
