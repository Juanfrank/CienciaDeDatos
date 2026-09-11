# Prueba de carga y umbrales de autoscale

- **Contrato:** secciones 5.2 (senales de autoscale), 5.5 (Azure Load Testing) y 8.3 (metricas de cache visibles).
- **Criterio de la seccion 9:** *"Existe una prueba de carga documentada que sustenta los umbrales de autoscale configurados y que respalda, con evidencia, cualquier decision de subir de tier por encima de Standard (S1)."*

## Estado actual, sin adornos

**Los umbrales configurados en `infra/modules/appService.bicep` NO estan validados todavia.** Son valores de partida razonables, no resultados: 70 % de CPU, 80 % de memoria y 25 de longitud de cola HTTP. La seccion 5.5 es explicita en que no se deje "ninguno de los dos en valores por defecto sin validar", asi que se declaran como provisionales en el propio Bicep en vez de dejar que parezcan medidos.

Lo que falta para cerrarlo es una ejecucion de **Azure Load Testing contra el entorno de pruebas**, con la concurrencia esperada acordada con el equipo institucional. Ese numero no se puede inventar desde aqui: depende de cuanta gente usa hoy Power BI y en que franjas.

## Que hay hecho

`tools/carga/plan-de-carga.mts` define el escenario —que rutas, con que pesos, que se mide— y se puede ejecutar tal cual:

```
npx tsx tools/carga/plan-de-carga.mts --url http://localhost:4310 --concurrencia 20 --segundos 20
```

El perfil de rutas no reparte por igual: un modulo se abre una vez y se filtra varias, asi que la lectura filtrada pesa mas que la completa. Un perfil plano mediria un uso que no existe.

## Medicion local de referencia

Ejecutada en el entorno de desarrollo, una sola instancia, conector `mock`, cliente y servidor en la misma maquina:

| | |
|---|---|
| Concurrencia | 20 durante 15 s |
| Peticiones | 3 868, **0 fallidas** |
| Rendimiento | 258 peticiones/s |
| Latencia p50 / p95 / p99 | 78 / 104 / 128 ms |
| Lecturas de cache | 17 814 |
| **Servidas desde L1** | **17 799** |
| Servidas desde L2 | 15 |
| Sin poblar | 0 |
| Degradadas | 0 |

**Estos numeros no fijan ningun umbral.** Aqui no hay Front Door, ni el plan de App Service real, ni la latencia del Storage Account, y el cliente corre en la misma maquina que sirve. Valen para comparar un cambio contra el anterior, y para dos observaciones que si se sostienen:

1. **Ninguna lectura toco el conector** (`sin poblar: 0`, con el job ejecutado antes). Es el principio 2 medido bajo carga, no solo razonado.
2. **El 99,9 % de las lecturas se sirvio desde L1.** Es el dato que la seccion 6.1 pide para decidir sobre Redis, y apunta a que **no hace falta**: un cache de proceso absorbe casi todo, y el costo fijo de Redis no se justificaria con esta forma de uso. Conviene reconfirmarlo con varias instancias, donde cada una calienta su propio L1.

## Procedimiento para cerrar el criterio

1. **Acordar la concurrencia esperada** con el equipo institucional (usuarios simultaneos en hora punta, no usuarios totales).
2. **Desplegar el entorno de pruebas** con `infra/main.bicep`.
3. **Poblar el cache** con el job, como en produccion: la prueba mide el camino de lectura, y con el cache vacio mediria la pantalla de "generandose".
4. **Ejecutar Azure Load Testing** con el escenario de `plan-de-carga.mts`, subiendo la concurrencia por escalones hasta que la latencia p95 se salga del objetivo de servicio.
5. **Leer las tres senales de 5.2 durante la subida** —CPU, memoria y `HttpQueueLength`— y anotar en cual se degrada primero. Esa es la que debe disparar el escalado; las otras dos quedan como red de seguridad.
6. **Fijar el umbral por debajo del punto de degradacion**, con margen para que el escalado termine antes de que se note. Escalar cuando ya duele llega tarde.
7. **Actualizar `appService.bicep`** con los valores medidos y **quitar de ahi la marca de provisional**, anotando fecha y resultado en este documento.
8. **Decidir el tier con la evidencia**: si S1 aguanta la concurrencia acordada con el autoscale configurado, no se sube. La seccion 9 pide evidencia para subir, no para quedarse.

## Que revisar ademas del rendimiento

- `degradadas` distinto de cero durante la prueba significa que L2 no respondio bajo carga. Es una incidencia, no una estadistica: revisar el Storage Account antes de mirar ningun umbral.
- `sin poblar` distinto de cero significa que la prueba pidio datasets que el job no habia poblado. Los numeros de latencia de esa ejecucion no valen.
- Cada instancia acumula sus propias metricas y las expone en `/health`, con su pid. Con varias instancias, mirar la de cada una: una sola sirviendo degradado se pierde en cualquier agregado.
