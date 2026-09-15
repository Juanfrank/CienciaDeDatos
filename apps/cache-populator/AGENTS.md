# apps/cache-populator — el job de poblacion

Proceso aparte que lee la fuente y deja el resultado en el cache (6.4). Es el UNICO que puede
invocar `IDataConnector.query()`.

## Por que existe

El principio 2: ninguna peticion de una persona llega a la fuente. Lo que la aplicacion sirve ya
esta leido, agregado y guardado por dataset y ambito. Eso es lo que hace que una pagina responda
igual con la fuente caida y lo que impide que una consulta de negocio la sature.

## Reglas

- **Escribe por dataset y ambito.** La clave del cache incluye el ambito, de modo que el recorte
  no depende de que alguien se acuerde de aplicarlo al leer.
- **Publica tambien el esquema** (`SCHEMA_CACHE_KEY`): la validacion de modulos contrasta los
  mapeos contra las columnas que de verdad existen.
- **Deja latido y metricas.** Un cache viejo tiene que poder verse desde `/health`.
- **Falla ruidosamente.** Un dataset que no se pudo poblar se dice; no se deja el anterior como
  si fuera fresco sin avisar.

## En local

```bash
npm run populate              # conector mock, directorio .cache
npx tsx tools/populate-cache.mts --connector mock --dir .cache-e2e
```

## Que NO hacer

- No llamar a este job desde el shell.
- No mover aqui logica de presentacion: el job produce datos, no vistas.
