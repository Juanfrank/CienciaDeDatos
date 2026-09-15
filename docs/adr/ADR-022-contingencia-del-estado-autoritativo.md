# ADR-022: El respaldo declara que se lleva, y la restauracion se niega a devolver lo demas

- **Estado:** aceptada
- **Fecha:** 2026-09-15
- **Contexto del contrato de ingenieria:** Ninguno. El contrato no pide continuidad del negocio ni nombra RPO, RTO o copias de seguridad en ninguna de sus secciones recuperables. Es un hueco que nadie planteo, no una decision que alguien tomara.

## Contexto

Todo el gobierno de la aplicacion vive en el almacen compartido, y no se puede reconstruir: los datasets del cache son una copia de la fuente y el job los repuebla, pero quien ve que lo escribio una persona decidiendo. Nada lo respaldaba.

Peor que eso: `app:gobierno`, `app:modulos` y `app:modulos:historial` caen a la semilla de demostracion cuando no hay nada guardado. Es correcto para un despliegue nuevo y desastroso despues, porque convierte la perdida de estado en una aplicacion que **funciona con los datos equivocados** y responde 200.

## Decision

**Lo que entra en el respaldo es una decision declarada, prefijo por prefijo, con su motivo escrito** (`apps/shell/src/server/backup.ts`). No se copia el directorio del almacen.

Copiar el directorio parece lo mas simple y es lo peor de las dos maneras: se lleva lo que no debe volver y ata la copia al sistema de archivos, justo cuando el almacen tiene que poder ser Blob o SQL. La enumeracion pasa por el puerto, con `ICacheStore.keysByPrefix` —el gemelo de lectura del `deleteByPrefix` que ya existia—, asi que el respaldo sobrevive al cambio de almacen.

**Las sesiones y los tokens de un solo uso NO vuelven, y la restauracion los rechaza aunque vengan en el archivo.** Una sesion restaurada es una sesion que alguien revoco a proposito y que vuelve a valer; un token de restablecimiento restaurado es un enlace ya gastado que vuelve a abrir. La exclusion es una regla del que restaura, no una cortesia del que volco.

**Las credenciales locales quedan fuera.** `LocalCredentialRecord.totpSecret` se guarda en claro pese al comentario que dice lo contrario, asi que un respaldo con credenciales seria el segundo factor de toda la institucion en un archivo. Se paga con un RTO peor: al restaurar hay que recrear el primer Administrador con `npm run crear-administrador` y pasar el resto por el restablecimiento mediado de ADR-013 — dos caminos que ya existen y estan probados.

**La restauracion es EN SECO por defecto.** Restaurar se hace el peor dia, con prisa. Sin `--aplicar` el comando dice cuantas claves escribiria y cuales rechaza, y no toca nada. Y con un respaldo alterado o de otro formato no escribe **ni una clave**: media restauracion deja el gobierno en un estado que nadie tuvo nunca.

**Se anade un centinela, `app:instalacion`, que recuerda QUE claves llego a escribir este despliegue.** Con el, encontrar ausente algo que existio deja de ser indistinguible de un despliegue nuevo: `/health` lo reporta **caido**, que es la primera vez que una comprobacion distinta de la base de identidad lo hace. La razon es la misma que sostiene la tabla de `docs/observabilidad.md`: seguir respondiendo 200 mientras se enseña la semilla en vez del gobierno de la institucion es peor que no responder.

## Alternativas descartadas

- **Copiar el directorio del almacen.** Se lleva sesiones, tokens y credenciales; se ata al sistema de archivos; y no deja constancia de que contiene.
- **Cifrar el respaldo e incluir las credenciales.** Da mejor RTO y mete una clave de cifrado nueva en el kit de recuperacion: una pieza mas que custodiar y que, perdida, deja el respaldo inservible. Con el TOTP en claro, el riesgo de que el archivo se filtre pesa mas que los minutos que ahorra.
- **Respaldar desde la propia aplicacion, en un bucle del trabajador de fondo.** Escribir el respaldo en el mismo disco que se quiere proteger no protege de nada, y disfrazarlo de automatismo es peor que no tenerlo: se confia en algo que no cubre el caso.
- **Un centinela fuera del almacen** —una variable de entorno de despliegue— para detectar tambien la perdida total. Se descarto por ahora: anade una pieza de configuracion que hay que poner bien en cada entorno, y el que se olvide convierte la guarda en ruido. La perdida total la cubre el procedimiento.

## Consecuencias

- **`ICacheStore` crece con `keysByPrefix`.** Tres implementaciones cortas; `BlobCacheStore` ya listaba por prefijo por dentro. Un almacen que no sepa enumerar no sirve para esta aplicacion, asi que el puerto no lo deja opcional.
- **`KEY_MODULES`, `KEY_HISTORY` y `KEY_INSTALLATION` se mudan a `almacenCompartido.ts`**, junto al resto de las claves. El bloque ya decia «agrupadas aqui para verlas todas de una vez» y no lo estaban; ademas rompia el ciclo entre el almacen de modulos y el centinela.
- **`tools/coherence/respaldo.spec.ts` obliga a decidir, no a respaldar.** Una clave nueva sin clasificar pone la suite en rojo; `no-respaldar` con su motivo es una respuesta valida. La tabla se lee del archivo como texto porque `tools/coherence` no puede importar de `apps/shell`.
- **La prueba de ida y vuelta borra el almacen entero y lo devuelve**, y comprueba por los lectores publicos. Verificada sacando tres prefijos de la tabla, uno a uno: los tres la ponen en rojo.
- **El RPO depende de que alguien ejecute el comando.** Esta escrito asi en el procedimiento en vez de dar un numero que nadie sostiene.
- **Queda a la vista lo que no arregla:** todo el estado vive en el disco local de la instancia, `BlobCacheStore` esta escrito y sin instanciar, el Storage es `Standard_LRS` sin versionado y la base de identidad no declara politica de respaldo.
