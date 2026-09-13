# packages/nl-query — consulta en lenguaje natural

Traduce una pregunta escrita a una consulta sobre los datasets ya poblados.

## Reglas

- **Resuelve contra el esquema real**, no contra nombres inventados: si la dimension no existe,
  lo dice.
- **No amplia el ambito.** La consulta resultante pasa por el mismo recorte que cualquier otra.
- **Devuelve la consulta, no el resultado**: quien la ejecuta es el camino normal de lectura.

## Que NO hacer

- No dejar que una pregunta construya SQL ni toque la fuente.
- No devolver un resultado sin que se pueda ver en que se tradujo la pregunta.
