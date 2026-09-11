# ADR-010: Una vista incrustada no es una vista publica

- **Estado:** aceptada
- **Fecha:** 2026-09-11
- **Contexto del contrato de ingenieria:** Seccion 4.9 pide "incorporacion (embedding) en otros portales". Principio 5 (aislamiento por seguridad) y seccion 4.10.4 (ambito efectivo).

## Contexto

Incrustar una vista en el portal de otra area plantea de inmediato una pregunta de autorizacion: ¿quien ve los datos dentro del iframe?

La respuesta comoda es un **token de incrustacion**: una URL con firma que el portal anfitrion pega y que "simplemente funciona" para cualquier visitante. Es lo que casi todas las herramientas de reporting ofrecen, y es la razon por la que se pide.

Tambien es la que convierte un iframe en un canal por el que sale cualquier dato a cualquiera que copie la URL. Ninguna de las puertas de la seccion 4.10 —grantedNodes, ambito efectivo, equipo activo— se aplicaria, porque no habria persona a la que aplicarselas.

## Decision

**No hay token de incrustacion.** La vista incrustada usa la MISMA sesion, el MISMO `cargarModulo` y el MISMO ambito efectivo que la pagina normal. Quien mire el portal anfitrion tiene que estar autenticado en esta aplicacion y vera lo que su propio ambito permita.

Lo unico que se anade es una **lista de portales autorizados a enmarcarnos** (`frame-ancestors`), configurable en ejecucion. Es una restriccion sobre quien puede mostrar la aplicacion, no una concesion sobre quien puede ver los datos.

Por defecto, **ninguna ruta es enmarcable**. Solo `/incrustar/*`, y solo desde los origenes de la lista.

## Consecuencias

- **Falla cerrado.** Sin lista configurada, tambien `/incrustar/*` deniega. Una configuracion olvidada deja la aplicacion sin incrustar, nunca incrustable por cualquiera.
- **Denegar por defecto cierra el clickjacking en todas las pantallas**, incluido el panel de administracion, sin que haya que acordarse de ninguna. Es un beneficio que no se buscaba y que conviene no perder al tocar el middleware.
- **No se admite comodin de subdominio**, aunque CSP lo permita: `https://*.ejemplo.do` autoriza cualquier subdominio presente y futuro, incluido el que alguien consiga apropiarse. Para unos pocos portales conocidos, escribirlos uno a uno cuesta poco.
- **`X-Frame-Options` solo se emite donde se deniega.** No admite lista de origenes —`ALLOW-FROM` se retiro de los navegadores— asi que en la ruta incrustable manda `frame-ancestors`; ponerla ahi bloquearia la incrustacion en los navegadores que dan prioridad a la cabecera antigua.
- **La cookie de sesion tiene que viajar en un contexto de terceros.** Hoy es `SameSite=Lax`, que NO se envia dentro de un iframe de otro origen: la incrustacion entre sitios distintos exige `SameSite=None; Secure`, y por tanto HTTPS y una revision del riesgo de CSRF que ese cambio abre. Queda pendiente y es deliberado que lo este: es una decision de seguridad de la institucion, no un ajuste de configuracion, y mientras no se tome la incrustacion funciona en el mismo sitio y muestra la pantalla de inicio de sesion fuera de el — que es el comportamiento correcto, aunque no el util.
- **La vista incrustada conserva procedencia (4.6) y frescura (4.8)** y pierde los controles que sacan de ella —marcadores, exportar, avisarme, arbol de navegacion—. Dentro de otro portal es donde la procedencia mas falta hace: quien mira ya no tiene alrededor la aplicacion que le diga de donde salen las cifras.
- **El dialogo que da el codigo lo advierte por escrito.** Quien lo pega espera que funcione para cualquier visitante; decirlo donde se copia evita que se descubra en produccion y se pida "un modo publico" para arreglarlo.
- Alternativa descartada: token firmado de corta vida ligado a un equipo. Sigue siendo un permiso que viaja en una URL, y una URL se comparte por chat con la misma facilidad con la que se pega en un portal.
