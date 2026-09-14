# ADR-021 — CI/CD por modulo y banderas en ejecucion

## Estado

Aceptado.

## Contexto

§3.4 pide que cada modulo se construya, pruebe y despliegue de forma independiente dentro del
mismo App Service, que un error en uno no bloquee el despliegue de los demas, y que se pueda
desactivar un modulo en produccion sin redespliegue.

Al ir a implementarlo apareció que **«modulo» significaba dos cosas** en el repositorio:

| | Que es | Cuantos | Quien lo usa |
|---|---|---|---|
| Modulo-codigo | `apps/modules/*`, con `module.contract.ts` y tag `type:module` | 1 | Nadie: es fixture del verificador de limites |
| Modulo-dato | `ModuleDefinition` en el almacen, que produce el editor | 5 | Todo |

§3.4 habla de «un error de compilacion en un modulo», que solo existe para el primero. Pero §4.2
establece que un modulo se compone de objetos prediseñados y no de codigo, y el editor produce lo
segundo. La lectura operativa es que **el modulo es dato**, y §3.4 hay que traducirlo:

- *construir* → validar contra el esquema real del cache
- *probar* → diagnosticar cada modulo por separado
- *desplegar* → publicarlo, y que su bandera este encendida

Ademas, App Configuration llevaba desde el Entregable B provisionado en Bicep, con el rol asignado
a la identidad administrada y `APP_CONFIG_ENDPOINT` llegando al contenedor —y con un comentario
que decia «el conector activo y los feature flags se resuelven aqui en ejecucion, no se hornean en
el build»—. **Nadie lo leia.** El conector salia de `process.env`, que solo cambia reiniciando.

## Decision

### Un puerto de configuracion, dos implementaciones

`packages/config` define `SettingsFont` y lee una **instantanea completa**, no una bandera
por consulta: con una llamada por bandera, pintar un arbol de ocho modulos serian ocho viajes, y
—mas importante— todas las decisiones de una misma peticion tienen que salir de la misma foto,
para que el arbol y la ruta no discrepen si vence el TTL a mitad.

`AppConfiguration` habla la API REST con un token de `@azure/identity`, que ya era dependencia.
No se añadio `@azure/app-configuration`: son dos llamadas HTTP, y cada paquete nuevo en un entorno
cerrado cuesta revision y renovacion. `EnvironmentSettings` lee `MODULOS_APAGADOS` y
`DATA_CONNECTOR`, y es la que corre en desarrollo y en las pruebas de navegador — el mismo puerto,
asi que el apagado se prueba de verdad sin nube.

### Tres decisiones de degradacion

1. **TTL de 30 s.** «Sin redespliegue» solo significa algo si surte efecto en segundos; con
   minutos, el interruptor de emergencia es un tramite y la gente reinicia.
2. **Ante un fallo, el ultimo valor conocido.** Lo que no puede pasar es que un modulo apagado a
   proposito —porque da cifras malas— se reencienda solo porque App Configuration no responde.
3. **Esa ultima foto se persiste en el almacen compartido.** Un reinicio durante la caida —que es
   cuando hay reinicios— dejaria a la instancia nueva sin memoria.

Y sin ninguna foto, ni fresca ni guardada, **se abre**: el estado por defecto de un modulo es
encendido, y dejar el portal en blanco porque el servicio de banderas no contesta convertiria una
dependencia auxiliar en punto unico de fallo. Por el mismo motivo, una bandera **ausente** cuenta
como encendida: exigirla haria que cada modulo nuevo naciera invisible.

### Dos puertas, no una

- `visibleModuleSlug` responde al **ciclo de vida**: existe y su estado permite abrirlo. La
  usan el editor y el panel de administracion.
- `slugServableModule` añade la bandera. La usan los caminos que **sirven** el modulo: la
  pagina, el incrustado, la API, la exportacion y la evaluacion de alertas.

La distincion importa en la direccion que no es obvia: un modulo apagado **tiene que seguir
abriendose en el editor**. Apagarlo es lo que se hace cuando da cifras malas; si el interruptor
cerrara tambien la puerta de arreglarlo, habria que reencenderlo en produccion para poder tocarlo.

### Tres estados de salud, no dos

`healthOf()` en `module-model` clasifica cada modulo:

- `ok` — nada roto.
- `degradado` — algun objeto roto, el modulo abre. **Se despliega.**
- `fallo` — no se puede componer: disposicion invalida, sin paginas, o ni un objeto sano.

Un objeto roto **no** es un modulo caido: §4.2 dice que se marca y el resto sigue funcionando.
Apagar el modulo entero por un campo retirado seria incumplir esa regla desde el despliegue, y
ademas dejaria permanentemente rojo al fixture que existe para demostrarla.

### El CI no se bloquea

`tools/estado-de-modulos.mts` valida cada modulo por separado —con `try/catch` por modulo, para
que una excepcion en el septimo no deje sin evaluar del octavo al decimo— y emite un JSON. **Sale
con codigo 0 aunque haya modulos caidos**: si saliera 1, el paso de despliegue no correria y un
modulo roto bloquearia a los demas, que es exactamente lo que §3.4 prohibe. El job vive aparte del
de verificacion por lo mismo.

`tools/aplicar-banderas.mts` lleva ese JSON a App Configuration antes del swap, en las **dos**
direcciones: apaga lo caido y vuelve a encender lo recuperado. Un interruptor que solo sabe apagar
deja el modulo arreglado invisible hasta que alguien se acuerde, y convierte cada arreglo en dos
tareas. Solo escribe lo que cambia: cada escritura es una revision, y reescribir diez banderas
identicas en cada despliegue convierte el historial —donde se mira quien apago que y cuando— en
ruido.

## Consecuencias

- El conector activo pasa a resolverse en ejecucion. Cambiar entre mock, sql y xmla deja de
  requerir reinicio, que es lo que el Bicep declaraba desde el principio.
- La primera ejecucion del validador encontro un defecto que ninguna prueba veia: `tarjeta-kpi`
  dibujaba una `etiqueta` que su version publicada no declaraba admitir. El camino de LECTURA no
  comprueba la presentacion —solo el del editor lo hace— y ninguna prueba abria el editor sobre un
  modulo con etiquetas. Se corrigio publicando `tarjeta-kpi` **1.1.0** y fijando en ella las dos
  instancias que la usan; la 1.0.0 no se toco (§4.5).
- Queda pendiente el verificador que §3.3 promete: contrastar lo que un modulo consume contra lo
  que su `module.contract.ts` declara. Hoy `casos-pendientes` ya divergio —declara
  `DiasResolucion` y no la usa; usa `CasosIngresados` y `CasosResueltos` sin declararlas—. Se
  aplaza porque los modulos declarados son de desarrollo y el contrato se rehara con los reales.
