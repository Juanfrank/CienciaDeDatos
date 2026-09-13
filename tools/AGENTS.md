# tools — verificacion y utilidades

Scripts que no forman parte de la aplicacion. `project.json` los declara como el proyecto nx
`verificacion`, de modo que se cachean y entran en `affected` como cualquier otra tarea.

| Comando | Que hace |
|---|---|
| `nx run verificacion:typecheck` | `tsc -b` sobre todas las referencias |
| `nx run verificacion:limites` | Comprueba que la regla de limites sigue rechazando el fixture |
| `nx run verificacion:esquema` | Valida el esquema Prisma |
| `nx run verificacion:infra` | Compila Bicep tratando toda advertencia como error |
| `tsx tools/poblar-cache.mts` | Puebla el cache |
| `tsx tools/estado-de-modulos.mts` | Valida cada modulo por separado y produce el informe |

## Reglas

- **Una verificacion que no puede fallar no sirve.** `verify-module-boundaries.sh` afirma dos
  cosas: que el lint falla, y que falla POR LA REGLA correcta.
- **Toda advertencia de Bicep es un error.** Una propiedad mal ubicada no rompe el despliegue: se
  ignora en silencio, y eso ya paso una vez.
- **Cada target declara sus entradas y salidas.** Sin salidas declaradas, un acierto de cache
  deja el directorio sin construir y la verificacion siguiente mide algo viejo.

## Que NO hacer

- No anadir un script de verificacion como script suelto de npm: no se cachea ni entra en
  `affected`.
- No poner en un YAML de CI una variable que el target necesita para correr en local.
