using 'main.bicep'

param namePrefix = 'pjviz-stg'
param environment = 'staging'

// Reutilizar capacidad ya asumida antes que aprovisionar de nuevo (5.1). Si la institucion
// tiene un App Service Plan compartido con capacidad disponible, poner aqui su id: el
// despliegue inicial no anade entonces costo de plan alguno.
//   param existingAppServicePlanId = '/subscriptions/.../serverfarms/plan-compartido'
param existingAppServicePlanId = ''

param appServicePlanSku = 'S1'
param containerImage = 'ghcr.io/juanfrank/capa-visualizacion:latest'

param sqlAdminLogin = 'adminidentidad'
// La contrasena la inyecta el pipeline desde un secreto. Nunca un valor real aqui.
param sqlAdminPassword = readEnvironmentVariable('SQL_ADMIN_PASSWORD', '')
