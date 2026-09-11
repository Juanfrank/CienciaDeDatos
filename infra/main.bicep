// Infraestructura de la capa de visualizacion — Entregable B.1 de la Fase de cimiento.
//
// Criterio que gobierna este despliegue (seccion 5.1): NO se parte de un tier de costo alto.
// El punto de partida es el nivel mas economico que cumpla los requisitos funcionales, y subir
// de tier es una decision EVENTUAL basada en la evidencia de la prueba de carga (5.5), no un
// prerrequisito de diseno.
//
// Uso:
//   az deployment group what-if -g <grupo> -f infra/main.bicep -p infra/main.bicepparam
//   az deployment group create  -g <grupo> -f infra/main.bicep -p infra/main.bicepparam

targetScope = 'resourceGroup'

@description('Prefijo de nombres de todos los recursos.')
@minLength(3)
@maxLength(16)
param namePrefix string

@description('Region. Por defecto, la del grupo de recursos.')
param location string = resourceGroup().location

@description('Entorno al que corresponde este despliegue.')
@allowed([
  'staging'
  'produccion'
])
param environment string = 'staging'

@description('''
Id de un App Service Plan EXISTENTE con capacidad disponible.

Si la institucion ya opera un plan compartido con otras aplicaciones, se despliega ahi y el
despliegue inicial no requiere costo incremental alguno — que es un criterio de aceptacion
explicito de la seccion 9. Dejarlo vacio aprovisiona un plan Standard S1 nuevo.
''')
param existingAppServicePlanId string = ''

@description('SKU del plan si se aprovisiona uno nuevo. S1 es el piso funcional: el tier mas barato con slots y autoescalado.')
param appServicePlanSku string = 'S1'

@description('Imagen de contenedor a desplegar.')
param containerImage string

@description('Login de administrador de la base de identidad.')
param sqlAdminLogin string

@secure()
@description('Contrasena del administrador de la base de identidad. La provee el pipeline desde un secreto, nunca el repositorio.')
param sqlAdminPassword string

var tags = {
  aplicacion: 'capa-visualizacion'
  entorno: environment
  gestionadoPor: 'bicep'
}

module foundation 'modules/foundation.bicep' = {
  name: 'foundation'
  params: {
    namePrefix: namePrefix
    location: location
    tags: tags
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
  }
}

module appService 'modules/appService.bicep' = {
  name: 'appService'
  params: {
    namePrefix: namePrefix
    location: location
    tags: tags
    existingAppServicePlanId: existingAppServicePlanId
    appServicePlanSku: appServicePlanSku
    containerImage: containerImage
    appConfigEndpoint: foundation.outputs.appConfigEndpoint
    insightsConnectionString: foundation.outputs.insightsConnectionString
    sqlServerFqdn: foundation.outputs.sqlServerFqdn
    identityDatabaseName: foundation.outputs.identityDatabaseName
    keyVaultName: foundation.outputs.keyVaultName
  }
}

module functionApp 'modules/functionApp.bicep' = {
  name: 'functionApp'
  params: {
    namePrefix: namePrefix
    location: location
    tags: tags
    storageAccountName: foundation.outputs.storageAccountName
    appConfigEndpoint: foundation.outputs.appConfigEndpoint
    insightsConnectionString: foundation.outputs.insightsConnectionString
  }
}

module rbac 'modules/rbac.bicep' = {
  name: 'rbac'
  params: {
    storageAccountName: foundation.outputs.storageAccountName
    keyVaultName: foundation.outputs.keyVaultName
    appConfigName: last(split(foundation.outputs.appConfigId, '/'))
    appPrincipalId: appService.outputs.appPrincipalId
    stagingPrincipalId: appService.outputs.stagingPrincipalId
    functionPrincipalId: functionApp.outputs.functionPrincipalId
  }
}

output appUrl string = 'https://${appService.outputs.defaultHostName}'
output healthUrl string = 'https://${appService.outputs.defaultHostName}/health'
output functionAppName string = functionApp.outputs.functionAppName
output storageAccountName string = foundation.outputs.storageAccountName
output keyVaultName string = foundation.outputs.keyVaultName
output identityDatabaseHost string = foundation.outputs.sqlServerFqdn

@description('false cuando se reutilizo un plan existente, es decir, cuando el despliegue no anadio costo de plan.')
output aprovisionoPlanNuevo bool = appService.outputs.aprovisionoPlanNuevo
