// App Service que aloja la aplicacion — seccion 5.1.
//
// El punto de partida NO es un tier de costo alto: es el nivel mas economico que cumpla los
// requisitos funcionales. Standard S1 es ese piso, por ser el mas barato que soporta
// deployment slots y autoescalado nativo, ambos exigidos por 5.2 y 5.3.

@description('Prefijo de nombres.')
param namePrefix string

param location string
param tags object

@description('Id de un App Service Plan existente con capacidad disponible. Si se provee, se despliega ahi SIN costo incremental, en vez de aprovisionar un plan nuevo (5.1).')
param existingAppServicePlanId string = ''

@description('SKU del plan a aprovisionar si no se reutiliza uno existente. S1 es el piso funcional; subir de aqui es una decision dirigida por la prueba de carga de 5.5, no un supuesto de partida.')
param appServicePlanSku string = 'S1'

@description('Imagen de contenedor. Despliegue basado en Docker para reproducibilidad entre entornos, no build de codigo directo (5.1).')
param containerImage string

param appConfigEndpoint string
param insightsConnectionString string
param sqlServerFqdn string
param identityDatabaseName string
param keyVaultName string

var reutilizaPlanExistente = !empty(existingAppServicePlanId)
var planName = '${namePrefix}-plan'
var appName = '${namePrefix}-app'

resource planNuevo 'Microsoft.Web/serverfarms@2023-12-01' = if (!reutilizaPlanExistente) {
  name: planName
  location: location
  tags: tags
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

var planId = reutilizaPlanExistente ? existingAppServicePlanId : planNuevo.id

var ajustesComunes = [
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: insightsConnectionString
  }
  {
    // El conector activo y los feature flags se resuelven aqui en ejecucion, no se hornean
    // en el build: cambiar entre mock/sql/xmla no debe requerir redeploy (2.2).
    name: 'APP_CONFIG_ENDPOINT'
    value: appConfigEndpoint
  }
  {
    name: 'KEY_VAULT_NAME'
    value: keyVaultName
  }
  {
    // Sin contrasena: la conexion usa la Managed Identity del App Service.
    name: 'IDENTITY_DATABASE_URL'
    value: 'sqlserver://${sqlServerFqdn}:1433;database=${identityDatabaseName};authentication=ActiveDirectoryMsi;encrypt=true;trustServerCertificate=false'
  }
  {
    name: 'WEBSITES_PORT'
    value: '3000'
  }
]

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    // System-assigned: sin costo adicional y sin credenciales en variables de entorno planas.
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    // ARR affinity: complemento OPCIONAL de 6.7, nunca fuente de verdad. Reduce lecturas a la
    // base de sesion, pero la sesion vive en la base para que reciclar una instancia no la
    // pierda. Va en properties del sitio: dentro de siteConfig se ignora en silencio.
    clientAffinityEnabled: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/health'
      appSettings: ajustesComunes
    }
  }
}

// Slot de staging. Ningun despliegue va directo a produccion: se despliega aqui y se hace swap.
resource staging 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: app
  name: 'staging'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    // ARR affinity: complemento OPCIONAL de 6.7, nunca fuente de verdad. Reduce lecturas a la
    // base de sesion, pero la sesion vive en la base para que reciclar una instancia no la
    // pierda. Va en properties del sitio: dentro de siteConfig se ignora en silencio.
    clientAffinityEnabled: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/health'
      appSettings: ajustesComunes
    }
  }
}

// Autoescalado HORIZONTAL (5.2), disponible desde Standard sin necesidad de Premium.
// Los umbrales son un punto de partida explicito: la seccion 5.5 exige que la prueba de carga
// los sustituya por valores medidos antes de produccion.
// UMBRALES PROVISIONALES, todavia sin validar con una prueba de carga.
//
// La seccion 5.5 pide expresamente no dejar estos valores "por defecto sin validar", asi que se
// marcan como lo que son —un punto de partida razonable, no un resultado— en vez de dejar que
// parezcan medidos. El procedimiento para fijarlos y la medicion local de referencia estan en
// docs/operacion/prueba-de-carga.md. Al sustituirlos por los valores medidos, quitar este aviso.
resource autoscale 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (!reutilizaPlanExistente) {
  name: '${namePrefix}-autoscale'
  location: location
  tags: tags
  properties: {
    enabled: true
    targetResourceUri: planId
    profiles: [
      {
        name: 'por-defecto'
        capacity: {
          // Techo y piso explicitos: nunca autoescalado sin limite superior.
          minimum: '1'
          maximum: '5'
          default: '1'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: planId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'MemoryPercentage'
              metricResourceUri: planId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 80
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'HttpQueueLength'
              metricResourceUri: planId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              // Valor provisional: lo fija la prueba de carga de 5.5.
              threshold: 25
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: planId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT15M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

output appName string = app.name
output appPrincipalId string = app.identity.principalId
output stagingPrincipalId string = staging.identity.principalId
output defaultHostName string = app.properties.defaultHostName
output planId string = planId
output aprovisionoPlanNuevo bool = !reutilizaPlanExistente
