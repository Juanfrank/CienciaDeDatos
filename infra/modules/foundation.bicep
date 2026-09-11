// Recursos de base: Storage, Key Vault, App Configuration, Application Insights y la base de
// identidad. Todos comparten el criterio de la seccion 5: preferir cobro por uso real sobre
// costo fijo, y reutilizar capacidad ya asumida antes que aprovisionar de nuevo.

@description('Prefijo de nombres. Debe producir nombres globalmente unicos donde aplique.')
param namePrefix string

@description('Region de despliegue.')
param location string

@description('Etiquetas aplicadas a todos los recursos.')
param tags object

@description('Login de administrador de la base de identidad.')
param sqlAdminLogin string

@description('Contrasena del administrador. Se pasa desde Key Vault o desde el pipeline, nunca en texto en el repositorio.')
@secure()
param sqlAdminPassword string

var storageName = toLower(replace('${namePrefix}st', '-', ''))
var keyVaultName = '${namePrefix}-kv'
var appConfigName = '${namePrefix}-appcfg'
var insightsName = '${namePrefix}-ai'
var sqlServerName = '${namePrefix}-sql'
var identityDbName = 'identidad'

// Un unico Storage Account para todos los usos que la aplicacion necesita: L2 del cache (6.2),
// assets estaticos (5.4) y la cola de repoblacion dirigida (4.8). La seccion 6.2 pide
// explicitamente reutilizarlo en vez de aprovisionar uno nuevo por proposito.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // Se accede por Managed Identity; las claves compartidas quedan deshabilitadas para que
    // no exista siquiera la posibilidad de una credencial en variable de entorno.
    allowSharedKeyAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// L2 del cache: datasets serializados con su metadata de frescura (6.2).
resource cacheContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'cache'
  properties: {
    publicAccess: 'None'
  }
}

// Assets estaticos servidos via CDN/Front Door en Fase 3 (5.4), no desde el App Service.
resource staticContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'static'
  properties: {
    publicAccess: 'None'
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// El webhook de la capa de analisis (4.8) encola aqui; el job de poblacion la consume. El
// webhook no ejecuta la consulta dentro del ciclo HTTP.
resource refreshQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'dataset-refresh'
}

// Guarda el pepper de las contrasenas locales (4.7.2) y el resto de secretos.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    // RBAC en vez de politicas de acceso: los permisos se conceden por rol a la Managed
    // Identity, de forma auditable y con el mismo modelo que el resto de recursos.
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}

// Tier Free: resuelve el conector activo y los feature flags por modulo sin costo fijo.
resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: appConfigName
  location: location
  tags: tags
  sku: {
    name: 'free'
  }
  properties: {
    disableLocalAuth: true
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    IngestionMode: 'ApplicationInsights'
  }
}

// Base de identidad y gobierno (4.7.2 y 4.10.7). Dedicada y de alcance minimo: nunca mezclada
// con las tablas del Data Warehouse, y nunca alcanzable desde SqlDataConnector.
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource identityDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: identityDbName
  location: location
  tags: tags
  sku: {
    // Serverless General Purpose: se autopausa sin uso, coherente con el criterio de costo
    // de la seccion 5. Se revisa con la prueba de carga de 5.5.
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output storageAccountId string = storage.id
output storageAccountName string = storage.name
output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output appConfigId string = appConfig.id
output appConfigEndpoint string = appConfig.properties.endpoint
output insightsConnectionString string = insights.properties.ConnectionString
output insightsInstrumentationKey string = insights.properties.InstrumentationKey
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output identityDatabaseName string = identityDb.name
