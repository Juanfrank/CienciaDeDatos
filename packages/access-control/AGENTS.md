# packages/access-control — quien ve que

Ambito de acceso, equipos, arbol de organizacion, paquetes de modulos y matriz de permisos
(4.10).

| Archivo | Que resuelve |
|---|---|
| `AccessScope.ts` | Ambito, combinacion de capas y deteccion de ampliacion |
| `resolveEffectiveScope.ts` | El ambito efectivo, con la traza de que capa lo impuso |
| `NavigationTree.ts`, `treeOperations.ts` | Arbol, mover, papelera y auditoria del movimiento |
| `Team.ts`, `ModulePackage.ts` | Equipos y paquetes visuales |
| `permissions.ts` | Matriz de permisos y `assertCan` |
| `navigation.ts` | Vista de navegacion y nodos no mostrables |

## La regla que ordena todo

**Cualquier combinacion de capas resulta mas restrictiva o igual, nunca mas permisiva por
accidente.** Ampliar requiere marcarlo como excepcion con `authorizedExpansion`, que exige
justificacion escrita y queda en auditoria. `wouldExpand` detecta el caso y el panel de
administracion lo cablea antes de guardar.

`resolveEffectiveScope` devuelve `steps` con la capa, la fuente y el ambito acumulado: es lo que
permite decir QUE CARPETA origino una restriccion, no solo cual es.

## Se concede por EQUIPO y, como excepcion, a una PERSONA

Hay dos caminos de concesion, y el segundo se abrio a proposito.

El normal es el EQUIPO: `Team.grantedNodes`. Es lo que se usa para todo lo que tiene que escalar
—un area, una jurisdiccion, un tribunal— porque la persona que entra manana hereda lo que ya
tiene su equipo sin que nadie se acuerde de ella.

El segundo es la PERSONA: `GovernedUser.grantedNodes`. Antes no existia, y el boton de «anadir
personas» del panel la metia en un equipo que ya tenia el modulo. Concedia, si, pero de paso le
daba todo lo demas que tuviera ese equipo, y el registro decia «cambio de membresia» donde lo que
habia pasado era «le dieron este modulo». Es la excepcion nominal: esta persona, este modulo.

Que sean dos obliga a dos cosas, y las dos estan cumplidas. Si se toca algo de esto, tienen que
seguir cumpliendose:

1. **Se juntan en un solo sitio.** `accessibleModuleIds(generalTree, team, user)` es la union, y
   todo lo que pregunta «alcanza esta persona este modulo» pasa por ahi — `canAccessModule` y
   `buildNavigationView`. Mientras solo exista una union, no puede haber una pantalla que diga que
   alguien alcanza algo que no alcanza. `canTeamAccessModule` sigue existiendo para la pregunta
   que de verdad es sobre el equipo (la columna «alcanza» de la tabla de permisos); usarla donde
   se pregunta por una persona responderia que no a quien si lo tiene.
2. **No abre el ambito.** Alcanzar el modulo no es ver sus filas. `resolveEffectiveScope` no mira
   `grantedNodes` de nadie: parte del ambito del equipo activo y baja por las carpetas, asi que
   quien llega por concesion individual ve el modulo con las restricciones que le tocan por donde
   esta. Conceder acceso nunca amplia lo que se ve dentro, que es justo lo que 4.10.4 protege.

La revocacion cierra el camino por el que se concedio, y solo ese: la × de la tabla de personas
quita la concesion individual, la de equipos quita el nodo del equipo, y lo heredado de una
carpeta se revoca en la carpeta. La pantalla dice los caminos que tiene cada cual precisamente
para que quitar uno no parezca quitar todos.

Se audita como `user-grant`, no como un cambio del equipo: leer el registro de un equipo no puede
contar quien mas alcanza sus modulos.

## Que NO hacer

- No escribir una dimension de ambito sin validarla contra el esquema real.
- No permitir que un ambito se guarde ampliando sin justificacion.
- No dejar un equipo sin administrador: `lastAdministrator.ts` existe para impedirlo.
- No preguntar por el acceso de una PERSONA con `canTeamAccessModule`: no ve su concesion
  individual y responderia que no a quien si lo tiene.
- No hacer que la concesion —de equipo o individual— toque el ambito. Alcanzar un modulo y ver sus
  filas son dos preguntas distintas, y mezclarlas amplia por accidente.
