# packages — librerias compartidas

Una carpeta por responsabilidad. La etiqueta de cada `project.json` decide quien puede
importarla; el lint lo comprueba y `npm run verify:boundaries` comprueba que el lint sigue
mordiendo.

| Paquete | Etiqueta | Que resuelve |
|---|---|---|
| `data-contracts/types` | `contract-types` | `IDataConnector`, `QueryRequest`, `SchemaDescriptor`. Solo tipos |
| `data-contracts/server` | `server-data` | La unica implementacion que habla con la fuente |
| `ui-components` | `ui` | Repositorio de objetos versionados, modelo de vista y opciones de grafico |
| `design-tokens` | `util` | Tema Material Design 3 y puerta de contraste |
| `access-control` | `lib` | Ambito, equipos, arbol, paquetes y permisos |
| `module-model` | `lib` | Definicion de modulo, rejilla, interaccion y salud |
| `caching` | `server` | `ICacheStore` y el lector de datasets |
| `auth` | `server` | Proveedores de identidad, politica de clave y restablecimiento |
| `identity-db` | `server` | Esquema Prisma, filas y datos sembrados |
| `export` | `server` | Documento comun a los cuatro formatos de exportacion |
| `alerts` | `server` | Alertas y suscripciones basadas en datos |
| `observability` | `server` | Salud, metricas de cache y eventos de auditoria |
| `config` | `server` | Resolucion de configuracion por capas |
| `nl-query` | `util` | Consulta en lenguaje natural |
| `testing-utils` | `util` | Ayudas de prueba |

## Reglas

- **Cada paquete exporta por `src/index.ts`.** Nadie importa una ruta interna de otro paquete.
- **`type:util` solo depende de `type:util`.** Es lo que mantiene el tema y los tipos libres de
  todo lo demas.
- **Un paquete de servidor no se importa desde un componente de cliente.**
- **Las pruebas viven junto al codigo**, como `<archivo>.spec.ts`.

## Que NO hacer

- No crear un paquete sin etiqueta: sin ella no hay limite que lo proteja.
- No mover un tipo compartido a un paquete de servidor «de momento».
- No importar `data-contracts/server` desde nada que no sea el job de poblacion.
