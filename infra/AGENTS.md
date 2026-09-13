# infra — infraestructura como codigo

Plantillas Bicep del App Service, el almacenamiento, la base de identidad y Key Vault.

## Reglas

- **Se compila con advertencias como errores** (`npm run verify:infra`). Una propiedad mal
  ubicada en Bicep no falla el despliegue: se ignora, y la caracteristica que se creia activada
  nunca lo estuvo.
- **Los secretos viven en Key Vault**, nunca en la plantilla ni en una variable de aplicacion.
- **La afinidad de sesion no se usa como sustituto del estado compartido**: la aplicacion escala
  a mas de una instancia y hay prueba de que no pierde sesion al cambiar.

## Que NO hacer

- No poner cadenas de conexion, claves ni pimientas en la plantilla.
- No desplegar desde una maquina: el despliegue lo hace CI con el informe de estado de modulos,
  que dice cual queda apagado.
