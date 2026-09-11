# Infraestructura como codigo

Entregable **B.1** de la Fase de cimiento. Plantillas Bicep para App Service, Storage, Key
Vault, Azure SQL, App Configuration, Application Insights y el Function App del job de
poblacion.

```
infra/
  main.bicep              Orquestacion, parametros y salidas
  main.bicepparam         Parametros de staging
  modules/
    foundation.bicep      Storage, Key Vault, App Configuration, App Insights, Azure SQL
    appService.bicep      Plan (condicional), app, slot de staging, autoescalado
    functionApp.bicep     Job de poblacion de cache, plan Consumo
    rbac.bicep            Asignaciones de rol con permiso minimo
```

## Comprobacion

```bash
az bicep build --file infra/main.bicep          # compila sin advertencias
az deployment group what-if -g <grupo> -f infra/main.bicep -p infra/main.bicepparam
```

CI compila las plantillas en cada cambio con `--verbose`, de modo que una advertencia nueva
rompe el build en vez de colarse: una propiedad mal ubicada en Bicep se ignora en silencio en
el despliegue, y eso ya paso una vez durante esta implementacion (`clientAffinityEnabled`
estaba dentro de `siteConfig`, donde no aplica).

## Recursos

| Recurso | Notas |
|---|---|
| App Service (Linux, contenedor) | `main.bicep` acepta el parametro opcional `existingAppServicePlanId`. Si se provee, se despliega sobre el plan compartido existente sin costo incremental; si no, aprovisiona **Standard S1**, el tier mas barato con *slots* y autoescalado nativo. Slot `staging` ademas del de produccion, con *swap*. Ningun despliegue va directo a produccion. La salida `aprovisionoPlanNuevo` dice cual de los dos caminos se tomo. |
| Storage Account | Contenedores `cache` (L2) y `static`; cola `dataset-refresh`. Un solo Storage Account para todos los fines, en vez de uno por proposito. |
| Azure SQL | Identidad local, equipos, arbol de navegacion, paquetes, ambitos, sesion y auditoria. |
| Key Vault | *Pepper* de contraseñas locales y secretos. |
| App Configuration (**Free**) | Conector activo y *feature flags* por modulo. |
| Application Insights | Trazas, auditoria de acceso consolidada, metricas de cache. |
| Function App (Consumo) | Job de poblacion de cache. |

## Managed Identity, no credenciales

Todo acceso usa **Managed Identity system-assigned** con roles RBAC minimos
(`Storage Blob Data Contributor`, `Key Vault Secrets User`, `App Configuration Data Reader`).
Nunca credenciales en variables de entorno planas.

**Aislamiento del almacen de identidad (4.7.2):** la identidad que usa `SqlDataConnector` para
alcanzar el Data Warehouse **no recibe permiso alguno** sobre la base de identidad. El
aislamiento se consigue con identidades distintas y permisos distintos, no con disciplina de
codigo.

## Redis: opcion de escalado futuro, no descarte definitivo

Azure Cache for Redis queda **fuera del alcance de este despliegue**: incluso en su tier mas
economico es un servicio de costo fijo, activo permanentemente, con independencia de cuanto se
use. Dado el criterio de evitar costos incrementales innecesarios, no entra en esta fase.

Esto **no es un descarte definitivo**. Se adopta si la evidencia operativa —volumen de lectura,
latencia requerida, resultado de la prueba de carga— lo justifica. Para que esa migracion sea
un cambio de implementacion y no un rediseño, el cache vive detras de `ICacheStore` desde el
dia uno: `RedisCacheStore` se añadiria como una implementacion mas de la misma interfaz,
seleccionable por configuracion — el mismo patron de sustituibilidad que ya rige
`IDataConnector`.

## Autoescalado: configurado, pero con umbrales provisionales

`appService.bicep` define escalado **horizontal** (5.2) con las tres senales que pide el
documento —CPU sostenida por encima del 70%, memoria por encima del 80% y longitud de cola
HTTP— mas una regla de reduccion, y con techo y piso explicitos: nunca autoescalado sin limite
superior.

Los umbrales actuales son un **punto de partida declarado, no un valor validado**. La seccion
5.5 exige que la prueba de carga con Azure Load Testing los sustituya por valores medidos antes
de cualquier lanzamiento a produccion, y es tambien el insumo que decide si conviene subir de
tier por encima de Standard. Esa prueba es Fase 3 y es bloqueante.

## Diferido a la Fase 3

- **Azure CDN / Front Door** para los assets estaticos, con `Cache-Control` agresivo y hash en
  el nombre de archivo. No se sirven desde el App Service.
- **Prueba de carga con Azure Load Testing**, que fija los umbrales reales de autoescalado y
  sustenta con evidencia cualquier decision de subir de tier.
- **Rate limiting del endpoint de login** a nivel de Front Door (4.7.2), que es independiente
  del bloqueo de cuenta ya implementado en `@app/auth`: aquel protege una cuenta concreta,
  este protege el endpoint frente a fuerza bruta distribuida.
