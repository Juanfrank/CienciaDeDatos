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

## Que NO hacer

- No escribir una dimension de ambito sin validarla contra el esquema real.
- No permitir que un ambito se guarde ampliando sin justificacion.
- No dejar un equipo sin administrador: `lastAdministrator.ts` existe para impedirlo.
