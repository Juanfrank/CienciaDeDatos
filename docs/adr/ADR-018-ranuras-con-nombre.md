# ADR-018 — El campo dice a que ranura pertenece

**Estado:** aceptado · **Fecha:** 2026-09-12 · **Sustituye a:** la parte de ADR-017 sobre pozos

## Contexto

ADR-017 introdujo ranuras con nombre —eje X, serie, eje Y— repartiendo `binding.dimensions` y
`binding.measures` **por orden**: la primera ranura se quedaba los primeros campos, la siguiente
los siguientes.

Se sostiene mientras se llenan en orden y se rompe en cuanto uno quiere saltarse alguna. En un
grafico de barras con eje X, serie y eje Y no habia forma de poner **solo la serie**: el primer
campo que se anadiera caeria en el eje X, porque «primero» era lo unico que el reparto sabia
mirar. Tampoco habia forma de dejar el eje X vacio a proposito. El orden es un criterio flojo para
un mapeo con nombres.

## Decision

`binding.ranuras` es un mapa de identificador de ranura a claves de campo, **y es la fuente de
verdad**. Un eje X vacio con una serie llena es un estado expresable, que es justo lo que faltaba.

### Que se conserva, y por que

`binding.dimensions` y `binding.measures` siguen existiendo: son lo que leen el lector del cache,
la validacion de esquema, la proyeccion y la exportacion. Se **derivan** de las ranuras, en el
orden en que estas se declaran, y se guardan junto a ellas. Nada rio abajo cambia. Lo que cambia
es quien manda: antes el array, ahora el mapa.

Derivarlos en orden de declaracion —y no en el que se llenaron— es lo que hace que dos modulos con
los mismos campos en las mismas ranuras produzcan la misma consulta, y por tanto la misma clave de
cache.

### Compatibilidad

Una instancia **sin** mapa —todo lo guardado antes de esto, el seed incluido— se interpreta con el
reparto posicional de siempre. La migracion es una funcion pura y probada, no un script que haya
que acordarse de ejecutar; y el primer cambio que se haga sobre esa instancia la deja ya con mapa.

### Minimos POR RANURA

Cada ranura declara cuantos campos necesita. Es lo que el contrato global no puede decir: «entre 1
y 2 dimensiones» se cumple igual con la dimension en el eje X que en la serie, y solo el primero
es un grafico que se puede dibujar.

Hay una prueba sobre todo el catalogo de que los minimos por ranura suman al menos el minimo
global. Si sumaran menos, una asignacion valida por ranura incumpliria el contrato y el objeto
saldria roto sin que el editor hubiera avisado de nada.

### Los renderizadores leen POR RANURA

`Barras` leia `dimensions[0]` como eje. Con las ranuras eso ya no vale: preguntando por la ranura,
un eje vacio es un eje vacio y el objeto se marca roto en vez de dibujar otra cosa. Las ranuras
viajan con el objeto serializado porque el cliente no tiene el registro.

La validacion de ranuras se hace **en los dos caminos**: en `validateModule`, que alimenta los
diagnosticos del editor, y en el lector, que decide si el objeto se dibuja. Sin lo segundo, un
grafico con el eje X vacio se dibujaba usando la serie como eje mientras el editor avisaba de que
faltaba el eje — dos respuestas distintas a la misma pregunta en la misma pantalla.

## Consecuencias

- El mismo campo puede estar en dos ranuras a la vez, y quitarlo de una no vacia la otra.
- Una asignacion guardada con mas campos de los que la ranura admite —porque el objeto cambio de
  version— se recorta al leer, y la validacion avisa de los campos que quedan en una ranura que ya
  no existe. Sin ese aviso quedarian mapeados sin que el editor los muestre ni nadie los quite.
- Anadir un objeto al catalogo sigue sin obligar a declarar ranuras: sin ellas se usan las
  genericas, una por tipo, y se comporta como antes.
