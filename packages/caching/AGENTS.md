# packages/caching — el cache

El unico camino por el que un modulo obtiene datos. El job escribe; la aplicacion lee.

| Archivo | Que es |
|---|---|
| `ICacheStore.ts` | El puerto: leer, escribir y listar |
| `FileCacheStore.ts` | Implementacion en disco, para desarrollo y pruebas |
| `BlobCacheStore.ts` | Implementacion sobre Azure Blob Storage |
| `InMemoryCacheStore.ts` | Implementacion en memoria, para pruebas unitarias |
| `cacheKey.ts` | La clave: dataset mas ambito, para que dos ambitos no compartan filas |
| `CachedDatasetReader.ts` | Lectura y recorte por ambito |

## Reglas

- **La clave incluye el ambito.** Sin eso, la primera lectura de un equipo serviria sus filas a
  otro.
- **La lectura no consulta nunca la fuente.** Si el dataset no esta poblado, se dice; no se va a
  buscarlo.
- **Cambiar de implementacion no toca a quien lee**: todas cumplen `ICacheStore`.

## Que NO hacer

- No escribir en el cache desde la aplicacion: eso es trabajo del job.
- No cachear a nivel de objeto ni de pagina por encima de esto.
