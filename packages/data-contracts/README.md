# `data-contracts` — capa de abstraccion de datos

> Artefacto **A.2** del *gate* de la seccion 0. Implementa la seccion 2 del contrato de ingenieria.

Este es el requisito mas importante del contrato: **ninguna pantalla, componente o modulo de
negocio puede referenciar un driver XMLA, una cadena de conexion SQL, o el nombre de un
servidor o base de datos.** Todo acceso a datos pasa por `IDataConnector`.

## Dos proyectos, un solo directorio

La carpeta contiene **dos proyectos de Nx** con etiquetas distintas. Esa separacion es el
mecanismo que hace cumplir el principio 2 por linter en vez de por convencion:

| Proyecto | Paquete | Etiqueta | Quien puede importarlo |
|---|---|---|---|
| `types/` | `@app/data-contracts` | `type:contract-types` | **Cualquiera.** Solo tipos: no arrastra implementaciones ni credenciales. |
| `server/` | `@app/data-contracts-server` | `type:server-data` | **Solo `apps/cache-populator`.** Contiene las implementaciones. |

Importar `@app/data-contracts-server` desde un modulo de negocio, desde `ui-components` o
desde el shell es un **error de linter**. Eso convierte este criterio de aceptacion de la
seccion 9 en algo verificable:

> Ninguna solicitud de un modulo, disparada por una persona usuaria, invoca
> `IDataConnector.query()` de forma directa.

Se comprueba con `npm run verify:boundaries`, que lintea a proposito un fixture que viola la
regla y afirma que falla por la regla correcta.

> **Nota sobre el nombre.** El plan hablaba de un punto de entrada `@app/data-contracts/server`.
> Un nombre npm con ambito admite una sola barra, asi que el paquete se llama
> `@app/data-contracts-server`. La separacion y su efecto son identicos.

## Los tres conectores

Se tratan como **pares entre si**: ninguno es "el correcto" y otro "la excepcion".

| Conector | Estado | `nativeRls` | Notas |
|---|---|---|---|
| `MockDataConnector` | **Funcional** | configurable (`false` por defecto) | Datos sinteticos deterministas desde `server/schema/mock-schema.json`. |
| `SqlDataConnector` | Pendiente — Fase 4 | `false` | Conector de primera clase, no una excepcion temporal. Puede terminar siendo la fuente definitiva. |
| `XmlaDataConnector` | Pendiente — Fase 4, condicionado | `true` | Se activa solo si la capa de analisis decide construir el modelo semantico. No darlo por hecho. |

Los conectores pendientes **no simulan exito**: `testConnection()` devuelve `false` y
`query()` lanza `ConnectorNotImplementedError` nombrando la fase que lo implementa. La
ausencia de implementacion es ruidosa y trazable, no un resultado vacio que se confunda con
"no hay datos".

### Por que `MockDataConnector` permite configurar `nativeRls`

Porque las dos estrategias de cacheo de la seccion 6.6 dependen de esa capacidad, y sin poder
simular ambas no se podrian probar hasta que exista una fuente real:

- **`nativeRls: false`** (por defecto, imita a `Sql`): el conector devuelve el superconjunto.
  La aplicacion resuelve el ambito (4.10.4) al leer del cache. Un mismo dataset cacheado sirve
  a equipos distintos, cada uno viendo su subconjunto.
- **`nativeRls: true`** (imita a `Xmla`): el conector filtra por `securityContext`. El dataset
  queda ligado a un contexto de seguridad concreto y su clave de cache debe incluir el hash de
  ese contexto (6.8).

## Prueba de fuente-agnosticismo (2.4)

Cambiar de conector es cambiar `DataConnectorConfig.kind`, que en ejecucion provee **Azure App
Configuration** — no una variable de entorno horneada en el build, para poder alternar entre
`mock`, `sql` y `xmla` en produccion sin redeploy.

El arnés de prueba queda parametrizado por conector desde ahora, pero **en esta fase solo puede
ejecutarse contra `mock`**, porque los otros dos todavia no tienen fuente contra la cual correr.
`sql` se incorpora en cuanto exista una vista curada; `xmla`, solo si la capa de analisis
entrega el modelo semantico.

## Pendiente en este paquete

- `sql-queries/registry.json` — registro y gobierno de consultas parametrizadas (2.3). Se crea
  junto con la primera consulta real de `SqlDataConnector`.
- Confirmar las dimensiones reales del esquema simulado con el equipo de la capa de analisis.
  Las actuales (`DimTribunal`, `DimTiempo`, `DimTipoCaso`, `FactCasos`) son una aproximacion
  razonable, no un esquema acordado.
