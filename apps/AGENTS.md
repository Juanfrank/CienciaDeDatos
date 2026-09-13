# apps — aplicaciones ejecutables

Tres cosas distintas, con reglas distintas.

| Carpeta | Etiqueta nx | Que es |
|---|---|---|
| `shell` | `type:app` | La aplicacion Next.js que ve una persona |
| `cache-populator` | `type:job` | Proceso aparte que puebla el cache desde la fuente |
| `modules` | `type:module` | Modulos de negocio insertables en el shell |

## La separacion que importa

`cache-populator` es el UNICO que puede tocar `IDataConnector`. El shell y los modulos leen del
cache. No es una convencion: `type:module` no puede importar `type:server-data`, y el lint lo
rechaza.

Si algo en el shell necesita un dato que no esta en el cache, la respuesta es anadirlo al job,
no consultar la fuente desde la peticion.

## Que NO hacer

- No mover logica de lectura de datos del job al shell «porque es mas comodo».
- No dar a un modulo acceso a configuracion de conexion, credenciales ni nombres de servidor.
- No crear una cuarta aplicacion sin decidir antes su etiqueta y sus limites.
