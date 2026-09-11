# ADR-012: El estado de un modulo decide quien lo ve, y se comprueba en el backend

- **Estado:** aceptada
- **Fecha:** 2026-09-11
- **Contexto del contrato de ingenieria:** Seccion 4.1 ("los borradores son personales; publicar a nivel institucional requiere aprobacion de un Administrador"). Seccion 4.2 (editor con objetos prediseñados, sin SQL libre, validando el esquema en cada carga). Matriz de 4.10.1. Criterio de la seccion 9 sobre comprobar en el backend y no ocultando botones.

## Contexto

`ModuleStatus` —`borrador | pendiente-de-aprobacion | publicado`— estaba tipado desde F2.3 y **ningun modulo llegaba nunca a cambiarlo**: todos nacian `publicado` porque venian escritos a mano en `modulos.ts`. `findPublishBlockers`, que decide si algo se puede publicar, estaba escrita y probada desde la misma fase y no la invocaba nadie. Es el cuarto caso del mismo patron en este repositorio, despues de `wouldExpand`, `assertConfigChangeIsAuditable` y el paquete `@app/auth` entero.

Sin flujo, la distincion entre "lo que alguien esta probando" y "lo que la institucion respalda" no existia. Y sin editor, la unica forma de crear un modulo era editar codigo y desplegar.

## Decision

**El estado decide la visibilidad, y se resuelve en el servidor.** `puedeVer(modulo, actor)` es la unica regla:

| Estado | Quien lo ve |
|---|---|
| `borrador` | solo su autor |
| `pendiente-de-aprobacion` | su autor y los Administradores |
| `publicado` | quien tenga concedido su nodo, como siempre |

Todos los caminos que sirven un modulo pasan por `moduloVisiblePorSlug` o `moduloVisibleParaUsuario`: la pagina, la vista incrustada, la API de datos, la exportacion, las alertas, las suscripciones y la consulta en lenguaje natural. `findModuleBySlug` sigue existiendo sin filtrar porque el editor necesita abrir borradores, y por eso lleva escrito en su comentario que no se use en un camino de lectura.

**Un borrador es de quien lo escribe, y tampoco lo toca un Administrador.** Administrar no concede acceso al trabajo en curso de otra persona. Un Administrador interviene cuando el modulo se propone; para uno abandonado tiene el borrado definitivo, que no exige leerlo.

**Publicar exige que no haya bloqueos**, comprobados con `findPublishBlockers` dos veces: al proponer —para no gastar el tiempo de quien revisa en encontrar lo que la maquina sabe decir sola— y al publicar, porque entre una cosa y otra el modulo pudo romperse.

**Publicar cuelga el modulo en la RAIZ de la organizacion general** si no estaba ya. Sin nodo en el arbol no hay ambito que resolver (4.10.4), asi que un publicado sin colgar no lo ve nadie. La raiz es el sitio mas restrictivo: no hereda ambito de ninguna carpeta, y **publicar no concede acceso a ningun equipo** — eso es 4.10.6 y lo decide un Administrador despues, viendo como cambia el acceso al moverlo.

**El editor valida contra el registro de datasets INTERSECADO con el esquema del cache**, nunca contra el conector. Solo el registro daria por bueno un campo que la fuente ya retiro; solo el esquema daria por disponible en un dataset cualquier campo del modelo.

## Consecuencias

- **Un modulo publicado no se edita en el sitio.** Para cambiarlo hay que retirarlo a borrador, y volver a pasar por aprobacion. Es incomodo a proposito: editar en vivo cambiaria lo que estan viendo todos los equipos sin que nadie lo aprobara, y el principio 8 dice lo mismo de los objetos compartidos.
- **Retirar es posible y deja rastro.** La alternativa —que un publicado con un fallo no se pueda quitar sin desplegar codigo— es peor que el riesgo de que alguien lo retire por error. Exige motivo, que es lo unico que le dice a los equipos que lo usaban por que desaparecio.
- **La navegacion se poda por estado, en un solo sitio.** `navegacionDe(sesion)` compone la concesion con la poda. Habia tres llamadas sueltas a `navigationFor` y bastaba olvidar una para que un modulo retirado siguiera apareciendo en la pantalla que no se reviso.
- **El editor no tiene donde escribir una consulta.** Es lo que hace cumplible "nunca SQL libre construido por el modulo": no es una regla que haya que recordar, es que la caja no existe. Hay una prueba de navegador que comprueba que no hay ningun `<textarea>` en el editor.
- **Un objeto roto se marca y no desaparece.** El modulo se sigue editando alrededor. Es literalmente lo que pide 4.2: "marcarlo visualmente roto, NO FALLAR EN SILENCIO".
- **Los complementos no se ofrecen en la paleta.** Son adjuntables y la validacion los rechaza como elementos de la rejilla; ofrecerlos seria ofrecer un error.
- **Los modulos pasan a vivir en un almacen escribible**, sembrado desde `modulos.ts`. `findModuleBySlug` se vuelve asincrona, con el mismo argumento que ya se aplico al gobierno: un puerto sincrono no lo puede implementar una base de datos.
- **`ConfigChangeLog` gana `entityType: 'module'` y las acciones `submit`, `publish` y `withdraw`.** Publicar no es editar: cambia QUIEN ve el modulo, y esa es la fila que un Administrador busca cuando revisa que se publico y quien lo aprobo.
