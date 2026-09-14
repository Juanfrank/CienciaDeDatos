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

## El acceso se concede por EQUIPO, nunca a una persona suelta

Es una decision del modelo, no una carencia de ninguna pantalla, y conviene dejarla dicha porque
cada cierto tiempo alguien pide «dar permiso a esta persona» y la tentacion es anadir un campo.

`resolveEffectiveScope` resuelve el acceso de alguien a partir de su EQUIPO ACTIVO: los nodos que
ese equipo tiene concedidos y el ambito que resulta de encadenar las capas. No consulta ninguna
lista de concesiones individuales, y por eso una lista asi seria un segundo camino de acceso que
la resolucion no ve. Las consecuencias son dos, y las dos son peores que la molestia que
resolverian:

1. La pantalla de permisos diria que alguien alcanza un modulo que en realidad no alcanza, porque
   lo que decide es `resolveEffectiveScope` y no la tabla.
2. Revocar por el camino que si se consulta —quitar al equipo el nodo— dejaria a esa persona
   dentro, y nadie lo relacionaria con la concesion individual de hace seis meses.

Lo que SI se hace, y es lo que hace el panel desde la pantalla del modulo, es meter a esa persona
en un equipo que ya lo tiene, con su rol. Es el camino que el modelo reconoce, pasa por
`membershipChange` y queda en auditoria.

Abrir la concesion individual es un cambio de modelo: `resolveEffectiveScope` tendria que
consultarla como una capa mas, `AccessScope` decidir como se combina con la del equipo —y esa
combinacion no puede ampliar por accidente (4.10.4)—, y la revocacion tendria que cerrar los dos
caminos. No es una linea de codigo, y no se hace sin decidirlo a proposito.

## Que NO hacer

- No escribir una dimension de ambito sin validarla contra el esquema real.
- No permitir que un ambito se guarde ampliando sin justificacion.
- No dejar un equipo sin administrador: `lastAdministrator.ts` existe para impedirlo.
- No anadir una concesion de acceso directa a una persona sin cambiar tambien
  `resolveEffectiveScope`: seria un permiso que la resolucion de ambito no ve.
