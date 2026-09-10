# Infraestructura como codigo

**Pendiente — Entregable B.1 (Fase de cimiento).** Esta carpeta contendra las plantillas Bicep.
Se documenta aqui lo ya decidido, porque dos de estas decisiones son requisitos explicitos del
contrato de ingenieria y conviene que no se pierdan entre la aprobacion del *gate* y su
implementacion.

## Recursos previstos

| Recurso | Notas |
|---|---|
| App Service (Linux, contenedor) | `main.bicep` acepta un parametro opcional `existingAppServicePlanId`. Si se provee, se despliega sobre el plan compartido existente sin costo incremental; si no, aprovisiona **Standard S1**, el tier mas barato con *slots* y autoescalado nativo. Slots `staging` y `production`, con *swap*. Ningun despliegue va directo a produccion. |
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

## Diferido a la Fase 3

- **Azure CDN / Front Door** para los assets estaticos, con `Cache-Control` agresivo y hash en
  el nombre de archivo. No se sirven desde el App Service.
- **Reglas de autoescalado.** Los umbrales concretos no se fijan por defecto: los determina la
  prueba de carga con **Azure Load Testing**, que es bloqueante antes de produccion y es
  tambien el insumo que decide si conviene subir de tier por encima de Standard. Subir de tier
  es una decision dirigida por datos, no un punto de partida asumido.
