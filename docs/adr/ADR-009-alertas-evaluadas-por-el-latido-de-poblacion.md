# ADR-009: Las alertas se evaluan con el ambito de su dueno y al ritmo del dato

- **Estado:** aceptada
- **Fecha:** 2026-09-11
- **Contexto del contrato de ingenieria:** Seccion 4.9 pide "alertas y suscripciones basadas en datos" en una sola linea y no las desarrolla. Seccion 5.3 fija que toda operacion larga va a una cola. Principio 5: aislamiento por seguridad.

## Contexto

El documento nombra la funcion y no la define, asi que el modelo lo fija este repositorio. Dos preguntas lo ordenan todo: **con que datos** se evalua una regla, y **cuando**.

La respuesta ingenua a la primera —evaluar la condicion sobre el dataset cacheado y mandar el numero— convierte una notificacion en un canal por el que salen cifras que su destinatario no puede ver abriendo el modulo. Una alerta seria entonces la unica superficie de la aplicacion sin ambito.

La respuesta ingenua a la segunda —un temporizador propio— evalua dos veces el mismo dato y se pierde el cambio que ocurre entre dos vueltas. Una alerta "basada en datos" que corre por calendario esta basada en el calendario.

## Decision

**Una alerta se define sobre un objeto de un modulo y se evalua con `cargarModulo` bajo el usuario y el equipo que la crearon**, resueltos en el momento de evaluar. Es el mismo camino que sirve la pantalla y el mismo que genera una exportacion: lee del cache (principio 2) y aplica el ambito efectivo (4.10.4).

El equipo se fija EN LA REGLA y no se toma del equipo activo al evaluar: una persona que pertenece a dos equipos tiene dos ambitos, y una alerta tiene que saber cual es el suyo.

**Se evalua cuando el job deja un latido nuevo en el cache** (`POPULATOR_HEARTBEAT_KEY`, seccion 7). Esa marca es la senal de que el dato cambio.

**Se notifica solo en la TRANSICION**, en los dos sentidos: cuando la condicion empieza a cumplirse y cuando deja de cumplirse.

**Una suscripcion es una exportacion programada** y se entrega por la cola de 5.3, no por un camino propio.

## Consecuencias

- **Una regla que ya no se puede evaluar se deja intacta.** `observacionesDe` devuelve `null` —y no una lista vacia— cuando el modulo desaparecio, el objeto ya no esta o el equipo dejo de tenerlo concedido. Una lista vacia significa "nada cumple la condicion" y RESOLVERIA la alerta: se mandaria un "ya no se cumple" que nadie puede comprobar.
- **El aviso llega con cifras y nombra las categorias que cumplen.** Una alerta que solo dice "algo paso" obliga a abrir la aplicacion y buscar, y entonces no funciona como alerta. Eso vale dentro de la bandeja, donde quien lee ya se autentico. El dia que se anada correo, el adaptador tendra que decidir si esas cifras salen del perimetro o si el mensaje se reduce a un enlace: es una decision de la institucion, y por eso vive en el adaptador y no en la evaluacion.
- **Sin la regla de la transicion la funcion se autodestruye.** Un aviso repetido en cada ciclo de poblacion lleva a desactivar la alerta en una semana, y una alerta desactivada no avisa de nada. El fallo no se veria como un error: se veria como gente que dejo de usar la funcion.
- **`cambia-mas-de` no dispara en su primera evaluacion**: fija la linea base. Disparar ahi convertiria cada alerta recien creada en un aviso inmediato y sin sentido.
- **El ciclo se marca como procesado ANTES de evaluar.** Si evaluar falla a medias, no se reintenta en bucle sobre el mismo latido; la proxima poblacion trae otro. Reintentar un ciclo que falla es como se llena una bandeja de duplicados.
- **La entrega de una suscripcion se decide preguntando "¿toca ya?" en cada vuelta**, comparando contra el PERIODO y no contra "han pasado N horas". Asi una entrega perdida por un reinicio del App Service se recupera al volver, en vez de saltarse hasta el periodo siguiente, y no se repite porque el proceso se reiniciara.
- **El canal es un puerto.** `INotificationChannel` con la bandeja dentro de la aplicacion como unico adaptador hoy. El correo entra despues como otra implementacion, sin tocar la evaluacion ni la interfaz — el mismo patron que `IDataConnector`, `ICacheStore` e `IExportQueue`.
- **En este entorno el trabajador corre en el proceso del shell**, arrancado desde `instrumentation.ts`, por la misma razon que la cola de exportacion (ADR-008): el gobierno vive hoy en memoria de ese proceso y sin gobierno no hay ambito que resolver. En Azure lo sustituye una Function encadenada al ciclo de poblacion, llamando a las mismas funciones contra el gobierno en Azure SQL.
- Alternativa descartada: definir la alerta sobre un `datasetId` y una expresion. Es mas flexible y es justo lo que sobra — una expresion libre sobre un dataset no tiene ambito que resolver, y reintroduce por la puerta de atras la consulta ad hoc que la seccion 4.2 prohibe.
