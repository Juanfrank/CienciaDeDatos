// Job de poblacion de cache — seccion 6.4.
//
// Es el UNICO componente que invoca IDataConnector.query(). Corre desacoplado del ciclo de
// vida de cualquier solicitud HTTP: por Timer Trigger segun la recurrencia de cada dataset, y
// por Queue Trigger para la repoblacion dirigida que origina el webhook de 4.8.
//
// Se usa Azure Functions en plan Consumo y no un WebJob del App Service —que es lo que sugiere
// 6.4 para no sumar computo— porque los WebJobs continuos no estan soportados en App Service
// Linux con despliegue por contenedor, que es lo que fija ADR-002. Ver docs/adr/ADR-004.

param namePrefix string
param location string
param tags object
param storageAccountName string
param appConfigEndpoint string
param insightsConnectionString string

var functionPlanName = '${namePrefix}-fnplan'
var functionAppName = '${namePrefix}-fn'

// Consumo: cobra por ejecucion. En reposo el costo tiende a cero, que es el criterio de la
// seccion 5 sobre no asumir costos fijos innecesarios.
resource functionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: functionPlanName
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp,linux'
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          // Comparte el Storage Account que la aplicacion ya necesita (6.2), en vez de
          // aprovisionar uno propio. Por identidad, sin clave compartida.
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insightsConnectionString
        }
        {
          // El job resuelve por aqui que conector esta activo, igual que la aplicacion: si se
          // alterna entre mock/sql/xmla, ambos siguen el cambio sin redeploy.
          name: 'APP_CONFIG_ENDPOINT'
          value: appConfigEndpoint
        }
        {
          name: 'CACHE_CONTAINER'
          value: 'cache'
        }
        {
          name: 'REFRESH_QUEUE'
          value: 'dataset-refresh'
        }
      ]
    }
  }
}

output functionAppName string = functionApp.name
output functionPrincipalId string = functionApp.identity.principalId
