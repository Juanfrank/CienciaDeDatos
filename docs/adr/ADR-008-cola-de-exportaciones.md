# ADR-008: La exportacion se despacha a una cola, siempre

- **Estado:** aceptada
- **Fecha:** 2026-09-11
- **Contexto del contrato de ingenieria:** Seccion 4.9 (exportar a PDF, Excel, CSV e imagen) y seccion 5.3, que nombra la exportacion como *el* ejemplo de operacion de larga duracion: *"se despacha a una cola (Azure Queue Storage o Service Bus) y se procesa fuera del ciclo de solicitud HTTP, con estado de progreso consultable — nunca bloqueando una instancia del App Service"*.

## Contexto

La lectura ingenua de 4.9 es un boton que devuelve un archivo. La 5.3 la descarta: generar un XLSX o un PDF grande dentro del ciclo de una solicitud ocupa una instancia del App Service mientras dura, y con escalado por longitud de cola HTTP (5.2) eso se traduce en instancias nuevas pagadas para no hacer nada.

La tentacion es tener dos caminos: sincrono para lo pequeño, encolado para lo grande.

## Decision

**Todas** las exportaciones se encolan, sea cual sea su tamaño. `POST /api/exportaciones` responde `202` con un identificador; el estado se consulta en `GET /api/exportaciones/{id}`; el archivo se descarga en una tercera peticion.

El puerto es `IExportQueue`. El adaptador de este entorno, `StoreExportQueue`, se apoya en el `ICacheStore` en disco que ya comparten el shell y el job. En Azure el mismo puerto se cablea a Azure Queue Storage sobre el Storage Account que ADR-004 ya provisiona.

## Consecuencias

- **Un solo camino de codigo.** Con dos caminos, el dia que alguien exporte algo grande por la via rapida bloquearia una instancia, y para entonces nadie recordaria por que existian dos.
- **El trabajo guarda la peticion, nunca las filas.** El ambito de quien exporto se vuelve a resolver al generar el archivo, no al encolarlo. Un trabajo con datos dentro seria un conjunto de filas con un ambito congelado viviendo en un almacen compartido, que es exactamente lo que el principio 5 prohibe.
- **El trabajador lee del cache**, a traves de la misma carga de modulo que sirve la pantalla. Exportar no abre un camino de lectura paralelo a la fuente (principio 2).
- **El encabezado dice la verdad sobre el contenido.** Lo que se escribe en el archivo son los filtros EFECTIVOS, ya intersecados con el ambito, mas una nota con las dimensiones cuyo filtro se descarto por quedar fuera de alcance. Un archivo vacio que anuncia "Distrito = Este" se leeria como "no hay casos en el Este", cuando lo cierto es que quien exporto no tiene acceso a ese distrito.
- **En este entorno el trabajador corre en el proceso del shell**, arrancado desde `instrumentation.ts` — fuera del ciclo de cualquier solicitud, pero dentro del mismo proceso. Es una consecuencia de que el gobierno viva hoy en memoria de ese proceso: otro proceso no podria resolver el ambito de quien pidio la exportacion, y generar un archivo sin resolver el ambito no es una opcion. En Azure lo sustituye una Function con disparador de cola que llama a la misma `procesarPendientes`, contra el gobierno en Azure SQL.
- **La descarga comprueba la propiedad otra vez**, no la hereda de la consulta de estado: una URL de descarga se comparte por chat con facilidad. Un trabajo ajeno responde `404` y no `403`, para no confirmar que ese identificador existe.
- Alternativa descartada: generar en el cliente. Evita la cola, pero exigiria mandar al navegador las filas completas sin agregar y meteria la logica de formato en la capa menos controlable. Ademas rompe el principio de que el servidor solo entrega lo que el ambito permite.
