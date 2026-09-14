# ADR-011: La consulta en lenguaje natural resuelve una URL, no una consulta

- **Estado:** aceptada
- **Fecha:** 2026-09-11
- **Contexto del contrato de ingenieria:** Seccion 4.9 la pide como "ventaja diferencial nativa, sin depender de licencia premium adicional". Seccion 4.2 prohibe el SQL libre construido por un modulo. Seccion 4.11 exige que un parametro fuera de ambito no revele que valores existen fuera del alcance de quien pregunta.

## Contexto

La lectura habitual de "consulta en lenguaje natural" es texto a SQL. La seccion 4.2 la descarta de entrada: los objetos se enlazan a medidas certificadas, "nunca SQL libre construido por el modulo", y una pregunta traducida a SQL es exactamente eso con otro nombre.

Queda una segunda cuestion, menos evidente y mas peligrosa: **el vocabulario**. Un resolutor que conozca todas las dimensiones y todos sus valores contesta a "casos en Distrito Este" con "entendi Distrito = Este" — y eso confirma que ese distrito existe a alguien que no puede verlo. La caja de texto se convierte en un oraculo sobre los datos que el ambito oculta.

## Decision

**La respuesta a una pregunta es una URL**, no un resultado. Resolver consiste en reconocer una seleccion —medida, dimension, filtros— y construir la URL del modulo que la muestra. El camino de lectura sigue siendo el de siempre y le aplica el ambito como a cualquier otra URL.

**El vocabulario se construye con los datos que quien pregunta YA PUEDE VER**: las medidas que el modulo mapea y los valores presentes en los resultados ya filtrados por su ambito.

**El resolutor por defecto es local y determinista**, sin servicio externo. `INaturalLanguageResolver` deja la puerta abierta a un adaptador con modelo de lenguaje.

## Consecuencias

- **Una pregunta no puede ser una via distinta de lectura.** El endpoint no devuelve ni una cifra: devuelve que entendio y a donde ir. Hay una prueba que fija exactamente las claves de esa respuesta, para que anadir datos a la respuesta sea una decision consciente y no un descuido.
- **Un valor fuera de alcance se trata igual que uno inexistente.** Las dos situaciones tienen que ser indistinguibles desde fuera; de ahi que no se sugiera "¿querra decir Distrito Este?". Una sugerencia asi es la fuga que 4.11 prohibe, disfrazada de amabilidad.
- **La misma pregunta se entiende distinto segun quien la haga.** Es la consecuencia correcta de construir el vocabulario por persona, y hay prueba de navegador que lo comprueba con dos equipos.
- **El vocabulario incluye toda columna no numerica visible**, no solo las dimensiones mapeadas: quien mira el modulo ve esas columnas en la tabla de datos de origen y puede filtrarlas desde la URL, asi que no poder preguntarlas seria una limitacion arbitraria. Los valores siguen saliendo de filas ya filtradas.
- **La interfaz enseña lo que entendio ANTES de aplicarlo**, y lo que no entendio al lado. Contestar a medias en silencio —aplicar el filtro reconocido y callar el termino que no— es como se pierde la confianza en una funcion asi: quien pregunta cree que la respuesta cubre lo que pidio.
- **Un resolutor determinista es peor entendiendo y mejor de fiar**: da siempre el mismo resultado para la misma pregunta, se puede probar, y no puede inventarse una dimension que no existe. Es lo que permite cumplir "sin licencia premium" sin que la funcion sea un adorno.
- **Si algun dia entra un modelo de lenguaje**, la puerta de 4.2 no depende de confiar en el: la pone la FORMA del resultado. Un adaptador solo puede devolver una `ResolvedQuery` sobre el vocabulario permitido, nunca una consulta libre. Lo que si habra que decidir entonces es si el texto de la pregunta puede salir del perimetro institucional, que es una decision de la institucion y no del codigo.
