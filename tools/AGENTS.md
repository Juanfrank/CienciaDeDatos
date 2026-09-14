# tools — verificacion y utilidades

Scripts que no forman parte de la aplicacion. `project.json` los declara como el proyecto nx
`verificacion`, de modo que se cachean y entran en `affected` como cualquier otra tarea.

| Comando | Que hace |
|---|---|
| `nx run verification:typecheck` | `tsc -b` sobre las referencias Y `tsc -p apps/shell` aparte |
| `nx run coherence:test` | Los dos lados de cada contrato que nadie ata; ver `coherence/AGENTS.md` |
| `nx run verification:boundaries` | Comprueba que la regla de limites sigue rechazando el fixture |
| `nx run verification:schema` | Valida el esquema Prisma |
| `nx run verification:infra` | Compila Bicep tratando toda advertencia como error |
| `tsx tools/populate-cache.mts` | Puebla el cache |
| `tsx tools/module-status.mts` | Valida cada modulo por separado y produce el informe |

## Reglas

- **Una verificacion que no puede fallar no sirve.** `verify-module-boundaries.sh` afirma dos
  cosas: que el lint falla, y que falla POR LA REGLA correcta.
- **Toda advertencia de Bicep es un error.** Una propiedad mal ubicada no rompe el despliegue: se
  ignora en silencio, y eso ya paso una vez.
- **Cada target declara sus entradas y salidas.** Sin salidas declaradas, un acierto de cache
  deja el directorio sin construir y la verificacion siguiente mide algo viejo.
- **Lo afectado es la via normal.** `npm run afectado` en local y `nx affected` en los PR. Lo
  que decide si una tarea corre de verdad son los `inputs` de `nx.json`, no `affected`: el input
  `pruebas` excluye los `.md`, asi que tocar una especificacion marca el proyecto como afectado
  pero la tarea sale de cache.
- **El shell se comprueba APARTE.** El `tsconfig.json` de la raiz excluye `apps/shell/**`, porque
  Next necesita sus propias opciones, y `next.config.mjs` lleva `ignoreBuildErrors: true`. Entre
  las dos cosas, la aplicacion mas grande del repositorio estuvo sin comprobar: `tsc -b` la
  saltaba y `next build` tampoco miraba. Por eso el target invoca dos veces al compilador.

## Que NO hacer

- No anadir un script de verificacion como script suelto de npm: no se cachea ni entra en
  `affected`.
- No poner en un YAML de CI una variable que el target necesita para correr en local.
- No quitar la segunda invocacion del compilador del target `typecheck` ni dar por hecho que
  `tsc -b` cubre `apps/shell`: no lo cubre.
