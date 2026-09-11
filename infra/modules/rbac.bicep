// Asignaciones de rol — seccion 5.1: Managed Identity con permisos minimos, nunca credenciales
// en variables de entorno planas.
//
// Este modulo es tambien donde se materializa el aislamiento de 4.7.2: la identidad que
// SqlDataConnector usara para alcanzar el Data Warehouse NO recibe aqui ningun rol sobre la
// base de identidad ni sobre Key Vault. El aislamiento se consigue con permisos distintos, no
// con disciplina de codigo.

param storageAccountName string
param keyVaultName string
param appConfigName string

@description('Principal de la aplicacion (slot de produccion).')
param appPrincipalId string

@description('Principal del slot de staging. Tiene los mismos roles: un swap no debe cambiar permisos.')
param stagingPrincipalId string

@description('Principal del job de poblacion de cache.')
param functionPrincipalId string

// Identificadores de rol integrados de Azure.
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributor = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var appConfigDataReader = '516239f1-63e1-4d78-a4de-a74fb236a071'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' existing = {
  name: appConfigName
}

var principalesDeLaApp = [
  {
    nombre: 'app'
    id: appPrincipalId
  }
  {
    nombre: 'staging'
    id: stagingPrincipalId
  }
]

// La aplicacion LEE Y ESCRIBE el cache: escribe porque promueve a L1 y porque sirve assets,
// pero NUNCA invoca el conector. Esa restriccion no se expresa aqui con permisos de Azure,
// sino con la regla de limites de dependencia del monorepo.
resource appBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesDeLaApp: {
  name: guid(storage.id, p.id, storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: p.id
    principalType: 'ServicePrincipal'
  }
}]

// La aplicacion ENCOLA la repoblacion dirigida del webhook de 4.8; no la ejecuta.
resource appQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesDeLaApp: {
  name: guid(storage.id, p.id, storageQueueDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributor)
    principalId: p.id
    principalType: 'ServicePrincipal'
  }
}]

// Solo lectura de secretos: el pepper de contrasenas locales (4.7.2). La aplicacion no
// necesita crear ni rotar secretos, asi que no recibe permiso para hacerlo.
resource appKeyVault 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesDeLaApp: {
  name: guid(keyVault.id, p.id, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: p.id
    principalType: 'ServicePrincipal'
  }
}]

// Solo lectura: el conector activo y los feature flags se cambian desde el portal o el
// pipeline, nunca por la propia aplicacion en ejecucion.
resource appAppConfig 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesDeLaApp: {
  name: guid(appConfig.id, p.id, appConfigDataReader)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReader)
    principalId: p.id
    principalType: 'ServicePrincipal'
  }
}]

// El job escribe el cache: es el unico que lo puebla.
resource functionBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionPrincipalId, storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: functionPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// El job consume la cola de repoblacion dirigida.
resource functionQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionPrincipalId, storageQueueDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributor)
    principalId: functionPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource functionAppConfig 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfig.id, functionPrincipalId, appConfigDataReader)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReader)
    principalId: functionPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// El job necesita las credenciales de la fuente de datos, que la aplicacion NO necesita.
resource functionKeyVault 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionPrincipalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: functionPrincipalId
    principalType: 'ServicePrincipal'
  }
}
