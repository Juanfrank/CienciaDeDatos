# packages/data-contracts — la frontera con la fuente

Dos paquetes, separados a proposito.

| Paquete | Etiqueta | Que contiene |
|---|---|---|
| `types` | `contract-types` | Solo tipos: `IDataConnector`, `QueryRequest`, `QueryResult`, `SchemaDescriptor` |
| `server` | `server-data` | La fabrica que devuelve una implementacion real del conector |

## Por que estan separados

Cualquiera puede importar los TIPOS: un componente necesita saber que forma tiene una fila. Casi
nadie puede importar la IMPLEMENTACION: `type:server-data` solo lo alcanzan el job de poblacion
y otros paquetes de servidor.

Es el principio 2 expresado como limite de dependencia, y `npm run verify:boundaries` comprueba
que el lint lo sigue rechazando: hay un fixture que importa lo prohibido a proposito y la
verificacion falla si ese import deja de ser un error.

## Que NO hacer

- No anadir logica a `types`: son tipos.
- No exponer `createDataConnector` a traves de otro paquete para sortear el limite.
- No poner credenciales, cadenas de conexion ni nombres de servidor en `types`.
