# Observabilidad

Seccion 7 del contrato de ingenieria. Application Insights integrado desde el primer commit,
con trazas distribuidas desde el frontend hasta el conector de datos.

## `/health`

Lo usan las sondas de App Service para decisiones de reinicio y enrutamiento, asi que la
distincion entre **degradado** y **caido** no es cosmetica:

| Comprobacion | Fallo significa | Por que |
|---|---|---|
| `base-de-identidad` | **caido** | Sin ella no hay sesion ni resolucion de ambito: no se puede servir nada. |
| `cache-l2` | **degradado** | La aplicacion sigue sirviendo desde L1 el ultimo dato valido (6.9). Marcarlo caido haria que las sondas reiniciaran instancias sanas justo cuando mas hacen falta. |
| `job-de-poblacion` | **degradado** | Un job atrasado no impide servir; el dato se muestra con su fecha real. |
| `conector-de-datos` | **degradado** | Idem: el cache es la via de lectura, el conector solo lo puebla. |
| `coherencia-de-conector` | **degradado** | El job aun no recogio un cambio de conector. No es un fallo, pero hay que verlo. |

### Como se reporta el conector sin instanciar ninguno

La seccion 7 pide verificar "conectividad al conector de datos activo", pero el principio 2
prohibe que el proceso web invoque al conector. La lectura ingenua —que el shell instancie el
conector y llame a `testConnection()`— abriria en el App Service justo el camino que el
principio 2 cierra.

En su lugar, el job de poblacion escribe un **latido** en el cache (`ops:populator:heartbeat`)
con lo que observo en su ultima ejecucion, y `/health` lo lee de ahi. Es mas honesto: reporta
la conectividad *realmente observada por el componente que consulta*, no una conexion de prueba
que solo demuestra que el App Service alcanza la red.

Se hace cumplir por linter: `packages/observability` esta etiquetado `type:server` y no puede
importar `type:server-data`.

## Panel operativo minimo

Consultas KQL sobre Application Insights. Las tres primeras son metricas de **salud
operativa**, no de rendimiento.

```kusto
// Tasa de aciertos de cache
customEvents
| where name == "cache-serve"
| summarize aciertos = countif(tobool(customDimensions.hit)), total = count() by bin(timestamp, 5m)
| extend tasa = todouble(aciertos) / total
```

```kusto
// Antiguedad promedio del dato servido
customEvents
| where name == "cache-serve" and isnotnull(customDimensions.ageMs)
| summarize antiguedadMediaMin = avg(todouble(customDimensions.ageMs)) / 60000
    by tostring(customDimensions.datasetId), bin(timestamp, 15m)
```

```kusto
// Latencia p95 por conector
customEvents
| where name == "governed-query"
| summarize p95 = percentile(todouble(customDimensions.durationMs), 95)
    by tostring(customDimensions.connector), bin(timestamp, 1h)
```

```kusto
// Tasa de error por modulo
requests
| where url contains "/m/"
| summarize errores = countif(success == false), total = count()
    by tostring(split(url, "/")[2]), bin(timestamp, 1h)
```

```kusto
// Intentos de login fallidos por proveedor.
// Un repunte en 'local' es senal temprana de fuerza bruta contra cuentas locales, que no
// heredan el acceso condicional de Azure AD.
customEvents
| where name == "login"
| where tostring(customDimensions.outcome) == "fallo"
| summarize count() by tostring(customDimensions.authProvider), bin(timestamp, 10m)
```

```kusto
// Excepciones de ampliacion de ambito activas.
// Deberia tender a CERO. Un numero creciente es senal de gobierno de RLS deteriorandose,
// asi que esta metrica se lee como tendencia, no como valor puntual.
customEvents
| where name == "config-change"
| where tobool(customDimensions.isScopeExpansion)
| summarize ampliaciones = count() by bin(timestamp, 1d)
| render timechart
```

### La consulta que verifica el principio 2

Es el criterio de aceptacion de la seccion 9 sobre el camino de lectura, comprobable como
consulta y no como revision manual. **Debe devolver cero filas siempre:**

```kusto
customEvents
| where name == "governed-query"
| where tostring(customDimensions.invokedBy) != "cache-populator"
```

Si alguna vez devuelve algo, una solicitud de usuario alcanzo el conector y el principio 2 se
rompio en produccion. Conviene tenerla como alerta, no solo como panel.

## Auditoria de acceso consolidada

Ambos proveedores de identidad escriben en el **mismo** log, con el mismo formato y el mismo
nivel de detalle, aunque Azure AD ya tenga los suyos nativos en Entra ID. La consolidacion
existe para tener una sola vista de auditoria de acceso a la aplicacion; para las cuentas
locales, ademas, no hay alternativa.

## Auditoria de configuracion

Los cambios a roles, equipos, la organizacion general y los ambitos se registran como eventos
versionados, no como sobrescritura. Las **excepciones de ampliacion de ambito** llevan marca
propia (`isScopeExpansion`) para mostrarse de forma destacada, no mezcladas con el resto.

`assertConfigChangeIsAuditable` impide registrar una ampliacion sin justificacion: el panel de
auditoria es inutil si la fila que mas importa esta vacia.

## Pendiente

- Wiring real del SDK de Application Insights, que entra con el shell de Next.js y el Function
  App del job.
- Trazas distribuidas de extremo a extremo (correlacion frontend -> API -> cache).
- Alertas sobre las consultas de arriba, en particular la del principio 2.
